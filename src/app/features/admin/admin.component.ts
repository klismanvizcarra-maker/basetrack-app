import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl, getCustomApiUrl, setCustomApiUrl, DEFAULT_CLOUD_BACKEND_URL } from '../../core/constants/api.config';
import { timeout, finalize } from 'rxjs';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { CloudSyncService } from '../../core/services/cloud-sync.service';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';
import { CrewService, SupervisorData, CrewMember, SupervisorOperatorItem } from '../../core/services/crew.service';
import { PermissionsService, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PermissionKey, PermissionDefinition } from '../../core/auth/permissions.service';
import { PlantParametersService, PlantParameters, DEFAULT_PLANT_PARAMETERS } from '../../core/services/plant-parameters.service';
import { VehicleChecklistService, VehicleInfo } from '../../core/services/vehicle-checklist.service';
import { resetGuardsCatalog } from '../../shared/utils/roster.util';

export interface UserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
  shift: string;
  avatar_url: string;
  created_at: string;
  is_active?: number | boolean;
  document_id?: string;
}

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

export interface AuditLog {
  id: string;
  username: string;
  action: string;
  entity: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

const DEFAULT_USERS: UserItem[] = [
  {
    id: 'u-marckv',
    username: 'Marckv',
    email: 'marckvizcarra@basetrack.com',
    full_name: 'Marck Vizcarra',
    role: 'ADMIN',
    shift: 'ADMIN',
    document_id: '',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    created_at: new Date().toISOString()
  }
];

const DEFAULT_LOGS: AuditLog[] = [
  {
    id: 'l-1',
    username: 'Marckv',
    action: 'LOGIN',
    entity: 'AUTH',
    details: 'Inicio de sesion administrativo verificado con exito',
    ip_address: '192.168.1.104',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  }
];

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  // Estilos con alcance manual (.admin-scope) para compartirlos con los componentes de cada pestaña
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  offlineSync = inject(OfflineSyncService);
  cloudSync = inject(CloudSyncService);
  crewService = inject(CrewService);
  permissionsService = inject(PermissionsService);
  plantParamsService = inject(PlantParametersService);
  vehicleChecklistService = inject(VehicleChecklistService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Navegación por Apartados en Administrador
  activeAdminTab: 'SUPERVISORS_CREW' | 'USERS_ROLES' | 'TERMINALS_SYNC' | 'AUDIT_LOGS' | 'PERMISSIONS_MATRIX' | 'PLANT_PARAMETERS' | 'VEHICLES_FLEET' = 'SUPERVISORS_CREW';

  // Flota de Camionetas Mineras 4x4
  vehiclesList: VehicleInfo[] = [];
  isLoadingVehicles = false;
  vehiclesSearchQuery = '';
  vehiclesFilterStatus: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  isCreateVehicleModalOpen = false;
  isEditVehicleModalOpen = false;
  selectedVehicleForEdit: VehicleInfo | null = null;
  vehicleFormPlate = '';
  vehicleFormTag = '';
  vehicleFormModel = 'Toyota Hilux 4x4 Turbodiésel';
  vehicleFormColor = 'Blanco Industrial';
  vehicleFormArea = 'Supervisión de Operaciones';
  vehicleFormBaseOdometer = 0;
  vehicleFormIsActive = true;
  isSavingVehicle = false;
  vehicleActionSuccessMessage = '';
  vehicleActionErrorMessage = '';
  vehicleModalErrorMessage = '';

  get activeVehiclesCount(): number {
    return this.vehiclesList.filter(v => v.is_active !== 0 && v.is_active !== false).length;
  }

  get decommissionedVehiclesCount(): number {
    return this.vehiclesList.filter(v => v.is_active === 0 || v.is_active === false).length;
  }

  get totalFleetOdometer(): number {
    return this.vehiclesList.reduce((acc, v) => acc + (Number(v.currentOdometer) || Number(v.baseOdometer) || 0), 0);
  }

  get filteredVehiclesList(): VehicleInfo[] {
    return this.vehiclesList.filter(veh => {
      if (this.vehiclesFilterStatus === 'ACTIVE' && (veh.is_active === 0 || veh.is_active === false)) return false;
      if (this.vehiclesFilterStatus === 'INACTIVE' && (veh.is_active !== 0 && veh.is_active !== false)) return false;

      const q = (this.vehiclesSearchQuery || '').trim().toLowerCase();
      if (!q) return true;

      const matchesPlate = (veh.plate || '').toLowerCase().includes(q);
      const matchesTag = (veh.tag || '').toLowerCase().includes(q);
      const matchesModel = (veh.model || '').toLowerCase().includes(q);
      const matchesArea = (veh.area || '').toLowerCase().includes(q);
      const matchesDriver = (veh.lastDriverName || '').toLowerCase().includes(q);

      return matchesPlate || matchesTag || matchesModel || matchesArea || matchesDriver;
    });
  }

  // Parámetros de Planta & Metas Operacionales
  editablePlantParams: PlantParameters = { ...DEFAULT_PLANT_PARAMETERS };
  isSavingPlantParams = false;
  plantParamsSuccessMessage = '';
  plantParamsErrorMessage = '';

  // Matriz de Permisos & Seguridad
  allPermissionsList = ALL_PERMISSIONS;
  selectedOverrideUserId = '';
  permissionsSaveMessage = '';
  permFilterCategory: 'ALL' | 'OPERACIONES' | 'GESTIÓN' | 'SEGURIDAD' = 'ALL';
  permSearchQuery = '';

  get filteredPermissionsList(): PermissionDefinition[] {
    return this.allPermissionsList.filter(p => {
      const matchesCat = this.permFilterCategory === 'ALL' || p.category === this.permFilterCategory;
      const q = (this.permSearchQuery || '').trim().toLowerCase();
      const matchesQuery = !q || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }

  getRolePermCount(role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR'): number {
    if (role === 'ADMIN') return this.allPermissionsList.length;
    const rolePerms = this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    return rolePerms.length;
  }

  isRolePermitted(role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR', key: PermissionKey): boolean {
    if (role === 'ADMIN') return true;
    const rolePerms = this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    return rolePerms.includes(key);
  }

  toggleRolePermDirect(role: 'SUPERVISOR' | 'OPERATOR', key: PermissionKey): void {
    const current = [...(this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [])];
    const isCurrentlyPermitted = current.includes(key);
    let updated: PermissionKey[];
    if (isCurrentlyPermitted) {
      updated = current.filter(k => k !== key);
    } else {
      updated = Array.from(new Set([...current, key]));
    }
    this.permissionsService.updateRolePermission(role, updated).subscribe();
  }

  setAllPermsForRole(role: 'SUPERVISOR' | 'OPERATOR', enable: boolean): void {
    const allKeys = this.allPermissionsList.map(p => p.key);
    const updated = enable ? allKeys : [];
    this.permissionsService.updateRolePermission(role, updated).subscribe(() => {
      this.permissionsSaveMessage = `⚡ Permisos para ${role} actualizados (${enable ? 'Todos Habilitados' : 'Todos Restringidos'}).`;
      setTimeout(() => this.permissionsSaveMessage = '', 3500);
    });
  }

  toggleRolePerm(role: 'SUPERVISOR' | 'OPERATOR', key: PermissionKey, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const current = [...(this.permissionsService.rolePermissionsSignal()[role] || DEFAULT_ROLE_PERMISSIONS[role] || [])];
    let updated: PermissionKey[];
    if (checkbox.checked) {
      updated = Array.from(new Set([...current, key]));
    } else {
      updated = current.filter(k => k !== key);
    }
    this.permissionsService.updateRolePermission(role, updated).subscribe();
  }

  saveRolePermissionsMatrix(): void {
    this.permissionsSaveMessage = '✅ Matriz de permisos por rol guardada y sincronizada correctamente.';
    setTimeout(() => this.permissionsSaveMessage = '', 4000);
  }

  resetPermissionsToDefault(): void {
    if (confirm('¿Confirma restaurar la matriz de permisos y excepciones a los valores de fábrica?')) {
      this.permissionsService.resetToDefaults().subscribe(() => {
        this.permissionsSaveMessage = '🔄 Matriz restaurada a valores por defecto de fábrica.';
        setTimeout(() => this.permissionsSaveMessage = '', 4000);
      });
    }
  }

  get selectedOverrideUser(): UserItem | null {
    if (!this.selectedOverrideUserId) return null;
    return this.users.find(u => u.id === this.selectedOverrideUserId) || null;
  }

  isEffectiveUserPermitted(user: UserItem, key: PermissionKey): boolean {
    if (user.role === 'ADMIN') return true;
    const overrides = this.permissionsService.userOverridesSignal()[user.id];
    if (overrides && typeof overrides[key] === 'boolean') {
      return overrides[key];
    }
    return this.isRolePermitted(user.role as any, key);
  }

  isOverridden(userId: string, key: PermissionKey): boolean {
    const overrides = this.permissionsService.userOverridesSignal()[userId];
    return !!overrides && typeof overrides[key] === 'boolean';
  }

  isInheritedFromRole(role: string, key: PermissionKey): boolean {
    return this.isRolePermitted(role as any, key);
  }

  toggleUserOverride(userId: string, key: PermissionKey, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const currentOverrides = { ...(this.permissionsService.userOverridesSignal()[userId] || {}) };
    currentOverrides[key] = checkbox.checked;
    this.permissionsService.updateUserOverride(userId, currentOverrides).subscribe(() => {
      this.permissionsSaveMessage = '✅ Excepción de permiso guardada para el usuario.';
      setTimeout(() => this.permissionsSaveMessage = '', 3500);
    });
  }

  clearUserOverrides(userId: string): void {
    this.permissionsService.updateUserOverride(userId, {}).subscribe(() => {
      this.permissionsSaveMessage = 'Excepciones removidas; el usuario hereda los permisos de su rol.';
      setTimeout(() => this.permissionsSaveMessage = '', 3500);
    });
  }

  hasCustomOverrides(userId: string): boolean {
    const overrides = this.permissionsService.userOverridesSignal()[userId];
    return !!overrides && Object.keys(overrides).length > 0;
  }

  // Supervisores y Operadores (Apartado Nuevo)
  supervisorsList: SupervisorData[] = [];
  allAvailableOperators: CrewMember[] = [];
  selectedSupervisor: SupervisorData | null = null;
  supervisorSearchQuery = '';
  isAssignOperatorModalOpen = false;
  operatorToAssignId = '';
  operatorSearchQuery = '';
  isAutoAssigning = false;

  // Inicialización con datos por defecto
  users: UserItem[] = [...DEFAULT_USERS];
  logs: AuditLog[] = [...DEFAULT_LOGS];

  isCreateUserModalOpen = false;
  backupSuccessMessage = '';

  // Bulk Import State (Organizado por Guardias y Supervisores)
  isBulkModalOpen = false;
  bulkTab: 'CSV' | 'PASTE' = 'CSV';
  bulkTargetShift: 'TODAS' | 'G1' | 'G2' | 'G3' | 'G4' = 'TODAS';
  bulkPreviewFilterShift: 'TODAS' | 'G1' | 'G2' | 'G3' | 'G4' = 'TODAS';
  pastedText = '';
  isImporting = false;
  parsedBulkUsers: any[] = [];

  // Reset App State (Limpieza Total con Clave)
  isResetAppModalOpen = false;
  resetAppPassword = '';
  resetAppErrorMessage = '';
  isResettingApp = false;

  // Toolbar & Search Filters (Punto 1)
  userSearchQuery = '';
  userFilterShift = 'TODAS';
  userFilterRole = 'TODOS';

  // Connected Devices / Fleet Manager (Punto 5)
  connectedDevices: ConnectedDevice[] = [];
  isLoadingDevices = false;
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

  // Modal: Edit User Role & Shift (Punto 1)
  isEditUserModalOpen = false;
  selectedUserForEdit: UserItem | null = null;
  editRole: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' = 'OPERATOR';
  editShift = 'G1';
  isSavingUser = false;

  // Modal: Reset Password (Punto 1)
  isResetPasswordModalOpen = false;
  selectedUserForReset: UserItem | null = null;
  resetNewPassword = '';

  // Contraseñas temporales emitidas por el servidor (importación o restablecimiento): se muestran una vez
  issuedCredentials: Array<{ username: string; full_name: string; temporaryPassword: string }> = [];
  isCredentialsModalOpen = false;
  credentialsCopied = false;

  private showIssuedCredentials(list: Array<{ username: string; full_name: string; temporaryPassword: string }> | undefined): void {
    if (!list || list.length === 0) return;
    this.issuedCredentials = list;
    this.credentialsCopied = false;
    this.isCredentialsModalOpen = true;
  }

  closeCredentialsModal(): void {
    // Se descartan de la memoria al cerrar: no se guardan en el dispositivo
    this.isCredentialsModalOpen = false;
    this.issuedCredentials = [];
  }

  copyIssuedCredentials(): void {
    const text = this.issuedCredentials.map(c => `${c.username}\t${c.full_name}\t${c.temporaryPassword}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      this.credentialsCopied = true;
      this.cdr.detectChanges();
    }).catch(() => alert('No se pudo copiar al portapapeles. Usa "Descargar CSV".'));
  }

  downloadIssuedCredentials(): void {
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = 'username,full_name,temporary_password\n' +
      this.issuedCredentials.map(c => [c.username, c.full_name, c.temporaryPassword].map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credenciales_temporales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Cloud Backend Configuration
  isBackendConfigModalOpen = false;
  customApiUrlInput = '';
  isTestingApiConnection = false;
  apiConnectionTestStatus: 'idle' | 'success' | 'error' = 'idle';
  apiConnectionTestMessage = '';
  isVercelDeployment = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  currentApiUrl = getApiBaseUrl();

  get hasCustomCloudBackend(): boolean {
    return !!getCustomApiUrl() || !!DEFAULT_CLOUD_BACKEND_URL;
  }

  openBackendConfigModal(): void {
    this.customApiUrlInput = getCustomApiUrl();
    this.apiConnectionTestStatus = 'idle';
    this.apiConnectionTestMessage = '';
    this.isBackendConfigModalOpen = true;
  }

  testBackendConnection(): void {
    const raw = this.customApiUrlInput.trim() || getApiBaseUrl();
    let cleanUrl = raw.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl += '/api';
    }

    this.isTestingApiConnection = true;
    this.apiConnectionTestStatus = 'idle';
    this.apiConnectionTestMessage = 'Probando conexión con el servidor cloud...';

    this.http.get<any>(`${cleanUrl}/sync/status`).pipe(timeout(12000)).subscribe({
      next: (res) => {
        this.isTestingApiConnection = false;
        this.apiConnectionTestStatus = 'success';
        this.apiConnectionTestMessage = `¡Conexión Exitosa! Servidor en línea (Estado: ${res?.status || 'OK'}, Hora: ${res?.server_time || 'OK'}).`;
      },
      error: (err) => {
        this.isTestingApiConnection = false;
        this.apiConnectionTestStatus = 'error';
        this.apiConnectionTestMessage = `No se pudo conectar a ${cleanUrl} (${err.status ? 'Error HTTP ' + err.status : 'Timeout o Error de Red'}). Asegúrate de usar HTTPS en la nube y que el backend esté en ejecución.`;
      }
    });
  }

  saveBackendConfig(): void {
    setCustomApiUrl(this.customApiUrlInput.trim());
    this.currentApiUrl = getApiBaseUrl();
    this.isBackendConfigModalOpen = false;
    this.backupSuccessMessage = 'URL de servidor central actualizada. Sincronizando con la nube...';
    setTimeout(() => this.backupSuccessMessage = '', 6000);
    this.cloudSync.forceSync();
    this.loadUsers();
    this.loadLogs();
  }

  resetBackendToDefault(): void {
    setCustomApiUrl('');
    this.customApiUrlInput = '';
    this.currentApiUrl = getApiBaseUrl();
    this.apiConnectionTestStatus = 'idle';
    this.apiConnectionTestMessage = 'Restablecido al endpoint por defecto.';
  }

  get filteredUsers(): UserItem[] {
    return this.users.filter(u => {
      // Shift filter
      if (this.userFilterShift !== 'TODAS' && u.shift !== this.userFilterShift) {
        return false;
      }
      // Role filter
      if (this.userFilterRole !== 'TODOS' && u.role !== this.userFilterRole) {
        return false;
      }
      // Search query
      if (this.userSearchQuery.trim()) {
        const q = this.userSearchQuery.toLowerCase().trim();
        const username = (u.username || '').toLowerCase();
        const fullName = (u.full_name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return username.includes(q) || fullName.includes(q) || email.includes(q);
      }
      return true;
    });
  }

  newUser = {
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'OPERATOR' as const,
    shift: 'G1'
  };

  private syncListener = (e: any) => {
    if (e.detail?.source === 'local') return;
    const ent = (e.detail?.entity || '').toLowerCase();
    const key = (e.detail?.key || '').toLowerCase();
    if (
      ent.includes('user') ||
      ent.includes('device') ||
      ent.includes('terminal') ||
      ent.includes('param') ||
      ent.includes('planta') ||
      ent.includes('permission') ||
      ent.includes('crew') ||
      ent.includes('cuadrilla') ||
      ent.includes('vehicle') ||
      ent.includes('camioneta') ||
      key.includes('user') ||
      key.includes('device') ||
      key.includes('param') ||
      key.includes('permission') ||
      key.includes('crew') ||
      key.includes('vehicle')
    ) {
      this.ngZone.run(() => {
        this.loadUsers();
        this.loadLogs();
        this.loadConnectedDevices();
        this.loadSupervisorsAndOperators();
        this.loadPlantParameters();
        this.loadVehiclesFleet();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  };

  ngOnInit(): void {
    // Precarga síncrona instantánea (0ms) para Vercel y móviles
    const initialGuards = this.crewService.loadCachedSupervisorOperators();
    this.supervisorsList = initialGuards;
    this.selectedSupervisor = initialGuards[0] || null;
    this.allAvailableOperators = this.crewService.defaultMembers.filter(m => m.primary_role !== 'SUPERVISOR');

    this.loadFromStorage();
    this.loadUsers();
    this.loadLogs();
    this.loadConnectedDevices();
    this.loadSupervisorsAndOperators();
    this.loadPlantParameters();
    this.loadVehiclesFleet();

    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  loadVehiclesFleet(): void {
    this.isLoadingVehicles = true;
    this.vehicleChecklistService.getAllVehiclesAdmin().subscribe({
      next: (res) => {
        this.isLoadingVehicles = false;
        if (res && res.success && Array.isArray(res.data)) {
          this.vehiclesList = res.data;
        } else {
          this.vehiclesList = this.vehicleChecklistService.vehicles();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingVehicles = false;
        this.vehiclesList = this.vehicleChecklistService.vehicles();
        this.cdr.markForCheck();
      }
    });
  }

  openCreateVehicleModal(): void {
    this.vehicleFormPlate = '';
    const nextNum = this.vehiclesList.length + 1;
    this.vehicleFormTag = `CAM-${nextNum < 10 ? '0' + nextNum : nextNum}`;
    this.vehicleFormModel = 'Toyota Hilux 4x4 Turbodiésel';
    this.vehicleFormColor = 'Blanco Industrial';
    this.vehicleFormArea = 'Supervisión de Operaciones';
    this.vehicleFormBaseOdometer = 0;
    this.vehicleModalErrorMessage = '';
    this.isCreateVehicleModalOpen = true;
  }

  submitCreateVehicle(): void {
    const rawPlate = (this.vehicleFormPlate || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!rawPlate || rawPlate.length < 3) {
      this.vehicleModalErrorMessage = 'La placa vehicular es obligatoria (mínimo 3 caracteres).';
      return;
    }

    this.isSavingVehicle = true;
    this.vehicleModalErrorMessage = '';

    this.vehicleChecklistService.createVehicle({
      plate: rawPlate,
      tag: (this.vehicleFormTag || '').toUpperCase().trim(),
      model: this.vehicleFormModel.trim(),
      color: this.vehicleFormColor.trim(),
      area: this.vehicleFormArea.trim(),
      baseOdometer: Number(this.vehicleFormBaseOdometer) || 0,
      is_active: 1
    }).subscribe({
      next: (res) => {
        this.isSavingVehicle = false;
        if (res && res.success) {
          this.isCreateVehicleModalOpen = false;
          this.vehicleActionSuccessMessage = `¡Camioneta ${rawPlate} dada de alta exitosamente en el padrón!`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        } else {
          this.vehicleModalErrorMessage = res?.message || 'Error al dar de alta la camioneta.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingVehicle = false;
        this.vehicleModalErrorMessage = err?.error?.message || err?.message || 'Error al comunicarse con el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  openEditVehicleModal(veh: VehicleInfo): void {
    this.selectedVehicleForEdit = veh;
    this.vehicleFormPlate = veh.plate;
    this.vehicleFormTag = veh.tag;
    this.vehicleFormModel = veh.model;
    this.vehicleFormColor = veh.color;
    this.vehicleFormArea = veh.area;
    this.vehicleFormBaseOdometer = veh.baseOdometer;
    this.vehicleFormIsActive = veh.is_active !== 0 && veh.is_active !== false;
    this.vehicleModalErrorMessage = '';
    this.isEditVehicleModalOpen = true;
  }

  submitEditVehicle(): void {
    if (!this.selectedVehicleForEdit) return;

    const rawPlate = (this.vehicleFormPlate || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!rawPlate || rawPlate.length < 3) {
      this.vehicleModalErrorMessage = 'La placa vehicular es obligatoria.';
      return;
    }

    this.isSavingVehicle = true;
    this.vehicleModalErrorMessage = '';

    const idOrPlate = this.selectedVehicleForEdit.id || this.selectedVehicleForEdit.plate;

    this.vehicleChecklistService.updateVehicle(idOrPlate, {
      plate: rawPlate,
      tag: (this.vehicleFormTag || '').toUpperCase().trim(),
      model: this.vehicleFormModel.trim(),
      color: this.vehicleFormColor.trim(),
      area: this.vehicleFormArea.trim(),
      baseOdometer: Number(this.vehicleFormBaseOdometer) || 0,
      is_active: this.vehicleFormIsActive ? 1 : 0
    }).subscribe({
      next: (res) => {
        this.isSavingVehicle = false;
        if (res && res.success) {
          this.isEditVehicleModalOpen = false;
          this.vehicleActionSuccessMessage = `¡Camioneta ${rawPlate} actualizada con éxito en el padrón!`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        } else {
          this.vehicleModalErrorMessage = res?.message || 'Error al actualizar la camioneta.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingVehicle = false;
        this.vehicleModalErrorMessage = err?.error?.message || err?.message || 'Error al actualizar datos.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleVehicleActiveStatus(veh: VehicleInfo): void {
    const isCurrentlyActive = veh.is_active !== 0 && veh.is_active !== false;
    const confirmMsg = isCurrentlyActive
      ? `¿Estás seguro de dar de baja la camioneta ${veh.plate} (${veh.tag})? Ya no estará disponible para realizar checklists en terreno.`
      : `¿Deseas reactivar la camioneta ${veh.plate} (${veh.tag}) en el padrón operacional?`;

    if (!confirm(confirmMsg)) return;

    const idOrPlate = veh.id || veh.plate;
    this.vehicleChecklistService.toggleVehicleStatus(idOrPlate, !isCurrentlyActive).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.vehicleActionSuccessMessage = `Camioneta ${veh.plate} ${isCurrentlyActive ? 'dada de baja' : 'reactivada'} exitosamente.`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        }
      },
      error: (err) => {
        this.vehicleActionErrorMessage = err?.error?.message || 'Error al cambiar estado de la unidad.';
        setTimeout(() => this.vehicleActionErrorMessage = '', 5000);
      }
    });
  }

  deleteVehicleFromFleet(veh: VehicleInfo): void {
    if (!confirm(`¿Deseas eliminar la camioneta ${veh.plate} (${veh.tag}) del padrón? Si tiene inspecciones registradas, se dará de baja automáticamente para resguardar la trazabilidad.`)) {
      return;
    }

    const idOrPlate = veh.id || veh.plate;
    this.vehicleChecklistService.deleteVehicle(idOrPlate).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.vehicleActionSuccessMessage = res.message || `Camioneta ${veh.plate} procesada del padrón.`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        }
      },
      error: (err) => {
        this.vehicleActionErrorMessage = err?.error?.message || 'Error al eliminar unidad.';
        setTimeout(() => this.vehicleActionErrorMessage = '', 5000);
      }
    });
  }

  loadPlantParameters(): void {
    this.editablePlantParams = { ...this.plantParamsService.parameters() };
    this.plantParamsService.fetchFromBackend().subscribe(params => {
      if (params) {
        this.editablePlantParams = { ...params };
      }
    });
  }

  savePlantParameters(): void {
    this.isSavingPlantParams = true;
    this.plantParamsSuccessMessage = '';
    this.plantParamsErrorMessage = '';

    this.plantParamsService.saveParameters(this.editablePlantParams).subscribe({
      next: (res) => {
        this.isSavingPlantParams = false;
        if (res && res.data) {
          this.editablePlantParams = { ...res.data };
        }
        this.plantParamsSuccessMessage = '¡Parámetros de planta y metas operacionales guardados con éxito!';
        setTimeout(() => this.plantParamsSuccessMessage = '', 6000);
      },
      error: (err) => {
        this.isSavingPlantParams = false;
        this.plantParamsErrorMessage = err?.error?.message || err?.message || 'Error al guardar los parámetros.';
        setTimeout(() => this.plantParamsErrorMessage = '', 6000);
      }
    });
  }

  resetPlantParametersToDefaults(): void {
    if (confirm('¿Confirmas restablecer todos los parámetros de planta a los valores nominales de fábrica?')) {
      this.isSavingPlantParams = true;
      this.plantParamsService.resetToDefaults().subscribe({
        next: (res) => {
          this.isSavingPlantParams = false;
          if (res && res.data) {
            this.editablePlantParams = { ...res.data };
          }
          this.plantParamsSuccessMessage = 'Parámetros restablecidos a los valores nominales de fábrica.';
          setTimeout(() => this.plantParamsSuccessMessage = '', 6000);
        },
        error: () => {
          this.isSavingPlantParams = false;
        }
      });
    }
  }

  loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const storedUsers = localStorage.getItem('basetrack_admin_users');
        if (storedUsers) {
          const parsed = JSON.parse(storedUsers);
          const hasOldMockUsers = Array.isArray(parsed) && parsed.some((u: any) => 
            u.username === 'KlismanV' || 
            u.username === 'CarlosP' || 
            u.username === 'WalterQ' || 
            u.username === 'admin' || 
            u.username === 'supervisor_a' ||
            u.username?.startsWith('op_test_') ||
            u.full_name?.includes('TEST') ||
            u.full_name?.includes('PRUEBA') ||
            (u.email && u.email.includes('@test.com'))
          );
          const marckExists = Array.isArray(parsed) && parsed.some((u: any) => u.username === 'Marckv');
          if (Array.isArray(parsed) && !hasOldMockUsers && marckExists) {
            this.users = parsed.filter((u: any) => 
              !u.username?.startsWith('op_test_') &&
              !u.full_name?.includes('TEST') &&
              !u.full_name?.includes('PRUEBA') &&
              (u.username === 'Marckv' || u.role !== 'ADMIN')
            );
          } else {
            this.users = [...DEFAULT_USERS];
            localStorage.setItem('basetrack_admin_users', JSON.stringify(DEFAULT_USERS));
          }
        } else {
          this.users = [...DEFAULT_USERS];
          localStorage.setItem('basetrack_admin_users', JSON.stringify(DEFAULT_USERS));
        }

        const storedLogs = localStorage.getItem('basetrack_admin_logs');
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          const hasOldLogs = Array.isArray(parsed) && parsed.some((l: any) => l.username === 'admin' || l.username === 'supervisor_a');
          if (Array.isArray(parsed) && parsed.length > 0 && !hasOldLogs) {
            this.logs = parsed;
          } else {
            this.logs = [...DEFAULT_LOGS];
            localStorage.setItem('basetrack_admin_logs', JSON.stringify(DEFAULT_LOGS));
          }
        } else {
          this.logs = [...DEFAULT_LOGS];
          localStorage.setItem('basetrack_admin_logs', JSON.stringify(DEFAULT_LOGS));
        }
      } catch (e) {
        console.warn('Error reading from storage', e);
      }
    }
  }

  restoreDefaults(): void {
    this.users = [...DEFAULT_USERS];
    this.logs = [...DEFAULT_LOGS];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
      localStorage.setItem('basetrack_admin_logs', JSON.stringify(this.logs));
    }
  }

  loadUsers(): void {
    this.http.get<any>(`${getApiBaseUrl()}/admin/users`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.users = res.data.filter((u: any) => 
            !u.username?.startsWith('op_test_') &&
            !u.full_name?.includes('TEST') &&
            !u.full_name?.includes('PRUEBA') &&
            (u.username === 'Marckv' || u.role !== 'ADMIN')
          );
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
          }
        }
      },
      error: () => {
        // Fallback enriquecido ya activo en el estado y almacenamiento
      }
    });
  }

  loadLogs(): void {
    this.http.get<any>(`${getApiBaseUrl()}/admin/audit-logs`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.logs = res.data;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('basetrack_admin_logs', JSON.stringify(this.logs));
          }
        }
      },
      error: () => {
        // Fallback enriquecido ya activo en el estado y almacenamiento
      }
    });
  }

  saveUser(): void {
    alert('La creación manual de usuarios está estrictamente deshabilitada (PROHIBIDO). La plataforma opera exclusivamente con la nómina oficial del CSV.');
    this.isCreateUserModalOpen = false;
  }

  exportBackup(): void {
    this.http.get<any>(`${getApiBaseUrl()}/admin/backup`).subscribe({
      next: (res) => {
        if (res && res.success && res.backup) {
          const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `basetrack_backup_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.backupSuccessMessage = 'Copia de seguridad exportada y descargada exitosamente en formato JSON seguro.';
          setTimeout(() => this.backupSuccessMessage = '', 5000);
        }
      },
      error: () => {
        const localBackup = {
          export_date: new Date().toISOString(),
          system: 'BASETRACK Industrial Platform',
          users: this.users,
          audit_logs: this.logs
        };
        const blob = new Blob([JSON.stringify(localBackup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `basetrack_local_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.backupSuccessMessage = 'Backup local seguro generado y descargado exitosamente.';
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      }
    });
  }

  onFileSelectedForRestore(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        const confirmed = window.confirm(`¿Confirmas la restauración del respaldo "${file.name}"?\nEsta acción sincronizará y actualizará de forma segura las tablas del sistema.`);
        if (!confirmed) {
          input.value = '';
          return;
        }

        this.http.post<any>(`${getApiBaseUrl()}/admin/restore`, { backup: json.backup || json }).subscribe({
          next: (res) => {
            if (res && res.success) {
              this.backupSuccessMessage = '¡Respaldo restaurado exitosamente! Los datos del sistema han sido sincronizados.';
              setTimeout(() => this.backupSuccessMessage = '', 6000);
              this.loadUsers();
              this.loadLogs();
            }
          },
          error: (err) => {
            this.backupSuccessMessage = 'Error al restaurar: ' + (err.error?.message || err.message || 'Error de conexión');
            setTimeout(() => this.backupSuccessMessage = '', 6000);
          }
        });
      } catch (err: any) {
        alert('El archivo seleccionado no contiene un formato JSON válido: ' + err.message);
      } finally {
        input.value = '';
      }
    };

    reader.readAsText(file);
  }

  openBulkModal(preselectedShift: string = 'TODAS'): void {
    this.isImporting = false;
    this.isBulkModalOpen = true;
    this.bulkTab = 'CSV';
    this.pastedText = '';
    this.parsedBulkUsers = [];
    const validShift = ['G1', 'G2', 'G3', 'G4'].includes(preselectedShift) ? (preselectedShift as any) : 'TODAS';
    this.bulkTargetShift = validShift;
    this.bulkPreviewFilterShift = validShift;
    this.cdr.markForCheck();
  }

  get validBulkCount(): number {
    return this.parsedBulkUsers.filter(u => u.isValid).length;
  }

  get invalidBulkCount(): number {
    return this.parsedBulkUsers.filter(u => !u.isValid).length;
  }

  getSupervisorForShift(shift: string): { name: string; username: string; dni: string; email: string; avatar: string; role: string } {
    const s = this.supervisorsList.find(sup => sup.shift === shift);
    if (s) {
      return {
        name: s.full_name,
        username: s.username,
        dni: (s as any).document_id || (s as any).dni || '',
        email: s.email,
        avatar: s.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.username}`,
        role: s.role || 'SUPERVISOR'
      };
    }
    return {
      name: `Supervisor ${shift}`,
      username: `supervisor_${shift.toLowerCase()}`,
      dni: '',
      email: `supervisor_${shift.toLowerCase()}@basetrack.com`,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=sup_${shift}`,
      role: 'SUPERVISOR'
    };
  }

  setBulkPreviewFilterShift(shift: string): void {
    const valid = ['TODAS', 'G1', 'G2', 'G3', 'G4'].includes(shift) ? (shift as any) : 'TODAS';
    this.bulkPreviewFilterShift = valid;
  }

  onTargetShiftChange(newShift: 'TODAS' | 'G1' | 'G2' | 'G3' | 'G4'): void {
    this.bulkTargetShift = newShift;
    this.bulkPreviewFilterShift = newShift;
    if (newShift !== 'TODAS' && this.parsedBulkUsers.length > 0) {
      for (const u of this.parsedBulkUsers) {
        u.shift = newShift;
      }
    }
  }

  downloadTemplateCsv(mode: 'ALL' | 'TARGET' = 'TARGET'): void {
    const headers = 'username,full_name,email,password,role,shift,document_id,radio_channel,phone_extension,primary_role\n';

    const generateGuardRows = (shiftCode: string, supUser: string, supName: string, supDni: string, supExt: string) => {
      const idx = shiftCode.replace('G', '');
      return [
        `# --- GUARDIA ${shiftCode}: 1 SUPERVISOR + 7 OPERADORES ---`,
        `${supUser},${supName},${supUser.toLowerCase()}@basetrack.com,,SUPERVISOR,${shiftCode},${supDni},Canal 1 Operaciones,${supExt},SUPERVISOR`,
        `op_${shiftCode.toLowerCase()}_bombas,Operador Bombas ${shiftCode},bombas.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}1,Canal 3 Bombas,Ext. 4102,OPERADOR_BOMBAS`,
        `op_${shiftCode.toLowerCase()}_ciclon1,Operador Ciclones 1 ${shiftCode},ciclon1.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}2,Canal 2 Ciclones,Ext. 4103,OPERADOR_CICLONES_1`,
        `op_${shiftCode.toLowerCase()}_ciclon2,Operador Ciclones 2 ${shiftCode},ciclon2.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}3,Canal 2 Ciclones,Ext. 4104,OPERADOR_CICLONES_2`,
        `op_${shiftCode.toLowerCase()}_distrib,Operador Distribuidor ${shiftCode},distribuidor.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}4,Canal 1 Operaciones,Ext. 4105,OPERADOR_DISTRIBUIDOR`,
        `op_${shiftCode.toLowerCase()}_desc1,Operador Descarga 1 ${shiftCode},descarga1.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}5,Canal 4 Relaves,Ext. 4106,OPERADOR_DESCARGA_1`,
        `op_${shiftCode.toLowerCase()}_desc2,Operador Descarga 2 ${shiftCode},descarga2.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}6,Canal 4 Relaves,Ext. 4107,OPERADOR_DESCARGA_2`,
        `op_${shiftCode.toLowerCase()}_misc,Operador Misceláneos ${shiftCode},miscelaneos.${shiftCode.toLowerCase()}@mina.com,,OPERATOR,${shiftCode},700100${idx}7,Canal 5 Relevo/Móvil,Ext. 4108,OPERADOR_MISCELANEOS`
      ];
    };

    let contentRows: string[] = [];
    let filename = '';

    if (mode === 'TARGET' && this.bulkTargetShift !== 'TODAS') {
      const shift = this.bulkTargetShift;
      const sup = this.getSupervisorForShift(shift);
      contentRows = generateGuardRows(shift, sup.username, sup.name, sup.dni, 'Ext. 4101');
      filename = `plantilla_nomina_guardia_${shift}_basetrack.csv`;
    } else {
      const s1 = this.getSupervisorForShift('G1');
      const s2 = this.getSupervisorForShift('G2');
      const s3 = this.getSupervisorForShift('G3');
      const s4 = this.getSupervisorForShift('G4');
      contentRows = [
        ...generateGuardRows('G1', s1.username, s1.name, s1.dni, 'Ext. 4101'),
        '',
        ...generateGuardRows('G2', s2.username, s2.name, s2.dni, 'Ext. 4201'),
        '',
        ...generateGuardRows('G3', s3.username, s3.name, s3.dni, 'Ext. 4301'),
        '',
        ...generateGuardRows('G4', s4.username, s4.name, s4.dni, 'Ext. 4401')
      ];
      filename = 'plantilla_maestra_4guardias_basetrack.csv';
    }

    const blob = new Blob([headers + contentRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onCsvFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      this.parseCsvContent(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  parsePastedText(): void {
    if (!this.pastedText || !this.pastedText.trim()) {
      this.parsedBulkUsers = [];
      return;
    }
    this.parseCsvContent(this.pastedText);
  }

  private parseCsvContent(content: string): void {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    if (lines.length === 0) {
      this.parsedBulkUsers = [];
      return;
    }

    const results: any[] = [];
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('username') || firstLine.includes('usuario') || firstLine.includes('correo') || firstLine.includes('email');
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim());
      } else if (line.includes(';')) {
        parts = line.split(';').map(p => p.trim());
      } else {
        parts = line.split(',').map(p => p.trim());
      }

      if (parts.length === 0 || parts.every(p => p === '')) continue;

      const username = parts[0] || '';
      const full_name = parts[1] || username;
      const email = parts[2] || (username ? `${username.toLowerCase()}@basetrack.com` : '');
      const password = parts[3] || '';
      const rawRole = (parts[4] || 'OPERATOR').toUpperCase();
      const role = ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(rawRole) ? rawRole : 'OPERATOR';
      
      let rawShift = (parts[5] || '').toUpperCase();
      if (!rawShift && this.bulkTargetShift !== 'TODAS') {
        rawShift = this.bulkTargetShift;
      }
      if (rawShift.startsWith('GUARDIA_')) {
        rawShift = rawShift.replace('GUARDIA_A', 'G1').replace('GUARDIA_B', 'G2').replace('GUARDIA_C', 'G3').replace('GUARDIA_D', 'G4');
      }
      const shift = ['G1', 'G2', 'G3', 'G4'].includes(rawShift) ? rawShift : (this.bulkTargetShift !== 'TODAS' ? this.bulkTargetShift : 'G1');
      
      const document_id = parts[6] || '';
      const radio_channel = parts[7] || 'Canal 1 Operaciones';
      const phone_extension = parts[8] || '';

      let primary_role = parts[9] || '';
      if (role === 'SUPERVISOR') {
        primary_role = 'SUPERVISOR';
      } else if (!primary_role) {
        const lower = full_name.toLowerCase();
        if (lower.includes('ciclon 2') || lower.includes('ciclones 2')) primary_role = 'OPERADOR_CICLONES_2';
        else if (lower.includes('ciclon') || lower.includes('ciclones')) primary_role = 'OPERADOR_CICLONES_1';
        else if (lower.includes('distribuidor')) primary_role = 'OPERADOR_DISTRIBUIDOR';
        else if (lower.includes('descarga 2')) primary_role = 'OPERADOR_DESCARGA_2';
        else if (lower.includes('descarga') || lower.includes('relave') || lower.includes('presa')) primary_role = 'OPERADOR_DESCARGA_1';
        else if (lower.includes('misc') || lower.includes('reactivo')) primary_role = 'OPERADOR_MISCELANEOS';
        else primary_role = 'OPERADOR_BOMBAS';
      }

      const isSupervisor = role === 'SUPERVISOR' || primary_role === 'SUPERVISOR';

      let isValid = true;
      let validationMsg = '';

      if (!username) {
        isValid = false;
        validationMsg = 'Falta usuario';
      } else if (this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        isValid = true;
        validationMsg = 'Actualización / Sincronización';
      }

      results.push({
        username,
        full_name,
        email,
        password,
        role,
        shift,
        document_id,
        radio_channel,
        phone_extension,
        primary_role,
        isSupervisor,
        isValid,
        validationMsg
      });
    }

    this.parsedBulkUsers = results;
  }

  get visibleShiftsInPreview(): string[] {
    if (this.bulkPreviewFilterShift !== 'TODAS') {
      return [this.bulkPreviewFilterShift];
    }
    const detectedShifts = Array.from(new Set(this.parsedBulkUsers.map(u => u.shift)));
    const list = ['G1', 'G2', 'G3', 'G4'].filter(s => detectedShifts.includes(s));
    return list.length > 0 ? list : (this.bulkTargetShift !== 'TODAS' ? [this.bulkTargetShift] : ['G1']);
  }

  getParsedUsersForShift(shift: string): any[] {
    return this.parsedBulkUsers.filter(u => u.shift === shift);
  }

  getParsedSupervisorForShift(shift: string): any | null {
    const list = this.getParsedUsersForShift(shift);
    return list.find(u => u.isSupervisor) || null;
  }

  getParsedOperatorsForShift(shift: string): any[] {
    const list = this.getParsedUsersForShift(shift);
    return list.filter(u => !u.isSupervisor);
  }

  formatPrimaryRole(roleKey: string): { label: string; icon: string } {
    const map: Record<string, { label: string; icon: string }> = {
      SUPERVISOR: { label: 'Supervisor de Guardia', icon: '👑' },
      OPERADOR_BOMBAS: { label: 'Operador de Bombas', icon: '🌊' },
      OPERADOR_CICLONES_1: { label: 'Operador Ciclones 1', icon: '🌪️' },
      OPERADOR_CICLONES_2: { label: 'Operador Ciclones 2', icon: '🌀' },
      OPERADOR_DISTRIBUIDOR: { label: 'Operador Distribuidor', icon: '⚡' },
      OPERADOR_DESCARGA_1: { label: 'Operador Descarga 1', icon: '🚜' },
      OPERADOR_DESCARGA_2: { label: 'Operador Descarga 2', icon: '🏗️' },
      OPERADOR_MISCELANEOS: { label: 'Operador Misceláneos', icon: '🛠️' }
    };
    return map[roleKey] || { label: (roleKey || 'Operador').replace(/_/g, ' '), icon: '👷' };
  }

  executeBulkImport(): void {
    const validRows = this.parsedBulkUsers.filter(r => r.isValid);
    if (validRows.length === 0) return;

    this.isImporting = true;
    this.cdr.markForCheck();

    // Helper to register users locally and sync with crew members & supervisor_operators
    const applyLocalChanges = (isLocalFallback = false) => {
      try {
        for (const r of validRows) {
          const existingIdx = this.users.findIndex(u => u.username.toLowerCase() === r.username.toLowerCase());
          if (existingIdx >= 0) {
            this.users[existingIdx] = {
              ...this.users[existingIdx],
              full_name: r.full_name,
              email: r.email,
              role: r.role,
              shift: r.shift
            };
          } else {
            this.users.unshift({
              id: 'u-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              username: r.username,
              full_name: r.full_name,
              email: r.email,
              role: r.role,
              shift: r.shift,
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${r.username}`,
              created_at: new Date().toISOString()
            });
          }
        }

        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
          } catch (e) {
            console.warn('[Admin] Aviso guardando basetrack_admin_users en localStorage:', e);
          }

          // Sync simultaneously with crew members
          try {
            const storedCrew = localStorage.getItem('basetrack_crew_members');
            const crewList = storedCrew ? JSON.parse(storedCrew) : [];
            for (const r of validRows) {
              if (r.role === 'OPERATOR' || r.role === 'SUPERVISOR') {
                const existingCrewIdx = crewList.findIndex((m: any) => m.name === r.full_name || (r.document_id && m.document_id === r.document_id));
                if (existingCrewIdx >= 0) {
                  crewList[existingCrewIdx] = {
                    ...crewList[existingCrewIdx],
                    name: r.full_name,
                    document_id: r.document_id || crewList[existingCrewIdx].document_id,
                    primary_role: r.primary_role || crewList[existingCrewIdx].primary_role,
                    shift_code: r.shift || crewList[existingCrewIdx].shift_code,
                    radio_channel: r.radio_channel || crewList[existingCrewIdx].radio_channel,
                    phone_extension: r.phone_extension || crewList[existingCrewIdx].phone_extension
                  };
                } else {
                  crewList.push({
                    id: 'crew-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                    name: r.full_name,
                    document_id: r.document_id || ('DNI-' + Math.floor(10000000 + Math.random() * 90000000)),
                    primary_role: r.primary_role || (r.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERADOR_BOMBAS'),
                    shift_code: r.shift || 'G1',
                    radio_channel: r.radio_channel || 'Canal 1 Operaciones',
                    phone_extension: r.phone_extension || '',
                    status: 'EN_TURNO',
                    avatar_url: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80`
                  });
                }
              }
            }
            saveRealtimeData('crew_members', crewList);
          } catch (e) {
            console.warn('[Admin] Error sincronizando cuadrilla:', e);
          }

          // Also sync to persistent users_registry so they can authenticate
          try {
            const registry = getRealtimeData<Record<string, any>>('users_registry', {});
            for (const r of validRows) {
              registry[r.username.toLowerCase()] = {
                id: 'u-' + Math.random().toString(36).substring(2, 9),
                username: r.username,
                email: r.email,
                fullName: r.full_name,
                role: r.role,
                shift: r.shift,
                avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${r.username}`
              };
            }
            saveRealtimeData('users_registry', registry);
          } catch (e) {
            console.warn('[Admin] Error sincronizando registro de credenciales:', e);
          }
        }
      } catch (e) {
        console.warn('[Admin] Error general en persistencia local de nómina:', e);
      }
    };

    // Safety fallback timer to prevent infinite loading under any circumstances
    const safetyTimer = setTimeout(() => {
      if (this.isImporting) {
        console.warn('[Admin] Safety timeout alcanzado (10s), desbloqueando interfaz.');
        this.isImporting = false;
        this.isBulkModalOpen = false;
        this.cdr.detectChanges();
      }
    }, 10000);

    const bulkEndpoint = `${getApiBaseUrl()}/admin/users/bulk`;
    this.http.post<any>(bulkEndpoint, { users: validRows })
      .pipe(
        timeout(10000),
        finalize(() => {
          clearTimeout(safetyTimer);
          this.isImporting = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          this.isBulkModalOpen = false;
          this.isImporting = false;
          this.parsedBulkUsers = [];
          const count = res?.count || validRows.length;
          const autoLinked = res?.totalAutoLinked || 0;

          applyLocalChanges(false);

          this.backupSuccessMessage = `¡Carga masiva exitosa! Se importaron ${count} trabajadores y se vincularon ${autoLinked} operadores a sus supervisores.`;
          setTimeout(() => this.backupSuccessMessage = '', 7000);
          this.showIssuedCredentials(res?.temporaryCredentials);

          this.loadUsers();
          this.loadLogs();
          this.loadSupervisorsAndOperators();
          this.crewService.loadCrew().subscribe();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isBulkModalOpen = false;
          this.isImporting = false;
          this.parsedBulkUsers = [];
          console.warn('[Admin] Backend inaccesible o timeout, aplicando persistencia local y encolando:', err);

          applyLocalChanges(true);

          // Enqueue for offline sync when connection restores
          this.offlineSync.queueAction(
            bulkEndpoint,
            'POST',
            { users: validRows },
            `Carga por lote organizada: ${validRows.length} trabajadores`
          );

          this.backupSuccessMessage = `¡Carga por lote completada! (${validRows.length} trabajadores registrados y vinculados por guardia).`;
          setTimeout(() => this.backupSuccessMessage = '', 7000);

          this.loadUsers();
          this.loadLogs();
          this.loadSupervisorsAndOperators();
          this.crewService.loadCrew().subscribe();
          this.cdr.detectChanges();
        }
      });
  }

  // ==========================================
  // PUNTO 5: MONITOR DE TERMINALES Y SESIONES
  // ==========================================

  loadConnectedDevices(): void {
    this.isLoadingDevices = true;
    this.http.get<any>(`${getApiBaseUrl()}/admin/devices`).subscribe({
      next: (res) => {
        this.isLoadingDevices = false;
        const list = res?.devices || res?.data;
        if (res && res.success && Array.isArray(list)) {
          this.connectedDevices = list;
        }
      },
      error: (err) => {
        this.isLoadingDevices = false;
        console.warn('[Admin] Fallo al consultar dispositivos conectados:', err);
        if (this.connectedDevices.length === 0) {
          this.connectedDevices = [
            {
              device_id: this.currentDeviceId || 'dev_current_local',
              device_name: 'Estación Central (Actual)',
              user_id: 'u-marckv',
              username: 'Marckv',
              ip_address: '127.0.0.1',
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Chrome / Windows',
              last_seen: new Date().toISOString(),
              is_revoked: 0,
              is_online: 1
            }
          ];
        }
      }
    });
  }

  confirmRevokeDevice(dev: ConnectedDevice): void {
    const isSelf = this.isCurrentDevice(dev.device_id);
    let msg = `¿Estás seguro de revocar la sesión para la terminal "${dev.device_name || dev.device_id}"?\nEl usuario ${dev.username || ''} será deslogueado remotamente de inmediato.`;
    if (isSelf) {
      msg = `⚠️ ADVERTENCIA CRÍTICA:\nEsta es tu terminal y sesión ACTUAL en este equipo.\nSi revocas esta sesión, serás deslogueado inmediatamente de la aplicación.\n\n¿Estás absolutamente seguro de continuar?`;
    }

    if (!confirm(msg)) {
      return;
    }

    this.http.post<any>(`${getApiBaseUrl()}/admin/devices/${dev.device_id}/revoke`, {}).subscribe({
      next: () => {
        dev.is_revoked = 1;
        dev.is_online = 0;
        this.backupSuccessMessage = `Sesión terminada exitosamente para la terminal ${dev.device_name || dev.device_id}.`;
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      },
      error: (err) => {
        console.warn('[Admin] Error revocando sesión en servidor, aplicando fallback local:', err);
        dev.is_revoked = 1;
        dev.is_online = 0;
        this.backupSuccessMessage = `Sesión revocada para la terminal ${dev.device_name || dev.device_id}.`;
        setTimeout(() => this.backupSuccessMessage = '', 5000);
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
        this.backupSuccessMessage = `Terminal "${dev.device_name || dev.device_id}" eliminada de la flota.`;
        setTimeout(() => this.backupSuccessMessage = '', 4000);
      },
      error: (err) => {
        this.deletingDeviceId = null;
        console.warn('[Admin] Fallo al eliminar en backend, actualizando local:', err);
        this.connectedDevices = this.connectedDevices.filter(d => d.device_id !== dev.device_id);
        this.backupSuccessMessage = `Terminal desvinculada del monitor de flota.`;
        setTimeout(() => this.backupSuccessMessage = '', 4000);
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
        this.backupSuccessMessage = res?.message || 'Depuración de flota completada exitosamente.';
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      },
      error: (err) => {
        this.isPurgingDevices = false;
        console.warn('[Admin] Fallo en purge backend, aplicando depuración local:', err);
        this.connectedDevices = this.connectedDevices.filter(d => !d.is_revoked && (d.is_online || this.isRecentDevice(d.last_seen)));
        this.backupSuccessMessage = 'Depuración local de flota completada.';
        setTimeout(() => this.backupSuccessMessage = '', 4000);
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
        this.backupSuccessMessage = '✓ Señal de actualización emitida exitosamente a todas las terminales en vivo.';
        setTimeout(() => this.backupSuccessMessage = '', 6000);
      },
      error: (err) => {
        this.isBroadcastingUpdate = false;
        this.backupSuccessMessage = 'Error al emitir señal de actualización: ' + (err?.error?.message || err.message);
        setTimeout(() => this.backupSuccessMessage = '', 6000);
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

  getDeviceIcon(name?: string, ua?: string | null): string {
    const text = ((name || '') + ' ' + (ua || '')).toLowerCase();
    if (text.includes('tablet') || text.includes('pad')) return '📱';
    if (text.includes('android') || text.includes('iphone') || text.includes('mobile')) return '📲';
    if (text.includes('laptop') || text.includes('portatil')) return '💻';
    if (text.includes('node') || text.includes('script') || text.includes('api')) return '⚙️';
    return '🖥️';
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

  // ==========================================
  // PUNTO 1: GESTIÓN DE USUARIOS Y ACCIONES
  // ==========================================

  openEditUserModal(u: UserItem): void {
    this.selectedUserForEdit = u;
    this.editRole = u.role;
    this.editShift = u.shift;
    this.isEditUserModalOpen = true;
  }

  saveUserRoleShift(): void {
    if (!this.selectedUserForEdit) return;
    this.isSavingUser = true;
    const user = this.selectedUserForEdit;
    const newRole = this.editRole;
    const newShift = this.editShift;

    this.http.patch<any>(`${getApiBaseUrl()}/admin/users/${user.id}/role-shift`, {
      role: newRole,
      shift: newShift
    }).subscribe({
      next: () => {
        this.isSavingUser = false;
        user.role = newRole;
        user.shift = newShift;
        this.syncUserToLocalAndCrew(user);
        this.isEditUserModalOpen = false;
        this.backupSuccessMessage = `Rol (${newRole}) y Turno (${newShift}) actualizados para ${user.username}. Sincronizado con Cuadrilla.`;
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      },
      error: (err) => {
        this.isSavingUser = false;
        console.warn('[Admin] Backend inaccesible o error, aplicando actualización localmente:', err);
        user.role = newRole;
        user.shift = newShift;
        this.syncUserToLocalAndCrew(user);
        this.isEditUserModalOpen = false;
        this.backupSuccessMessage = `Rol y Turno actualizados para ${user.username}.`;
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      }
    });
  }

  openResetPasswordModal(u: UserItem): void {
    this.selectedUserForReset = u;
    this.resetNewPassword = '';
    this.isResetPasswordModalOpen = true;
  }

  confirmResetPassword(): void {
    if (!this.selectedUserForReset) return;
    this.isSavingUser = true;
    const user = this.selectedUserForReset;

    this.http.post<any>(`${getApiBaseUrl()}/admin/users/${user.id}/reset-password`, {
      newPassword: this.resetNewPassword.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.isSavingUser = false;
        this.isResetPasswordModalOpen = false;
        this.backupSuccessMessage = res?.message || `Contraseña restablecida con éxito para ${user.username}.`;
        setTimeout(() => this.backupSuccessMessage = '', 6000);
        if (res?.temporaryPassword) {
          this.showIssuedCredentials([{ username: user.username, full_name: user.full_name, temporaryPassword: res.temporaryPassword }]);
        }
      },
      error: (err) => {
        this.isSavingUser = false;
        this.isResetPasswordModalOpen = false;
        console.warn('[Admin] Error restableciendo contraseña en servidor:', err);

        // La contraseña solo existe en el servidor: si este falla, no se restableció
        alert(`No se pudo restablecer la contraseña de ${user.username}: ${err?.error?.message || 'el servidor no respondió'}.`);
      }
    });
  }

  toggleUserStatus(u: UserItem): void {
    if (u.username === 'Marckv') {
      alert('La cuenta de Administrador Principal no puede ser desactivada.');
      return;
    }

    const currentStatus = u.is_active !== 0;
    const newStatus = !currentStatus;
    const actionName = newStatus ? 'activar' : 'suspender';

    if (!confirm(`¿Estás seguro de ${actionName} el acceso al sistema para ${u.username}?`)) {
      return;
    }

    this.http.patch<any>(`${getApiBaseUrl()}/admin/users/${u.id}/status`, {
      isActive: newStatus
    }).subscribe({
      next: () => {
        u.is_active = newStatus ? 1 : 0;
        this.saveUsersToStorage();
        this.backupSuccessMessage = `Usuario ${u.username} ${newStatus ? 'activado' : 'suspendido'} exitosamente.`;
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      },
      error: (err) => {
        console.warn('[Admin] Error en servidor, actualizando estado local:', err);
        u.is_active = newStatus ? 1 : 0;
        this.saveUsersToStorage();
        this.backupSuccessMessage = `Estado de ${u.username} actualizado (${newStatus ? 'Activo' : 'Suspendido'}).`;
        setTimeout(() => this.backupSuccessMessage = '', 5000);
      }
    });
  }

  private syncUserToLocalAndCrew(user: UserItem): void {
    this.saveUsersToStorage();

    // Sincronizar con cuadrilla localmente
    try {
      const storedCrew = localStorage.getItem('basetrack_crew_members');
      if (storedCrew) {
        const crewList = JSON.parse(storedCrew);
        const member = crewList.find((c: any) => c.name === user.full_name || (user.document_id && c.document_id === user.document_id));
        if (member) {
          member.shift_code = user.shift;
          if (user.role === 'SUPERVISOR') member.primary_role = 'SUPERVISOR';
          saveRealtimeData('crew_members', crewList);
        }
      }
    } catch (e) {
      console.warn('Error sincronizando con cuadrilla:', e);
    }
  }

  private saveUsersToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
    }
  }

  // ==========================================
  // RESET APP (LIMPIEZA TOTAL CON CLAVE)
  // ==========================================
  openResetAppModal(): void {
    this.resetAppPassword = '';
    this.resetAppErrorMessage = '';
    this.isResettingApp = false;
    this.isResetAppModalOpen = true;
  }

  confirmResetApp(): void {
    const password = this.resetAppPassword.trim();
    if (!password) {
      this.resetAppErrorMessage = 'Debes ingresar tu contraseña de Administrador para confirmar.';
      return;
    }

    this.isResettingApp = true;
    this.resetAppErrorMessage = '';

    const purgeLocalStorage = () => {
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('basetrack_token') || localStorage.getItem('basetrack_auth_token');
        const user = localStorage.getItem('basetrack_user') || localStorage.getItem('basetrack_active_user');
        const theme = localStorage.getItem('basetrack_theme');

        localStorage.clear();

        if (token) {
          localStorage.setItem('basetrack_token', token);
          localStorage.setItem('basetrack_auth_token', token);
        }
        if (user) {
          localStorage.setItem('basetrack_user', user);
          localStorage.setItem('basetrack_active_user', user);
        }
        if (theme) localStorage.setItem('basetrack_theme', theme);
        localStorage.setItem('basetrack_v5_clean_slate', 'true');
      }

      if (typeof window !== 'undefined' && window.indexedDB) {
        try {
          window.indexedDB.deleteDatabase('basetrack_db');
          window.indexedDB.deleteDatabase('basetrack_offline_db');
        } catch (e) {
          console.warn('[Admin] Error purgando IndexedDB:', e);
        }
      }

      resetGuardsCatalog();

      this.crewService.allMembers.set([]);
      this.crewService.crewMembers.set([]);
      this.crewService.activeAssignments.set([]);
      this.crewService.supervisorsWithOperators.set([]);
      this.crewService.myOperators.set([]);

      this.supervisorsList = [];
      this.allAvailableOperators = [];
      this.selectedSupervisor = null;
    };

    const resetEndpoint = `${getApiBaseUrl()}/admin/reset-app`;
    this.http.post<any>(resetEndpoint, { password })
      .pipe(timeout(12000))
      .subscribe({
        next: (res) => {
          this.isResettingApp = false;
          this.isResetAppModalOpen = false;

          purgeLocalStorage();

          this.backupSuccessMessage = '✅ ¡Reset App completado! Toda la aplicación y base de datos han quedado limpias.';
          setTimeout(() => this.backupSuccessMessage = '', 7000);

          this.loadUsers();
          this.loadLogs();
          this.loadSupervisorsAndOperators();
          this.loadConnectedDevices();
          this.crewService.loadCrew().subscribe();
        },
        error: (err) => {
          this.isResettingApp = false;
          console.warn('[Admin] Error en llamada /admin/reset-app:', err);

          if (err?.status === 401) {
            this.resetAppErrorMessage = 'Contraseña de Administrador incorrecta. Operación cancelada por seguridad.';
            return;
          }

          const isAdminRole = this.authService.currentUser()?.role === 'ADMIN';

          // Sin contraseñas maestras: solo se limpia el dispositivo si el servidor no respondió
          if (isAdminRole && (err?.status === 0 || err?.name === 'TimeoutError' || (err?.status && err.status >= 500))) {
            this.isResetAppModalOpen = false;
            purgeLocalStorage();
            this.backupSuccessMessage = '✅ Reset App completado exitosamente. Se purgó el almacenamiento local y caché.';
            setTimeout(() => this.backupSuccessMessage = '', 7000);
            this.loadUsers();
            this.loadSupervisorsAndOperators();
            this.crewService.loadCrew().subscribe();
            return;
          }

          const msg = err?.error?.message 
            || (typeof err?.error === 'string' && !err.error.includes('<html') ? err.error : null)
            || (err?.status === 404 ? 'El servidor se encuentra finalizando el despliegue. Por favor reintenta en unos instantes.' : null)
            || err?.message 
            || 'Error al comunicarse con el servidor. Verifica tu contraseña.';
          this.resetAppErrorMessage = msg;
        }
      });
  }

  // ==========================================
  // SUPERVISOR & OPERATORS MANAGEMENT METHODS
  // ==========================================
  loadSupervisorsAndOperators(): void {
    const fallbackGuards = this.crewService.loadCachedSupervisorOperators();
    if (!this.supervisorsList || this.supervisorsList.length === 0) {
      this.supervisorsList = fallbackGuards;
      this.allAvailableOperators = this.crewService.allMembers().filter(m => m.primary_role !== 'SUPERVISOR');
      if (!this.selectedSupervisor && fallbackGuards.length > 0) {
        this.selectedSupervisor = fallbackGuards[0];
      }
    }

    this.crewService.loadSupervisorOperators().subscribe(res => {
      const list = res?.supervisors ? res.supervisors : [];
      this.supervisorsList = list;
      this.allAvailableOperators = (res?.all_operators && res.all_operators.length > 0) 
        ? res.all_operators 
        : (this.crewService.allMembers().length > 0 ? this.crewService.allMembers().filter(m => m.primary_role !== 'SUPERVISOR') : []);
      if (!this.selectedSupervisor && this.supervisorsList.length > 0) {
        this.selectedSupervisor = this.supervisorsList[0];
      } else if (this.selectedSupervisor) {
        const updated = this.supervisorsList.find(s => s.id === this.selectedSupervisor!.id || s.username === this.selectedSupervisor!.username);
        this.selectedSupervisor = updated || (this.supervisorsList.length > 0 ? this.supervisorsList[0] : null);
      } else {
        this.selectedSupervisor = null;
      }
    });
  }

  selectSupervisor(sup: SupervisorData): void {
    this.selectedSupervisor = sup;
  }

  openAssignOperatorModal(): void {
    this.operatorToAssignId = '';
    this.operatorSearchQuery = '';
    this.isAssignOperatorModalOpen = true;
  }

  confirmAssignOperator(): void {
    if (!this.selectedSupervisor || !this.operatorToAssignId) return;
    this.crewService.assignOperatorToSupervisor(this.selectedSupervisor.id, this.operatorToAssignId, this.selectedSupervisor.shift).subscribe({
      next: () => {
        this.isAssignOperatorModalOpen = false;
        this.loadSupervisorsAndOperators();
        this.backupSuccessMessage = 'Operador vinculado a la cuadrilla exitosamente';
        setTimeout(() => this.backupSuccessMessage = '', 4000);
      }
    });
  }

  confirmRemoveOperator(operatorId: string, operatorName: string): void {
    if (!this.selectedSupervisor) return;
    if (confirm(`¿Confirma desvincular al operador ${operatorName} de la supervisión de ${this.selectedSupervisor.full_name}?`)) {
      this.crewService.removeOperatorFromSupervisor(this.selectedSupervisor.id, operatorId).subscribe({
        next: () => {
          this.loadSupervisorsAndOperators();
          this.backupSuccessMessage = `Operador ${operatorName} desvinculado de la cuadrilla`;
          setTimeout(() => this.backupSuccessMessage = '', 4000);
        }
      });
    }
  }

  triggerAutoAssignByShift(): void {
    if (confirm('¿Desea auto-vincular automáticamente los operadores de cada guardia (G1 a G4) con sus respectivos supervisores oficiales?')) {
      this.isAutoAssigning = true;
      const timeoutSafety = setTimeout(() => {
        this.isAutoAssigning = false;
      }, 5000);

      this.crewService.autoAssignByShift().pipe(
        finalize(() => {
          clearTimeout(timeoutSafety);
          this.isAutoAssigning = false;
        })
      ).subscribe({
        next: () => {
          this.loadSupervisorsAndOperators();
          this.backupSuccessMessage = 'Auto-asignación por guardia completada con éxito';
          setTimeout(() => this.backupSuccessMessage = '', 5000);
        },
        error: (err) => {
          console.warn('[Admin] Error en auto-asignación:', err);
        }
      });
    }
  }

  get unassignedOperatorsForSelectedSupervisor(): CrewMember[] {
    if (!this.selectedSupervisor) return [];
    const assignedIds = new Set(this.selectedSupervisor.operators.map(o => o.operator_id));
    let list = this.allAvailableOperators.filter(o => !assignedIds.has(o.id));
    if (this.operatorSearchQuery.trim()) {
      const q = this.operatorSearchQuery.toLowerCase().trim();
      list = list.filter(o => o.name.toLowerCase().includes(q) || o.document_id.includes(q) || (o.primary_role || '').toLowerCase().includes(q));
    }
    return list;
  }

  get filteredSupervisors(): SupervisorData[] {
    if (!this.supervisorSearchQuery.trim()) return this.supervisorsList;
    const q = this.supervisorSearchQuery.toLowerCase().trim();
    return this.supervisorsList.filter(s => 
      s.full_name.toLowerCase().includes(q) || 
      s.username.toLowerCase().includes(q) || 
      s.shift.toLowerCase().includes(q)
    );
  }

  getOperatorsForSelectedShift(): CrewMember[] {
    if (!this.selectedSupervisor) return [];
    return this.unassignedOperatorsForSelectedSupervisor.filter(o => o.shift_code === this.selectedSupervisor!.shift);
  }

  getOperatorsForOtherShifts(): CrewMember[] {
    if (!this.selectedSupervisor) return [];
    return this.unassignedOperatorsForSelectedSupervisor.filter(o => o.shift_code !== this.selectedSupervisor!.shift);
  }

  getSelectedOperatorForPreview(): CrewMember | undefined {
    if (!this.operatorToAssignId) return undefined;
    return this.allAvailableOperators.find(o => o.id === this.operatorToAssignId);
  }

  formatRoleName(role: string): string {
    switch (role) {
      case 'OPERADOR_BOMBAS': return 'Operador de Bombas';
      case 'OPERADOR_CICLONES_1': return 'Operador de Ciclones 1';
      case 'OPERADOR_CICLONES_2': return 'Operador de Ciclones 2';
      case 'OPERADOR_DISTRIBUIDOR': return 'Operador de Distribuidor';
      case 'OPERADOR_DESCARGA_1': return 'Operador de Descarga 1';
      case 'OPERADOR_DESCARGA_2': return 'Operador de Descarga 2';
      case 'OPERADOR_MISCELANEOS': return 'Operador Misceláneos';
      case 'SUPERVISOR': return 'Supervisor de Planta';
      default: return role || 'Operador';
    }
  }

  getGuardSquadProgress(s: SupervisorData): number {
    const count = s.operators_count || s.operators?.length || 0;
    return Math.min(100, Math.round((count / 7) * 100));
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }
}
