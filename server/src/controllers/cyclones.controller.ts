import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';
import { siteToday } from '../utils/site-date.js';

const SAMPLE_PERCENT_FIELDS = ['solids_feed', 'solids_of', 'solids_uf', 'mesh200_feed', 'mesh200_of', 'mesh200_uf'] as const;

/** % sólidos y % -200M deben estar entre 0 y 100: un valor inválido falsea el control de finos del muro. */
function invalidSamplePercent(body: Record<string, unknown>): string | null {
  for (const field of SAMPLE_PERCENT_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null || value === '') continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) return field;
  }
  return null;
}

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
    const shiftCode = req.user?.shift || req.body.shift_code || 'G1';

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
    const station = req.query.station as string;
    const shift = req.query.shift as string;
    const date = req.query.date as string;

    let query = 'SELECT * FROM cyclone_station_samples WHERE 1=1';
    const params: any[] = [];

    if (station && station !== 'ALL') {
      query += ' AND station = ?';
      params.push(station);
    } else if (!station) {
      query += ' AND station = ?';
      params.push('2DA ESTACIÓN CICLONES');
    }

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
      const counts = {
        solids_feed: 0,
        solids_of: 0,
        solids_uf: 0,
        mesh200_feed: 0,
        mesh200_of: 0,
        mesh200_uf: 0
      };
      const totals = samples.reduce((acc, curr) => {
        const sf = Number(curr.solids_feed || 0);
        if (sf > 0) { acc.solids_feed += sf; counts.solids_feed++; }
        const so = Number(curr.solids_of || 0);
        if (so > 0) { acc.solids_of += so; counts.solids_of++; }
        const su = Number(curr.solids_uf || 0);
        if (su > 0) { acc.solids_uf += su; counts.solids_uf++; }
        const mf = Number(curr.mesh200_feed || 0);
        if (mf > 0) { acc.mesh200_feed += mf; counts.mesh200_feed++; }
        const mo = Number(curr.mesh200_of || 0);
        if (mo > 0) { acc.mesh200_of += mo; counts.mesh200_of++; }
        const mu = Number(curr.mesh200_uf || 0);
        if (mu > 0) { acc.mesh200_uf += mu; counts.mesh200_uf++; }
        return acc;
      }, { solids_feed: 0, solids_of: 0, solids_uf: 0, mesh200_feed: 0, mesh200_of: 0, mesh200_uf: 0 });

      generalAverages = {
        solids_feed: counts.solids_feed > 0 ? Number((totals.solids_feed / counts.solids_feed).toFixed(2)) : 0,
        solids_of: counts.solids_of > 0 ? Number((totals.solids_of / counts.solids_of).toFixed(2)) : 0,
        solids_uf: counts.solids_uf > 0 ? Number((totals.solids_uf / counts.solids_uf).toFixed(2)) : 0,
        mesh200_feed: counts.mesh200_feed > 0 ? Number((totals.mesh200_feed / counts.mesh200_feed).toFixed(2)) : 0,
        mesh200_of: counts.mesh200_of > 0 ? Number((totals.mesh200_of / counts.mesh200_of).toFixed(2)) : 0,
        mesh200_uf: counts.mesh200_uf > 0 ? Number((totals.mesh200_uf / counts.mesh200_uf).toFixed(2)) : 0
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
    const badField = invalidSamplePercent(req.body);
    if (badField) {
      return res.status(400).json({ success: false, message: `Valor inválido en ${badField}: debe ser un porcentaje entre 0 y 100` });
    }

    const id = crypto.randomUUID();
    const finalShift = req.user?.shift || shift_code || 'G1';
    const finalDate = date || siteToday();

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

    broadcastWsEvent({
      entity: 'CYCLONE_STATION_SAMPLE',
      action: 'CREATE',
      data: {
        id, station, sample_time, battery_tag,
        solids_feed, solids_of, solids_uf,
        mesh200_feed, mesh200_of, mesh200_uf,
        shift_code: finalShift, date: finalDate
      }
    });

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

    broadcastWsEvent({
      entity: 'CYCLONE_STATION_SAMPLE',
      action: 'DELETE',
      data: { id, station: existing.station }
    });

    return res.json({ success: true, message: 'Registro de muestra eliminado' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function updateStationSample(req: AuthenticatedRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const {
      station,
      sample_time,
      battery_tag,
      solids_feed,
      solids_of,
      solids_uf,
      mesh200_feed,
      mesh200_of,
      mesh200_uf,
      shift_code,
      date
    } = req.body;

    const badField = invalidSamplePercent(req.body);
    if (badField) {
      return res.status(400).json({ success: false, message: `Valor inválido en ${badField}: debe ser un porcentaje entre 0 y 100` });
    }

    const existing = db.prepare('SELECT id FROM cyclone_station_samples WHERE id = ?').get(id) as any;

    if (!existing) {
      const finalShift = req.user?.shift || shift_code || 'G1';
      const finalDate = date || siteToday();

      db.prepare(`
        INSERT INTO cyclone_station_samples (
          id, station, sample_time, battery_tag,
          solids_feed, solids_of, solids_uf,
          mesh200_feed, mesh200_of, mesh200_uf,
          shift_code, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        station || '2DA ESTACIÓN CICLONES',
        sample_time || '20:00',
        battery_tag || 'CY3',
        Number(solids_feed || 0),
        Number(solids_of || 0),
        Number(solids_uf || 0),
        Number(mesh200_feed || 0),
        Number(mesh200_of || 0),
        Number(mesh200_uf || 0),
        finalShift,
        finalDate
      );

      logAudit(
        req.user?.userId || null,
        req.user?.username || 'system',
        'CREATE',
        'CYCLONE_STATION_SAMPLE',
        id,
        `Muestra creada vía edición directa ${station} ${sample_time} ${battery_tag}`,
        req.ip || '127.0.0.1'
      );

      return res.status(201).json({ success: true, message: 'Muestra creada exitosamente', id });
    }

    db.prepare(`
      UPDATE cyclone_station_samples
      SET station = COALESCE(?, station),
          sample_time = COALESCE(?, sample_time),
          battery_tag = COALESCE(?, battery_tag),
          solids_feed = ?,
          solids_of = ?,
          solids_uf = ?,
          mesh200_feed = ?,
          mesh200_of = ?,
          mesh200_uf = ?
      WHERE id = ?
    `).run(
      station,
      sample_time,
      battery_tag,
      Number(solids_feed || 0),
      Number(solids_of || 0),
      Number(solids_uf || 0),
      Number(mesh200_feed || 0),
      Number(mesh200_of || 0),
      Number(mesh200_uf || 0),
      id
    );

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      'UPDATE',
      'CYCLONE_STATION_SAMPLE',
      id,
      `Actualizada muestra ${sample_time} ${battery_tag}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Muestra actualizada exitosamente', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}


