import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { getApiBaseUrl } from '../constants/api.config';
import { isNetworkError, serverErrorMessage } from '../../shared/utils/http-error.util';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';
import { AuthService } from './auth.service';

export type PermissionKey =
  // Ventanas & Módulos Principales
  | 'VIEW_DASHBOARD'
  | 'VIEW_SHIFT_HANDOVER'
  | 'VIEW_CREW'
  | 'VIEW_ROSTER'
  | 'VIEW_PUMPS'
  | 'VIEW_CYCLONES'
  | 'VIEW_TAILINGS'
  | 'VIEW_FLOWSHEET'
  | 'VIEW_MAINTENANCE'
  | 'VIEW_CALCULATORS'
  | 'VIEW_VEHICLE_CHECKLIST'
  | 'VIEW_ADMIN'
  // Capacidades Operacionales & Seguridad
  | 'CAN_VIEW_OPERATIONS'
  | 'CAN_RECORD_DATA'
  | 'CAN_FILL_VEHICLES'
  | 'CAN_MANAGE_CREW'
  | 'CAN_CLOSE_SHIFT'
  | 'CAN_DELETE_RECORDS'
  | 'CAN_ACCESS_ADMIN';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  category: 'VENTANAS' | 'OPERACIONES' | 'GESTIÓN' | 'SEGURIDAD';
  description: string;
  route?: string;
  icon?: string;
}

