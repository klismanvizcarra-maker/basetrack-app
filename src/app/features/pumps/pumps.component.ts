import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { ModalComponent } from '../../shared/ui/modal.component';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';
import { PumpReportPdfComponent } from '../reports/pump-report-pdf.component';
import { CrewService } from '../../core/services/crew.service';
import { getCurrentActiveShift } from '../../shared/utils/roster.util';
import { AuthService } from '../../core/auth/auth.service';

export interface PumpStatusItem {
  tag: string;
  status: 'Operativo' | 'Stand by' | 'Mantenimiento' | 'Falla';
}

export interface PozaSentinaItem {
  poza: string;
  medida_ini: string;
  flujo_ini: string;
  medida_fin: string;
  flujo_fin: string;
  horas: string;
  acc: string;
}

export interface PumpStationSheet {
  id?: string;
  report_date: string;
  shift_code: string;
  operator_name: string;
  sentina_pumps: PumpStatusItem[];
  intermedia_pumps: PumpStatusItem[];
  torre5_pumps: PumpStatusItem[];
  levels: {
    orca: string;
    espejo: string;
    captacion: string;
  };
  main_indicators: {
    nivel_sentina: string;
    bombeo_turno_intermedia: string;
    nivel_tko02: string;
    aforador: string;
    cortafugas: string;
    ph_aforador: string;
    ph_cortafugas: string;
    h_embalas: string;
    dique_almacenamiento: string;
    drenaje_dique: string;
    agua_a_car: string;
    anticrustante: string;
    torre5_cortafugas: string;
    torre5_status1: string;
    torre5_status2: string;
  };
  pozas_sentina: PozaSentinaItem[];
  additional_obs: {
    notas: string;
    af_cantera: string;
    escorrentia: string;
    ph_c5_1: string;
    ph_c5_2: string;
  };
}

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
  imports: [CommonModule, FormsModule, ModalComponent, PumpReportPdfComponent],
  template: `
    <div class="pumps-page animate-fade-in">
      <!-- Top Action Bar -->
      <div class="page-top-bar glass-panel no-print">
        <div class="page-title-group">
          <div class="title-badge-row">
            <span class="area-badge">ÁREA DE BOMBEO Y SENTINAS</span>
            <span class="live-pill"><span class="dot"></span> EN VIVO</span>
          </div>
          <h2>Monitoreo y Reporte Operativo de Bombas</h2>
          <p class="section-sub">Control de estaciones de sentina, bombeo intermedio, presa de relaves e indicadores físico-químicos</p>
        </div>

        <div class="top-controls">
          <!-- View Switcher -->
          <div class="view-pill-group">
            <button class="pill-btn" [class.active]="activeTab === 'REPORT'" (click)="activeTab = 'REPORT'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Reporte Integral (Planta)
            </button>
            <button class="pill-btn" [class.active]="activeTab === 'TELEMETRY'" (click)="activeTab = 'TELEMETRY'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Telemetría Slurry
            </button>
          </div>

          <!-- Action Buttons -->
          <div class="actions-group">
            <button class="btn btn-secondary action-btn-pdf" (click)="isPdfModalOpen = true" title="Exportar reporte oficial de bombas en PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Exportar PDF
            </button>
            <div *ngIf="activeTab === 'REPORT'" class="autosave-badge" [class.saving]="isAutoSaving">
              <span class="autosave-dot"></span>
              <span class="autosave-text">
                {{ isAutoSaving ? 'Guardando...' : (lastAutoSavedTime ? '✓ Guardado ' + lastAutoSavedTime : '✓ Guardado automático') }}
              </span>
            </div>
            <button *ngIf="activeTab === 'TELEMETRY'" class="btn btn-primary" (click)="openCreatePumpModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva Bomba Slurry
            </button>
          </div>
        </div>
      </div>

      <!-- Feedback Notification Banner -->
      <div *ngIf="saveSuccessMessage" class="feedback-banner glass-panel animate-fade-in no-print">
        <span class="feedback-text">{{ saveSuccessMessage }}</span>
      </div>

      <!-- TAB 1: REPORTE INTEGRAL DE BOMBAS (FORMATO PLANTA SECCIONES A - E) -->
      <div *ngIf="activeTab === 'REPORT'" class="report-container no-print animate-fade-in">
        
        <!-- SECCIÓN A: REPORTE DE BOMBAS -->
        <section class="section-card glass-panel">
          <div class="section-header-banner">
            <div class="header-left">
              <span class="globe-icon">🌐</span>
              <h3>SECCIÓN A: REPORTE DE BOMBAS</h3>
            </div>
            <div class="header-right">
              <span class="date-label">FECHA:</span>
              <input type="text" class="date-input" [(ngModel)]="sheet.report_date" (change)="onDateChange()" />
            </div>
          </div>

          <!-- Mobile Scroll Hint -->
          <div class="mobile-table-scroll-hint no-print">
            <span>↔ Desliza la tabla horizontalmente para ver Intermedia y Torre 5</span>
          </div>

          <!-- 3-Column Pump Grid (Sentina, Intermedia, Torre 5) -->
          <div class="pumps-table-wrapper">
            <table class="pumps-report-table">
              <thead>
                <tr>
                  <th class="th-station col-sentina">SENTINA</th>
                  <th class="th-status col-sentina">STATUS</th>
                  <th class="th-station col-intermedia">INTERMEDIA</th>
                  <th class="th-status col-intermedia">STATUS</th>
                  <th class="th-station col-torre">TORRE 5</th>
                  <th class="th-status col-torre">STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let idx of maxRowsArray">
                  <!-- SENTINA (PU001 - PU008) -->
                  <td class="cell-tag font-bold">
                    {{ sheet.sentina_pumps[idx]?.tag || '' }}
                  </td>
                  <td class="cell-status">
                    <button *ngIf="sheet.sentina_pumps[idx]" 
                            class="status-badge-btn" 
                            [ngClass]="getStatusClass(sheet.sentina_pumps[idx].status)"
                            (click)="cycleStatus(sheet.sentina_pumps[idx])"
                            title="Click para cambiar estado">
                      {{ sheet.sentina_pumps[idx].status }}
                    </button>
                  </td>

                  <!-- INTERMEDIA (PU011 - PU016) -->
                  <td class="cell-tag font-bold">
                    {{ sheet.intermedia_pumps[idx]?.tag || '' }}
                  </td>
                  <td class="cell-status">
                    <button *ngIf="sheet.intermedia_pumps[idx]" 
                            class="status-badge-btn" 
                            [ngClass]="getStatusClass(sheet.intermedia_pumps[idx].status)"
                            (click)="cycleStatus(sheet.intermedia_pumps[idx])"
                            title="Click para cambiar estado">
                      {{ sheet.intermedia_pumps[idx].status }}
                    </button>
                  </td>

                  <!-- TORRE 5 (PU021 - PU030) -->
                  <td class="cell-tag font-bold">
                    {{ sheet.torre5_pumps[idx]?.tag || '' }}
                  </td>
                  <td class="cell-status">
                    <button *ngIf="sheet.torre5_pumps[idx]" 
                            class="status-badge-btn" 
                            [ngClass]="getStatusClass(sheet.torre5_pumps[idx].status)"
                            (click)="cycleStatus(sheet.torre5_pumps[idx])"
                            title="Click para cambiar estado">
                      {{ sheet.torre5_pumps[idx].status }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Section A Footer Summary Chips -->
          <div class="summary-chips-row">
            <div class="status-summary-chip">
              <span class="chip-label">Sentina Operando:</span>
              <strong class="chip-count emerald">{{ sentinaOperatingCount }} / {{ sheet.sentina_pumps.length }} Operando</strong>
            </div>
            <div class="status-summary-chip">
              <span class="chip-label">Intermedia Operando:</span>
              <strong class="chip-count cyan">{{ intermediaOperatingCount }} / {{ sheet.intermedia_pumps.length }} Operando</strong>
            </div>
            <div class="status-summary-chip">
              <span class="chip-label">Torre 5 Operando:</span>
              <strong class="chip-count purple">{{ torre5OperatingCount }} / {{ sheet.torre5_pumps.length }} Operando</strong>
            </div>
          </div>
        </section>

        <!-- SECCIÓN B: OBSERVACIONES DE NIVELES (EDITABLE DIRECTO) -->
        <section class="section-card glass-panel">
          <div class="section-bar-title">
            <span class="section-icon">👁</span>
            <h4>SECCIÓN B: OBSERVACIONES DE NIVELES</h4>
            <span class="edit-badge-tag">✍️ Edición en Pantalla</span>
          </div>
          <div class="levels-grid editable-levels">
            <div class="level-item-box">
              <label class="level-key">ORCA:</label>
              <input type="text" class="inline-level-input cyan-glow" [(ngModel)]="sheet.levels.orca" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
            </div>
            <div class="level-item-box">
              <label class="level-key">Espejo:</label>
              <input type="text" class="inline-level-input emerald-glow" [(ngModel)]="sheet.levels.espejo" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
            </div>
            <div class="level-item-box">
              <label class="level-key">Captación:</label>
              <input type="text" class="inline-level-input purple-glow" [(ngModel)]="sheet.levels.captacion" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
            </div>
          </div>
        </section>

        <!-- SECCIÓN C: INDICADORES PRINCIPALES (EDITABLE DIRECTO) -->
        <section class="section-card glass-panel">
          <div class="section-bar-title">
            <span class="section-icon">📈</span>
            <h4>SECCIÓN C: INDICADORES PRINCIPALES</h4>
            <span class="edit-badge-tag">✍️ Edición en Pantalla</span>
          </div>
          <div class="indicators-dual-columns">
            <!-- Left Column -->
            <div class="indicator-column">
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Nivel de sentina (%)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.nivel_sentina" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Bombeo Turno Intermedia (m³)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.bombeo_turno_intermedia" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Nivel TKO02 (%)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.nivel_tko02" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Aforador (m)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.aforador" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Cortafugas (l/s)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.cortafugas" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">pH aforador</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.ph_aforador" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">pH Cortafugas</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.ph_cortafugas" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">H Embalas</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.h_embalas" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
            </div>

            <!-- Right Column -->
            <div class="indicator-column">
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Dique Almacenamiento (%)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.dique_almacenamiento" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Drenaje del Dique (%)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.drenaje_dique" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Agua a car</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.agua_a_car" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Anticrustante (%)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.anticrustante" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Torre 5 Cortafugas (%)</span>
                <span class="ind-leader"></span>
                <input type="text" class="inline-ind-input" [(ngModel)]="sheet.main_indicators.torre5_cortafugas" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Torre 5 Status 1</span>
                <span class="ind-leader"></span>
                <button type="button" 
                        class="status-badge-btn" 
                        [ngClass]="getStatusClass(sheet.main_indicators.torre5_status1 || 'Stand by')"
                        (click)="cycleTorreStatus(1)"
                        title="Click para cambiar estado de Torre 5 Status 1">
                  {{ sheet.main_indicators.torre5_status1 || 'Stand by' }}
                </button>
              </div>
              <div class="indicator-row editable-ind-row">
                <span class="ind-label">Torre 5 Status 2</span>
                <span class="ind-leader"></span>
                <button type="button" 
                        class="status-badge-btn" 
                        [ngClass]="getStatusClass(sheet.main_indicators.torre5_status2 || 'Stand by')"
                        (click)="cycleTorreStatus(2)"
                        title="Click para cambiar estado de Torre 5 Status 2">
                  {{ sheet.main_indicators.torre5_status2 || 'Stand by' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- SECCIÓN D: POZAS SENTINA (EDITABLE DIRECTO) -->
        <section class="section-card glass-panel">
          <div class="section-bar-title">
            <span class="section-icon">📋</span>
            <h4>SECCIÓN D: POZAS SENTINA</h4>
            <span class="edit-badge-tag">✍️ Edición en Pantalla</span>
          </div>
          <div class="pozas-table-wrapper">
            <table class="pozas-table">
              <thead>
                <tr>
                  <th>POZA</th>
                  <th>MEDIDA INICIAL</th>
                  <th>FLUJO INICIAL</th>
                  <th>MEDIDA FINAL</th>
                  <th>FLUJO FINAL</th>
                  <th>HORAS DE BOMBEO</th>
                  <th>ACC.</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of sheet.pozas_sentina">
                  <td class="poza-tag">{{ p.poza }}</td>
                  <td>
                    <input type="text" class="inline-poza-input" [(ngModel)]="p.medida_ini" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
                  </td>
                  <td>
                    <input type="text" class="inline-poza-input" [(ngModel)]="p.flujo_ini" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
                  </td>
                  <td>
                    <input type="text" class="inline-poza-input" [(ngModel)]="p.medida_fin" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
                  </td>
                  <td>
                    <input type="text" class="inline-poza-input" [(ngModel)]="p.flujo_fin" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
                  </td>
                  <td>
                    <input type="text" class="inline-poza-input" [(ngModel)]="p.horas" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
                  </td>
                  <td>
                    <input type="text" class="inline-poza-input" [(ngModel)]="p.acc" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- SECCIÓN E: OBSERVACIONES ADICIONALES (EDITABLE DIRECTO) -->
        <section class="section-card glass-panel">
          <div class="section-bar-title">
            <span class="section-icon">📑</span>
            <h4>SECCIÓN E: OBSERVACIONES ADICIONALES</h4>
            <span class="edit-badge-tag">✍️ Edición en Pantalla</span>
          </div>
          <div class="additional-obs-layout">
            <div class="notes-block">
              <label class="notes-heading">NOTAS Y EVENTOS DEL TURNO:</label>
              <textarea 
                class="inline-notes-textarea" 
                rows="4" 
                [(ngModel)]="sheet.additional_obs.notas" 
                (ngModelChange)="onSheetChange()" 
                (focus)="onFocusSelect($event)"
                placeholder="Escriba aquí las notas, novedades operativas, eventos de turno o contingencias..."
              ></textarea>
            </div>
            <div class="side-metrics-block">
              <div class="side-metric-row editable-sm-row">
                <span class="sm-label">Af. Cantera:</span>
                <span class="sm-leader"></span>
                <input type="text" class="inline-sm-input" [(ngModel)]="sheet.additional_obs.af_cantera" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="side-metric-row editable-sm-row">
                <span class="sm-label">Escorrentia:</span>
                <span class="sm-leader"></span>
                <input type="text" class="inline-sm-input" [(ngModel)]="sheet.additional_obs.escorrentia" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="side-metric-row editable-sm-row">
                <span class="sm-label">pH C/5 (1):</span>
                <span class="sm-leader"></span>
                <input type="text" class="inline-sm-input" [(ngModel)]="sheet.additional_obs.ph_c5_1" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
              <div class="side-metric-row editable-sm-row">
                <span class="sm-label">pH C/5 (2):</span>
                <span class="sm-leader"></span>
                <input type="text" class="inline-sm-input" [(ngModel)]="sheet.additional_obs.ph_c5_2" (ngModelChange)="onSheetChange()" (focus)="onFocusSelect($event)" placeholder="" />
              </div>
            </div>
          </div>
        </section>

      </div>

      <!-- TAB 2: TELEMETRÍA SLURRY (MONITOREO DE EQUIPOS CRÍTICOS) -->
      <div *ngIf="activeTab === 'TELEMETRY'" class="telemetry-container no-print animate-fade-in">
        <div class="pumps-cards-grid">
          <div *ngFor="let pump of pumps" class="pump-card glass-panel" [class.operating]="pump.status === 'OPERATING'" [class.standby]="pump.status === 'STANDBY'" [class.maintenance]="pump.status === 'MAINTENANCE'">
            <div class="pump-card-header">
              <div class="pump-tag-group">
                <span class="pump-tag">{{ pump.tag }}</span>
                <span class="pump-sys">{{ pump.system }}</span>
              </div>
              <span class="badge" [ngClass]="getTelemetryBadge(pump.status)">
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

            <div class="pump-footer">
              <span class="op-label">Op: {{ pump.operator_name }}</span>
              <button class="btn btn-secondary btn-sm" (click)="openStatusModal(pump)">
                Cambiar Estado
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Pump Telemetry Modal -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Registrar Nueva Telemetría de Bomba Slurry'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="savePumpTelemetry()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Tag de Bomba (Ej: PP-104)</label>
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
          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar Telemetría</button>
          </div>
        </form>
      </app-modal>

      <!-- Status Update Modal for Telemetry -->
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
            <button type="button" class="btn btn-primary" (click)="applyTelemetryStatusUpdate()">Actualizar</button>
          </div>
        </div>
      </app-modal>

      <!-- Modal Exportar Reporte PDF Oficial a 1 Hoja -->
      <app-pump-report-pdf
        [isOpen]="isPdfModalOpen"
        [sheet]="sheet"
        [pumps]="pumps"
        (close)="isPdfModalOpen = false">
      </app-pump-report-pdf>
    </div>
  `,
  styles: [`
    .pumps-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* TOP ACTION BAR */
    .page-top-bar {
      padding: 16px 22px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;

      .page-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .title-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;

          .area-badge {
            font-size: 0.7rem;
            font-weight: 700;
            color: #38bdf8;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .live-pill {
            font-size: 0.65rem;
            font-weight: 700;
            color: #34d399;
            background: rgba(52, 211, 153, 0.12);
            padding: 2px 8px;
            border-radius: var(--radius-full);
            display: inline-flex;
            align-items: center;
            gap: 4px;

            .dot {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #34d399;
              box-shadow: 0 0 6px #34d399;
            }
          }
        }

        h2 {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
        }

        .section-sub {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0;
        }
      }

      .top-controls {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .view-pill-group {
        display: flex;
        background: var(--bg-input);
        padding: 3px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-subtle);

        .pill-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 6px 14px;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: var(--transition-smooth);

          &:hover {
            color: var(--text-primary);
          }

          &.active {
            background: var(--bg-card);
            border: 1.5px solid var(--primary-purple);
            color: var(--primary-purple);
            box-shadow: var(--shadow-card);
          }
        }
      }

      .actions-group {
        display: flex;
        align-items: center;
        gap: 10px;

        .autosave-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          background: rgba(3, 23, 149, 0.06);
          border: 1px solid rgba(3, 23, 149, 0.18);
          border-radius: var(--radius-full);
          font-size: 0.80rem;
          font-weight: 700;
          color: #031795;
          user-select: none;
          white-space: nowrap;
          transition: all 0.2s ease;

          .autosave-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
          }

          &.saving {
            background: rgba(245, 158, 11, 0.1);
            border-color: rgba(245, 158, 11, 0.35);
            color: #d97706;

            .autosave-dot {
              background: #f59e0b;
              box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
            }
          }
        }
      }

      :host-context(.dark) .actions-group .autosave-badge {
        background: rgba(96, 165, 250, 0.12);
        border-color: rgba(96, 165, 250, 0.28);
        color: #93c5fd;

        .autosave-dot {
          background: #34d399;
          box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);
        }
      }

      @media (max-width: 768px) {
        padding: 14px 14px;
        gap: 12px;

        .page-title-group {
          width: 100%;
          h2 {
            font-size: 1.15rem;
          }
          .section-sub {
            font-size: 0.75rem;
            line-height: 1.35;
          }
        }

        .top-controls {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }

        .view-pill-group {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;

          .pill-btn {
            justify-content: center;
            padding: 8px 10px;
            font-size: 0.78rem;
          }
        }

        .actions-group {
          width: 100%;
          .btn {
            width: 100%;
            justify-content: center;
            padding: 10px;
          }
        }
      }
    }

    /* FEEDBACK BANNER */
    .feedback-banner {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: var(--radius-md);
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #10b981;
      font-size: 0.88rem;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12);
    }

    /* REPORT CONTAINER & SECTION CARDS */
    .report-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-card {
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      overflow: hidden;
    }

    .section-header-banner {
      background: linear-gradient(135deg, #031795 0%, #02106b 100%);
      border-bottom: 1px solid rgba(3, 23, 149, 0.3);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;

      .header-left {
        display: flex;
        align-items: center;
        gap: 10px;

        .globe-icon {
          font-size: 1.15rem;
        }

        h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.04em;
        }
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;

        .date-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: 0.05em;
        }

        .date-input {
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          font-size: 0.84rem;
          font-weight: 700;
          text-align: center;
          width: 120px;
        }
      }

      @media (max-width: 600px) {
        padding: 10px 14px;

        .header-left h3 {
          font-size: 0.95rem;
        }

        .header-right {
          width: 100%;
          justify-content: space-between;

          .date-input {
            flex: 1;
            max-width: 140px;
          }
        }
      }
    }

    .section-bar-title {
      background: var(--bg-card-subtle);
      padding: 10px 18px;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      gap: 8px;

      .section-icon {
        font-size: 1rem;
      }

      h4 {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 800;
        color: #031795;
        letter-spacing: 0.04em;
      }

      .edit-badge-tag {
        margin-left: auto;
        font-size: 0.72rem;
        font-weight: 700;
        color: #031795;
        background: rgba(3, 23, 149, 0.08);
        border: 1px solid rgba(3, 23, 149, 0.22);
        border-radius: var(--radius-full);
        padding: 2px 10px;
      }
    }

    /* SECTION A: PUMPS TABLE */
    .pumps-table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: var(--bg-card);
    }

    .pumps-report-table {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
      text-align: center;
      font-size: 0.86rem;

      th {
        background: #031795;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: 0.05em;
        padding: 10px 12px;
        border: 1px solid var(--border-subtle);
        font-size: 0.82rem;

        &.th-station { width: 14%; }
        &.th-status { width: 19%; }
      }

      td {
        padding: 7px 12px;
        border: 1px solid var(--border-subtle);
        vertical-align: middle;
        background: var(--bg-card);
        color: var(--text-primary);
      }

      tbody tr {
        transition: background-color 0.15s ease;

        &:nth-child(even) td {
          background: var(--bg-card-subtle);
        }

        &:hover td {
          background: var(--bg-card-hover);
        }
      }

      .cell-tag {
        color: var(--accent-cyan, #38bdf8);
        font-weight: 700;
        font-size: 0.88rem;
        letter-spacing: 0.03em;
        background: rgba(56, 189, 248, 0.08) !important;
      }

      .cell-status {
        padding: 4px 8px;
      }
    }

    .mobile-table-scroll-hint {
      display: none;
      padding: 6px 14px;
      background: var(--primary-bg-subtle, rgba(3, 23, 149, 0.08));
      color: var(--primary-purple);
      font-size: 0.72rem;
      font-weight: 700;
      text-align: center;
      border-bottom: 1px solid var(--border-subtle);

      @media (max-width: 768px) {
        display: block;
      }
    }

    /* STATUS BADGE BUTTONS */
    .status-badge-btn {
      border: 1px solid transparent;
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 92px;
      min-height: 36px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: var(--transition-smooth);

      &.status-operativo {
        background: rgba(16, 185, 129, 0.16);
        border-color: rgba(16, 185, 129, 0.35);
        color: #10b981;

        &:hover {
          background: rgba(16, 185, 129, 0.28);
        }
      }

      &.status-standby {
        background: rgba(56, 189, 248, 0.16);
        border-color: rgba(56, 189, 248, 0.35);
        color: #38bdf8;

        &:hover {
          background: rgba(56, 189, 248, 0.28);
        }
      }

      &.status-mantenimiento {
        background: rgba(245, 158, 11, 0.16);
        border-color: rgba(245, 158, 11, 0.35);
        color: #f59e0b;

        &:hover {
          background: rgba(245, 158, 11, 0.28);
        }
      }

      &.status-falla {
        background: rgba(239, 68, 68, 0.16);
        border-color: rgba(239, 68, 68, 0.35);
        color: #ef4444;

        &:hover {
          background: rgba(239, 68, 68, 0.28);
        }
      }
    }

    /* SUMMARY STATUS BAR & CHIPS */
    .summary-chips-row,
    .status-summary-bar {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: var(--bg-card-subtle);
      border-top: 1px solid var(--border-subtle);
      padding: 10px 16px;
      gap: 12px;
      flex-wrap: wrap;

      .status-summary-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 14px;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-full);

        .chip-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .chip-count {
          font-size: 0.88rem;
          font-weight: 800;

          &.emerald { color: #10b981; }
          &.cyan { color: #38bdf8; }
          &.purple { color: #60a5fa; }
        }
      }

      @media (max-width: 640px) {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        padding: 10px;
        gap: 6px;

        .status-summary-chip {
          padding: 6px 4px;
          flex-direction: column;
          gap: 2px;
          text-align: center;
          justify-content: center;

          .chip-label { font-size: 0.68rem; }
          .chip-count { font-size: 0.85rem; }
        }
      }
    }

    /* SECTION B: LEVELS (INLINE EDITABLE) */
    .levels-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      padding: 14px 20px;
      gap: 16px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }

      .level-item-box {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--bg-card-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: 8px 14px;
        transition: border-color 0.2s ease;

        &:focus-within {
          border-color: #38bdf8;
        }

        .level-key {
          font-size: 0.86rem;
          font-weight: 800;
          color: var(--text-primary);
          min-width: 75px;
        }

        .inline-level-input {
          flex: 1;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-size: 0.92rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          transition: all 0.2s ease;

          &:focus {
            outline: none;
            border-color: #38bdf8;
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
          }

          &.cyan-glow { color: #0284c7; }
          &.emerald-glow { color: #059669; }
          &.purple-glow { color: #4338ca; }
        }
      }
    }

    /* SECTION C: INDICATORS (INLINE EDITABLE) */
    .indicators-dual-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 16px 20px;
      gap: 24px;

      @media (max-width: 800px) {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .indicator-column {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .indicator-row {
        display: flex;
        align-items: center;
        font-size: 0.84rem;
        padding: 4px 6px;
        border-radius: var(--radius-sm);
        transition: background-color 0.15s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .ind-label {
          color: var(--text-secondary);
          white-space: nowrap;
          font-weight: 600;
        }

        .ind-leader {
          flex: 1;
          border-bottom: 1px dotted var(--border-subtle);
          margin: 0 10px;
          min-width: 16px;
        }

        .inline-ind-input {
          width: 100px;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: #0284c7;
          font-weight: 700;
          font-size: 0.86rem;
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          text-align: right;
          font-variant-numeric: tabular-nums;
          transition: all 0.2s ease;

          &:focus {
            outline: none;
            border-color: #38bdf8;
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
            color: var(--text-primary);
          }
        }

        .status-badge-btn {
          min-width: 90px;
          min-height: 30px;
          padding: 3px 10px;
          font-size: 0.76rem;
        }
      }
    }

    /* SECTION D: POZAS SENTINA (INLINE EDITABLE) */
    .pozas-table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      background: var(--bg-card);
    }

    .pozas-table {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
      text-align: center;
      font-size: 0.86rem;

      th {
        background: #031795;
        color: #ffffff;
        font-weight: 800;
        letter-spacing: 0.05em;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        font-size: 0.82rem;
      }

      td {
        padding: 7px 12px;
        border: 1px solid var(--border-subtle);
        vertical-align: middle;
        background: var(--bg-card);
        color: var(--text-primary);
      }

      tbody tr {
        transition: background-color 0.15s ease;

        &:nth-child(even) td {
          background: var(--bg-card-subtle);
        }

        &:hover td {
          background: var(--bg-card-hover);
        }
      }

      .poza-tag {
        color: #031795;
        font-weight: 800;
        font-size: 0.88rem;
        letter-spacing: 0.02em;
      }

      .inline-poza-input {
        width: 100%;
        max-width: 110px;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        font-size: 0.86rem;
        font-weight: 700;
        padding: 6px 8px;
        border-radius: var(--radius-sm);
        text-align: center;
        font-variant-numeric: tabular-nums;
        transition: all 0.2s ease;

        &:hover {
          border-color: rgba(3, 23, 149, 0.35);
        }

        &:focus {
          outline: none;
          border-color: #031795;
          box-shadow: 0 0 0 2px rgba(3, 23, 149, 0.2);
          background: var(--bg-card);
        }
      }
    }

    /* SECTION E: OBSERVACIONES ADICIONALES (INLINE EDITABLE) */
    .additional-obs-layout {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      padding: 16px 20px;
      gap: 24px;

      @media (max-width: 800px) {
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .notes-block {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .notes-heading {
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .inline-notes-textarea {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          font-size: 0.86rem;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          resize: vertical;
          min-height: 100px;
          font-family: inherit;
          line-height: 1.5;
          transition: all 0.2s ease;

          &:focus {
            outline: none;
            border-color: #38bdf8;
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
          }
        }
      }

      .side-metrics-block {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .side-metric-row {
          display: flex;
          align-items: center;
          font-size: 0.84rem;
          padding: 4px 6px;

          .sm-label {
            color: var(--text-secondary);
            min-width: 95px;
            font-weight: 600;
          }

          .sm-leader {
            flex: 1;
            border-bottom: 1px dotted var(--border-subtle);
            margin: 0 10px;
            min-width: 16px;
          }

          .inline-sm-input {
            width: 90px;
            background: var(--bg-input);
            border: 1px solid var(--border-subtle);
            color: #0284c7;
            font-weight: 700;
            font-size: 0.86rem;
            padding: 5px 8px;
            border-radius: var(--radius-sm);
            text-align: right;
            font-variant-numeric: tabular-nums;
            transition: all 0.2s ease;

            &:focus {
              outline: none;
              border-color: #38bdf8;
              box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
              color: var(--text-primary);
            }
          }
        }
      }
    }

    :host-context(.dark) {
      .inline-level-input.cyan-glow,
      .inline-ind-input,
      .poza-tag,
      .inline-sm-input {
        color: #38bdf8 !important;
      }
      .inline-level-input.emerald-glow {
        color: #34d399 !important;
      }
      .inline-level-input.purple-glow {
        color: #a5b4fc !important;
      }
    }

    /* TAB 2: TELEMETRY VIEW STYLES */
    .pumps-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .pump-card {
      padding: 20px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: var(--transition-smooth);

      &:hover {
        transform: translateY(-2px);
        border-color: var(--primary-border);
      }

      &.operating { border-left: 4px solid var(--success); }
      &.standby { border-left: 4px solid var(--accent-cyan); }
      &.maintenance { border-left: 4px solid var(--warning); }

      .pump-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;

        .pump-tag-group {
          display: flex;
          flex-direction: column;

          .pump-tag {
            font-size: 1rem;
            font-weight: 800;
            color: var(--text-primary);
          }

          .pump-sys {
            font-size: 0.68rem;
            color: var(--text-muted);
            text-transform: uppercase;
          }
        }
      }

      .pump-name {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--text-secondary);
        margin: 0;
      }

      .metrics-quad {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        background: var(--bg-card-subtle);
        padding: 12px;
        border-radius: var(--radius-md);

        .metric-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .m-label {
            font-size: 0.65rem;
            color: var(--text-muted);
            text-transform: uppercase;
          }

          .m-value {
            font-size: 0.92rem;
            font-weight: 700;
            color: var(--text-primary);

            small {
              font-size: 0.7rem;
              color: var(--text-muted);
            }

            &.warn { color: var(--warning); }
            &.alert { color: var(--danger); font-weight: 800; }
          }
        }
      }

      .pump-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 8px;
        border-top: 1px solid var(--border-subtle);

        .op-label {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
      }
    }

    /* MODAL STYLES */
    .modal-form, .status-modal-content {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 75vh;
      overflow-y: auto;
      padding-right: 4px;
    }

    .form-section-title {
      font-size: 0.8rem;
      font-weight: 800;
      color: #34d399;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(52, 211, 153, 0.2);
      padding-bottom: 4px;
      margin-top: 6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .form-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--text-secondary);
      }

      input, select, textarea {
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        font-size: 0.84rem;

        &:focus {
          outline: none;
          border-color: var(--primary-purple);
        }
      }
    }

    .poza-edit-box {
      background: var(--bg-card-subtle);
      padding: 10px;
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: 8px;

      strong {
        color: #38bdf8;
        font-size: 0.82rem;
      }
    }

    .modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      width: 100%;
      margin-top: 8px;
    }
  `]
})
export class PumpsComponent implements OnInit {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);
  private crewService = inject(CrewService);
  private authService = inject(AuthService);

  activeTab: 'REPORT' | 'TELEMETRY' = 'REPORT';
  isEditModalOpen = false;
  isCreateModalOpen = false;
  isStatusModalOpen = false;
  isPdfModalOpen = false;
  isSaving = false;
  isAutoSaving = false;
  lastAutoSavedTime = '';
  private autoSaveTimer: any = null;
  saveSuccessMessage = '';

  // Max rows in Section A is 10 (Torre 5 has PU021..PU030)
  readonly maxRowsArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  sheet: PumpStationSheet = {
    report_date: new Date().toLocaleDateString('es-PE'),
    shift_code: 'G1',
    operator_name: '--- Vacante ---',
    sentina_pumps: [
      { tag: 'PU001', status: 'Operativo' },
      { tag: 'PU002', status: 'Operativo' },
      { tag: 'PU003', status: 'Operativo' },
      { tag: 'PU004', status: 'Operativo' },
      { tag: 'PU005', status: 'Operativo' },
      { tag: 'PU006', status: 'Operativo' },
      { tag: 'PU007', status: 'Operativo' },
      { tag: 'PU008', status: 'Operativo' }
    ],
    intermedia_pumps: [
      { tag: 'PU011', status: 'Operativo' },
      { tag: 'PU012', status: 'Operativo' },
      { tag: 'PU013', status: 'Operativo' },
      { tag: 'PU014', status: 'Operativo' },
      { tag: 'PU015', status: 'Operativo' },
      { tag: 'PU016', status: 'Operativo' }
    ],
    torre5_pumps: [
      { tag: 'PU021', status: 'Operativo' },
      { tag: 'PU022', status: 'Operativo' },
      { tag: 'PU023', status: 'Operativo' },
      { tag: 'PU024', status: 'Operativo' },
      { tag: 'PU025', status: 'Operativo' },
      { tag: 'PU026', status: 'Operativo' },
      { tag: 'PU027', status: 'Operativo' },
      { tag: 'PU028', status: 'Operativo' },
      { tag: 'PU029', status: 'Operativo' },
      { tag: 'PU030', status: 'Operativo' }
    ],
    levels: {
      orca: '',
      espejo: '',
      captacion: ''
    },
    main_indicators: {
      nivel_sentina: '',
      bombeo_turno_intermedia: '',
      nivel_tko02: '',
      aforador: '',
      cortafugas: '',
      ph_aforador: '',
      ph_cortafugas: '',
      h_embalas: '',
      dique_almacenamiento: '',
      drenaje_dique: '',
      agua_a_car: '',
      anticrustante: '',
      torre5_cortafugas: '',
      torre5_status1: 'Stand by',
      torre5_status2: 'Stand by'
    },
    pozas_sentina: [
      { poza: 'S-QCOR.R_02', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' },
      { poza: 'S-QCOR.R_03', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' }
    ],
    additional_obs: {
      notas: '',
      af_cantera: '',
      escorrentia: '',
      ph_c5_1: '',
      ph_c5_2: ''
    }
  };

  // Telemetry list
  pumps: PumpReport[] = [];
  selectedPump: PumpReport | null = null;
  updatedStatus: 'OPERATING' | 'STANDBY' | 'MAINTENANCE' | 'FAULT' = 'OPERATING';
  updatedNotes = '';

  newPump = {
    tag: 'PP-104',
    name: 'Bomba Slurry Alimentación Ciclones 04',
    system: 'ALIMENTACION_CICLONES',
    status: 'OPERATING' as const,
    flow_rate_m3h: 1820,
    pressure_bar: 4.7,
    rpm: 585,
    bearing_temp_c: 63.1,
    vibration_mms: 2.2,
    current_amps: 305,
    notes: 'Nueva bomba en línea'
  };

  get sentinaOperatingCount(): number {
    return this.sheet.sentina_pumps.filter(p => p.status === 'Operativo').length;
  }

  get intermediaOperatingCount(): number {
    return this.sheet.intermedia_pumps.filter(p => p.status === 'Operativo').length;
  }

  get torre5OperatingCount(): number {
    return this.sheet.torre5_pumps.filter(p => p.status === 'Operativo').length;
  }

  sanitizeSheetData(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') {
      const trimmed = obj.trim();
      if (trimmed === '---' || trimmed === 'n/d' || trimmed === 'null' || trimmed === 'undefined') {
        return '';
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeSheetData(item));
    }
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key of Object.keys(obj)) {
        sanitized[key] = this.sanitizeSheetData(obj[key]);
      }
      return sanitized;
    }
    return obj;
  }

  onFocusSelect(event: Event): void {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && typeof el.select === 'function') {
      el.select();
    }
  }

  ngOnInit(): void {
    const activeShift = getCurrentActiveShift().activeGuard.code;
    const assignedOp = this.crewService.getAssignedOperatorForPosition('BOMBAS', activeShift);
    this.sheet.shift_code = activeShift;
    const currentUser = this.authService.currentUser();
    if (assignedOp && assignedOp.name) {
      this.sheet.operator_name = assignedOp.name;
    } else if (currentUser?.fullName && currentUser?.role === 'OPERATOR') {
      this.sheet.operator_name = currentUser.fullName;
    } else {
      this.sheet.operator_name = '--- Vacante ---';
    }
    this.loadOperationalSheet();
    this.loadTelemetryPumps();
  }

  loadOperationalSheet(): void {
    const cached = getRealtimeData<any>('pump_sheet_' + this.sheet.report_date, null) || getRealtimeData<any>('pump_sheet_latest', null);
    if (cached) {
      this.sheet = this.sanitizeSheetData({ ...this.sheet, ...cached });
      if (this.sheet.shift_code === 'GUARDIA_A') this.sheet.shift_code = 'G1';
    }

    this.http.get<any>(`${getApiBaseUrl()}/pumps/operational-sheet?date=${this.sheet.report_date}`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.sheet = this.sanitizeSheetData({
            ...this.sheet,
            ...res.data,
            report_date: res.data.report_date || this.sheet.report_date
          });
          if (this.sheet.shift_code === 'GUARDIA_A') this.sheet.shift_code = 'G1';
          saveRealtimeData('pump_sheet_' + this.sheet.report_date, this.sheet);
          saveRealtimeData('pump_sheet_latest', this.sheet);
        }
      },
      error: () => {
        // Cached sheet remains active seamlessly with zero data loss
      }
    });
  }

  loadTelemetryPumps(): void {
    const cached = getRealtimeData<PumpReport[]>('pumps_telemetry', []);
    if (cached && cached.length > 0) {
      this.pumps = cached;
    }

    this.http.get<any>(`${getApiBaseUrl()}/pumps`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.pumps = res.data;
          saveRealtimeData('pumps_telemetry', this.pumps);
        }
      },
      error: () => {
        if (!this.pumps) {
          this.pumps = [];
        }
      }
    });
  }

  cycleStatus(pump: PumpStatusItem): void {
    const states: Array<'Operativo' | 'Stand by' | 'Mantenimiento' | 'Falla'> = ['Operativo', 'Stand by', 'Mantenimiento', 'Falla'];
    const idx = states.indexOf(pump.status);
    pump.status = states[(idx + 1) % states.length];
    this.onSheetChange();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Operativo': return 'status-operativo';
      case 'Stand by': return 'status-standby';
      case 'Mantenimiento': return 'status-mantenimiento';
      case 'Falla': return 'status-falla';
      default: return 'status-operativo';
    }
  }

  getTelemetryBadge(status: string): string {
    switch (status) {
      case 'OPERATING': return 'badge-success';
      case 'STANDBY': return 'badge-warning';
      case 'MAINTENANCE':
      case 'FAULT': return 'badge-danger';
      default: return 'badge-purple';
    }
  }

  onDateChange(): void {
    this.loadOperationalSheet();
  }

  onSheetChange(): void {
    // 1. Instant local persistence (zero latency)
    saveRealtimeData('pump_sheet_' + this.sheet.report_date, this.sheet);
    saveRealtimeData('pump_sheet_latest', this.sheet);

    // 2. Debounced automatic backend synchronization
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.isAutoSaving = true;
    this.autoSaveTimer = setTimeout(() => {
      this.executeAutoSave();
    }, 600);
  }

  executeAutoSave(): void {
    const payload = {
      ...this.sheet,
      report_date: this.sheet.report_date
    };
    saveRealtimeData('pump_sheet_' + this.sheet.report_date, payload);
    saveRealtimeData('pump_sheet_latest', payload);

    const endpoint = `${getApiBaseUrl()}/pumps/operational-sheet`;
    if (this.offlineSync.isOnline()) {
      this.http.post<any>(endpoint, payload).subscribe({
        next: () => {
          this.isAutoSaving = false;
          this.isSaving = false;
          this.lastAutoSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
        error: () => {
          this.offlineSync.queueAction(endpoint, 'POST', payload, 'Reporte Bombas ' + this.sheet.report_date);
          this.isAutoSaving = false;
          this.isSaving = false;
          this.lastAutoSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      });
    } else {
      this.offlineSync.queueAction(endpoint, 'POST', payload, 'Reporte Bombas ' + this.sheet.report_date);
      this.isAutoSaving = false;
      this.isSaving = false;
      this.lastAutoSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  cycleTorreStatus(which: 1 | 2): void {
    const states = ['Stand by', 'Operativo', 'Mantenimiento', 'Falla'];
    const current = which === 1 ? (this.sheet.main_indicators.torre5_status1 || 'Stand by') : (this.sheet.main_indicators.torre5_status2 || 'Stand by');
    const idx = states.indexOf(current);
    const next = states[(idx + 1) % states.length];
    if (which === 1) {
      this.sheet.main_indicators.torre5_status1 = next;
    } else {
      this.sheet.main_indicators.torre5_status2 = next;
    }
    this.onSheetChange();
  }

  showSaveSuccess(msg: string): void {
    this.saveSuccessMessage = msg;
    setTimeout(() => {
      if (this.saveSuccessMessage === msg) {
        this.saveSuccessMessage = '';
      }
    }, 4500);
  }

  openEditModal(): void {
    this.isEditModalOpen = true;
  }

  saveOperationalSheet(): void {
    this.executeAutoSave();
  }

  openCreatePumpModal(): void {
    this.isCreateModalOpen = true;
  }

  savePumpTelemetry(): void {
    const created: PumpReport = {
      id: 'pump-' + Date.now(),
      tag: this.newPump.tag,
      name: this.newPump.name,
      system: this.newPump.system,
      status: this.newPump.status,
      flow_rate_m3h: this.newPump.flow_rate_m3h,
      pressure_bar: this.newPump.pressure_bar,
      rpm: this.newPump.rpm,
      bearing_temp_c: this.newPump.bearing_temp_c,
      vibration_mms: this.newPump.vibration_mms,
      current_amps: this.newPump.current_amps,
      shift_code: this.sheet.shift_code || 'G1',
      operator_name: (this.authService.currentUser()?.role !== 'ADMIN' ? this.authService.currentUser()?.fullName : null) || (this.sheet.operator_name !== '--- Vacante ---' ? this.sheet.operator_name : null) || 'Operador de Turno',
      notes: this.newPump.notes,
      created_at: new Date().toISOString()
    };

    // Optimistic real-time storage
    this.pumps.unshift(created);
    saveRealtimeData('pumps_telemetry', this.pumps);
    this.isCreateModalOpen = false;

    const endpoint = `${getApiBaseUrl()}/pumps`;
    if (this.offlineSync.isOnline()) {
      this.http.post<any>(endpoint, this.newPump).subscribe({
        next: () => {
          this.loadTelemetryPumps();
        },
        error: () => {
          this.offlineSync.queueAction(endpoint, 'POST', this.newPump, 'Bomba ' + this.newPump.tag);
        }
      });
    } else {
      this.offlineSync.queueAction(endpoint, 'POST', this.newPump, 'Bomba ' + this.newPump.tag);
    }
  }

  openStatusModal(pump: PumpReport): void {
    this.selectedPump = pump;
    this.updatedStatus = pump.status;
    this.updatedNotes = pump.notes || '';
    this.isStatusModalOpen = true;
  }

  applyTelemetryStatusUpdate(): void {
    if (!this.selectedPump) return;

    this.selectedPump.status = this.updatedStatus;
    this.selectedPump.notes = this.updatedNotes;
    saveRealtimeData('pumps_telemetry', this.pumps);
    this.isStatusModalOpen = false;

    const payload = {
      status: this.updatedStatus,
      notes: this.updatedNotes
    };

    const endpoint = `${getApiBaseUrl()}/pumps/${this.selectedPump.id}/status`;
    this.http.patch<any>(endpoint, payload).subscribe({
      next: () => {
        this.loadTelemetryPumps();
      },
      error: () => {
        this.offlineSync.queueAction(endpoint, 'PATCH' as any, payload, `Estado Bomba ${this.selectedPump!.tag}`);
      }
    });
  }
}
