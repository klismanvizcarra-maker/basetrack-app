import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';
import { pushService } from '../services/push.service.js';

/** Correlativo de OT del año en curso (OT-AAAA-NNNN), compartido por mantenimiento y bombas. */
export function nextTicketNumber(): string {
  const currentYear = new Date().getFullYear();
  let nextNum = ((db.prepare('SELECT COUNT(*) as count FROM maintenance_requests').get() as { count: number }).count || 0) + 1;
  let ticketNumber = `OT-${currentYear}-${String(nextNum).padStart(4, '0')}`;
  while (db.prepare('SELECT id FROM maintenance_requests WHERE ticket_number = ?').get(ticketNumber)) {
    nextNum++;
    ticketNumber = `OT-${currentYear}-${String(nextNum).padStart(4, '0')}`;
  }
  return ticketNumber;
}

export function getAllMaintenanceRequests(req: Request, res: Response) {
  try {
    const requests = db.prepare('SELECT * FROM maintenance_requests ORDER BY created_at DESC').all();
    return res.json({ success: true, count: requests.length, data: requests });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createMaintenanceRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      equipment_tag, title, description, priority, assigned_to, photo_url, estimated_hours
    } = req.body;

    if (!equipment_tag || !title || !description || !priority) {
      return res.status(400).json({ success: false, message: 'Tag de equipo, título, descripción y prioridad son obligatorios' });
    }

    const id = crypto.randomUUID();
    const ticketNumber = nextTicketNumber();
    const requesterName = req.user?.fullName || req.body.requester_name || 'Operador de Guardia';

    const tag = String(equipment_tag).trim().toUpperCase();
    // Origen de la OT: las generadas por la planilla de bombas se identifican como tales
    const sourceModule = req.body.source_module === 'PUMPS_STATION' ? 'PUMPS_STATION' : 'MANUAL';
    const photo = photo_url && typeof photo_url === 'string' && !photo_url.includes('unsplash.com/photo-1581092335397')
      ? photo_url.trim()
      : '';

    db.prepare(`
      INSERT INTO maintenance_requests (
        id, ticket_number, equipment_tag, title, description,
        priority, status, requester_name, assigned_to, photo_url, estimated_hours, source_module
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ticketNumber, tag, title, description,
      priority, 'PENDING', requesterName, assigned_to || 'Equipo Mecánico de Turno',
      photo, estimated_hours || 2.0, sourceModule
    );

    // Broadcast WebSocket real-time update
    broadcastWsEvent({
      entity: 'maintenance',
      action: 'CREATE',
      data: {
        id,
        ticket_number: ticketNumber,
        equipment_tag: tag,
        title,
        priority,
        status: 'PENDING',
        requester_name: requesterName,
        assigned_to: assigned_to || 'Equipo Mecánico de Turno',
        photo_url: photo,
        estimated_hours: estimated_hours || 2.0,
        source_module: sourceModule
      },
      key: 'maintenance_request_' + id,
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: requesterName
    });

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'MAINTENANCE_REQUEST', id, `Orden de trabajo ${ticketNumber}`, req.ip || '127.0.0.1');

    return res.status(201).json({
      success: true,
      message: 'Solicitud de mantenimiento registrada exitosamente',
      ticketNumber,
      id
    });
  } catch (error: any) {
    console.error('[MaintenanceController] Error creating request:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function updateMaintenanceStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const { status, assigned_to, resolution_notes, operational_pass_by, photo_url } = req.body;

    const request = db.prepare('SELECT id, ticket_number, equipment_tag, status as prev_status FROM maintenance_requests WHERE id = ?').get(id) as any;
    if (!request) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    const isPassingToOperational = status === 'RESOLVED' || status === 'CLOSED';
    // El Pase Operativo libera la bomba bloqueada: solo lo emite mantenimiento o supervisión (CLAUDE.md §3.4)
    if (isPassingToOperational && !['ADMIN', 'SUPERVISOR', 'MAINTENANCE'].includes(String(req.user?.role))) {
      return res.status(403).json({ success: false, message: 'Solo Mantenimiento o Supervisión pueden emitir el Pase Operativo' });
    }
    const passBy = isPassingToOperational 
      ? (operational_pass_by || req.user?.fullName || req.user?.username || 'Supervisor Mantenimiento')
      : null;
    const passAt = isPassingToOperational ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE maintenance_requests
      SET status = COALESCE(?, status),
          assigned_to = COALESCE(?, assigned_to),
          resolution_notes = COALESCE(?, resolution_notes),
          operational_pass_by = COALESCE(?, operational_pass_by),
          operational_pass_at = COALESCE(?, operational_pass_at),
          photo_url = COALESCE(?, photo_url)
      WHERE id = ?
    `).run(
      status || null,
      assigned_to || null,
      resolution_notes || null,
      passBy,
      passAt,
      photo_url || null,
      id
    );

    // Synchronize pump status in active pump sheets and telemetry
    const targetTag = request.equipment_tag;
    let targetPumpStatus: 'Mantenimiento' | 'Operativo' | null = null;
    let telemetryPumpStatus: 'MAINTENANCE' | 'OPERATING' | null = null;

    if (status === 'IN_PROGRESS') {
      targetPumpStatus = 'Mantenimiento';
      telemetryPumpStatus = 'MAINTENANCE';
    } else if (isPassingToOperational) {
      targetPumpStatus = 'Operativo';
      telemetryPumpStatus = 'OPERATING';
    }

    if (targetPumpStatus && targetTag) {
      // 1. Update latest pump sheets in SQLite
      const sheets = db.prepare('SELECT id, report_date, sentina_pumps_json, intermedia_pumps_json, torre5_pumps_json FROM pump_station_sheets ORDER BY report_date DESC, created_at DESC LIMIT 5').all() as any[];
      for (const sheet of sheets) {
        let changed = false;
        const updateList = (jsonStr: string) => {
          try {
            const list = JSON.parse(jsonStr);
            if (Array.isArray(list)) {
              for (const p of list) {
                if (p && p.tag?.trim()?.toUpperCase() === targetTag?.trim()?.toUpperCase()) {
                  p.status = targetPumpStatus;
                  changed = true;
                }
              }
            }
            return JSON.stringify(list);
          } catch {
            return jsonStr;
          }
        };

        const newSentina = updateList(sheet.sentina_pumps_json);
        const newIntermedia = updateList(sheet.intermedia_pumps_json);
        const newTorre5 = updateList(sheet.torre5_pumps_json);

        if (changed) {
          db.prepare(`
            UPDATE pump_station_sheets 
            SET sentina_pumps_json = ?, intermedia_pumps_json = ?, torre5_pumps_json = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newSentina, newIntermedia, newTorre5, sheet.id);

          // Broadcast pump sheet update so pumps screen updates in real time
          broadcastWsEvent({
            entity: 'PUMP_STATION_SHEET',
            action: 'UPDATE',
            key: 'pump_sheet_' + sheet.report_date,
            data: {
              id: sheet.id,
              report_date: sheet.report_date,
              sentina_pumps: JSON.parse(newSentina),
              intermedia_pumps: JSON.parse(newIntermedia),
              torre5_pumps: JSON.parse(newTorre5)
            }
          });
        }
      }

      // 2. Update telemetry table if present
      if (telemetryPumpStatus) {
        db.prepare('UPDATE pump_reports SET status = ? WHERE UPPER(tag) = UPPER(?)').run(telemetryPumpStatus, targetTag);
      }
    }

    // Broadcast WebSocket real-time update for maintenance
    broadcastWsEvent({
      entity: 'maintenance',
      action: 'UPDATE',
      data: {
        id,
        ticket_number: request.ticket_number,
        equipment_tag: request.equipment_tag,
        status,
        assigned_to,
        resolution_notes,
        operational_pass_by: passBy,
        operational_pass_at: passAt
      },
      key: 'basetrack_maintenance_tickets',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api'
    });

    if (isPassingToOperational) {
      pushService.sendPushNotification({
        title: `🛠️ Pase Operativo Concedido (${request.equipment_tag})`,
        body: `OT ${request.ticket_number} resuelta. Equipo ${request.equipment_tag} liberado a Operativo por ${passBy}.`,
        data: { url: '/maintenance', tag: request.equipment_tag },
        tag: `maint-pass-${id}`
      }).catch(err => console.error('[Push] Error delivering maintenance pass push:', err));
    }

    const isPump = targetTag && targetTag.toUpperCase().startsWith('PU');
    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      'UPDATE',
      'MAINTENANCE_REQUEST',
      id,
      isPassingToOperational 
        ? `Pase operativo emitido por ${passBy} para ${request.equipment_tag}. ${isPump ? 'Bomba retornada a Operativo.' : 'Equipo liberado conforme.'}`
        : `Estado de OT cambiado a ${status}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: isPassingToOperational
        ? (isPump ? `Pase operativo otorgado exitosamente. Bomba ${targetTag} ahora está Operativa.` : `Pase operativo otorgado exitosamente para equipo ${targetTag}.`)
        : 'Estado de solicitud actualizado exitosamente',
      data: {
        id,
        status,
        equipment_tag: targetTag,
        targetPumpStatus,
        operational_pass_by: passBy,
        operational_pass_at: passAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function deleteMaintenanceRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(id) as any;
    if (!request) {
      return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
    }

    // Delete ticket from database
    db.prepare('DELETE FROM maintenance_requests WHERE id = ?').run(id);

    // If deleting an active ticket on a pump, check if other active tickets remain
    const targetTag = (request.equipment_tag || '').trim().toUpperCase();
    const remainingActive = db.prepare(`
      SELECT COUNT(*) as count FROM maintenance_requests 
      WHERE UPPER(equipment_tag) = UPPER(?) AND status IN ('PENDING', 'IN_PROGRESS')
    `).get(targetTag) as { count: number };

    if (remainingActive.count === 0 && targetTag.startsWith('PU')) {
      const sheets = db.prepare('SELECT id, report_date, sentina_pumps_json, intermedia_pumps_json, torre5_pumps_json FROM pump_station_sheets ORDER BY report_date DESC, created_at DESC LIMIT 5').all() as any[];
      for (const sheet of sheets) {
        let changed = false;
        const updateList = (jsonStr: string) => {
          try {
            const list = JSON.parse(jsonStr);
            if (Array.isArray(list)) {
              for (const p of list) {
                if (p && p.tag?.trim()?.toUpperCase() === targetTag && (p.status === 'Falla' || p.status === 'Mantenimiento')) {
                  p.status = 'Operativo';
                  changed = true;
                }
              }
            }
            return JSON.stringify(list);
          } catch {
            return jsonStr;
          }
        };

        const newSentina = updateList(sheet.sentina_pumps_json);
        const newIntermedia = updateList(sheet.intermedia_pumps_json);
        const newTorre5 = updateList(sheet.torre5_pumps_json);

        if (changed) {
          db.prepare(`
            UPDATE pump_station_sheets 
            SET sentina_pumps_json = ?, intermedia_pumps_json = ?, torre5_pumps_json = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newSentina, newIntermedia, newTorre5, sheet.id);

          broadcastWsEvent({
            entity: 'PUMP_STATION_SHEET',
            action: 'UPDATE',
            key: 'pump_sheet_' + sheet.report_date,
            data: {
              id: sheet.id,
              report_date: sheet.report_date,
              sentina_pumps: JSON.parse(newSentina),
              intermedia_pumps: JSON.parse(newIntermedia),
              torre5_pumps: JSON.parse(newTorre5)
            }
          });
        }
      }
    }

    // Broadcast deletion in real time
    broadcastWsEvent({
      entity: 'maintenance',
      action: 'DELETE',
      data: {
        id,
        ticket_number: request.ticket_number,
        equipment_tag: targetTag
      },
      key: 'basetrack_maintenance_tickets',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api'
    });

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      'DELETE',
      'MAINTENANCE_REQUEST',
      id,
      `Eliminación de orden de trabajo ${request.ticket_number} (${targetTag})`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Orden de trabajo ${request.ticket_number} eliminada exitosamente`,
      id
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

