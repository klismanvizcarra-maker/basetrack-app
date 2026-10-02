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
import { getCurrentActiveShift, getLocalDateString, GuardCode } from '../../shared/utils/roster.util';
import { PlantParametersService } from '../../core/services/plant-parameters.service';

export interface HandoverChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'CONFORME' | 'OBSERVADO';
  notes?: string;
}

export interface ShiftHandover {
  id: string;
  shift_code: string;
  date: string;
  shift_type: 'DIA' | 'NOCHE';
  outgoing_supervisor: string;
  outgoing_dni?: string;
  outgoing_role?: string;
  outgoing_guard?: string;
  incoming_supervisor: string;
  incoming_dni?: string;
  incoming_role?: string;
  incoming_guard?: string;
  plant_status: string;
  tonnage_processed: number;
  safety_incidents: string;
  operational_highlights: string;
  pending_tasks: string;
  assigned_crew?: any[];
  checklist_data?: HandoverChecklistItem[];
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED';
  created_at: string;
}

export interface OfficialSupervisor {
  name: string;
  dni: string;
  role: string;
  shift: GuardCode;
  guardName: string;
  radio: string;
}

export const OFFICIAL_SUPERVISORS: OfficialSupervisor[] = [
  {
    name: 'GONGORA ROJAS MIGUEL ALONSO',
    dni: '41833717',
    role: 'Supervisor de guardia',
    shift: 'G1',
    guardName: 'Guardia 1 (G1)',
    radio: 'Canal 1 Operaciones / Control'
  },
  {
    name: 'ALIAGA CASTAÑEDA EMILIO URIEL',
    dni: '46593500',
    role: 'Supervisor de guardia',
    shift: 'G2',
    guardName: 'Guardia 2 (G2)',
    radio: 'Canal 1 Operaciones / Control'
  },
  {
    name: 'ARI MAMANI HUGO ANDRES',
    dni: '40132660',
    role: 'Supervisor de guardia',
    shift: 'G3',
    guardName: 'Guardia 3 (G3)',
    radio: 'Canal 1 Operaciones / Control'
  },
  {
    name: 'FERNANDEZ ASCURRA DANTE PACO',
    dni: '18110964',
    role: 'Supervisor de guardia',
    shift: 'G4',
    guardName: 'Guardia 4 (G4)',
    radio: 'Canal 1 Operaciones / Control'
  }
];

