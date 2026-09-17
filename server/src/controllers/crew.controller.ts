import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getCrewMembers(req: Request, res: Response) {
  try {
    const shift = req.query.shift as string;
    const status = req.query.status as string;

    let query = 'SELECT * FROM crew_members WHERE 1=1';
    const params: any[] = [];

    if (shift) {
      query += ' AND shift_code = ?';
      params.push(shift);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY name ASC';

    const members = db.prepare(query).all(...params);
    return res.json({ success: true, count: members.length, data: members });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createCrewMember(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url } = req.body;

    if (!name || !document_id || !primary_role || !shift_code) {
      return res.status(400).json({ success: false, message: 'Nombre, documento, rol y guardia son requeridos.' });
    }

    const id = crypto.randomUUID();
    const defaultAvatar = avatar_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80`;

    db.prepare(`
      INSERT INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      document_id.trim(),
      primary_role,
      shift_code,
      radio_channel || 'Canal 1 Operaciones',
      phone_extension || null,
      status || 'EN_TURNO',
      defaultAvatar
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'CREW_MEMBER', id, `Alta operador ${name} (${primary_role})`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Operador registrado con éxito en la cuadrilla', id });
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, message: 'Ya existe un operador con ese Documento de Identidad / DNI' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function updateCrewMember(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url } = req.body;

    const existing = db.prepare('SELECT * FROM crew_members WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Operador no encontrado' });
    }

    db.prepare(`
      UPDATE crew_members
      SET name = COALESCE(?, name),
          document_id = COALESCE(?, document_id),
          primary_role = COALESCE(?, primary_role),
          shift_code = COALESCE(?, shift_code),
          radio_channel = COALESCE(?, radio_channel),
          phone_extension = COALESCE(?, phone_extension),
          status = COALESCE(?, status),
          avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `).run(
      name ? (name as string).trim() : null,
      document_id ? (document_id as string).trim() : null,
      primary_role || null,
      shift_code || null,
      radio_channel || null,
      phone_extension || null,
      status || null,
      avatar_url || null,
      id
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'UPDATE', 'CREW_MEMBER', id, `Actualización de datos operador ID ${id}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Datos de operador actualizados exitosamente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function deleteCrewMember(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = db.prepare('SELECT * FROM crew_members WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Operador no encontrado' });
    }

    db.prepare('DELETE FROM crew_members WHERE id = ?').run(id);

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'DELETE', 'CREW_MEMBER', id, `Baja de operador ID ${id}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Operador dado de baja correctamente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getAreaAssignments(req: Request, res: Response) {
  try {
    const shiftDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const shiftCode = (req.query.shift_code as string) || 'GUARDIA_A';
    const shiftType = (req.query.shift_type as string) || 'DIA';

    const query = `
      SELECT
        a.*,
        m.name as operator_name,
        m.avatar_url as operator_avatar,
        m.primary_role as operator_role,
        m.radio_channel as operator_default_radio,
        m.phone_extension as operator_phone,
        m.status as operator_status,
        b.name as backup_name,
        b.avatar_url as backup_avatar
      FROM crew_area_assignments a
      LEFT JOIN crew_members m ON a.operator_id = m.id
      LEFT JOIN crew_members b ON a.backup_operator_id = b.id
      WHERE a.shift_date = ? AND a.shift_code = ? AND a.shift_type = ?
      ORDER BY
        CASE a.position_key
          WHEN 'BOMBAS' THEN 1
          WHEN 'CICLONES' THEN 2
          WHEN 'DESCARGA' THEN 3
          WHEN 'MISCELANEOS' THEN 4
          WHEN 'RELEVO' THEN 5
          ELSE 6
        END ASC
    `;

    const assignments = db.prepare(query).all(shiftDate, shiftCode, shiftType);

    return res.json({
      success: true,
      shiftDate,
      shiftCode,
      shiftType,
      count: assignments.length,
      data: assignments
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function saveAreaAssignment(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      shift_code, shift_date, shift_type, position_key, position_title,
      operator_id, backup_operator_id, epp_verified, safety_talk_completed,
      radio_channel, station_location, notes
    } = req.body;

    if (!shift_code || !shift_date || !position_key || !operator_id) {
      return res.status(400).json({ success: false, message: 'Guardia, fecha, posición y operador titular son requeridos.' });
    }

    const shiftTypeVal = shift_type || 'DIA';

    // Check if assignment exists
    const existing = db.prepare(`
      SELECT id FROM crew_area_assignments
      WHERE shift_date = ? AND shift_code = ? AND shift_type = ? AND position_key = ?
    `).get(shift_date, shift_code, shiftTypeVal, position_key) as { id: string } | undefined;

    let assignmentId: string;

    if (existing) {
      assignmentId = existing.id;
      db.prepare(`
        UPDATE crew_area_assignments
        SET operator_id = ?,
            backup_operator_id = ?,
            epp_verified = ?,
            safety_talk_completed = ?,
            radio_channel = ?,
            station_location = ?,
            notes = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        operator_id,
        backup_operator_id || null,
        epp_verified !== undefined ? (epp_verified ? 1 : 0) : 1,
        safety_talk_completed !== undefined ? (safety_talk_completed ? 1 : 0) : 1,
        radio_channel || null,
        station_location || null,
        notes || null,
        assignmentId
      );
    } else {
      assignmentId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO crew_area_assignments (
          id, shift_code, shift_date, shift_type, position_key, position_title,
          operator_id, backup_operator_id, epp_verified, safety_talk_completed,
          radio_channel, station_location, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        assignmentId,
        shift_code,
        shift_date,
        shiftTypeVal,
        position_key,
        position_title || position_key,
        operator_id,
        backup_operator_id || null,
        epp_verified !== undefined ? (epp_verified ? 1 : 0) : 1,
        safety_talk_completed !== undefined ? (safety_talk_completed ? 1 : 0) : 1,
        radio_channel || null,
        station_location || null,
        notes || null
      );
    }

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'ASSIGN', 'CREW_ASSIGNMENT', assignmentId, `Asignación ${position_key} a operador ${operator_id}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Asignación guardada exitosamente', id: assignmentId });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function checkinAreaAssignment(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { epp_verified, safety_talk_completed } = req.body;

    const existing = db.prepare('SELECT id FROM crew_area_assignments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Asignación no encontrada' });
    }

    const eppVal = epp_verified !== undefined ? (epp_verified ? 1 : 0) : null;
    const safetyVal = safety_talk_completed !== undefined ? (safety_talk_completed ? 1 : 0) : null;

    db.prepare(`
      UPDATE crew_area_assignments
      SET epp_verified = COALESCE(?, epp_verified),
          safety_talk_completed = COALESCE(?, safety_talk_completed),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(eppVal, safetyVal, id);

    return res.json({ success: true, message: 'Check-in actualizado correctamente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getCrewPositions(req: Request, res: Response) {
  try {
    const positions = db.prepare('SELECT * FROM crew_positions ORDER BY created_at ASC').all();
    return res.json({ success: true, count: positions.length, data: positions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createCrewPosition(req: AuthenticatedRequest, res: Response) {
  try {
    const { key, title, default_location, default_radio, badge_class, icon_svg, description } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'El título de la posición es requerido' });
    }
    const safeKey = (key || ('POS_' + title.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() + '_' + Date.now().toString(36))).slice(0, 35);
    
    db.prepare(`
      INSERT OR REPLACE INTO crew_positions (key, title, default_location, default_radio, badge_class, icon_svg, description, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      safeKey,
      title.trim(),
      default_location || 'Planta Concentradora',
      default_radio || 'Canal 1 Operaciones',
      badge_class || 'card-custom',
      icon_svg || '⚙️',
      description || 'Posición operativa de planta'
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'CREW_POSITION', safeKey, `Creación de posición ${title}`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Posición creada exitosamente', key: safeKey });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function deleteCrewPosition(req: AuthenticatedRequest, res: Response) {
  try {
    const key = req.params.key as string;
    db.prepare('DELETE FROM crew_positions WHERE key = ?').run(key);
    db.prepare('DELETE FROM crew_area_assignments WHERE position_key = ?').run(key);
    logAudit(req.user?.userId || null, req.user?.username || 'system', 'DELETE', 'CREW_POSITION', key, `Baja de posición ${key}`, req.ip || '127.0.0.1');
    return res.json({ success: true, message: 'Posición eliminada correctamente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

