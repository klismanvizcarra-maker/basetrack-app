import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getAllShiftHandovers(req: Request, res: Response) {
  try {
    const shifts = db.prepare('SELECT * FROM shift_handovers ORDER BY created_at DESC').all();
    return res.json({ success: true, count: shifts.length, data: shifts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createShiftHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      shift_code, date, shift_type, outgoing_supervisor, incoming_supervisor,
      plant_status, tonnage_processed, safety_incidents, operational_highlights, pending_tasks, status
    } = req.body;

    if (!shift_code || !shift_type || !plant_status) {
      return res.status(400).json({ success: false, message: 'Código de turno, tipo de turno y estado de planta son requeridos' });
    }

    const id = crypto.randomUUID();
    const outSup = outgoing_supervisor || req.user?.fullName || 'Supervisor Saliente';
    const inSup = incoming_supervisor || 'Supervisor Entrante';
    const handoverDate = date || new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO shift_handovers (
        id, shift_code, date, shift_type, outgoing_supervisor, incoming_supervisor,
        plant_status, tonnage_processed, safety_incidents, operational_highlights,
        pending_tasks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, shift_code, handoverDate, shift_type, outSup, inSup,
      plant_status, tonnage_processed || 0, safety_incidents || null,
      operational_highlights || null, pending_tasks || null, status || 'SUBMITTED'
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'SHIFT_HANDOVER', id, `Relevo de guardia creado: ${shift_code}`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Bitácora de relevo registrada exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function acceptShiftHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const handover = db.prepare('SELECT id, shift_code FROM shift_handovers WHERE id = ?').get(id) as any;

    if (!handover) {
      return res.status(404).json({ success: false, message: 'Bitácora no encontrada' });
    }

    db.prepare(`
      UPDATE shift_handovers
      SET status = 'ACCEPTED', incoming_supervisor = COALESCE(?, incoming_supervisor)
      WHERE id = ?
    `).run(req.user?.fullName || null, id);

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'ACCEPT', 'SHIFT_HANDOVER', id, `Relevo de guardia aceptado`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Relevo de guardia aceptado y firmado formalmente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
