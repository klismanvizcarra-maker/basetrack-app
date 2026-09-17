import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../config/jwt.js';

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
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Token de autenticación inválido o expirado'
    });
  }
}

export function requireRoles(...allowedRoles: Array<'ADMIN' | 'SUPERVISOR' | 'OPERATOR'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    // Super Admin KlismanV / admin has unconditional access
    const isSuperAdmin =
      req.user.role === 'ADMIN' ||
      req.user.username?.toLowerCase() === 'klismanv' ||
      req.user.username?.toLowerCase() === 'admin' ||
      req.user.fullName?.toUpperCase().includes('KLISMAN');

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
