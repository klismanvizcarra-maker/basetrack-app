import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../../../core/constants/api.config';

export interface ConnectedDevice {
  device_id: string;
  device_name: string;
  user_id?: string | null;
  username?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  last_seen: string;
  is_revoked: number;
  is_online?: number | boolean;
}

/**
 * Terminales conectadas, compartidas entre Administración (contador de la pestaña) y
 * AdminTerminalsTabComponent. Solo contiene datos reales del servidor: si la consulta falla
 * se conserva la última lista conocida (antes se inventaba una terminal "en línea").
 */
@Injectable({ providedIn: 'root' })
export class DeviceFleetStore {
  private http = inject(HttpClient);
  readonly devices = signal<ConnectedDevice[]>([]);
  readonly loading = signal(false);

  load(): void {
    this.loading.set(true);
    this.http.get<any>(`${getApiBaseUrl()}/admin/devices`).subscribe({
      next: (res) => {
        this.loading.set(false);
        const list = res?.devices || res?.data;
        if (res && res.success && Array.isArray(list)) {
          this.devices.set(list);
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.warn('[Admin] Fallo al consultar dispositivos conectados:', err);
      }
    });
  }
}
