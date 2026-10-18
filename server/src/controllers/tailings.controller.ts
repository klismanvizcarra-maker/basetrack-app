import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';

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
    if (!['NORMAL', 'ALERT', 'RESTRICTED'].includes(String(pumping_line_status))) {
      return res.status(400).json({ success: false, message: 'Estado de línea inválido (NORMAL, ALERT o RESTRICTED)' });
    }

    // Lecturas de presa: deben ser números reales no negativos (un texto o negativo falsearía el borde libre)
    const numericFields: Record<string, unknown> = {
      flow_rate_m3h, solids_percentage, dam_level_meters, freeboard_meters, piezometer_kpa, turbidity_ntu
    };
    for (const [field, value] of Object.entries(numericFields)) {
      if (value === undefined || value === null || value === '') continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ success: false, message: `Valor inválido en ${field}: debe ser un número no negativo` });
      }
    }
    if (solids_percentage !== undefined && solids_percentage !== null && solids_percentage !== '' && Number(solids_percentage) > 100) {
      return res.status(400).json({ success: false, message: 'El porcentaje de sólidos no puede superar 100%' });
    }

    const id = crypto.randomUUID();
    const operatorName = req.body.operator_name || req.user?.fullName || 'Operador de Presa';
    const shiftCode = req.body.shift_code || req.user?.shift || 'G1';

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

    // Broadcast instant WebSocket update across all terminals
    broadcastWsEvent({
      entity: 'tailings',
      action: 'CREATE',
      data: {
        id,
        station_tag,
        flow_rate_m3h: flow_rate_m3h || 0,
        solids_percentage: solids_percentage || 0,
        dam_level_meters: dam_level_meters || 0,
        freeboard_meters: freeboard_meters || 0,
        piezometer_kpa: piezometer_kpa || 0,
        turbidity_ntu: turbidity_ntu || 0,
        pumping_line_status,
        operator_name: operatorName,
        shift_code: shiftCode,
        notes: notes || null
      },
      key: 'basetrack_tailings_reports',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: operatorName
    });

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'TAILINGS_REPORT', id, `Reporte relaves en ${station_tag}`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Reporte de descarga y relaves guardado', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
