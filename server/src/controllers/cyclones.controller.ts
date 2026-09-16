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

export function getStationSamples(req: Request, res: Response) {
  try {
    const station = (req.query.station as string) || '2DA ESTACIÓN CICLONES';
    const shift = req.query.shift as string;
    const date = req.query.date as string;

    let query = 'SELECT * FROM cyclone_station_samples WHERE station = ?';
    const params: any[] = [station];

    if (shift) {
      query += ' AND shift_code = ?';
      params.push(shift);
    }
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    query += ' ORDER BY sample_time ASC, battery_tag ASC';

    const samples = db.prepare(query).all(...params) as any[];

    // Calculate averages
    let generalAverages = {
      solids_feed: 0,
      solids_of: 0,
      solids_uf: 0,
      mesh200_feed: 0,
      mesh200_of: 0,
      mesh200_uf: 0
    };

    if (samples.length > 0) {
      const totals = samples.reduce((acc, curr) => {
        acc.solids_feed += Number(curr.solids_feed || 0);
        acc.solids_of += Number(curr.solids_of || 0);
        acc.solids_uf += Number(curr.solids_uf || 0);
        acc.mesh200_feed += Number(curr.mesh200_feed || 0);
        acc.mesh200_of += Number(curr.mesh200_of || 0);
        acc.mesh200_uf += Number(curr.mesh200_uf || 0);
        return acc;
      }, { solids_feed: 0, solids_of: 0, solids_uf: 0, mesh200_feed: 0, mesh200_of: 0, mesh200_uf: 0 });

      const n = samples.length;
      generalAverages = {
        solids_feed: Number((totals.solids_feed / n).toFixed(2)),
        solids_of: Number((totals.solids_of / n).toFixed(2)),
        solids_uf: Number((totals.solids_uf / n).toFixed(2)),
        mesh200_feed: Number((totals.mesh200_feed / n).toFixed(2)),
        mesh200_of: Number((totals.mesh200_of / n).toFixed(2)),
        mesh200_uf: Number((totals.mesh200_uf / n).toFixed(2))
      };
    }

    return res.json({
      success: true,
      station,
      count: samples.length,
      data: samples,
      generalAverages,
      keyAverages: {
        uf_solids: generalAverages.solids_uf,
        uf_mesh200: generalAverages.mesh200_uf
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createStationSample(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      station = '2DA ESTACIÓN CICLONES',
      sample_time,
      battery_tag,
      solids_feed = 0,
      solids_of = 0,
      solids_uf = 0,
      mesh200_feed = 0,
      mesh200_of = 0,
      mesh200_uf = 0,
      shift_code,
      date
    } = req.body;

    if (!sample_time || !battery_tag) {
      return res.status(400).json({ success: false, message: 'Hora de muestreo y batería son obligatorios' });
    }

    const id = crypto.randomUUID();
    const finalShift = req.user?.shift || shift_code || 'GUARDIA_A';
    const finalDate = date || new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO cyclone_station_samples (
        id, station, sample_time, battery_tag,
        solids_feed, solids_of, solids_uf,
        mesh200_feed, mesh200_of, mesh200_uf,
        shift_code, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, station, sample_time, battery_tag,
      Number(solids_feed), Number(solids_of), Number(solids_uf),
      Number(mesh200_feed), Number(mesh200_of), Number(mesh200_uf),
      finalShift, finalDate
    );

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      'CREATE',
      'CYCLONE_STATION_SAMPLE',
      id,
      `Muestra ${station} ${sample_time} ${battery_tag}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Muestra de estación guardada exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function deleteStationSample(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT id, station, sample_time, battery_tag FROM cyclone_station_samples WHERE id = ?').get(id) as any;

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Registro de muestra no encontrado' });
    }

    db.prepare('DELETE FROM cyclone_station_samples WHERE id = ?').run(id);

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      'DELETE',
      'CYCLONE_STATION_SAMPLE',
      id,
      `Eliminada muestra ${existing.station} ${existing.sample_time} ${existing.battery_tag}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Registro de muestra eliminado' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

