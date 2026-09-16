import { Request, Response } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getAllUsers(req: Request, res: Response) {
  try {
    const users = db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, created_at FROM users ORDER BY created_at DESC').all();
    return res.json({ success: true, count: users.length, data: users });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createUserByAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    const { username, email, password, full_name, role, shift } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'El usuario o correo ya existe' });
    }

    const id = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 10);
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, email, hash, full_name, role || 'OPERATOR', shift || 'GUARDIA_A', avatarUrl);

    logAudit(req.user?.userId || null, req.user?.username || 'admin', 'CREATE_USER', 'USERS', id, `Creación de usuario ${username} (${role})`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Usuario creado exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getAuditLogs(req: Request, res: Response) {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getDatabaseBackup(req: Request, res: Response) {
  try {
    const dbPath = process.env.DB_PATH || './data/basetrack.db';
    const resolved = path.resolve(process.cwd(), dbPath);

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, message: 'Archivo de base de datos no encontrado' });
    }

    // Export comprehensive JSON data backup
    const tables = {
      users: db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, created_at FROM users').all(),
      shift_handovers: db.prepare('SELECT * FROM shift_handovers').all(),
      pump_reports: db.prepare('SELECT * FROM pump_reports').all(),
      cyclone_reports: db.prepare('SELECT * FROM cyclone_reports').all(),
      tailings_reports: db.prepare('SELECT * FROM tailings_reports').all(),
      maintenance_requests: db.prepare('SELECT * FROM maintenance_requests').all(),
      audit_logs: db.prepare('SELECT * FROM audit_logs').all(),
      exportedAt: new Date().toISOString(),
      system: 'BASETRACK_APP_V1'
    };

    return res.json({
      success: true,
      message: 'Copia de seguridad exportada con éxito',
      backup: tables
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
