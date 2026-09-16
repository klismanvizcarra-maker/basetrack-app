import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

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
    const count = (db.prepare('SELECT COUNT(*) as count FROM maintenance_requests').get() as { count: number }).count + 1;
    const ticketNumber = `OT-${currentYear}-${String(count).padStart(4, '0')}`;
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

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'MAINTENANCE_REQUEST', id, `Orden de trabajo ${ticketNumber}`, req.ip || '127.0.0.1');

    return res.status(201).json({
      success: true,
      message: 'Solicitud de mantenimiento registrada exitosamente',
      ticketNumber,
      id
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function updateMaintenanceStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const { status, assigned_to } = req.body;

    const request = db.prepare('SELECT id, ticket_number FROM maintenance_requests WHERE id = ?').get(id) as any;
    if (!request) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    db.prepare(`
      UPDATE maintenance_requests
      SET status = COALESCE(?, status),
          assigned_to = COALESCE(?, assigned_to)
      WHERE id = ?
    `).run(status || null, assigned_to || null, id);

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'UPDATE', 'MAINTENANCE_REQUEST', id, `Estado de OT cambiado a ${status}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Estado de solicitud actualizado' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
