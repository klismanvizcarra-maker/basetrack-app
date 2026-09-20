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
    const users = db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, COALESCE(is_active, 1) as is_active, created_at FROM users ORDER BY created_at DESC').all();
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
          fullName,
          ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(role) ? role : 'OPERATOR',
          ['G1', 'G2', 'G3', 'G4', 'GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C'].includes(shift) ? shift : 'G1',
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
            if (lowerName.includes('ciclon') && lowerName.includes('2')) primaryRole = 'OPERADOR_CICLONES_2';
            else if (lowerName.includes('ciclon')) primaryRole = 'OPERADOR_CICLONES_1';
            else if (lowerName.includes('distribuidor')) primaryRole = 'OPERADOR_DISTRIBUIDOR';
            else if (lowerName.includes('descarga') && lowerName.includes('2')) primaryRole = 'OPERADOR_DESCARGA_2';
            else if (lowerName.includes('descarga') || lowerName.includes('relave') || lowerName.includes('presa')) primaryRole = 'OPERADOR_DESCARGA_1';
            else if (lowerName.includes('misc') || lowerName.includes('reactivo')) primaryRole = 'OPERADOR_MISCELANEOS';
            else primaryRole = 'OPERADOR_BOMBAS';
          }

          insertCrew.run(
            crypto.randomUUID(),
            fullName,
            documentId,
            primaryRole,
            ['G1', 'G2', 'G3', 'G4', 'GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C'].includes(shift) ? shift : 'G1',
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

    // Export comprehensive JSON data backup with all operational tables
    const tables = {
      users: db.prepare('SELECT id, username, email, full_name, role, shift, avatar_url, created_at FROM users').all(),
      shift_handovers: db.prepare('SELECT * FROM shift_handovers').all(),
      pump_reports: db.prepare('SELECT * FROM pump_reports').all(),
      pump_station_sheets: db.prepare('SELECT * FROM pump_station_sheets').all(),
      cyclone_reports: db.prepare('SELECT * FROM cyclone_reports').all(),
      cyclone_station_samples: db.prepare('SELECT * FROM cyclone_station_samples').all(),
      tailings_reports: db.prepare('SELECT * FROM tailings_reports').all(),
      maintenance_requests: db.prepare('SELECT * FROM maintenance_requests').all(),
      crew_members: db.prepare('SELECT * FROM crew_members').all(),
      crew_positions: db.prepare('SELECT * FROM crew_positions').all(),
      crew_area_assignments: db.prepare('SELECT * FROM crew_area_assignments').all(),
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

export function restoreDatabaseBackup(req: AuthenticatedRequest, res: Response) {
  try {
    const data = req.body.backup || req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Estructura de respaldo JSON inválida' });
    }

    const summary: Record<string, number> = {};

    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Crew members
      if (Array.isArray(data.crew_members) && data.crew_members.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const m of data.crew_members) {
          if (m.id && m.name && m.document_id) {
            stmt.run(m.id, m.name, m.document_id, m.primary_role || 'OPERADOR_BOMBAS', m.shift_code || 'GUARDIA_A', m.radio_channel || 'Canal 1 Operaciones', m.phone_extension || null, m.status || 'EN_TURNO', m.avatar_url || null, m.created_at || null);
            count++;
          }
        }
        summary.crew_members = count;
      }

      // 2. Crew positions
      if (Array.isArray(data.crew_positions) && data.crew_positions.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO crew_positions (key, title, default_location, default_radio, badge_class, route_link, route_label, icon_svg, description, is_custom, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const p of data.crew_positions) {
          if (p.key && p.title) {
            stmt.run(p.key, p.title, p.default_location || null, p.default_radio || null, p.badge_class || null, p.route_link || null, p.route_label || null, p.icon_svg || null, p.description || null, p.is_custom !== undefined ? (p.is_custom ? 1 : 0) : 0, p.created_at || null);
            count++;
          }
        }
        summary.crew_positions = count;
      }

      // 3. Crew area assignments
      if (Array.isArray(data.crew_area_assignments) && data.crew_area_assignments.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO crew_area_assignments (id, shift_code, shift_date, shift_type, position_key, position_title, operator_id, backup_operator_id, epp_verified, safety_talk_completed, radio_channel, station_location, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const a of data.crew_area_assignments) {
          if (a.id && a.shift_code && a.operator_id) {
            stmt.run(a.id, a.shift_code, a.shift_date, a.shift_type || 'DIA', a.position_key, a.position_title, a.operator_id, a.backup_operator_id || null, a.epp_verified ? 1 : 0, a.safety_talk_completed ? 1 : 0, a.radio_channel || null, a.station_location || null, a.notes || null, a.updated_at || null);
            count++;
          }
        }
        summary.crew_area_assignments = count;
      }

      // 4. Pump station sheets
      if (Array.isArray(data.pump_station_sheets) && data.pump_station_sheets.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO pump_station_sheets (id, report_date, shift_code, operator_name, sentina_pumps_json, intermedia_pumps_json, torre5_pumps_json, levels_json, main_indicators_json, pozas_sentina_json, additional_obs_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const s of data.pump_station_sheets) {
          if (s.id && s.report_date) {
            stmt.run(
              s.id,
              s.report_date,
              s.shift_code || 'GUARDIA_A',
              s.operator_name || 'Operador',
              typeof s.sentina_pumps_json === 'string' ? s.sentina_pumps_json : JSON.stringify(s.sentina_pumps || []),
              typeof s.intermedia_pumps_json === 'string' ? s.intermedia_pumps_json : JSON.stringify(s.intermedia_pumps || []),
              typeof s.torre5_pumps_json === 'string' ? s.torre5_pumps_json : JSON.stringify(s.torre5_pumps || []),
              typeof s.levels_json === 'string' ? s.levels_json : JSON.stringify(s.levels || {}),
              typeof s.main_indicators_json === 'string' ? s.main_indicators_json : JSON.stringify(s.main_indicators || {}),
              typeof s.pozas_sentina_json === 'string' ? s.pozas_sentina_json : JSON.stringify(s.pozas_sentina || []),
              typeof s.additional_obs_json === 'string' ? s.additional_obs_json : JSON.stringify(s.additional_obs || {}),
              s.created_at || null,
              s.updated_at || null
            );
            count++;
          }
        }
        summary.pump_station_sheets = count;
      }

      // 5. Cyclone station samples
      if (Array.isArray(data.cyclone_station_samples) && data.cyclone_station_samples.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO cyclone_station_samples (id, station, sample_time, battery_tag, solids_feed, solids_of, solids_uf, mesh200_feed, mesh200_of, mesh200_uf, shift_code, date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const cs of data.cyclone_station_samples) {
          if (cs.id && cs.sample_time) {
            stmt.run(cs.id, cs.station || '2DA ESTACIÓN CICLONES', cs.sample_time, cs.battery_tag || 'BATERÍA D', cs.solids_feed || 0, cs.solids_of || 0, cs.solids_uf || 0, cs.mesh200_feed || 0, cs.mesh200_of || 0, cs.mesh200_uf || 0, cs.shift_code || 'GUARDIA_A', cs.date || new Date().toISOString().slice(0, 10), cs.created_at || null);
            count++;
          }
        }
        summary.cyclone_station_samples = count;
      }

      // 6. Shift handovers
      if (Array.isArray(data.shift_handovers) && data.shift_handovers.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO shift_handovers (id, shift_code, date, shift_type, outgoing_supervisor, incoming_supervisor, plant_status, tonnage_processed, safety_incidents, operational_highlights, pending_tasks, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const sh of data.shift_handovers) {
          if (sh.id && sh.shift_code) {
            stmt.run(sh.id, sh.shift_code, sh.date, sh.shift_type || 'DIA', sh.outgoing_supervisor || '', sh.incoming_supervisor || '', sh.plant_status || 'Operación Normal', sh.tonnage_processed || 0, sh.safety_incidents || '', sh.operational_highlights || '', sh.pending_tasks || '', sh.status || 'SUBMITTED', sh.created_at || null);
            count++;
          }
        }
        summary.shift_handovers = count;
      }

      // 7. Pump reports
      if (Array.isArray(data.pump_reports) && data.pump_reports.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO pump_reports (id, tag, name, system, status, flow_rate_m3h, pressure_bar, rpm, bearing_temp_c, vibration_mms, current_amps, shift_code, operator_name, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const p of data.pump_reports) {
          if (p.id && p.tag) {
            stmt.run(p.id, p.tag, p.name || p.tag, p.system || 'Bombeo', p.status || 'OPERATING', p.flow_rate_m3h || 0, p.pressure_bar || 0, p.rpm || 0, p.bearing_temp_c || 0, p.vibration_mms || 0, p.current_amps || 0, p.shift_code || 'GUARDIA_A', p.operator_name || 'Operador', p.notes || null, p.created_at || null);
            count++;
          }
        }
        summary.pump_reports = count;
      }

      // 8. Cyclone reports
      if (Array.isArray(data.cyclone_reports) && data.cyclone_reports.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO cyclone_reports (id, battery_tag, total_cyclones, active_cyclones, feed_pressure_psi, feed_density_kgm3, p80_microns, overflow_density, underflow_density, flocculant_ppm, status, shift_code, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const c of data.cyclone_reports) {
          if (c.id && c.battery_tag) {
            stmt.run(c.id, c.battery_tag, c.total_cyclones || 12, c.active_cyclones || 10, c.feed_pressure_psi || 0, c.feed_density_kgm3 || 0, c.p80_microns || 0, c.overflow_density || 0, c.underflow_density || 0, c.flocculant_ppm || 0, c.status || 'OPTIMAL', c.shift_code || 'GUARDIA_A', c.notes || null, c.created_at || null);
            count++;
          }
        }
        summary.cyclone_reports = count;
      }

      // 9. Tailings reports
      if (Array.isArray(data.tailings_reports) && data.tailings_reports.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO tailings_reports (id, station_tag, flow_rate_m3h, solids_percentage, dam_level_meters, freeboard_meters, piezometer_kpa, turbidity_ntu, pumping_line_status, operator_name, shift_code, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const t of data.tailings_reports) {
          if (t.id && t.station_tag) {
            stmt.run(t.id, t.station_tag, t.flow_rate_m3h || 0, t.solids_percentage || 0, t.dam_level_meters || 0, t.freeboard_meters || 0, t.piezometer_kpa || 0, t.turbidity_ntu || 0, t.pumping_line_status || 'NORMAL', t.operator_name || 'Operador', t.shift_code || 'GUARDIA_A', t.notes || null, t.created_at || null);
            count++;
          }
        }
        summary.tailings_reports = count;
      }

      // 10. Maintenance requests
      if (Array.isArray(data.maintenance_requests) && data.maintenance_requests.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO maintenance_requests (id, ticket_number, equipment_tag, title, description, priority, status, requester_name, assigned_to, photo_url, estimated_hours, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
        `);
        let count = 0;
        for (const m of data.maintenance_requests) {
          if (m.id && m.ticket_number) {
            stmt.run(m.id, m.ticket_number, m.equipment_tag || 'EQUIP-01', m.title || 'Mantenimiento', m.description || '', m.priority || 'MEDIUM', m.status || 'PENDING', m.requester_name || 'Operador', m.assigned_to || null, m.photo_url || null, m.estimated_hours || 1, m.created_at || null);
            count++;
          }
        }
        summary.maintenance_requests = count;
      }

      db.exec('COMMIT;');
    } catch (innerErr) {
      db.exec('ROLLBACK;');
      throw innerErr;
    }

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'admin',
      'RESTORE_BACKUP',
      'DATABASE',
      null,
      `Restauración de base de datos completada: ${JSON.stringify(summary)}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: 'Copia de seguridad restaurada exitosamente',
      summary
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error al restaurar respaldo: ' + error.message });
  }
}

export function updateUserRoleShift(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id || '');
    const { role, shift } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de usuario requerido' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const newRole = role && ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(role) ? String(role) : user.role;
    const validShifts = ['G1', 'G2', 'G3', 'G4', 'GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C'];
    const newShift = shift && validShifts.includes(shift) ? String(shift) : (shift ? String(shift) : user.shift);

    db.prepare('UPDATE users SET role = ?, shift = ? WHERE id = ?').run(newRole, newShift, id);

    // Sync with crew_members if exists
    try {
      let crewRole = 'OPERADOR_BOMBAS';
      if (newRole === 'SUPERVISOR') crewRole = 'SUPERVISOR';
      db.prepare(`
        UPDATE crew_members 
        SET shift_code = ?, primary_role = CASE WHEN primary_role = 'SUPERVISOR' OR ? = 'SUPERVISOR' THEN ? ELSE primary_role END
        WHERE LOWER(name) = LOWER(?)
      `).run(newShift, newRole, crewRole, String(user.full_name || ''));
    } catch (e) {
      console.warn('[Admin] Sync with crew_members notice:', e);
    }

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'admin',
      'UPDATE_USER_ROLE_SHIFT',
      'USERS',
      id,
      `Usuario ${user.username}: Rol cambiado a ${newRole}, Guardia cambiada a ${newShift}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: newRole,
        shift: newShift,
        isActive: user.is_active !== undefined ? user.is_active : 1
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function resetUserPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id || '');
    let { newPassword } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de usuario requerido' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // If newPassword is not provided, try to use crew document_id or default to Password123!
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length === 0) {
      const crew = db.prepare('SELECT document_id FROM crew_members WHERE LOWER(name) = LOWER(?)').get(String(user.full_name || '')) as any;
      if (crew && crew.document_id) {
        newPassword = String(crew.document_id);
      } else {
        newPassword = 'Password123!';
      }
    } else {
      newPassword = String(newPassword).trim();
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'admin',
      'RESET_PASSWORD',
      'USERS',
      id,
      `Contraseña restablecida para el usuario ${user.username}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Contraseña restablecida exitosamente para ${user.username}`,
      defaultAssigned: newPassword
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function toggleUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id || '');
    const { isActive } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (user.username === 'KlismanV' || (req.user && req.user.userId === id)) {
      return res.status(403).json({ success: false, message: 'No es posible suspender la cuenta del Administrador principal o la sesión activa.' });
    }

    const newStatus = typeof isActive === 'boolean' ? (isActive ? 1 : 0) : (user.is_active === 0 ? 1 : 0);
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, id);

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'admin',
      'TOGGLE_USER_STATUS',
      'USERS',
      id,
      `Estado de usuario ${user.username} cambiado a ${newStatus === 1 ? 'ACTIVO' : 'SUSPENDIDO'}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Usuario ${user.username} ${newStatus === 1 ? 'activado' : 'suspendido'} exitosamente`,
      isActive: newStatus === 1
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getConnectedDevices(req: AuthenticatedRequest, res: Response) {
  try {
    const devices = db.prepare(`
      SELECT 
        device_id,
        device_name,
        user_id,
        username,
        ip_address,
        user_agent,
        last_seen,
        is_revoked,
        CASE 
          WHEN last_seen >= datetime('now', '-3 minutes') THEN 1 
          ELSE 0 
        END as is_online
      FROM connected_devices
      ORDER BY last_seen DESC
      LIMIT 50
    `).all();

    return res.json({
      success: true,
      count: devices.length,
      devices,
      data: devices
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function revokeDeviceSession(req: AuthenticatedRequest, res: Response) {
  try {
    const deviceId = String(req.params.deviceId || '');

    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'ID de dispositivo requerido' });
    }

    db.prepare('UPDATE connected_devices SET is_revoked = 1 WHERE device_id = ?').run(deviceId);

    // Insert sync event so remote device terminates session
    db.prepare(`
      INSERT INTO sync_events (device_id, user_id, entity, action, payload, timestamp)
      VALUES (?, ?, 'AUTH', 'FORCE_LOGOUT', ?, ?)
    `).run(
      deviceId,
      req.user?.userId ? String(req.user.userId) : null,
      JSON.stringify({ deviceId, reason: 'Sesión revocada por el Administrador de Planta' }),
      Date.now()
    );

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'admin',
      'REVOKE_DEVICE_SESSION',
      'SECURITY',
      deviceId,
      `Sesión revocada remotamente para el dispositivo ${deviceId}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: 'Sesión de terminal revocada remotamente'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
