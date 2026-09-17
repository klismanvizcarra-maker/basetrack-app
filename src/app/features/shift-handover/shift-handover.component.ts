import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { ShiftReportPdfComponent } from '../reports/shift-report-pdf.component';

export interface ShiftHandover {
  id: string;
  shift_code: string;
  date: string;
  shift_type: 'DIA' | 'NOCHE';
  outgoing_supervisor: string;
  incoming_supervisor: string;
  plant_status: string;
  tonnage_processed: number;
  safety_incidents: string;
  operational_highlights: string;
  pending_tasks: string;
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED';
  created_at: string;
}

@Component({
  selector: 'app-shift-handover',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ShiftReportPdfComponent],
  template: `
    <div class="shift-page animate-fade-in">
      <!-- Header Actions -->
      <div class="page-top-bar">
        <div>
          <h2>Bitácora de Relevo de Guardia</h2>
          <p class="section-sub">Transferencia de turno, seguridad y novedades operacionales</p>
        </div>
        <div class="top-actions-cluster">
          <button class="btn btn-secondary action-btn-pdf" (click)="openPdfReport(latestHandover)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Generar Reporte Oficial PDF
          </button>
          <button class="btn btn-primary" (click)="openCreateModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Registrar Entrega de Guardia
          </button>
        </div>
      </div>

      <!-- Current Handover Banner -->
      <div class="current-handover-banner glass-panel" *ngIf="latestHandover">
        <div class="banner-badge">
          <span class="badge" [class.badge-success]="latestHandover.status === 'ACCEPTED'" [class.badge-warning]="latestHandover.status === 'SUBMITTED'">
            {{ latestHandover.status === 'ACCEPTED' ? 'GUARDIA ACEPTADA' : 'PENDIENTE DE FIRMA' }}
          </span>
          <span class="shift-code-tag">{{ latestHandover.shift_code }}</span>
        </div>

        <div class="banner-grid">
          <div class="banner-cell">
            <span class="cell-label">Supervisor Saliente</span>
            <span class="cell-value">{{ latestHandover.outgoing_supervisor }}</span>
          </div>
          <div class="banner-cell">
            <span class="cell-label">Supervisor Entrante</span>
            <span class="cell-value">{{ latestHandover.incoming_supervisor || 'En espera de relevo' }}</span>
          </div>
          <div class="banner-cell">
            <span class="cell-label">Fecha y Tipo</span>
            <span class="cell-value">{{ latestHandover.date }} (Turno {{ latestHandover.shift_type }})</span>
          </div>
          <div class="banner-cell">
            <span class="cell-label">Tonelaje Procesado</span>
            <span class="cell-value highlight">{{ latestHandover.tonnage_processed | number }} Ton</span>
          </div>
        </div>

        <div class="banner-text-block">
          <span class="block-label">Estado General de Planta:</span>
          <p class="block-content">{{ latestHandover.plant_status }}</p>
        </div>

        <div class="banner-text-block" *ngIf="latestHandover.pending_tasks">
          <span class="block-label">Pendientes Críticos para la Guardia Entrante:</span>
          <p class="block-content highlight-orange">{{ latestHandover.pending_tasks }}</p>
        </div>

        <div class="banner-actions">
          <button class="btn btn-secondary" (click)="openPdfReport(latestHandover)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Exportar Informe Oficial PDF
          </button>
          <button *ngIf="latestHandover.status === 'SUBMITTED' && authService.isSupervisor()" class="btn btn-success" (click)="acceptHandover(latestHandover.id)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Firmar y Aceptar Relevo Formal
          </button>
        </div>
      </div>

      <!-- Handovers Table -->
      <div class="table-card glass-panel">
        <div class="card-head">
          <h3>Historial de Entregas de Turno</h3>
          <span class="total-counter">{{ handovers.length }} Registros</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código Turno</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Sup. Saliente</th>
                <th>Sup. Entrante</th>
                <th>Tonelaje</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of handovers">
                <td class="font-bold">{{ h.shift_code }}</td>
                <td>{{ h.date }}</td>
                <td><span class="badge badge-purple">{{ h.shift_type }}</span></td>
                <td>{{ h.outgoing_supervisor }}</td>
                <td>{{ h.incoming_supervisor }}</td>
                <td>{{ h.tonnage_processed | number }} Ton</td>
                <td>
                  <span class="badge" [class.badge-success]="h.status === 'ACCEPTED'" [class.badge-warning]="h.status === 'SUBMITTED'">
                    {{ h.status }}
                  </span>
                </td>
                <td class="action-cell">
                  <button class="btn btn-secondary btn-sm" (click)="viewDetails(h)">Detalles</button>
                  <button class="btn btn-primary btn-sm btn-pdf-icon" (click)="openPdfReport(h)" title="Generar PDF Oficial">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    PDF
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create Handover Modal -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Registrar Nueva Entrega de Guardia'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="saveHandover()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Código de Turno</label>
              <input type="text" [(ngModel)]="newHandover.shift_code" name="shift_code" required />
            </div>
            <div class="form-group">
              <label>Tipo de Turno</label>
              <select [(ngModel)]="newHandover.shift_type" name="shift_type">
                <option value="DIA">Turno Día (07:00 - 19:00)</option>
                <option value="NOCHE">Turno Noche (19:00 - 07:00)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Supervisor Saliente</label>
              <input type="text" [(ngModel)]="newHandover.outgoing_supervisor" name="outgoing_supervisor" required />
            </div>
            <div class="form-group">
              <label>Supervisor Entrante</label>
              <input type="text" [(ngModel)]="newHandover.incoming_supervisor" name="incoming_supervisor" required />
            </div>
          </div>

          <div class="form-group">
            <label>Tonelaje Tratado en el Turno (Ton)</label>
            <input type="number" [(ngModel)]="newHandover.tonnage_processed" name="tonnage" required />
          </div>

          <div class="form-group">
            <label>Estado General de Planta y Circuitos</label>
            <textarea rows="3" [(ngModel)]="newHandover.plant_status" name="plant_status" placeholder="Describa el comportamiento de molienda, flotación, bombas..." required></textarea>
          </div>

          <div class="form-group">
            <label>Seguridad, Charlas e Incidentes (LTI/MDI)</label>
            <input type="text" [(ngModel)]="newHandover.safety_incidents" name="safety" placeholder="Ej: Cero incidentes, charla de 5 min realizada..." />
          </div>

          <div class="form-group">
            <label>Pendientes y Consignas para la Próxima Guardia</label>
            <textarea rows="2" [(ngModel)]="newHandover.pending_tasks" name="pending" placeholder="Inspecciones programadas, cambio de válvulas..."></textarea>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar y Guardar Relevo</button>
          </div>
        </form>
      </app-modal>

      <!-- Official Shift Report PDF Modal -->
      <app-shift-report-pdf
        [isOpen]="isPdfModalOpen"
        [handover]="selectedHandoverForPdf"
        (close)="isPdfModalOpen = false"
      ></app-shift-report-pdf>
    </div>
  `,
  styles: [`
    .shift-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .top-actions-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .action-btn-pdf {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      font-weight: 600;
      &:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }
    }

    .action-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-pdf-icon {
      background: #059669;
      color: #ffffff;
      padding: 0.35rem 0.65rem;
      &:hover {
        background: #047857;
      }
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

    .current-handover-banner {
      padding: 24px;
      border-radius: var(--radius-xl);
      background: #ffffff;
      border: 1px solid var(--border-subtle);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 8px 24px -4px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .banner-badge {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .shift-code-tag {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--primary-lavender);
    }

    .banner-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      background: var(--bg-card-subtle);
      padding: 14px 18px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);

      @media (max-width: 900px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .banner-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cell-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .cell-value {
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--text-primary);

      &.highlight {
        color: var(--primary-lavender);
        font-size: 1.1rem;
      }
    }

    .banner-text-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .block-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-secondary);
    }

    .block-content {
      font-size: 0.85rem;
      color: var(--text-primary);
      line-height: 1.5;

      &.highlight-orange {
        color: var(--warning);
      }
    }

    .banner-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 10px;
    }

    /* Table */
    .table-card {
      padding: 24px;
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

      .total-counter {
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
        color: var(--text-muted);
        font-weight: 600;
        border-bottom: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        text-transform: uppercase;
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

    .font-bold {
      font-weight: 700;
      color: var(--text-primary);
    }

    /* Modal Form */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
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
export class ShiftHandoverComponent implements OnInit {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  offlineSync = inject(OfflineSyncService);

  handovers: ShiftHandover[] = [];
  latestHandover: ShiftHandover | null = null;
  isCreateModalOpen = false;
  isPdfModalOpen = false;
  selectedHandoverForPdf: ShiftHandover | null = null;

  newHandover = {
    shift_code: 'GUARDIA_A_DIA_' + new Date().toISOString().slice(5, 10).replace('-', ''),
    shift_type: 'DIA' as 'DIA' | 'NOCHE',
    outgoing_supervisor: '',
    incoming_supervisor: '',
    plant_status: '',
    tonnage_processed: 48200,
    safety_incidents: 'Cero accidentes laborales (LTI: 0). Charla de seguridad dictada.',
    pending_tasks: ''
  };

  ngOnInit(): void {
    this.newHandover.outgoing_supervisor = this.authService.currentUser()?.fullName || 'Ing. Carlos Mendoza';
    this.loadHandovers();
  }

  loadHandovers(): void {
    this.http.get<any>('http://localhost:3001/api/shift-handover').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.handovers = res.data;
          this.latestHandover = this.handovers.length > 0 ? this.handovers[0] : null;
        }
      },
      error: () => {
        // Fallback sample
        this.handovers = [
          {
            id: 'sh-1',
            shift_code: 'GUARDIA_A_DIA_01',
            date: new Date().toISOString().split('T')[0],
            shift_type: 'DIA',
            outgoing_supervisor: 'Ing. Roberto Quispe',
            incoming_supervisor: 'Ing. Marco Velásquez',
            plant_status: 'Planta al 94.5% de régimen. SAG y molienda convencional operando sin desvíos.',
            tonnage_processed: 48250,
            safety_incidents: 'LTI: 0. Charlas LOTO completadas.',
            operational_highlights: 'Caudal promedio pulpa: 3,420 m³/h.',
            pending_tasks: 'Inspeccionar desgaste en impelente de bomba PP-102.',
            status: 'ACCEPTED',
            created_at: new Date().toISOString()
          }
        ];
        this.latestHandover = this.handovers[0];
      }
    });
  }

  openCreateModal(): void {
    this.isCreateModalOpen = true;
  }

  saveHandover(): void {
    const payload = {
      ...this.newHandover,
      date: new Date().toISOString().split('T')[0],
      status: 'SUBMITTED'
    };

    if (this.offlineSync.isOnline()) {
      this.http.post<any>('http://localhost:3001/api/shift-handover', payload).subscribe({
        next: () => {
          this.isCreateModalOpen = false;
          this.loadHandovers();
        },
        error: () => {
          this.offlineSync.queueAction('http://localhost:3001/api/shift-handover', 'POST', payload, 'Relevo ' + payload.shift_code);
          this.isCreateModalOpen = false;
        }
      });
    } else {
      this.offlineSync.queueAction('http://localhost:3001/api/shift-handover', 'POST', payload, 'Relevo ' + payload.shift_code);
      this.isCreateModalOpen = false;
    }
  }

  acceptHandover(id: string): void {
    this.http.patch<any>(`http://localhost:3001/api/shift-handover/${id}/accept`, {}).subscribe({
      next: () => {
        this.loadHandovers();
      }
    });
  }

  viewDetails(h: ShiftHandover): void {
    this.latestHandover = h;
  }

  openPdfReport(h?: ShiftHandover | null): void {
    this.selectedHandoverForPdf = h || this.latestHandover || (this.handovers.length > 0 ? this.handovers[0] : null);
    this.isPdfModalOpen = true;
  }
}
