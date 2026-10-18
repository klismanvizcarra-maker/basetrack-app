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
import { CrewService, SupervisorData } from '../../core/services/crew.service';
import { PermissionsService, DEFAULT_ROLE_PERMISSIONS, PermissionKey } from '../../core/auth/permissions.service';
import { VehicleChecklistService } from '../../core/services/vehicle-checklist.service';
import { AdminVehiclesTabComponent } from './tabs/vehicles/vehicles-tab.component';
import { AdminPlantParametersTabComponent } from './tabs/plant-parameters/plant-parameters-tab.component';
import { AdminAuditLogsTabComponent } from './tabs/audit-logs/audit-logs-tab.component';
import { AuditLogStore } from './tabs/audit-logs/audit-log.store';
import { AdminTerminalsTabComponent } from './tabs/terminals/terminals-tab.component';
import { DeviceFleetStore } from './tabs/terminals/device-fleet.store';
import { AdminGuardsTabComponent } from './tabs/guards/guards-tab.component';
import { GuardsStore } from './tabs/guards/guards.store';
import { AdminUsersTabComponent } from './tabs/users/users-tab.component';
import { UsersStore, UserItem } from './tabs/users/users.store';
import { AdminPermissionsTabComponent } from './tabs/permissions/permissions-tab.component';
import { resetGuardsCatalog } from '../../shared/utils/roster.util';
import { siteToday } from '../../shared/utils/site-date.util';

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

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, AdminVehiclesTabComponent, AdminPlantParametersTabComponent, AdminAuditLogsTabComponent, AdminTerminalsTabComponent, AdminGuardsTabComponent, AdminUsersTabComponent, AdminPermissionsTabComponent],
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
  vehicleChecklistService = inject(VehicleChecklistService);
  auditLogStore = inject(AuditLogStore);
  deviceFleetStore = inject(DeviceFleetStore);
  guardsStore = inject(GuardsStore);

  get supervisorsList(): SupervisorData[] { return this.guardsStore.supervisorsList; }

  /** Muestra un mensaje en el aviso general (lo usan también las pestañas hijas) */
  showNotice(notice: { text: string; ms: number }): void {
    this.backupSuccessMessage = notice.text;
    setTimeout(() => this.backupSuccessMessage = '', notice.ms);
  }
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Navegación por Apartados en Administrador
  activeAdminTab: 'SUPERVISORS_CREW' | 'USERS_ROLES' | 'TERMINALS_SYNC' | 'AUDIT_LOGS' | 'PERMISSIONS_MATRIX' | 'PLANT_PARAMETERS' | 'VEHICLES_FLEET' | 'SYSTEM_BACKUPS' = 'SUPERVISORS_CREW';
  lastBackupDate = '';

  get currentDomain(): 'PERSONNEL' | 'OPERATIONS' | 'SECURITY' | 'SYSTEM' {
    switch (this.activeAdminTab) {
      case 'SUPERVISORS_CREW':
      case 'USERS_ROLES':
        return 'PERSONNEL';
      case 'PLANT_PARAMETERS':
      case 'VEHICLES_FLEET':
        return 'OPERATIONS';
      case 'PERMISSIONS_MATRIX':
      case 'AUDIT_LOGS':
        return 'SECURITY';
      case 'SYSTEM_BACKUPS':
      case 'TERMINALS_SYNC':
        return 'SYSTEM';
      default:
        return 'PERSONNEL';
    }
  }

  selectDomain(domain: 'PERSONNEL' | 'OPERATIONS' | 'SECURITY' | 'SYSTEM'): void {
    switch (domain) {
      case 'PERSONNEL':
        this.activeAdminTab = 'SUPERVISORS_CREW';
        break;
      case 'OPERATIONS':
        this.activeAdminTab = 'PLANT_PARAMETERS';
        break;
      case 'SECURITY':
        this.activeAdminTab = 'PERMISSIONS_MATRIX';
        break;
      case 'SYSTEM':
        this.activeAdminTab = 'SYSTEM_BACKUPS';
        break;
    }
    this.cdr.markForCheck();
  }

  setActiveTab(tab: 'SUPERVISORS_CREW' | 'USERS_ROLES' | 'TERMINALS_SYNC' | 'AUDIT_LOGS' | 'PERMISSIONS_MATRIX' | 'PLANT_PARAMETERS' | 'VEHICLES_FLEET' | 'SYSTEM_BACKUPS'): void {
    this.activeAdminTab = tab;
    this.cdr.markForCheck();
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
    this.permissionsService.updateRolePermission(role, updated).subscribe({
      // El servicio ya revirtió la matriz; se restaura la casilla y se informa el rechazo
      error: (err) => {
        checkbox.checked = !checkbox.checked;
        console.warn('[Admin] Cambio de permiso rechazado:', err?.message);
      }
    });
  }

  // Inicialización con datos por defecto
  usersStore = inject(UsersStore);
  get users(): UserItem[] { return this.usersStore.users; }
  set users(list: UserItem[]) { this.usersStore.users = list; }

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

  // Contraseñas temporales emitidas por el servidor (importación o restablecimiento): se muestran una vez
  issuedCredentials: Array<{ username: string; full_name: string; temporaryPassword: string }> = [];
  isCredentialsModalOpen = false;
  credentialsCopied = false;

  showIssuedCredentials(list: Array<{ username: string; full_name: string; temporaryPassword: string }> | undefined): void {
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
    a.download = `credenciales_temporales_${siteToday()}.csv`;
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
  }

  resetBackendToDefault(): void {
    setCustomApiUrl('');
    this.customApiUrlInput = '';
    this.currentApiUrl = getApiBaseUrl();
    this.apiConnectionTestStatus = 'idle';
    this.apiConnectionTestMessage = 'Restablecido al endpoint por defecto.';
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
      ent.includes('permission') ||
      ent.includes('crew') ||
      ent.includes('cuadrilla') ||
      ent.includes('vehicle') ||
      ent.includes('camioneta') ||
      key.includes('user') ||
      key.includes('device') ||
      key.includes('permission') ||
      key.includes('crew') ||
      key.includes('vehicle')
    ) {
      this.ngZone.run(() => {
        this.loadUsers();
        this.deviceFleetStore.load();
        this.guardsStore.load();
        this.refreshVehicleCount();
        // Con la pestaña de bitácora abierta, AdminAuditLogsTabComponent ya la recarga
        if (this.activeAdminTab !== 'AUDIT_LOGS') this.auditLogStore.load();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  };

  ngOnInit(): void {
    // Precarga síncrona instantánea (0ms) para Vercel y móviles
    this.guardsStore.initFromCache();

    this.loadFromStorage();
    this.loadUsers();
    this.deviceFleetStore.load();
    this.guardsStore.load();
    this.refreshVehicleCount();
    this.auditLogStore.load();

    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  /**
   * Mantiene al día el contador de la pestaña "Padrón de Camionetas".
   * Con la pestaña abierta, AdminVehiclesTabComponent ya recarga la lista y actualiza la misma señal.
   */
  refreshVehicleCount(): void {
    if (this.activeAdminTab === 'VEHICLES_FLEET') return;
    this.vehicleChecklistService.getAllVehiclesAdmin().subscribe({ error: () => {} });
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
      } catch (e) {
        console.warn('Error reading from storage', e);
      }
    }
  }

  restoreDefaults(): void {
    this.users = [...DEFAULT_USERS];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
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
          a.download = `basetrack_backup_${siteToday()}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.lastBackupDate = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
          this.backupSuccessMessage = 'Copia de seguridad exportada y descargada exitosamente en formato JSON seguro.';
          setTimeout(() => this.backupSuccessMessage = '', 5000);
        }
      },
      error: () => {
        const localBackup = {
          export_date: new Date().toISOString(),
          system: 'BASETRACK Industrial Platform',
          users: this.users,
          audit_logs: this.auditLogStore.logs()
        };
        const blob = new Blob([JSON.stringify(localBackup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `basetrack_local_backup_${siteToday()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.lastBackupDate = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
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
                    // Sin DNI real se deja vacío: nunca se inventa un documento (CLAUDE.md §3.2)
                    document_id: r.document_id || '',
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
          this.guardsStore.load();
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
          this.guardsStore.load();
          this.crewService.loadCrew().subscribe();
          this.cdr.detectChanges();
        }
      });
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

      this.guardsStore.clear();
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
          this.guardsStore.load();
          this.deviceFleetStore.load();
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
            this.guardsStore.load();
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

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }
}
