import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, timeout } from 'rxjs';
import { getRealtimeData, saveRealtimeData, isDeviceLocalKey } from '../storage/local-store.util';

export interface SyncEventPayload {
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CHECKIN' | 'SET';
  key?: string;
  data: any;
  payload?: any;
  timestamp: number;
}

export type SyncState = 'ONLINE' | 'SYNCING' | 'OFFLINE' | 'LOCAL';

import { getApiBaseUrl, DEFAULT_CLOUD_BACKEND_URL } from '../constants/api.config';
import { BUILD_TIME } from '../constants/build-info';

@Injectable({
  providedIn: 'root'
})
export class CloudSyncService {
  private http = inject(HttpClient);
  private get apiUrl(): string {
    return `${getApiBaseUrl()}/sync`;
  }

  // Signals for reactive UI
  public syncStatus = signal<SyncState>('ONLINE');
  public lastSyncTime = signal<Date | null>(new Date());
  public pendingCount = signal<number>(0);
  public activeDevicesCount = signal<number>(1);
  public lastSyncedEntity = signal<string>('Inicializado');
  public isWsConnected = signal<boolean>(false);
  public wsLatencyMs = signal<number | null>(null);

  // Computed properties
  public isOnline = computed(() => this.syncStatus() === 'ONLINE' || this.syncStatus() === 'SYNCING');
  public isSyncing = computed(() => this.syncStatus() === 'SYNCING');

  // Device Identifier
  public readonly deviceId: string;
  public readonly deviceName: string;

  // Cross-tab / Cross-window BroadcastChannel
  private broadcastChannel?: BroadcastChannel;
  private lastServerId = 0;
  private pollingTimer?: any;
  private keepAliveTimer?: any;
  private isProcessingQueue = false;

  // WebSocket real-time connection state
  private ws?: WebSocket;
  private wsReconnectTimer?: any;
  private wsPingTimer?: any;
  private wsReconnectAttempts = 0;
  private isWsIntentionalClose = false;
  private syncTick = 0;

