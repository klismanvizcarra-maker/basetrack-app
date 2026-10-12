import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';

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
    const currentYear = new Date().getFullYear();
    let nextNum = ((db.prepare('SELECT COUNT(*) as count FROM maintenance_requests').get() as { count: number }).count || 0) + 1;
    let ticketNumber = `OT-${currentYear}-${String(nextNum).padStart(4, '0')}`;
    while (db.prepare('SELECT id FROM maintenance_requests WHERE ticket_number = ?').get(ticketNumber)) {
      nextNum++;
      ticketNumber = `OT-${currentYear}-${String(nextNum).padStart(4, '0')}`;
    }
    const requesterName = req.user?.fullName || req.body.requester_name || 'Operador de Guardia';

    // Default sample photo if not provided
    const photo = photo_url || 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80';

    db.prepare(`
      INSERT INTO maintenance_requests (
        id, ticket_number, equipment_tag, title, description,
        priority, status, requester_name, assigned_to, photo_url, estimated_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ticketNumber, equipment_tag, title, description,
      priority, 'PENDING', requesterName, assigned_to || 'Equipo Mecánico de Turno',
      photo, estimated_hours || 2.0
    );

    // Broadcast WebSocket real-time update
    broadcastWsEvent({
      entity: 'maintenance',
      action: 'CREATE',
      data: {
        id,
        ticket_number: ticketNumber,
        equipment_tag,
        title,
        priority,
        status: 'PENDING',
        requester_name: requesterName,
        assigned_to: assigned_to || 'Equipo Mecánico de Turno'
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
    const { status, assigned_to, resolution_notes, operational_pass_by } = req.body;

    const request = db.prepare('SELECT id, ticket_number, equipment_tag, status as prev_status FROM maintenance_requests WHERE id = ?').get(id) as any;
    if (!request) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    const isPassingToOperational = status === 'RESOLVED' || status === 'CLOSED';
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
          operational_pass_at = COALESCE(?, operational_pass_at)
      WHERE id = ?
    `).run(
      status || null,
      assigned_to || null,
      resolution_notes || null,
      passBy,
      passAt,
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
                if (p && p.tag === targetTag) {
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
        db.prepare('UPDATE pump_reports SET status = ? WHERE tag = ?').run(telemetryPumpStatus, targetTag);
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

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      'UPDATE',
      'MAINTENANCE_REQUEST',
      id,
      isPassingToOperational 
        ? `Pase operativo emitido por ${passBy} para ${request.equipment_tag}. Bomba retornada a Operativo.`
        : `Estado de OT cambiado a ${status}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: isPassingToOperational
        ? `Pase operativo otorgado exitosamente. Bomba ${targetTag} ahora está Operativa.`
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

