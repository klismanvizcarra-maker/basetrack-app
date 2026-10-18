import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { getRealtimeData } from '../storage/local-store.util';
import { getCurrentActiveShift } from '../../shared/utils/roster.util';
import { PlantParametersService } from './plant-parameters.service';
import { CloudSyncService } from './cloud-sync.service';

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';
export type NotificationCategory = 'ALL' | 'CRITICAL' | 'OPERATION';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  severity: NotificationSeverity;
  category: 'CRITICAL' | 'OPERATION';
  route?: string;
  equipmentTag?: string;
  isRead: boolean;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private router = inject(Router);
  private plantParams = inject(PlantParametersService);
  private cloudSync = inject(CloudSyncService);

  public notifications = signal<NotificationItem[]>([]);
  public activeTab = signal<NotificationCategory>('ALL');

  public unreadCount = computed(() => {
    return this.notifications().filter(n => !n.isRead).length;
  });

  public filteredNotifications = computed(() => {
    const tab = this.activeTab();
    const all = this.notifications();
    if (tab === 'ALL') return all;
    return all.filter(n => n.category === tab);
  });

  // Se recalcula ante cambios remotos y locales: las alertas leen solo el almacenamiento, no lo escriben
  private syncListener = () => {
    this.refreshNotifications();
  };

  constructor() {
    this.refreshNotifications();
    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
      window.addEventListener('basetrack_local_change', this.syncListener);
    }
  }

  public setTab(tab: NotificationCategory): void {
    this.activeTab.set(tab);
  }

  public refreshNotifications(): void {
    const readIds = this.getReadIds();
    const items: NotificationItem[] = [];
    const now = Date.now();

    // 1. Alertas de Bombas & Equipos en Falla o Mantenimiento
    try {
      // Última planilla guardada por el módulo de bombas (pumps.component → pump_sheet_latest)
      const sheet = getRealtimeData<any>('basetrack_pump_sheet_latest', null);
      if (sheet) {
        const allPumps: any[] = [
          ...(sheet.sentina_pumps || []),
          ...(sheet.intermedia_pumps || []),
          ...(sheet.torre5_pumps || [])
        ];

        const sheetTs = Date.parse(sheet.updated_at || sheet.report_date || '') || now;
        let failureCount = 0;
        let maintenanceCount = 0;
        let standbyCount = 0;

        for (const p of allPumps) {
          if (p.status === 'Falla') {
            failureCount++;
            items.push({
              id: `pump-fail-${p.tag}`,
              title: `Bomba ${p.tag} en Falla Operativa`,
              description: `Equipo ${p.tag} reportó disparo o avería. Requiere atención o pase a mantenimiento.`,
              timeAgo: 'Estado actual',
              severity: 'critical',
              category: 'CRITICAL',
              route: '/pumps',
              equipmentTag: p.tag,
              isRead: readIds.has(`pump-fail-${p.tag}`),
              timestamp: sheetTs
            });
          } else if (p.status === 'Mantenimiento') {
            maintenanceCount++;
            items.push({
              id: `pump-maint-${p.tag}`,
              title: `Bomba ${p.tag} en Intervención`,
              description: `Equipo bloqueado por mantenimiento. Bloqueo activo hasta emisión de Pase Operativo.`,
              timeAgo: 'Estado actual',
              severity: 'warning',
              category: 'CRITICAL',
              route: '/pumps',
              equipmentTag: p.tag,
              isRead: readIds.has(`pump-maint-${p.tag}`),
              timestamp: sheetTs
            });
          } else if (p.status === 'Stand by') {
            standbyCount++;
          }
        }

        if (failureCount === 0 && maintenanceCount === 0 && allPumps.length > 0) {
          items.push({
            id: 'pumps-status-ok',
            title: 'Sistema de Bombeo Slurry en Régimen',
            description: `${allPumps.length} bombas en planilla: ${allPumps.length - standbyCount} activas y ${standbyCount} en stand by rotativo.`,
            timeAgo: 'Última planilla',
            severity: 'success',
            category: 'OPERATION',
            route: '/pumps',
            isRead: readIds.has('pumps-status-ok'),
            timestamp: sheetTs
          });
        }
      }
    } catch (e) {}

    // 2. Alertas de Presa de Relaves & Borde Libre
    try {
      const tailingsReports = getRealtimeData<any[]>('basetrack_tailings_reports', []) || [];
      const latestTailings = tailingsReports.length > 0 ? tailingsReports[0] : null;
      const minFreeboard = this.plantParams.minFreeboard() || 2.5;
      const tailingsTs = parseServerDate(latestTailings?.created_at) || now;

      // 0 m es el caso más crítico: no usar una comprobación de veracidad
      if (latestTailings && latestTailings.freeboard_meters !== null && latestTailings.freeboard_meters !== undefined && Number.isFinite(Number(latestTailings.freeboard_meters))) {
        if (Number(latestTailings.freeboard_meters) < minFreeboard) {
          items.push({
            id: 'tailings-freeboard-alert',
            title: `Borde Libre Bajo: ${Number(latestTailings.freeboard_meters).toFixed(1)}m`,
            description: `El borde libre en Presa Cortadera está por debajo del umbral mínimo reglamentario (${minFreeboard}m).`,
            timeAgo: timeAgoLabel(tailingsTs, now),
            severity: 'critical',
            category: 'CRITICAL',
            route: '/tailings',
            isRead: readIds.has('tailings-freeboard-alert'),
            timestamp: tailingsTs
          });
        } else {
          items.push({
            id: 'tailings-freeboard-ok',
            title: `Presa Cortadera: Margen Seguro (${Number(latestTailings.freeboard_meters).toFixed(1)}m)`,
            description: `Cota de espejo y borde libre cumplen con estándares GISTM y D.S. 024-2016-EM.`,
            timeAgo: timeAgoLabel(tailingsTs, now),
            severity: 'success',
            category: 'OPERATION',
            route: '/tailings',
            isRead: readIds.has('tailings-freeboard-ok'),
            timestamp: tailingsTs
          });
        }
      } else {
        items.push({
          id: 'tailings-status-info',
          title: 'Presa de Relaves & Depósito Cortadera',
          description: `Sin reportes de borde libre registrados todavía.`,
          timeAgo: 'Sin datos',
          severity: 'info',
          category: 'OPERATION',
          route: '/tailings',
          isRead: readIds.has('tailings-status-info'),
          timestamp: 0
        });
      }
    } catch (e) {}

    // 3. Órdenes de Trabajo de Mantenimiento Activas
    try {
      const tickets = getRealtimeData<any[]>('basetrack_maintenance_tickets', []) || [];
      const openTickets = tickets.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
      if (openTickets.length > 0) {
        const first = openTickets[0];
        const ticketTs = parseServerDate(first.created_at) || now;
        items.push({
          id: `ticket-${first.id}`,
          title: `OT Activa: ${first.equipment_tag || 'Planta'} (${first.ticket_number || '#OT'})`,
          description: `${first.title || 'Mantenimiento en campo'} — Estado: ${first.status === 'IN_PROGRESS' ? 'En Intervención' : 'Pendiente'}.`,
          timeAgo: timeAgoLabel(ticketTs, now),
          severity: first.priority === 'HIGH' || first.priority === 'EMERGENCY' ? 'critical' : 'warning',
          category: 'CRITICAL',
          route: '/maintenance',
          equipmentTag: first.equipment_tag,
          isRead: readIds.has(`ticket-${first.id}`),
          timestamp: ticketTs
        });
      }
    } catch (e) {}

    // 4. Turno Activo y Relevo Programado
    try {
      const activeShift = getCurrentActiveShift();
      const supName = activeShift.activeGuard.supervisorUser || activeShift.activeGuard.supervisorName;
      items.push({
        id: `shift-active-${activeShift.activeGuard.code}`,
        title: `Turno en Planta: Guardia ${activeShift.activeGuard.code}${supName ? ` (${supName})` : ''}`,
        description: `Operación continua en ${activeShift.shiftName === 'DIA' ? 'Turno Día (07:00 a 19:00)' : 'Turno Noche (19:00 a 07:00)'}. Relevo entrega a Guardia ${activeShift.nextGuard?.code || 'G2'}.`,
        timeAgo: 'En vivo',
        severity: 'info',
        category: 'OPERATION',
        route: '/shift-handover',
        isRead: readIds.has(`shift-active-${activeShift.activeGuard.code}`),
        timestamp: now - 60000
      });
    } catch (e) {}

    // 5. Telemetría y Sincronización en la Nube
    if (this.cloudSync.isWsConnected()) {
      items.push({
        id: 'ws-connected-notice',
        title: 'Sincronización en Tiempo Real Activa',
        description: `Conexión WebSocket establecida. ${this.cloudSync.activeDevicesCount()} terminales en red.`,
        timeAgo: 'En vivo',
        severity: 'success',
        category: 'OPERATION',
        route: '/dashboard',
        isRead: readIds.has('ws-connected-notice'),
        timestamp: now - 30000
      });
    }

    // Ordenar por timestamp descendente
    items.sort((a, b) => b.timestamp - a.timestamp);
    this.notifications.set(items);
  }

  public markAllAsRead(): void {
    const list = this.notifications().map(n => ({ ...n, isRead: true }));
    this.notifications.set(list);
    this.saveReadIds(list.map(n => n.id));
  }

  public markAsRead(id: string): void {
    const list = this.notifications().map(n => n.id === id ? { ...n, isRead: true } : n);
    this.notifications.set(list);
    const readIds = Array.from(this.getReadIds());
    if (!readIds.includes(id)) {
      readIds.push(id);
      this.saveReadIds(readIds);
    }
  }

  public dismissNotification(id: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.markAsRead(id);
    const filtered = this.notifications().filter(n => n.id !== id);
    this.notifications.set(filtered);
  }

  public onNotificationClick(item: NotificationItem): void {
    this.markAsRead(item.id);
    if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  private getReadIds(): Set<string> {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('basetrack_read_notifications');
        if (raw) {
          return new Set<string>(JSON.parse(raw));
        }
      }
    } catch (e) {}
    return new Set<string>();
  }

  private saveReadIds(ids: string[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('basetrack_read_notifications', JSON.stringify(ids));
      }
    } catch (e) {}
  }
}

/**
 * SQLite guarda datetime('now') como 'AAAA-MM-DD HH:MM:SS' en UTC sin zona; Date.parse lo
 * interpretaría como hora local y desfasaría 5 h. Se marca explícitamente como UTC.
 */
function parseServerDate(value: unknown): number {
  const raw = String(value || '').trim();
  if (!raw) return NaN;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw.replace(' ', 'T') + 'Z' : raw;
  return Date.parse(iso);
}

/** Etiqueta relativa a partir de una marca de tiempo real del registro. */
function timeAgoLabel(ts: number, now: number): string {
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.round(h / 24)} d`;
}