const DEFAULT_CHECKLIST: HandoverChecklistItem[] = [
  {
    id: 'CHK-SAFETY',
    category: 'Seguridad & Salud Ocupacional',
    title: 'Seguridad, IPERC Continuo y Charla de 5 Minutos',
    description: 'EPP verificado, charla dictada, cero accidentes con tiempo perdido (LTI: 0).',
    status: 'CONFORME',
    notes: 'Personal con charla de 5 minutos y orden de trabajo seguro.'
  },
  {
    id: 'CHK-PUMPS',
    category: 'Bombas Slurry & Sumideros',
    title: 'Bombas Slurry, Sentinas y Sistema de Agua',
    description: 'Pozas sentina bajo nivel crítico, sin desbordes ni cavitación anormal.',
    status: 'CONFORME',
    notes: 'Presiones en descarga y amperajes dentro de curva operativa.'
  },
  {
    id: 'CHK-CYCLONES',
    category: 'Molienda & Clasificación',
    title: 'Batería de Ciclones e Hidrociclones',
    description: 'Manifolds estables, sin acordonamiento ni boquillas obstruidas. Target de Malla -200 verificado.',
    status: 'CONFORME',
    notes: 'Muestreo metalúrgico horario registrado conforme.'
  },
  {
    id: 'CHK-TAILINGS',
    category: 'Relaves & Medio Ambiente',
    title: 'Presa de Relaves, Dique y Cota de Espejo',
    description: 'Borde libre seguro (> 2.50m), vertederos de alivio y líneas de conducción despejadas.',
    status: 'CONFORME',
    notes: 'Monitoreo de piezómetros y dique en condiciones estables.'
  },
  {
    id: 'CHK-FLEET',
    category: 'Flota & Comunicaciones',
    title: 'Flota Vehicular Minera y Equipos de Radio',
    description: 'Checklist pre-uso de camionetas verificado y radios walkie-talkie operacionales entregados.',
    status: 'CONFORME',
    notes: 'Radios en Canal 1 Operaciones y camionetas con checklist al día.'
  }
];

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
              <span>Sistema Conectado • Datos Oficiales de Planta</span>
            </span>
            <span class="active-shift-badge">
              Turno Activo: <strong>{{ activeShiftBadgeText }}</strong>
            </span>
            <span class="next-shift-badge">
              Próximo Relevo: <strong>{{ nextShiftBadgeText }}</strong>
            </span>
          </div>
          <h2>Bitácora de Relevo de Guardia</h2>
          <p class="section-sub">Transferencia operacional de turno, protocolos de seguridad, supervisores acreditados y dotación de guardia</p>
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

      <!-- Live Plant Telemetry KPI Strip -->
      <div class="plant-telemetry-strip glass-panel">
        <div class="strip-header">
          <div class="strip-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
            <span>Métricas Operacionales del Turno en Vivo</span>
          </div>
          <span class="strip-timestamp">Sincronizado con Roster 8x8 y Telemetría</span>
        </div>

        <div class="strip-grid">
          <div class="kpi-mini-card">
            <span class="kpi-mini-label">Tratamiento de Turno</span>
            <div class="kpi-mini-val-row">
              <strong class="kpi-mini-val">{{ liveTonnage | number }}</strong>
              <span class="kpi-mini-unit">Ton</span>
            </div>
            <span class="kpi-mini-sub text-emerald">● Target 24,500 Ton</span>
          </div>

          <div class="kpi-mini-card">
            <span class="kpi-mini-label">Disponibilidad Bombas</span>
            <div class="kpi-mini-val-row">
              <strong class="kpi-mini-val">{{ livePumpAvail | number:'1.0-1' }}%</strong>
              <span class="kpi-mini-unit">({{ livePumpOperating }}/{{ livePumpTotal }})</span>
            </div>
            <span class="kpi-mini-sub" [class.text-emerald]="livePumpAvail >= 85" [class.text-amber]="livePumpAvail < 85">
              {{ livePumpAvail >= 85 ? '● Disponibilidad Alta' : '▲ Monitorear Reservas' }}
            </span>
          </div>

          <div class="kpi-mini-card">
            <span class="kpi-mini-label">Granulometría Malla -200</span>
            <div class="kpi-mini-val-row">
              <strong class="kpi-mini-val">{{ liveCycloneMesh200 | number:'1.1-2' }}%</strong>
              <span class="kpi-mini-unit">OF</span>
            </div>
            <span class="kpi-mini-sub text-emerald">● Sólidos: {{ liveCycloneSolids | number:'1.1-1' }}%</span>
          </div>

          <div class="kpi-mini-card">
            <span class="kpi-mini-label">Presa de Relaves (Borde Libre)</span>
            <div class="kpi-mini-val-row">
              <strong class="kpi-mini-val" [class.text-emerald]="liveTailingsFreeboard >= 2.5">{{ liveTailingsFreeboard | number:'1.2-2' }}</strong>
              <span class="kpi-mini-unit">m</span>
            </div>
            <span class="kpi-mini-sub" [class.text-emerald]="liveTailingsFreeboard >= 2.5">
              {{ liveTailingsFreeboard >= 2.5 ? '● Cota Segura (>2.5m)' : '▲ Alerta de Margen' }}
            </span>
          </div>

          <div class="kpi-mini-card" [class.kpi-card-warning]="observedVehicles.length > 0">
            <span class="kpi-mini-label">Flota de Camionetas</span>
            <div class="kpi-mini-val-row">
              <strong class="kpi-mini-val" [class.text-amber]="observedVehicles.length > 0">{{ observedVehicles.length }}</strong>
              <span class="kpi-mini-unit">Observada{{ observedVehicles.length !== 1 ? 's' : '' }}</span>
            </div>
            <span class="kpi-mini-sub">
              {{ observedVehicles.length === 0 ? '● 4 Unidades Aptas' : '⚠️ Pendientes de Mantenimiento' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Current Handover Banner -->
      <div class="current-handover-banner glass-panel" *ngIf="latestHandover">
        <div class="banner-top-line">
          <div class="banner-badge">
            <span class="badge" [class.badge-success]="latestHandover.status === 'ACCEPTED'" [class.badge-warning]="latestHandover.status === 'SUBMITTED'">
              {{ latestHandover.status === 'ACCEPTED' ? 'GUARDIA ACEPTADA Y CONFORME' : 'PENDIENTE DE CONFORMIDAD FORMAL' }}
            </span>
            <span class="shift-code-tag">{{ latestHandover.shift_code }}</span>
          </div>

          <!-- Official Stamp / Seal -->
          <div class="official-seal-stamp" [class.seal-accepted]="latestHandover.status === 'ACCEPTED'">
            <div class="seal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" *ngIf="latestHandover.status === 'ACCEPTED'">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" *ngIf="latestHandover.status === 'SUBMITTED'">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="seal-text">
              <span class="seal-title">{{ latestHandover.status === 'ACCEPTED' ? 'CERTIFICADO DE RELEVO OFICIAL' : 'EN ESPERA DE RELEVO' }}</span>
              <span class="seal-date">{{ latestHandover.date }} • Turno {{ latestHandover.shift_type }}</span>
            </div>
          </div>
        </div>

        <div class="banner-grid">
          <!-- Supervisor Saliente -->
          <div class="banner-cell">
            <div class="cell-head-with-badge">
              <span class="cell-label">Supervisor Saliente (Entrega)</span>
              <span class="guard-pill" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(latestHandover.outgoing_supervisor))">
                {{ resolveSupervisorGuard(latestHandover.outgoing_supervisor) }}
              </span>
            </div>
            <span class="cell-value font-bold">{{ latestHandover.outgoing_supervisor }}</span>
            <span class="cell-sub">
              DNI: {{ latestHandover.outgoing_dni || resolveSupervisorDni(latestHandover.outgoing_supervisor) }} • {{ latestHandover.outgoing_role || 'Supervisor de guardia' }}
            </span>
          </div>

          <!-- Supervisor Entrante -->
          <div class="banner-cell">
            <div class="cell-head-with-badge">
              <span class="cell-label">Supervisor Entrante (Recepción)</span>
              <span class="guard-pill" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(latestHandover.incoming_supervisor))">
                {{ resolveSupervisorGuard(latestHandover.incoming_supervisor) }}
              </span>
            </div>
            <span class="cell-value font-bold">{{ latestHandover.incoming_supervisor || 'En espera de relevo' }}</span>
            <span class="cell-sub" *ngIf="latestHandover.incoming_supervisor">
              DNI: {{ latestHandover.incoming_dni || resolveSupervisorDni(latestHandover.incoming_supervisor) }} • {{ latestHandover.incoming_role || 'Supervisor de guardia' }}
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
            <span class="cell-sub">Tratamiento de turno</span>
          </div>
        </div>

        <div class="banner-text-block">
          <span class="block-label">Estado General de Planta y Circuitos:</span>
          <p class="block-content">{{ latestHandover.plant_status }}</p>
        </div>

        <!-- Protocol Checklist Quick Summary -->
        <div class="banner-checklist-summary" *ngIf="latestHandover.checklist_data && latestHandover.checklist_data.length > 0">
          <span class="block-label">Protocolo de Verificación de Relevo ({{ latestHandover.checklist_data.length }} Puntos Operacionales):</span>
          <div class="bcs-grid">
            <div class="bcs-item" *ngFor="let item of latestHandover.checklist_data">
              <span class="bcs-indicator" [class.bcs-conforme]="item.status === 'CONFORME'" [class.bcs-observado]="item.status === 'OBSERVADO'">
                {{ item.status === 'CONFORME' ? '✓' : '⚠️' }}
              </span>
              <div class="bcs-text">
                <strong class="bcs-title">{{ item.title }}</strong>
                <span class="bcs-notes" *ngIf="item.notes">{{ item.notes }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dotación de Guardia Asignada en Turno -->
        <div class="banner-crew-section">
          <div class="crew-section-header">
            <span class="block-label">Dotación de Operaciones en Turno ({{ currentSquadStaff.length }} Puestos Titulares):</span>
            <span class="crew-guard-tag">Guardia Saliente: {{ resolveSupervisorGuard(latestHandover.outgoing_supervisor) }}</span>
          </div>
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
          <button class="btn btn-secondary" (click)="openDetailModal(latestHandover)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Ver Ficha Completa
          </button>

          <button class="btn btn-secondary" (click)="openPdfReport(latestHandover)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Exportar Informe Oficial PDF
          </button>

          <button *ngIf="latestHandover.status === 'SUBMITTED' && permissionsService.canCloseShift()" class="btn btn-success" (click)="promptAcceptHandover(latestHandover.id)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Validar y Aceptar Relevo Formal
          </button>
        </div>
      </div>

      <!-- Empty State Banner when no handovers exist -->
      <div class="current-handover-banner glass-panel" *ngIf="!latestHandover">
        <div class="empty-state-block">
          <span class="empty-icon">📋</span>
          <h3>Bitácora de Relevo Lista</h3>
          <p>
            No hay entregas de guardia registradas. La bitácora se encuentra limpia y preparada para registrar el primer relevo de operaciones con acreditación oficial de supervisión.
          </p>
          <button class="btn btn-primary" (click)="openCreateModal()" *ngIf="permissionsService.canCloseShift()">
            Registrar Entrega de Guardia
          </button>
        </div>
      </div>

      <!-- Handovers Table & Advanced Toolbar -->
      <div class="table-card glass-panel">
        <div class="card-head-with-tools">
          <div class="card-titles">
            <h3>Historial de Entregas de Turno</h3>
            <span class="total-counter">{{ filteredHandovers.length }} de {{ handovers.length }} Registros</span>
          </div>

          <!-- Toolbar: Filters, Search, Export -->
          <div class="toolbar-controls">
            <!-- Search Input -->
            <div class="search-input-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Buscar por código, supervisor, guardia..." />
              <button *ngIf="searchQuery" class="clear-search-btn" (click)="searchQuery = ''">✕</button>
            </div>

            <!-- Guard Filter -->
            <div class="filter-select-box">
              <select [(ngModel)]="selectedGuardFilter">
                <option value="TODAS">Todas las Guardias</option>
                <option value="G1">Guardia 1 (G1)</option>
                <option value="G2">Guardia 2 (G2)</option>
                <option value="G3">Guardia 3 (G3)</option>
                <option value="G4">Guardia 4 (G4)</option>
              </select>
            </div>

            <!-- Shift Type Filter -->
            <div class="filter-select-box">
              <select [(ngModel)]="selectedShiftTypeFilter">
                <option value="TODOS">Todos los Turnos</option>
                <option value="DIA">Turno Día</option>
                <option value="NOCHE">Turno Noche</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div class="filter-select-box">
              <select [(ngModel)]="selectedStatusFilter">
                <option value="TODOS">Todos los Estados</option>
                <option value="ACCEPTED">Conforme / Aceptado</option>
                <option value="SUBMITTED">Pendiente</option>
              </select>
            </div>

            <!-- Export to CSV / Excel Button -->
            <button class="btn btn-secondary btn-export-csv" (click)="exportHistoryToCsv()" title="Exportar historial consolidado a CSV/Excel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Exportar Excel / CSV</span>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código Turno</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Sup. Saliente (Entrega)</th>
                <th>Sup. Entrante (Recepción)</th>
                <th>Tonelaje</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of filteredHandovers" [class.row-selected]="latestHandover?.id === h.id">
                <td class="font-bold">
                  <div class="shift-code-cell">
                    <span>{{ h.shift_code }}</span>
                    <span *ngIf="latestHandover?.id === h.id" class="badge-pill-active">Activo</span>
                  </div>
                </td>
                <td>{{ h.date }}</td>
                <td>
                  <span class="badge" [class.badge-purple]="h.shift_type === 'DIA'" [class.badge-dark-shift]="h.shift_type === 'NOCHE'">
                    {{ h.shift_type === 'DIA' ? '☀️ DÍA' : '🌙 NOCHE' }}
                  </span>
                </td>
                <td>
                  <div class="supervisor-name-cell">
                    <div class="sup-with-guard-tag">
                      <span class="guard-pill-sm" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(h.outgoing_supervisor))">
                        {{ resolveSupervisorGuard(h.outgoing_supervisor) }}
                      </span>
                      <strong>{{ h.outgoing_supervisor }}</strong>
                    </div>
                    <div class="text-xs text-muted">DNI: {{ h.outgoing_dni || resolveSupervisorDni(h.outgoing_supervisor) }}</div>
                  </div>
                </td>
                <td>
                  <div class="supervisor-name-cell">
                    <div class="sup-with-guard-tag">
                      <span class="guard-pill-sm" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(h.incoming_supervisor))">
                        {{ resolveSupervisorGuard(h.incoming_supervisor) }}
                      </span>
                      <strong>{{ h.incoming_supervisor }}</strong>
                    </div>
                    <div class="text-xs text-muted">DNI: {{ h.incoming_dni || resolveSupervisorDni(h.incoming_supervisor) }}</div>
                  </div>
                </td>
                <td>
                  <strong>{{ h.tonnage_processed | number }}</strong> <span class="text-xs text-muted">Ton</span>
                </td>
                <td>
                  <span class="badge" [class.badge-success]="h.status === 'ACCEPTED'" [class.badge-warning]="h.status === 'SUBMITTED'">
                    {{ h.status === 'ACCEPTED' ? 'CONFORME' : 'PENDIENTE' }}
                  </span>
                </td>
                <td class="action-cell">
                  <button class="btn btn-secondary btn-sm" (click)="openDetailModal(h)" title="Ver ficha completa">
                    Ficha
                  </button>
                  <button class="btn btn-primary btn-sm btn-pdf-icon" (click)="openPdfReport(h)" title="Generar PDF Oficial">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    PDF
                  </button>
                </td>
              </tr>
              <tr *ngIf="filteredHandovers.length === 0">
                <td colspan="8" class="empty-table-cell">
                  <div class="empty-table-msg">
                    <span>🔍</span>
                    <p>No se encontraron relevos que coincidan con los filtros seleccionados.</p>
                    <button class="btn btn-secondary btn-sm" (click)="resetFilters()">Restablecer Filtros</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create Handover Modal with Strictly Linked Supervisors & Shift Crew Data -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Registrar Nueva Entrega de Guardia'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="saveHandover()" class="modal-form">
          <!-- Smart Auto-sync Plant Bar -->
          <div class="auto-sync-banner">
            <div class="asb-left">
              <span class="asb-icon">⚡</span>
              <div>
                <strong>Autocarga de Parámetros de Planta</strong>
                <p>Extrae automáticamente estado de bombas, ciclones, relaves y novedades de camionetas.</p>
              </div>
            </div>
            <button type="button" class="btn btn-sync-data" (click)="autoSyncPlantDataToModal()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span>{{ isSyncing ? 'Sincronizando...' : 'Cargar Datos en Vivo' }}</span>
            </button>
          </div>

          <div *ngIf="syncSuccessMsg" class="sync-toast-alert animate-fade-in">
            ✓ {{ syncSuccessMsg }}
          </div>

          <!-- SECCIÓN 1: VINCULACIÓN ESTRICTA DE GUARDIAS Y SUPERVISORES -->
          <div class="guards-link-card">
            <div class="glc-head">
              <span class="glc-badge">VINCULACIÓN OPERATIVA DE GUARDIAS</span>
              <span class="glc-sub">Seleccione las guardias saliente y entrante para auto-completar supervisores, DNIs y dotación</span>
            </div>

            <div class="guards-dual-columns">
              <!-- Columna Saliente (Entrega) -->
              <div class="guard-side-box saliente">
                <div class="gsb-title">
                  <span class="gsb-tag">GUARDIA SALIENTE (ENTREGA)</span>
                </div>

                <div class="form-group">
                  <label>Guardia que Entrega Turno</label>
                  <select [ngModel]="newHandover.outgoing_guard" (ngModelChange)="onOutgoingGuardChange($event)" name="outgoing_guard">
                    <option value="G1">Guardia 1 (G1)</option>
                    <option value="G2">Guardia 2 (G2)</option>
                    <option value="G3">Guardia 3 (G3)</option>
                    <option value="G4">Guardia 4 (G4)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Supervisor Saliente Oficial</label>
                  <select [ngModel]="newHandover.outgoing_supervisor" (ngModelChange)="onOutgoingSupervisorChange($event)" name="outgoing_supervisor" required>
                    <option *ngFor="let s of officialSupervisors" [value]="s.name">
                      [{{ s.shift }}] {{ s.name }} (DNI: {{ s.dni }})
                    </option>
                  </select>
                </div>

                <div class="sup-credential-pill">
                  <span>DNI: <strong>{{ newHandover.outgoing_dni }}</strong></span>
                  <span>Canal: <strong>Canal 1 Operaciones</strong></span>
                </div>
              </div>

              <!-- Columna Entrante (Recepción) -->
              <div class="guard-side-box entrante">
                <div class="gsb-title">
                  <span class="gsb-tag entrante-tag">GUARDIA ENTRANTE (RECEPCIÓN)</span>
                </div>

                <div class="form-group">
                  <label>Guardia que Recibe Turno</label>
                  <select [ngModel]="newHandover.incoming_guard" (ngModelChange)="onIncomingGuardChange($event)" name="incoming_guard">
                    <option value="G1">Guardia 1 (G1)</option>
                    <option value="G2">Guardia 2 (G2)</option>
                    <option value="G3">Guardia 3 (G3)</option>
                    <option value="G4">Guardia 4 (G4)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Supervisor Entrante Oficial</label>
                  <select [ngModel]="newHandover.incoming_supervisor" (ngModelChange)="onIncomingSupervisorChange($event)" name="incoming_supervisor" required>
                    <option *ngFor="let s of officialSupervisors" [value]="s.name">
                      [{{ s.shift }}] {{ s.name }} (DNI: {{ s.dni }})
                    </option>
                  </select>
                </div>

                <div class="sup-credential-pill entrante">
                  <span>DNI: <strong>{{ newHandover.incoming_dni }}</strong></span>
                  <span>Canal: <strong>Canal 1 Operaciones</strong></span>
                </div>
              </div>
            </div>
          </div>

          <!-- SECCIÓN 2: PARÁMETROS DE TURNO -->
          <div class="form-row">
            <div class="form-group">
              <label>Código de Turno (Auto-generado)</label>
              <input type="text" [(ngModel)]="newHandover.shift_code" name="shift_code" required />
            </div>
            <div class="form-group">
              <label>Tipo de Turno</label>
              <select [(ngModel)]="newHandover.shift_type" name="shift_type" (ngModelChange)="onShiftTypeChange($event)">
                <option value="DIA">Turno Día (07:00 - 19:00)</option>
                <option value="NOCHE">Turno Noche (19:00 - 07:00)</option>
              </select>
            </div>
          </div>

          <!-- SECCIÓN 3: DOTACIÓN DE CUADRILLA SALIENTE (8 PUESTOS) -->
          <div class="modal-crew-preview-card">
            <div class="mcp-header">
              <div class="mcp-title">
                <span>👷</span>
                <strong>Dotación Titular de Guardia {{ newHandover.outgoing_guard }} en Turno ({{ modalSquadStaff.length }} Puestos)</strong>
              </div>
              <span class="mcp-count">Nómina Oficial Minera</span>
            </div>
            <div class="mcp-grid">
              <div class="mcp-item" *ngFor="let op of modalSquadStaff">
                <span class="mcp-role">{{ op.title }}</span>
                <strong class="mcp-name">{{ op.operatorName }}</strong>
                <span class="mcp-meta">DNI: {{ op.documentId }} • {{ op.radioChannel }}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <div class="label-with-hint">
              <label>Tonelaje Tratado en el Turno (Ton)</label>
              <span class="hint-text">Calibrado a target de 24,500 Ton</span>
            </div>
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

          <!-- Protocolo de Verificación de Relevo (5 Puntos Clave) -->
          <div class="checklist-interactive-box">
            <div class="cib-header">
              <div class="cib-title">
                <span class="cib-icon">📋</span>
                <strong>Protocolo de Verificación Operacional (Checklist 5 Puntos)</strong>
              </div>
              <span class="cib-sub">Marque Conforme u Observado en cada punto crítico de planta</span>
            </div>

            <div class="cib-items-list">
              <div class="cib-item-row" *ngFor="let item of modalChecklist; let i = index">
                <div class="cib-item-info">
                  <div class="cib-item-badge">{{ item.category }}</div>
                  <strong class="cib-item-title">{{ item.title }}</strong>
                  <p class="cib-item-desc">{{ item.description }}</p>
                  <input type="text" class="cib-item-note-input" [(ngModel)]="item.notes" [name]="'chk_note_' + i" placeholder="Detalle u observación específica..." />
                </div>
                <div class="cib-item-toggle">
                  <button type="button" class="btn-chk-state" [class.active-conforme]="item.status === 'CONFORME'" (click)="setChecklistStatus(item, 'CONFORME')">
                    ✓ Conforme
                  </button>
                  <button type="button" class="btn-chk-state" [class.active-observado]="item.status === 'OBSERVADO'" (click)="setChecklistStatus(item, 'OBSERVADO')">
                    ⚠️ Observado
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Alerta de camionetas con observación para la consigna -->
          <div class="modal-vehicle-alert" *ngIf="observedVehicles.length > 0">
            <div class="mva-header">
              <span class="mva-icon">⚠️</span>
              <strong>Flota Vehicular con Novedades ({{ observedVehicles.length }} unidades registradas)</strong>
            </div>
            <div class="mva-list">
              <div class="mva-item" *ngFor="let v of observedVehicles">
                <strong>{{ v.tag }} ({{ v.plate }}):</strong>
                <span class="badge badge-sm" [class.badge-danger]="v.operationalStatus === 'NO_APTO'" [class.badge-warning]="v.operationalStatus === 'OBSERVADO'">
                  {{ v.operationalStatus }}
                </span>
                {{ v.observationNotes }}
              </div>
            </div>
            <small class="mva-sub">Se consolida automáticamente en la consigna de pendientes del relevo.</small>
          </div>

          <div class="form-group">
            <label>Pendientes y Consignas para la Próxima Guardia</label>
            <textarea rows="3" [(ngModel)]="newHandover.pending_tasks" name="pending" placeholder="Inspecciones programadas, cambio de válvulas, observaciones..."></textarea>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar y Guardar Relevo</button>
          </div>
        </form>
      </app-modal>

      <!-- Full Detail Modal (Ficha Operacional de Relevo) -->
      <app-modal [isOpen]="isDetailModalOpen" [title]="'Ficha Operacional de Relevo de Guardia'" (close)="isDetailModalOpen = false">
        <div class="detail-sheet-wrapper" *ngIf="selectedHandoverForDetail">
          <!-- Header Banner of Detail Modal -->
          <div class="dsw-top-bar">
            <div>
              <div class="dsw-badge-row">
                <span class="badge" [class.badge-success]="selectedHandoverForDetail.status === 'ACCEPTED'" [class.badge-warning]="selectedHandoverForDetail.status === 'SUBMITTED'">
                  {{ selectedHandoverForDetail.status === 'ACCEPTED' ? 'GUARDIA ACEPTADA Y CONFORME' : 'PENDIENTE DE CONFORMIDAD FORMAL' }}
                </span>
                <span class="shift-code-tag">{{ selectedHandoverForDetail.shift_code }}</span>
              </div>
              <h4>{{ selectedHandoverForDetail.date }} • Turno {{ selectedHandoverForDetail.shift_type }} (12 Horas)</h4>
            </div>

            <!-- Certification Stamp in Modal -->
            <div class="modal-stamp-box" [class.stamp-accepted]="selectedHandoverForDetail.status === 'ACCEPTED'">
              <strong>{{ selectedHandoverForDetail.status === 'ACCEPTED' ? 'CERTIFICADO CONFORME' : 'PENDIENTE DE FIRMA' }}</strong>
              <small>{{ selectedHandoverForDetail.status === 'ACCEPTED' ? 'Validado con acreditación oficial' : 'Firma de supervisor requerida' }}</small>
            </div>
          </div>

          <!-- Dual Supervisors Card -->
          <div class="dsw-supervisors-grid">
            <div class="dsw-sup-card saliente">
              <div class="sup-card-head">
                <span class="sup-card-tag">Supervisor Saliente (Entrega)</span>
                <span class="guard-pill-sm" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(selectedHandoverForDetail.outgoing_supervisor))">
                  {{ resolveSupervisorGuard(selectedHandoverForDetail.outgoing_supervisor) }}
                </span>
              </div>
              <strong class="sup-card-name">{{ selectedHandoverForDetail.outgoing_supervisor }}</strong>
              <div class="sup-card-meta">
                <span>DNI: <strong>{{ selectedHandoverForDetail.outgoing_dni || resolveSupervisorDni(selectedHandoverForDetail.outgoing_supervisor) }}</strong></span>
                <span>Cargo: {{ selectedHandoverForDetail.outgoing_role || 'Supervisor de guardia' }}</span>
              </div>
            </div>

            <div class="dsw-sup-card entrante">
              <div class="sup-card-head">
                <span class="sup-card-tag entrante-tag">Supervisor Entrante (Recepción)</span>
                <span class="guard-pill-sm" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(selectedHandoverForDetail.incoming_supervisor))">
                  {{ resolveSupervisorGuard(selectedHandoverForDetail.incoming_supervisor) }}
                </span>
              </div>
              <strong class="sup-card-name">{{ selectedHandoverForDetail.incoming_supervisor || 'En espera de relevo' }}</strong>
              <div class="sup-card-meta">
                <span>DNI: <strong>{{ selectedHandoverForDetail.incoming_dni || resolveSupervisorDni(selectedHandoverForDetail.incoming_supervisor) }}</strong></span>
                <span>Cargo: {{ selectedHandoverForDetail.incoming_role || 'Supervisor de guardia' }}</span>
              </div>
            </div>
          </div>

          <!-- Treatment and Plant Status Block -->
          <div class="dsw-section">
            <span class="dsw-section-title">Tratamiento y Estado de Proceso</span>
            <div class="dsw-kpi-row">
              <div class="dsw-kpi-box">
                <span class="dsw-kpi-label">Tonelaje Tratado:</span>
                <strong class="dsw-kpi-val">{{ selectedHandoverForDetail.tonnage_processed | number }} Ton</strong>
              </div>
            </div>
            <p class="dsw-text-paragraph">{{ selectedHandoverForDetail.plant_status }}</p>
          </div>

          <!-- Protocol Checklist Verification -->
          <div class="dsw-section" *ngIf="selectedHandoverForDetail.checklist_data && selectedHandoverForDetail.checklist_data.length > 0">
            <span class="dsw-section-title">Protocolo de Verificación Operacional (Checklist 5 Puntos)</span>
            <div class="dsw-checklist-grid">
              <div class="dsw-chk-card" *ngFor="let item of selectedHandoverForDetail.checklist_data">
                <div class="dsw-chk-top">
                  <span class="badge badge-sm" [class.badge-success]="item.status === 'CONFORME'" [class.badge-warning]="item.status === 'OBSERVADO'">
                    {{ item.status }}
                  </span>
                  <strong class="dsw-chk-title">{{ item.title }}</strong>
                </div>
                <p class="dsw-chk-desc">{{ item.description }}</p>
                <div class="dsw-chk-notes" *ngIf="item.notes">
                  <em>Nota: {{ item.notes }}</em>
                </div>
              </div>
            </div>
          </div>

          <!-- Assigned Crew in Shift -->
          <div class="dsw-section" *ngIf="selectedHandoverForDetail.assigned_crew && selectedHandoverForDetail.assigned_crew.length > 0">
            <span class="dsw-section-title">Dotación de Operaciones Asignada en Turno ({{ selectedHandoverForDetail.assigned_crew.length }} Puestos)</span>
            <div class="dsw-crew-grid">
              <div class="dsw-crew-item" *ngFor="let c of selectedHandoverForDetail.assigned_crew">
                <span class="dsw-crew-role">{{ c.title }}</span>
                <strong class="dsw-crew-name">{{ c.operatorName }}</strong>
                <span class="dsw-crew-meta">DNI: {{ c.documentId }} • {{ c.radioChannel }}</span>
              </div>
            </div>
          </div>

          <!-- Safety & Incidents -->
          <div class="dsw-section">
            <span class="dsw-section-title">Seguridad y Charlas Operacionales</span>
            <p class="dsw-text-paragraph">{{ selectedHandoverForDetail.safety_incidents || 'Sin incidentes reportados en el turno.' }}</p>
          </div>

          <!-- Pending Tasks -->
          <div class="dsw-section" *ngIf="selectedHandoverForDetail.pending_tasks">
            <span class="dsw-section-title highlight-orange">⚠️ Pendientes y Consignas para la Próxima Guardia</span>
            <div class="dsw-pending-box">
              <pre class="dsw-pending-pre">{{ selectedHandoverForDetail.pending_tasks }}</pre>
            </div>
          </div>

          <!-- Detail Modal Footer Actions -->
          <div footer class="dsw-footer-buttons">
            <button class="btn btn-secondary" (click)="isDetailModalOpen = false">Cerrar</button>
            <button class="btn btn-primary" (click)="openPdfReport(selectedHandoverForDetail)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Descargar Reporte PDF
            </button>
            <button
              *ngIf="selectedHandoverForDetail.status === 'SUBMITTED' && permissionsService.canCloseShift()"
              class="btn btn-success"
              (click)="promptAcceptHandover(selectedHandoverForDetail.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Aceptar y Validar Relevo
            </button>
          </div>
        </div>
      </app-modal>

      <!-- Formal Acceptance Confirmation Modal -->
      <app-modal [isOpen]="isAcceptModalOpen" [title]="'Confirmar Aceptación Formal de Relevo'" (close)="isAcceptModalOpen = false">
        <div class="accept-confirm-dialog" *ngIf="handoverToAccept">
          <div class="acd-icon-wrap">
            <span>🛡️</span>
          </div>
          <h4>Firma Digital de Recepción de Guardia</h4>
          <p class="acd-sub">
            Está a punto de formalizar la recepción del turno <strong>{{ handoverToAccept.shift_code }}</strong> (Turno {{ handoverToAccept.shift_type }}).
          </p>

          <div class="acd-card">
            <div class="acd-row">
              <span class="acd-label">Supervisor Saliente:</span>
              <strong class="acd-val">{{ handoverToAccept.outgoing_supervisor }} (DNI: {{ handoverToAccept.outgoing_dni || resolveSupervisorDni(handoverToAccept.outgoing_supervisor) }})</strong>
            </div>
            <div class="acd-row">
              <span class="acd-label">Supervisor Entrante (Usted):</span>
              <strong class="acd-val text-emerald">{{ acceptingSupervisorName }} (DNI: {{ acceptingSupervisorDni }})</strong>
            </div>
            <div class="acd-row">
              <span class="acd-label">Guardia Receptora:</span>
              <span class="guard-pill-sm" [ngClass]="getGuardBadgeClass(resolveSupervisorGuard(acceptingSupervisorName))">
                {{ resolveSupervisorGuard(acceptingSupervisorName) }}
              </span>
            </div>
            <div class="acd-row">
              <span class="acd-label">Fecha y Turno:</span>
              <span class="acd-val">{{ handoverToAccept.date }} • Turno {{ handoverToAccept.shift_type }}</span>
            </div>
          </div>

          <div class="acd-declaration">
            <label class="declaration-checkbox-label">
              <input type="checkbox" [(ngModel)]="acceptanceConfirmed" />
              <span>Declaro haber verificado las condiciones de planta, el checklist de seguridad y las consignas operacionales antes de asumir la guardia.</span>
            </label>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isAcceptModalOpen = false">Cancelar</button>
            <button type="button" class="btn btn-success" [disabled]="!acceptanceConfirmed" (click)="confirmAcceptHandover()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Firmar y Aceptar Relevo Oficial
            </button>
          </div>
        </div>
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

    .active-shift-badge, .next-shift-badge {
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

    .next-shift-badge strong {
      color: var(--text-primary);
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

    /* Live Plant Telemetry Strip */
    .plant-telemetry-strip {
      padding: 16px 20px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .strip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .strip-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--primary-purple);
      }

      .strip-timestamp {
        font-size: 0.72rem;
        color: var(--text-muted);
      }
    }

    .strip-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(3, 1fr);
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr 1fr;
      }

      @media (max-width: 440px) {
        grid-template-columns: 1fr;
      }
    }

    .kpi-mini-card {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: var(--transition-smooth);

      &:hover {
        border-color: var(--border-focus);
        transform: translateY(-1px);
      }

      &.kpi-card-warning {
        background: #fffbeb;
        border-color: rgba(245, 158, 11, 0.4);
      }
    }

    .kpi-mini-label {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .kpi-mini-val-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .kpi-mini-val {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text-primary);
    }

    .kpi-mini-unit {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .kpi-mini-sub {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-secondary);

      &.text-emerald {
        color: #059669;
      }

      &.text-amber {
        color: #d97706;
      }
    }

    /* Guard Pill Badges */
    .guard-pill {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;

      &.badge-g1 {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #93c5fd;
      }

      &.badge-g2 {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #6ee7b7;
      }

      &.badge-g3 {
        background: #fffbeb;
        color: #b45309;
        border: 1px solid #fcd34d;
      }

      &.badge-g4 {
        background: #f5f3ff;
        color: #7c3aed;
        border: 1px solid #c4b5fd;
      }
    }

    .guard-pill-sm {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;
      white-space: nowrap;

      &.badge-g1 {
        background: #eff6ff;
        color: #1d4ed8;
      }

      &.badge-g2 {
        background: #ecfdf5;
        color: #059669;
      }

      &.badge-g3 {
        background: #fffbeb;
        color: #b45309;
      }

      &.badge-g4 {
        background: #f5f3ff;
        color: #7c3aed;
      }
    }

    /* Banner */
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

    .banner-top-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
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

    .official-seal-stamp {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      border-radius: var(--radius-md);
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: var(--text-secondary);

      &.seal-accepted {
        background: #ecfdf5;
        border-color: #6ee7b7;
        color: #065f46;

        .seal-title {
          color: #047857;
        }
      }

      .seal-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .seal-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .seal-title {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .seal-date {
        font-size: 0.68rem;
        color: var(--text-muted);
      }
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

    .cell-head-with-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
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
    }

    /* Checklist Quick Summary */
    .banner-checklist-summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
    }

    .bcs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 8px;
    }

    .bcs-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.78rem;
    }

    .bcs-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 0.68rem;
      font-weight: 800;
      flex-shrink: 0;

      &.bcs-conforme {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
      }

      &.bcs-observado {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
      }
    }

    .bcs-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .bcs-title {
      color: var(--text-primary);
    }

    .bcs-notes {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    /* Crew Section */
    .banner-crew-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 4px;
    }

    .crew-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .crew-guard-tag {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--primary-purple);
      background: rgba(3, 23, 149, 0.08);
      padding: 2px 8px;
      border-radius: 4px;
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

    .empty-state-block {
      padding: 32px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      .empty-icon {
        font-size: 2.4rem;
      }

      h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--text-primary);
      }

      p {
        margin: 0;
        font-size: 0.88rem;
        color: var(--text-secondary);
        max-width: 500px;
      }
    }

    /* Table & Advanced Toolbar */
    .table-card {
      padding: 24px;
    }

    .card-head-with-tools {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 20px;
    }

    .card-titles {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        font-size: 1.15rem;
        font-weight: 700;
      }

      .total-counter {
        font-size: 0.8rem;
        color: var(--text-muted);
      }
    }

    .toolbar-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }
    }

    .search-input-box {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 220px;

      svg {
        position: absolute;
        left: 12px;
        color: var(--text-muted);
        pointer-events: none;
      }

      input {
        width: 100%;
        padding: 8px 32px 8px 36px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        background: var(--bg-input);
        color: var(--text-primary);
        font-size: 0.84rem;

        &:focus {
          border-color: var(--border-focus);
          outline: none;
        }
      }

      .clear-search-btn {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 0.8rem;
      }
    }

    .filter-select-box select {
      padding: 8px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: var(--bg-input);
      color: var(--text-primary);
      font-size: 0.82rem;
      cursor: pointer;

      &:focus {
        border-color: var(--border-focus);
        outline: none;
      }
    }

    .btn-export-csv {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      font-size: 0.82rem;
      font-weight: 600;
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
        border-bottom: 1px solid var(--border-subtle);
        color: var(--text-secondary);
      }

      tr:hover td {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }

      tr.row-selected td {
        background: rgba(3, 23, 149, 0.03);
      }
    }

    .shift-code-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sup-with-guard-tag {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .badge-pill-active {
      font-size: 0.65rem;
      font-weight: 800;
      color: #059669;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 1px 6px;
      border-radius: 9999px;
    }

    .badge-dark-shift {
      background: #0f172a;
      color: #f8fafc;
    }

    .empty-table-cell {
      text-align: center;
      padding: 36px 16px;
    }

    .empty-table-msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);

      span {
        font-size: 1.8rem;
      }
    }

    /* Modal Form & Auto-sync */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .auto-sync-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: var(--primary-bg-subtle, #eef2ff);
      border: 1px solid var(--primary-border, rgba(3, 23, 149, 0.3));
      border-radius: var(--radius-md);

      .asb-left {
        display: flex;
        align-items: center;
        gap: 10px;

        .asb-icon {
          font-size: 1.3rem;
        }

        strong {
          display: block;
          font-size: 0.85rem;
          color: var(--primary-purple);
        }

        p {
          margin: 0;
          font-size: 0.74rem;
          color: var(--text-secondary);
        }
      }

      .btn-sync-data {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #031795;
        color: #ffffff;
        border: none;
        padding: 6px 14px;
        border-radius: var(--radius-sm);
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: var(--transition-smooth);

        &:hover {
          background: #1e40af;
        }
      }
    }

    .sync-toast-alert {
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      color: #065f46;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      font-size: 0.76rem;
      font-weight: 700;
    }

    /* Guards Link Card in Modal */
    .guards-link-card {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
      background: var(--bg-card-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .glc-head {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .glc-badge {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: var(--primary-purple);
      text-transform: uppercase;
    }

    .glc-sub {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .guards-dual-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .guard-side-box {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-left: 4px solid #1d4ed8;
      border-radius: var(--radius-md);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      &.entrante {
        border-left-color: #059669;
      }
    }

    .gsb-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .gsb-tag {
      font-size: 0.68rem;
      font-weight: 800;
      color: #1d4ed8;
      letter-spacing: 0.03em;

      &.entrante-tag {
        color: #059669;
      }
    }

    .sup-credential-pill {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      font-size: 0.72rem;
      background: var(--bg-card-subtle);
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);

      strong {
        color: var(--text-primary);
      }
    }

    /* Modal Crew Preview */
    .modal-crew-preview-card {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .mcp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .mcp-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.82rem;
        color: var(--text-primary);
      }

      .mcp-count {
        font-size: 0.68rem;
        color: var(--text-muted);
        font-weight: 600;
      }
    }

    .mcp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }

    .mcp-item {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .mcp-role {
      font-size: 0.64rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .mcp-name {
      font-size: 0.76rem;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mcp-meta {
      font-size: 0.66rem;
      color: var(--text-muted);
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

    .label-with-hint {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .hint-text {
        font-size: 0.7rem;
        color: var(--text-muted);
      }
    }

    /* Checklist Interactive in Modal */
    .checklist-interactive-box {
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
      background: var(--bg-card-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cib-header {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .cib-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.88rem;
        color: var(--text-primary);
      }

      .cib-sub {
        font-size: 0.72rem;
        color: var(--text-muted);
      }
    }

    .cib-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .cib-item-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);

      @media (max-width: 600px) {
        flex-direction: column;
      }
    }

    .cib-item-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cib-item-badge {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--primary-purple);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .cib-item-title {
      font-size: 0.82rem;
      color: var(--text-primary);
    }

    .cib-item-desc {
      font-size: 0.74rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .cib-item-note-input {
      margin-top: 4px;
      padding: 4px 8px;
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      font-size: 0.75rem;
      background: var(--bg-card-subtle);
      color: var(--text-primary);

      &:focus {
        border-color: var(--border-focus);
        outline: none;
      }
    }

    .cib-item-toggle {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .btn-chk-state {
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid var(--border-subtle);
      background: var(--bg-card-subtle);
      color: var(--text-muted);
      cursor: pointer;
      transition: var(--transition-smooth);

      &.active-conforme {
        background: #ecfdf5;
        border-color: #6ee7b7;
        color: #065f46;
      }

      &.active-observado {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
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

    .modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      width: 100%;
    }

    /* Full Detail Sheet Styling */
    .detail-sheet-wrapper {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .dsw-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 14px;

      h4 {
        margin: 6px 0 0;
        font-size: 1.05rem;
        color: var(--text-primary);
      }
    }

    .dsw-badge-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-stamp-box {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 6px 12px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: var(--radius-md);

      strong {
        font-size: 0.78rem;
        color: var(--text-secondary);
      }

      small {
        font-size: 0.68rem;
        color: var(--text-muted);
      }

      &.stamp-accepted {
        background: #ecfdf5;
        border-color: #6ee7b7;

        strong {
          color: #065f46;
        }
      }
    }

    .dsw-supervisors-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .dsw-sup-card {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.saliente {
        border-left: 4px solid #1d4ed8;
      }

      &.entrante {
        border-left: 4px solid #059669;
      }
    }

    .sup-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .sup-card-tag {
      font-size: 0.68rem;
      font-weight: 700;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.04em;

      &.entrante-tag {
        color: #059669;
      }
    }

    .sup-card-name {
      font-size: 0.92rem;
      color: var(--text-primary);
    }

    .sup-card-meta {
      font-size: 0.75rem;
      color: var(--text-secondary);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .dsw-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dsw-section-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;

      &.highlight-orange {
        color: var(--warning, #d97706);
      }
    }

    .dsw-kpi-row {
      display: flex;
      gap: 16px;
    }

    .dsw-kpi-box {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .dsw-kpi-label {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .dsw-kpi-val {
      font-size: 1.1rem;
      color: var(--primary-lavender);
    }

    .dsw-text-paragraph {
      font-size: 0.85rem;
      color: var(--text-primary);
      line-height: 1.5;
      margin: 0;
      background: var(--bg-card-subtle);
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
    }

    .dsw-checklist-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .dsw-chk-card {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .dsw-chk-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dsw-chk-title {
      font-size: 0.82rem;
      color: var(--text-primary);
    }

    .dsw-chk-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0;
    }

    .dsw-chk-notes {
      font-size: 0.74rem;
      color: var(--warning, #d97706);
      font-weight: 600;
    }

    .dsw-crew-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 8px;
    }

    .dsw-crew-item {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .dsw-crew-role {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .dsw-crew-name {
      font-size: 0.8rem;
      color: var(--text-primary);
    }

    .dsw-crew-meta {
      font-size: 0.7rem;
      color: var(--text-secondary);
    }

    .dsw-pending-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: var(--radius-sm);
      padding: 10px 14px;
    }

    .dsw-pending-pre {
      font-family: inherit;
      font-size: 0.82rem;
      color: #92400e;
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.45;
    }

    .dsw-footer-buttons {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
    }

    /* Acceptance Dialog */
    .accept-confirm-dialog {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 14px;
      padding: 10px 0;

      .acd-icon-wrap {
        font-size: 2.5rem;
      }

      h4 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--text-primary);
      }

      .acd-sub {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
    }

    .acd-card {
      width: 100%;
      text-align: left;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .acd-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.8rem;

      .acd-label {
        color: var(--text-muted);
      }

      .acd-val {
        color: var(--text-primary);
        text-align: right;
      }
    }

    .acd-declaration {
      width: 100%;
      text-align: left;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: var(--radius-sm);
      padding: 10px 14px;

      .declaration-checkbox-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 0.78rem;
        color: #065f46;
        cursor: pointer;

        input {
          margin-top: 2px;
          cursor: pointer;
        }
      }
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
  plantParamsService = inject(PlantParametersService);

  officialSupervisors: OfficialSupervisor[] = [...OFFICIAL_SUPERVISORS];

  observedVehicles: HandoverVehicleObservation[] = [];
  handovers: ShiftHandover[] = [];
  latestHandover: ShiftHandover | null = null;
  
  // Modals state
  isCreateModalOpen = false;
  isPdfModalOpen = false;
  isDetailModalOpen = false;
  isAcceptModalOpen = false;
  
  selectedHandoverForPdf: ShiftHandover | null = null;
  selectedHandoverForDetail: ShiftHandover | null = null;
  handoverToAccept: ShiftHandover | null = null;
  acceptanceConfirmed = false;

  // Filter toolbar state
  searchQuery = '';
  selectedGuardFilter = 'TODAS';
  selectedShiftTypeFilter = 'TODOS';
  selectedStatusFilter = 'TODOS';

  // Live Plant Telemetry Metrics
  liveTonnage = this.plantParamsService.tonnageTarget();
  livePumpOperating = 0;
  livePumpTotal = 0;
  livePumpAvail = 100;
  liveCycloneSolids = 0;
  liveCycloneMesh200 = 0;
  liveTailingsFreeboard = 2.65;
  
  // Auto-sync feedback
  isSyncing = false;
  syncSuccessMsg = '';

  // Checklist for modal
  modalChecklist: HandoverChecklistItem[] = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));

  newHandover = {
    outgoing_guard: 'G4' as GuardCode,
    incoming_guard: 'G2' as GuardCode,
    shift_code: 'G4_DIA_' + new Date().toISOString().slice(5, 10).replace('-', ''),
    shift_type: 'DIA' as 'DIA' | 'NOCHE',
    outgoing_supervisor: 'FERNANDEZ ASCURRA DANTE PACO',
    outgoing_dni: '18110964',
    outgoing_role: 'Supervisor de guardia',
    incoming_supervisor: 'ALIAGA CASTAÑEDA EMILIO URIEL',
    incoming_dni: '46593500',
    incoming_role: 'Supervisor de guardia',
    plant_status: 'Operación de planta en condiciones normales de proceso. Circuitos de molienda y flotación estables.',
    tonnage_processed: this.plantParamsService.tonnageTarget(),
    safety_incidents: 'Cero accidentes laborales (LTI: 0). Charla de seguridad de 5 minutos dictada.',
    pending_tasks: ''
  };

  get activeShiftBadgeText(): string {
    const shift = getCurrentActiveShift();
    return `${shift.activeGuard.code} (${shift.shiftName === 'DIA' ? 'Turno Día' : 'Turno Noche'})`;
  }

  get nextShiftBadgeText(): string {
    const shift = getCurrentActiveShift();
    return `${shift.nextGuard.code} (${shift.shiftName === 'DIA' ? 'Turno Noche' : 'Turno Día'})`;
  }

  get acceptingSupervisorName(): string {
    const user = this.authService.currentUser();
    return user?.fullName || 'Supervisor de Guardia';
  }

  get acceptingSupervisorDni(): string {
    const user = this.authService.currentUser();
    return (user as any)?.document_id || this.resolveSupervisorDni(user?.fullName || '') || '---';
  }

  /**
   * Dotación de personal titular de la guardia activa (para el banner principal)
   */
  get currentSquadStaff() {
    const shiftInfo = getCurrentActiveShift();
    const guard = (this.latestHandover ? this.resolveSupervisorGuard(this.latestHandover.outgoing_supervisor) : null) || shiftInfo.activeGuard.code;
    return this.getSquadStaffForGuard(guard);
  }

  /**
   * Dotación de personal titular de la guardia saliente seleccionada en el modal de creación
   */
  get modalSquadStaff() {
    return this.getSquadStaffForGuard(this.newHandover.outgoing_guard);
  }

  /**
   * Resuelve los 8 puestos operativos titulares para una guardia específica (G1, G2, G3, G4)
   */
  getSquadStaffForGuard(guardCode: string) {
    const staff = this.crewService.getOfficialShiftStaff(guardCode);
    const positions = this.crewService.positions().filter(p => p.key !== 'SUPERVISOR');
    
    return positions.map(p => {
      let member: any = null;
      if (p.key === 'SALA_CONTROL') member = staff.controlRoom;
      else if (p.key === 'BOMBAS') member = staff.bombas;
      else if (p.key === 'CICLONES_1') member = staff.ciclones1;
      else if (p.key === 'CICLONES_2') member = staff.ciclones2;
      else if (p.key === 'DISTRIBUIDOR') member = staff.distribuidor;
      else if (p.key === 'DESCARGA_1') member = staff.descarga1;
      else if (p.key === 'DESCARGA_2') member = staff.descarga2;
      else if (p.key === 'MISCELANEOS') member = staff.miscelaneos;
      else {
        member = this.crewService.getAssignedOperatorForPosition(p.key, guardCode);
      }

      return {
        key: p.key,
        title: p.title,
        operatorName: member?.name || '--- Vacante ---',
        documentId: member?.document_id || '---',
        radioChannel: member?.radio_channel || p.defaultRadio || 'Canal 1 Operaciones',
        location: p.defaultLocation || 'Planta Concentradora'
      };
    });
  }

  get filteredHandovers(): ShiftHandover[] {
    return this.handovers.filter(h => {
      // 1. Text Search
      if (this.searchQuery && this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        const matchesCode = (h.shift_code || '').toLowerCase().includes(q);
        const matchesOut = (h.outgoing_supervisor || '').toLowerCase().includes(q);
        const matchesIn = (h.incoming_supervisor || '').toLowerCase().includes(q);
        const matchesStatus = (h.plant_status || '').toLowerCase().includes(q);
        const matchesGuard = this.resolveSupervisorGuard(h.outgoing_supervisor).toLowerCase().includes(q);
        if (!matchesCode && !matchesOut && !matchesIn && !matchesStatus && !matchesGuard) {
          return false;
        }
      }

      // 2. Guard Filter
      if (this.selectedGuardFilter !== 'TODAS') {
        const outGuard = this.resolveSupervisorGuard(h.outgoing_supervisor);
        const matchesGuard = (h.shift_code || '').toUpperCase().startsWith(this.selectedGuardFilter) || outGuard === this.selectedGuardFilter;
        if (!matchesGuard) return false;
      }

      // 3. Shift Type Filter
      if (this.selectedShiftTypeFilter !== 'TODOS') {
        if (h.shift_type !== this.selectedShiftTypeFilter) return false;
      }

      // 4. Status Filter
      if (this.selectedStatusFilter !== 'TODOS') {
        if (h.status !== this.selectedStatusFilter) return false;
      }

      return true;
    });
  }

  ngOnInit(): void {
    // Sincronizar catálogo con miembros en BD si existen
    this.crewService.loadCrew().subscribe(() => {
      const sups = this.crewService.allMembers().filter(m => m.primary_role === 'SUPERVISOR');
      if (sups.length > 0) {
        sups.forEach(s => {
          const shift = s.shift_code as GuardCode;
          const foundIndex = this.officialSupervisors.findIndex(os => os.shift === shift || os.name === s.name);
          const item: OfficialSupervisor = {
            name: s.name,
            dni: s.document_id,
            role: 'Supervisor de guardia',
            shift: shift || 'G1',
            guardName: `Guardia ${shift}`,
            radio: s.radio_channel || 'Canal 1 Operaciones / Control'
          };
          if (foundIndex >= 0) {
            this.officialSupervisors[foundIndex] = item;
          } else {
            this.officialSupervisors.push(item);
          }
        });
      }
    });

    this.initDefaultHandoverState();
    this.loadHandovers();
    this.loadObservedVehicles();
    this.loadOperationalPlantMetrics();
  }

  initDefaultHandoverState(): void {
    const shiftInfo = getCurrentActiveShift();
    const outGuard = shiftInfo.activeGuard.code as GuardCode;
    const inGuard = shiftInfo.nextGuard.code as GuardCode;

    this.newHandover.outgoing_guard = outGuard;
    this.newHandover.incoming_guard = inGuard;
    this.newHandover.shift_type = shiftInfo.shiftName;

    const outSup = this.officialSupervisors.find(s => s.shift === outGuard);
    if (outSup) {
      this.newHandover.outgoing_supervisor = outSup.name;
      this.newHandover.outgoing_dni = outSup.dni;
      this.newHandover.outgoing_role = outSup.role;
    }

    const inSup = this.officialSupervisors.find(s => s.shift === inGuard);
    if (inSup) {
      this.newHandover.incoming_supervisor = inSup.name;
      this.newHandover.incoming_dni = inSup.dni;
      this.newHandover.incoming_role = inSup.role;
    }

    const dateCode = (shiftInfo.dateStr || getLocalDateString()).slice(5).replace('-', '');
    this.newHandover.shift_code = `${outGuard}_${shiftInfo.shiftName}_${dateCode}`;
  }

  resolveSupervisorGuard(name?: string): string {
    if (!name) return 'G1';
    const found = this.officialSupervisors.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (found) return found.shift;
    if (name.includes('GONGORA')) return 'G1';
    if (name.includes('ALIAGA')) return 'G2';
    if (name.includes('ARI')) return 'G3';
    if (name.includes('FERNANDEZ')) return 'G4';
    return 'G1';
  }

  resolveSupervisorDni(name?: string): string {
    if (!name) return '---';
    const found = this.officialSupervisors.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (found) return found.dni;
    if (name.includes('GONGORA')) return '41833717';
    if (name.includes('ALIAGA')) return '46593500';
    if (name.includes('ARI')) return '40132660';
    if (name.includes('FERNANDEZ')) return '18110964';
    return '---';
  }

  getGuardBadgeClass(guardCode: string): string {
    switch (guardCode) {
      case 'G1': return 'badge-g1';
      case 'G2': return 'badge-g2';
      case 'G3': return 'badge-g3';
      case 'G4': return 'badge-g4';
      default: return 'badge-g1';
    }
  }

  onOutgoingGuardChange(guardCode: GuardCode): void {
    this.newHandover.outgoing_guard = guardCode;
    const sup = this.officialSupervisors.find(s => s.shift === guardCode);
    if (sup) {
      this.newHandover.outgoing_supervisor = sup.name;
      this.newHandover.outgoing_dni = sup.dni;
      this.newHandover.outgoing_role = sup.role;
    }
    const dateCode = getLocalDateString().slice(5).replace('-', '');
    this.newHandover.shift_code = `${guardCode}_${this.newHandover.shift_type}_${dateCode}`;
  }

  onOutgoingSupervisorChange(name: string): void {
    const found = this.officialSupervisors.find(s => s.name === name);
    if (found) {
      this.newHandover.outgoing_supervisor = found.name;
      this.newHandover.outgoing_dni = found.dni;
      this.newHandover.outgoing_role = found.role;
      this.newHandover.outgoing_guard = found.shift;
      const dateCode = getLocalDateString().slice(5).replace('-', '');
      this.newHandover.shift_code = `${found.shift}_${this.newHandover.shift_type}_${dateCode}`;
    } else {
      this.newHandover.outgoing_supervisor = name;
    }
  }

  onIncomingGuardChange(guardCode: GuardCode): void {
    this.newHandover.incoming_guard = guardCode;
    const sup = this.officialSupervisors.find(s => s.shift === guardCode);
    if (sup) {
      this.newHandover.incoming_supervisor = sup.name;
      this.newHandover.incoming_dni = sup.dni;
      this.newHandover.incoming_role = sup.role;
    }
  }

  onIncomingSupervisorChange(name: string): void {
    const found = this.officialSupervisors.find(s => s.name === name);
    if (found) {
      this.newHandover.incoming_supervisor = found.name;
      this.newHandover.incoming_dni = found.dni;
      this.newHandover.incoming_role = found.role;
      this.newHandover.incoming_guard = found.shift;
    } else {
      this.newHandover.incoming_supervisor = name;
    }
  }

  onShiftTypeChange(type: 'DIA' | 'NOCHE'): void {
    this.newHandover.shift_type = type;
    const dateCode = getLocalDateString().slice(5).replace('-', '');
    this.newHandover.shift_code = `${this.newHandover.outgoing_guard}_${type}_${dateCode}`;
  }

  loadOperationalPlantMetrics(): void {
    // 1. Bombas Slurry
    const cachedPumps = getRealtimeData<any[]>('pumps_telemetry', []);
    if (cachedPumps && cachedPumps.length > 0) {
      this.livePumpTotal = cachedPumps.length;
      this.livePumpOperating = cachedPumps.filter(p => (p.status || '').toUpperCase() === 'OPERATING').length;
      this.livePumpAvail = this.livePumpTotal > 0 ? (this.livePumpOperating / this.livePumpTotal) * 100 : 100;
    }
    this.http.get<any>(`${getApiBaseUrl()}/pumps`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.livePumpTotal = res.data.length;
          this.livePumpOperating = res.data.filter((p: any) => (p.status || '').toUpperCase() === 'OPERATING').length;
          this.livePumpAvail = (this.livePumpOperating / this.livePumpTotal) * 100;
        }
      },
      error: () => {}
    });

    // 2. Ciclones
    const cachedSamples = getRealtimeData<any[]>('cyclone_samples', []);
    if (cachedSamples && cachedSamples.length > 0) {
      const validMesh = cachedSamples.map(s => parseFloat(s.mesh_minus_200_of || s.mesh200 || 0)).filter(v => v > 0);
      const validSolids = cachedSamples.map(s => parseFloat(s.solids_percentage || s.solids || 0)).filter(v => v > 0);
      if (validMesh.length > 0) {
        this.liveCycloneMesh200 = validMesh.reduce((a, b) => a + b, 0) / validMesh.length;
      }
      if (validSolids.length > 0) {
        this.liveCycloneSolids = validSolids.reduce((a, b) => a + b, 0) / validSolids.length;
      }
    }
    this.http.get<any>(`${getApiBaseUrl()}/cyclones/station-samples`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const validMesh = res.data.map((s: any) => parseFloat(s.mesh_minus_200_of || s.mesh200 || 0)).filter((v: number) => v > 0);
          const validSolids = res.data.map((s: any) => parseFloat(s.solids_percentage || s.solids || 0)).filter((v: number) => v > 0);
          if (validMesh.length > 0) {
            this.liveCycloneMesh200 = validMesh.reduce((a: number, b: number) => a + b, 0) / validMesh.length;
          }
          if (validSolids.length > 0) {
            this.liveCycloneSolids = validSolids.reduce((a: number, b: number) => a + b, 0) / validSolids.length;
          }
        }
      },
      error: () => {}
    });

    // 3. Relaves
    const cachedTailings = getRealtimeData<any[]>('tailings_reports', []);
    if (cachedTailings && cachedTailings.length > 0) {
      this.liveTailingsFreeboard = parseFloat(cachedTailings[0].freeboard_m || 2.65);
    }
    this.http.get<any>(`${getApiBaseUrl()}/tailings`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.liveTailingsFreeboard = parseFloat(res.data[0].freeboard_m || 2.65);
        }
      },
      error: () => {}
    });
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

  setChecklistStatus(item: HandoverChecklistItem, status: 'CONFORME' | 'OBSERVADO'): void {
    item.status = status;
    if (status === 'OBSERVADO' && !item.notes) {
      item.notes = 'Requiere inspección prioritaria en el relevo.';
    }
    this.syncObservedNotesToPending();
  }

  private syncObservedNotesToPending(): void {
    const observed = this.modalChecklist.filter(c => c.status === 'OBSERVADO');
    if (observed.length > 0) {
      const summary = observed.map(c => `[${c.category.toUpperCase()}]: ${c.notes || 'Observación registrada'}`).join('\n');
      if (!this.newHandover.pending_tasks.includes('[CHECKLIST]')) {
        this.newHandover.pending_tasks = `[CHECKLIST - CONDICIONES OBSERVADAS]:\n${summary}\n\n` + this.newHandover.pending_tasks;
      }
    }
  }

  autoSyncPlantDataToModal(): void {
    this.isSyncing = true;
    this.loadOperationalPlantMetrics();
    this.loadObservedVehicles();

    setTimeout(() => {
      const pumpDesc = this.livePumpTotal > 0 
        ? `${this.livePumpOperating}/${this.livePumpTotal} bombas slurry en servicio (${this.livePumpAvail.toFixed(0)}% disp)` 
        : 'Bombas en régimen operativo continuo';
      const cycloneDesc = this.liveCycloneMesh200 > 0 
        ? `Malla -200 OF promediando ${this.liveCycloneMesh200.toFixed(1)}%` 
        : 'Batería de ciclones estable';
      const tailingsDesc = `Presa de relaves con borde libre de ${this.liveTailingsFreeboard.toFixed(2)}m (margen seguro)`;

      this.newHandover.plant_status = `Operación continua de planta a cargo de Guardia ${this.newHandover.outgoing_guard}: ${pumpDesc}. ${cycloneDesc}. ${tailingsDesc}. Circuitos de molienda y flotación estables dentro de parámetros de diseño.`;
      this.newHandover.tonnage_processed = this.plantParamsService.tonnageTarget();
      this.newHandover.safety_incidents = 'Cero accidentes laborales (LTI: 0, MDI: 0). Charla de 5 minutos dictada al 100% de la cuadrilla. EPP verificado.';

      if (this.observedVehicles.length > 0) {
        const vehNotes = this.observedVehicles
          .map(v => `${v.tag} (${v.plate}) [${v.operationalStatus}]: ${v.observationNotes}`)
          .join('; ');
        const prefix = `[FLOTA VEHICULAR OBSERVADA]: ${vehNotes}`;
        if (!this.newHandover.pending_tasks.includes('[FLOTA VEHICULAR')) {
          this.newHandover.pending_tasks = prefix + (this.newHandover.pending_tasks ? '\n' + this.newHandover.pending_tasks : '');
        }
      }

      this.isSyncing = false;
      this.syncSuccessMsg = 'Métricas de bombas, ciclones, relaves y flota sincronizadas exitosamente.';
      setTimeout(() => { this.syncSuccessMsg = ''; }, 4000);
    }, 350);
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedGuardFilter = 'TODAS';
    this.selectedShiftTypeFilter = 'TODOS';
    this.selectedStatusFilter = 'TODOS';
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
    this.initDefaultHandoverState();
    this.modalChecklist = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));
    this.autoSyncPlantDataToModal();
    this.isCreateModalOpen = true;
  }

  saveHandover(): void {
    const shiftInfo = getCurrentActiveShift();
    const payload: ShiftHandover = {
      ...this.newHandover,
      assigned_crew: this.modalSquadStaff,
      checklist_data: this.modalChecklist,
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

  promptAcceptHandover(id: string): void {
    const found = this.handovers.find(h => h.id === id);
    if (!found) return;
    this.handoverToAccept = found;
    this.acceptanceConfirmed = false;
    this.isAcceptModalOpen = true;
  }

  confirmAcceptHandover(): void {
    if (!this.handoverToAccept || !this.acceptanceConfirmed) return;
    const id = this.handoverToAccept.id;

    const currentUser = this.authService.currentUser();
    const isCurrentUserOfficialSup = (currentUser?.role === 'SUPERVISOR' && !currentUser.fullName?.toLowerCase().includes('marck'))
      ? this.officialSupervisors.find(s => s.name === currentUser?.fullName || (currentUser?.document_id && s.dni === currentUser?.document_id))
      : null;

    const shiftInfo = getCurrentActiveShift();
    const nextSup = this.officialSupervisors.find(s => s.shift === shiftInfo.nextGuard.code);

    const finalIncomingSup = isCurrentUserOfficialSup 
      ? isCurrentUserOfficialSup 
      : (nextSup || this.officialSupervisors[0]);

    const acceptPayload = {
      incoming_supervisor: finalIncomingSup?.name || this.acceptingSupervisorName,
      incoming_dni: (finalIncomingSup as any)?.dni || (finalIncomingSup as any)?.document_id || this.acceptingSupervisorDni,
      incoming_role: 'Supervisor de guardia',
      incoming_guard: finalIncomingSup?.shift || 'G2'
    };

    const found = this.handovers.find(h => h.id === id);
    if (found) {
      found.status = 'ACCEPTED';
      found.incoming_supervisor = acceptPayload.incoming_supervisor;
      found.incoming_dni = acceptPayload.incoming_dni;
      found.incoming_role = acceptPayload.incoming_role;
      saveRealtimeData('shift_handovers', this.handovers);
    }

    if (this.selectedHandoverForDetail && this.selectedHandoverForDetail.id === id) {
      this.selectedHandoverForDetail.status = 'ACCEPTED';
      this.selectedHandoverForDetail.incoming_supervisor = acceptPayload.incoming_supervisor;
      this.selectedHandoverForDetail.incoming_dni = acceptPayload.incoming_dni;
    }

    this.isAcceptModalOpen = false;

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

  openDetailModal(h: ShiftHandover): void {
    this.selectedHandoverForDetail = h;
    this.isDetailModalOpen = true;
  }

  openPdfReport(h?: ShiftHandover | null): void {
    const target = h || this.latestHandover || (this.handovers && this.handovers.length > 0 ? this.handovers[0] : null);
    if (!target) {
      alert('⚠️ Al momento no existen relevos de guardia registrados en el sistema. Registra un nuevo relevo para poder generar y descargar su reporte oficial.');
      return;
    }
    this.selectedHandoverForPdf = target;
    this.isPdfModalOpen = true;
  }

  exportHistoryToCsv(): void {
    const list = this.filteredHandovers;
    if (list.length === 0) {
      alert('No hay relevos para exportar con los filtros seleccionados.');
      return;
    }

    const headers = [
      'Código de Turno',
      'Fecha',
      'Turno',
      'Guardia Saliente',
      'Supervisor Saliente',
      'DNI Saliente',
      'Cargo Saliente',
      'Guardia Entrante',
      'Supervisor Entrante',
      'DNI Entrante',
      'Cargo Entrante',
      'Tonelaje Tratado (Ton)',
      'Estado',
      'Estado General Planta',
      'Seguridad e Incidentes',
      'Pendientes y Consignas'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map(h => [
      escapeCsv(h.shift_code),
      escapeCsv(h.date),
      escapeCsv(h.shift_type),
      escapeCsv(this.resolveSupervisorGuard(h.outgoing_supervisor)),
      escapeCsv(h.outgoing_supervisor),
      escapeCsv(h.outgoing_dni || this.resolveSupervisorDni(h.outgoing_supervisor)),
      escapeCsv(h.outgoing_role || 'Supervisor de guardia'),
      escapeCsv(this.resolveSupervisorGuard(h.incoming_supervisor)),
      escapeCsv(h.incoming_supervisor),
      escapeCsv(h.incoming_dni || this.resolveSupervisorDni(h.incoming_supervisor)),
      escapeCsv(h.incoming_role || 'Supervisor de guardia'),
      escapeCsv(h.tonnage_processed),
      escapeCsv(h.status === 'ACCEPTED' ? 'ACEPTADO' : 'PENDIENTE'),
      escapeCsv(h.plant_status),
      escapeCsv(h.safety_incidents || ''),
      escapeCsv(h.pending_tasks || '')
    ].join(','));

    // UTF-8 BOM for Microsoft Excel compatibility
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = getLocalDateString().replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `BASETRACK_Relevos_Guardia_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
