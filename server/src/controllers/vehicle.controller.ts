import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, seedDefaultVehicles } from '../database/db.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../middlewares/error.middleware.js';
import { broadcastWsEvent } from '../websocket/ws.js';

export const OFFICIAL_VEHICLES = [
  { plate: 'BMC715', tag: 'CAM-01', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Supervisión de Operaciones', baseOdometer: 48250 },
  { plate: 'BKS921', tag: 'CAM-02', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Operaciones Bombas / Molienda', baseOdometer: 53120 },
  { plate: 'BKS913', tag: 'CAM-03', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Operaciones Ciclones / Planta', baseOdometer: 39800 },
  { plate: 'BPS747', tag: 'CAM-04', model: 'Toyota Hilux 4x4 Turbodiésel', color: 'Blanco Industrial', area: 'Presa de Relaves / Auxiliares', baseOdometer: 61400 }
];

/**
 * Returns dynamic summary of vehicles with latest inspection and odometer.
 * If query ?includeInactive=true, includes decommissioned trucks.
 * Default: returns only active vehicles (is_active = 1).
 */
export function getVehiclesSummary(req: Request, res: Response) {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.all === 'true';
    const query = includeInactive
      ? 'SELECT * FROM vehicles ORDER BY tag ASC, plate ASC'
      : 'SELECT * FROM vehicles WHERE is_active = 1 ORDER BY tag ASC, plate ASC';

    let dbVehicles = db.prepare(query).all() as any[];
    if (dbVehicles.length === 0 && !includeInactive) {
      seedDefaultVehicles();
      dbVehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1 ORDER BY tag ASC, plate ASC').all() as any[];
    }

    const summary = dbVehicles.map(veh => {
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

      const baseOdo = Number(veh.base_odometer) || 0;
      const latestOdo = latest ? Number(latest.odometer) || 0 : baseOdo;

      return {
        id: veh.id,
        plate: veh.plate,
        tag: veh.tag,
        model: veh.model,
        color: veh.color,
        area: veh.area,
        baseOdometer: baseOdo,
        currentOdometer: Math.max(latestOdo, baseOdo),
        lastChecklistDate: latest ? latest.date : null,
        lastChecklistTime: latest ? latest.time : null,
        lastDriverName: latest ? latest.driver_name : null,
        lastOperationalStatus: latest ? latest.operational_status : 'APTO',
        totalChecklists,
        is_active: veh.is_active !== undefined ? (veh.is_active ? 1 : 0) : 1,
        created_at: veh.created_at,
        updated_at: veh.updated_at
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

/**
 * Returns all vehicles for Admin management (active + decommissioned)
 */
export function getAllVehicles(req: Request, res: Response) {
  // Delegate to getVehiclesSummary with includeInactive
  req.query.includeInactive = 'true';
  return getVehiclesSummary(req, res);
}

/**
 * Creates a new vehicle in the mining fleet padrón (Admin only)
 */
export function createVehicle(req: AuthenticatedRequest, res: Response) {
  try {
    const { plate, tag, model, color, area, baseOdometer, is_active } = req.body;

    const rawPlate = (plate || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!rawPlate || rawPlate.length < 3 || rawPlate.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'La placa vehicular es obligatoria y debe tener entre 3 y 10 caracteres alfanuméricos.'
      });
    }

    // Check uniqueness
    const exists = db.prepare('SELECT id, plate FROM vehicles WHERE plate = ?').get(rawPlate) as any;
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `La placa ${rawPlate} ya se encuentra registrada en el padrón de camionetas.`
      });
    }

    const cleanTag = (tag || '').toUpperCase().trim() || `CAM-${Math.floor(Math.random() * 90 + 10)}`;
    const cleanModel = (model || '').trim() || 'Toyota Hilux 4x4 Turbodiésel';
    const cleanColor = (color || '').trim() || 'Blanco Industrial';
    const cleanArea = (area || '').trim() || 'Supervisión de Operaciones';
    const cleanOdo = Math.max(0, Number(baseOdometer) || 0);
    const activeFlag = (is_active === false || is_active === 0) ? 0 : 1;

    const id = `veh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    db.prepare(`
      INSERT INTO vehicles (id, plate, tag, model, color, area, base_odometer, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, rawPlate, cleanTag, cleanModel, cleanColor, cleanArea, cleanOdo, activeFlag);

    const newVehicle = {
      id,
      plate: rawPlate,
      tag: cleanTag,
      model: cleanModel,
      color: cleanColor,
      area: cleanArea,
      baseOdometer: cleanOdo,
      currentOdometer: cleanOdo,
      lastChecklistDate: null,
      lastChecklistTime: null,
      lastDriverName: null,
      lastOperationalStatus: 'APTO',
      totalChecklists: 0,
      is_active: activeFlag
    };

    broadcastWsEvent({
      entity: 'vehicles',
      action: 'CREATE',
      data: newVehicle,
      key: 'basetrack_vehicles',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: req.user?.username || 'Administrador'
    });

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'Administrador',
      'CREATE',
      'VEHICLES',
      id,
      `Alta de camioneta ${rawPlate} (${cleanTag}) - Área: ${cleanArea}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({
      success: true,
      message: `Camioneta ${rawPlate} (${cleanTag}) dada de alta exitosamente en el padrón`,
      data: newVehicle
    });
  } catch (error: any) {
    console.error('[VehicleController] Error creating vehicle:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Updates vehicle metadata and plate (Admin only).
 * If plate is modified, cascades the plate change to vehicle_checklists table
 * so historical inspection records are not lost.
 */
export function updateVehicle(req: AuthenticatedRequest, res: Response) {
  try {
    const idOrPlate = String(req.params.id);
    const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? OR plate = ?').get(idOrPlate, idOrPlate) as any;

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Camioneta ${idOrPlate} no encontrada en el padrón.`
      });
    }

    const { plate, tag, model, color, area, baseOdometer, is_active } = req.body;
    const newPlate = plate ? (plate || '').toUpperCase().replace(/\s+/g, '').trim() : existing.plate;

    if (newPlate !== existing.plate) {
      // Ensure new plate is not taken by another vehicle
      const duplicate = db.prepare('SELECT id FROM vehicles WHERE plate = ? AND id != ?').get(newPlate, existing.id) as any;
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `La placa ${newPlate} ya está asignada a otra camioneta en el padrón.`
        });
      }

      // Cascade update to checklists
      db.prepare('UPDATE vehicle_checklists SET vehicle_plate = ? WHERE vehicle_plate = ?').run(newPlate, existing.plate);
    }

    const newTag = tag !== undefined ? String(tag).toUpperCase().trim() : existing.tag;
    const newModel = model !== undefined ? String(model).trim() : existing.model;
    const newColor = color !== undefined ? String(color).trim() : existing.color;
    const newArea = area !== undefined ? String(area).trim() : existing.area;
    const newBaseOdo = baseOdometer !== undefined ? Math.max(0, Number(baseOdometer) || 0) : existing.base_odometer;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    db.prepare(`
      UPDATE vehicles
      SET plate = ?, tag = ?, model = ?, color = ?, area = ?, base_odometer = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newPlate, newTag, newModel, newColor, newArea, newBaseOdo, newActive, existing.id);

    const updated = {
      ...existing,
      plate: newPlate,
      tag: newTag,
      model: newModel,
      color: newColor,
      area: newArea,
      baseOdometer: newBaseOdo,
      is_active: newActive
    };

    broadcastWsEvent({
      entity: 'vehicles',
      action: 'UPDATE',
      data: updated,
      key: 'basetrack_vehicles',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: req.user?.username || 'Administrador'
    });

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'Administrador',
      'UPDATE',
      'VEHICLES',
      existing.id,
      `Actualización de camioneta ${newPlate} (${newTag}) - Placa anterior: ${existing.plate}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Datos de la camioneta ${newPlate} actualizados exitosamente`,
      data: updated
    });
  } catch (error: any) {
    console.error('[VehicleController] Error updating vehicle:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Toggles vehicle operational status (Dar de Alta / Dar de Baja)
 */
export function toggleVehicleStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const idOrPlate = String(req.params.id);
    const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? OR plate = ?').get(idOrPlate, idOrPlate) as any;

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Camioneta no encontrada' });
    }

    const currentStatus = Boolean(existing.is_active);
    const newStatus = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : (currentStatus ? 0 : 1);

    db.prepare('UPDATE vehicles SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newStatus, existing.id);

    const actionText = newStatus === 1 ? 'Reactivada (Alta)' : 'Dada de baja';

    broadcastWsEvent({
      entity: 'vehicles',
      action: 'UPDATE',
      data: { id: existing.id, plate: existing.plate, is_active: newStatus },
      key: 'basetrack_vehicles',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: req.user?.username || 'Administrador'
    });

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'Administrador',
      'STATUS_CHANGE',
      'VEHICLES',
      existing.id,
      `${actionText} en padrón: Camioneta ${existing.plate} (${existing.tag})`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Camioneta ${existing.plate} ${actionText.toLowerCase()} exitosamente`,
      is_active: newStatus
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Deletes vehicle or decommissions it if it has historical checklists
 */
export function deleteVehicle(req: AuthenticatedRequest, res: Response) {
  try {
    const idOrPlate = String(req.params.id);
    const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? OR plate = ?').get(idOrPlate, idOrPlate) as any;

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Camioneta no encontrada' });
    }

    const checklistCount = (db.prepare('SELECT COUNT(*) as count FROM vehicle_checklists WHERE vehicle_plate = ?').get(existing.plate) as any)?.count || 0;

    if (checklistCount > 0) {
      // Soft delete (Dar de baja) to preserve audit and safety records
      db.prepare('UPDATE vehicles SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(existing.id);

      broadcastWsEvent({
        entity: 'vehicles',
        action: 'UPDATE',
        data: { id: existing.id, plate: existing.plate, is_active: 0 },
        key: 'basetrack_vehicles',
        deviceId: req.headers['x-device-id']?.toString() || 'server_api'
      });

      return res.json({
        success: true,
        message: `La camioneta ${existing.plate} registra ${checklistCount} inspección(es) histórica(s). Ha sido dada de baja del padrón activo para preservar la trazabilidad minera.`,
        decommissioned: true,
        is_active: 0
      });
    }

    // Hard delete since it has 0 checklists
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(existing.id);

    broadcastWsEvent({
      entity: 'vehicles',
      action: 'DELETE',
      data: { id: existing.id, plate: existing.plate },
      key: 'basetrack_vehicles',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api'
    });

    logAudit(
      req.user?.userId || null,
      req.user?.username || 'Administrador',
      'DELETE',
      'VEHICLES',
      existing.id,
      `Eliminación física de camioneta sin historial: ${existing.plate} (${existing.tag})`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Camioneta ${existing.plate} eliminada definitivamente del padrón.`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export function getVehicleChecklists(req: Request, res: Response) {
  try {
    const plate = (req.query.plate as string || '').toUpperCase().trim();

    if (plate) {
      const existsInVehicles = db.prepare('SELECT 1 FROM vehicles WHERE plate = ?').get(plate);
      const existsInChecklists = db.prepare('SELECT 1 FROM vehicle_checklists WHERE vehicle_plate = ?').get(plate);
      if (!existsInVehicles && !existsInChecklists) {
        return res.status(400).json({
          success: false,
          message: `Placa ${plate} no permitida o no registrada en el sistema.`
        });
      }
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

    // Parse items_json & deduplicate by logical key (plate, date, time, odometer, dni)
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (const r of rows) {
      const key = `${r.vehicle_plate}_${r.date}_${r.time}_${r.odometer}_${r.driver_dni}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduplicated.push({
        ...r,
        items: typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json
      });
    }

    return res.json({
      success: true,
      count: deduplicated.length,
      data: deduplicated
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

    // Validate plate against active vehicles in database
    const veh = db.prepare('SELECT plate, is_active FROM vehicles WHERE plate = ?').get(plate) as any;
    if (!veh || veh.is_active !== 1) {
      const activePlates = (db.prepare('SELECT plate FROM vehicles WHERE is_active = 1').all() as any[]).map(v => v.plate);
      return res.status(400).json({
        success: false,
        message: `Placa vehicular inválida (${plate}) o no autorizada en el padrón activo. Solo se permite inspeccionar camionetas activas: ${activePlates.join(', ')}.`
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

    if (photo_url && typeof photo_url === 'string' && photo_url.length > 3 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'La fotografía adjunta no debe exceder los 3MB.'
      });
    }

    const requestedId = (req.body.id && typeof req.body.id === 'string' && req.body.id.trim()) 
      ? req.body.id.trim() 
      : null;

    // Idempotency & anti-duplicate guard: detect if identical checklist was already registered
    const existing = db.prepare(`
      SELECT id FROM vehicle_checklists 
      WHERE (id = ?) OR (vehicle_plate = ? AND date = ? AND time = ? AND driver_dni = ? AND odometer = ?)
    `).get(requestedId || '', plate, checkDate, checkTime, driver_dni, odoNum) as any;

    if (existing) {
      return res.status(200).json({
        success: true,
        message: `Checklist pre-uso para camioneta ${plate} ya registrado previamente`,
        id: existing.id
      });
    }

    const id = requestedId || crypto.randomUUID();
    const itemsJson = typeof items === 'string' ? items : JSON.stringify(items || []);

    if (itemsJson.length > 200000) {
      return res.status(400).json({
        success: false,
        message: 'El detalle de items inspeccionados excede el tamaño máximo permitido.'
      });
    }

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

    broadcastWsEvent({
      entity: 'vehicle_checklists',
      action: 'CREATE',
      data: { id, vehicle_plate: plate, date: checkDate, time: checkTime, driver_name, odometer: odoNum, operational_status: validStatus },
      key: 'basetrack_vehicle_checklists',
      deviceId: req.headers['x-device-id']?.toString() || 'server_api',
      senderName: driver_name
    });

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
