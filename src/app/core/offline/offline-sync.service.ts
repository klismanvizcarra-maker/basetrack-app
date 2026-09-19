import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IndexedDbService, SyncQueueItem } from '../storage/indexed-db.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private http = inject(HttpClient);
  private idb = inject(IndexedDbService);

  public isOnline = signal<boolean>(typeof window !== 'undefined' ? navigator.onLine : true);
  public pendingCount = signal<number>(0);
  public lastSyncTime = signal<string | null>(null);
  public isSyncing = signal<boolean>(false);
  public queueItems = signal<SyncQueueItem[]>([]);
  public showSyncModal = signal<boolean>(false);

  constructor() {
    this.refreshQueueStatus();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineSync] Conexión de red restablecida.');
        this.isOnline.set(true);
        this.syncPendingActions();
      });

      window.addEventListener('offline', () => {
        console.warn('[OfflineSync] Se perdió la conexión. Modo Offline activado.');
        this.isOnline.set(false);
      });
    }
  }

  async refreshQueueStatus(): Promise<void> {
    try {
      const items = await this.idb.getQueue();
      this.queueItems.set(items);
      this.pendingCount.set(items.length);
    } catch (e) {
      console.warn('[OfflineSync] Error refreshing queue status:', e);
    }
  }

  async queueAction(
    endpoint: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body: any,
    entityName: string
  ): Promise<void> {
    const item: Omit<SyncQueueItem, 'retryCount'> = {
      id: crypto.randomUUID ? crypto.randomUUID() : `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      endpoint,
      method,
      body,
      timestamp: new Date().toISOString(),
      entityName
    };

    await this.idb.addToQueue(item);
    await this.refreshQueueStatus();
    console.log(`[OfflineSync] Acción encolada en IndexedDB: ${entityName} (Total pendientes: ${this.pendingCount()})`);

    // Si por alguna razón estamos online, intentar sincronizar de inmediato
    if (this.isOnline() && !this.isSyncing()) {
      this.syncPendingActions();
    }
  }

  async syncPendingActions(): Promise<void> {
    if (this.isSyncing()) return;
    const items = await this.idb.getQueue();
    if (items.length === 0) return;

    this.isSyncing.set(true);
    console.log(`[OfflineSync] Iniciando sincronización de ${items.length} acciones pendientes con el servidor...`);

    for (const item of items) {
      try {
        if (item.method === 'POST') {
          await firstValueFrom(this.http.post(item.endpoint, item.body));
        } else if (item.method === 'PATCH') {
          await firstValueFrom(this.http.patch(item.endpoint, item.body));
        } else if (item.method === 'PUT') {
          await firstValueFrom(this.http.put(item.endpoint, item.body));
        } else if (item.method === 'DELETE') {
          await firstValueFrom(this.http.delete(item.endpoint));
        }

        await this.idb.removeFromQueue(item.id);
        console.log(`[OfflineSync] ✅ Sincronizado con éxito: ${item.entityName}`);
      } catch (err: any) {
        console.error(`[OfflineSync] ❌ Error sincronizando ${item.entityName}:`, err);
        const status = err?.status;
        
        // Si es un error 4xx no recuperable (bad request, validación, etc.) o superó 5 reintentos, descartar
        if ((status >= 400 && status < 500 && status !== 408) || item.retryCount >= 5) {
          console.warn(`[OfflineSync] Descartando acción no recuperable (status ${status}, retries: ${item.retryCount}): ${item.entityName}`);
          await this.idb.removeFromQueue(item.id);
        } else {
          await this.idb.incrementRetry(item.id);
        }

        // Si el servidor está caído o hay error de red, pausar para no saturar
        if (!navigator.onLine) {
          this.isOnline.set(false);
          break;
        }
      }
    }

    await this.refreshQueueStatus();
    this.isSyncing.set(false);
    this.lastSyncTime.set(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  async forceSyncNow(): Promise<void> {
    this.isOnline.set(navigator.onLine);
    await this.syncPendingActions();
  }

  openSyncDrawer(): void {
    this.refreshQueueStatus();
    this.showSyncModal.set(true);
  }

  closeSyncDrawer(): void {
    this.showSyncModal.set(false);
  }

  // Métodos de almacenamiento en caché para datos de módulos
  async saveModuleCache(key: string, data: any): Promise<void> {
    await this.idb.setCache(key, data);
  }

  async getModuleCache<T = any>(key: string): Promise<T | null> {
    return await this.idb.getCache<T>(key);
  }
}
