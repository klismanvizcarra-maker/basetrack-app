import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { db } from '../database/db.js';

export interface WsClientMeta {
  deviceId: string;
  deviceName: string;
  username?: string;
  userId?: string;
  ip: string;
  connectedAt: number;
  isAlive: boolean;
}

const clients = new Map<WebSocket, WsClientMeta>();
let wss: WebSocketServer | null = null;
let pingInterval: NodeJS.Timeout | null = null;

/**
 * Inicializa el servidor WebSocket de baja latencia acoplado al servidor HTTP de Express.
 */
export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: '/ws'
  });

  console.log('[WebSocket] Servidor de tiempo real inicializado en la ruta /ws');

  wss.on('connection', (ws: WebSocket, req) => {
    let ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
             req.socket.remoteAddress || 
             '127.0.0.1';
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    if (ip === '::1') ip = '127.0.0.1';

    const clientMeta: WsClientMeta = {
      deviceId: 'temp_' + Math.random().toString(36).substring(2, 9),
      deviceName: (req.headers['x-device-name'] as string) || 'Terminal Operativa',
      ip,
      connectedAt: Date.now(),
      isAlive: true
    };

    clients.set(ws, clientMeta);

    // Mensaje de bienvenida y sincronización inicial de reloj de faena
    ws.send(JSON.stringify({
      type: 'WELCOME',
      message: 'Conectado al servidor de tiempo real BASETRACK',
      serverTime: Date.now(),
      connectedClients: clients.size
    }));

    ws.on('pong', () => {
      clientMeta.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWsMessage(ws, clientMeta, msg);
      } catch (err) {
        console.warn('[WebSocket] Error parseando mensaje entrante:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket] Error en socket:', err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat cada 25 segundos para mantener el canal vivo a través de routers y firewalls
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (!wss) return;
    for (const [ws, meta] of clients.entries()) {
      if (!meta.isAlive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      meta.isAlive = false;
      ws.ping();
    }
  }, 25000);

  if (pingInterval.unref) {
    pingInterval.unref();
  }

  server.on('close', () => {
    closeWebSocketServer();
  });

  return wss;
}

/**
 * Cierra limpiamente el servidor WebSocket y libera intervalos.
 */
export function closeWebSocketServer(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  clients.clear();
}

function handleWsMessage(ws: WebSocket, meta: WsClientMeta, msg: any) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'REGISTER': {
      if (msg.deviceId) meta.deviceId = String(msg.deviceId).slice(0, 100);
      if (msg.deviceName) meta.deviceName = String(msg.deviceName).slice(0, 150);
      if (msg.username) meta.username = String(msg.username).slice(0, 100);
      if (msg.userId) meta.userId = String(msg.userId).slice(0, 100);

      try {
        db.prepare(`
          INSERT INTO connected_devices (device_id, device_name, user_id, username, ip_address, user_agent, last_seen, is_revoked)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)
          ON CONFLICT(device_id) DO UPDATE SET
            device_name = COALESCE(excluded.device_name, connected_devices.device_name),
            user_id = COALESCE(excluded.user_id, connected_devices.user_id),
            username = COALESCE(excluded.username, connected_devices.username),
            ip_address = excluded.ip_address,
            user_agent = 'WebSocket Client',
            last_seen = datetime('now')
        `).run(meta.deviceId, meta.deviceName, meta.userId || null, meta.username || null, meta.ip);
      } catch {
        // Ignorar error no crítico
      }

      ws.send(JSON.stringify({
        type: 'REGISTERED',
        deviceId: meta.deviceId,
        activeClients: clients.size,
        serverTime: Date.now()
      }));
      break;
    }

    case 'PING': {
      ws.send(JSON.stringify({ type: 'PONG', serverTime: Date.now() }));
      break;
    }

    case 'EVENT': {
      const ev = msg.event;
      if (ev) {
        try {
          const payloadStr = typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload || { key: ev.key, data: ev.data });
          db.prepare(`
            INSERT INTO sync_events (device_id, user_id, entity, action, payload, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            meta.deviceId,
            meta.userId || null,
            String(ev.entity || 'general').slice(0, 100),
            String(ev.action || 'UPDATE').slice(0, 50),
            payloadStr,
            Number(ev.timestamp) || Date.now()
          );
        } catch (e) {
          console.warn('[WebSocket] Error registrando evento en SQLite:', e);
        }

        // Reenviar instantáneamente a todas las demás terminales
        broadcastWsEvent({
          entity: ev.entity,
          action: ev.action,
          data: ev.data,
          key: ev.key,
          payload: ev.payload,
          deviceId: meta.deviceId,
          senderName: meta.deviceName
        });
      }
      break;
    }
  }
}

/**
 * Emite un evento a todas las terminales conectadas vía WebSocket.
 * Omite la terminal origen para prevenir bucles de eco.
 */
export function broadcastWsEvent(event: {
  entity: string;
  action: string;
  data?: any;
  key?: string;
  payload?: any;
  deviceId?: string;
  senderName?: string;
}): void {
  if (!wss || clients.size === 0) return;

  const payload = JSON.stringify({
    type: 'EVENT',
    event: {
      entity: event.entity,
      action: event.action,
      data: event.data !== undefined ? event.data : (event.payload?.data !== undefined ? event.payload.data : event.payload),
      key: event.key || event.payload?.key,
      payload: event.payload,
      deviceId: event.deviceId,
      senderName: event.senderName,
      timestamp: Date.now()
    }
  });

  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      if (event.deviceId && meta.deviceId === event.deviceId) {
        continue;
      }
      try {
        ws.send(payload);
      } catch (err) {
        console.warn(`[WebSocket] Error enviando a cliente ${meta.deviceId}:`, err);
      }
    }
  }
}

/**
 * Retorna el número de terminales actualmente en línea por WebSocket.
 */
export function getConnectedWsClientsCount(): number {
  return clients.size;
}
