import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getAllPumps(req: Request, res: Response) {
  try {
    const pumps = db.prepare('SELECT * FROM pump_reports ORDER BY tag ASC').all();
    return res.json({ success: true, count: pumps.length, data: pumps });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getPumpById(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const pump = db.prepare('SELECT * FROM pump_reports WHERE id = ? OR tag = ?').get(id, id);
    if (!pump) {
      return res.status(404).json({ success: false, message: 'Bomba no encontrada' });
    }
    return res.json({ success: true, data: pump });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createPumpReport(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      tag, name, system, status, flow_rate_m3h, pressure_bar, rpm,
      bearing_temp_c, vibration_mms, current_amps, notes
    } = req.body;

    if (!tag || !name || !system || !status) {
      return res.status(400).json({ success: false, message: 'Tag, nombre, sistema y estado son requeridos' });
    }

    const id = crypto.randomUUID();
    const operatorName = req.user?.fullName || req.body.operator_name || 'Operador Central';
    const shiftCode = req.user?.shift || req.body.shift_code || 'GUARDIA_A';

    db.prepare(`
      INSERT INTO pump_reports (
        id, tag, name, system, status, flow_rate_m3h, pressure_bar,
        rpm, bearing_temp_c, vibration_mms, current_amps, shift_code, operator_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tag, name, system, status, flow_rate_m3h || 0, pressure_bar || 0,
      rpm || 0, bearing_temp_c || 0, vibration_mms || 0, current_amps || 0,
      shiftCode, operatorName, notes || null
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'PUMP_REPORT', id, `Registro para bomba ${tag}`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Reporte de bomba registrado exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function updatePumpStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const { status, notes, flow_rate_m3h, pressure_bar } = req.body;

    const pump = db.prepare('SELECT id, tag FROM pump_reports WHERE id = ?').get(id) as any;
    if (!pump) {
      return res.status(404).json({ success: false, message: 'Bomba no encontrada' });
    }

    db.prepare(`
      UPDATE pump_reports 
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          flow_rate_m3h = COALESCE(?, flow_rate_m3h),
          pressure_bar = COALESCE(?, pressure_bar)
      WHERE id = ?
    `).run(status || null, notes || null, flow_rate_m3h ?? null, pressure_bar ?? null, id);

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'UPDATE', 'PUMP_REPORT', id, `Actualización de estado a ${status}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Estado de bomba actualizado exitosamente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
