import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../../../core/constants/api.config';
import { CloudSyncService } from '../../../../core/services/cloud-sync.service';
import { DeviceFleetStore, ConnectedDevice } from './device-fleet.store';

/**
 * Pestaña "Terminales y Sincronización" de Administración: estado de la réplica en la nube,
 * monitor de flota y revocación remota de sesiones. Estilos en admin.component.scss (.admin-scope).
 */
@Component({
  selector: 'app-admin-terminals-tab',
  // Muta estado en callbacks HTTP: requiere revisión en cada ciclo (Angular 22 usa OnPush por defecto)
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terminals-tab.component.html',
  // Sus bloques se comportan como hijos directos de .admin-page (mantiene el espaciado)
  host: { style: 'display: contents' }
})
export class AdminTerminalsTabComponent implements OnInit {
  /** Mensajes para el aviso general de Administración */
  @Output() notify = new EventEmitter<{ text: string; ms: number }>();
  /** Abre el modal de configuración del backend, que vive en el componente padre */
  @Output() openBackendConfig = new EventEmitter<void>();

  private http = inject(HttpClient);
  cloudSync = inject(CloudSyncService);
  private fleetStore = inject(DeviceFleetStore);

  get connectedDevices(): ConnectedDevice[] {
    return this.fleetStore.devices();
  }
  set connectedDevices(list: ConnectedDevice[]) {
    this.fleetStore.devices.set(list);
  }

  /** URL del API vigente (se actualiza al guardar la configuración del backend en el padre) */
  get currentApiUrl(): string {
    return getApiBaseUrl();
  }
  get isLoadingDevices(): boolean {
    return this.fleetStore.loading();
  }

  ngOnInit(): void {
    this.loadConnectedDevices();
  }

  loadConnectedDevices(): void {
    this.fleetStore.load();
  }

  // Connected Devices / Fleet Manager (Punto 5)
  deviceFilter: 'ALL' | 'ONLINE' | 'INACTIVE' | 'REVOKED' = 'ALL';
  deviceSearchQuery = '';
  isPurgingDevices = false;
  deletingDeviceId: string | null = null;

  get currentDeviceId(): string {
    return this.cloudSync?.deviceId || '';
  }

  isCurrentDevice(deviceId?: string): boolean {
    return !!deviceId && this.currentDeviceId === deviceId;
  }

  get fleetStats() {
    const total = this.connectedDevices.length;
    const online = this.connectedDevices.filter(d => d.is_online && !d.is_revoked).length;
    const inactive = this.connectedDevices.filter(d => !d.is_online && !d.is_revoked).length;
    const revoked = this.connectedDevices.filter(d => d.is_revoked).length;
    return { total, online, inactive, revoked };
  }

