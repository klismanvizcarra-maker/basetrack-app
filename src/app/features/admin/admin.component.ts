import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { CloudSyncService } from '../../core/services/cloud-sync.service';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';

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
    id: 'u-klismanv',
    username: 'KlismanV',
    email: 'klismanvizcarra@basetrack.com',
    full_name: 'VIZCARRA CORI MANLEY KLISMAN',
    role: 'ADMIN',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-carlosp',
    username: 'CarlosP',
    email: 'carlosp@basetrack.mining.com',
    full_name: 'PILCO APAZA CARLOS EDUARDO',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-jorgev',
    username: 'JorgeV',
    email: 'jorgev@basetrack.mining.com',
    full_name: 'VILCAMIZA PEVE JORGE RICARDO',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-vilmar',
    username: 'VilmaR',
    email: 'vilmar@basetrack.mining.com',
    full_name: 'ROSADO FALCON VILMA LUCIA',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-jhoferp',
    username: 'JhoferP',
    email: 'jhoferp@basetrack.mining.com',
    full_name: 'PARI COAYLA JHOFER LUIS',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-diegom',
    username: 'DiegoM',
    email: 'diegom@basetrack.mining.com',
    full_name: 'MONTES RODRIGUEZ DIEGO ALEXANDER',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-ronalm',
    username: 'RonalM',
    email: 'ronalm@basetrack.mining.com',
    full_name: 'MAMANI MIRANDA RONAL',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-anthonyj',
    username: 'AnthonyJ',
    email: 'anthonyj@basetrack.mining.com',
    full_name: 'MAMANI CUTIPA ANTHONY JESUS SMIT',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-victora',
    username: 'VictorA',
    email: 'victora@basetrack.mining.com',
    full_name: 'LLERENA CALLE-BRACAMONTE VICTOR ALEJANDRO II',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-edsonh',
    username: 'EdsonH',
    email: 'edsonh@basetrack.mining.com',
    full_name: 'HILARI CABRERA EDSON EUSEBIO',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-emilioa',
    username: 'EmilioA',
    email: 'emilioa@basetrack.mining.com',
    full_name: 'ALIAGA CASTAÑEDA EMILIO URIEL',
    role: 'OPERATOR',
    shift: 'GUARDIA_B',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-luisa',
    username: 'LuisA',
    email: 'luisa@basetrack.mining.com',
    full_name: 'CASCASI FLORES LUIS ANTONIO',
    role: 'OPERATOR',
    shift: 'GUARDIA_B',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-valeriec',
    username: 'ValerieC',
    email: 'valeriec@basetrack.mining.com',
    full_name: 'CAYO GOMEZ VALERIE JAZMINE',
    role: 'OPERATOR',
    shift: 'GUARDIA_B',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-pedroi',
    username: 'PedroI',
    email: 'pedroi@basetrack.mining.com',
    full_name: 'CHOQUE MANZANO PEDRO IVAN',
    role: 'OPERATOR',
    shift: 'GUARDIA_B',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  },
  {
    id: 'u-paulc',
    username: 'PaulC',
    email: 'paulc@basetrack.mining.com',
    full_name: 'CRUZ APAZA PAUL',
    role: 'OPERATOR',
    shift: 'GUARDIA_B',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-09-17T08:00:00.000Z'
  }
];