export const MODULE_ROUTE_TO_PERMISSION: Record<string, PermissionKey> = {
  '/dashboard': 'VIEW_DASHBOARD',
  '/shift-handover': 'VIEW_SHIFT_HANDOVER',
  '/crew': 'VIEW_CREW',
  '/roster': 'VIEW_ROSTER',
  '/pumps': 'VIEW_PUMPS',
  '/cyclones': 'VIEW_CYCLONES',
  '/tailings': 'VIEW_TAILINGS',
  '/flowsheet': 'VIEW_FLOWSHEET',
  '/maintenance': 'VIEW_MAINTENANCE',
  '/calculators': 'VIEW_CALCULATORS',
  '/vehicle-checklist': 'VIEW_VEHICLE_CHECKLIST',
  '/admin': 'VIEW_ADMIN'
};

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // 1. Ventanas / Módulos del Sistema
  {
    key: 'VIEW_DASHBOARD',
    label: 'Ventana: Dashboard General',
    category: 'VENTANAS',
    description: 'Acceso al panel principal, telemetría consolidada y KPIs de planta (/dashboard).',
    route: '/dashboard',
    icon: 'layout-dashboard'
  },
  {
    key: 'VIEW_SHIFT_HANDOVER',
    label: 'Ventana: Cambio de Guardia',
    category: 'VENTANAS',
    description: 'Acceso a la bitácora de relevo y entrega oficial de turno (/shift-handover).',
    route: '/shift-handover',
    icon: 'file-text'
  },
  {
    key: 'VIEW_CREW',
    label: 'Ventana: Gestión de Cuadrilla',
    category: 'VENTANAS',
    description: 'Acceso a asignaciones de operadores por puestos operativos (/crew).',
    route: '/crew',
    icon: 'users'
  },
  {
    key: 'VIEW_ROSTER',
    label: 'Ventana: Rol de Guardias (8x8)',
    category: 'VENTANAS',
    description: 'Acceso al calendario operacional 8x8 y rotación de subidas/bajadas (/roster).',
    route: '/roster',
    icon: 'calendar'
  },
  {
    key: 'VIEW_PUMPS',
    label: 'Ventana: Reporte de Bombas',
    category: 'VENTANAS',
    description: 'Acceso a estaciones de bombeo, curvas operacionales y amperajes (/pumps).',
    route: '/pumps',
    icon: 'disc'
  },
  {
    key: 'VIEW_CYCLONES',
    label: 'Ventana: Reporte de Ciclones',
    category: 'VENTANAS',
    description: 'Acceso a baterías de hidrociclones, granulometría y presiones (/cyclones).',
    route: '/cyclones',
    icon: 'sparkles'
  },
  {
    key: 'VIEW_TAILINGS',
    label: 'Ventana: Presa de Relaves & Descarga',
    category: 'VENTANAS',
    description: 'Acceso a niveles de espejo de agua, borde libre y piezómetros (/tailings).',
    route: '/tailings',
    icon: 'activity'
  },
  {
    key: 'VIEW_FLOWSHEET',
    label: 'Ventana: Diagrama P&ID',
    category: 'VENTANAS',
    description: 'Acceso al diagrama interactivo de tuberías e instrumentación (/flowsheet).',
    route: '/flowsheet',
    icon: 'git-merge'
  },
  {
    key: 'VIEW_MAINTENANCE',
    label: 'Ventana: Mantenimiento',
    category: 'VENTANAS',
    description: 'Acceso a órdenes de trabajo (OT), averías mecánicas/eléctricas y pases (/maintenance).',
    route: '/maintenance',
    icon: 'wrench'
  },
  {
    key: 'VIEW_CALCULATORS',
    label: 'Ventana: Calculadora Planta',
    category: 'VENTANAS',
    description: 'Acceso a cálculos metalúrgicos, balances de masa y velocidad crítica (/calculators).',
    route: '/calculators',
    icon: 'calculator'
  },
  {
    key: 'VIEW_VEHICLE_CHECKLIST',
    label: 'Ventana: Checklist Camionetas',
    category: 'VENTANAS',
    description: 'Acceso al módulo de inspección pre-uso de camionetas 4x4 DS-024 (/vehicle-checklist).',
    route: '/vehicle-checklist',
    icon: 'truck'
  },
  {
    key: 'VIEW_ADMIN',
    label: 'Ventana: Administración',
    category: 'VENTANAS',
    description: 'Acceso exclusivo al panel central de administración y auditoría (/admin).',
    route: '/admin',
    icon: 'shield'
  },

  // 2. Capacidades Operacionales & Seguridad
  {
    key: 'CAN_VIEW_OPERATIONS',
    label: 'Visualizar Operaciones & Telemetría',
    category: 'OPERACIONES',
    description: 'Acceso a tableros, indicadores, curvas y estados de equipos en tiempo real.'
  },
  {
    key: 'CAN_RECORD_DATA',
    label: 'Registrar Datos de Planta',
    category: 'OPERACIONES',
    description: 'Ingreso y guardado de lecturas operacionales en Bombas, Ciclones y Descarga.'
  },
  {
    key: 'CAN_FILL_VEHICLES',
    label: 'Checklist Pre-Uso de Camionetas',
    category: 'OPERACIONES',
    description: 'Llenado y firma digital de inspecciones pre-uso de camionetas 4x4 (DS-024).'
  },
  {
    key: 'CAN_MANAGE_CREW',
    label: 'Asignar Cuadrilla de Guardia',
    category: 'GESTIÓN',
    description: 'Modificar y asignar operadores titulares en los puestos operativos (/crew).'
  },
  {
    key: 'CAN_CLOSE_SHIFT',
    label: 'Firmar y Cerrar Cambio de Guardia',
    category: 'GESTIÓN',
    description: 'Firma oficial y cierre definitivo de bitácora en entrega de guardia (/shift-handover).'
  },
  {
    key: 'CAN_DELETE_RECORDS',
    label: 'Eliminar Registros Históricos',
    category: 'SEGURIDAD',
    description: 'Eliminación de muestras de laboratorio, reportes o tickets de mantenimiento.'
  },
  {
    key: 'CAN_ACCESS_ADMIN',
    label: 'Acceso Total a Administración',
    category: 'SEGURIDAD',
    description: 'Panel de usuarios, trazabilidad SCADA, backups y gestión de flota (/admin).'
  }
];

