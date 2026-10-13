import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';

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
      let nextNum = ((db.prepare('SELECT COUNT(*) as count FROM maintenance_requests').get() as { count: number }).count || 0) + 1;
      let ticketNumber = `OT-2026-${String(nextNum).padStart(4, '0')}`;
      while (db.prepare('SELECT id FROM maintenance_requests WHERE ticket_number = ?').get(ticketNumber)) {
        nextNum++;
        ticketNumber = `OT-2026-${String(nextNum).padStart(4, '0')}`;
      }
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
  if (!d) return new Date().toISOString().slice(0, 10);
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
    const reportDate = normalizeDate((req.query.date as string) || new Date().toISOString().slice(0, 10));
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
    const operator = req.user?.fullName || operator_name || 'Operador Central';

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
          let nextNum = ((db.prepare('SELECT COUNT(*) as count FROM maintenance_requests').get() as { count: number }).count || 0) + 1;
          let ticketNumber = `OT-2026-${String(nextNum).padStart(4, '0')}`;
          while (db.prepare('SELECT id FROM maintenance_requests WHERE ticket_number = ?').get(ticketNumber)) {
            nextNum++;
            ticketNumber = `OT-2026-${String(nextNum).padStart(4, '0')}`;
          }

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