  constructor() {
    this.deviceId = this.initDeviceId();
    this.deviceName = this.initDeviceName();
    this.lastServerId = getRealtimeData<number>('sync_last_server_id', 0);
    this.updatePendingCount();

    // 1. Setup BroadcastChannel for instant local multi-device/multi-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('basetrack_realtime_sync');
        this.broadcastChannel.onmessage = (msgEvent) => {
          this.handleBroadcastMessage(msgEvent.data);
        };
      } catch (err) {
        console.warn('[CloudSync] BroadcastChannel no soportado en este entorno:', err);
      }
    }

    // 2. Setup browser network listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onNetworkOnline());
      window.addEventListener('offline', () => this.onNetworkOffline());
      window.addEventListener('focus', () => this.forceSync());

      // Listen to local changes to automatically broadcast across tabs/cloud
      window.addEventListener('basetrack_local_change', (e: any) => {
        const detail = e.detail;
        // Un nuevo inicio de sesión re-registra el socket con el token vigente (nunca se replica el token)
        if (detail?.key === 'basetrack_token' && detail.data) {
          this.registerWithServer();
          this.forceSync();
        }
        if (detail && detail.key && !isDeviceLocalKey(detail.key) && !detail.skipBroadcast) {
          const entity = detail.key.replace('basetrack_', '');
          this.broadcastChange(entity, 'SET', detail.data, detail.key);
        }
      });
    }

    // 3. Connect real-time WebSocket, initial sync, periodic sync, and background keep-alive
    setTimeout(() => {
      this.connectWebSocket();
      this.forceSync();
      this.startPeriodicSync();
      this.startKeepAlive();
    }, 1200);
  }

  private initDeviceId(): string {
    let id = getRealtimeData<string | null>('device_id', null);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      saveRealtimeData('device_id', id, { skipBroadcast: true });
    }
    return id;
  }

  private initDeviceName(): string {
    const stored = getRealtimeData<string | null>('device_name', null);
    if (stored) return stored;

    let defaultName = 'Estación Planta';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/Android/i.test(ua)) defaultName = 'Móvil Android Planta';
      else if (/iPhone|iPad/i.test(ua)) defaultName = 'Terminal iOS Planta';
      else if (/Windows/i.test(ua)) defaultName = 'PC Sala de Control';
      else if (/Macintosh/i.test(ua)) defaultName = 'Terminal Mac Planta';
    }
    saveRealtimeData('device_name', defaultName, { skipBroadcast: true });
    return defaultName;
  }

  /**
   * Broadcast a mutation across tabs and replicate instantly over WebSocket/Cloud
   */
  public broadcastChange(entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CHECKIN' | 'SET', data: any, storageKey?: string): void {
    const eventItem: SyncEventPayload = {
      entity,
      action,
      key: storageKey,
      data,
      payload: { key: storageKey, data },
      timestamp: Date.now()
    };

    // 1. Post to local BroadcastChannel (instant multi-tab sync)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          senderId: this.deviceId,
          senderName: this.deviceName,
          event: eventItem
        });
      } catch (e) {
        // Silently catch broadcast error
      }
    }

    // 2. Transmit via WebSocket immediately if connected (< 20ms across LAN/Internet)
    let deliveredViaWs = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'EVENT',
          event: {
            ...eventItem,
            deviceId: this.deviceId,
            deviceName: this.deviceName
          }
        }));
        deliveredViaWs = true;
        this.lastSyncTime.set(new Date());
      } catch (err) {
        console.warn('[CloudSync] Falló transmisión por WebSocket, recurriendo a cola HTTP:', err);
      }
    }

    // 3. If offline or WebSocket wasn't available, persist to SQLite sync queue for HTTP flush
    if (!deliveredViaWs) {
      this.enqueueEvent(eventItem);
      if (navigator.onLine) {
        this.flushQueue();
      }
    }
  }

  private enqueueEvent(event: SyncEventPayload): void {
    const queue = getRealtimeData<SyncEventPayload[]>('sync_queue', []);
    if (queue.length >= 100) {
      queue.shift();
    }
    queue.push(event);
    saveRealtimeData('sync_queue', queue, { skipBroadcast: true });
    this.updatePendingCount();
  }

  private updatePendingCount(): void {
    const queue = getRealtimeData<SyncEventPayload[]>('sync_queue', []);
    this.pendingCount.set(queue.length);
  }

  /**
   * Push pending queued items to the server
   */
  public flushQueue(): void {
    if (this.isProcessingQueue) return;
    // Sin sesión el backend rechaza el push (401); la cola se conserva hasta el próximo login
    if (!this.getSessionToken()) return;
    let queue = getRealtimeData<SyncEventPayload[]>('sync_queue', []);
    if (!Array.isArray(queue) || queue.length === 0) return;

    // Safety defense: If queue is large, deduplicate and cap at 50 items
    if (queue.length > 50) {
      const seen = new Map<string, SyncEventPayload>();
      for (const item of queue) {
        const itemKey = (item.entity || '') + ':' + (item.action || '') + ':' + (item.key || '');
        seen.set(itemKey, item);
      }
      queue = Array.from(seen.values()).slice(-50);
      saveRealtimeData('sync_queue', queue, { skipBroadcast: true });
      this.updatePendingCount();
    }

    this.isProcessingQueue = true;
    this.syncStatus.set('SYNCING');

    const user = getRealtimeData<any>('user', null);
    const payload = {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      username: user?.username || null,
      events: queue
    };

    this.http.post<any>(`${this.apiUrl}/push`, payload).pipe(
      timeout(5000),
      catchError(err => {
        // Fallback for pure Vercel static mode
        this.syncStatus.set(navigator.onLine ? 'ONLINE' : 'OFFLINE');
        this.isProcessingQueue = false;
        // If server rejected with 400 (e.g. malformed or oversized batch), purge corrupt queue
        if (err?.status === 400) {
          console.warn('[CloudSync] Servidor rechazó lote con 400, descartando lote inválido:', err);
          saveRealtimeData('sync_queue', [], { skipBroadcast: true });
          this.updatePendingCount();
        }
        return of(null);
      })
    ).subscribe(res => {
      this.isProcessingQueue = false;
      if (res && res.success) {
        // Queue successfully pushed
        saveRealtimeData('sync_queue', [], { skipBroadcast: true });
        this.updatePendingCount();
        this.syncStatus.set('ONLINE');
        this.lastSyncTime.set(new Date());
        if (res.lastServerId) {
          this.lastServerId = res.lastServerId;
          saveRealtimeData('sync_last_server_id', this.lastServerId, { skipBroadcast: true });
        }
      } else {
        this.syncStatus.set(navigator.onLine ? 'ONLINE' : 'OFFLINE');
      }
    });
  }

  /**
   * Pull new updates published by other devices
   */
  public pullRemoteUpdates(): Observable<any> {
    if (!this.getSessionToken()) return of(null);
    const url = `${this.apiUrl}/pull?sinceId=${this.lastServerId}&deviceId=${this.deviceId}&deviceName=${encodeURIComponent(this.deviceName)}`;

    return this.http.get<any>(url).pipe(
      timeout(4500),
      map(res => {
        if (res && res.success && Array.isArray(res.events)) {
          if (res.events.length > 0) {
            console.log(`[CloudSync] Recibidos ${res.events.length} eventos remotos de otros dispositivos`);
            for (const ev of res.events) {
              this.applyRemoteEvent(ev);
            }
          }
          if (res.latestId) {
            this.lastServerId = res.latestId;
            saveRealtimeData('sync_last_server_id', this.lastServerId);
          }
          this.lastSyncTime.set(new Date());
          this.syncStatus.set('ONLINE');
        }
        return res;
      }),
      catchError(err => {
        // Fallback if backend offline
        this.syncStatus.set(navigator.onLine ? 'ONLINE' : 'OFFLINE');
        return of(null);
      })
    );
  }

  /**
   * Force full sync cycle (push pending + pull remote + check status)
   */
  public forceSync(): void {
    this.syncStatus.set('SYNCING');
    this.flushQueue();

    this.pullRemoteUpdates().subscribe(() => {
      this.http.get<any>(`${this.apiUrl}/status`).pipe(
        timeout(4000),
        catchError(() => of(null))
      ).subscribe(statusRes => {
        if (statusRes && statusRes.success) {
          this.activeDevicesCount.set(Math.max(1, statusRes.activeDevices || 1));
        }
        this.syncStatus.set(navigator.onLine ? 'ONLINE' : 'OFFLINE');
        this.lastSyncTime.set(new Date());
      });
    });
  }

  /**
   * Apply an incoming remote event to local storage and notify active components
   */
  private applyRemoteEvent(ev: any): void {
    try {
      const { entity, action, payload } = ev;
      this.lastSyncedEntity.set(`${entity} (${action})`);

      // Remote force logout listener
      if (action === 'FORCE_LOGOUT') {
        const targetDeviceId = payload?.deviceId || ev.deviceId;
        if (targetDeviceId === this.deviceId) {
          console.warn('[CloudSync] Sesión revocada remotamente por el Administrador.');
          alert('Tu sesión ha sido revocada remotamente por el Administrador de Planta.');
          localStorage.removeItem('basetrack_token');
          localStorage.removeItem('basetrack_user');
          window.location.href = '/auth/login';
          return;
        }
      }

      // Remote real-time app update broadcast listener (instant live reload on all client devices)
      if (action === 'APP_UPDATE' || action === 'FORCE_REFRESH') {
        console.log('[CloudSync] Notificación global de actualización de software recibida. Actualizando cliente...');
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            for (const r of regs) r.update();
          });
        }
        setTimeout(() => {
          window.location.reload();
        }, 1200);
        return;
      }

      // If key is present in payload or event, persist to local store
      const storageKey = payload?.key || ev.key;
      const eventData = payload?.data !== undefined ? payload.data : (payload !== undefined ? payload : ev.data);

      // Ignorar intentos remotos de escribir sesión/identidad de esta terminal
      if (isDeviceLocalKey(storageKey)) return;

      if (storageKey && eventData !== undefined) {
        const isMaint = storageKey.includes('maintenance') || (entity && entity.toLowerCase().includes('maintenance'));
        if (isMaint) {
          const current = getRealtimeData<any[]>('maintenance_tickets', []);
          const list = Array.isArray(current) ? [...current] : [];
          if (Array.isArray(eventData)) {
            saveRealtimeData('maintenance_tickets', eventData, { skipBroadcast: true });
          } else if (eventData && typeof eventData === 'object' && (eventData.id || eventData.equipment_tag)) {
            const idx = list.findIndex(t => t && (t.id === eventData.id || (t.ticket_number && t.ticket_number === eventData.ticket_number)));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...eventData };
            } else {
              list.unshift(eventData);
            }
            saveRealtimeData('maintenance_tickets', list, { skipBroadcast: true });
          }
        }
        if (!storageKey.includes('maintenance_tickets')) {
          saveRealtimeData(storageKey, eventData, { skipBroadcast: true });
        }
      }

      // Dispatch custom global DOM event for active components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('basetrack_cloud_sync', {
          detail: {
            entity,
            action,
            payload: eventData,
            source: 'remote',
            deviceId: ev.deviceId || ev.device_id
          }
        }));
      }
    } catch (e) {
      console.warn('[CloudSync] Error aplicando evento remoto:', e);
    }
  }

  private handleBroadcastMessage(msg: any): void {
    if (!msg || msg.senderId === this.deviceId) return;

    if (msg.event) {
      const { entity, action, data, key } = msg.event;
      this.lastSyncedEntity.set(`${entity} (${action})`);
      this.lastSyncTime.set(new Date());

      // If a storage key was updated by another tab, persist locally
      if (isDeviceLocalKey(key)) return;
      if (key && data !== undefined) {
        const isMaint = key.includes('maintenance') || (entity && entity.toLowerCase().includes('maintenance'));
        if (isMaint) {
          const current = getRealtimeData<any[]>('maintenance_tickets', []);
          const list = Array.isArray(current) ? [...current] : [];
          if (Array.isArray(data)) {
            saveRealtimeData('maintenance_tickets', data, { skipBroadcast: true });
          } else if (data && typeof data === 'object' && (data.id || data.equipment_tag)) {
            const idx = list.findIndex(t => t && (t.id === data.id || (t.ticket_number && t.ticket_number === data.ticket_number)));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...data };
            } else {
              list.unshift(data);
            }
            saveRealtimeData('maintenance_tickets', list, { skipBroadcast: true });
          }
        }
        if (!key.includes('maintenance_tickets')) {
          saveRealtimeData(key, data, { skipBroadcast: true });
        }
      }

      // Notify active views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('basetrack_cloud_sync', {
          detail: {
            entity,
            action,
            payload: data,
            source: 'broadcast',
            deviceId: msg.senderId
          }
        }));
      }
    }
  }

  /**
   * Resolves the WebSocket endpoint URL dynamically according to environment (LAN, Localhost, or Cloud TLS)
   * Note: On Vercel (serverless/CDN without persistent WebSocket proxy support),
   * this connects directly to the persistent backend server (Render/Cloud) instead of Vercel origin.
   */
  public getWsUrl(): string {
    let apiUrl = getApiBaseUrl();
    if (typeof window !== 'undefined' && window.location?.hostname?.includes('vercel.app')) {
      apiUrl = DEFAULT_CLOUD_BACKEND_URL;
    }
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const base = apiUrl.replace(/^https?:/, '').replace(/\/api\/?$/, '');
    return `${wsProtocol}${base}/ws`;
  }

  /**
   * Establishes low-latency bi-directional WebSocket connection to BASETRACK telemetry server
   */
  public connectWebSocket(): void {
    if (typeof window === 'undefined' || !('WebSocket' in window)) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.getWsUrl();
      console.log(`[CloudSync] Conectando WebSocket a ${url}...`);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[CloudSync] WebSocket conectado con éxito. Latencia < 20ms en tiempo real.');
        this.isWsConnected.set(true);
        this.wsReconnectAttempts = 0;
        this.registerWithServer();
        this.startWsHeartbeat();

        // Push any queued items accumulated while offline
        if (this.pendingCount() > 0) {
          this.flushQueue();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsMessage(msg);
        } catch (err) {
          console.warn('[CloudSync] Error decodificando mensaje WebSocket:', err);
        }
      };

      this.ws.onerror = (err) => {
        // Will trigger onclose and attempt reconnect
      };

      this.ws.onclose = () => {
        this.isWsConnected.set(false);
        this.stopWsHeartbeat();
        if (!this.isWsIntentionalClose && navigator.onLine) {
          this.scheduleWsReconnect();
        }
      };
    } catch (err) {
      console.warn('[CloudSync] Error inicializando WebSocket:', err);
      this.scheduleWsReconnect();
    }
  }

  private scheduleWsReconnect(): void {
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    const delay = Math.min(1200 * Math.pow(1.5, this.wsReconnectAttempts), 15000);
    this.wsReconnectAttempts++;
    this.wsReconnectTimer = setTimeout(() => {
      if (navigator.onLine) {
        this.connectWebSocket();
      }
    }, delay);
  }

  public registerWithServer(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const token = this.getSessionToken();
    // El servidor identifica al usuario solo a partir del JWT; sin sesión no se registra
    if (!token) return;
    this.ws.send(JSON.stringify({
      type: 'REGISTER',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      token
    }));
  }

  private getSessionToken(): string | null {
    return getRealtimeData<string | null>('token', null);
  }

  private startWsHeartbeat(): void {
    this.stopWsHeartbeat();
    this.wsPingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', pingSentAt: Date.now() }));
      }
    }, 20000);
  }

  private stopWsHeartbeat(): void {
    if (this.wsPingTimer) {
      clearInterval(this.wsPingTimer);
      this.wsPingTimer = null;
    }
  }

  private handleWsMessage(msg: any): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'WELCOME':
        if (msg.connectedClients) {
          this.activeDevicesCount.set(Math.max(1, msg.connectedClients));
        }
        break;

      case 'REGISTERED':
        if (msg.activeClients) {
          this.activeDevicesCount.set(Math.max(1, msg.activeClients));
        }
        break;

      case 'PONG':
        if (msg.pingSentAt) {
          this.wsLatencyMs.set(Date.now() - msg.pingSentAt);
        }
        this.lastSyncTime.set(new Date());
        break;

      case 'EVENT':
        if (msg.event) {
          this.applyRemoteEvent(msg.event);
        }
        break;
    }
  }

  // Marca de tiempo del build que está ejecutando este cliente (generada en scripts/generate-version.mjs).
  // Antes era una constante fija: al quedar desfasada de version.json, la app se recargaba cada minuto.
  private appBuildTime = BUILD_TIME;

  public checkAppVersion(): void {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    this.http.get<any>(`/version.json?t=${Date.now()}`).pipe(
      timeout(3500),
      catchError(() => of(null))
    ).subscribe(ver => {
      if (ver && ver.buildTime && ver.buildTime > this.appBuildTime) {
        console.log(`[CloudSync] Nueva versión detectada (${ver.version} - ${ver.build}). Actualizando cliente...`);
        this.appBuildTime = ver.buildTime;
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            for (const r of regs) r.update();
          });
        }
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    });
  }

  private startPeriodicSync(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(() => {
      if (!navigator.onLine) return;
      this.syncTick++;
      if (this.isWsConnected()) {
        // Con WebSocket activo recibimos push instantáneo.
        // Realizamos reconciliación pasiva ligera y verificación de versión cada 60s (cada 10 ticks de 6s).
        if (this.syncTick % 10 === 0) {
          this.pullRemoteUpdates().subscribe();
          this.checkAppVersion();
        }
      } else {
        // Respaldo resiliente: sondeo HTTP cada 6 segundos si WS está inactivo.
        this.forceSync();
        if (this.syncTick % 10 === 0) {
          this.checkAppVersion();
        }
      }
    }, 6000);
  }

  private startKeepAlive(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    // Keep Render backend awake to avoid 50s cold boot
    this.keepAliveTimer = setInterval(() => {
      if (navigator.onLine) {
        this.http.get<any>(`${getApiBaseUrl()}/health`).pipe(
          timeout(8000),
          catchError(() => of(null))
        ).subscribe();
      }
    }, 45000);
  }

  private onNetworkOnline(): void {
    console.log('[CloudSync] Conexión de red restablecida. Reconectando WebSocket y sincronizando...');
    this.syncStatus.set('SYNCING');
    this.connectWebSocket();
    this.forceSync();
  }

  private onNetworkOffline(): void {
    console.warn('[CloudSync] Modo Mina / Sin conexión de red.');
    this.syncStatus.set('OFFLINE');
    this.isWsConnected.set(false);
    this.stopWsHeartbeat();
  }

  public disconnect(): void {
    this.isWsIntentionalClose = true;
    this.stopWsHeartbeat();
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
    this.isWsConnected.set(false);
  }
}

