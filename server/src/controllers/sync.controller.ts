import { Request, Response } from 'express';
import { db } from '../database/db.js';

export interface SyncEventItem {
  entity: string;
  action: string;
  payload: any;
  timestamp: number;
}

export async function pushEvents(req: Request, res: Response) {
  try {
    const { deviceId, userId, events } = req.body as {
      deviceId: string;
      userId?: string;
      events: SyncEventItem[];
    };

    if (!deviceId || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'deviceId y lista de eventos requeridos'
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO sync_events (device_id, user_id, entity, action, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN');
    let lastServerId = 0;
    try {
      for (const item of events) {
        let payloadStr = '{}';
        if (item.payload !== undefined && item.payload !== null) {
          payloadStr = typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload);
        }

        const devId = String(deviceId || 'unknown_device');
        const uId = userId ? String(userId) : null;
        const ent = String(item.entity || 'general');
        const act = String(item.action || 'UPDATE');
        const ts = Number(item.timestamp) || Date.now();

        const result = insertStmt.run(
          devId,
          uId,
          ent,
          act,
          payloadStr,
          ts
        ) as any;
        lastServerId = Number(result?.lastInsertRowid || lastServerId + 1);
      }
      db.exec('COMMIT');
    } catch (txError) {
      db.exec('ROLLBACK');
      throw txError;
    }

    return res.json({
      success: true,
      message: `${events.length} eventos sincronizados con éxito`,
      processedCount: events.length,
      lastServerId
    });
  } catch (error: any) {
    console.error('[SyncController] Error al procesar push:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar eventos de sincronización',
      error: error.message
    });
  }
}

export async function pullEvents(req: Request, res: Response) {
  try {
    const sinceId = Number(req.query['sinceId']) || 0;
    const deviceId = (req.query['deviceId'] as string) || '';

    let query = `
      SELECT id, device_id, user_id, entity, action, payload, timestamp, created_at
      FROM sync_events
      WHERE id > ?
    `;
    const params: any[] = [sinceId];

    if (deviceId) {
      query += ` AND device_id != ?`;
      params.push(deviceId);
    }

    query += ` ORDER BY id ASC LIMIT 200`;

    const rows = db.prepare(query).all(...params) as any[];

    const events = rows.map(r => {
      let parsed = r.payload;
      try {
        parsed = JSON.parse(r.payload);
      } catch {
        // Leave as string if not JSON
      }
      return {
        id: r.id,
        deviceId: r.device_id,
        userId: r.user_id,
        entity: r.entity,
        action: r.action,
        payload: parsed,
        timestamp: r.timestamp,
        createdAt: r.created_at
      };
    });

    const latestRow = db.prepare('SELECT MAX(id) as maxId FROM sync_events').get() as any;
    const latestId = latestRow?.maxId || 0;

    return res.json({
      success: true,
      events,
      latestId,
      serverTime: Date.now()
    });
  } catch (error: any) {
    console.error('[SyncController] Error al procesar pull:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener eventos de sincronización',
      error: error.message
    });
  }
}

export async function getSyncStatus(req: Request, res: Response) {
  try {
    const totalEventsRow = db.prepare('SELECT COUNT(*) as count, MAX(id) as latestId, MAX(timestamp) as lastTimestamp FROM sync_events').get() as any;
    const devicesRow = db.prepare('SELECT COUNT(DISTINCT device_id) as deviceCount FROM sync_events').get() as any;

    return res.json({
      success: true,
      status: 'ONLINE',
      totalEvents: totalEventsRow?.count || 0,
      latestId: totalEventsRow?.latestId || 0,
      lastSyncTimestamp: totalEventsRow?.lastTimestamp || null,
      activeDevices: devicesRow?.deviceCount || 0,
      serverTime: Date.now()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar estado de sincronización',
      error: error.message
    });
  }
}
