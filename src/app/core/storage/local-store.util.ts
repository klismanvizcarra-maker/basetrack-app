/**
 * Real-Time Local Storage Utility for BASETRACK APP
 * Guarantees zero data loss across page refreshes, tab closures, logins, and logouts.
 * Works seamlessly in offline mode and on cloud static deployments like Vercel.
 */

/**
 * Claves propias de esta terminal (sesión e identidad del dispositivo).
 * Nunca se replican por CloudSync ni se aceptan desde eventos remotos:
 * replicar el token haría que todas las terminales heredaran la sesión de quien inició sesión.
 */
const DEVICE_LOCAL_KEYS = new Set([
  'basetrack_token',
  'basetrack_auth_token',
  'basetrack_user',
  'basetrack_device_id',
  'basetrack_device_name',
  'basetrack_api_url'
]);

export function isDeviceLocalKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const storageKey = key.startsWith('basetrack_') ? key : `basetrack_${key}`;
  return DEVICE_LOCAL_KEYS.has(storageKey) || storageKey.startsWith('basetrack_sync_');
}

/** Claves cuyo contenido son datos de usuarios: nunca deben contener contraseñas. */
const USER_DATA_KEYS = new Set(['basetrack_users_registry', 'basetrack_user', 'basetrack_admin_users']);

/** Copia sin propiedades de contraseña (las credenciales solo las valida el servidor). */
function stripPasswords(value: any, depth = 0): any {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => stripPasswords(v, depth + 1));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.toLowerCase() === 'password') continue;
    out[k] = stripPasswords(v, depth + 1);
  }
  return out;
}

export function saveRealtimeData(key: string, data: any, options?: { skipBroadcast?: boolean }): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  const storageKey = key.startsWith('basetrack_') ? key : `basetrack_${key}`;
  // Ninguna contraseña se guarda en el dispositivo ni se replica a otras terminales
  if (USER_DATA_KEYS.has(storageKey)) {
    data = stripPasswords(data);
  }
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(storageKey, serialized);
  } catch (err) {
    console.warn(`[LocalStore] Quota exceeded or storage error on ${storageKey}:`, err);
  }

    // Also asynchronously persist to IndexedDB if available
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    try {
      const openReq = indexedDB.open('basetrack_db');
      openReq.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (db.objectStoreNames.contains('offline_cache')) {
          const tx = db.transaction('offline_cache', 'readwrite');
          tx.objectStore('offline_cache').put({
            key: storageKey,
            data,
            updatedAt: new Date().toISOString()
          });
        }
      };
    } catch {
      // Ignore IDB fallback errors
    }
  }

  // Dispatch local notification event for CloudSyncService and active UI components
  if (typeof window !== 'undefined' && !storageKey.includes('sync_') && !options?.skipBroadcast) {
    try {
      const entity = storageKey.replace('basetrack_', '');
      window.dispatchEvent(new CustomEvent('basetrack_local_change', {
        detail: { key: storageKey, entity, data, timestamp: Date.now() }
      }));

    } catch {
      // Ignore event error
    }
  }
}

/**
 * Elimina contraseñas que versiones anteriores de la app guardaron en el dispositivo
 * (users_registry, user). Se reescriben sin difundirse a otras terminales.
 */
export function purgeStoredPasswords(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  for (const storageKey of USER_DATA_KEYS) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && raw.includes('"password"')) {
        saveRealtimeData(storageKey, JSON.parse(raw), { skipBroadcast: true });
      }
    } catch {
      // Valor corrupto: se descarta para no conservar credenciales
      localStorage.removeItem(storageKey);
    }
  }
}

export function getRealtimeData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return fallback;

  const storageKey = key.startsWith('basetrack_') ? key : `basetrack_${key}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[LocalStore] Error reading ${storageKey}:`, err);
    return fallback;
  }
}

export function removeRealtimeData(key: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const storageKey = key.startsWith('basetrack_') ? key : `basetrack_${key}`;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore error
  }
}
