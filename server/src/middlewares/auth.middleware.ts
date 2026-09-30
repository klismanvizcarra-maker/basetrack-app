import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../config/jwt.js';
import { db } from '../database/db.js';
import { PermissionKey, DEFAULT_ROLE_PERMISSIONS } from '../config/permissions.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
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
      const userRow = db.prepare('SELECT is_active FROM users WHERE id = ?').get(decoded.userId) as { is_active?: number } | undefined;
      if (userRow && userRow.is_active === 0) {
        return res.status(403).json({
          success: false,
          message: 'Cuenta suspendida. La sesión ha sido revocada por el Administrador.'
        });
      }
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

    // Super Admin Marckv / admin has unconditional access
    const isSuperAdmin =
      req.user.role === 'ADMIN' ||
      req.user.username?.toLowerCase() === 'marckv' ||
      req.user.username?.toLowerCase() === 'admin';

    if (isSuperAdmin) {
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

    // Super Admin Marckv / admin has unconditional access
    const isSuperAdmin =
      req.user.role === 'ADMIN' ||
      req.user.username?.toLowerCase() === 'marckv' ||
      req.user.username?.toLowerCase() === 'admin';

    if (isSuperAdmin) {
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
      const userRole = (req.user.role || 'OPERATOR') as 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
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
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[req.user.role as 'ADMIN' | 'SUPERVISOR' | 'OPERATOR'] || [];
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

