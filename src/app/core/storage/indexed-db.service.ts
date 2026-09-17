import { Injectable } from '@angular/core';

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body: any;
  timestamp: string;
  entityName: string;
  retryCount: number;
}

export interface CachedData {
  key: string;
  data: any;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private readonly dbName = 'basetrack_db';
  private readonly dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isAvailable = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.isAvailable) {
      this.initDb().catch(err => {
        console.warn('[IndexedDB] Error initializing database, fallback will be used:', err);
      });
    }
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    if (!this.isAvailable) return Promise.reject(new Error('IndexedDB not available'));

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para acciones pendientes de sincronización
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para caché de datos fuera de línea
        if (!db.objectStoreNames.contains('offline_cache')) {
          db.createObjectStore('offline_cache', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // --- MÉTODOS DE LA COLA DE SINCRONIZACIÓN ---

  async addToQueue(item: Omit<SyncQueueItem, 'retryCount'>): Promise<void> {
    const queueItem: SyncQueueItem = { ...item, retryCount: 0 };

    if (!this.isAvailable) {
      this.addToLocalStorageQueue(queueItem);
      return;
    }

    try {
      const db = await this.initDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.put(queueItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.addToLocalStorageQueue(queueItem);
    }
  }

  async getQueue(): Promise<SyncQueueItem[]> {
    if (!this.isAvailable) {
      return this.getLocalStorageQueue();
    }

    try {
      const db = await this.initDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => {
          const items: SyncQueueItem[] = req.result || [];
          items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getLocalStorageQueue();
    }
  }

  async removeFromQueue(id: string): Promise<void> {
    if (!this.isAvailable) {
      this.removeFromLocalStorageQueue(id);
      return;
    }

    try {
      const db = await this.initDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.removeFromLocalStorageQueue(id);
    }
  }

  async incrementRetry(id: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find(i => i.id === id);
    if (!item) return;

    item.retryCount += 1;
    if (this.isAvailable && this.db) {
      const tx = this.db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(item);
    } else {
      const lsQueue = this.getLocalStorageQueue();
      const idx = lsQueue.findIndex(i => i.id === id);
      if (idx !== -1) {
        lsQueue[idx].retryCount += 1;
        localStorage.setItem('basetrack_offline_queue', JSON.stringify(lsQueue));
      }
    }
  }

  async clearQueue(): Promise<void> {
    if (this.isAvailable) {
      const db = await this.initDb();
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').clear();
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('basetrack_offline_queue');
    }
  }

  // --- MÉTODOS DE CACHÉ DE DATOS LOCALES ---

  async setCache(key: string, data: any): Promise<void> {
    const entry: CachedData = {
      key,
      data,
      updatedAt: new Date().toISOString()
    };

    if (this.isAvailable) {
      try {
        const db = await this.initDb();
        const tx = db.transaction('offline_cache', 'readwrite');
        tx.objectStore('offline_cache').put(entry);
        return;
      } catch (e) {
        console.warn('[IndexedDB] setCache fallback to localStorage', e);
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`basetrack_cache_${key}`, JSON.stringify(entry));
      } catch (err) {
        console.warn('[Storage] Quota exceeded on localStorage', err);
      }
    }
  }

  async getCache<T = any>(key: string): Promise<T | null> {
    if (this.isAvailable) {
      try {
        const db = await this.initDb();
        return new Promise((resolve) => {
          const tx = db.transaction('offline_cache', 'readonly');
          const req = tx.objectStore('offline_cache').get(key);
          req.onsuccess = () => resolve(req.result ? req.result.data : null);
          req.onerror = () => resolve(null);
        });
      } catch {
        // fallback to localStorage
      }
    }

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`basetrack_cache_${key}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.data;
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  // Fallbacks privados para localStorage
  private getLocalStorageQueue(): SyncQueueItem[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('basetrack_offline_queue');
    return raw ? JSON.parse(raw) : [];
  }

  private addToLocalStorageQueue(item: SyncQueueItem): void {
    const queue = this.getLocalStorageQueue();
    queue.push(item);
    localStorage.setItem('basetrack_offline_queue', JSON.stringify(queue));
  }

  private removeFromLocalStorageQueue(id: string): void {
    const queue = this.getLocalStorageQueue().filter(i => i.id !== id);
    localStorage.setItem('basetrack_offline_queue', JSON.stringify(queue));
  }
}
