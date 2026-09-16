import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getAllTailings(req: Request, res: Response) {
  try {
    const tailings = db.prepare('SELECT * FROM tailings_reports ORDER BY created_at DESC').all();
    return res.json({ success: true, count: tailings.length, data: tailings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createTailingsReport(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      station_tag, flow_rate_m3h, solids_percentage, dam_level_meters,
      freeboard_meters, piezometer_kpa, turbidity_ntu, pumping_line_status, notes
    } = req.body;

    if (!station_tag || !pumping_line_status) {
      return res.status(400).json({ success: false, message: 'Estación de descarga y estado de línea son requeridos' });
    }

    const id = crypto.randomUUID();
    const operatorName = req.user?.fullName || req.body.operator_name || 'Operador de Presa';
    const shiftCode = req.user?.shift || req.body.shift_code || 'GUARDIA_A';

    db.prepare(`
      INSERT INTO tailings_reports (
        id, station_tag, flow_rate_m3h, solids_percentage, dam_level_meters,
        freeboard_meters, piezometer_kpa, turbidity_ntu, pumping_line_status,
        operator_name, shift_code, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, station_tag, flow_rate_m3h || 0, solids_percentage || 0, dam_level_meters || 0,
      freeboard_meters || 0, piezometer_kpa || 0, turbidity_ntu || 0, pumping_line_status,
      operatorName, shiftCode, notes || null
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'TAILINGS_REPORT', id, `Reporte relaves en ${station_tag}`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Reporte de descarga y relaves guardado', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