export const DEFAULT_ROLE_PERMISSIONS: Record<'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE', PermissionKey[]> = {
  ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_SHIFT_HANDOVER',
    'VIEW_CREW',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_MAINTENANCE',
    'VIEW_CALCULATORS',
    'VIEW_VEHICLE_CHECKLIST',
    'VIEW_ADMIN',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT',
    'CAN_DELETE_RECORDS',
    'CAN_ACCESS_ADMIN'
  ],
  SUPERVISOR: [
    'VIEW_DASHBOARD',
    'VIEW_SHIFT_HANDOVER',
    'VIEW_CREW',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_MAINTENANCE',
    'VIEW_CALCULATORS',
    'VIEW_VEHICLE_CHECKLIST',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT'
  ],
  OPERATOR: [
    'VIEW_DASHBOARD',
    'VIEW_SHIFT_HANDOVER',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_VEHICLE_CHECKLIST',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES'
  ],
  MAINTENANCE: [
    'VIEW_DASHBOARD',
    'VIEW_ROSTER',
    'VIEW_PUMPS',
    'VIEW_CYCLONES',
    'VIEW_TAILINGS',
    'VIEW_FLOWSHEET',
    'VIEW_MAINTENANCE',
    'VIEW_VEHICLE_CHECKLIST',
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES'
  ]
};

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private get apiUrl(): string {
    return `${getApiBaseUrl()}/admin/permissions`;
  }

  // Reactive State Signals
  public rolePermissionsSignal = signal<Record<'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE', PermissionKey[]>>(
    getRealtimeData('basetrack_role_permissions', DEFAULT_ROLE_PERMISSIONS)
  );

  public userOverridesSignal = signal<Record<string, Record<string, boolean>>>(
    getRealtimeData('basetrack_user_permission_overrides', {})
  );

  // Computed helper: current effective permissions array for logged-in user
  public effectivePermissions = computed<PermissionKey[]>(() => {
    const user = this.authService.currentUser();
    if (!user) return [];

    // Super Admin Marckv / admin has all permissions unconditionally
    if (this.authService.isAdmin()) {
      return ALL_PERMISSIONS.map(p => p.key);
    }

    const userRole = (user.role || 'OPERATOR') as 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE';
    const roleMap = this.rolePermissionsSignal();
    let perms: PermissionKey[] = [...(roleMap[userRole] || DEFAULT_ROLE_PERMISSIONS[userRole] || [])];

    // Check user overrides
    const userId = user.id || user.username;
    const overrides = this.userOverridesSignal()[userId];
    if (overrides) {
      for (const [key, val] of Object.entries(overrides)) {
        const pKey = key as PermissionKey;
        if (val && !perms.includes(pKey)) {
          perms.push(pKey);
        } else if (!val && perms.includes(pKey)) {
          perms = perms.filter(k => k !== pKey);
        }
      }
    }

    return perms;
  });

  // Granular capability booleans
  public canViewOperations = computed(() => this.hasPermission('CAN_VIEW_OPERATIONS'));
  public canRecordData = computed(() => this.hasPermission('CAN_RECORD_DATA'));
  public canFillVehicles = computed(() => this.hasPermission('CAN_FILL_VEHICLES'));
  public canManageCrew = computed(() => this.hasPermission('CAN_MANAGE_CREW'));
  public canCloseShift = computed(() => this.hasPermission('CAN_CLOSE_SHIFT'));
  public canDeleteRecords = computed(() => this.hasPermission('CAN_DELETE_RECORDS'));
  public canAccessAdmin = computed(() => this.hasPermission('CAN_ACCESS_ADMIN'));

  // Granular Window / Module Booleans
  public canViewDashboard = computed(() => this.hasPermission('VIEW_DASHBOARD'));
  public canViewShiftHandover = computed(() => this.hasPermission('VIEW_SHIFT_HANDOVER'));
  public canViewCrew = computed(() => this.hasPermission('VIEW_CREW'));
  public canViewRoster = computed(() => this.hasPermission('VIEW_ROSTER'));
  public canViewPumps = computed(() => this.hasPermission('VIEW_PUMPS'));
  public canViewCyclones = computed(() => this.hasPermission('VIEW_CYCLONES'));
  public canViewTailings = computed(() => this.hasPermission('VIEW_TAILINGS'));
  public canViewFlowsheet = computed(() => this.hasPermission('VIEW_FLOWSHEET'));
  public canViewMaintenance = computed(() => this.hasPermission('VIEW_MAINTENANCE'));
  public canViewCalculators = computed(() => this.hasPermission('VIEW_CALCULATORS'));
  public canViewVehicleChecklist = computed(() => this.hasPermission('VIEW_VEHICLE_CHECKLIST'));
  public canViewAdminWindow = computed(() => this.hasPermission('VIEW_ADMIN') || this.authService.isAdmin());

  public canAccessModule(routeOrKey: string): boolean {
    if (this.authService.isAdmin()) return true;
    const cleanRoute = routeOrKey.split('?')[0].split('#')[0];
    const key = (cleanRoute.startsWith('/') ? MODULE_ROUTE_TO_PERMISSION[cleanRoute] : cleanRoute) as PermissionKey;
    if (!key) return true;
    return this.hasPermission(key);
  }

  constructor() {
    this.refreshMatrix();
  }

  public hasPermission(permission: PermissionKey): boolean {
    if (this.authService.isAdmin()) return true;
    return this.effectivePermissions().includes(permission);
  }

  public hasRole(roles: Array<'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE'>): boolean {
    if (this.authService.isAdmin()) return true;
    const role = this.authService.currentUser()?.role;
    return !!role && roles.includes(role as any);
  }

  public refreshMatrix(): void {
    this.http.get<{ success: boolean; rolePermissions: any; userOverrides: any }>(this.apiUrl).pipe(
      tap(res => {
        if (res && res.success) {
          if (res.rolePermissions) {
            this.rolePermissionsSignal.set(res.rolePermissions);
            // Caché de una lectura GET: no debe emitirse como cambio local (ADR-014/015)
            saveRealtimeData('basetrack_role_permissions', res.rolePermissions, { skipBroadcast: true });
          }
          if (res.userOverrides) {
            this.userOverridesSignal.set(res.userOverrides);
            saveRealtimeData('basetrack_user_permission_overrides', res.userOverrides, { skipBroadcast: true });
          }
        }
      }),
      catchError(err => {
        console.warn('[PermissionsService] Backend no disponible, usando matriz local/offline:', err);
        return of(null);
      })
    ).subscribe();
  }

  public updateRolePermission(role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'MAINTENANCE', permissions: PermissionKey[]): Observable<any> {
    const snapshot = this.snapshot();
    const updated = { ...this.rolePermissionsSignal(), [role]: permissions };
    this.rolePermissionsSignal.set(updated);
    saveRealtimeData('basetrack_role_permissions', updated);

    return this.http.put(`${this.apiUrl}/roles`, { role, permissions }).pipe(
      catchError(err => this.handleWriteError(err, snapshot))
    );
  }

  public updateUserOverride(userId: string, overrides: Record<string, boolean>): Observable<any> {
    const snapshot = this.snapshot();
    const current = { ...this.userOverridesSignal() };
    if (Object.keys(overrides).length === 0) {
      delete current[userId];
    } else {
      current[userId] = overrides;
    }
    this.userOverridesSignal.set(current);
    saveRealtimeData('basetrack_user_permission_overrides', current);

    return this.http.put(`${this.apiUrl}/users/${userId}`, { permissions: overrides }).pipe(
      catchError(err => this.handleWriteError(err, snapshot))
    );
  }

  public resetToDefaults(): Observable<any> {
    const snapshot = this.snapshot();
    this.rolePermissionsSignal.set({ ...DEFAULT_ROLE_PERMISSIONS });
    this.userOverridesSignal.set({});
    saveRealtimeData('basetrack_role_permissions', DEFAULT_ROLE_PERMISSIONS);
    saveRealtimeData('basetrack_user_permission_overrides', {});

    return this.http.post(`${this.apiUrl}/reset`, {}).pipe(
      catchError(err => this.handleWriteError(err, snapshot))
    );
  }

  private snapshot(): { roles: any; overrides: any } {
    return { roles: this.rolePermissionsSignal(), overrides: this.userOverridesSignal() };
  }

  /** Sin red se conserva el cambio local; si el servidor lo rechaza, se revierte y se informa. */
  private handleWriteError(err: any, snapshot: { roles: any; overrides: any }): Observable<any> {
    if (isNetworkError(err)) {
      return of({ success: true, localOnly: true });
    }
    this.rolePermissionsSignal.set(snapshot.roles);
    this.userOverridesSignal.set(snapshot.overrides);
    saveRealtimeData('basetrack_role_permissions', snapshot.roles);
    saveRealtimeData('basetrack_user_permission_overrides', snapshot.overrides);
    this.refreshMatrix();
    return throwError(() => new Error(serverErrorMessage(err, 'El servidor rechazó el cambio de permisos.')));
  }
}
