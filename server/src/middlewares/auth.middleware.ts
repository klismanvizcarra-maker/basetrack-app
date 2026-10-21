import { Request, Response, NextFunction } from 'express';
import { verifyToken, generateToken, TokenPayload } from '../config/jwt.js';
import { db } from '../database/db.js';
import { PermissionKey, DEFAULT_ROLE_PERMISSIONS } from '../config/permissions.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

const TEMPORARY_PASSWORD_ALLOWED = ['/auth/me', '/auth/change-password', '/auth/permissions'];

/**
 * Invalida todos los JWT emitidos para el usuario (suspensión, cambio/reset de contraseña,
 * revocación de una de sus terminales). Los tokens nuevos se firman con la versión vigente.
 */
export function bumpTokenVersion(userId: string): void {
  db.prepare('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?').run(userId);
}

/**
 * Firma un JWT con la versión vigente del usuario. Se devuelve a la terminal que provocó el
 * incremento de token_version (p. ej. su propio cambio de contraseña) para que no pierda la sesión.
 */
export function issueFreshToken(userId: string): string | null {
  const u = db.prepare('SELECT id, username, role, shift, full_name, token_version FROM users WHERE id = ?').get(userId) as
    { id: string; username: string; role: TokenPayload['role']; shift: string; full_name: string; token_version?: number } | undefined;
  if (!u) return null;
  return generateToken({
    userId: u.id,
    username: u.username,
    role: u.role,
    shift: u.shift,
    fullName: u.full_name,
    tokenVersion: u.token_version ?? 0
  });
}

/** true si el token fue emitido con una versión anterior a la vigente del usuario */
export function isTokenVersionStale(decoded: TokenPayload, currentVersion: number | null | undefined): boolean {
  return (decoded.tokenVersion ?? 0) !== (currentVersion ?? 0);
}

/** true si la terminal fue revocada por el Administrador (hasta que vuelva a iniciar sesión) */
export function isDeviceRevoked(deviceId: string | undefined | null): boolean {
  if (!deviceId) return false;
  const row = db.prepare('SELECT is_revoked FROM connected_devices WHERE device_id = ?').get(String(deviceId)) as { is_revoked?: number } | undefined;
  return row?.is_revoked === 1;
}

function isAllowedWithTemporaryPassword(req: Request): boolean {
  const path = (req.originalUrl || req.url || '').split('?')[0].replace(/^\/api/, '');
  return TEMPORARY_PASSWORD_ALLOWED.includes(path);
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticación no proporcionado'
    });
  }

  try {
    const decoded = verifyToken(token);
    // Security check: verify that the user account is not suspended
    if (decoded.userId) {
      const userRow = db.prepare('SELECT is_active, must_change_password, token_version FROM users WHERE id = ?').get(decoded.userId) as { is_active?: number; must_change_password?: number; token_version?: number } | undefined;
      if (userRow && userRow.is_active === 0) {
        return res.status(403).json({
          success: false,
          message: 'Cuenta suspendida. La sesión ha sido revocada por el Administrador.'
        });
      }
      // Token emitido antes de una suspensión, cambio de contraseña o revocación de terminal
      if (userRow && isTokenVersionStale(decoded, userRow.token_version)) {
        return res.status(401).json({
          success: false,
          message: 'Token de autenticación revocado. Inicie sesión nuevamente.'
        });
      }
      // Con contraseña temporal solo se permite consultar el perfil y cambiar la contraseña
      if (userRow?.must_change_password === 1 && !isAllowedWithTemporaryPassword(req)) {
        return res.status(403).json({
          success: false,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Debe cambiar su contraseña temporal antes de continuar.'
        });
      }
    }
    // Terminal revocada: rechazar aunque el token sea de otro usuario, hasta un nuevo inicio de sesión
    if (isDeviceRevoked(req.headers['x-device-id']?.toString())) {
      return res.status(401).json({
        success: false,
        message: 'Sesión de terminal revocada por el Administrador. Inicie sesión nuevamente.'
      });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticación inválido o expirado'
    });
  }
}

export function requireRoles(...allowedRoles: Array<'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'OPERADOR'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    // ADMIN tiene acceso incondicional. La autorización se basa solo en el rol firmado en el JWT,
    // nunca en el nombre de usuario (un usuario llamado 'admin' con rol OPERATOR no debe escalar).
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    // ADMIN tiene acceso incondicional. La autorización se basa solo en el rol firmado en el JWT,
    // nunca en el nombre de usuario (un usuario llamado 'admin' con rol OPERATOR no debe escalar).
    if (req.user.role === 'ADMIN') {
      return next();
    }

    try {
      // 1. Check user-specific overrides first
      const userId = req.user.userId || req.user.username;
      const userOverride = db.prepare('SELECT permissions FROM user_permission_overrides WHERE user_id = ?').get(userId) as { permissions: string } | undefined;
      if (userOverride && userOverride.permissions) {
        const overrides = JSON.parse(userOverride.permissions);
        if (typeof overrides[permission] === 'boolean') {
          if (overrides[permission]) {
            return next();
          } else {
            return res.status(403).json({
              success: false,
              message: `Acceso denegado: el permiso '${permission}' está revocado para su usuario.`
            });
          }
        }
      }

      // 2. Check role permissions from database
      const userRole = (req.user.role || 'OPERATOR') as 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE';
      const roleRow = db.prepare('SELECT permissions FROM role_permissions WHERE role = ?').get(userRole) as { permissions: string } | undefined;
      let effectiveRolePerms: string[] = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
      if (roleRow && roleRow.permissions) {
        try {
          effectiveRolePerms = JSON.parse(roleRow.permissions);
        } catch {}
      }

      if (effectiveRolePerms.includes(permission)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Acceso denegado: se requiere el permiso '${permission}' para ejecutar esta acción.`
      });
    } catch (err: any) {
      console.warn('[auth.middleware] requirePermission check failed:', err);
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[req.user.role as 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE'] || [];
      if (defaultPerms.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: se requiere el permiso '${permission}'.`
      });
    }
  };
}

