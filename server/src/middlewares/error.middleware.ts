import { Request, Response, NextFunction } from 'express';
import { db } from '../database/db.js';
import crypto from 'node:crypto';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Unhandled Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

export function logAudit(userId: string | null, username: string, action: string, entity: string, entityId: string | null, details: string, ipAddress: string) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(crypto.randomUUID(), userId, username, action, entity, entityId, details, ipAddress);
  } catch (e) {
    console.error('[AuditLog Error]', e);
  }
}
