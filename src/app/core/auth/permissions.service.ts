import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { getApiBaseUrl } from '../constants/api.config';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';
import { AuthService } from './auth.service';

export type PermissionKey =
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
  category: 'OPERACIONES' | 'GESTIÓN' | 'SEGURIDAD';
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
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

export const DEFAULT_ROLE_PERMISSIONS: Record<'ADMIN' | 'SUPERVISOR' | 'OPERATOR', PermissionKey[]> = {
  ADMIN: [
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT',
    'CAN_DELETE_RECORDS',
    'CAN_ACCESS_ADMIN'
  ],
  SUPERVISOR: [
    'CAN_VIEW_OPERATIONS',
    'CAN_RECORD_DATA',
    'CAN_FILL_VEHICLES',
    'CAN_MANAGE_CREW',
    'CAN_CLOSE_SHIFT'
  ],
  OPERATOR: [
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
  public rolePermissionsSignal = signal<Record<'ADMIN' | 'SUPERVISOR' | 'OPERATOR', PermissionKey[]>>(
    getRealtimeData('basetrack_role_permissions', DEFAULT_ROLE_PERMISSIONS)
  );

  public userOverridesSignal = signal<Record<string, Record<string, boolean>>>(
    getRealtimeData('basetrack_user_permission_overrides', {})
  );

  // Computed helper: current effective permissions array for logged-in user
  public effectivePermissions = computed<PermissionKey[]>(() => {
    const user = this.authService.currentUser();
    if (!user) return [];

    // Super Admin KlismanV / admin has all permissions unconditionally
    if (this.authService.isAdmin()) {
      return ALL_PERMISSIONS.map(p => p.key);
    }

    const userRole = (user.role || 'OPERATOR') as 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
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

  constructor() {
    this.refreshMatrix();
  }

  public hasPermission(permission: PermissionKey): boolean {
    if (this.authService.isAdmin()) return true;
    return this.effectivePermissions().includes(permission);
  }

  public hasRole(roles: Array<'ADMIN' | 'SUPERVISOR' | 'OPERATOR'>): boolean {
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
            saveRealtimeData('basetrack_role_permissions', res.rolePermissions);
          }
          if (res.userOverrides) {
            this.userOverridesSignal.set(res.userOverrides);
            saveRealtimeData('basetrack_user_permission_overrides', res.userOverrides);
          }
        }
      }),
      catchError(err => {
        console.warn('[PermissionsService] Backend no disponible, usando matriz local/offline:', err);
        return of(null);
      })
    ).subscribe();
  }

  public updateRolePermission(role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR', permissions: PermissionKey[]): Observable<any> {
    const updated = { ...this.rolePermissionsSignal(), [role]: permissions };
    this.rolePermissionsSignal.set(updated);
    saveRealtimeData('basetrack_role_permissions', updated);

    return this.http.put(`${this.apiUrl}/roles`, { role, permissions }).pipe(
      catchError(() => of({ success: true, localOnly: true }))
    );
  }

  public updateUserOverride(userId: string, overrides: Record<string, boolean>): Observable<any> {
    const current = { ...this.userOverridesSignal() };
    if (Object.keys(overrides).length === 0) {
      delete current[userId];
    } else {
      current[userId] = overrides;
    }
    this.userOverridesSignal.set(current);
    saveRealtimeData('basetrack_user_permission_overrides', current);

    return this.http.put(`${this.apiUrl}/users/${userId}`, { permissions: overrides }).pipe(
      catchError(() => of({ success: true, localOnly: true }))
    );
  }

  public resetToDefaults(): Observable<any> {
    this.rolePermissionsSignal.set({ ...DEFAULT_ROLE_PERMISSIONS });
    this.userOverridesSignal.set({});
    saveRealtimeData('basetrack_role_permissions', DEFAULT_ROLE_PERMISSIONS);
    saveRealtimeData('basetrack_user_permission_overrides', {});

    return this.http.post(`${this.apiUrl}/reset`, {}).pipe(
      catchError(() => of({ success: true, localOnly: true }))
    );
  }
}
