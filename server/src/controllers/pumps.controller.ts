import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';
import { nextTicketNumber } from './maintenance.controller.js';
import { siteToday, resolveGuardCode } from '../utils/site-date.js';
import { resolveOperatorName } from '../utils/system-admin.js';
import { pushService } from '../services/push.service.js';

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
    const operatorName = resolveOperatorName(req.user, req.body.operator_name);
    const shiftCode = resolveGuardCode(req.body.shift_code, req.user?.shift);

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

    // Check active maintenance ticket lock for this pump tag
    const activeTicket = db.prepare(`
      SELECT id, status, ticket_number FROM maintenance_requests 
      WHERE equipment_tag = ? AND status IN ('PENDING', 'IN_PROGRESS')
      ORDER BY created_at DESC LIMIT 1
    `).get(pump.tag) as any;

    let finalStatus = status;
    if (activeTicket && (status === 'OPERATING' || status === 'STANDBY')) {
      // Retain lock: only maintenance can release to operating
      finalStatus = activeTicket.status === 'IN_PROGRESS' ? 'MAINTENANCE' : 'FAULT';
    } else if (status === 'FAULT' && !activeTicket) {
      // Auto-create maintenance request
      const ticketId = crypto.randomUUID();
      const ticketNumber = nextTicketNumber();
      const operator = req.user?.fullName || req.user?.username || 'Operador de Bombas';
      db.prepare(`
        INSERT INTO maintenance_requests (
          id, ticket_number, equipment_tag, title, description,
          priority, status, requester_name, assigned_to, photo_url,
          estimated_hours, source_module, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        ticketId,
        ticketNumber,
        pump.tag,
        `Falla reportada en Bomba ${pump.tag}`,
        `Orden de trabajo generada automáticamente desde Telemetría de Bombas por ${operator}`,
        'HIGH',
        'PENDING',
        operator,
        'Equipo Mantenimiento Planta',
        '',
        2,
        'PUMPS_STATION'
      );

      broadcastWsEvent({
        entity: 'maintenance',
        action: 'CREATE',
        data: {
          id: ticketId,
          ticket_number: ticketNumber,
          equipment_tag: pump.tag,
          title: `Falla reportada en Bomba ${pump.tag}`,
          description: `Orden de trabajo generada automáticamente desde Telemetría de Bombas por ${operator}`,
          priority: 'HIGH',
          status: 'PENDING',
          requester_name: operator,
          assigned_to: 'Equipo Mantenimiento Planta',
          source_module: 'PUMPS_STATION',
          created_at: new Date().toISOString()
        },
        key: 'basetrack_maintenance_tickets',
        deviceId: req.headers['x-device-id']?.toString() || 'server_api'
      });

      pushService.sendPushNotification({
        title: `🚨 Alerta: Bomba ${pump.tag} en Falla`,
        body: `Se reportó parada/falla en Bomba ${pump.tag}. Orden ${ticketNumber} auto-generada.`,
        data: { url: '/pumps', tag: pump.tag },
        tag: `pump-fault-${pump.tag}`
      }).catch(err => console.error('[Push] Error delivering pump fault push:', err));
    }

    db.prepare(`
      UPDATE pump_reports 
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          flow_rate_m3h = COALESCE(?, flow_rate_m3h),
          pressure_bar = COALESCE(?, pressure_bar)
      WHERE id = ?
    `).run(finalStatus || null, notes || null, flow_rate_m3h ?? null, pressure_bar ?? null, id);

    logAudit(req.user?.userId || null, req.user?.username || 'system', 'UPDATE', 'PUMP_REPORT', id, `Actualización de estado a ${finalStatus}`, req.ip || '127.0.0.1');

    return res.json({ success: true, message: 'Estado de bomba actualizado exitosamente', status: finalStatus });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function normalizeDate(d?: string): string {
  if (!d) return siteToday();
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return d;
}

function normalizeShift(s?: string): string {
  if (!s || s === '[object Object]') return 'G1';
  if (s === 'GUARDIA_A') return 'G1';
  if (s === 'GUARDIA_B') return 'G2';
  return s;
}

export function getPumpOperationalSheet(req: Request, res: Response) {
  try {
    const reportDate = normalizeDate((req.query.date as string) || siteToday());
    const shiftCode = normalizeShift((req.query.shift as string) || 'G1');

    let sheet = db.prepare(`
      SELECT * FROM pump_station_sheets 
      WHERE report_date = ? AND shift_code = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(reportDate, shiftCode) as any;

    let isFallback = false;
    if (!sheet) {
      // Fallback to latest available sheet for default machine tags and config
      sheet = db.prepare(`
        SELECT * FROM pump_station_sheets 
        ORDER BY report_date DESC, created_at DESC LIMIT 1
      `).get() as any;
      if (sheet) {
        isFallback = true;
      }
    }

    if (sheet) {
      const cleanVal = (v: any) => (v === '---' || v === 'n/d' || v === null || v === undefined ? '' : v);
      const cleanObj = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => cleanObj(item));
        const out: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'object' && v !== null) {
            out[k] = cleanObj(v);
          } else {
            out[k] = k.includes('status') ? v : cleanVal(v);
          }
        }
        return out;
      };

      return res.json({
        success: true,
        data: {
          id: isFallback ? undefined : sheet.id,
          report_date: isFallback ? reportDate : sheet.report_date,
          shift_code: isFallback ? shiftCode : sheet.shift_code,
          operator_name: sheet.operator_name,
          sentina_pumps: JSON.parse(sheet.sentina_pumps_json),
          intermedia_pumps: JSON.parse(sheet.intermedia_pumps_json),
          torre5_pumps: JSON.parse(sheet.torre5_pumps_json),
          levels: cleanObj(JSON.parse(sheet.levels_json)),
          main_indicators: cleanObj(JSON.parse(sheet.main_indicators_json)),
          pozas_sentina: cleanObj(JSON.parse(sheet.pozas_sentina_json)),
          additional_obs: cleanObj(JSON.parse(sheet.additional_obs_json)),
          updated_at: sheet.updated_at
        }
      });
    }

    // Default template if no records yet (clean empty spaces)
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
        levels: { orca: '', espejo: '', captacion: '' },
        main_indicators: {
          nivel_sentina: '', bombeo_turno_intermedia: '', nivel_tko02: '', aforador: '',
          cortafugas: '', ph_aforador: '', ph_cortafugas: '', h_embalas: '',
          dique_almacenamiento: '', drenaje_dique: '', agua_a_car: '', anticrustante: '',
          torre5_cortafugas: '', torre5_status1: 'Stand by', torre5_status2: 'Stand by'
        },
        pozas_sentina: [
          { poza: 'S-QCOR.R_02', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' },
          { poza: 'S-QCOR.R_03', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' }
        ],
        additional_obs: {
          notas: '', af_cantera: '', escorrentia: '', ph_c5_1: '', ph_c5_2: ''
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
      shift_code, operator_name,
      sentina_pumps, intermedia_pumps, torre5_pumps,
      levels, main_indicators, pozas_sentina, additional_obs
    } = req.body;

    const rawDate = req.body.report_date;
    if (!rawDate) {
      return res.status(400).json({ success: false, message: 'La fecha del reporte es requerida' });
    }
    const report_date = normalizeDate(rawDate);
    const shift = normalizeShift(shift_code || req.user?.shift || 'G1');
    const operator = resolveOperatorName(req.user, operator_name);

    // Helper: Sanitize pumps list, enforce maintenance locks and auto-create OTs for 'Falla'
    const sanitizeAndLinkPumps = (pumps: any[]) => {
      if (!Array.isArray(pumps)) return [];
      return pumps.map(p => {
        if (!p || !p.tag) return p;
        const activeTicket = db.prepare(`
          SELECT id, status, ticket_number FROM maintenance_requests 
          WHERE equipment_tag = ? AND status IN ('PENDING', 'IN_PROGRESS')
          ORDER BY created_at DESC LIMIT 1
        `).get(p.tag) as any;

        if (activeTicket) {
          // If maintenance ticket is active, pump is LOCKED: cannot be reverted to Operativo or Stand by
          if (p.status === 'Operativo' || p.status === 'Stand by') {
            p.status = activeTicket.status === 'IN_PROGRESS' ? 'Mantenimiento' : 'Falla';
          }
        } else if (p.status === 'Falla') {
          // Auto-generate maintenance request for this pump tag
          const ticketId = crypto.randomUUID();
          const ticketNumber = nextTicketNumber();

          db.prepare(`
            INSERT INTO maintenance_requests (
              id, ticket_number, equipment_tag, title, description,
              priority, status, requester_name, assigned_to, photo_url,
              estimated_hours, source_module, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            ticketId,
            ticketNumber,
            p.tag,
            `Falla reportada en Bomba ${p.tag}`,
            `Orden de trabajo generada automáticamente desde la Planilla de Bombas por ${operator}`,
            'HIGH',
            'PENDING',
            operator,
            'Equipo Mantenimiento Planta',
            '',
            2,
            'PUMPS_STATION'
          );

          broadcastWsEvent({
            entity: 'maintenance',
            action: 'CREATE',
            data: {
              id: ticketId,
              ticket_number: ticketNumber,
              equipment_tag: p.tag,
              title: `Falla reportada en Bomba ${p.tag}`,
              description: `Orden de trabajo generada automáticamente desde la Planilla de Bombas por ${operator}`,
              priority: 'HIGH',
              status: 'PENDING',
              requester_name: operator,
              assigned_to: 'Equipo Mantenimiento Planta',
              source_module: 'PUMPS_STATION',
              created_at: new Date().toISOString()
            },
            key: 'maintenance_request_' + ticketId,
            deviceId: req.headers['x-device-id']?.toString() || 'server_api'
          });

          pushService.sendPushNotification({
            title: `🚨 Alerta: Bomba ${p.tag} en Falla`,
            body: `Se reportó parada/falla en Bomba ${p.tag}. Orden ${ticketNumber} auto-generada.`,
            data: { url: '/pumps', tag: p.tag },
            tag: `pump-fault-${p.tag}`
          }).catch(err => console.error('[Push] Error delivering sheet pump fault push:', err));

          logAudit(
            req.user?.userId || null,
            req.user?.username || 'system',
            'CREATE',
            'MAINTENANCE_REQUEST',
            ticketId,
            `Auto-generación de OT ${ticketNumber} por falla en bomba ${p.tag}`,
            req.ip || '127.0.0.1'
          );
        }
        return p;
      });
    };

    const defaultSentinaTags = ['PU001', 'PU002', 'PU003', 'PU004', 'PU005', 'PU006', 'PU007', 'PU008'];
    const defaultIntermediaTags = ['PU011', 'PU012', 'PU013', 'PU014', 'PU015', 'PU016'];
    const defaultTorre5Tags = ['PU021', 'PU022', 'PU023', 'PU024', 'PU025', 'PU026', 'PU027', 'PU028', 'PU029', 'PU030'];

    const mergeWithDefaults = (inputList: any[], defaultTags: string[]) => {
      const map = new Map<string, any>();
      defaultTags.forEach(tag => map.set(tag, { tag, status: 'Operativo' }));
      if (Array.isArray(inputList)) {
        inputList.forEach(p => {
          if (p && p.tag) {
            map.set(p.tag, { tag: p.tag, status: p.status || 'Operativo' });
          }
        });
      }
      return defaultTags.map(tag => map.get(tag));
    };

    const cleanSentinaPumps = sanitizeAndLinkPumps(mergeWithDefaults(sentina_pumps || [], defaultSentinaTags));
    const cleanIntermediaPumps = sanitizeAndLinkPumps(mergeWithDefaults(intermedia_pumps || [], defaultIntermediaTags));
    const cleanTorre5Pumps = sanitizeAndLinkPumps(mergeWithDefaults(torre5_pumps || [], defaultTorre5Tags));

    const existing = db.prepare(`
      SELECT id FROM pump_station_sheets 
      WHERE report_date = ? AND shift_code = ?
    `).get(report_date, shift) as any;

    const sentinaJson = JSON.stringify(cleanSentinaPumps);
    const intermediaJson = JSON.stringify(cleanIntermediaPumps);
    const torre5Json = JSON.stringify(cleanTorre5Pumps);
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

    const payload = {
      ...req.body,
      sentina_pumps: cleanSentinaPumps,
      intermedia_pumps: cleanIntermediaPumps,
      torre5_pumps: cleanTorre5Pumps
    };

    broadcastWsEvent({
      entity: 'PUMP_STATION_SHEET',
      action: existing ? 'UPDATE' : 'CREATE',
      key: 'pump_sheet_' + report_date,
      data: payload
    });

    return res.status(200).json({
      success: true,
      message: 'Reporte integral de bombas guardado exitosamente',
      id: sheetId,
      data: payload
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function closePumpShift(req: AuthenticatedRequest, res: Response) {
  try {
    const report_date = req.body.report_date || siteToday();
    const shift_code = req.body.shift_code || req.user?.shift || 'G1';
    const notes = req.body.notes || null;
    const closed_by = req.user?.fullName || req.user?.username || 'Operador de Turno';

    let sheetRow = db.prepare(`
      SELECT * FROM pump_station_sheets 
      WHERE report_date = ? AND shift_code = ?
    `).get(report_date, shift_code) as any;

    const sentinaPumps: any[] = req.body.sentina_pumps || (sheetRow?.sentina_pumps_json ? JSON.parse(sheetRow.sentina_pumps_json) : []);
    const intermediaPumps: any[] = req.body.intermedia_pumps || (sheetRow?.intermedia_pumps_json ? JSON.parse(sheetRow.intermedia_pumps_json) : []);
    const torre5Pumps: any[] = req.body.torre5_pumps || (sheetRow?.torre5_pumps_json ? JSON.parse(sheetRow.torre5_pumps_json) : []);
    const mainIndicators: any = req.body.main_indicators || (sheetRow?.main_indicators_json ? JSON.parse(sheetRow.main_indicators_json) : {});
    const operatorName = req.body.operator_name || sheetRow?.operator_name || closed_by;

    // Station sizes: Sentina = 8, Intermedia = 6, Torre 5 = 10, Total = 24
    const sentinaOperating = sentinaPumps.filter((p: any) => p && p.status === 'Operativo').length;
    const intermediaOperating = intermediaPumps.filter((p: any) => p && p.status === 'Operativo').length;
    const torre5Operating = torre5Pumps.filter((p: any) => p && p.status === 'Operativo').length;
    const overallOperating = sentinaOperating + intermediaOperating + torre5Operating;

    const sentinaAvailPct = Number(((sentinaOperating / 8) * 100).toFixed(1));
    const intermediaAvailPct = Number(((intermediaOperating / 6) * 100).toFixed(1));
    const torre5AvailPct = Number(((torre5Operating / 10) * 100).toFixed(1));
    const overallAvailPct = Number(((overallOperating / 24) * 100).toFixed(1));

    // Gotcha #2: mathematical averages / indicators strictly filter out <= 0
    const parsePositive = (val: any) => {
      if (val === null || val === undefined || val === '') return null;
      const clean = String(val).replace(',', '.');
      const n = parseFloat(clean);
      return !isNaN(n) && n > 0 ? Number(n.toFixed(2)) : null;
    };

    const phAforador = parsePositive(mainIndicators.ph_aforador);
    const phCortafugas = parsePositive(mainIndicators.ph_cortafugas);
    const bombeoIntermedia = parsePositive(mainIndicators.bombeo_turno_intermedia);

    const snapshotJson = JSON.stringify({
      sentina_pumps: sentinaPumps,
      intermedia_pumps: intermediaPumps,
      torre5_pumps: torre5Pumps,
      main_indicators: mainIndicators,
      levels: req.body.levels || (sheetRow?.levels_json ? JSON.parse(sheetRow.levels_json) : {}),
      pozas_sentina: req.body.pozas_sentina || (sheetRow?.pozas_sentina_json ? JSON.parse(sheetRow.pozas_sentina_json) : []),
      additional_obs: req.body.additional_obs || (sheetRow?.additional_obs_json ? JSON.parse(sheetRow.additional_obs_json) : {})
    });

    const existingClosure = db.prepare(`
      SELECT id FROM pump_shift_closures 
      WHERE report_date = ? AND shift_code = ?
    `).get(report_date, shift_code) as any;

    let closureId = existingClosure?.id;

    if (existingClosure) {
      db.prepare(`
        UPDATE pump_shift_closures
        SET operator_name = ?, closed_by = ?,
            sentina_operating = ?, sentina_total = 8, sentina_availability_pct = ?,
            intermedia_operating = ?, intermedia_total = 6, intermedia_availability_pct = ?,
            torre5_operating = ?, torre5_total = 10, torre5_availability_pct = ?,
            overall_operating = ?, overall_total = 24, overall_availability_pct = ?,
            ph_aforador = ?, ph_cortafugas = ?, bombeo_intermedia = ?,
            notes = ?, snapshot_json = ?, closed_at = datetime('now')
        WHERE id = ?
      `).run(
        operatorName, closed_by,
        sentinaOperating, sentinaAvailPct,
        intermediaOperating, intermediaAvailPct,
        torre5Operating, torre5AvailPct,
        overallOperating, overallAvailPct,
        phAforador, phCortafugas, bombeoIntermedia,
        notes, snapshotJson, closureId
      );
    } else {
      closureId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO pump_shift_closures (
          id, report_date, shift_code, operator_name, closed_by,
          sentina_operating, sentina_total, sentina_availability_pct,
          intermedia_operating, intermedia_total, intermedia_availability_pct,
          torre5_operating, torre5_total, torre5_availability_pct,
          overall_operating, overall_total, overall_availability_pct,
          ph_aforador, ph_cortafugas, bombeo_intermedia,
          notes, snapshot_json, closed_at
        ) VALUES (?, ?, ?, ?, ?, ?, 8, ?, ?, 6, ?, ?, 10, ?, ?, 24, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        closureId, report_date, shift_code, operatorName, closed_by,
        sentinaOperating, sentinaAvailPct,
        intermediaOperating, intermediaAvailPct,
        torre5Operating, torre5AvailPct,
        overallOperating, overallAvailPct,
        phAforador, phCortafugas, bombeoIntermedia,
        notes, snapshotJson
      );
    }

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'system',
      existingClosure ? 'UPDATE' : 'CREATE',
      'PUMP_SHIFT_CLOSURE',
      closureId,
      `Cierre de turno en Bombas: ${report_date} (${shift_code}) Disponibilidad Global: ${overallAvailPct}%`,
      req.ip || '127.0.0.1'
    );

    const closureRecord = db.prepare('SELECT * FROM pump_shift_closures WHERE id = ?').get(closureId);

    broadcastWsEvent({
      entity: 'PUMP_SHIFT_CLOSURE',
      action: existingClosure ? 'UPDATE' : 'CREATE',
      key: `pump_closure_${report_date}_${shift_code}`,
      data: closureRecord
    });

    return res.status(200).json({
      success: true,
      message: `Turno ${shift_code} cerrado exitosamente. Disponibilidad global registrada: ${overallAvailPct}%`,
      data: closureRecord
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getPumpShiftHistory(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 100);
    const date = req.query.date as string;
    const shift = req.query.shift as string;

    let query = 'SELECT * FROM pump_shift_closures WHERE 1=1';
    const params: any[] = [];

    if (date) {
      query += ' AND report_date = ?';
      params.push(date);
    }
    if (shift) {
      query += ' AND shift_code = ?';
      params.push(shift);
    }

    query += ' ORDER BY report_date DESC, closed_at DESC LIMIT ?';
    params.push(limit);

    const history = db.prepare(query).all(...params) as any[];

    // Compute aggregate averages across the history items
    let summary = {
      avg_sentina_pct: 0,
      avg_intermedia_pct: 0,
      avg_torre5_pct: 0,
      avg_overall_pct: 0,
      avg_ph_aforador: 0,
      avg_ph_cortafugas: 0,
      total_closures: history.length
    };

    if (history.length > 0) {
      let sumSentina = 0;
      let sumInter = 0;
      let sumTorre = 0;
      let sumOverall = 0;
      let sumPhAforador = 0, countPhAforador = 0;
      let sumPhCorta = 0, countPhCorta = 0;

      history.forEach(item => {
        sumSentina += Number(item.sentina_availability_pct || 0);
        sumInter += Number(item.intermedia_availability_pct || 0);
        sumTorre += Number(item.torre5_availability_pct || 0);
        sumOverall += Number(item.overall_availability_pct || 0);

        if (item.ph_aforador && Number(item.ph_aforador) > 0) {
          sumPhAforador += Number(item.ph_aforador);
          countPhAforador++;
        }
        if (item.ph_cortafugas && Number(item.ph_cortafugas) > 0) {
          sumPhCorta += Number(item.ph_cortafugas);
          countPhCorta++;
        }
      });

      const n = history.length;
      summary = {
        avg_sentina_pct: Number((sumSentina / n).toFixed(1)),
        avg_intermedia_pct: Number((sumInter / n).toFixed(1)),
        avg_torre5_pct: Number((sumTorre / n).toFixed(1)),
        avg_overall_pct: Number((sumOverall / n).toFixed(1)),
        avg_ph_aforador: countPhAforador > 0 ? Number((sumPhAforador / countPhAforador).toFixed(2)) : 0,
        avg_ph_cortafugas: countPhCorta > 0 ? Number((sumPhCorta / countPhCorta).toFixed(2)) : 0,
        total_closures: n
      };
    }

    return res.json({
      success: true,
      count: history.length,
      data: history,
      summary
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

