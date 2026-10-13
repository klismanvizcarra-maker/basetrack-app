/** Campos que nunca deben almacenarse ni reenviarse en eventos de sincronización. */
const SECRET_KEYS = new Set(['password', 'password_hash', 'passwordhash', 'currentpassword', 'newpassword', 'token']);

/**
 * Devuelve una copia del valor sin propiedades sensibles (en cualquier nivel).
 * Defensa en profundidad: aunque un cliente antiguo envíe contraseñas dentro de una caché
 * (p. ej. users_registry), el servidor no las guarda en sync_events ni las difunde.
 */
export function stripSecrets<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => stripSecrets(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(k.toLowerCase())) continue;
    out[k] = stripSecrets(v, depth + 1);
  }
  return out as T;
}

/** Quita contraseñas de payload/data de un evento, aunque el payload llegue serializado como texto. */
export function sanitizeSyncEvent<T extends { payload?: unknown; data?: unknown }>(ev: T): T {
  const clean = (v: unknown): unknown => {
    if (typeof v === 'string') {
      try { return JSON.stringify(stripSecrets(JSON.parse(v))); } catch { return v; }
    }
    return stripSecrets(v);
  };
  return { ...ev, payload: clean(ev.payload), data: clean(ev.data) };
}
