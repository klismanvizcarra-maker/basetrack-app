import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';
import { siteToday } from '../utils/site-date.js';
import { isSystemAdminIdentity } from '../utils/system-admin.js';
import { pushService } from '../services/push.service.js';

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
      let maint = s.maintenance_orders;
      if (typeof maint === 'string' && (maint.startsWith('[') || maint.startsWith('{'))) {
        try { maint = JSON.parse(maint); } catch {}
      }
      let events = s.timeline_events;
      if (typeof events === 'string' && (events.startsWith('[') || events.startsWith('{'))) {
        try { events = JSON.parse(events); } catch {}
      }
      return {
        ...s,
        assigned_crew: crew || null,
        checklist_data: checklist || null,
        maintenance_orders: maint || null,
        timeline_events: events || null
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
      assigned_crew, checklist_data, maintenance_orders, timeline_events
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

    // El administrador de sistema nunca figura como supervisor de guardia (CLAUDE.md §3.1)
    if (isSystemAdminIdentity(outSup) || isSystemAdminIdentity(inSup)) {
      return res.status(400).json({ success: false, message: 'El Administrador de sistema no puede figurar como supervisor saliente ni entrante' });
    }

    // Gotcha #4: Peru timezone UTC-5 fallback so 19:00 night shift does not flip to tomorrow
    const handoverDate = date || siteToday();
    const crewJson = assigned_crew ? (typeof assigned_crew === 'string' ? assigned_crew : JSON.stringify(assigned_crew)) : null;
    const checklistJson = checklist_data ? (typeof checklist_data === 'string' ? checklist_data : JSON.stringify(checklist_data)) : null;
    const maintJson = maintenance_orders ? (typeof maintenance_orders === 'string' ? maintenance_orders : JSON.stringify(maintenance_orders)) : null;
    const eventsJson = timeline_events ? (typeof timeline_events === 'string' ? timeline_events : JSON.stringify(timeline_events)) : null;

    db.prepare(`
      INSERT INTO shift_handovers (
        id, shift_code, date, shift_type, outgoing_supervisor, outgoing_dni, outgoing_role,
        incoming_supervisor, incoming_dni, incoming_role,
        plant_status, tonnage_processed, safety_incidents, operational_highlights,
        pending_tasks, status, assigned_crew, checklist_data, maintenance_orders, timeline_events
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, shift_code, handoverDate, shift_type, outSup, outDni, outRole,
      inSup, inDni, inRole,
      finalPlantStatus, tonnage_processed || 0, safety_incidents || null,
      operational_highlights || null, pending_tasks || null, status || 'SUBMITTED',
      crewJson, checklistJson, maintJson, eventsJson
    );

    // Broadcast WebSocket event to all other terminals
    broadcastWsEvent({
      entity: 'shift_handover',
      action: 'CREATE',
      data: {
        id,
        shift_code,
        date: handoverDate,
        shift_type,
        outgoing_supervisor: outSup,
        incoming_supervisor: inSup,
        plant_status: finalPlantStatus,
        tonnage_processed: tonnage_processed || 0,
        status: status || 'SUBMITTED',
        maintenance_orders: maintJson ? JSON.parse(maintJson) : null,
        timeline_events: eventsJson ? JSON.parse(eventsJson) : null
      },
      key: 'basetrack_shift_handovers',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: outSup
    });

    pushService.sendPushNotification({
      title: '📋 Relevo de Guardia Emitido',
      body: `Turno ${shift_type} (${shift_code}) entregado por ${outSup}. Pendiente de recepción por ${inSup}.`,
      data: { url: '/shift-handover', id },
      tag: `handover-${id}`
    }).catch(err => console.error('[Push] Error delivering shift handover push:', err));

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
    const handover = db.prepare('SELECT id, shift_code, status FROM shift_handovers WHERE id = ?').get(id) as any;

    if (!handover) {
      return res.status(404).json({ success: false, message: 'Bitácora no encontrada' });
    }
    if (handover.status === 'ACCEPTED') {
      return res.status(409).json({ success: false, message: 'El relevo ya fue aceptado' });
    }

    // El administrador de sistema nunca figura como supervisor de guardia (CLAUDE.md §3.1)
    if (!incoming_supervisor && req.user?.role === 'ADMIN') {
      return res.status(400).json({ success: false, message: 'Debe indicar el supervisor entrante que recibe la guardia' });
    }

    // El JWT no incluye el DNI: se toma del registro del usuario
    const userRow = req.user?.userId
      ? db.prepare('SELECT document_id FROM users WHERE id = ?').get(req.user.userId) as { document_id?: string } | undefined
      : undefined;
    const inSup = incoming_supervisor || req.user?.fullName || null;
    if (isSystemAdminIdentity(inSup)) {
      return res.status(400).json({ success: false, message: 'El Administrador de sistema no puede figurar como supervisor entrante' });
    }
    const inDni = incoming_dni || (incoming_supervisor ? null : userRow?.document_id) || null;
    const inRole = incoming_role || 'Supervisor de guardia';

    db.prepare(`
      UPDATE shift_handovers
      SET status = 'ACCEPTED',
          incoming_supervisor = COALESCE(?, incoming_supervisor),
          incoming_dni = COALESCE(?, incoming_dni),
          incoming_role = COALESCE(?, incoming_role)
      WHERE id = ?
    `).run(inSup, inDni, inRole, id);

    // Broadcast acceptance over WebSocket
    broadcastWsEvent({
      entity: 'shift_handover',
      action: 'ACCEPT',
      data: { id, status: 'ACCEPTED', incoming_supervisor: inSup },
      key: 'basetrack_shift_handovers',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: inSup || 'Supervisor Entrante'
    });

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'ACCEPT', 'SHIFT_HANDOVER', id, `Relevo de guardia aceptado por ${inSup || 'Supervisor'}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Relevo de guardia aceptado y registrado con DNI y puesto' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
