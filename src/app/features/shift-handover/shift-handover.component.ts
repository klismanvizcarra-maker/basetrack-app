import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { ShiftReportPdfComponent } from '../reports/shift-report-pdf.component';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';
import { CrewService } from '../../core/services/crew.service';
import { PermissionsService } from '../../core/auth/permissions.service';
import { VehicleChecklistService, HandoverVehicleObservation } from '../../core/services/vehicle-checklist.service';
import { getCurrentActiveShift, getLocalDateString } from '../../shared/utils/roster.util';

export interface ShiftHandover {
  id: string;
  shift_code: string;
  date: string;
  shift_type: 'DIA' | 'NOCHE';
  outgoing_supervisor: string;
  outgoing_dni?: string;
  outgoing_role?: string;
  incoming_supervisor: string;
  incoming_dni?: string;
  incoming_role?: string;
  plant_status: string;
  tonnage_processed: number;
  safety_incidents: string;
  operational_highlights: string;
  pending_tasks: string;
  assigned_crew?: any[];
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED';
  created_at: string;
}

export interface OfficialSupervisor {
  name: string;
  dni: string;
  role: string;
  shift: string;
}

export const OFFICIAL_SUPERVISORS: OfficialSupervisor[] = [];

@Component({
  selector: 'app-shift-handover',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ShiftReportPdfComponent],
  template: `
    <div class="shift-page animate-fade-in">
      <!-- Header Actions -->
      <div class="page-top-bar">
        <div>
          <div class="top-status-row">
            <span class="live-status-pill">
              <span class="pulse-dot"></span>
              <span>Sistema Conectado • Base de Datos Sincronizada</span>
            </span>
            <span class="active-shift-badge">
              Turno Activo: <strong>{{ activeShiftBadgeText }}</strong>
            </span>
          </div>
          <h2>Bitácora de Relevo de Guardia</h2>
          <p class="section-sub">Transferencia de turno, seguridad y novedades operacionales con acreditación oficial</p>
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
          <button class="btn btn-primary" (click)="openCreateModal()" *ngIf="permissionsService.canCloseShift()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Registrar Entrega de Guardia
          </button>
          <div *ngIf="!permissionsService.canCloseShift()" class="readonly-pill-notice" title="Modo informativo de bitácora">
            <span>🔒 Modo Consulta (Firma exclusiva de Supervisión)</span>
          </div>
        </div>
      </div>

      <!-- Current Handover Banner -->
      <div class="current-handover-banner glass-panel" *ngIf="latestHandover">
        <div class="banner-badge">
          <span class="badge" [class.badge-success]="latestHandover.status === 'ACCEPTED'" [class.badge-warning]="latestHandover.status === 'SUBMITTED'">
            {{ latestHandover.status === 'ACCEPTED' ? 'GUARDIA ACEPTADA Y CONFORME' : 'PENDIENTE DE CONFORMIDAD' }}
          </span>
          <span class="shift-code-tag">{{ latestHandover.shift_code }}</span>
        </div>

        <div class="banner-grid">
          <div class="banner-cell">
            <span class="cell-label">Supervisor Saliente (Entrega)</span>
            <span class="cell-value">{{ latestHandover.outgoing_supervisor }}</span>
            <span class="cell-sub" *ngIf="latestHandover.outgoing_dni || latestHandover.outgoing_role">
              DNI: {{ latestHandover.outgoing_dni || '---' }} • {{ latestHandover.outgoing_role || 'Supervisor de guardia' }}
            </span>
          </div>
          <div class="banner-cell">
            <span class="cell-label">Supervisor Entrante (Recepción)</span>
            <span class="cell-value">{{ latestHandover.incoming_supervisor || 'En espera de relevo' }}</span>
            <span class="cell-sub" *ngIf="latestHandover.incoming_dni || latestHandover.incoming_role">
              DNI: {{ latestHandover.incoming_dni }} • {{ latestHandover.incoming_role || 'Supervisor de guardia' }}
            </span>
          </div>
          <div class="banner-cell">
            <span class="cell-label">Fecha y Tipo de Turno</span>
            <span class="cell-value">{{ latestHandover.date }} (Turno {{ latestHandover.shift_type }})</span>
            <span class="cell-sub">12 Horas de Operación Continua</span>
          </div>
          <div class="banner-cell">
            <span class="cell-label">Tonelaje Procesado</span>
            <span class="cell-value highlight">{{ latestHandover.tonnage_processed | number }} Ton</span>
            <span class="cell-sub">Tratamiento acumulado</span>
          </div>
        </div>

        <div class="banner-text-block">
          <span class="block-label">Estado General de Planta:</span>
          <p class="block-content">{{ latestHandover.plant_status }}</p>
        </div>

        <!-- Dotación de Guardia Asignada en Turno -->
        <div class="banner-crew-section">
          <span class="block-label">Dotación de Operaciones en Turno ({{ currentSquadStaff.length }} Puestos Titulares):</span>
          <div class="handover-crew-grid">
            <div class="h-crew-card" *ngFor="let m of currentSquadStaff">
              <div class="h-crew-icon">👷</div>
              <div class="h-crew-info">
                <span class="h-crew-role">{{ m.title }}</span>
                <strong class="h-crew-name">{{ m.operatorName }}</strong>
                <span class="h-crew-meta">DNI: {{ m.documentId }} • {{ m.radioChannel }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Novedades de Camionetas en Turno (Solo con observaciones o No Aptas) -->
        <div class="banner-vehicle-warning" *ngIf="observedVehicles.length > 0">
          <div class="bvw-header">
            <div class="bvw-title-row">
              <span class="bvw-icon">⚠️</span>
              <div>
                <strong class="bvw-title">Novedades de Flota Vehicular en Turno ({{ observedVehicles.length }} Unidad{{ observedVehicles.length > 1 ? 'es' : '' }} con Restricción)</strong>
                <p class="bvw-sub">Camionetas observadas o no aptas en checklist pre-uso. Unidades aptas (verde) se omiten.</p>
              </div>
            </div>
            <span class="bvw-pill-count">{{ observedVehicles.length }} OBSERVADA(S)</span>
          </div>
          <div class="bvw-grid">
            <div class="bvw-card" *ngFor="let v of observedVehicles">
              <div class="bvw-card-top">
                <span class="bvw-plate">{{ v.tag }} • {{ v.plate }}</span>
                <span class="badge" [class.badge-danger]="v.operationalStatus === 'NO_APTO'" [class.badge-warning]="v.operationalStatus === 'OBSERVADO'">
                  {{ v.operationalStatus }}
                </span>
              </div>
              <div class="bvw-obs">{{ v.observationNotes }}</div>
              <div class="bvw-meta">👤 {{ v.driverName }} (DNI: {{ v.driverDni }}) • 📍 {{ v.area }} • ⏱️ {{ v.odometer | number }} km</div>
            </div>
          </div>
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
            Validar y Aceptar Relevo Formal
          </button>
        </div>
      </div>

      <!-- Empty State Banner when no handovers exist -->
      <div class="current-handover-banner glass-panel" *ngIf="!latestHandover">
        <div style="padding: 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <span style="font-size: 2.2rem;">📋</span>
          <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary);">Bitácora de Relevo Lista</h3>
          <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); max-width: 500px;">
            No hay entregas de guardia registradas. La bitácora se encuentra limpia y preparada para registrar el primer relevo de operaciones.
          </p>
          <button class="btn btn-primary" (click)="openCreateModal()" *ngIf="permissionsService.canCloseShift()" style="margin-top: 6px;">
            Registrar Entrega de Guardia
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
                <td>
                  <div><strong>{{ h.outgoing_supervisor }}</strong></div>
                  <div class="text-xs text-muted" *ngIf="h.outgoing_dni">DNI: {{ h.outgoing_dni }}</div>
                </td>
                <td>
                  <div><strong>{{ h.incoming_supervisor }}</strong></div>
                  <div class="text-xs text-muted" *ngIf="h.incoming_dni">DNI: {{ h.incoming_dni }}</div>
                </td>
                <td>{{ h.tonnage_processed | number }} Ton</td>
                <td>
                  <span class="badge" [class.badge-success]="h.status === 'ACCEPTED'" [class.badge-warning]="h.status === 'SUBMITTED'">
                    {{ h.status === 'ACCEPTED' ? 'ACEPTADO' : 'PENDIENTE' }}
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
              <tr *ngIf="handovers.length === 0">
                <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">
                  No hay relevos de guardia registrados en la base de datos sincronizada.
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

          <!-- Selección Oficial de Supervisores (Saliente y Entrante) -->
          <div class="form-row">
            <div class="form-group">
              <label>Supervisor Saliente (Entrega)</label>
              <select [ngModel]="newHandover.outgoing_supervisor" (ngModelChange)="onOutgoingSupervisorChange($event)" name="outgoing_supervisor" required>
                <option *ngFor="let s of officialSupervisors" [value]="s.name">
                  {{ s.name }} ({{ s.shift }} - DNI: {{ s.dni }})
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Supervisor Entrante (Recepción)</label>
              <select [ngModel]="newHandover.incoming_supervisor" (ngModelChange)="onIncomingSupervisorChange($event)" name="incoming_supervisor" required>
                <option *ngFor="let s of officialSupervisors" [value]="s.name">
                  {{ s.name }} ({{ s.shift }} - DNI: {{ s.dni }})
                </option>
              </select>
            </div>
          </div>

          <!-- Credenciales automáticas de Relevo Formal -->
          <div class="supervisor-summary-grid">
            <div class="sup-badge-card">
              <div class="sup-badge-title">Acreditación Saliente</div>
              <div class="sup-badge-name">{{ newHandover.outgoing_supervisor }}</div>
              <div class="sup-badge-meta">
                <span>DNI: <strong>{{ newHandover.outgoing_dni }}</strong></span>
                <span>Puesto: <strong>{{ newHandover.outgoing_role }}</strong></span>
              </div>
            </div>
            <div class="sup-badge-card entrante">
              <div class="sup-badge-title">Acreditación Entrante</div>
              <div class="sup-badge-name">{{ newHandover.incoming_supervisor }}</div>
              <div class="sup-badge-meta">
                <span>DNI: <strong>{{ newHandover.incoming_dni }}</strong></span>
                <span>Puesto: <strong>{{ newHandover.incoming_role }}</strong></span>
              </div>
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

          <!-- Alerta de camionetas con observación para la consigna -->
          <div class="modal-vehicle-alert" *ngIf="observedVehicles.length > 0">
            <div class="mva-header">
              <span class="mva-icon">⚠️</span>
              <strong>Flota Vehicular con Novedades ({{ observedVehicles.length }} unidades registradas)</strong>
            </div>
            <div class="mva-list">
              <div class="mva-item" *ngFor="let v of observedVehicles">
                <strong>{{ v.tag }} ({{ v.plate }}):</strong> <span class="badge badge-sm" [class.badge-danger]="v.operationalStatus === 'NO_APTO'" [class.badge-warning]="v.operationalStatus === 'OBSERVADO'">{{ v.operationalStatus }}</span> {{ v.observationNotes }}
              </div>
            </div>
            <small class="mva-sub">Se ha consolidado automáticamente en la consigna de pendientes de la próxima guardia.</small>
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
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      font-weight: 600;
      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--border-focus);
      }
    }

    .action-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-pdf-icon {
      background: #031795;
      color: #ffffff;
      padding: 0.35rem 0.65rem;
      &:hover {
        background: #1e40af;
      }
    }

    .top-status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .live-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 0.73rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
      animation: pulseGreen 2s infinite;
    }

    @keyframes pulseGreen {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .active-shift-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-card-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 0.73rem;
      font-weight: 600;

      strong {
        color: var(--primary-purple);
        font-weight: 700;
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

      .top-actions-cluster {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .readonly-pill-notice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: var(--radius-md);
        background: rgba(3, 23, 149, 0.06);
        border: 1px solid rgba(3, 23, 149, 0.2);
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--primary-purple);
      }
    }

    .current-handover-banner {
      padding: 24px;
      border-radius: var(--radius-xl);
      background: var(--bg-card);
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

      @media (max-width: 520px) {
        grid-template-columns: 1fr;
        padding: 10px 12px;
        gap: 10px;
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

    .banner-crew-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 4px;
    }

    .handover-crew-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 10px;
    }

    .h-crew-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--bg-card-subtle, #f8fafc);
      border: 1px solid var(--border-subtle, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      transition: var(--transition-smooth, all 0.2s ease);

      &:hover {
        border-color: var(--border-focus, #3b82f6);
      }
    }

    .h-crew-icon {
      font-size: 1.25rem;
    }

    .h-crew-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    .h-crew-role {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-secondary, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .h-crew-name {
      font-size: 0.8rem;
      color: var(--text-primary, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .h-crew-meta {
      font-size: 0.68rem;
      color: var(--text-muted, #94a3b8);
    }

    .banner-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 10px;
      gap: 10px;
      flex-wrap: wrap;

      @media (max-width: 640px) {
        flex-direction: column;
        width: 100%;

        .btn {
          width: 100%;
          justify-content: center;
          min-height: 42px;
        }
      }
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

      @media (max-width: 640px) {
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

    .supervisor-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 6px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .sup-badge-card {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-left: 4px solid #3b82f6;
      border-radius: var(--radius-md);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.entrante {
        border-left-color: #10b981;
      }

      .sup-badge-title {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
      }

      .sup-badge-name {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .sup-badge-meta {
        font-size: 0.74rem;
        color: var(--text-secondary);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
    }

    .banner-vehicle-warning {
      background: var(--warning-bg, #fffbeb);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-left: 5px solid var(--warning);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .bvw-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        .bvw-title-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;

          .bvw-icon {
            font-size: 1.25rem;
            line-height: 1;
          }

          .bvw-title {
            font-size: 0.92rem;
            font-weight: 800;
            color: var(--warning, #92400e);
            display: block;
          }

          .bvw-sub {
            font-size: 0.74rem;
            color: var(--text-secondary);
            margin: 2px 0 0;
          }
        }

        .bvw-pill-count {
          background: rgba(245, 158, 11, 0.2);
          color: var(--warning, #78350f);
          font-weight: 800;
          font-size: 0.7rem;
          padding: 3px 10px;
          border-radius: 9999px;
          border: 1px solid rgba(245, 158, 11, 0.4);
          white-space: nowrap;
        }
      }

      .bvw-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 10px;
      }

      .bvw-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-shadow: var(--shadow-card);

        .bvw-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .bvw-plate {
            font-weight: 800;
            font-size: 0.82rem;
            color: var(--text-primary);
          }
        }

        .bvw-obs {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--warning, #b45309);
          line-height: 1.35;
        }

        .bvw-meta {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
      }
    }

    .modal-vehicle-alert {
      background: var(--warning-bg, #fffbeb);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-left: 4px solid var(--warning);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .mva-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        font-weight: 800;
        color: var(--warning, #92400e);
      }

      .mva-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .mva-item {
        font-size: 0.76rem;
        color: #78350f;
        background: rgba(255, 255, 255, 0.7);
        padding: 4px 8px;
        border-radius: 4px;
      }

      .mva-sub {
        font-size: 0.68rem;
        color: #92400e;
        font-style: italic;
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
  crewService = inject(CrewService);
  permissionsService = inject(PermissionsService);
  vehicleChecklistService = inject(VehicleChecklistService);

  officialSupervisors = OFFICIAL_SUPERVISORS;

  observedVehicles: HandoverVehicleObservation[] = [];
  handovers: ShiftHandover[] = [];
  latestHandover: ShiftHandover | null = null;
  isCreateModalOpen = false;
  isPdfModalOpen = false;
  selectedHandoverForPdf: ShiftHandover | null = null;

  get activeShiftBadgeText(): string {
    const shift = getCurrentActiveShift();
    return `${shift.activeGuard.code} (${shift.shiftName === 'DIA' ? 'Turno Día' : 'Turno Noche'})`;
  }

  get currentSquadStaff() {
    const shiftInfo = getCurrentActiveShift();
    const activeShift = (typeof localStorage !== 'undefined' ? localStorage.getItem('basetrack_active_shift') : null) || shiftInfo.activeGuard.code;
    const positions = this.crewService.positions().filter(p => p.key !== 'SUPERVISOR');
    return positions.map(p => {
      const op = this.crewService.getAssignedOperatorForPosition(p.key, activeShift);
      return {
        key: p.key,
        title: p.title,
        operatorName: op?.name || '--- Vacante ---',
        documentId: op?.document_id || '---',
        radioChannel: op?.radio_channel || p.defaultRadio || 'Canal 1 Operaciones',
        location: p.defaultLocation || 'Planta Concentradora'
      };
    });
  }

  newHandover = {
    shift_code: 'G4_DIA_' + new Date().toISOString().slice(5, 10).replace('-', ''),
    shift_type: 'DIA' as 'DIA' | 'NOCHE',
    outgoing_supervisor: '',
    outgoing_dni: '',
    outgoing_role: 'Supervisor de guardia',
    incoming_supervisor: '',
    incoming_dni: '',
    incoming_role: 'Supervisor de guardia',
    plant_status: 'Operación de planta en condiciones normales de proceso. Circuitos de molienda y flotación estables.',
    tonnage_processed: 0,
    safety_incidents: 'Cero accidentes laborales (LTI: 0). Charla de seguridad dictada.',
    pending_tasks: ''
  };

  ngOnInit(): void {
    const shiftInfo = getCurrentActiveShift();
    const user = this.authService.currentUser();
    const isRealSupervisor = user?.role === 'SUPERVISOR' && !user?.fullName?.toLowerCase().includes('marck');
    const supFound = isRealSupervisor ? this.officialSupervisors.find(s => s.name === user?.fullName) : null;
    if (supFound) {
      this.newHandover.outgoing_supervisor = supFound.name;
      this.newHandover.outgoing_dni = supFound.dni;
      this.newHandover.outgoing_role = supFound.role;
    } else {
      const activeSup = this.officialSupervisors.find(s => s.shift === shiftInfo.activeGuard.code);
      if (activeSup) {
        this.newHandover.outgoing_supervisor = activeSup.name;
        this.newHandover.outgoing_dni = activeSup.dni;
        this.newHandover.outgoing_role = activeSup.role;
      }
      const nextSup = this.officialSupervisors.find(s => s.shift === shiftInfo.nextGuard.code);
      if (nextSup) {
        this.newHandover.incoming_supervisor = nextSup.name;
        this.newHandover.incoming_dni = nextSup.dni;
        this.newHandover.incoming_role = nextSup.role;
      }
      this.newHandover.shift_code = `${shiftInfo.activeGuard.code}_${shiftInfo.shiftName}_` + new Date().toISOString().slice(5, 10).replace('-', '');
      this.newHandover.shift_type = shiftInfo.shiftName;
    }

    this.crewService.loadCrew().subscribe(() => {
      const sups = this.crewService.allMembers().filter(m => m.primary_role === 'SUPERVISOR');
      if (sups.length > 0) {
        this.officialSupervisors = sups.map(s => ({
          name: s.name,
          dni: s.document_id,
          role: 'Supervisor de guardia',
          shift: s.shift_code
        }));
      }
    });

    this.loadHandovers();
    this.loadObservedVehicles();
  }

  loadObservedVehicles(): void {
    this.observedVehicles = this.vehicleChecklistService.getObservedOrNonAptoVehicles();
    this.http.get<any>(`${getApiBaseUrl()}/vehicles/checklists`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          this.observedVehicles = this.vehicleChecklistService.getObservedOrNonAptoVehicles(res.data);
        }
      },
      error: () => {}
    });
  }

  onOutgoingSupervisorChange(name: string): void {
    const found = this.officialSupervisors.find(s => s.name === name);
    if (found) {
      this.newHandover.outgoing_supervisor = found.name;
      this.newHandover.outgoing_dni = found.dni;
      this.newHandover.outgoing_role = found.role;
    } else {
      this.newHandover.outgoing_supervisor = name;
    }
  }

  onIncomingSupervisorChange(name: string): void {
    const found = this.officialSupervisors.find(s => s.name === name);
    if (found) {
      this.newHandover.incoming_supervisor = found.name;
      this.newHandover.incoming_dni = found.dni;
      this.newHandover.incoming_role = found.role;
    } else {
      this.newHandover.incoming_supervisor = name;
    }
  }

  private isInvalidLegacy(h: any): boolean {
    if (!h) return true;
    const outName = h.outgoing_supervisor || '';
    const inName = h.incoming_supervisor || '';
    const isMock = 
      outName.includes('Roberto Quispe') ||
      outName.includes('Marck Vizcarra') ||
      inName.includes('Marco Vel') ||
      inName.includes('En espera de relevo') ||
      inName.includes('Marck Vizcarra') ||
      !h.incoming_supervisor ||
      h.incoming_supervisor === '---';
    const isOldDate = h.date && h.date < '2026-09-26';
    return isMock || isOldDate;
  }

  loadHandovers(): void {
    const cached = getRealtimeData<ShiftHandover[]>('shift_handovers', []);
    if (cached && cached.length > 0) {
      const validCached = cached.filter(h => !this.isInvalidLegacy(h));
      this.handovers = validCached;
      this.latestHandover = validCached.length > 0 ? validCached[0] : null;
    }

    this.http.get<any>(`${getApiBaseUrl()}/shift-handover`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          const cleanData = res.data.filter((h: any) => !this.isInvalidLegacy(h));
          this.handovers = cleanData;
          this.latestHandover = cleanData.length > 0 ? cleanData[0] : null;
          saveRealtimeData('shift_handovers', cleanData);
        } else {
          this.handovers = [];
          this.latestHandover = null;
          saveRealtimeData('shift_handovers', []);
        }
      },
      error: () => {
        if (this.handovers.length === 0) {
          this.latestHandover = null;
        }
      }
    });
  }

  openCreateModal(): void {
    const shiftInfo = getCurrentActiveShift();
    const outGuard = shiftInfo.activeGuard;
    const inGuard = shiftInfo.nextGuard;
    const shiftType = shiftInfo.shiftName;

    const outSup = this.crewService.getActiveSupervisorForShift(outGuard.code) ||
                   this.officialSupervisors.find(s => s.shift === outGuard.code);
    if (outSup) {
      this.newHandover.outgoing_supervisor = outSup.name;
      this.newHandover.outgoing_dni = (outSup as any)?.document_id || (outSup as any)?.dni || '';
      this.newHandover.outgoing_role = 'Supervisor de guardia';
    } else {
      this.newHandover.outgoing_supervisor = outGuard.supervisorName;
    }

    const inSup = this.crewService.getActiveSupervisorForShift(inGuard.code) ||
                  this.officialSupervisors.find(s => s.shift === inGuard.code);
    if (inSup) {
      this.newHandover.incoming_supervisor = inSup.name;
      this.newHandover.incoming_dni = (inSup as any)?.document_id || (inSup as any)?.dni || '';
      this.newHandover.incoming_role = 'Supervisor de guardia';
    } else {
      this.newHandover.incoming_supervisor = inGuard.supervisorName;
    }

    const todayStr = shiftInfo.dateStr || getLocalDateString();
    const dateCode = todayStr.slice(5).replace('-', '');
    this.newHandover.shift_code = `${outGuard.code}_${shiftType}_${dateCode}`;
    this.newHandover.shift_type = shiftType;
    this.newHandover.tonnage_processed = 24500;

    // Pre-populate with live plant state
    const latestPumps = getRealtimeData<any[]>('pumps_telemetry', []);
    if (latestPumps && latestPumps.length > 0) {
      const opPumps = latestPumps.filter(p => (p.status || '').toUpperCase() === 'OPERATING').length;
      this.newHandover.plant_status = `Operación continua con ${opPumps}/${latestPumps.length} bombas en servicio. Molienda y flotación dentro de parámetros normales.`;
    }

    // Refresh and populate vehicle observations if any unit is non-apto or observed
    this.loadObservedVehicles();
    if (this.observedVehicles.length > 0) {
      const vehNotes = this.observedVehicles
        .map(v => `${v.tag} (${v.plate}) [${v.operationalStatus}]: ${v.observationNotes}`)
        .join('; ');
      const prefix = `[FLOTA VEHICULAR]: ${vehNotes}`;
      if (!this.newHandover.pending_tasks) {
        this.newHandover.pending_tasks = prefix;
      } else if (!this.newHandover.pending_tasks.includes('[FLOTA VEHICULAR]')) {
        this.newHandover.pending_tasks += `\n${prefix}`;
      }
    }
  }

  saveHandover(): void {
    const shiftInfo = getCurrentActiveShift();
    const payload: ShiftHandover = {
      ...this.newHandover,
      assigned_crew: this.currentSquadStaff,
      operational_highlights: 'Control operacional en parámetros normales de proceso.',
      id: 'sh-' + Date.now(),
      date: shiftInfo.dateStr || getLocalDateString(),
      status: 'SUBMITTED',
      created_at: new Date().toISOString()
    };

    // Optimistic real-time storage
    this.handovers.unshift(payload);
    this.latestHandover = payload;
    saveRealtimeData('shift_handovers', this.handovers);
    this.isCreateModalOpen = false;

    const endpoint = `${getApiBaseUrl()}/shift-handover`;
    if (this.offlineSync.isOnline()) {
      this.http.post<any>(endpoint, payload).subscribe({
        next: () => {
          this.loadHandovers();
        },
        error: () => {
          this.offlineSync.queueAction(endpoint, 'POST', payload, 'Relevo ' + payload.shift_code);
        }
      });
    } else {
      this.offlineSync.queueAction(endpoint, 'POST', payload, 'Relevo ' + payload.shift_code);
    }
  }

  acceptHandover(id: string): void {
    const found = this.handovers.find(h => h.id === id);
    const shiftInfo = getCurrentActiveShift();
    const nextSup = this.crewService.getActiveSupervisorForShift(shiftInfo.nextGuard.code) ||
                    this.officialSupervisors.find(s => s.shift === shiftInfo.nextGuard.code);

    const currentUser = this.authService.currentUser();
    const isCurrentUserOfficialSup = (currentUser?.role === 'SUPERVISOR' && !currentUser.fullName?.toLowerCase().includes('marck'))
      ? this.officialSupervisors.find(s => s.name === currentUser?.fullName || (currentUser?.document_id && s.dni === currentUser?.document_id))
      : null;

    const finalIncomingSup = isCurrentUserOfficialSup 
      ? isCurrentUserOfficialSup 
      : (nextSup || (this.officialSupervisors.length > 0 ? this.officialSupervisors[0] : null));

    const acceptPayload = {
      incoming_supervisor: finalIncomingSup?.name || 'Sin Asignar',
      incoming_dni: (finalIncomingSup as any)?.dni || (finalIncomingSup as any)?.document_id || '',
      incoming_role: 'Supervisor de guardia'
    };

    if (found) {
      found.status = 'ACCEPTED';
      found.incoming_supervisor = acceptPayload.incoming_supervisor;
      found.incoming_dni = acceptPayload.incoming_dni;
      found.incoming_role = acceptPayload.incoming_role;
      saveRealtimeData('shift_handovers', this.handovers);
    }

    const endpoint = `${getApiBaseUrl()}/shift-handover/${id}/accept`;
    this.http.patch<any>(endpoint, acceptPayload).subscribe({
      next: () => {
        this.loadHandovers();
      },
      error: () => {
        this.offlineSync.queueAction(endpoint, 'PATCH' as any, acceptPayload, `Aceptar relevo ${id}`);
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
