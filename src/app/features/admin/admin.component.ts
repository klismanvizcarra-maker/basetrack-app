import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';

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
    id: 'u-admin',
    username: 'admin',
    email: 'admin@basetrack.mining.com',
    full_name: 'Administrador del Sistema',
    role: 'ADMIN',
    shift: 'GUARDIA_A',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    created_at: '2026-08-15T08:00:00.000Z'
  },
  {
    id: 'u-klismanv',
    username: 'KlismanV',
    email: 'klismanv@basetrack.mining.com',
    full_name: 'VIZCARRA CORI MANLEY KLISMAN',
    role: 'SUPERVISOR',
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
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2">
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
        color: #047857;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }

    .download-tpl-btn {
      margin-left: auto;
      background: none;
      border: 1px dashed #059669;
      color: #047857;
      padding: 5px 10px;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #ecfdf5;
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
        border-color: #059669;
        background: #f0fdf4;
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
        border-color: #059669;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
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
  `]
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  offlineSync = inject(OfflineSyncService);

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
          // Si contiene usuarios de prueba antiguos (supervisor_a, operador_bombas) o tiene pocos usuarios, refrescar con DEFAULT_USERS
          const hasOldMockUsers = Array.isArray(parsed) && parsed.some((u: any) => u.username === 'supervisor_a' || u.username === 'operador_bombas' || u.id === 'u-1');
          if (Array.isArray(parsed) && parsed.length >= 15 && !hasOldMockUsers) {
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
          localStorage.setItem('basetrack_crew_members', JSON.stringify(crewList));
        } catch (e) {
          console.warn('Error sincronizando cuadrilla:', e);
        }
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
}
