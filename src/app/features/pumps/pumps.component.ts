import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
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

export interface PumpShiftClosure {
  id: string;
  report_date: string;
  shift_code: string;
  operator_name: string;
  closed_by: string;
  sentina_operating: number;
  sentina_total: number;
  sentina_availability_pct: number;
  intermedia_operating: number;
  intermedia_total: number;
  intermedia_availability_pct: number;
  torre5_operating: number;
  torre5_total: number;
  torre5_availability_pct: number;
  overall_operating: number;
  overall_total: number;
  overall_availability_pct: number;
  ph_aforador?: number;
  ph_cortafugas?: number;
  bombeo_intermedia?: number;
  notes?: string;
  snapshot_json?: string;
  closed_at: string;
}

export interface ShiftHistorySummary {
  avg_sentina_pct: number;
  avg_intermedia_pct: number;
  avg_torre5_pct: number;
  avg_overall_pct: number;
  avg_ph_aforador: number;
  avg_ph_cortafugas: number;
  total_closures: number;
}

@Component({
  selector: 'app-pumps',
  changeDetection: ChangeDetectionStrategy.Eager,
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
            <button class="pill-btn" [class.active]="activeTab === 'HISTORY'" (click)="activeTab = 'HISTORY'; loadShiftHistory()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Historial de Promedios
              <span class="history-count-badge" *ngIf="shiftHistoryList.length > 0">{{ shiftHistoryList.length }}</span>
            </button>
          </div>

          <!-- Action Buttons -->
          <div class="actions-group">
            <button class="btn btn-emerald action-btn" (click)="openCloseShiftModal()" title="Cerrar formalmente el turno y registrar promedios de disponibilidad">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span class="btn-text">Cerrar Turno & Guardar Promedios</span>
            </button>
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
                <ng-container *ngIf="isAutoSaving">Guardando...</ng-container>
                <ng-container *ngIf="!isAutoSaving">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ lastAutoSavedTime ? 'Guardado ' + lastAutoSavedTime : 'Guardado automático' }}
                </ng-container>
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
              <span class="globe-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              </span>
              <h3>SECCIÓN A: REPORTE DE BOMBAS</h3>
            </div>
            <div class="header-right">
              <span class="date-label">FECHA:</span>
              <input type="date" class="date-input" [(ngModel)]="sheet.report_date" (change)="onDateChange()" />
            </div>
          </div>

          <!-- Mobile Station Filter Pills (Only visible on mobile screens) -->
          <div class="mobile-station-pills no-print">
            <button type="button" class="station-pill" [class.active]="mobileStationTab === 'ALL'" (click)="mobileStationTab = 'ALL'">
              Todas (Tabla &harr;)
            </button>
            <button type="button" class="station-pill" [class.active]="mobileStationTab === 'SENTINA'" (click)="mobileStationTab = 'SENTINA'">
              Sentina ({{ sentinaOperatingCount }}/8)
            </button>
            <button type="button" class="station-pill" [class.active]="mobileStationTab === 'INTERMEDIA'" (click)="mobileStationTab = 'INTERMEDIA'">
              Intermedia ({{ intermediaOperatingCount }}/6)
            </button>
            <button type="button" class="station-pill" [class.active]="mobileStationTab === 'TORRE5'" (click)="mobileStationTab = 'TORRE5'">
              Torre 5 ({{ torre5OperatingCount }}/10)
            </button>
          </div>

          <!-- Mobile Direct Station Cards View (Zero horizontal scrolling!) -->
          <div class="mobile-pumps-grid no-print" *ngIf="mobileStationTab !== 'ALL'">
            <div *ngFor="let pump of getMobileFilteredPumps()" class="mobile-pump-card" [class.operating]="pump.status === 'Operativo'">
              <div class="mobile-pump-info">
                <span class="mobile-pump-tag font-bold">{{ pump.tag }}</span>
                <span class="mobile-pump-sub">{{ getPumpStationName(pump.tag) }}</span>
              </div>
              <button class="status-badge-btn"
                      [ngClass]="getStatusClass(pump.status || 'Operativo')"
                      [class.is-locked]="isLockedByMaintenance(pump)"
                      (click)="cycleStatus(pump)"
                      [title]="isLockedByMaintenance(pump) ? 'Bloqueo: Requiere pase de Mantenimiento' : 'Click para cambiar estado'">
                <span *ngIf="isLockedByMaintenance(pump)" class="lock-icon-inline">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                {{ pump.status || 'Operativo' }}
              </button>
            </div>
          </div>

          <!-- Mobile Scroll Hint -->
          <div class="mobile-table-scroll-hint no-print" *ngIf="mobileStationTab === 'ALL'">
            <span>↔ Desliza la tabla horizontalmente para ver Intermedia y Torre 5</span>
          </div>

          <!-- 3-Column Pump Grid (Sentina, Intermedia, Torre 5) -->
          <div class="pumps-table-wrapper" [class.mobile-hidden]="mobileStationTab !== 'ALL'">
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
                            [ngClass]="getStatusClass(sheet.sentina_pumps[idx]?.status || 'Operativo')"
                            [class.is-locked]="isLockedByMaintenance(sheet.sentina_pumps[idx])"
                            (click)="cycleStatus(sheet.sentina_pumps[idx])"
                            [title]="isLockedByMaintenance(sheet.sentina_pumps[idx]) ? 'Bloqueo: Requiere pase de Mantenimiento' : 'Click para cambiar estado'">
                      <span *ngIf="isLockedByMaintenance(sheet.sentina_pumps[idx])" class="lock-icon-inline">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </span>
                      {{ sheet.sentina_pumps[idx]?.status || 'Operativo' }}
                    </button>
                  </td>

                  <!-- INTERMEDIA (PU011 - PU016) -->
                  <td class="cell-tag font-bold">
                    {{ sheet.intermedia_pumps[idx]?.tag || '' }}
                  </td>
                  <td class="cell-status">
                    <button *ngIf="sheet.intermedia_pumps[idx]" 
                            class="status-badge-btn" 
                            [ngClass]="getStatusClass(sheet.intermedia_pumps[idx]?.status || 'Operativo')"
                            [class.is-locked]="isLockedByMaintenance(sheet.intermedia_pumps[idx])"
                            (click)="cycleStatus(sheet.intermedia_pumps[idx])"
                            [title]="isLockedByMaintenance(sheet.intermedia_pumps[idx]) ? 'Bloqueo: Requiere pase de Mantenimiento' : 'Click para cambiar estado'">
                      <span *ngIf="isLockedByMaintenance(sheet.intermedia_pumps[idx])" class="lock-icon-inline">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </span>
                      {{ sheet.intermedia_pumps[idx]?.status || 'Operativo' }}
                    </button>
                  </td>

                  <!-- TORRE 5 (PU021 - PU030) -->
                  <td class="cell-tag font-bold">
                    {{ sheet.torre5_pumps[idx]?.tag || '' }}
                  </td>
                  <td class="cell-status">
                    <button *ngIf="sheet.torre5_pumps[idx]" 
                            class="status-badge-btn" 
                            [ngClass]="getStatusClass(sheet.torre5_pumps[idx]?.status || 'Operativo')"
                            [class.is-locked]="isLockedByMaintenance(sheet.torre5_pumps[idx])"
                            (click)="cycleStatus(sheet.torre5_pumps[idx])"
                            [title]="isLockedByMaintenance(sheet.torre5_pumps[idx]) ? 'Bloqueo: Requiere pase de Mantenimiento' : 'Click para cambiar estado'">
                      <span *ngIf="isLockedByMaintenance(sheet.torre5_pumps[idx])" class="lock-icon-inline">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </span>
                      {{ sheet.torre5_pumps[idx]?.status || 'Operativo' }}
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
            <span class="section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </span>
            <h4>SECCIÓN B: OBSERVACIONES DE NIVELES</h4>
            <span class="edit-badge-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Edición en Pantalla
            </span>
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
            <span class="section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </span>
            <h4>SECCIÓN C: INDICADORES PRINCIPALES</h4>
            <span class="edit-badge-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Edición en Pantalla
            </span>
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
            <span class="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              </svg>
            </span>
            <h4>SECCIÓN D: POZAS SENTINA</h4>
            <span class="edit-badge-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              Edición en Pantalla
            </span>
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
            <span class="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </span>
            <h4>SECCIÓN E: OBSERVACIONES ADICIONALES</h4>
            <span class="edit-badge-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              Edición en Pantalla
            </span>
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

      <!-- TAB 3: HISTORIAL DE CIERRE DE TURNO & PROMEDIOS DE DISPONIBILIDAD -->
      <div *ngIf="activeTab === 'HISTORY'" class="history-container no-print animate-fade-in">
        
        <!-- Summary KPI Grid -->
        <div class="history-hero-grid">
          <div class="h-kpi-card glass-panel">
            <div class="hkpi-icon sentina">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div class="hkpi-body">
              <span class="hkpi-label">DISP. PROMEDIO SENTINA</span>
              <div class="hkpi-val-row">
                <span class="hkpi-val sentina-val">{{ shiftHistorySummary.avg_sentina_pct | number:'1.1-1' }}%</span>
                <span class="hkpi-sub">8 Bombas (PU001-008)</span>
              </div>
            </div>
          </div>

          <div class="h-kpi-card glass-panel">
            <div class="hkpi-icon intermedia">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="hkpi-body">
              <span class="hkpi-label">DISP. PROMEDIO INTERMEDIA</span>
              <div class="hkpi-val-row">
                <span class="hkpi-val intermedia-val">{{ shiftHistorySummary.avg_intermedia_pct | number:'1.1-1' }}%</span>
                <span class="hkpi-sub">6 Bombas (PU011-016)</span>
              </div>
            </div>
          </div>

          <div class="h-kpi-card glass-panel">
            <div class="hkpi-icon torre">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 2l8 18H4L12 2z"></path>
              </svg>
            </div>
            <div class="hkpi-body">
              <span class="hkpi-label">DISP. PROMEDIO TORRE 5</span>
              <div class="hkpi-val-row">
                <span class="hkpi-val torre-val">{{ shiftHistorySummary.avg_torre5_pct | number:'1.1-1' }}%</span>
                <span class="hkpi-sub">10 Bombas (PU021-030)</span>
              </div>
            </div>
          </div>

          <div class="h-kpi-card glass-panel highlight-overall">
            <div class="hkpi-icon global">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <div class="hkpi-body">
              <span class="hkpi-label">DISPONIBILIDAD GLOBAL 24B</span>
              <div class="hkpi-val-row">
                <span class="hkpi-val global-val">{{ shiftHistorySummary.avg_overall_pct | number:'1.1-1' }}%</span>
                <span class="hkpi-sub">Meta Operacional: ≥ 85.0%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- History Filter & Controls Bar -->
        <div class="history-controls-card glass-panel">
          <div class="h-filters-left">
            <span class="h-filter-title">Filtros de Historial:</span>
            <div class="filter-group">
              <label>Guardia:</label>
              <select [(ngModel)]="historyFilterShift" (change)="loadShiftHistory()">
                <option value="ALL">Todas las guardias</option>
                <option value="G1">Guardia 1 (G1)</option>
                <option value="G2">Guardia 2 (G2)</option>
                <option value="G3">Guardia 3 (G3)</option>
                <option value="G4">Guardia 4 (G4)</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Fecha:</label>
              <input type="date" [(ngModel)]="historyFilterDate" (change)="loadShiftHistory()" />
            </div>
            <button *ngIf="historyFilterShift !== 'ALL' || historyFilterDate" class="btn-clear-hfilters" (click)="historyFilterShift = 'ALL'; historyFilterDate = ''; loadShiftHistory()" title="Limpiar filtros">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="h-controls-right">
            <span class="closures-count-tag">
              Turnos Cerrados: <strong>{{ shiftHistoryList.length }}</strong>
            </span>
            <button class="btn btn-secondary btn-sm" (click)="loadShiftHistory()" title="Refrescar historial">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Actualizar
            </button>
          </div>
        </div>

        <!-- History Table -->
        <div class="history-table-card glass-panel">
          <div class="table-responsive">
            <table class="history-table">
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>GUARDIA</th>
                  <th>RESPONSABLE</th>
                  <th>SENTINA (8)</th>
                  <th>INTERMEDIA (6)</th>
                  <th>TORRE 5 (10)</th>
                  <th>GLOBAL (24)</th>
                  <th>pH AFORADOR</th>
                  <th>pH CORTAFUGAS</th>
                  <th>BOMBEO INTERM.</th>
                  <th>OBSERVACIONES</th>
                  <th class="text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of shiftHistoryList" class="history-row">
                  <td class="font-bold text-nowrap">{{ item.report_date }}</td>
                  <td>
                    <span class="guard-chip">{{ item.shift_code }}</span>
                  </td>
                  <td class="text-nowrap">{{ item.operator_name || item.closed_by }}</td>
                  <td>
                    <div class="cell-avail">
                      <span class="avail-count">{{ item.sentina_operating }}/8</span>
                      <span class="avail-badge sentina">{{ item.sentina_availability_pct | number:'1.1-1' }}%</span>
                    </div>
                  </td>
                  <td>
                    <div class="cell-avail">
                      <span class="avail-count">{{ item.intermedia_operating }}/6</span>
                      <span class="avail-badge intermedia">{{ item.intermedia_availability_pct | number:'1.1-1' }}%</span>
                    </div>
                  </td>
                  <td>
                    <div class="cell-avail">
                      <span class="avail-count">{{ item.torre5_operating }}/10</span>
                      <span class="avail-badge torre">{{ item.torre5_availability_pct | number:'1.1-1' }}%</span>
                    </div>
                  </td>
                  <td>
                    <div class="cell-avail">
                      <span class="avail-count font-bold">{{ item.overall_operating }}/24</span>
                      <span class="avail-badge overall font-bold" [ngClass]="getAvailabilityBadgeClass(item.overall_availability_pct)">
                        {{ item.overall_availability_pct | number:'1.1-1' }}%
                      </span>
                    </div>
                  </td>
                  <td class="text-right font-mono">{{ item.ph_aforador ? (item.ph_aforador | number:'1.2-2') : '---' }}</td>
                  <td class="text-right font-mono">{{ item.ph_cortafugas ? (item.ph_cortafugas | number:'1.2-2') : '---' }}</td>
                  <td class="text-right font-mono">{{ item.bombeo_intermedia ? (item.bombeo_intermedia | number:'1.1-1') + ' m³' : '---' }}</td>
                  <td class="cell-obs" [title]="item.notes || ''">{{ item.notes || 'Sin observaciones registradas' }}</td>
                  <td class="text-center">
                    <button class="btn btn-secondary btn-xs action-btn-snapshot" (click)="viewClosureSnapshot(item)" title="Ver planilla completa al momento del cierre">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      Ver Detalle
                    </button>
                  </td>
                </tr>

                <tr *ngIf="shiftHistoryList.length === 0">
                  <td colspan="12" class="empty-history-cell">
                    <div class="empty-box">
                      <p>No se encontraron cierres de turno registrados en el historial para los filtros actuales.</p>
                      <button class="btn btn-emerald btn-sm" (click)="openCloseShiftModal()">
                        Cerrar Turno Actual Ahora
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- MODAL: CIERRE DE TURNO & GUARDADO DE PROMEDIOS -->
      <app-modal [isOpen]="isCloseShiftModalOpen" [title]="'Cierre Oficial de Turno - Estación de Bombas'" (close)="isCloseShiftModalOpen = false">
        <div class="close-shift-modal-body">
          <div class="shift-summary-banner">
            <div class="banner-field">
              <span class="bf-label">Fecha de Reporte</span>
              <span class="bf-val">{{ sheet.report_date }}</span>
            </div>
            <div class="banner-field">
              <span class="bf-label">Guardia Operativa</span>
              <span class="bf-val">{{ sheet.shift_code }}</span>
            </div>
            <div class="banner-field">
              <span class="bf-label">Operador Responsable</span>
              <span class="bf-val">{{ sheet.operator_name }}</span>
            </div>
          </div>

          <h4 class="modal-section-title">Promedios de Disponibilidad Calculados:</h4>
          
          <div class="modal-avail-grid">
            <div class="m-avail-card">
              <span class="m-label">Estación Sentina</span>
              <span class="m-count">{{ sentinaOperatingCount }} / 8 Bombas</span>
              <span class="m-pct sentina">{{ sentinaAvailabilityPct | number:'1.1-1' }}%</span>
            </div>
            <div class="m-avail-card">
              <span class="m-label">Estación Intermedia</span>
              <span class="m-count">{{ intermediaOperatingCount }} / 6 Bombas</span>
              <span class="m-pct intermedia">{{ intermediaAvailabilityPct | number:'1.1-1' }}%</span>
            </div>
            <div class="m-avail-card">
              <span class="m-label">Estación Torre 5</span>
              <span class="m-count">{{ torre5OperatingCount }} / 10 Bombas</span>
              <span class="m-pct torre">{{ torre5AvailabilityPct | number:'1.1-1' }}%</span>
            </div>
            <div class="m-avail-card highlight">
              <span class="m-label">Disponibilidad Global</span>
              <span class="m-count font-bold">{{ overallOperatingCount }} / 24 Bombas</span>
              <span class="m-pct overall" [ngClass]="getAvailabilityBadgeClass(overallAvailabilityPct)">{{ overallAvailabilityPct | number:'1.1-1' }}%</span>
            </div>
          </div>

          <!-- Secondary Physical-Chemical indicators preview -->
          <div class="modal-indicators-row">
            <div class="m-ind-item">
              <span class="mi-name">pH Aforador:</span>
              <span class="mi-val font-bold">{{ sheet.main_indicators.ph_aforador || '---' }}</span>
            </div>
            <div class="m-ind-item">
              <span class="mi-name">pH Cortafugas:</span>
              <span class="mi-val font-bold">{{ sheet.main_indicators.ph_cortafugas || '---' }}</span>
            </div>
            <div class="m-ind-item">
              <span class="mi-name">Bombeo Intermedia:</span>
              <span class="mi-val font-bold">{{ sheet.main_indicators.bombeo_turno_intermedia || '---' }} m³</span>
            </div>
          </div>

          <div class="form-group notes-group">
            <label>Observaciones de Entrega de Turno / Novedades Mecánicas:</label>
            <textarea rows="3" [(ngModel)]="closingNotes" placeholder="Indicar bombas en mantenimiento, condiciones de nivel o indicaciones para la guardia entrante..."></textarea>
          </div>

          <div class="modal-notice-banner">
            <span class="notice-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <p>Al confirmar el cierre, BASETRACK guardará el registro congelado de disponibilidad de las 24 bombas y parámetros físico-químicos en el historial permanente y notificará vía WebSocket a toda la planta.</p>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCloseShiftModalOpen = false" [disabled]="isClosingShift">
              Cancelar
            </button>
            <button type="button" class="btn btn-emerald" (click)="confirmCloseShift()" [disabled]="isClosingShift">
              <span *ngIf="isClosingShift">Cerrando Turno...</span>
              <span *ngIf="!isClosingShift" style="display:inline-flex;align-items:center;gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Confirmar y Cerrar Turno
              </span>
            </button>
          </div>
        </div>
      </app-modal>

      <!-- MODAL: DETALLE DE PLANILLA CONGELADA (SNAPSHOT) -->
      <app-modal [isOpen]="isSnapshotModalOpen" [title]="'Planilla Congelada al Cierre: ' + (selectedSnapshotClosure?.report_date || '') + ' (' + (selectedSnapshotClosure?.shift_code || '') + ')'" (close)="isSnapshotModalOpen = false">
        <div class="snapshot-modal-body" *ngIf="selectedSnapshotClosure">
          <div class="snapshot-header-row">
            <div>
              <span class="s-label">Fecha:</span> <strong>{{ selectedSnapshotClosure.report_date }}</strong>
              <span class="s-sep">|</span>
              <span class="s-label">Guardia:</span> <strong>{{ selectedSnapshotClosure.shift_code }}</strong>
              <span class="s-sep">|</span>
              <span class="s-label">Operador:</span> <strong>{{ selectedSnapshotClosure.operator_name }}</strong>
            </div>
            <span class="s-closed-at">Cerrado el: {{ selectedSnapshotClosure.closed_at }}</span>
          </div>

          <div class="snapshot-kpis-summary">
            <span class="sk-pill">Sentina: <strong>{{ selectedSnapshotClosure.sentina_operating }}/8 ({{ selectedSnapshotClosure.sentina_availability_pct }}%)</strong></span>
            <span class="sk-pill">Intermedia: <strong>{{ selectedSnapshotClosure.intermedia_operating }}/6 ({{ selectedSnapshotClosure.intermedia_availability_pct }}%)</strong></span>
            <span class="sk-pill">Torre 5: <strong>{{ selectedSnapshotClosure.torre5_operating }}/10 ({{ selectedSnapshotClosure.torre5_availability_pct }}%)</strong></span>
            <span class="sk-pill highlight">Global: <strong>{{ selectedSnapshotClosure.overall_operating }}/24 ({{ selectedSnapshotClosure.overall_availability_pct }}%)</strong></span>
          </div>

          <!-- Pumps Station Breakdown Grid -->
          <div class="snapshot-pumps-grid" *ngIf="selectedSnapshotData">
            <!-- Sentina -->
            <div class="station-snap-box">
              <h5>SENTINA (PU001-008)</h5>
              <div class="snap-pumps-list">
                <div *ngFor="let p of selectedSnapshotData.sentina_pumps" class="snap-pump-item" [ngClass]="getStatusClass(p.status)">
                  <span class="font-bold">{{ p.tag }}</span>
                  <span>{{ p.status }}</span>
                </div>
              </div>
            </div>

            <!-- Intermedia -->
            <div class="station-snap-box">
              <h5>INTERMEDIA (PU011-016)</h5>
              <div class="snap-pumps-list">
                <div *ngFor="let p of selectedSnapshotData.intermedia_pumps" class="snap-pump-item" [ngClass]="getStatusClass(p.status)">
                  <span class="font-bold">{{ p.tag }}</span>
                  <span>{{ p.status }}</span>
                </div>
              </div>
            </div>

            <!-- Torre 5 -->
            <div class="station-snap-box">
              <h5>TORRE 5 (PU021-030)</h5>
              <div class="snap-pumps-list">
                <div *ngFor="let p of selectedSnapshotData.torre5_pumps" class="snap-pump-item" [ngClass]="getStatusClass(p.status)">
                  <span class="font-bold">{{ p.tag }}</span>
                  <span>{{ p.status }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="snapshot-obs" *ngIf="selectedSnapshotClosure.notes">
            <strong>Observaciones de Turno:</strong>
            <p>{{ selectedSnapshotClosure.notes }}</p>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isSnapshotModalOpen = false">Cerrar</button>
          </div>
        </div>
      </app-modal>

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

      <!-- Modal: Bloqueo Operacional de Mantenimiento -->
      <app-modal [isOpen]="isLockModalOpen" [title]="'Bloqueo Operacional: Bomba ' + lockedPumpTag" (close)="isLockModalOpen = false">
        <div class="lock-modal-content">
          <div class="lock-alert-banner">
            <span class="alert-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </span>
            <div class="alert-text">
              <h4>Unidad bajo Custodia de Mantenimiento</h4>
              <p>La bomba <strong>{{ lockedPumpTag }}</strong> se encuentra actualmente en estado <strong>{{ lockedPumpStatus }}</strong>.</p>
            </div>
          </div>
          <div class="lock-details-box">
            <p><strong>Norma Operativa D.S. 024-2016-EM:</strong></p>
            <p>Por control de seguridad y procedimiento de bloqueo (LOTO), el Operador de Bombas no puede restablecer la unidad a <em>Operativo</em> directamente.</p>
            <p>El pase operativo debe ser emitido <strong>exclusivamente desde el Área de Mantenimiento</strong> tras culminar los trabajos mecánicos/eléctricos y resolver la Orden de Trabajo.</p>
          </div>
          <div class="modal-footer-actions">
            <button type="button" class="btn btn-secondary" (click)="isLockModalOpen = false">Cerrar</button>
            <button *ngIf="canDirectUnlock()" type="button" class="btn btn-warning" (click)="directUnlockPump()" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Pase Directo (Supervisor/Admin)
            </button>
            <button type="button" class="btn btn-primary" (click)="navigateToMaintenance()">Ir a Mantenimiento</button>
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
        /* En pantallas angostas el indicador de guardado pasa a otra línea en vez de salirse */
        flex-wrap: wrap;

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

      :host-context([data-theme="dark"]) .actions-group .autosave-badge,
      :host-context(.dark-theme) .actions-group .autosave-badge,
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
          width: 140px;
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

    /* Mobile Station Pills & Touch Cards */
    .mobile-station-pills {
      display: none;
      gap: 6px;
      margin-bottom: 12px;
      overflow-x: auto;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;

      @media (max-width: 768px) {
        display: flex;
      }

      .station-pill {
        white-space: nowrap;
        padding: 7px 12px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-subtle);
        background: var(--bg-card-subtle);
        color: var(--text-secondary);
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
        touch-action: manipulation;
        transition: var(--transition-smooth);

        &:active {
          transform: scale(0.95);
        }

        &.active {
          background: #031795;
          color: #ffffff;
          border-color: #031795;
          box-shadow: 0 2px 8px rgba(3, 23, 149, 0.25);
        }
      }
    }

    .mobile-pumps-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 16px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }

      @media (min-width: 769px) {
        display: none !important;
      }
    }

    .mobile-pump-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
      transition: var(--transition-smooth);

      &.operating {
        border-left: 4px solid #10b981;
      }

      .mobile-pump-info {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }

      .mobile-pump-tag {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }

      .mobile-pump-sub {
        font-size: 0.68rem;
        color: var(--text-muted);
      }

      .status-badge-btn {
        width: 100%;
        min-height: 40px;
        font-size: 0.85rem;
      }
    }

    @media (max-width: 768px) {
      .pumps-table-wrapper.mobile-hidden {
        display: none !important;
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

      &.is-locked {
        position: relative;
        cursor: not-allowed;
        box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.45);
      }

      .lock-icon-inline {
        margin-right: 4px;
        font-size: 0.72rem;
      }

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

    .lock-modal-content {
      padding: 10px 0;
      .lock-alert-banner {
        display: flex;
        align-items: center;
        gap: 14px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: var(--radius-md);
        padding: 14px 18px;
        margin-bottom: 16px;
        .alert-icon { font-size: 1.8rem; }
        .alert-text h4 { margin: 0 0 4px 0; color: #ef4444; font-size: 1rem; }
        .alert-text p { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }
      }
      .lock-details-box {
        background: var(--bg-surface-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: 14px 18px;
        margin-bottom: 20px;
        font-size: 0.88rem;
        line-height: 1.5;
        color: var(--text-secondary);
        p { margin: 0 0 8px 0; &:last-child { margin-bottom: 0; } }
      }
      .modal-footer-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
    }

    :host-context([data-theme="dark"]),
    :host-context(.dark-theme),
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

    /* TAB 3: HISTORIAL DE CIERRE DE TURNO & PROMEDIOS */
    .history-container {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .history-hero-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .h-kpi-card {
      padding: 18px 20px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      transition: var(--transition-smooth);

      &:hover {
        transform: translateY(-2px);
      }

      &.highlight-overall {
        border-left: 4px solid #10b981;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(3, 23, 149, 0.03) 100%);
      }

      .hkpi-icon {
        width: 46px;
        height: 46px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.sentina { background: rgba(56, 189, 248, 0.12); color: #0284c7; }
        &.intermedia { background: rgba(168, 85, 247, 0.12); color: #9333ea; }
        &.torre { background: rgba(245, 158, 11, 0.12); color: #d97706; }
        &.global { background: rgba(16, 185, 129, 0.14); color: #10b981; }
      }

      .hkpi-body {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .hkpi-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .hkpi-val-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;

          .hkpi-val {
            font-size: 1.45rem;
            font-weight: 800;
            letter-spacing: -0.02em;

            &.sentina-val { color: #0284c7; }
            &.intermedia-val { color: #9333ea; }
            &.torre-val { color: #d97706; }
            &.global-val { color: #10b981; }
          }

          .hkpi-sub {
            font-size: 0.72rem;
            color: var(--text-secondary);
            font-weight: 600;
          }
        }
      }
    }

    .history-controls-card {
      padding: 12px 18px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;

      .h-filters-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .h-filter-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 6px;

          label {
            font-size: 0.76rem;
            color: var(--text-muted);
            font-weight: 600;
          }

          select, input {
            padding: 6px 10px;
            font-size: 0.80rem;
            border-radius: var(--radius-sm);
            background: var(--bg-input);
            border: 1px solid var(--border-subtle);
            color: var(--text-primary);
          }
        }

        .btn-clear-hfilters {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            color: var(--danger);
            border-color: var(--danger);
          }
        }
      }

      .h-controls-right {
        display: flex;
        align-items: center;
        gap: 14px;

        .closures-count-tag {
          font-size: 0.80rem;
          color: var(--text-secondary);
          strong { color: var(--text-primary); }
        }
      }
    }

    .history-table-card {
      border-radius: var(--radius-lg);
      overflow: hidden;

      .history-table {
        width: 100%;
        min-width: 980px;
        border-collapse: collapse;
        font-size: 0.82rem;

        th {
          background: #031795;
          color: #ffffff;
          padding: 10px 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 0.76rem;
          white-space: nowrap;
        }

        td {
          padding: 8px 12px;
          border: 1px solid var(--border-subtle);
          vertical-align: middle;
          color: var(--text-primary);
          background: var(--bg-card);
        }

        tbody tr:nth-child(even) td {
          background: var(--bg-card-subtle);
        }

        tbody tr:hover td {
          background: var(--bg-card-hover);
        }

        .guard-chip {
          background: rgba(3, 23, 149, 0.08);
          color: #031795;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 0.74rem;
          border: 1px solid rgba(3, 23, 149, 0.2);
        }

        .cell-avail {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: flex-end;

          .avail-count {
            color: var(--text-muted);
            font-size: 0.75rem;
          }

          .avail-badge {
            font-size: 0.76rem;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: var(--radius-sm);

            &.sentina { background: rgba(2, 132, 199, 0.12); color: #0284c7; }
            &.intermedia { background: rgba(147, 51, 234, 0.12); color: #9333ea; }
            &.torre { background: rgba(217, 119, 6, 0.12); color: #d97706; }
            &.badge-emerald { background: rgba(16, 185, 129, 0.15); color: #059669; }
            &.badge-warning { background: rgba(245, 158, 11, 0.15); color: #d97706; }
            &.badge-danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
          }
        }

        .cell-obs {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-secondary);
          font-size: 0.78rem;
        }

        .action-btn-snapshot {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 0.75rem;
          border-radius: var(--radius-sm);
        }
      }
    }

    .empty-history-cell {
      padding: 36px !important;
      text-align: center;

      .empty-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: var(--text-muted);
      }
    }

    /* CLOSE SHIFT MODAL */
    .close-shift-modal-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .shift-summary-banner {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);

      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }

      .banner-field {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .bf-label {
          font-size: 0.70rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 700;
        }

        .bf-val {
          font-size: 0.90rem;
          font-weight: 800;
          color: var(--text-primary);
        }
      }
    }

    .modal-section-title {
      font-size: 0.88rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
    }

    .modal-avail-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr 1fr;
      }

      .m-avail-card {
        padding: 10px 12px;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 3px;

        &.highlight {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.08);
        }

        .m-label {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
        }

        .m-count {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .m-pct {
          font-size: 1.15rem;
          font-weight: 800;

          &.sentina { color: #0284c7; }
          &.intermedia { color: #9333ea; }
          &.torre { color: #d97706; }
          &.badge-emerald { color: #10b981; }
          &.badge-warning { color: #d97706; }
          &.badge-danger { color: #ef4444; }
        }
      }
    }

    .modal-indicators-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      background: var(--bg-card-subtle);
      border-radius: var(--radius-sm);
      font-size: 0.80rem;
      flex-wrap: wrap;

      .m-ind-item {
        display: flex;
        align-items: center;
        gap: 6px;

        .mi-name { color: var(--text-muted); font-weight: 600; }
        .mi-val { color: var(--text-primary); }
      }
    }

    .modal-notice-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      background: rgba(3, 23, 149, 0.06);
      border: 1px solid rgba(3, 23, 149, 0.2);
      border-radius: var(--radius-md);

      .notice-icon { font-size: 1.2rem; }
      p { margin: 0; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4; }
    }

    /* SNAPSHOT MODAL */
    .snapshot-modal-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .snapshot-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.82rem;
      color: var(--text-secondary);

      .s-sep { margin: 0 8px; color: var(--border-subtle); }
      .s-closed-at { font-size: 0.76rem; color: var(--text-muted); }
    }

    .snapshot-kpis-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      .sk-pill {
        padding: 4px 10px;
        background: var(--bg-card-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-full);
        font-size: 0.76rem;
        color: var(--text-secondary);

        &.highlight {
          border-color: #10b981;
          color: #059669;
          font-weight: 700;
        }
      }
    }

    .snapshot-pumps-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;

      @media (max-width: 650px) {
        grid-template-columns: 1fr;
      }

      .station-snap-box {
        background: var(--bg-card-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        padding: 12px;

        h5 {
          margin: 0 0 10px 0;
          font-size: 0.78rem;
          font-weight: 800;
          color: #031795;
          letter-spacing: 0.05em;
        }

        .snap-pumps-list {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .snap-pump-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 10px;
            border-radius: var(--radius-sm);
            font-size: 0.78rem;
            border: 1px solid var(--border-subtle);
            background: var(--bg-card);

            &.status-operativo { border-left: 3px solid #10b981; }
            &.status-standby { border-left: 3px solid #0284c7; }
            &.status-mantenimiento { border-left: 3px solid #f59e0b; }
            &.status-falla { border-left: 3px solid #ef4444; }
          }
        }
      }
    }

    .snapshot-obs {
      padding: 10px 14px;
      background: var(--bg-card-subtle);
      border-radius: var(--radius-sm);
      font-size: 0.80rem;
      p { margin: 4px 0 0 0; color: var(--text-secondary); }
    }

    .history-count-badge {
      background: var(--primary-purple);
      color: #ffffff;
      font-size: 0.68rem;
      padding: 1px 6px;
      border-radius: var(--radius-full);
      font-weight: 800;
      margin-left: 4px;
    }
  `]
})
export class PumpsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);
  private crewService = inject(CrewService);
  private authService = inject(AuthService);

  activeTab: 'REPORT' | 'TELEMETRY' | 'HISTORY' = 'REPORT';
  shiftHistoryList: PumpShiftClosure[] = [];
  shiftHistorySummary: ShiftHistorySummary = {
    avg_sentina_pct: 0,
    avg_intermedia_pct: 0,
    avg_torre5_pct: 0,
    avg_overall_pct: 0,
    avg_ph_aforador: 0,
    avg_ph_cortafugas: 0,
    total_closures: 0
  };
  isLoadingHistory = false;
  historyFilterShift = 'ALL';
  historyFilterDate = '';
  isCloseShiftModalOpen = false;
  isClosingShift = false;
  closingNotes = '';
  isSnapshotModalOpen = false;
  selectedSnapshotClosure: PumpShiftClosure | null = null;
  selectedSnapshotData: any = null;
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
  readonly DEFAULT_SENTINA_TAGS = ['PU001', 'PU002', 'PU003', 'PU004', 'PU005', 'PU006', 'PU007', 'PU008'];
  readonly DEFAULT_INTERMEDIA_TAGS = ['PU011', 'PU012', 'PU013', 'PU014', 'PU015', 'PU016'];
  readonly DEFAULT_TORRE5_TAGS = ['PU021', 'PU022', 'PU023', 'PU024', 'PU025', 'PU026', 'PU027', 'PU028', 'PU029', 'PU030'];

  lockedPumpTags = new Set<string>();

  sheet: PumpStationSheet = {
    report_date: getCurrentActiveShift().dateStr,
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

  get sentinaAvailabilityPct(): number {
    return Number(((this.sentinaOperatingCount / 8) * 100).toFixed(1));
  }

  get intermediaAvailabilityPct(): number {
    return Number(((this.intermediaOperatingCount / 6) * 100).toFixed(1));
  }

  get torre5AvailabilityPct(): number {
    return Number(((this.torre5OperatingCount / 10) * 100).toFixed(1));
  }

  get overallOperatingCount(): number {
    return this.sentinaOperatingCount + this.intermediaOperatingCount + this.torre5OperatingCount;
  }

  get overallAvailabilityPct(): number {
    return Number(((this.overallOperatingCount / 24) * 100).toFixed(1));
  }

  mobileStationTab: 'ALL' | 'SENTINA' | 'INTERMEDIA' | 'TORRE5' = 'ALL';

  getMobileFilteredPumps(): PumpStatusItem[] {
    if (this.mobileStationTab === 'SENTINA') return this.sheet.sentina_pumps || [];
    if (this.mobileStationTab === 'INTERMEDIA') return this.sheet.intermedia_pumps || [];
    if (this.mobileStationTab === 'TORRE5') return this.sheet.torre5_pumps || [];
    return [];
  }

  getPumpStationName(tag: string): string {
    if (!tag) return 'Bomba';
    if (tag.startsWith('PU00')) return 'Estación Sentina';
    if (tag.startsWith('PU01')) return 'Estación Intermedia';
    if (tag.startsWith('PU02')) return 'Estación Torre 5';
    return 'Estación Bombeo';
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

  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  isLockModalOpen = false;
  lockedPumpTag = '';
  lockedPumpStatus = '';
  isLocallyMutating = false;

  private normalizePumpList(
    existing: PumpStatusItem[] | undefined,
    defaultTags: string[]
  ): PumpStatusItem[] {
    const list: PumpStatusItem[] = [];
    const validStatuses = new Set(['Operativo', 'Stand by', 'Mantenimiento', 'Falla']);
    defaultTags.forEach(tag => {
      const found = Array.isArray(existing) ? existing.find(p => p && p.tag === tag) : undefined;
      const status = (found && validStatuses.has(found.status)) ? found.status : 'Operativo';
      list.push({ tag, status: status as any });
    });
    return list;
  }

  private applySheetData(data: any, targetDate: string, targetShift: string): void {
    if (!data) return;
    const sanitized = this.sanitizeSheetData(data);
    this.sheet = {
      ...this.sheet,
      ...sanitized,
      report_date: targetDate,
      shift_code: targetShift === 'GUARDIA_A' ? 'G1' : (sanitized.shift_code || targetShift),
      sentina_pumps: this.normalizePumpList(sanitized.sentina_pumps, this.DEFAULT_SENTINA_TAGS),
      intermedia_pumps: this.normalizePumpList(sanitized.intermedia_pumps, this.DEFAULT_INTERMEDIA_TAGS),
      torre5_pumps: this.normalizePumpList(sanitized.torre5_pumps, this.DEFAULT_TORRE5_TAGS),
      levels: { ...this.sheet.levels, ...(sanitized.levels || {}) },
      main_indicators: { ...this.sheet.main_indicators, ...(sanitized.main_indicators || {}) },
      pozas_sentina: Array.isArray(sanitized.pozas_sentina) && sanitized.pozas_sentina.length > 0 
        ? sanitized.pozas_sentina 
        : this.sheet.pozas_sentina,
      additional_obs: { ...this.sheet.additional_obs, ...(sanitized.additional_obs || {}) }
    };
  }

  updateLockedPumpTags(): void {
    try {
      const raw = getRealtimeData<any>('maintenance_tickets', []);
      const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
      const set = new Set<string>();
      for (const t of list) {
        if (t && t.equipment_tag && (t.status === 'PENDING' || t.status === 'IN_PROGRESS')) {
          set.add(String(t.equipment_tag).trim().toUpperCase());
        }
      }
      this.lockedPumpTags = set;
    } catch {
      this.lockedPumpTags = new Set<string>();
    }
  }

  loadMaintenanceTickets(): void {
    this.updateLockedPumpTags();
    this.http.get<any>(`${getApiBaseUrl()}/maintenance`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          saveRealtimeData('maintenance_tickets', res.data, { skipBroadcast: true });
          this.updateLockedPumpTags();
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        }
      },
      error: () => { }
    });
  }

  private syncListener = (e: any) => {
    // 1. If actively mutating or autosaving, ignore echo to prevent race conditions
    if (this.isLocallyMutating || this.isAutoSaving) {
      return;
    }

    // 2. Ignore local intra-tab pump sheet events emitted by this very component
    if (e.detail?.source === 'local') {
      return;
    }

    const ent = (e.detail?.entity || '').toLowerCase();
    const key = (e.detail?.key || '').toLowerCase();
    if (
      ent.includes('pump') ||
      ent.includes('bomba') ||
      ent.includes('maintenance') ||
      ent.includes('mantenimiento') ||
      key.includes('pump') ||
      key.includes('maintenance')
    ) {
      this.ngZone.run(() => {
        this.updateLockedPumpTags();
        this.loadOperationalSheet();
        this.loadTelemetryPumps();
        this.loadMaintenanceTickets();
        this.loadShiftHistory();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  };

  ngOnInit(): void {
    const activeShift = getCurrentActiveShift();
    this.sheet.shift_code = activeShift.activeGuard.code;
    this.sheet.report_date = activeShift.dateStr;
    const assignedOp = this.crewService.getAssignedOperatorForPosition('BOMBAS', activeShift.activeGuard.code);
    const currentUser = this.authService.currentUser();
    if (assignedOp && assignedOp.name) {
      this.sheet.operator_name = assignedOp.name;
    } else if (currentUser?.fullName && currentUser?.role === 'OPERATOR') {
      this.sheet.operator_name = currentUser.fullName;
    } else {
      this.sheet.operator_name = '--- Vacante ---';
    }
    this.updateLockedPumpTags();
    this.loadOperationalSheet();
    this.loadTelemetryPumps();
    this.loadMaintenanceTickets();
    this.loadShiftHistory();

    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  loadOperationalSheet(): void {
    const targetDate = this.sheet.report_date;
    const targetShift = this.sheet.shift_code;
    const cached = getRealtimeData<any>('pump_sheet_' + targetDate, null);
    if (cached) {
      this.applySheetData(cached, targetDate, targetShift);
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }

    this.http.get<any>(`${getApiBaseUrl()}/pumps/operational-sheet?date=${encodeURIComponent(targetDate)}&shift=${encodeURIComponent(targetShift)}`).subscribe({
      next: (res) => {
        if (this.isLocallyMutating || this.isAutoSaving) {
          return;
        }
        if (res.success && res.data) {
          this.applySheetData(res.data, targetDate, targetShift);
          saveRealtimeData('pump_sheet_' + targetDate, this.sheet, { skipBroadcast: true });
          saveRealtimeData('pump_sheet_latest', this.sheet, { skipBroadcast: true });
          this.cdr.markForCheck();
          this.cdr.detectChanges();
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
          saveRealtimeData('pumps_telemetry', this.pumps, { skipBroadcast: true });
        }
      },
      error: () => {
        if (!this.pumps) {
          this.pumps = [];
        }
      }
    });
  }

  isLockedByMaintenance(pump: PumpStatusItem | undefined | null): boolean {
    if (!pump || !pump.tag) return false;
    const status = pump.status;
    if (status !== 'Falla' && status !== 'Mantenimiento') return false;
    return this.lockedPumpTags.has(pump.tag.trim().toUpperCase());
  }

  canDirectUnlock(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'ADMIN' || role === 'SUPERVISOR';
  }

  directUnlockPump(): void {
    const tag = this.lockedPumpTag;
    if (!tag) return;

    ['sentina_pumps', 'intermedia_pumps', 'torre5_pumps'].forEach(arrKey => {
      const list = (this.sheet as any)[arrKey];
      if (Array.isArray(list)) {
        list.forEach((p: any) => {
          if (p && p.tag === tag) {
            p.status = 'Operativo';
          }
        });
      }
    });

    const raw = getRealtimeData<any>('maintenance_tickets', []);
    const tickets = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
    const resolvedTicketIds: string[] = [];
    tickets.forEach((t: any) => {
      if (t && t.equipment_tag === tag && (t.status === 'PENDING' || t.status === 'IN_PROGRESS')) {
        t.status = 'RESOLVED';
        t.operational_pass_by = this.authService.currentUser()?.fullName || 'Supervisor de Guardia';
        t.operational_pass_at = new Date().toISOString();
        t.resolution_notes = 'Pase Operativo Directo otorgado por Administración/Supervisión';
        resolvedTicketIds.push(t.id);
      }
    });
    saveRealtimeData('maintenance_tickets', tickets);
    this.updateLockedPumpTags();

    this.isLockModalOpen = false;
    this.onSheetChange();

    // Solo las OT del servidor (los borradores locales 'm-' no existen allí y darían 404)
    for (const ticketId of resolvedTicketIds.filter(id => !String(id).startsWith('m-'))) {
      this.http.patch<any>(`${getApiBaseUrl()}/maintenance/${ticketId}/status`, {
        status: 'RESOLVED',
        operational_pass_by: this.authService.currentUser()?.fullName || 'Supervisor de Guardia',
        resolution_notes: 'Pase Operativo Directo otorgado por Administración/Supervisión'
      }).subscribe();
    }
  }

  navigateToMaintenance(): void {
    this.isLockModalOpen = false;
    this.router.navigate(['/maintenance']);
  }

  private createLocalMaintenanceTicket(tag: string): void {
    const raw = getRealtimeData<any>('maintenance_tickets', []);
    const existing = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
    const hasActive = existing.some((t: any) => t && t.equipment_tag === tag && (t.status === 'PENDING' || t.status === 'IN_PROGRESS'));
    if (!hasActive) {
      // El correlativo real lo asigna el servidor; el borrador local nunca inventa un número de OT
      const ticketNum = 'OT-PENDIENTE';
      const newTicket = {
        id: 'm-' + Date.now(),
        ticket_number: ticketNum,
        equipment_tag: tag,
        title: `Falla reportada en Bomba ${tag}`,
        description: `Orden de trabajo generada automáticamente desde la Planilla de Bombas${this.sheet.operator_name ? ` por ${this.sheet.operator_name}` : ''}`,
        priority: 'HIGH',
        status: 'PENDING',
        requester_name: this.sheet.operator_name || 'Operador de Bombas',
        assigned_to: 'Equipo Mantenimiento Planta',
        photo_url: '',
        estimated_hours: 2,
        source_module: 'PUMPS_STATION',
        created_at: new Date().toISOString()
      };
      existing.unshift(newTicket);
      saveRealtimeData('maintenance_tickets', existing);
      this.updateLockedPumpTags();

      // Replicate immediately to backend API so SQLite and other clients receive it
      const endpoint = `${getApiBaseUrl()}/maintenance`;
      const payload = {
        equipment_tag: tag,
        title: newTicket.title,
        description: newTicket.description,
        priority: newTicket.priority,
        assigned_to: newTicket.assigned_to,
        photo_url: newTicket.photo_url,
        estimated_hours: newTicket.estimated_hours,
        requester_name: newTicket.requester_name,
        source_module: 'PUMPS_STATION'
      };

      if (this.offlineSync.isOnline()) {
        this.http.post<any>(endpoint, payload).subscribe({
          next: (res) => {
            // Reemplaza el borrador por la OT real para no duplicarla en Mantenimiento
            if (res?.id) {
              const current = getRealtimeData<any[]>('maintenance_tickets', []);
              const list = Array.isArray(current) ? current : [];
              saveRealtimeData('maintenance_tickets', list.map(t => t?.id === newTicket.id
                ? { ...t, id: res.id, ticket_number: res.ticketNumber || t.ticket_number }
                : t));
              this.updateLockedPumpTags();
            }
          },
          error: () => {
            this.offlineSync.queueAction(endpoint, 'POST', payload, 'OT Falla ' + tag);
          }
        });
      } else {
        this.offlineSync.queueAction(endpoint, 'POST', payload, 'OT Falla ' + tag);
      }
    }
  }

  cycleStatus(pump: PumpStatusItem): void {
    if (this.isLockedByMaintenance(pump)) {
      this.lockedPumpTag = pump.tag;
      this.lockedPumpStatus = pump.status;
      this.isLockModalOpen = true;
      return;
    }

    if (pump.status === 'Operativo') {
      pump.status = 'Stand by';
    } else if (pump.status === 'Stand by') {
      pump.status = 'Falla';
      this.createLocalMaintenanceTicket(pump.tag);
    } else {
      pump.status = 'Operativo';
    }

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
    this.isLocallyMutating = true;
    // 1. Instant local persistence (zero latency)
    saveRealtimeData('pump_sheet_' + this.sheet.report_date, this.sheet);
    saveRealtimeData('pump_sheet_latest', this.sheet);
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    // 2. Debounced automatic backend synchronization
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.isAutoSaving = true;
    this.autoSaveTimer = setTimeout(() => {
      this.executeAutoSave();
    }, 300);
  }

  executeAutoSave(): void {
    const payload = {
      ...this.sheet,
      report_date: this.sheet.report_date
    };
    saveRealtimeData('pump_sheet_' + this.sheet.report_date, payload, { skipBroadcast: true });
    saveRealtimeData('pump_sheet_latest', payload, { skipBroadcast: true });

    const endpoint = `${getApiBaseUrl()}/pumps/operational-sheet`;
    if (this.offlineSync.isOnline()) {
      this.http.post<any>(endpoint, payload).subscribe({
        next: () => {
          this.isAutoSaving = false;
          setTimeout(() => { this.isLocallyMutating = false; }, 300);
          this.isSaving = false;
          this.lastAutoSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
        error: () => {
          this.offlineSync.queueAction(endpoint, 'POST', payload, 'Reporte Bombas ' + this.sheet.report_date);
          this.isAutoSaving = false;
          setTimeout(() => { this.isLocallyMutating = false; }, 300);
          this.isSaving = false;
          this.lastAutoSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      });
    } else {
      this.offlineSync.queueAction(endpoint, 'POST', payload, 'Reporte Bombas ' + this.sheet.report_date);
      this.isAutoSaving = false;
      setTimeout(() => { this.isLocallyMutating = false; }, 300);
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

  loadShiftHistory(): void {
    this.isLoadingHistory = true;
    let url = `${getApiBaseUrl()}/pumps/shift-history?limit=30`;
    if (this.historyFilterShift && this.historyFilterShift !== 'ALL') {
      url += `&shift=${encodeURIComponent(this.historyFilterShift)}`;
    }
    if (this.historyFilterDate) {
      url += `&date=${encodeURIComponent(this.historyFilterDate)}`;
    }

    const cached = getRealtimeData<any>('pump_shift_history', null);
    if (cached && Array.isArray(cached.data)) {
      this.shiftHistoryList = cached.data;
      if (cached.summary) this.shiftHistorySummary = cached.summary;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.isLoadingHistory = false;
        if (res.success) {
          this.shiftHistoryList = res.data || [];
          if (res.summary) {
            this.shiftHistorySummary = res.summary;
          }
          saveRealtimeData('pump_shift_history', res, { skipBroadcast: true });
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.isLoadingHistory = false;
      }
    });
  }

  openCloseShiftModal(): void {
    this.closingNotes = '';
    this.isCloseShiftModalOpen = true;
  }

  confirmCloseShift(): void {
    this.isClosingShift = true;
    const payload = {
      ...this.sheet,
      notes: this.closingNotes
    };

    const endpoint = `${getApiBaseUrl()}/pumps/shift-closure`;
    this.http.post<any>(endpoint, payload).subscribe({
      next: (res) => {
        this.isClosingShift = false;
        this.isCloseShiftModalOpen = false;
        this.showSaveSuccess(`Turno cerrado formalmente. Disponibilidad global registrada: ${this.overallAvailabilityPct}%`);
        this.loadShiftHistory();
        this.activeTab = 'HISTORY';
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isClosingShift = false;
        const msg = err?.error?.message || 'Error al cerrar turno en el servidor';
        alert(msg);
      }
    });
  }

  viewClosureSnapshot(closure: PumpShiftClosure): void {
    this.selectedSnapshotClosure = closure;
    try {
      this.selectedSnapshotData = closure.snapshot_json ? JSON.parse(closure.snapshot_json) : null;
    } catch {
      this.selectedSnapshotData = null;
    }
    this.isSnapshotModalOpen = true;
  }

  getAvailabilityBadgeClass(pct: number): string {
    if (pct >= 85) return 'badge-emerald';
    if (pct >= 70) return 'badge-warning';
    return 'badge-danger';
  }
}

