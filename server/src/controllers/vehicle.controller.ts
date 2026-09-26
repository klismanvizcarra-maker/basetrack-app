import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';

export const OFFICIAL_VEHICLES = [
  { plate: 'BMC715', tag: 'CAM-01', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Supervisión de Operaciones', baseOdometer: 48250 },
  { plate: 'BKS921', tag: 'CAM-02', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Operaciones Bombas / Molienda', baseOdometer: 53120 },
  { plate: 'BKS913', tag: 'CAM-03', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Operaciones Ciclones / Planta', baseOdometer: 39800 },
  { plate: 'BPS747', tag: 'CAM-04', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Presa de Relaves / Auxiliares', baseOdometer: 61400 }
];

const VALID_PLATES = OFFICIAL_VEHICLES.map(v => v.plate);

export function getVehiclesSummary(req: Request, res: Response) {
  try {
    const summary = OFFICIAL_VEHICLES.map(veh => {
      const latest = db.prepare(`
        SELECT id, date, time, shift, shift_type, driver_name, odometer, operational_status, has_observations, created_at
        FROM vehicle_checklists
        WHERE vehicle_plate = ?
        ORDER BY date DESC, time DESC, created_at DESC
        LIMIT 1
      `).get(veh.plate) as any;

      const totalChecklists = (db.prepare(`
        SELECT COUNT(*) as count FROM vehicle_checklists WHERE vehicle_plate = ?
      `).get(veh.plate) as any)?.count || 0;

      return {
        ...veh,
        currentOdometer: latest ? latest.odometer : veh.baseOdometer,
        lastChecklistDate: latest ? latest.date : null,
        lastChecklistTime: latest ? latest.time : null,
        lastDriverName: latest ? latest.driver_name : null,
        lastOperationalStatus: latest ? latest.operational_status : 'APTO',
        totalChecklists
      };
    });

    return res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getVehicleChecklists(req: Request, res: Response) {
  try {
    const plate = (req.query.plate as string || '').toUpperCase().trim();

    if (plate && !VALID_PLATES.includes(plate)) {
      return res.status(400).json({
        success: false,
        message: `Placa ${plate} no permitida. Solo se autorizan las 4 camionetas oficiales: ${VALID_PLATES.join(', ')}`
      });
    }

    let query = 'SELECT * FROM vehicle_checklists';
    const params: any[] = [];

    if (plate) {
      query += ' WHERE vehicle_plate = ? ORDER BY date DESC, time DESC, created_at DESC';
      params.push(plate);
    } else {
      query += ' ORDER BY date DESC, time DESC, created_at DESC LIMIT 100';
    }

    const rows = db.prepare(query).all(...params) as any[];

    // Parse items_json
    const parsed = rows.map(r => ({
      ...r,
      items: typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json
    }));

    return res.json({
      success: true,
      count: parsed.length,
      data: parsed
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function createVehicleChecklist(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      vehicle_plate,
      date,
      time,
      shift,
      shift_type,
      driver_name,
      driver_dni,
      driver_license,
      odometer,
      items,
      has_observations,
      observation_notes,
      photo_url,
      operational_status
    } = req.body;

    const plate = (vehicle_plate || '').toUpperCase().trim();
    if (!VALID_PLATES.includes(plate)) {
      return res.status(400).json({
        success: false,
        message: `Placa vehicular inválida (${plate}). Solo se permite inspeccionar las 4 camionetas autorizadas: ${VALID_PLATES.join(', ')}.`
      });
    }

    if (!driver_name || !driver_dni) {
      return res.status(400).json({
        success: false,
        message: 'El nombre completo del conductor y DNI son campos obligatorios.'
      });
    }

    const odoNum = Number(odometer);
    if (isNaN(odoNum) || odoNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El odómetro / kilometraje debe ser un número positivo válido.'
      });
    }

    const validShift = ['G1', 'G2', 'G3', 'G4'].includes(shift) ? shift : 'G1';
    const validShiftType = shift_type === 'NOCHE' ? 'NOCHE' : 'DIA';
    const validStatus = ['APTO', 'OBSERVADO', 'NO_APTO'].includes(operational_status) ? operational_status : 'APTO';
    const checkDate = date || new Date().toISOString().slice(0, 10);
    const checkTime = time || new Date().toTimeString().slice(0, 5);

    const id = crypto.randomUUID();
    const itemsJson = typeof items === 'string' ? items : JSON.stringify(items || []);

    db.prepare(`
      INSERT INTO vehicle_checklists (
        id, vehicle_plate, date, time, shift, shift_type,
        driver_name, driver_dni, driver_license, odometer, items_json,
        has_observations, observation_notes, photo_url, operational_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, plate, checkDate, checkTime, validShift, validShiftType,
      driver_name, driver_dni, driver_license || null, odoNum, itemsJson,
      has_observations ? 1 : 0, observation_notes || null, photo_url || null, validStatus
    );

    // Broadcast sync event for cross-terminal realtime sync
    try {
      db.prepare(`
        INSERT INTO sync_events (device_id, user_id, entity, action, payload, timestamp)
        VALUES (?, ?, 'vehicle_checklists', 'CREATE', ?, ?)
      `).run(
        req.headers['x-device-id']?.toString() || 'server_api',
        req.user?.userId || null,
        JSON.stringify({ id, plate, date: checkDate, driver_name, operational_status: validStatus }),
        Date.now()
      );
    } catch (e) {
      // Ignore sync event failure if table locked
    }

    logAudit(
      req.user?.userId || null,
      req.user?.username || driver_name,
      'CREATE',
      'VEHICLE_CHECKLIST',
      id,
      `Checklist pre-uso camioneta ${plate} - Odómetro: ${odoNum} km - Estado: ${validStatus}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({
      success: true,
      message: `Checklist pre-uso para camioneta ${plate} registrado exitosamente`,
      id
    });
  } catch (error: any) {
    console.error('[VehicleController] Error registering checklist:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
