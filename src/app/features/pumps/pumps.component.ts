import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ModalComponent } from '../../shared/ui/modal.component';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';

export interface PumpReport {
  id: string;
  tag: string;
  name: string;
  system: string;
  status: 'OPERATING' | 'STANDBY' | 'MAINTENANCE' | 'FAULT';
  flow_rate_m3h: number;
  pressure_bar: number;
  rpm: number;
  bearing_temp_c: number;
  vibration_mms: number;
  current_amps: number;
  shift_code: string;
  operator_name: string;
  notes?: string;
  created_at: string;
}

@Component({
  selector: 'app-pumps',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="pumps-page animate-fade-in">
      <!-- Top Action Bar -->
      <div class="page-top-bar">
        <div>
          <h2>Reporte de Bombas Slurry & Relaves</h2>
          <p class="section-sub">Monitoreo termográfico, vibracional y caudales de transporte</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Registrar Nueva Bomba / Telemetría
        </button>
      </div>

      <!-- Pump Cards Grid -->
      <div class="pumps-cards-grid">
        <div *ngFor="let pump of pumps" class="pump-card glass-panel" [class.operating]="pump.status === 'OPERATING'" [class.standby]="pump.status === 'STANDBY'" [class.maintenance]="pump.status === 'MAINTENANCE'">
          <div class="pump-card-header">
            <div class="pump-tag-group">
              <span class="pump-tag">{{ pump.tag }}</span>
              <span class="pump-sys">{{ pump.system }}</span>
            </div>
            <span class="badge" [ngClass]="getStatusBadge(pump.status)">
              {{ pump.status }}
            </span>
          </div>

          <h4 class="pump-name">{{ pump.name }}</h4>

          <!-- Live Metrics Grid -->
          <div class="metrics-quad">
            <div class="metric-cell">
              <span class="m-label">Caudal</span>
              <span class="m-value">{{ pump.flow_rate_m3h }} <small>m³/h</small></span>
            </div>
            <div class="metric-cell">
              <span class="m-label">Presión Descarga</span>
              <span class="m-value">{{ pump.pressure_bar }} <small>bar</small></span>
            </div>
            <div class="metric-cell">
              <span class="m-label">Temp. Rodamiento</span>
              <span class="m-value" [class.warn]="pump.bearing_temp_c > 65">
                {{ pump.bearing_temp_c }} <small>°C</small>
              </span>
            </div>
            <div class="metric-cell">
              <span class="m-label">Vibración DE</span>
              <span class="m-value" [class.alert]="pump.vibration_mms > 4.0">
                {{ pump.vibration_mms }} <small>mm/s</small>
              </span>
            </div>
          </div>

          <!-- Footer with quick status change button -->
          <div class="pump-footer">
            <span class="op-label">Op: {{ pump.operator_name }}</span>
            <button class="btn btn-secondary btn-sm" (click)="openStatusModal(pump)">
              Cambiar Estado
            </button>
          </div>
        </div>
      </div>

      <!-- Create Pump Modal -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Registrar Nueva Telemetría de Bomba'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="savePump()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Tag de Bomba (Ej: PP-103)</label>
              <input type="text" [(ngModel)]="newPump.tag" name="tag" required />
            </div>
            <div class="form-group">
              <label>Sistema de Proceso</label>
              <select [(ngModel)]="newPump.system" name="system">
                <option value="ALIMENTACION_CICLONES">Alimentación Ciclones</option>
                <option value="DESCARGA_MOLIENDA">Descarga Molienda</option>
                <option value="TRANSPORTE_RELAVES">Transporte Relaves</option>
                <option value="AGUA_RECUPERADA">Agua Recuperada</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Nombre del Equipo</label>
            <input type="text" [(ngModel)]="newPump.name" name="name" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Estado Operacional</label>
              <select [(ngModel)]="newPump.status" name="status">
                <option value="OPERATING">En Operación (OPERATING)</option>
                <option value="STANDBY">En Reserva (STANDBY)</option>
                <option value="MAINTENANCE">En Mantenimiento (MAINTENANCE)</option>
                <option value="FAULT">Falla / Bloqueo (FAULT)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Caudal (m³/h)</label>
              <input type="number" [(ngModel)]="newPump.flow_rate_m3h" name="flow" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Presión Descarga (bar)</label>
              <input type="number" step="0.1" [(ngModel)]="newPump.pressure_bar" name="press" />
            </div>
            <div class="form-group">
              <label>Temp. Rodamiento (°C)</label>
              <input type="number" step="0.1" [(ngModel)]="newPump.bearing_temp_c" name="temp" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Vibración (mm/s)</label>
              <input type="number" step="0.1" [(ngModel)]="newPump.vibration_mms" name="vib" />
            </div>
            <div class="form-group">
              <label>Corriente (Amperios)</label>
              <input type="number" [(ngModel)]="newPump.current_amps" name="amps" />
            </div>
          </div>

          <div class="form-group">
            <label>Observaciones de Turno</label>
            <textarea rows="2" [(ngModel)]="newPump.notes" name="notes"></textarea>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar Telemetría</button>
          </div>
        </form>
      </app-modal>

      <!-- Status Update Modal -->
      <app-modal [isOpen]="isStatusModalOpen" [title]="'Actualizar Estado de Bomba: ' + selectedPump?.tag" (close)="isStatusModalOpen = false">
        <div class="status-modal-content">
          <div class="form-group">
            <label>Nuevo Estado</label>
            <select [(ngModel)]="updatedStatus" name="updatedStatus">
              <option value="OPERATING">En Operación</option>
              <option value="STANDBY">En Reserva (Standby)</option>
              <option value="MAINTENANCE">En Mantenimiento</option>
              <option value="FAULT">Bloqueo por Falla</option>
            </select>
          </div>

          <div class="form-group">
            <label>Nota de Modificación</label>
            <textarea rows="3" [(ngModel)]="updatedNotes" placeholder="Razón del cambio de estado..."></textarea>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isStatusModalOpen = false">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="applyStatusUpdate()">Actualizar</button>
          </div>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .pumps-page {
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

    .pumps-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .pump-card {
      padding: 22px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: var(--transition-smooth);

      &:hover {
        transform: translateY(-2px);
        border-color: var(--primary-border);
      }

      &.operating {
        border-left: 4px solid var(--success);
      }

      &.standby {
        border-left: 4px solid var(--warning);
      }

      &.maintenance {
        border-left: 4px solid var(--danger);
      }
    }

    .pump-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .pump-tag-group {
      display: flex;
      flex-direction: column;
    }

    .pump-tag {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--primary-lavender);
    }

    .pump-sys {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .pump-name {
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--text-primary);
      min-height: 2.4em;
    }

    .metrics-quad {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: var(--bg-card-subtle);
      padding: 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }

    .metric-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .m-label {
      font-size: 0.68rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .m-value {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);

      small {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-weight: 400;
      }

      &.warn { color: var(--warning); }
      &.alert { color: var(--danger); font-weight: 800; }
    }

    .pump-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid var(--border-subtle);
    }

    .op-label {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    /* Modals */
    .modal-form, .status-modal-content {
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
export class PumpsComponent implements OnInit {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);

  pumps: PumpReport[] = [];
  isCreateModalOpen = false;
  isStatusModalOpen = false;
  selectedPump: PumpReport | null = null;
  updatedStatus: 'OPERATING' | 'STANDBY' | 'MAINTENANCE' | 'FAULT' = 'OPERATING';
  updatedNotes = '';

  newPump = {
    tag: 'PP-103',
    name: 'Bomba Slurry Concentradora Standby 03',
    system: 'ALIMENTACION_CICLONES',
    status: 'OPERATING' as const,
    flow_rate_m3h: 1750,
    pressure_bar: 4.6,
    rpm: 590,
    bearing_temp_c: 61.5,
    vibration_mms: 2.1,
    current_amps: 295,
    notes: 'Telemetría de inicio de turno'
  };

  ngOnInit(): void {
    this.loadPumps();
  }

  loadPumps(): void {
    this.http.get<any>('http://localhost:3001/api/pumps').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.pumps = res.data;
        }
      },
      error: () => {
        // Fallback
        this.pumps = [
          {
            id: 'p-1', tag: 'PP-101', name: 'Bomba Slurry Alimentación Ciclones 01',
            system: 'ALIMENTACION_CICLONES', status: 'OPERATING', flow_rate_m3h: 1850,
            pressure_bar: 4.8, rpm: 580, bearing_temp_c: 62.4, vibration_mms: 2.3,
            current_amps: 310, shift_code: 'GUARDIA_A', operator_name: 'Juan Pérez',
            created_at: new Date().toISOString()
          },
          {
            id: 'p-2', tag: 'PP-102', name: 'Bomba Slurry Alimentación Ciclones 02',
            system: 'ALIMENTACION_CICLONES', status: 'STANDBY', flow_rate_m3h: 0,
            pressure_bar: 0.1, rpm: 0, bearing_temp_c: 34.0, vibration_mms: 0.2,
            current_amps: 0, shift_code: 'GUARDIA_A', operator_name: 'Juan Pérez',
            created_at: new Date().toISOString()
          },
          {
            id: 'p-3', tag: 'TL-201', name: 'Bomba de Pulpa Relaves Espesados',
            system: 'TRANSPORTE_RELAVES', status: 'OPERATING', flow_rate_m3h: 2150,
            pressure_bar: 6.2, rpm: 720, bearing_temp_c: 68.1, vibration_mms: 3.1,
            current_amps: 420, shift_code: 'GUARDIA_A', operator_name: 'Marcos Alanya',
            created_at: new Date().toISOString()
          }
        ];
      }
    });
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'OPERATING': return 'badge-success';
      case 'STANDBY': return 'badge-warning';
      case 'MAINTENANCE':
      case 'FAULT': return 'badge-danger';
      default: return 'badge-purple';
    }
  }

  openCreateModal(): void {
    this.isCreateModalOpen = true;
  }

  savePump(): void {
    if (this.offlineSync.isOnline()) {
      this.http.post<any>('http://localhost:3001/api/pumps', this.newPump).subscribe({
        next: () => {
          this.isCreateModalOpen = false;
          this.loadPumps();
        },
        error: () => {
          this.offlineSync.queueAction('http://localhost:3001/api/pumps', 'POST', this.newPump, 'Bomba ' + this.newPump.tag);
          this.isCreateModalOpen = false;
        }
      });
    } else {
      this.offlineSync.queueAction('http://localhost:3001/api/pumps', 'POST', this.newPump, 'Bomba ' + this.newPump.tag);
      this.isCreateModalOpen = false;
    }
  }

  openStatusModal(pump: PumpReport): void {
    this.selectedPump = pump;
    this.updatedStatus = pump.status;
    this.updatedNotes = pump.notes || '';
    this.isStatusModalOpen = true;
  }

  applyStatusUpdate(): void {
    if (!this.selectedPump) return;

    const payload = {
      status: this.updatedStatus,
      notes: this.updatedNotes
    };

    this.http.patch<any>(`http://localhost:3001/api/pumps/${this.selectedPump.id}/status`, payload).subscribe({
      next: () => {
        this.isStatusModalOpen = false;
        this.loadPumps();
      }
    });
  }
}
