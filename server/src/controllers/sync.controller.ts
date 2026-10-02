import { Request, Response } from 'express';
import { db } from '../database/db.js';

export interface SyncEventItem {
  entity: string;
  action: string;
  payload: any;
  timestamp: number;
}

export function upsertConnectedDevice(req: Request, deviceId?: string, userId?: string, username?: string, deviceName?: string) {
  try {
    if (!deviceId) return;
    let ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
             (req.headers['x-real-ip'] as string) || 
             req.ip || 
             req.socket.remoteAddress || 
             '127.0.0.1';

    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    } else if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    const rawUserAgent = (req.headers['user-agent'] || 'Basetrack Client').substring(0, 200);
    const userAgent = rawUserAgent.toLowerCase().startsWith('node') ? 'Node.js (API Client)' : rawUserAgent;
    const dName = deviceName || (req.headers['x-device-name'] as string) || (req.query['deviceName'] as string) || 'Terminal Operativa';
    const uName = username || (req as any).user?.username || null;
    const uId = userId || (req as any).user?.userId || null;

    db.prepare(`
      INSERT INTO connected_devices (device_id, device_name, user_id, username, ip_address, user_agent, last_seen, is_revoked)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)
      ON CONFLICT(device_id) DO UPDATE SET
        device_name = COALESCE(excluded.device_name, connected_devices.device_name),
        user_id = COALESCE(excluded.user_id, connected_devices.user_id),
        username = COALESCE(excluded.username, connected_devices.username),
        ip_address = excluded.ip_address,
        user_agent = excluded.user_agent,
        last_seen = datetime('now')
    `).run(deviceId, dName, uId, uName, ip, userAgent);
  } catch (e) {
    // Non-critical logging
  }
}

export async function pushEvents(req: Request, res: Response) {
  try {
    const { deviceId, userId, events, username, deviceName } = req.body as {
      deviceId: string;
      userId?: string;
      username?: string;
      deviceName?: string;
      events: SyncEventItem[];
    };

    if (!deviceId || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'deviceId y lista de eventos requeridos'
      });
    }

    if (events.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Lote de sincronización excede el límite máximo (máximo 500 eventos por petición)'
      });
    }

    const safeDeviceId = String(deviceId).slice(0, 100);
    const safeUserId = userId ? String(userId).slice(0, 100) : undefined;
    const safeUsername = username ? String(username).slice(0, 100) : undefined;
    const safeDeviceName = deviceName ? String(deviceName).slice(0, 150) : undefined;

    upsertConnectedDevice(req, safeDeviceId, safeUserId, safeUsername, safeDeviceName);

    const insertStmt = db.prepare(`
      INSERT INTO sync_events (device_id, user_id, entity, action, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN');
    let lastServerId = 0;
    try {
      for (const item of events) {
        let rawPayload = item.payload;
        if (rawPayload === undefined || rawPayload === null) {
          if ((item as any).data !== undefined) {
            rawPayload = { key: (item as any).key, data: (item as any).data };
          }
        }

        let payloadStr = '{}';
        if (rawPayload !== undefined && rawPayload !== null) {
          payloadStr = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
        }

        // Limit payload size to 500KB per event to prevent DB bloat/Denial of Service
        if (payloadStr.length > 500000) {
          payloadStr = JSON.stringify({ error: 'Payload size exceeded 500KB limit' });
        }

        const devId = safeDeviceId;
        const uId = safeUserId;
        const ent = String(item.entity || 'general').slice(0, 100);
        const act = String(item.action || 'UPDATE').slice(0, 50);
        const ts = Number(item.timestamp) || Date.now();

        const result = insertStmt.run(
          devId,
          uId || null,
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
    const username = (req.query['username'] as string) || '';
    const deviceName = (req.query['deviceName'] as string) || '';

    if (deviceId) {
      upsertConnectedDevice(req, deviceId, undefined, username, deviceName);
    }

    let query = `
      SELECT id, device_id, user_id, entity, action, payload, timestamp, created_at
      FROM sync_events
      WHERE id > ?
    `;
    const params: any[] = [sinceId];

    if (deviceId) {
      // Exclude events created by this device UNLESS it is a FORCE_LOGOUT action targeting devices
      query += ` AND (device_id != ? OR action = 'FORCE_LOGOUT')`;
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