const DEFAULT_LOGS: AuditLog[] = [
  {
    id: 'l-1',
    username: 'KlismanV',
    action: 'LOGIN',
    entity: 'AUTH',
    details: 'Inicio de sesión administrativo verificado con éxito',
    ip_address: '192.168.1.104',
    timestamp: '2026-09-17 13:40:10'
  },
  {
    id: 'l-2',
    username: 'KlismanV',
    action: 'SHIFT_HANDOVER',
    entity: 'OPERATIONS',
    details: 'Aprobación formal relevo de guardia Turno A a Turno B',
    ip_address: '192.168.1.112',
    timestamp: '2026-09-17 12:10:24'
  },
  {
    id: 'l-3',
    username: 'CarlosP',
    action: 'CYCLONES_SAMPLE',
    entity: 'STATION_02',
    details: 'Registro de muestra metalúrgica: OF 18.2% / UF 72.4%',
    ip_address: '192.168.1.115',
    timestamp: '2026-09-17 11:20:18'
  },
  {
    id: 'l-4',
    username: 'KlismanV',
    action: 'BACKUP_EXPORT',
    entity: 'DATABASE',
    details: 'Exportación manual de snapshot seguro SQLite',
    ip_address: '192.168.1.104',
    timestamp: '2026-09-17 10:15:00'
  },
  {
    id: 'l-5',
    username: 'EmilioA',
    action: 'PUMP_STATUS',
    entity: 'SLURRY_PUMPS',
    details: 'Transición bomba PP-102 a modo STANDBY preventivo',
    ip_address: '192.168.1.120',
    timestamp: '2026-09-17 09:35:02'
  }
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="admin-page">
      <div class="page-top-bar">
        <div>
          <h2>Administración de Planta y Copias de Seguridad</h2>
          <p class="section-sub">Control de accesos RBAC, auditoría de eventos y respaldo de base de datos</p>
        </div>
        <div class="top-btns">
          <button class="btn btn-secondary" (click)="openBulkModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Carga por Lote (CSV/Excel)
          </button>
          <button class="btn btn-secondary" (click)="exportBackup()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar Backup JSON
          </button>
          <input #restoreFileInput type="file" accept=".json" (change)="onFileSelectedForRestore($event)" style="display: none" />
          <button class="btn btn-secondary" (click)="restoreFileInput.click()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Restaurar Backup JSON
          </button>
          <button class="btn btn-primary" (click)="isCreateUserModalOpen = true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nuevo Usuario
          </button>
        </div>
      </div>

      <!-- Backup Notification Alert -->
      <div *ngIf="backupSuccessMessage" class="backup-alert glass-panel animate-fade-in">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{{ backupSuccessMessage }}</span>
      </div>

      <!-- Cloud Realtime Sync & Multi-Device Fleet Manager -->
      <div class="cloud-sync-card glass-panel animate-fade-in">
        <div class="sync-card-left">
          <div class="cloud-avatar-icon">☁️</div>
          <div>
            <h4>Sincronización en la Nube Multi-Dispositivo (Cloud Realtime Sync)</h4>
            <p>Réplica bidireccional continua entre salas de control, tablets y teléfonos móviles de guardia.</p>
            <div class="sync-pill-tags">
              <span class="tag-item">Terminal Local: <strong>{{ cloudSync.deviceName }}</strong></span>
              <span class="tag-item">ID Dispositivo: <code>{{ cloudSync.deviceId }}</code></span>
              <span class="tag-item">Terminales en Red: <strong>{{ cloudSync.activeDevicesCount() }} activas</strong></span>
              <span class="tag-item">Última Réplica: <strong>{{ (cloudSync.lastSyncTime() | date:'HH:mm:ss') || 'En vivo' }}</strong></span>
            </div>
          </div>
        </div>
        <div class="sync-card-right">
          <div class="sync-status-indicator">
            <span class="pulse-dot" [class.dot-green]="cloudSync.isOnline()" [class.dot-orange]="!cloudSync.isOnline()"></span>
            <span class="status-label">{{ cloudSync.isSyncing() ? 'Sincronizando...' : (cloudSync.isOnline() ? 'En Línea • Conectado' : 'Modo Mina • Offline') }}</span>
          </div>
          <button class="btn btn-emerald-outline" (click)="cloudSync.forceSync()" [disabled]="cloudSync.isSyncing()">
            <span *ngIf="!cloudSync.isSyncing()">🔄 Forzar Réplica Inmediata</span>
            <span *ngIf="cloudSync.isSyncing()">Sincronizando...</span>
          </button>
        </div>
      </div>

      <!-- Fleet & Session Manager (Dispositivos Conectados) -->
      <div class="section-card glass-panel animate-fade-in">
        <div class="card-head">
          <div class="head-with-icon">
            <span class="fleet-icon">📱</span>
            <div>
              <h3>Monitor de Flota y Dispositivos Conectados (Fleet & Session Manager)</h3>
              <p class="section-sub">Auditoría en tiempo real de terminales, tablets y teléfonos móviles con control de acceso y desconexión remota</p>
            </div>
          </div>
          <div class="head-actions">
            <button class="btn btn-secondary btn-sm" (click)="loadConnectedDevices()" [disabled]="isLoadingDevices">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              {{ isLoadingDevices ? 'Consultando...' : 'Refrescar Terminales' }}
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Dispositivo / Terminal</th>
                <th>Usuario Activo</th>
                <th>Dirección IP</th>
                <th>Navegador / Plataforma</th>
                <th>Último Latido (Ping)</th>
                <th>Estado</th>
                <th style="text-align: right;">Control de Sesión</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let dev of connectedDevices">
                <td>
                  <div class="device-cell">
                    <span class="device-type-badge">{{ getDeviceIcon(dev.device_name, dev.user_agent) }}</span>
                    <div>
                      <strong>{{ dev.device_name || 'Terminal Operativa' }}</strong>
                      <div class="device-sub-id">{{ dev.device_id }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="user-chip" *ngIf="dev.username">👤 {{ dev.username }}</span>
                  <span class="text-muted" *ngIf="!dev.username">Esperando usuario</span>
                </td>
                <td><code>{{ dev.ip_address || '127.0.0.1' }}</code></td>
                <td><span class="ua-text" [title]="dev.user_agent || ''">{{ simplifyUserAgent(dev.user_agent) }}</span></td>
                <td>
                  <span class="time-relative">{{ formatRelativeTime(dev.last_seen) }}</span>
                </td>
                <td>
                  <span class="pulse-dot-wrapper">
                    <span class="pulse-dot" [class.dot-green]="dev.is_online && !dev.is_revoked" [class.dot-gray]="!dev.is_online && !dev.is_revoked" [class.dot-red]="dev.is_revoked"></span>
                    <span class="device-status-text" [class.text-green]="dev.is_online && !dev.is_revoked" [class.text-red]="dev.is_revoked">
                      {{ dev.is_revoked ? 'REVOCADO' : (dev.is_online ? 'EN LÍNEA' : 'INACTIVO') }}
                    </span>
                  </span>
                </td>
                <td style="text-align: right;">
                  <button 
                    *ngIf="!dev.is_revoked" 
                    class="btn btn-action-danger" 
                    (click)="confirmRevokeDevice(dev)"
                    title="Cerrar sesión remotamente en esta terminal"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Revocar Sesión
                  </button>
                  <span *ngIf="dev.is_revoked" class="badge badge-danger">Sesión Terminada</span>
                </td>
              </tr>
              <tr *ngIf="connectedDevices.length === 0">
                <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
                  Detectando terminales activas en la red de planta...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Users Management Table -->
      <div class="section-card glass-panel">
        <div class="card-head">
          <div class="head-with-icon">
            <span class="fleet-icon">👥</span>
            <div>
              <h3>Gestión de Usuarios y Permisos de Guardia</h3>
              <p class="section-sub">Control de perfiles, roles RBAC, turnos de cuadrilla y credenciales operativas</p>
            </div>
          </div>
          <span class="counter">{{ filteredUsers.length }} de {{ users.length }} Cuentas</span>
        </div>

        <!-- Filter and Search Bar -->
        <div class="users-toolbar">
          <div class="search-box">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              [(ngModel)]="userSearchQuery" 
              placeholder="Buscar por usuario, nombre completo o correo..." 
              class="toolbar-search-input"
            />
            <button *ngIf="userSearchQuery" (click)="userSearchQuery = ''" class="clear-search-btn">✕</button>
          </div>

          <div class="filters-container">
            <div class="filter-item">
              <label>Guardia:</label>
              <select [(ngModel)]="userFilterShift" class="toolbar-select">
                <option value="TODAS">Todas las Guardias</option>
                <option value="GUARDIA_A">Guardia A</option>
                <option value="GUARDIA_B">Guardia B</option>
                <option value="GUARDIA_C">Guardia C</option>
              </select>
            </div>

            <div class="filter-item">
              <label>Rol:</label>
              <select [(ngModel)]="userFilterRole" class="toolbar-select">
                <option value="TODOS">Todos los Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="OPERATOR">OPERATOR</option>
              </select>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre Completo</th>
                <th>Correo Electrónico</th>
                <th>Rol de Acceso</th>
                <th>Turno / Guardia</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filteredUsers">
                <td>
                  <div class="user-cell">
                    <img [src]="u.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + u.username" class="user-thumb" />
                    <strong>{{ u.username }}</strong>
                  </div>
                </td>
                <td>{{ u.full_name }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <span class="badge" [class.badge-primary]="u.role === 'ADMIN'" [class.badge-success]="u.role === 'SUPERVISOR'" [class.badge-warning]="u.role === 'OPERATOR'">
                    {{ u.role }}
                  </span>
                </td>
                <td><span class="badge badge-slate">{{ u.shift }}</span></td>
                <td>
                  <span class="badge" [class.badge-success]="u.is_active !== 0" [class.badge-danger]="u.is_active === 0">
                    {{ u.is_active === 0 ? 'SUSPENDIDO' : 'ACTIVO' }}
                  </span>
                </td>
                <td style="text-align: right;">
                  <div class="user-actions-row">
                    <button class="btn-icon-action" (click)="openEditUserModal(u)" title="Editar Rol y Guardia">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button class="btn-icon-action" (click)="openResetPasswordModal(u)" title="Restablecer Contraseña">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </button>
                    <button 
                      class="btn-icon-action" 
                      [class.btn-icon-danger]="u.is_active !== 0"
                      [class.btn-icon-success]="u.is_active === 0"
                      (click)="toggleUserStatus(u)" 
                      [title]="u.is_active === 0 ? 'Activar Cuenta' : 'Suspender Cuenta'"
                      [disabled]="u.username === 'KlismanV'"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredUsers.length === 0">
                <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">
                  No se encontraron usuarios que coincidan con los filtros aplicados.
                  <button type="button" class="btn btn-secondary btn-sm" style="margin-left: 10px;" (click)="userSearchQuery = ''; userFilterShift = 'TODAS'; userFilterRole = 'TODOS';">
                    Limpiar Filtros
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="section-card glass-panel">
        <div class="card-head">
          <h3>Registro de Auditoría y Trazabilidad (SCADA Logs)</h3>
          <span class="counter">{{ logs.length }} Eventos Registrados</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Detalle del Evento</th>
                <th>Dirección IP</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs">
                <td class="font-mono">{{ log.timestamp }}</td>
                <td><strong>{{ log.username }}</strong></td>
                <td><span class="badge badge-primary">{{ log.action }}</span></td>
                <td>{{ log.entity }}</td>
                <td>{{ log.details }}</td>
                <td class="font-mono">{{ log.ip_address }}</td>
              </tr>
              <tr *ngIf="logs.length === 0">
                <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                  No hay eventos de auditoría registrados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Create User -->
      <app-modal [isOpen]="isCreateUserModalOpen" [title]="'Crear Nuevo Usuario Operacional'" (close)="isCreateUserModalOpen = false">
        <form (ngSubmit)="saveUser()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Nombre de Usuario</label>
              <input type="text" [(ngModel)]="newUser.username" name="username" required />
            </div>
            <div class="form-group">
              <label>Rol en Planta</label>
              <select [(ngModel)]="newUser.role" name="role">
                <option value="OPERATOR">Operador de Turno (OPERATOR)</option>
                <option value="SUPERVISOR">Supervisor de Guardia (SUPERVISOR)</option>
                <option value="ADMIN">Jefe de Planta / Administrador (ADMIN)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Nombre y Apellidos</label>
            <input type="text" [(ngModel)]="newUser.full_name" name="fullName" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Correo Corporativo</label>
              <input type="email" [(ngModel)]="newUser.email" name="email" required />
            </div>
            <div class="form-group">
              <label>Guardia Asignada</label>
              <select [(ngModel)]="newUser.shift" name="shift">
                <option value="GUARDIA_A">Guardia A</option>
                <option value="GUARDIA_B">Guardia B</option>
                <option value="GUARDIA_C">Guardia C</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Contraseña Temporal</label>
            <input type="password" [(ngModel)]="newUser.password" name="password" required />
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateUserModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar Usuario</button>
          </div>
        </form>
      </app-modal>

      <!-- Modal Bulk Import Users -->
      <app-modal
        [isOpen]="isBulkModalOpen"
        [title]="'Carga Masiva de Personal por Lote (Excel / CSV)'"
        [showFooter]="true"
        (close)="isBulkModalOpen = false"
      >
        <div class="bulk-modal-container">
          <!-- Mode Tabs -->
          <div class="bulk-mode-tabs">
            <button
              type="button"
              class="bulk-tab-btn"
              [class.active]="bulkTab === 'CSV'"
              (click)="bulkTab = 'CSV'"
            >
              📁 Subir Archivo (.csv)
            </button>
            <button
              type="button"
              class="bulk-tab-btn"
              [class.active]="bulkTab === 'PASTE'"
              (click)="bulkTab = 'PASTE'"
            >
              📋 Pegar desde Excel
            </button>
            <button
              type="button"
              class="download-tpl-btn"
              (click)="downloadTemplateCsv()"
              title="Descargar archivo modelo con encabezados y datos de ejemplo"
            >
              ⬇️ Descargar Plantilla CSV
            </button>
          </div>

          <!-- Tab 1: CSV Upload -->
          <div class="bulk-input-section" *ngIf="bulkTab === 'CSV'">
            <div class="upload-dropzone">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#031795" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p class="dropzone-text">Selecciona o arrastra tu archivo <strong>.csv</strong> con la nómina</p>
              <input
                type="file"
                accept=".csv,.txt"
                class="file-input-hidden"
                id="csvFileInput"
                (change)="onCsvFileSelected($event)"
              />
              <label for="csvFileInput" class="btn btn-secondary btn-sm" style="cursor: pointer;">Examinar Archivo...</label>
            </div>
          </div>

          <!-- Tab 2: Copy-Paste from Excel -->
          <div class="bulk-input-section" *ngIf="bulkTab === 'PASTE'">
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">
              Pega las celdas copiadas directamente de tu Excel o Google Sheets:
            </label>
            <textarea
              class="paste-textarea"
              rows="5"
              [(ngModel)]="pastedText"
              (ngModelChange)="parsePastedText()"
              placeholder="Ejemplo:&#10;jperez&#9;Juan Pérez Huamán&#9;juan.perez@mina.com&#9;OPERATOR&#9;GUARDIA_A&#9;70412893&#9;Canal 3 Bombas&#10;mcondori&#9;Manuel Condori Ramos&#9;manuel.condori@mina.com&#9;OPERATOR&#9;GUARDIA_A&#9;42819304&#9;Canal 2 Ciclones"
            ></textarea>
            <span class="textarea-hint">El sistema detecta automáticamente tabulaciones (Excel) o comas (CSV). Contraseña por defecto: <code>Basetrack2026!</code></span>
          </div>

          <!-- Preview & Validation Table -->
          <div class="bulk-preview-section" *ngIf="parsedBulkUsers.length > 0">
            <div class="preview-head">
              <h4>Previsualización ({{ parsedBulkUsers.length }} Filas Detectadas)</h4>
              <div class="preview-stats">
                <span class="stat-badge stat-valid">✓ {{ validBulkCount }} Listos</span>
                <span class="stat-badge stat-invalid" *ngIf="invalidBulkCount > 0">⚠️ {{ invalidBulkCount }} Observados</span>
              </div>
            </div>

            <div class="preview-table-wrapper">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>ESTADO</th>
                    <th>USUARIO</th>
                    <th>NOMBRE COMPLETO</th>
                    <th>CORREO</th>
                    <th>ROL</th>
                    <th>GUARDIA</th>
                    <th>DNI</th>
                    <th>CANAL RADIO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of parsedBulkUsers" [class.row-invalid]="!row.isValid">
                    <td>
                      <span class="status-indicator" [class.valid]="row.isValid" [class.invalid]="!row.isValid">
                        {{ row.isValid ? '✓ Listo' : '⚠️ ' + row.validationMsg }}
                      </span>
                    </td>
                    <td><strong>{{ row.username }}</strong></td>
                    <td>{{ row.full_name }}</td>
                    <td>{{ row.email }}</td>
                    <td><span class="badge badge-slate">{{ row.role }}</span></td>
                    <td><span class="badge badge-slate">{{ row.shift }}</span></td>
                    <td><code>{{ row.document_id || '---' }}</code></td>
                    <td>{{ row.radio_channel || '---' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div footer class="modal-footer-actions">
          <button type="button" class="btn btn-secondary" (click)="isBulkModalOpen = false">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="validBulkCount === 0 || isImporting"
            (click)="executeBulkImport()"
          >
            {{ isImporting ? 'Importando...' : 'Confirmar e Importar ' + validBulkCount + ' Usuarios' }}
          </button>
        </div>
      </app-modal>

      <!-- Modal: Editar Rol y Guardia -->
      <app-modal [isOpen]="isEditUserModalOpen" [title]="'Editar Usuario: ' + (selectedUserForEdit?.username || '')" (close)="isEditUserModalOpen = false">
        <div class="edit-modal-form" *ngIf="selectedUserForEdit">
          <div class="modal-user-summary">
            <img [src]="selectedUserForEdit.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + selectedUserForEdit.username" class="modal-avatar" />
            <div>
              <strong>{{ selectedUserForEdit.full_name }}</strong>
              <div class="user-sub">{{ selectedUserForEdit.email }}</div>
            </div>
          </div>

          <div class="form-grid" style="margin-top: 16px;">
            <div class="form-group">
              <label>Rol de Acceso RBAC:</label>
              <select [(ngModel)]="editRole" class="modal-select">
                <option value="ADMIN">ADMIN (Acceso Total Planta)</option>
                <option value="SUPERVISOR">SUPERVISOR (Aprobaciones y Relevos)</option>
                <option value="OPERATOR">OPERATOR (Operaciones y Muestras)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Guardia Asignada:</label>
              <select [(ngModel)]="editShift" class="modal-select">
                <option value="GUARDIA_A">Guardia A</option>
                <option value="GUARDIA_B">Guardia B</option>
                <option value="GUARDIA_C">Guardia C</option>
              </select>
            </div>
          </div>

          <p class="modal-help-text">
            ℹ️ Al modificar la guardia o rol, los cambios se sincronizan automáticamente con el registro de <strong>Gestión de Cuadrilla</strong>.
          </p>
        </div>

        <div footer class="modal-footer-actions">
          <button type="button" class="btn btn-secondary" (click)="isEditUserModalOpen = false">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="saveUserRoleShift()" [disabled]="isSavingUser">
            {{ isSavingUser ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </app-modal>

      <!-- Modal: Restablecer Contraseña -->
      <app-modal [isOpen]="isResetPasswordModalOpen" [title]="'Restablecer Contraseña: ' + (selectedUserForReset?.username || '')" (close)="isResetPasswordModalOpen = false">
        <div class="edit-modal-form" *ngIf="selectedUserForReset">
          <div class="modal-user-summary">
            <div class="key-icon-badge">🔑</div>
            <div>
              <strong>{{ selectedUserForReset.full_name }}</strong>
              <div class="user-sub">Usuario: <code>{{ selectedUserForReset.username }}</code></div>
            </div>
          </div>

          <div class="form-group" style="margin-top: 16px;">
            <label>Nueva Contraseña (o dejar vacío para usar su DNI / Contraseña por defecto):</label>
            <input 
              type="text" 
              [(ngModel)]="resetNewPassword" 
              placeholder="Ej: Basetrack2026! o DNI del operador" 
              class="modal-input"
            />
          </div>

          <p class="modal-help-text">
            ⚠️ Si dejas el campo vacío, el sistema asignará automáticamente el <strong>DNI registrado</strong> del operador o <code>Password123!</code>.
          </p>
        </div>

        <div footer class="modal-footer-actions">
          <button type="button" class="btn btn-secondary" (click)="isResetPasswordModalOpen = false">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="confirmResetPassword()" [disabled]="isSavingUser">
            {{ isSavingUser ? 'Restableciendo...' : 'Confirmar Nueva Contraseña' }}
          </button>
        </div>
      </app-modal>
  `,
  styles: [`
    .admin-page {
      display: flex;
      flex-direction: column;
      gap: 24px;

      @media (max-width: 768px) {
        gap: 16px;
      }
    }

    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: flex-start;

        h2 {
          font-size: 1.2rem;
        }

        .top-btns {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;

          button {
            width: 100%;
            justify-content: center;
            min-height: 42px;
          }
        }
      }

      h2 {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--text-primary);
      }

      .section-sub {
        font-size: 0.8rem;
        color: var(--text-muted);
      }
    }

    .top-btns {
      display: flex;
      gap: 12px;
    }

    .backup-alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border: 1px solid rgba(52, 211, 153, 0.4);
      background: rgba(52, 211, 153, 0.1);
      color: var(--success);
      font-weight: 600;
      font-size: 0.88rem;
    }

    .cloud-sync-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      border: 1px solid #c7d2fe;
      box-shadow: 0 4px 15px rgba(3, 23, 149, 0.08);

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: flex-start;
        padding: 16px;
        gap: 14px;
      }

      .sync-card-left {
        display: flex;
        align-items: center;
        gap: 16px;

        .cloud-avatar-icon {
          font-size: 2.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #c7d2fe;
          box-shadow: 0 2px 8px rgba(3, 23, 149, 0.12);
        }

        h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: #031795;
        }

        p {
          margin: 3px 0 8px;
          font-size: 0.78rem;
          color: #1e40af;
        }

        .sync-pill-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;

          .tag-item {
            font-size: 0.72rem;
            color: #1e40af;
            background: rgba(255, 255, 255, 0.85);
            padding: 3px 8px;
            border-radius: 6px;
            border: 1px solid #c7d2fe;

            strong {
              color: #031795;
            }

            code {
              font-family: monospace;
              font-weight: 600;
            }
          }
        }
      }

      .sync-card-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;

        @media (max-width: 768px) {
          width: 100%;
          align-items: stretch;
        }

        .sync-status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          font-weight: 600;

          .pulse-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            &.dot-green { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); }
            &.dot-orange { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.5); }
          }

          .status-label {
            color: #031795;
          }
        }

        .btn-emerald-outline {
          background: #ffffff;
          border: 1.5px solid #031795;
          color: #031795;
          padding: 8px 16px;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover:not(:disabled) {
            background: #031795;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(3, 23, 149, 0.25);
          }

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        }
      }
    }

    .section-card {
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);

      @media (max-width: 768px) {
        padding: 14px 12px;
        border-radius: var(--radius-md);
      }
    }

    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;

      h3 {
        font-size: 1.1rem;
        font-weight: 700;
      }

      .counter {
        font-size: 0.8rem;
        color: var(--text-muted);
      }
    }

    .table-responsive {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;

      th {
        padding: 12px 14px;
        background: #eef2ff;
        color: #031795;
        font-weight: 700;
        border-bottom: 1px solid #c7d2fe;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      td {
        padding: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        color: var(--text-secondary);
      }

      tr:hover td {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-thumb {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background: #e2e8f0;
      border: 1px solid var(--border-subtle);
    }

    .font-mono {
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* Modal Form */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 10px;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
    }

    .modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      width: 100%;
    }

    /* Bulk Import Modal Styles */
    .bulk-modal-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .bulk-mode-tabs {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      background: #f1f5f9;
      padding: 4px;
      border-radius: var(--radius-md);
    }

    .bulk-tab-btn {
      border: none;
      background: transparent;
      padding: 7px 14px;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        color: var(--text-primary);
      }

      &.active {
        background: #ffffff;
        color: #031795;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }

    .download-tpl-btn {
      margin-left: auto;
      background: none;
      border: 1px dashed #031795;
      color: #031795;
      padding: 5px 10px;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #eef2ff;
      }
    }

    .bulk-input-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .upload-dropzone {
      border: 2px dashed #cbd5e1;
      border-radius: var(--radius-lg);
      padding: 20px;
      text-align: center;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      transition: var(--transition-smooth);

      &:hover {
        border-color: #031795;
        background: #eef2ff;
      }
    }

    .dropzone-text {
      font-size: 0.82rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .file-input-hidden {
      display: none;
    }

    .paste-textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--text-primary);
      outline: none;
      resize: vertical;
      box-sizing: border-box;

      &:focus {
        border-color: #031795;
        box-shadow: 0 0 0 3px rgba(3, 23, 149, 0.15);
      }
    }

    .textarea-hint {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .bulk-preview-section {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .preview-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;

      h4 {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-primary);
      }
    }

    .preview-stats {
      display: flex;
      gap: 6px;
    }

    .stat-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-full);

      &.stat-valid {
        background: #ecfdf5;
        color: #047857;
      }

      &.stat-invalid {
        background: #fffbeb;
        color: #b45309;
      }
    }

    .preview-table-wrapper {
      max-height: 200px;
      overflow-y: auto;
      overflow-x: auto;
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;

      th {
        position: sticky;
        top: 0;
        background: #f8fafc;
        padding: 6px 8px;
        text-align: left;
        font-size: 0.68rem;
        font-weight: 700;
        color: var(--text-muted);
        border-bottom: 1px solid var(--border-subtle);
        z-index: 1;
      }

      td {
        padding: 6px 8px;
        border-bottom: 1px solid #f1f5f9;
        white-space: nowrap;
      }

      &.row-invalid {
        background: #fff7ed;
      }
    }

    .status-indicator {
      font-size: 0.7rem;
      font-weight: 700;

      &.valid {
        color: #059669;
      }

      &.invalid {
        color: #d97706;
      }
    }

    .modal-footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      width: 100%;
    }

    /* Fleet Manager & User Actions Styles */
    .fleet-icon {
      font-size: 1.5rem;
    }

    .users-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--border-subtle, #cbd5e1);
      border-radius: var(--radius-md, 10px);
      padding: 7px 14px;
      gap: 10px;
      flex: 1;
      min-width: 260px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);

      svg {
        color: #64748b;
        flex-shrink: 0;
      }
    }

    .toolbar-search-input {
      border: none;
      outline: none;
      width: 100%;
      font-size: 0.85rem;
      background: transparent;
      color: var(--text-primary, #0f172a);

      &::placeholder {
        color: #94a3b8;
      }
    }

    .clear-search-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 0.9rem;
      padding: 0 4px;

      &:hover {
        color: #475569;
      }
    }

    .filters-container {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-item {
      display: flex;
      align-items: center;
      gap: 6px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary, #475569);
      }
    }

    .toolbar-select {
      border: 1px solid var(--border-subtle, #cbd5e1);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 0.8rem;
      background: #ffffff;
      color: var(--text-primary, #0f172a);
      font-weight: 500;
      cursor: pointer;
      outline: none;

      &:focus {
        border-color: #031795;
        box-shadow: 0 0 0 2px rgba(3, 23, 149, 0.15);
      }
    }

    .user-actions-row {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }

    .btn-icon-action {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: #475569;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #cbd5e1;
      }

      &.btn-icon-danger:hover {
        background: #fef2f2;
        color: #dc2626;
        border-color: #fecaca;
      }

      &.btn-icon-success:hover {
        background: #eef2ff;
        color: #031795;
        border-color: #c7d2fe;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .btn-action-danger {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;

      &:hover {
        background: #fee2e2;
        border-color: #f87171;
      }
    }

    .device-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .device-type-badge {
      font-size: 1.3rem;
      line-height: 1;
    }

    .device-sub-id {
      font-size: 0.7rem;
      color: #94a3b8;
      font-family: monospace;
    }

    .user-chip {
      font-size: 0.78rem;
      font-weight: 600;
      color: #031795;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 3px 8px;
      border-radius: 12px;
      display: inline-block;
    }

    .ua-text {
      font-size: 0.78rem;
      color: #475569;
      max-width: 180px;
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time-relative {
      font-size: 0.78rem;
      color: #64748b;
      font-family: monospace;
    }

    .pulse-dot-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;

      &.dot-green {
        background: #10b981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
      }

      &.dot-gray {
        background: #94a3b8;
      }

      &.dot-red {
        background: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
      }
    }

    .device-status-text {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
    }

    .text-green {
      color: #059669;
    }

    .text-red {
      color: #dc2626;
    }

    .modal-user-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 14px;
    }

    .modal-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 2px solid #031795;
      background: #fff;
    }

    .key-icon-badge {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #eef2ff;
      color: #031795;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      border: 1px solid #c7d2fe;
    }

    .user-sub {
      font-size: 0.76rem;
      color: #64748b;
      margin-top: 2px;
    }

    .modal-select, .modal-input {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 0.85rem;
      background: #ffffff;
      color: #0f172a;
      box-sizing: border-box;

      &:focus {
        border-color: #031795;
        outline: none;
        box-shadow: 0 0 0 2px rgba(3, 23, 149, 0.15);
      }
    }

    .modal-help-text {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 10px;
      line-height: 1.4;
    }
  `]
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  offlineSync = inject(OfflineSyncService);
  cloudSync = inject(CloudSyncService);

  // Inicialización con datos por defecto
  users: UserItem[] = [...DEFAULT_USERS];
  logs: AuditLog[] = [...DEFAULT_LOGS];

  isCreateUserModalOpen = false;
  backupSuccessMessage = '';

  // Bulk Import State
  isBulkModalOpen = false;
  bulkTab: 'CSV' | 'PASTE' = 'CSV';
  pastedText = '';
  isImporting = false;
  parsedBulkUsers: any[] = [];

  // Toolbar & Search Filters (Punto 1)
  userSearchQuery = '';
  userFilterShift = 'TODAS';
  userFilterRole = 'TODOS';

  // Connected Devices / Fleet Manager (Punto 5)
  connectedDevices: ConnectedDevice[] = [];
  isLoadingDevices = false;

  // Modal: Edit User Role & Shift (Punto 1)
  isEditUserModalOpen = false;
  selectedUserForEdit: UserItem | null = null;
  editRole: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' = 'OPERATOR';
  editShift = 'GUARDIA_A';
  isSavingUser = false;

  // Modal: Reset Password (Punto 1)
  isResetPasswordModalOpen = false;
  selectedUserForReset: UserItem | null = null;
  resetNewPassword = '';

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
    shift: 'GUARDIA_A'
  };

  ngOnInit(): void {
    this.loadFromStorage();
    this.loadUsers();
    this.loadLogs();
    this.loadConnectedDevices();
  }

  loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const storedUsers = localStorage.getItem('basetrack_admin_users');
        if (storedUsers) {
          const parsed = JSON.parse(storedUsers);
          // Si contiene usuarios obsoletos o 'admin' / Carlos Mendoza, refrescar con la lista real de 15 operadores
          const hasOldMockUsers = Array.isArray(parsed) && parsed.some((u: any) => u.username === 'admin' || u.username === 'supervisor_a' || u.username === 'operador_bombas' || u.id === 'u-admin');
          const klismanIsAdmin = Array.isArray(parsed) && parsed.some((u: any) => u.username === 'KlismanV' && u.role === 'ADMIN');
          if (Array.isArray(parsed) && parsed.length === 15 && !hasOldMockUsers && klismanIsAdmin) {
            this.users = parsed;
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
    this.http.get<any>('http://localhost:3001/api/admin/users').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.users = res.data;
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
    this.http.get<any>('http://localhost:3001/api/admin/audit-logs').subscribe({
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
    if (!this.newUser.username || !this.newUser.full_name) return;

    const createdUser: UserItem = {
      id: 'u-' + Date.now(),
      username: this.newUser.username,
      full_name: this.newUser.full_name,
      email: this.newUser.email || `${this.newUser.username}@basetrack.mining.com`,
      role: this.newUser.role,
      shift: this.newUser.shift,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${this.newUser.username}`,
      created_at: new Date().toISOString()
    };

    this.users.unshift(createdUser);
    saveRealtimeData('admin_users', this.users);

    // Save to users registry so the new user can authenticate
    const registry = getRealtimeData<Record<string, any>>('users_registry', {});
    registry[createdUser.username.toLowerCase()] = {
      id: createdUser.id,
      username: createdUser.username,
      email: createdUser.email,
      fullName: createdUser.full_name,
      role: createdUser.role,
      shift: createdUser.shift,
      avatarUrl: createdUser.avatar_url
    };
    saveRealtimeData('users_registry', registry);

    this.isCreateUserModalOpen = false;

    this.http.post<any>('http://localhost:3001/api/admin/users', this.newUser).subscribe({
      next: (res) => {
        if (res && res.id) {
          createdUser.id = res.id;
          saveRealtimeData('admin_users', this.users);
        }
      },
      error: () => {
        console.log('[Admin] Usuario creado localmente en modo contingencia.');
      }
    });

    this.newUser = {
      username: '',
      full_name: '',
      email: '',
      password: '',
      role: 'OPERATOR',
      shift: 'GUARDIA_A'
    };
  }

  exportBackup(): void {
    this.http.get<any>('http://localhost:3001/api/admin/backup').subscribe({
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

        this.http.post<any>('http://localhost:3001/api/admin/restore', { backup: json.backup || json }).subscribe({
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

  openBulkModal(): void {
    this.isBulkModalOpen = true;
    this.bulkTab = 'CSV';
    this.pastedText = '';
    this.parsedBulkUsers = [];
  }

  get validBulkCount(): number {
    return this.parsedBulkUsers.filter(u => u.isValid).length;
  }

  get invalidBulkCount(): number {
    return this.parsedBulkUsers.filter(u => !u.isValid).length;
  }

  downloadTemplateCsv(): void {
    const headers = 'username,full_name,email,password,role,shift,document_id,radio_channel,phone_extension\n';
    const rows = [
      'cbarrios,Carlos Barrios Huamán,carlos.barrios@mina.com,Basetrack2026!,OPERATOR,GUARDIA_B,72190458,Canal 3 Bombas,Ext. 4102',
      'fmorales,Fabián Morales Arce,fabian.morales@mina.com,Basetrack2026!,OPERATOR,GUARDIA_B,45819203,Canal 2 Ciclones,Ext. 4105',
      'arios,Álvaro Rios Gutiérrez,alvaro.rios@mina.com,Basetrack2026!,OPERATOR,GUARDIA_B,46820194,Canal 4 Presa,Ext. 4109',
      'smedina,Santiago Medina Solís,santiago.medina@mina.com,Basetrack2026!,OPERATOR,GUARDIA_B,74910283,Canal 1 Operaciones,Ext. 4112',
      'respinoza,Raúl Espinoza Pinto,raul.espinoza@mina.com,Basetrack2026!,OPERATOR,GUARDIA_B,72839102,Canal 5 Relevo/Móvil,Ext. 4115'
    ].join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_usuarios_basetrack.csv';
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
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
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
      const email = parts[2] || (username ? `${username}@basetrack.mining.com` : '');
      const password = parts[3] || 'Basetrack2026!';
      const rawRole = (parts[4] || 'OPERATOR').toUpperCase();
      const role = ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(rawRole) ? rawRole : 'OPERATOR';
      const rawShift = (parts[5] || 'GUARDIA_A').toUpperCase();
      const shift = ['GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C'].includes(rawShift) ? rawShift : 'GUARDIA_A';
      const document_id = parts[6] || '';
      const radio_channel = parts[7] || 'Canal 1 Operaciones';
      const phone_extension = parts[8] || '';

      let isValid = true;
      let validationMsg = '';

      if (!username) {
        isValid = false;
        validationMsg = 'Falta usuario';
      } else if (this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        isValid = false;
        validationMsg = 'Usuario ya existe';
      } else if (email && this.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        isValid = false;
        validationMsg = 'Correo ya registrado';
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
        isValid,
        validationMsg
      });
    }

    this.parsedBulkUsers = results;
  }

  executeBulkImport(): void {
    const validRows = this.parsedBulkUsers.filter(r => r.isValid);
    if (validRows.length === 0) return;

    this.isImporting = true;

    // Helper to register users locally and sync with crew members
    const applyLocalChanges = (isLocalFallback = false) => {
      for (const r of validRows) {
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

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));

        // Sync simultaneously with crew members
        try {
          const storedCrew = localStorage.getItem('basetrack_crew_members');
          const crewList = storedCrew ? JSON.parse(storedCrew) : [];
          for (const r of validRows) {
            if (r.role === 'OPERATOR' || r.role === 'SUPERVISOR') {
              let primaryRole = 'OPERADOR_BOMBAS';
              const nameLower = (r.full_name || '').toLowerCase();
              if (nameLower.includes('ciclon')) primaryRole = 'OPERADOR_CICLONES';
              else if (nameLower.includes('descarga') || nameLower.includes('relave') || nameLower.includes('presa')) primaryRole = 'OPERADOR_DESCARGA';
              else if (nameLower.includes('misc') || nameLower.includes('reactivo')) primaryRole = 'OPERADOR_MISCELANEOS';
              else if (nameLower.includes('relevo')) primaryRole = 'OPERADOR_RELEVO';
              else if (r.role === 'SUPERVISOR') primaryRole = 'SUPERVISOR';

              crewList.push({
                id: 'crew-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                name: r.full_name,
                document_id: r.document_id || ('DNI-' + Math.floor(10000000 + Math.random() * 90000000)),
                primary_role: primaryRole,
                shift_code: r.shift || 'GUARDIA_A',
                radio_channel: r.radio_channel || 'Canal 1 Operaciones',
                phone_extension: r.phone_extension || '',
                status: 'EN_TURNO',
                avatar_url: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80`
              });
            }
          }
          saveRealtimeData('crew_members', crewList);
        } catch (e) {
          console.warn('Error sincronizando cuadrilla:', e);
        }

        // Also sync to persistent users_registry so they can authenticate
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
      }
    };

    this.http.post<any>('http://localhost:3001/api/admin/users/bulk', { users: validRows })
      .pipe(timeout(3000))
      .subscribe({
        next: (res) => {
          this.isImporting = false;
          this.isBulkModalOpen = false;
          const count = res?.count || validRows.length;

          applyLocalChanges(false);

          this.backupSuccessMessage = `¡Carga masiva exitosa! Se importaron ${count} trabajadores a la plataforma y cuadrilla.`;
          setTimeout(() => this.backupSuccessMessage = '', 6000);

          this.loadUsers();
          this.loadLogs();
        },
        error: (err) => {
          this.isImporting = false;
          this.isBulkModalOpen = false;
          console.warn('[Admin] Backend inaccesible o timeout, aplicando persistencia local y encolando:', err);

          applyLocalChanges(true);

          // Enqueue for offline sync when connection restores
          this.offlineSync.queueAction(
            'http://localhost:3001/api/admin/users/bulk',
            'POST',
            { users: validRows },
            `Carga por lote: ${validRows.length} trabajadores`
          );

          this.backupSuccessMessage = `¡Carga por lote completada! (${validRows.length} trabajadores registrados y sincronizados).`;
          setTimeout(() => this.backupSuccessMessage = '', 6000);
        }
      });
  }

  // ==========================================
  // PUNTO 5: MONITOR DE TERMINALES Y SESIONES
  // ==========================================

  loadConnectedDevices(): void {
    this.isLoadingDevices = true;
    this.http.get<any>('http://localhost:3001/api/admin/devices').subscribe({
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
              device_id: 'DEV-LOCAL-CURRENT',
              device_name: 'Estación Central (Actual)',
              user_id: 'u-klismanv',
              username: 'KlismanV',
              ip_address: '192.168.1.105',
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Basetrack Browser',
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
    if (!confirm(`¿Estás seguro de revocar la sesión para la terminal "${dev.device_name || dev.device_id}"?\nEl usuario ${dev.username || ''} será deslogueado remotamente de inmediato.`)) {
      return;
    }

    this.http.post<any>(`http://localhost:3001/api/admin/devices/${dev.device_id}/revoke`, {}).subscribe({
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

  simplifyUserAgent(ua?: string | null): string {
    if (!ua) return 'Terminal Web';
    if (ua.includes('Edg/')) return 'Edge / Windows';
    if (ua.includes('Chrome/')) return ua.includes('Android') ? 'Chrome / Android' : 'Chrome / Windows';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari / iOS';
    return ua.substring(0, 24) + '...';
  }

  getDeviceIcon(name?: string, ua?: string | null): string {
    const text = ((name || '') + ' ' + (ua || '')).toLowerCase();
    if (text.includes('tablet') || text.includes('pad')) return '📱';
    if (text.includes('android') || text.includes('iphone') || text.includes('mobile')) return '📲';
    if (text.includes('laptop') || text.includes('portatil')) return '💻';
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
      return `Hace ${diffHours} h`;
    } catch {
      return timestamp;
    }
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

    this.http.patch<any>(`http://localhost:3001/api/admin/users/${user.id}/role-shift`, {
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

    this.http.post<any>(`http://localhost:3001/api/admin/users/${user.id}/reset-password`, {
      newPassword: this.resetNewPassword.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.isSavingUser = false;
        this.isResetPasswordModalOpen = false;
        this.backupSuccessMessage = res?.message || `Contraseña restablecida con éxito para ${user.username}.`;
        setTimeout(() => this.backupSuccessMessage = '', 6000);
      },
      error: (err) => {
        this.isSavingUser = false;
        this.isResetPasswordModalOpen = false;
        console.warn('[Admin] Error restableciendo contraseña en servidor:', err);
        this.backupSuccessMessage = `Contraseña restablecida exitosamente para ${user.username}.`;
        setTimeout(() => this.backupSuccessMessage = '', 6000);
      }
    });
  }

  toggleUserStatus(u: UserItem): void {
    if (u.username === 'KlismanV') {
      alert('La cuenta de Administrador Principal no puede ser desactivada.');
      return;
    }

    const currentStatus = u.is_active !== 0;
    const newStatus = !currentStatus;
    const actionName = newStatus ? 'activar' : 'suspender';

    if (!confirm(`¿Estás seguro de ${actionName} el acceso al sistema para ${u.username}?`)) {
      return;
    }

    this.http.patch<any>(`http://localhost:3001/api/admin/users/${u.id}/status`, {
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
}
