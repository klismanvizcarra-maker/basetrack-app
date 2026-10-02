import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getAllShiftHandovers(req: Request, res: Response) {
  try {
    const shifts = db.prepare('SELECT * FROM shift_handovers ORDER BY created_at DESC').all() as any[];
    const parsedShifts = shifts.map(s => {
      let crew = s.assigned_crew;
      if (typeof crew === 'string' && (crew.startsWith('[') || crew.startsWith('{'))) {
        try { crew = JSON.parse(crew); } catch {}
      }
      let checklist = s.checklist_data;
      if (typeof checklist === 'string' && (checklist.startsWith('[') || checklist.startsWith('{'))) {
        try { checklist = JSON.parse(checklist); } catch {}
      }
      return {
        ...s,
        assigned_crew: crew || null,
        checklist_data: checklist || null
      };
    });
    return res.json({ success: true, count: parsedShifts.length, data: parsedShifts });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createShiftHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      shift_code, date, shift_type, outgoing_supervisor, outgoing_dni, outgoing_role,
      incoming_supervisor, incoming_dni, incoming_role,
      plant_status, tonnage_processed, safety_incidents, operational_highlights, pending_tasks, status,
      assigned_crew, checklist_data
    } = req.body;

    const finalPlantStatus = (plant_status && String(plant_status).trim()) ? String(plant_status).trim() : 'Operación de planta en condiciones normales de proceso.';

    if (!shift_code || !shift_type) {
      return res.status(400).json({ success: false, message: 'Código de turno y tipo de turno son requeridos' });
    }

    const id = crypto.randomUUID();
    const outSup = outgoing_supervisor || req.user?.fullName || 'Supervisor Saliente';
    const outDni = outgoing_dni || (req.user as any)?.document_id || null;
    const outRole = outgoing_role || 'Supervisor de guardia';

    const inSup = incoming_supervisor || 'Supervisor Entrante';
    const inDni = incoming_dni || null;
    const inRole = incoming_role || 'Supervisor de guardia';

    const handoverDate = date || new Date().toISOString().split('T')[0];
    const crewJson = assigned_crew ? (typeof assigned_crew === 'string' ? assigned_crew : JSON.stringify(assigned_crew)) : null;
    const checklistJson = checklist_data ? (typeof checklist_data === 'string' ? checklist_data : JSON.stringify(checklist_data)) : null;

    db.prepare(`
      INSERT INTO shift_handovers (
        id, shift_code, date, shift_type, outgoing_supervisor, outgoing_dni, outgoing_role,
        incoming_supervisor, incoming_dni, incoming_role,
        plant_status, tonnage_processed, safety_incidents, operational_highlights,
        pending_tasks, status, assigned_crew, checklist_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, shift_code, handoverDate, shift_type, outSup, outDni, outRole,
      inSup, inDni, inRole,
      finalPlantStatus, tonnage_processed || 0, safety_incidents || null,
      operational_highlights || null, pending_tasks || null, status || 'SUBMITTED',
      crewJson, checklistJson
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'SHIFT_HANDOVER', id, `Relevo de guardia creado: ${shift_code} (${outSup} -> ${inSup})`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Bitácora de relevo registrada exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function acceptShiftHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const { incoming_supervisor, incoming_dni, incoming_role } = req.body || {};
    const handover = db.prepare('SELECT id, shift_code FROM shift_handovers WHERE id = ?').get(id) as any;

    if (!handover) {
      return res.status(404).json({ success: false, message: 'Bitácora no encontrada' });
    }

    const inSup = incoming_supervisor || req.user?.fullName || null;
    const inDni = incoming_dni || (req.user as any)?.document_id || null;
    const inRole = incoming_role || 'Supervisor de guardia';

    db.prepare(`
      UPDATE shift_handovers
      SET status = 'ACCEPTED',
          incoming_supervisor = COALESCE(?, incoming_supervisor),
          incoming_dni = COALESCE(?, incoming_dni),
          incoming_role = COALESCE(?, incoming_role)
      WHERE id = ?
    `).run(inSup, inDni, inRole, id);

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'ACCEPT', 'SHIFT_HANDOVER', id, `Relevo de guardia aceptado por ${inSup || 'Supervisor'}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Relevo de guardia aceptado y registrado con DNI y puesto' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