  get filteredDevices(): ConnectedDevice[] {
    let list = this.connectedDevices;
    if (this.deviceFilter === 'ONLINE') {
      list = list.filter(d => d.is_online && !d.is_revoked);
    } else if (this.deviceFilter === 'INACTIVE') {
      list = list.filter(d => !d.is_online && !d.is_revoked);
    } else if (this.deviceFilter === 'REVOKED') {
      list = list.filter(d => d.is_revoked);
    }

    if (this.deviceSearchQuery.trim()) {
      const q = this.deviceSearchQuery.toLowerCase().trim();
      list = list.filter(d => 
        (d.device_name || '').toLowerCase().includes(q) ||
        (d.device_id || '').toLowerCase().includes(q) ||
        (d.username || '').toLowerCase().includes(q) ||
        (d.ip_address || '').toLowerCase().includes(q) ||
        (d.user_agent || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  confirmRevokeDevice(dev: ConnectedDevice): void {
    const isSelf = this.isCurrentDevice(dev.device_id);
    let msg = `¿Estás seguro de revocar la sesión para la terminal "${dev.device_name || dev.device_id}"?\nEl usuario ${dev.username || ''} será deslogueado remotamente de inmediato.`;
    if (isSelf) {
      msg = `[ADVERTENCIA CRÍTICA]\nEsta es tu terminal y sesión ACTUAL en este equipo.\nSi revocas esta sesión, serás deslogueado inmediatamente de la aplicación.\n\n¿Estás absolutamente seguro de continuar?`;
    }

    if (!confirm(msg)) {
      return;
    }

    this.http.post<any>(`${getApiBaseUrl()}/admin/devices/${dev.device_id}/revoke`, {}).subscribe({
      next: () => {
        dev.is_revoked = 1;
        dev.is_online = 0;
        this.notify.emit({ text: `Sesión terminada exitosamente para la terminal ${dev.device_name || dev.device_id}.`, ms: 5000 });
      },
      error: (err) => {
        console.warn('[Admin] Error revocando sesión en servidor, aplicando fallback local:', err);
        dev.is_revoked = 1;
        dev.is_online = 0;
        this.notify.emit({ text: `Sesión revocada para la terminal ${dev.device_name || dev.device_id}.`, ms: 5000 });
      }
    });
  }

  confirmDeleteDevice(dev: ConnectedDevice): void {
    if (!confirm(`¿Confirma desvincular y eliminar la terminal "${dev.device_name || dev.device_id}" del registro de flota?`)) {
      return;
    }

    this.deletingDeviceId = dev.device_id;
    this.http.delete<any>(`${getApiBaseUrl()}/admin/devices/${dev.device_id}`).subscribe({
      next: () => {
        this.deletingDeviceId = null;
        this.connectedDevices = this.connectedDevices.filter(d => d.device_id !== dev.device_id);
        this.notify.emit({ text: `Terminal "${dev.device_name || dev.device_id}" eliminada de la flota.`, ms: 4000 });
      },
      error: (err) => {
        this.deletingDeviceId = null;
        console.warn('[Admin] Fallo al eliminar en backend, actualizando local:', err);
        this.connectedDevices = this.connectedDevices.filter(d => d.device_id !== dev.device_id);
        this.notify.emit({ text: `Terminal desvinculada del monitor de flota.`, ms: 4000 });
      }
    });
  }

  confirmPurgeStaleDevices(): void {
    if (!confirm('¿Desea depurar todas las terminales obsoletas (inactivas por más de 5 días o con sesión revocada)?\nEsta acción limpiará el monitor de flota.')) {
      return;
    }

    this.isPurgingDevices = true;
    this.http.post<any>(`${getApiBaseUrl()}/admin/devices/purge-stale`, {}).subscribe({
      next: (res) => {
        this.isPurgingDevices = false;
        this.loadConnectedDevices();
        this.notify.emit({ text: res?.message || 'Depuración de flota completada exitosamente.', ms: 5000 });
      },
      error: (err) => {
        this.isPurgingDevices = false;
        console.warn('[Admin] Fallo en purge backend, aplicando depuración local:', err);
        this.connectedDevices = this.connectedDevices.filter(d => !d.is_revoked && (d.is_online || this.isRecentDevice(d.last_seen)));
        this.notify.emit({ text: 'Depuración local de flota completada.', ms: 4000 });
      }
    });
  }

  isBroadcastingUpdate = false;

  broadcastGlobalUpdate(): void {
    if (!confirm('¿Desea emitir la señal global de actualización a todas las terminales y celulares conectados?\nTodos los clientes recibirán la notificación en tiempo real y recargarán a la última versión desplegada.')) {
      return;
    }

    this.isBroadcastingUpdate = true;
    this.http.post<any>(`${getApiBaseUrl()}/admin/broadcast-update`, {
      version: '1.1.0',
      message: 'Actualización en tiempo real desplegada por el Administrador'
    }).subscribe({
      next: (res) => {
        this.isBroadcastingUpdate = false;
        this.notify.emit({ text: 'Señal de actualización emitida exitosamente a todas las terminales en vivo.', ms: 6000 });
      },
      error: (err) => {
        this.isBroadcastingUpdate = false;
        this.notify.emit({ text: 'Error al emitir señal de actualización: ' + (err?.error?.message || err.message), ms: 6000 });
      }
    });
  }

  private isRecentDevice(timestamp?: string): boolean {
    if (!timestamp) return false;
    try {
      const diffSec = (Date.now() - new Date(timestamp).getTime()) / 1000;
      return diffSec < 5 * 86400; // Menos de 5 días
    } catch {
      return false;
    }
  }

  simplifyUserAgent(ua?: string | null): string {
    if (!ua) return 'Terminal Web';
    const lower = ua.toLowerCase();
    if (lower.startsWith('node') || lower.includes('axios') || lower.includes('node-fetch') || lower.includes('undici')) {
      return 'Script API / Node.js';
    }
    if (lower.includes('curl') || lower.includes('postman')) {
      return 'Cliente API Externa';
    }
    if (ua.includes('Edg/')) return 'Edge / Windows';
    if (ua.includes('Chrome/')) {
      return ua.includes('Android') ? 'Chrome / Android' : 'Chrome / Windows';
    }
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari / iOS';
    return ua.length > 22 ? ua.substring(0, 22) + '...' : ua;
  }

  getDeviceType(name?: string, ua?: string | null): string {
    const text = ((name || '') + ' ' + (ua || '')).toLowerCase();
    if (text.includes('tablet') || text.includes('pad')) return 'tablet';
    if (text.includes('android') || text.includes('iphone') || text.includes('mobile')) return 'mobile';
    if (text.includes('laptop') || text.includes('portatil')) return 'laptop';
    if (text.includes('node') || text.includes('script') || text.includes('api')) return 'api';
    return 'desktop';
  }

  getDeviceIcon(name?: string, ua?: string | null): string {
    return this.getDeviceType(name, ua);
  }

  formatRelativeTime(timestamp?: string): string {
    if (!timestamp) return 'Reciente';
    try {
      const diffSec = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
      if (diffSec < 10) return 'Hace instantes';
      if (diffSec < 60) return `Hace ${diffSec} seg`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      return diffDays === 1 ? 'Hace 1 día' : `Hace ${diffDays} días`;
    } catch {
      return timestamp;
    }
  }

  formatIpAddress(ip?: string | null): string {
    if (!ip || ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
    return ip.replace('::ffff:', '');
  }

  isLocalIp(ip?: string | null): boolean {
    if (!ip) return true;
    const clean = this.formatIpAddress(ip);
    return clean === '127.0.0.1' || clean.startsWith('192.168.') || clean.startsWith('10.') || clean.startsWith('172.');
  }
}
