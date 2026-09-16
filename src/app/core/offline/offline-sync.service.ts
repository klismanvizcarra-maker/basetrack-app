import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface OfflineAction {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT';
  body: any;
  timestamp: string;
  entityName: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private http = inject(HttpClient);
  private queueKey = 'basetrack_offline_queue';

  public isOnline = signal<boolean>(typeof window !== 'undefined' ? navigator.onLine : true);
  public pendingCount = signal<number>(this.getQueue().length);
  public lastSyncTime = signal<string | null>(null);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline.set(true);
        this.syncPendingActions();
      });

      window.addEventListener('offline', () => {
        this.isOnline.set(false);
      });
    }
  }

  queueAction(endpoint: string, method: 'POST' | 'PATCH' | 'PUT', body: any, entityName: string): void {
    const queue = this.getQueue();
    const action: OfflineAction = {
      id: crypto.randomUUID(),
      endpoint,
      method,
      body,
      timestamp: new Date().toISOString(),
      entityName
    };
    queue.push(action);
    this.saveQueue(queue);
    this.pendingCount.set(queue.length);
    console.log(`[OfflineSync] Action queued for offline sync: ${entityName}`);
  }

  async syncPendingActions(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineSync] Attempting sync of ${queue.length} pending actions...`);
    const remaining: OfflineAction[] = [];

    for (const action of queue) {
      try {
        if (action.method === 'POST') {
          await this.http.post(action.endpoint, action.body).toPromise();
        } else if (action.method === 'PATCH') {
          await this.http.patch(action.endpoint, action.body).toPromise();
        }
        console.log(`[OfflineSync] Synced action: ${action.entityName}`);
      } catch (err) {
        console.error(`[OfflineSync] Failed syncing action ${action.entityName}, keeping in queue`, err);
        remaining.push(action);
      }
    }

    this.saveQueue(remaining);
    this.pendingCount.set(remaining.length);
    this.lastSyncTime.set(new Date().toLocaleTimeString());
  }

  private getQueue(): OfflineAction[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(this.queueKey);
    return raw ? JSON.parse(raw) : [];
  }

  private saveQueue(queue: OfflineAction[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
    }
  }
}
