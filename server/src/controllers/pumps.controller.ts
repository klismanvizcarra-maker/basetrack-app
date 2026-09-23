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
    const shiftCode = req.user?.shift || req.body.shift_code || 'G1';

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

export function getPumpOperationalSheet(req: Request, res: Response) {
  try {
    const reportDate = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const shiftCode = (req.query.shift as string) || 'G1';

    let sheet = db.prepare(`
      SELECT * FROM pump_station_sheets 
      WHERE report_date = ? AND shift_code = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(reportDate, shiftCode) as any;

    if (!sheet) {
      // Fallback to latest available sheet
      sheet = db.prepare(`
        SELECT * FROM pump_station_sheets 
        ORDER BY report_date DESC, created_at DESC LIMIT 1
      `).get() as any;
    }

    if (sheet) {
      return res.json({
        success: true,
        data: {
          id: sheet.id,
          report_date: sheet.report_date,
          shift_code: sheet.shift_code,
          operator_name: sheet.operator_name,
          sentina_pumps: JSON.parse(sheet.sentina_pumps_json),
          intermedia_pumps: JSON.parse(sheet.intermedia_pumps_json),
          torre5_pumps: JSON.parse(sheet.torre5_pumps_json),
          levels: JSON.parse(sheet.levels_json),
          main_indicators: JSON.parse(sheet.main_indicators_json),
          pozas_sentina: JSON.parse(sheet.pozas_sentina_json),
          additional_obs: JSON.parse(sheet.additional_obs_json),
          updated_at: sheet.updated_at
        }
      });
    }

    // Default template if no records yet
    const defaultSentina = ['PU001', 'PU002', 'PU003', 'PU004', 'PU005', 'PU006', 'PU007', 'PU008'].map(tag => ({ tag, status: 'Operativo' }));
    const defaultIntermedia = ['PU011', 'PU012', 'PU013', 'PU014', 'PU015', 'PU016'].map(tag => ({ tag, status: 'Operativo' }));
    const defaultTorre5 = ['PU021', 'PU022', 'PU023', 'PU024', 'PU025', 'PU026', 'PU027', 'PU028', 'PU029', 'PU030'].map(tag => ({ tag, status: 'Operativo' }));

    return res.json({
      success: true,
      data: {
        id: 'default',
        report_date: reportDate,
        shift_code: shiftCode,
        operator_name: 'Operador Central',
        sentina_pumps: defaultSentina,
        intermedia_pumps: defaultIntermedia,
        torre5_pumps: defaultTorre5,
        levels: { orca: '---', espejo: '---', captacion: '---' },
        main_indicators: {
          nivel_sentina: '---', bombeo_turno_intermedia: '---', nivel_tko02: '---', aforador: '---',
          cortafugas: '---', ph_aforador: '---', ph_cortafugas: '---', h_embalas: '---',
          dique_almacenamiento: '---', drenaje_dique: '---', agua_a_car: '---', anticrustante: '---',
          torre5_cortafugas: '---', torre5_status1: 'Stand by', torre5_status2: 'Stand by'
        },
        pozas_sentina: [
          { poza: 'S-QCOR.R_02', medida_ini: 'n/d', flujo_ini: 'n/d', medida_fin: 'n/d', flujo_fin: 'n/d', horas: 'n/d', acc: '---' },
          { poza: 'S-QCOR.R_03', medida_ini: 'n/d', flujo_ini: 'n/d', medida_fin: 'n/d', flujo_fin: 'n/d', horas: 'n/d', acc: '---' }
        ],
        additional_obs: {
          notas: '---', af_cantera: '---', escorrentia: '---', ph_c5_1: '---', ph_c5_2: '---'
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function savePumpOperationalSheet(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      report_date, shift_code, operator_name,
      sentina_pumps, intermedia_pumps, torre5_pumps,
      levels, main_indicators, pozas_sentina, additional_obs
    } = req.body;

    if (!report_date) {
      return res.status(400).json({ success: false, message: 'La fecha del reporte es requerida' });
    }

    const shift = shift_code || req.user?.shift || 'G1';
    const operator = req.user?.fullName || operator_name || 'Operador Central';

    const existing = db.prepare(`
      SELECT id FROM pump_station_sheets 
      WHERE report_date = ? AND shift_code = ?
    `).get(report_date, shift) as any;

    const sentinaJson = JSON.stringify(sentina_pumps || []);
    const intermediaJson = JSON.stringify(intermedia_pumps || []);
    const torre5Json = JSON.stringify(torre5_pumps || []);
    const levelsJson = JSON.stringify(levels || {});
    const indicatorsJson = JSON.stringify(main_indicators || {});
    const pozasJson = JSON.stringify(pozas_sentina || []);
    const obsJson = JSON.stringify(additional_obs || {});

    let sheetId = existing?.id;

    if (existing) {
      db.prepare(`
        UPDATE pump_station_sheets
        SET operator_name = ?, sentina_pumps_json = ?, intermedia_pumps_json = ?, torre5_pumps_json = ?,
            levels_json = ?, main_indicators_json = ?, pozas_sentina_json = ?, additional_obs_json = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(operator, sentinaJson, intermediaJson, torre5Json, levelsJson, indicatorsJson, pozasJson, obsJson, sheetId);
    } else {
      sheetId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO pump_station_sheets (
          id, report_date, shift_code, operator_name, sentina_pumps_json, intermedia_pumps_json,
          torre5_pumps_json, levels_json, main_indicators_json, pozas_sentina_json, additional_obs_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sheetId, report_date, shift, operator, sentinaJson, intermediaJson, torre5Json, levelsJson, indicatorsJson, pozasJson, obsJson);
    }

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      existing ? 'UPDATE' : 'CREATE',
      'PUMP_STATION_SHEET',
      sheetId,
      `Guardado de reporte integral de bombas fecha ${report_date}`,
      req.ip || '127.0.0.1'
    );

    return res.status(200).json({ success: true, message: 'Reporte integral de bombas guardado exitosamente', id: sheetId });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
