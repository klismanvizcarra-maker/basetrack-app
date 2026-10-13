import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../../../core/constants/api.config';

export interface AuditLog {
  id: string;
  username: string;
  action: string;
  entity: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

/** Clave de la última copia de la bitácora (se muestra sin conexión y la usa el respaldo local). */
const AUDIT_LOGS_CACHE_KEY = 'basetrack_admin_logs';

/**
 * Bitácora de auditoría compartida entre Administración (contador de la pestaña) y
 * AdminAuditLogsTabComponent (tabla). Solo contiene eventos reales del servidor o su
 * última copia en caché; nunca entradas de ejemplo.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogStore {
  private http = inject(HttpClient);
  readonly logs = signal<AuditLog[]>(this.readCache());

  load(): void {
    this.http.get<any>(`${getApiBaseUrl()}/admin/audit-logs`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          this.logs.set(res.data);
          try {
            localStorage.setItem(AUDIT_LOGS_CACHE_KEY, JSON.stringify(res.data));
          } catch {}
        }
      },
      error: () => {
        // Sin conexión: se mantiene la última copia real en caché
      }
    });
  }

  private readCache(): AuditLog[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(AUDIT_LOGS_CACHE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
