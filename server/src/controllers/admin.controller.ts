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

export function createUsersBulk(req: AuthenticatedRequest, res: Response) {
  try {
    const rawUsers = req.body.users;
    if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
      return res.status(400).json({ success: false, message: 'La lista de usuarios debe ser un arreglo no vacío' });
    }

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCrew = db.prepare(`
      INSERT INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const checkExistingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    const checkExistingCrewDoc = db.prepare('SELECT id FROM crew_members WHERE document_id = ?');

    let importedCount = 0;
    const skippedList: Array<{ username: string; email: string; reason: string }> = [];

    db.exec('BEGIN TRANSACTION;');

    try {
      for (const item of rawUsers) {
        const username = item.username?.toString().trim();
        const email = item.email?.toString().trim();
        const fullName = (item.full_name || item.name || username)?.toString().trim();
        const role = (item.role || 'OPERATOR').toString().toUpperCase();
        const shift = (item.shift || 'GUARDIA_A').toString().toUpperCase();
        const password = item.password || 'Basetrack2026!';
        const documentId = (item.document_id || item.dni || item.doc || ('DNI-' + Math.floor(10000000 + Math.random() * 90000000))).toString().trim();
        const radio = item.radio_channel || 'Canal 1 Operaciones';
        const phone = item.phone_extension || null;
        const avatar = item.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

        if (!username || !email || !fullName) {
          skippedList.push({ username: username || 'Sin usuario', email: email || 'Sin email', reason: 'Campos requeridos incompletos' });
          continue;
        }

        // Check if user already exists
        const existing = checkExistingUser.get(username, email);
        if (existing) {
          skippedList.push({ username, email, reason: 'Usuario o correo ya registrado previamente' });
          continue;
        }

        const userId = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);

        insertUser.run(
          userId,
          username,
          email,
          hash,
          ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(role) ? role : 'OPERATOR',
          ['GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C'].includes(shift) ? shift : 'GUARDIA_A',
          avatar
        );

        // Also insert into crew_members if operator or supervisor and document not duplicate
        const existingCrew = checkExistingCrewDoc.get(documentId);
        if (!existingCrew) {
          let primaryRole = 'OPERADOR_BOMBAS';
          if (item.primary_role) {
            primaryRole = item.primary_role;
          } else if (role === 'SUPERVISOR') {
            primaryRole = 'SUPERVISOR';
          } else {
            const lowerName = fullName.toLowerCase() + ' ' + (item.area || '').toLowerCase();
            if (lowerName.includes('ciclon')) primaryRole = 'OPERADOR_CICLONES';
            else if (lowerName.includes('descarga') || lowerName.includes('relave') || lowerName.includes('presa')) primaryRole = 'OPERADOR_DESCARGA';
            else if (lowerName.includes('misc') || lowerName.includes('reactivo')) primaryRole = 'OPERADOR_MISCELANEOS';
            else if (lowerName.includes('relevo')) primaryRole = 'OPERADOR_RELEVO';
            else primaryRole = 'OPERADOR_BOMBAS';
          }

          insertCrew.run(
            crypto.randomUUID(),
            fullName,
            documentId,
            primaryRole,
            ['GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C'].includes(shift) ? shift : 'GUARDIA_A',
            radio,
            phone,
            'EN_TURNO',
            avatar
          );
        }

        importedCount++;
      }

      db.exec('COMMIT;');
    } catch (innerErr) {
      db.exec('ROLLBACK;');
      throw innerErr;
    }

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'admin',
      'BULK_CREATE_USERS',
      'USERS',
      null,
      `Carga masiva: ${importedCount} usuarios importados, ${skippedList.length} omitidos`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({
      success: true,
      message: `Carga completada: ${importedCount} usuarios importados exitosamente`,
      count: importedCount,
      skippedCount: skippedList.length,
      skipped: skippedList
    });
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
