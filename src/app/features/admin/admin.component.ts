import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AuthService } from '../../core/auth/auth.service';

export interface UserItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
  shift: string;
  avatar_url: string;
  created_at: string;
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
    id: 'u-1',
    username: 'admin',
    email: 'admin@basetrack.mining.com',
    full_name: 'Ing. Carlos Mendoza (Jefe de Planta)',
    role: 'ADMIN',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-08-15T08:00:00.000Z'
  },
  {
    id: 'u-2',
    username: 'supervisor_a',
    email: 'supervisor.a@basetrack.mining.com',
    full_name: 'Ing. Roberto Quispe (Supervisor Turno A)',
    role: 'SUPERVISOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-08-16T14:30:00.000Z'
  },
  {
    id: 'u-3',
    username: 'operador_bombas',
    email: 'juan.perez@basetrack.mining.com',
    full_name: 'Juan Pérez (Operador Sala de Bombas)',
    role: 'OPERATOR',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-08-18T07:15:00.000Z'
  },
  {
    id: 'u-4',
    username: 'supervisor_b',
    email: 'supervisor.b@basetrack.mining.com',
    full_name: 'Ing. Marco Velásquez (Supervisor Turno B)',
    role: 'SUPERVISOR',
    shift: 'GUARDIA_B',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-08-20T19:00:00.000Z'
  }
];

const DEFAULT_LOGS: AuditLog[] = [
  {
    id: 'l-1',
    username: 'admin',
    action: 'LOGIN',
    entity: 'AUTH',
    details: 'Inicio de sesión administrativo verificado con éxito',
    ip_address: '192.168.1.104',
    timestamp: '2026-09-16 19:45:10'
  },
  {
    id: 'l-2',
    username: 'supervisor_a',
    action: 'SHIFT_HANDOVER',
    entity: 'OPERATIONS',
    details: 'Aprobación formal relevo de guardia Turno A a Turno B',
    ip_address: '192.168.1.112',
    timestamp: '2026-09-16 19:10:24'
  },
  {
    id: 'l-3',
    username: 'operador_bombas',
    action: 'PUMP_STATUS',
    entity: 'SLURRY_PUMPS',
    details: 'Transición bomba PP-102 a modo STANDBY preventivo',
    ip_address: '192.168.1.120',
    timestamp: '2026-09-16 18:35:02'
  },
  {
    id: 'l-4',
    username: 'admin',
    action: 'BACKUP_EXPORT',
    entity: 'DATABASE',
    details: 'Exportación manual de snapshot seguro SQLite',
    ip_address: '192.168.1.104',
    timestamp: '2026-09-16 17:15:00'
  },
  {
    id: 'l-5',
    username: 'supervisor_b',
    action: 'CYCLONES_SAMPLE',
    entity: 'STATION_02',
    details: 'Registro de muestra metalúrgica: OF 18.2% / UF 72.4%',
    ip_address: '192.168.1.115',
    timestamp: '2026-09-16 16:20:18'
  }
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="admin-page animate-fade-in">
      <div class="page-top-bar">
        <div>
          <h2>Administración de Planta y Copias de Seguridad</h2>
          <p class="section-sub">Control de accesos RBAC, auditoría de eventos y respaldo de base de datos</p>
        </div>
        <div class="top-btns">
          <button class="btn btn-secondary" (click)="exportBackup()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar Backup JSON
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

      <!-- Users Management Table -->
      <div class="section-card glass-panel">
        <div class="card-head">
          <h3>Usuarios del Sistema y Permisos de Guardia</h3>
          <span class="counter">{{ users.length }} Cuentas Registradas</span>
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
                <th>Fecha Registro</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of users">
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
                <td>{{ u.created_at | date:'shortDate' }}</td>
              </tr>
              <tr *ngIf="users.length === 0">
                <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                  No hay cuentas registradas en este momento.
                  <button type="button" class="btn btn-secondary" style="margin-left: 12px; padding: 4px 12px; font-size: 0.78rem;" (click)="restoreDefaults()">
                    Restaurar Cuentas de Demostración
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
    </div>
  `,
  styles: [`
    .admin-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;

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

    .section-card {
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
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
        background: #e6f7ef;
        color: #047857;
        font-weight: 700;
        border-bottom: 1px solid #a7f3d0;
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
  `]
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  authService = inject(AuthService);

  // Inicialización con datos por defecto
  users: UserItem[] = [...DEFAULT_USERS];
  logs: AuditLog[] = [...DEFAULT_LOGS];

  isCreateUserModalOpen = false;
  backupSuccessMessage = '';

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
  }

  loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const storedUsers = localStorage.getItem('basetrack_admin_users');
        if (storedUsers) {
          const parsed = JSON.parse(storedUsers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.users = parsed;
          }
        } else {
          localStorage.setItem('basetrack_admin_users', JSON.stringify(DEFAULT_USERS));
        }

        const storedLogs = localStorage.getItem('basetrack_admin_logs');
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.logs = parsed;
          }
        } else {
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
    }
    this.isCreateUserModalOpen = false;

    this.http.post<any>('http://localhost:3001/api/admin/users', this.newUser).subscribe({
      next: (res) => {
        if (res && res.id) {
          createdUser.id = res.id;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('basetrack_admin_users', JSON.stringify(this.users));
          }
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
}
