import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export function getAllCyclones(req: Request, res: Response) {
  try {
    const cyclones = db.prepare('SELECT * FROM cyclone_reports ORDER BY created_at DESC').all();
    return res.json({ success: true, count: cyclones.length, data: cyclones });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createCycloneReport(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      battery_tag, total_cyclones, active_cyclones, feed_pressure_psi,
      feed_density_kgm3, p80_microns, overflow_density, underflow_density,
      flocculant_ppm, status, notes
    } = req.body;

    if (!battery_tag || !status) {
      return res.status(400).json({ success: false, message: 'Identificador de batería y estado son requeridos' });
    }

    const id = crypto.randomUUID();
    const shiftCode = req.user?.shift || req.body.shift_code || 'GUARDIA_A';

    db.prepare(`
      INSERT INTO cyclone_reports (
        id, battery_tag, total_cyclones, active_cyclones, feed_pressure_psi,
        feed_density_kgm3, p80_microns, overflow_density, underflow_density,
        flocculant_ppm, status, shift_code, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, battery_tag, total_cyclones || 12, active_cyclones || 10, feed_pressure_psi || 0,
      feed_density_kgm3 || 0, p80_microns || 0, overflow_density || 0, underflow_density || 0,
      flocculant_ppm || 0, status, shiftCode, notes || null
    );

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'CREATE', 'CYCLONE_REPORT', id, `Registro ciclón ${battery_tag}`, req.ip || '127.0.0.1');

    return res.status(201).json({ success: true, message: 'Reporte de ciclones guardado exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
