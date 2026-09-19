import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';

export interface SyncEventPayload {
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CHECKIN' | 'SET';
  key?: string;
  data: any;
  timestamp: number;
}

export type SyncState = 'ONLINE' | 'SYNCING' | 'OFFLINE' | 'LOCAL';

import { getApiBaseUrl } from '../constants/api.config';

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
  private isProcessingQueue = false;

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
        if (detail && detail.key && !detail.key.includes('sync_')) {
          const entity = detail.key.replace('basetrack_', '');
          this.broadcastChange(entity, 'SET', detail.data, detail.key);
        }
      });
    }

    // 3. Initial sync and periodic polling
    setTimeout(() => {
      this.forceSync();
      this.startPeriodicSync();
    }, 1500);
  }

  private initDeviceId(): string {
    let id = getRealtimeData<string | null>('device_id', null);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      saveRealtimeData('device_id', id);
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
    saveRealtimeData('device_name', defaultName);
    return defaultName;
  }

  /**
   * Broadcast a mutation across tabs and queue for cloud sync
   */
  public broadcastChange(entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CHECKIN' | 'SET', data: any, storageKey?: string): void {
    const eventItem: SyncEventPayload = {
      entity,
      action,
      key: storageKey,
      data,
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

    // 2. Enqueue in persistent queue for cloud/backend replication
    this.enqueueEvent(eventItem);

    // 3. Trigger immediate sync push if online
    if (navigator.onLine) {
      this.flushQueue();
    }
  }

  private enqueueEvent(event: SyncEventPayload): void {
    const queue = getRealtimeData<SyncEventPayload[]>('sync_queue', []);
    queue.push(event);
    saveRealtimeData('sync_queue', queue);
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
    const queue = getRealtimeData<SyncEventPayload[]>('sync_queue', []);
    if (queue.length === 0) return;

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
      catchError(err => {
        // Fallback for pure Vercel static mode
        this.syncStatus.set(navigator.onLine ? 'ONLINE' : 'OFFLINE');
        this.isProcessingQueue = false;
        return of(null);
      })
    ).subscribe(res => {
      this.isProcessingQueue = false;
      if (res && res.success) {
        // Queue successfully pushed
        saveRealtimeData('sync_queue', []);
        this.updatePendingCount();
        this.syncStatus.set('ONLINE');
        this.lastSyncTime.set(new Date());
        if (res.lastServerId) {
          this.lastServerId = res.lastServerId;
          saveRealtimeData('sync_last_server_id', this.lastServerId);
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
    const user = getRealtimeData<any>('user', null);
    const username = user?.username || '';
    const url = `${this.apiUrl}/pull?sinceId=${this.lastServerId}&deviceId=${this.deviceId}&deviceName=${encodeURIComponent(this.deviceName)}&username=${encodeURIComponent(username)}`;

    return this.http.get<any>(url).pipe(
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

      // If key is present in payload or event, persist to local store
      if (payload && payload.key && payload.data !== undefined) {
        saveRealtimeData(payload.key, payload.data);
      } else if (entity) {
        // Dispatch custom global DOM event for active components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('basetrack_cloud_sync', {
            detail: {
              entity,
              action,
              payload,
              source: 'remote',
              deviceId: ev.deviceId || ev.device_id
            }
          }));
        }
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
      if (key && data !== undefined) {
        saveRealtimeData(key, data);
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

  private startPeriodicSync(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    // Poll every 12 seconds when online
    this.pollingTimer = setInterval(() => {
      if (navigator.onLine) {
        this.forceSync();
      }
    }, 12000);
  }

  private onNetworkOnline(): void {
    console.log('[CloudSync] Conexión de red restablecida. Sincronizando con la nube...');
    this.syncStatus.set('SYNCING');
    this.forceSync();
  }

  private onNetworkOffline(): void {
    console.warn('[CloudSync] Modo Mina / Sin conexión de red.');
    this.syncStatus.set('OFFLINE');
  }
}
