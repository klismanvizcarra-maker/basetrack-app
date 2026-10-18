import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { db } from '../database/db.js';
import { verifyToken } from '../config/jwt.js';
import { sanitizeSyncEvent } from '../utils/strip-secrets.js';
import { isDeviceRevoked, isTokenVersionStale } from '../middlewares/auth.middleware.js';

/** Código de cierre de aplicación (rango 4000-4999) para sesiones revocadas o suspendidas */
export const WS_CLOSE_SESSION_REVOKED = 4001;

/**
 * Acciones de sistema que solo puede originar el servidor o un ADMIN.
 * Un cliente común no debe poder forzar cierres de sesión ni recargas globales.
 */
const RESERVED_SYNC_ACTIONS = new Set(['FORCE_LOGOUT', 'APP_UPDATE', 'FORCE_REFRESH']);

export function isReservedSyncAction(action: unknown): boolean {
  return RESERVED_SYNC_ACTIONS.has(String(action || '').toUpperCase());
}

export interface WsClientMeta {
  deviceId: string;
  deviceName: string;
  username?: string;
  userId?: string;
  role?: string;
  /** true solo después de un REGISTER con JWT válido; antes no recibe ni emite eventos */
  authenticated: boolean;
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
    path: '/ws',
    // Mismo tope que /sync/push (500 KB por evento): el valor por defecto de ws es 100 MiB
    maxPayload: 1024 * 1024
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
      authenticated: false,
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
      // La identidad se toma exclusivamente del JWT; sin token válido el socket queda sin privilegios
      let decoded: ReturnType<typeof verifyToken> | null = null;
      try {
        decoded = msg.token ? verifyToken(String(msg.token)) : null;
        if (decoded?.userId) {
          const userRow = db.prepare('SELECT is_active, must_change_password, token_version FROM users WHERE id = ?').get(decoded.userId) as { is_active?: number; must_change_password?: number; token_version?: number } | undefined;
          if (userRow && (userRow.is_active === 0 || userRow.must_change_password === 1 || isTokenVersionStale(decoded, userRow.token_version))) decoded = null;
        }
        // Una terminal revocada no se re-registra hasta que su usuario vuelva a iniciar sesión
        if (decoded && msg.deviceId && isDeviceRevoked(String(msg.deviceId).slice(0, 100))) decoded = null;
      } catch {
        decoded = null;
      }

      if (!decoded) {
        meta.authenticated = false;
        ws.send(JSON.stringify({ type: 'UNAUTHORIZED', message: 'Token requerido para el canal de tiempo real' }));
        break;
      }

      meta.authenticated = true;
      meta.userId = decoded.userId;
      meta.username = decoded.username;
      meta.role = decoded.role;
      if (msg.deviceId) meta.deviceId = String(msg.deviceId).slice(0, 100);
      if (msg.deviceName) meta.deviceName = String(msg.deviceName).slice(0, 150);

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
      // Nunca almacenar ni difundir contraseñas que un cliente incluya en una caché sincronizada
      const ev = msg.event && typeof msg.event === 'object' ? sanitizeSyncEvent(msg.event) : msg.event;
      if (!meta.authenticated) {
        ws.send(JSON.stringify({ type: 'UNAUTHORIZED', message: 'Registre el dispositivo con un token válido antes de emitir eventos' }));
        break;
      }
      if (ev && isReservedSyncAction(ev.action) && meta.role !== 'ADMIN') {
        ws.send(JSON.stringify({ type: 'FORBIDDEN', message: 'Acción de sincronización reservada para el Administrador' }));
        break;
      }
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
    if (ws.readyState === WebSocket.OPEN && meta.authenticated) {
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
 * Cierra desde el servidor los sockets de un usuario y/o de una terminal (revocación o suspensión).
 * No depende de que el cliente respete FORCE_LOGOUT: se le avisa y luego se corta el canal.
 * Retorna cuántos sockets se cerraron.
 */
export function disconnectWsClients(target: { userId?: string; deviceId?: string }, reason: string, exceptDeviceId?: string): number {
  if (!target.userId && !target.deviceId) return 0;
  let closed = 0;
  for (const [ws, meta] of clients.entries()) {
    if (exceptDeviceId && meta.deviceId === exceptDeviceId) continue;
    const matchesUser = !!target.userId && meta.userId === target.userId;
    const matchesDevice = !!target.deviceId && meta.deviceId === target.deviceId;
    if (!matchesUser && !matchesDevice) continue;

    // Retirar privilegios de inmediato: ningún evento más llega a este socket aunque el cierre tarde
    meta.authenticated = false;
    clients.delete(ws);
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'EVENT',
          event: { entity: 'AUTH', action: 'FORCE_LOGOUT', payload: { deviceId: meta.deviceId, reason }, timestamp: Date.now() }
        }));
      }
      ws.close(WS_CLOSE_SESSION_REVOKED, reason.slice(0, 120));
    } catch {
      ws.terminate();
    }
    closed++;
  }
  return closed;
}

/**
 * Retorna el número de terminales actualmente en línea por WebSocket.
 */
export function getConnectedWsClientsCount(): number {
  return clients.size;
}
