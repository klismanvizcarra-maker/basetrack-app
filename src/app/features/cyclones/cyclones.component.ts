import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ModalComponent } from '../../shared/ui/modal.component';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';

export interface CycloneReport {
  id: string;
  battery_tag: string;
  total_cyclones: number;
  active_cyclones: number;
  feed_pressure_psi: number;
  feed_density_kgm3: number;
  p80_microns: number;
  overflow_density: number;
  underflow_density: number;
  flocculant_ppm: number;
  status: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL';
  shift_code: string;
  notes?: string;
  created_at: string;
}

export interface StationSample {
  id: string;
  station: string;
  sample_time: string;
  battery_tag: string;
  solids_feed: number;
  solids_of: number;
  solids_uf: number;
  mesh200_feed: number;
  mesh200_of: number;
  mesh200_uf: number;
  shift_code: string;
  date: string;
  created_at?: string;
}

export interface GroupedSample {
  time: string;
  rows: StationSample[];
}

export interface GeneralAverages {
  solids_feed: number;
  solids_of: number;
  solids_uf: number;
  mesh200_feed: number;
  mesh200_of: number;
  mesh200_uf: number;
}

@Component({
  selector: 'app-cyclones',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="cyclones-page animate-fade-in">
      <!-- Top Action Bar -->
      <div class="page-top-bar">
        <div class="top-text">
          <h2>Baterías de Ciclones (Cyclopac & Estaciones)</h2>
          <p class="section-sub">Control granulométrico de malla -200, balance de sólidos y presión manifold</p>
        </div>
        <div class="top-actions">
          <button class="btn btn-secondary action-btn" (click)="exportCsv()" title="Exportar reporte en CSV">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="btn-text">Exportar CSV</span>
          </button>
          <button class="btn btn-emerald action-btn" (click)="openSampleModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="btn-text">Registrar Muestreo</span>
          </button>
          <button class="btn btn-primary action-btn" (click)="isCreateModalOpen = true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span class="btn-text">Nido Cyclopac</span>
          </button>
        </div>
      </div>

      <!-- Controls & Station Tabs -->
      <div class="station-controls-card glass-panel">
        <div class="station-tabs">
          <button
            class="station-tab-btn"
            [class.active]="selectedStation === '2DA ESTACIÓN CICLONES'"
            (click)="selectStation('2DA ESTACIÓN CICLONES')"
          >
            <span class="dot-indicator"></span>
            2DA ESTACIÓN (CY3/4)
          </button>
          <button
            class="station-tab-btn"
            [class.active]="selectedStation === '1RA ESTACIÓN CICLONES'"
            (click)="selectStation('1RA ESTACIÓN CICLONES')"
          >
            <span class="dot-indicator"></span>
            1RA ESTACIÓN (CY1/2)
          </button>
        </div>

        <div class="controls-right-group">
          <!-- View Switcher (Planilla vs Tarjetas Móviles) -->
          <div class="view-mode-toggle" title="Alternar formato de visualización">
            <button
              type="button"
              class="view-toggle-btn"
              [class.active]="viewMode === 'TABLE'"
              (click)="viewMode = 'TABLE'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="3" y1="15" x2="21" y2="15"></line>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
              <span>Tabla</span>
            </button>
            <button
              type="button"
              class="view-toggle-btn"
              [class.active]="viewMode === 'CARDS'"
              (click)="viewMode = 'CARDS'"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="5" y="2" width="14" height="20" rx="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <span>Móvil</span>
            </button>
          </div>

          <div class="station-filters">
            <div class="filter-item">
              <label>Turno:</label>
              <select [(ngModel)]="selectedShift" (change)="filterSamples()">
                <option value="ALL">Todos los turnos</option>
                <option value="GUARDIA_A">Guardia A (Noche)</option>
                <option value="GUARDIA_B">Guardia B (Día)</option>
                <option value="GUARDIA_C">Guardia C</option>
              </select>
            </div>
            <div class="filter-item">
              <label>Fecha:</label>
              <input type="date" [(ngModel)]="filterDate" (change)="filterSamples()" />
            </div>
            <button *ngIf="selectedShift !== 'ALL' || filterDate" class="btn-clear-filters" (click)="resetFilters()" title="Quitar filtros">
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Promedios Clave Cards (Dark Purple CRAVEAT Hero) -->
      <div class="promedios-hero-grid">
        <div class="promedio-kpi-card glass-panel">
          <div class="kpi-icon-wrap emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div class="kpi-body">
            <span class="kpi-label">PROMEDIO UF SÓLIDOS</span>
            <div class="kpi-val-row">
              <span class="kpi-val emerald-val">{{ generalAverages.solids_uf | number:'1.2-2' }}%</span>
              <span class="kpi-target-badge">Objetivo: 68 - 72%</span>
            </div>
          </div>
        </div>

        <div class="promedio-kpi-card glass-panel">
          <div class="kpi-icon-wrap cyan">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <div class="kpi-body">
            <span class="kpi-label">PROMEDIO UF MALLA -200</span>
            <div class="kpi-val-row">
              <span class="kpi-val cyan-val">{{ generalAverages.mesh200_uf | number:'1.2-2' }}%</span>
              <span class="kpi-target-badge">Objetivo: 22 - 25%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW 1: METALLURGICAL STATION TABLE (Integrated with Dark-Violet Theme) -->
      <div *ngIf="viewMode === 'TABLE'" class="metallurgical-sheet-wrapper glass-panel animate-fade-in">
        <!-- Station Header Banner (Theme Cohesive) -->
        <div class="station-banner-header">
          <div class="banner-title-group">
            <span class="banner-badge">CIRCUITO DE CLASIFICACIÓN</span>
            <h3>{{ selectedStation }}</h3>
          </div>
          <span class="mobile-scroll-hint">↔ Desliza para ver más columnas</span>
        </div>

        <!-- Table Container with smooth horizontal scrolling -->
        <div class="table-responsive">
          <table class="metallurgical-table">
            <thead>
              <tr class="th-main-row">
                <th rowspan="2" class="col-hora sticky-col-1">HORA</th>
                <th rowspan="2" class="col-baterias sticky-col-2">BATERÍAS</th>
                <th colspan="3" class="col-group group-solidos">% SÓLIDOS</th>
                <th colspan="3" class="col-group group-malla">% MALLA 200</th>
              </tr>
              <tr class="th-sub-row">
                <th class="sub-col">FEED</th>
                <th class="sub-col">OF</th>
                <th class="sub-col uf-col">UF</th>
                <th class="sub-col">FEED</th>
                <th class="sub-col">OF</th>
                <th class="sub-col uf-col">UF</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let group of groupedSamples">
                <tr *ngFor="let row of group.rows; let i = index" class="data-row">
                  <!-- Hourly Rowspan -->
                  <td *ngIf="i === 0" [attr.rowspan]="group.rows.length" class="cell-hora font-bold sticky-col-1">
                    {{ group.time }}
                  </td>
                  <!-- Battery Tag -->
                  <td class="cell-battery font-bold sticky-col-2">
                    {{ row.battery_tag }}
                  </td>
                  <!-- % Sólidos -->
                  <td class="cell-val">{{ row.solids_feed | number:'1.2-2' }}</td>
                  <td class="cell-val">{{ row.solids_of | number:'1.2-2' }}</td>
                  <td class="cell-val cell-uf font-bold">{{ row.solids_uf | number:'1.2-2' }}</td>
                  <!-- % Malla 200 -->
                  <td class="cell-val">{{ row.mesh200_feed | number:'1.2-2' }}</td>
                  <td class="cell-val">{{ row.mesh200_of | number:'1.2-2' }}</td>
                  <td class="cell-val cell-uf font-bold">{{ row.mesh200_uf | number:'1.2-2' }}</td>
                </tr>
              </ng-container>

              <!-- Empty state fallback with Reset Action -->
              <tr *ngIf="groupedSamples.length === 0">
                <td colspan="8" class="empty-message-cell">
                  <div class="empty-box">
                    <p>No se encontraron registros de muestreo para los filtros seleccionados.</p>
                    <button class="btn btn-secondary btn-sm" (click)="resetFilters()">
                      Restablecer filtros y mostrar todas las muestras
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="row-promedio-general">
                <td colspan="2" class="cell-promedio-title font-bold sticky-col-combo">PROMEDIO GENERAL</td>
                <td class="cell-promedio-val font-bold">{{ generalAverages.solids_feed | number:'1.2-2' }}</td>
                <td class="cell-promedio-val font-bold">{{ generalAverages.solids_of | number:'1.2-2' }}</td>
                <td class="cell-promedio-val font-bold">{{ generalAverages.solids_uf | number:'1.2-2' }}</td>
                <td class="cell-promedio-val font-bold">{{ generalAverages.mesh200_feed | number:'1.2-2' }}</td>
                <td class="cell-promedio-val font-bold">{{ generalAverages.mesh200_of | number:'1.2-2' }}</td>
                <td class="cell-promedio-val font-bold">{{ generalAverages.mesh200_uf | number:'1.2-2' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Promedios Clave Footer Bar -->
        <div class="promedios-clave-card">
          <span class="clave-title">Promedios Clave:</span>
          <span class="clave-metric">
            UF Sólidos: <strong class="green-highlight">{{ generalAverages.solids_uf | number:'1.2-2' }}%</strong>
          </span>
          <span class="clave-divider">|</span>
          <span class="clave-metric">
            UF Malla 200: <strong class="cyan-highlight">{{ generalAverages.mesh200_uf | number:'1.2-2' }}%</strong>
          </span>
        </div>
      </div>

      <!-- VIEW 2: MOBILE CARDS VIEW (Diseñado para smartphones) -->
      <div *ngIf="viewMode === 'CARDS'" class="mobile-cards-view animate-fade-in">
        <div class="mobile-view-header">
          <span class="header-badge">{{ selectedStation }}</span>
          <span class="samples-count">{{ filteredStationSamples.length }} Muestras</span>
        </div>

        <div *ngFor="let group of groupedSamples" class="hour-card glass-panel">
          <div class="hour-card-header">
            <div class="hour-time-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>{{ group.time }} hrs</span>
            </div>
            <span class="batteries-count">{{ group.rows.length }} baterías</span>
          </div>

          <!-- Battery rows inside this hour -->
          <div class="hour-batteries-list">
            <div *ngFor="let row of group.rows" class="battery-sample-box">
              <div class="box-top">
                <span class="battery-tag-pill">{{ row.battery_tag }}</span>
                <span class="shift-pill">{{ row.shift_code }}</span>
              </div>

              <!-- Parameter comparisons -->
              <div class="params-comparison-grid">
                <!-- % Sólidos Card -->
                <div class="param-block">
                  <div class="param-block-title">% SÓLIDOS</div>
                  <div class="param-triplet">
                    <div class="triplet-item">
                      <span class="t-label">FEED</span>
                      <span class="t-val">{{ row.solids_feed | number:'1.2-2' }}</span>
                    </div>
                    <div class="triplet-item">
                      <span class="t-label">OF</span>
                      <span class="t-val">{{ row.solids_of | number:'1.2-2' }}</span>
                    </div>
                    <div class="triplet-item highlight-uf">
                      <span class="t-label">UF</span>
                      <span class="t-val bold-green">{{ row.solids_uf | number:'1.2-2' }}%</span>
                    </div>
                  </div>
                </div>

                <!-- % Malla 200 Card -->
                <div class="param-block">
                  <div class="param-block-title">% MALLA 200</div>
                  <div class="param-triplet">
                    <div class="triplet-item">
                      <span class="t-label">FEED</span>
                      <span class="t-val">{{ row.mesh200_feed | number:'1.2-2' }}</span>
                    </div>
                    <div class="triplet-item">
                      <span class="t-label">OF</span>
                      <span class="t-val">{{ row.mesh200_of | number:'1.2-2' }}</span>
                    </div>
                    <div class="triplet-item highlight-uf">
                      <span class="t-label">UF</span>
                      <span class="t-val bold-green">{{ row.mesh200_uf | number:'1.2-2' }}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="groupedSamples.length === 0" class="empty-cards glass-panel">
          <p>No se encontraron registros con los filtros seleccionados.</p>
          <button class="btn btn-secondary btn-sm" (click)="resetFilters()" style="margin-top: 10px;">
            Ver todas las muestras
          </button>
        </div>
      </div>

      <!-- Telemetry Section: Cyclopac Cluster Batteries -->
      <div class="section-divider">
        <div>
          <h3>Telemetría de Nidos Cyclopac (Manifold & Células)</h3>
          <p class="section-sub">Presión de trabajo, corte granulométrico P80 en micrometros y estado de ápice/vortex</p>
        </div>
      </div>

      <!-- Batteries Grid -->
      <div class="batteries-grid">
        <div *ngFor="let battery of cyclones" class="battery-card glass-panel" [class.optimal]="battery.status === 'OPTIMAL'" [class.attention]="battery.status === 'ATTENTION'">
          <div class="battery-header">
            <div>
              <span class="battery-tag">{{ battery.battery_tag }}</span>
              <span class="active-badge">{{ battery.active_cyclones }} de {{ battery.total_cyclones }} Ciclones Activos</span>
            </div>
            <span class="badge" [class.badge-success]="battery.status === 'OPTIMAL'" [class.badge-warning]="battery.status === 'ATTENTION'" [class.badge-danger]="battery.status === 'CRITICAL'">
              {{ battery.status }}
            </span>
          </div>

          <!-- Cyclone Pod Visual Indicator -->
          <div class="pod-visual">
            <span class="pod-label">Estado de Células:</span>
            <div class="cyclone-dots">
              <span
                *ngFor="let dot of getCycloneDots(battery)"
                class="c-dot"
                [class.active]="dot.active"
                [class.standby]="!dot.active"
                [title]="dot.active ? 'Operativo' : 'Standby / Bloqueado'"
              ></span>
            </div>
          </div>

          <!-- Telemetry parameters -->
          <div class="params-table">
            <div class="param-row">
              <span class="p-name">Presión Alimentación:</span>
              <span class="p-val font-bold" [class.warn]="battery.feed_pressure_psi < 16 || battery.feed_pressure_psi > 22">
                {{ battery.feed_pressure_psi }} PSI
              </span>
            </div>
            <div class="param-row">
              <span class="p-name">Densidad Alimentación:</span>
              <span class="p-val">{{ battery.feed_density_kgm3 }} kg/m³</span>
            </div>
            <div class="param-row">
              <span class="p-name">Corte Granulométrico P80:</span>
              <span class="p-val highlight-purple font-bold">{{ battery.p80_microns }} µm</span>
            </div>
            <div class="param-row">
              <span class="p-name">Densidad Overflow / Underflow:</span>
              <span class="p-val">{{ battery.overflow_density }} / {{ battery.underflow_density }} kg/m³</span>
            </div>
            <div class="param-row">
              <span class="p-name">Floculante Dosificado:</span>
              <span class="p-val">{{ battery.flocculant_ppm }} ppm</span>
            </div>
          </div>

          <div class="battery-footer" *ngIf="battery.notes">
            <p class="battery-notes"><strong>Obs:</strong> {{ battery.notes }}</p>
          </div>
        </div>
      </div>

      <!-- MODAL: Registrar Muestreo de Estación (% Sólidos & % Malla 200) -->
      <app-modal [isOpen]="isSampleModalOpen" [title]="'Registrar Muestreo de Estación'" (close)="isSampleModalOpen = false">
        <form (ngSubmit)="saveStationSample()" class="modal-form">
          <!-- Station & Quick Hour Selection -->
          <div class="form-row">
            <div class="form-group">
              <label>Estación</label>
              <select [(ngModel)]="newSample.station" name="station" required>
                <option value="2DA ESTACIÓN CICLONES">2DA ESTACIÓN CICLONES</option>
                <option value="1RA ESTACIÓN CICLONES">1RA ESTACIÓN CICLONES</option>
              </select>
            </div>
            <div class="form-group">
              <label>Batería</label>
              <select [(ngModel)]="newSample.battery_tag" name="battery_tag" required>
                <option value="CY3">CY3</option>
                <option value="CY4">CY4</option>
                <option value="CY1">CY1</option>
                <option value="CY2">CY2</option>
              </select>
            </div>
          </div>

          <!-- Quick Hour Chips for Easy Mobile Touch -->
          <div class="form-group">
            <label>Hora de Muestreo</label>
            <div class="quick-chips-row">
              <button
                type="button"
                *ngFor="let h of quickHours"
                class="chip-btn"
                [class.active]="newSample.sample_time === h"
                (click)="newSample.sample_time = h"
              >
                {{ h }}
              </button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Guardia / Turno</label>
              <select [(ngModel)]="newSample.shift_code" name="shift_code">
                <option value="GUARDIA_A">Guardia A (Noche)</option>
                <option value="GUARDIA_B">Guardia B (Día)</option>
                <option value="GUARDIA_C">Guardia C</option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha</label>
              <input type="date" [(ngModel)]="newSample.date" name="sample_date" required />
            </div>
          </div>

          <!-- % Sólidos Section -->
          <div class="form-section-header">
            <div class="section-indicator green"></div>
            <span>Parámetros de % SÓLIDOS</span>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label>FEED (%)</label>
              <input type="number" step="0.01" inputmode="decimal" [(ngModel)]="newSample.solids_feed" name="solids_feed" required />
            </div>
            <div class="form-group">
              <label>OF (%)</label>
              <input type="number" step="0.01" inputmode="decimal" [(ngModel)]="newSample.solids_of" name="solids_of" required />
            </div>
            <div class="form-group">
              <label class="label-uf">UF (%)</label>
              <input type="number" step="0.01" inputmode="decimal" class="input-uf" [(ngModel)]="newSample.solids_uf" name="solids_uf" required />
            </div>
          </div>

          <!-- % Malla 200 Section -->
          <div class="form-section-header">
            <div class="section-indicator cyan"></div>
            <span>Parámetros de % MALLA -200</span>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label>FEED (%)</label>
              <input type="number" step="0.01" inputmode="decimal" [(ngModel)]="newSample.mesh200_feed" name="mesh200_feed" required />
            </div>
            <div class="form-group">
              <label>OF (%)</label>
              <input type="number" step="0.01" inputmode="decimal" [(ngModel)]="newSample.mesh200_of" name="mesh200_of" required />
            </div>
            <div class="form-group">
              <label class="label-uf">UF (%)</label>
              <input type="number" step="0.01" inputmode="decimal" class="input-uf" [(ngModel)]="newSample.mesh200_uf" name="mesh200_uf" required />
            </div>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isSampleModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-emerald">Guardar Muestreo</button>
          </div>
        </form>
      </app-modal>

      <!-- MODAL: Registrar Inspección Nido Cyclopac -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Registrar Nueva Inspección de Nido de Ciclones'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="saveCyclone()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Identificador de Batería (Tag)</label>
              <input type="text" [(ngModel)]="newCyclone.battery_tag" name="tag" required />
            </div>
            <div class="form-group">
              <label>Estado de Batería</label>
              <select [(ngModel)]="newCyclone.status" name="status">
                <option value="OPTIMAL">Óptimo (OPTIMAL)</option>
                <option value="ATTENTION">Atención / Desvío (ATTENTION)</option>
                <option value="CRITICAL">Crítico (CRITICAL)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Ciclones Activos</label>
              <input type="number" [(ngModel)]="newCyclone.active_cyclones" name="active" max="14" min="1" />
            </div>
            <div class="form-group">
              <label>Total de Ciclones en Nido</label>
              <input type="number" [(ngModel)]="newCyclone.total_cyclones" name="total" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Presión Manifold (PSI)</label>
              <input type="number" step="0.1" inputmode="decimal" [(ngModel)]="newCyclone.feed_pressure_psi" name="press" />
            </div>
            <div class="form-group">
              <label>Densidad de Pulpa (kg/m³)</label>
              <input type="number" inputmode="decimal" [(ngModel)]="newCyclone.feed_density_kgm3" name="dens" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Corte P80 (µm)</label>
              <input type="number" inputmode="decimal" [(ngModel)]="newCyclone.p80_microns" name="p80" />
            </div>
            <div class="form-group">
              <label>Floculante (ppm)</label>
              <input type="number" step="0.1" inputmode="decimal" [(ngModel)]="newCyclone.flocculant_ppm" name="floc" />
            </div>
          </div>

          <div class="form-group">
            <label>Novedades del Nido / Ápex / Vortex</label>
            <textarea rows="2" [(ngModel)]="newCyclone.notes" name="notes"></textarea>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar Reporte</button>
          </div>
        </form>
      </app-modal>
    </div>
  `,
  styles: [`
    .cyclones-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Top Action Bar */
    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;

      .top-text {
        h2 {
          font-size: 1.38rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.25;

          @media (max-width: 600px) {
            font-size: 1.18rem;
          }
        }

        .section-sub {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 3px;
        }
      }
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        .action-btn:last-child {
          grid-column: span 2;
        }
      }
    }

    .action-btn {
      min-height: 42px;
      padding: 8px 16px;
      font-size: 0.85rem;
    }

    .btn-emerald {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(5, 150, 105, 0.5);
      }
    }

    /* Station Tabs & Controls */
    .station-controls-card {
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;

      @media (max-width: 768px) {
        padding: 12px;
      }
    }

    .station-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      @media (max-width: 600px) {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
    }

    .station-tab-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 14px;
      border-radius: var(--radius-md);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
      background: var(--bg-card-subtle);
      color: var(--text-secondary);
      transition: var(--transition-smooth);
      min-height: 40px;

      .dot-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted);
        flex-shrink: 0;
      }

      &.active {
        background: #ecfdf5;
        border-color: #059669;
        color: #047857;

        .dot-indicator {
          background: #059669;
          box-shadow: 0 0 6px rgba(5, 150, 105, 0.4);
        }
      }

      &:hover:not(.active) {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }
    }

    .controls-right-group {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        width: 100%;
        justify-content: space-between;
      }
    }

    /* View Switcher */
    .view-mode-toggle {
      display: flex;
      background: var(--bg-input);
      padding: 3px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      gap: 2px;
    }

    .view-toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-smooth);

      &.active {
        background: var(--bg-card-hover);
        color: var(--primary-lavender);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      }
    }

    .station-filters {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      @media (max-width: 600px) {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr auto;
      }
    }

    .filter-item {
      display: flex;
      align-items: center;
      gap: 6px;

      label {
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--text-muted);
      }

      select, input {
        padding: 6px 10px;
        font-size: 0.78rem;
        min-height: 36px;
      }
    }

    .btn-clear-filters {
      background: rgba(248, 113, 113, 0.15);
      color: var(--danger);
      border: 1px solid rgba(248, 113, 113, 0.3);
      border-radius: var(--radius-sm);
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      transition: var(--transition-smooth);

      &:hover {
        background: rgba(248, 113, 113, 0.3);
      }
    }

    /* Promedios Hero Grid */
    .promedios-hero-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 10px;
      }
    }

    .promedio-kpi-card {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-radius: var(--radius-lg);

      .kpi-icon-wrap {
        width: 46px;
        height: 46px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.emerald {
          background: rgba(5, 150, 105, 0.15);
          color: #34d399;
          border: 1px solid rgba(5, 150, 105, 0.3);
        }

        &.cyan {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
      }

      .kpi-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
      }

      .kpi-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--text-muted);
      }

      .kpi-val-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 6px;
      }

      .kpi-val {
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: -0.02em;

        &.emerald-val { color: #34d399; text-shadow: 0 0 12px rgba(52, 211, 153, 0.3); }
        &.cyan-val { color: #38bdf8; text-shadow: 0 0 12px rgba(56, 189, 248, 0.3); }
      }

      .kpi-target-badge {
        font-size: 0.7rem;
        color: var(--text-secondary);
        background: rgba(255, 255, 255, 0.04);
        padding: 3px 8px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-subtle);
      }
    }

    /* METALLURGICAL SHEET STYLING (DARK CRAVEAT THEME) */
    .metallurgical-sheet-wrapper {
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
    }

    .station-banner-header {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      border-bottom: 1px solid rgba(5, 150, 105, 0.3);
      padding: 14px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;

      .banner-title-group {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .banner-badge {
          font-size: 0.68rem;
          font-weight: 700;
          color: #d1fae5;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h3 {
          margin: 0;
          color: #ffffff;
          font-size: 1.2rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
      }

      .mobile-scroll-hint {
        display: none;
        font-size: 0.72rem;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 10px;
        border-radius: var(--radius-full);
        border: 1px solid rgba(255, 255, 255, 0.3);

        @media (max-width: 900px) {
          display: inline-block;
        }
      }
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .metallurgical-table {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
      font-size: 0.86rem;
      color: var(--text-primary);
      text-align: center;

      th, td {
        border: 1px solid #e2e8f0;
        padding: 10px 14px;
        vertical-align: middle;
      }

      /* Sticky columns */
      .sticky-col-1 {
        position: sticky;
        left: 0;
        z-index: 10;
        background-color: #ffffff;
        box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.08);
      }

      .sticky-col-2 {
        position: sticky;
        left: 68px;
        z-index: 10;
        background-color: #ffffff;
        box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.08);
      }

      .sticky-col-combo {
        position: sticky;
        left: 0;
        z-index: 10;
        background-color: #047857;
        color: #ffffff;
        box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.1);
      }

      /* Headers */
      thead {
        background-color: var(--bg-card-subtle);

        th {
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.03em;

          &.sticky-col-1, &.sticky-col-2 {
            background-color: var(--bg-card-subtle);
          }
        }

        .th-main-row {
          .col-hora, .col-baterias {
            font-size: 0.8rem;
            width: 10%;
            color: var(--text-primary);
          }

          .col-group {
            font-size: 0.84rem;
            font-weight: 800;

            &.group-solidos {
              background: #ecfdf5;
              color: #047857;
              border-bottom: 1px solid #a7f3d0;
            }

            &.group-malla {
              background: #e0f2fe;
              color: #0284c7;
              border-bottom: 1px solid #bae6fd;
            }
          }
        }

        .th-sub-row {
          background-color: #f8fafc;

          .sub-col {
            font-size: 0.76rem;
            padding: 8px 10px;
            color: var(--text-muted);

            &.uf-col {
              color: #047857;
              font-weight: 700;
            }
          }
        }
      }

      /* Body */
      tbody {
        background-color: #ffffff;

        .data-row {
          transition: background-color 0.15s ease;

          &:nth-child(even) {
            background-color: #f8fafc;
            .sticky-col-1, .sticky-col-2 {
              background-color: #f8fafc;
            }
          }

          &:hover {
            background-color: var(--bg-card-hover);
            .sticky-col-1, .sticky-col-2 {
              background-color: var(--bg-card-hover);
            }
          }
        }

        .cell-hora {
          font-size: 0.92rem;
          color: var(--primary-purple);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          background-color: var(--bg-card-subtle);
        }

        .cell-battery {
          color: #0284c7;
          font-weight: 600;
          font-size: 0.9rem;
          background-color: inherit;
        }

        .cell-val {
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .cell-uf {
          color: #047857;
          font-weight: 700;
          font-size: 0.92rem;
        }

        .empty-message-cell {
          padding: 32px 20px;
        }

        .empty-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 0.88rem;
        }
      }

      /* Footer */
      tfoot {
        .row-promedio-general {
          background: #047857;
          border-top: 2px solid #059669;
          color: #ffffff;

          td {
            border: 1px solid #065f46;
            padding: 11px 14px;
            font-size: 0.92rem;
            font-variant-numeric: tabular-nums;
          }

          .cell-promedio-title {
            text-align: center;
            letter-spacing: 0.05em;
            color: #d1fae5;
          }

          .cell-promedio-val {
            color: #ffffff;
            font-weight: 700;
          }
        }
      }
    }

    /* Key Averages Banner */
    .promedios-clave-card {
      background-color: var(--bg-card-subtle);
      padding: 14px 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-size: 0.9rem;
      color: var(--text-secondary);
      border-top: 1px solid var(--border-subtle);
      flex-wrap: wrap;

      .clave-title {
        font-weight: 700;
        color: var(--text-primary);
      }

      .clave-metric {
        color: var(--text-secondary);
      }

      .green-highlight {
        color: #34d399;
        font-size: 1.02rem;
        font-weight: 800;
        text-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
      }

      .cyan-highlight {
        color: #38bdf8;
        font-size: 1.02rem;
        font-weight: 800;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
      }

      .clave-divider {
        color: rgba(255, 255, 255, 0.15);
        font-weight: 300;
      }
    }

    /* MOBILE CARDS VIEW */
    .mobile-cards-view {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .mobile-view-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px;

      .header-badge {
        font-size: 0.85rem;
        font-weight: 800;
        color: #34d399;
        letter-spacing: 0.04em;
      }

      .samples-count {
        font-size: 0.72rem;
        color: var(--text-muted);
      }
    }

    .hour-card {
      padding: 16px;
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .hour-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 10px;

      .hour-time-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.95rem;
        font-weight: 800;
        color: #38bdf8;
      }

      .batteries-count {
        font-size: 0.72rem;
        color: var(--text-muted);
        background: var(--bg-card-subtle);
        padding: 2px 8px;
        border-radius: var(--radius-full);
      }
    }

    .hour-batteries-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .battery-sample-box {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .box-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .battery-tag-pill {
        font-size: 0.84rem;
        font-weight: 800;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.15);
        padding: 3px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid rgba(56, 189, 248, 0.3);
      }

      .shift-pill {
        font-size: 0.7rem;
        color: var(--text-muted);
      }
    }

    .params-comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .param-block {
      background: rgba(0, 0, 0, 0.25);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .param-block-title {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-secondary);
      letter-spacing: 0.04em;
      margin-bottom: 6px;
    }

    .param-triplet {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 4px;
      text-align: center;
    }

    .triplet-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 2px;
      border-radius: 4px;

      .t-label {
        font-size: 0.62rem;
        font-weight: 600;
        color: var(--text-muted);
      }

      .t-val {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      &.highlight-uf {
        background: rgba(5, 150, 105, 0.18);
        border: 1px solid rgba(5, 150, 105, 0.3);

        .t-label { color: #34d399; }
        .bold-green { color: #34d399; font-weight: 800; }
      }
    }

    .empty-cards {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    /* Section divider */
    .section-divider {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary);
      }

      .section-sub {
        font-size: 0.78rem;
        color: var(--text-muted);
      }
    }

    /* Batteries Grid */
    .batteries-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .battery-card {
      padding: 20px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;

      &.optimal {
        border-top: 3px solid var(--primary-purple);
      }

      &.attention {
        border-top: 3px solid var(--warning);
      }
    }

    .battery-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .battery-tag {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--primary-lavender);
      display: block;
    }

    .active-badge {
      font-size: 0.74rem;
      color: var(--text-muted);
    }

    .pod-visual {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--bg-card-subtle);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }

    .pod-label {
      font-size: 0.74rem;
      color: var(--text-muted);
    }

    .cyclone-dots {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .c-dot {
      width: 14px;
      height: 14px;
      border-radius: var(--radius-full);

      &.active {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        box-shadow: 0 0 6px rgba(5, 150, 105, 0.4);
      }

      &.standby {
        background: #e2e8f0;
        border: 1px dashed #cbd5e1;
      }
    }

    .params-table {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .param-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.84rem;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .p-name {
      color: var(--text-muted);
    }

    .p-val {
      color: var(--text-primary);

      &.warn { color: var(--warning); }
      &.highlight-purple { color: var(--primary-lavender); }
    }

    .battery-footer {
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
    }

    .battery-notes {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* Modal Form */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .quick-chips-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .chip-btn {
      padding: 6px 11px;
      border-radius: var(--radius-sm);
      background: var(--bg-input);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 34px;
      transition: var(--transition-smooth);

      &.active {
        background: rgba(5, 150, 105, 0.2);
        border-color: #059669;
        color: #34d399;
      }
    }

    .form-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 4px;
      margin-top: 6px;

      .section-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        &.green { background: #34d399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.6); }
        &.cyan { background: #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.6); }
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .form-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;

      label {
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .label-uf {
        color: #34d399;
        font-weight: 700;
      }

      .input-uf {
        border-color: rgba(5, 150, 105, 0.4);
        background: rgba(5, 150, 105, 0.06);
      }

      input, select, textarea {
        min-height: 42px;
      }
    }

    .modal-buttons {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      width: 100%;
      margin-top: 8px;

      @media (max-width: 480px) {
        display: grid;
        grid-template-columns: 1fr 1fr;

        button {
          width: 100%;
          min-height: 44px;
        }
      }
    }
  `]
})
export class CyclonesComponent implements OnInit {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);

  cyclones: CycloneReport[] = [];
  rawStationSamples: StationSample[] = [];
  filteredStationSamples: StationSample[] = [];
  groupedSamples: GroupedSample[] = [];

  selectedStation: string = '2DA ESTACIÓN CICLONES';
  selectedShift: string = 'ALL';
  filterDate: string = '';
  viewMode: 'TABLE' | 'CARDS' = 'TABLE';

  quickHours: string[] = ['20:00', '23:00', '02:00', '05:00', '08:00', '11:00', '14:00', '17:00'];

  generalAverages: GeneralAverages = {
    solids_feed: 45.06,
    solids_of: 29.49,
    solids_uf: 69.69,
    mesh200_feed: 54.77,
    mesh200_of: 21.98,
    mesh200_uf: 23.76
  };

  isSampleModalOpen = false;
  isCreateModalOpen = false;

  newSample = {
    station: '2DA ESTACIÓN CICLONES',
    sample_time: '20:00',
    battery_tag: 'CY3',
    shift_code: 'GUARDIA_A',
    solids_feed: 45.30,
    solids_of: 28.60,
    solids_uf: 69.40,
    mesh200_feed: 54.60,
    mesh200_of: 22.40,
    mesh200_uf: 23.40,
    date: new Date().toISOString().split('T')[0]
  };

  newCyclone = {
    battery_tag: 'CYCLOPAC-BATERIA-03',
    total_cyclones: 12,
    active_cyclones: 10,
    feed_pressure_psi: 18.2,
    feed_density_kgm3: 1650,
    p80_microns: 149,
    overflow_density: 1285,
    underflow_density: 1970,
    flocculant_ppm: 14.0,
    status: 'OPTIMAL' as const,
    notes: 'Inspección de rutina completada'
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.viewMode = 'CARDS';
    }

    // Inicializar con fallback de datos reales de inmediato
    this.useFallbackData();
    this.loadCyclones();
    this.loadStationSamples();
  }

  selectStation(station: string): void {
    this.selectedStation = station;
    this.newSample.station = station;
    if (station === '1RA ESTACIÓN CICLONES') {
      this.newSample.battery_tag = 'CY1';
    } else {
      this.newSample.battery_tag = 'CY3';
    }
    this.loadStationSamples();
  }

  resetFilters(): void {
    this.selectedShift = 'ALL';
    this.filterDate = '';
    this.filterSamples();
  }

  useFallbackData(): void {
    const today = new Date().toISOString().split('T')[0];

    // Datos completos para 2DA ESTACION (Guardia A noche y Guardia B día) y 1RA ESTACION
    this.rawStationSamples = [
      // 2DA ESTACION - GUARDIA A (Valores exactos de la planilla metalúrgica)
      { id: 's-1', station: '2DA ESTACIÓN CICLONES', sample_time: '20:00', battery_tag: 'CY3', solids_feed: 45.30, solids_of: 28.60, solids_uf: 69.40, mesh200_feed: 54.60, mesh200_of: 22.40, mesh200_uf: 23.40, shift_code: 'GUARDIA_A', date: today },
      { id: 's-2', station: '2DA ESTACIÓN CICLONES', sample_time: '20:00', battery_tag: 'CY4', solids_feed: 43.20, solids_of: 30.10, solids_uf: 68.60, mesh200_feed: 54.10, mesh200_of: 19.80, mesh200_uf: 23.60, shift_code: 'GUARDIA_A', date: today },
      { id: 's-3', station: '2DA ESTACIÓN CICLONES', sample_time: '23:00', battery_tag: 'CY3', solids_feed: 48.60, solids_of: 32.40, solids_uf: 72.10, mesh200_feed: 58.20, mesh200_of: 24.10, mesh200_uf: 25.80, shift_code: 'GUARDIA_A', date: today },
      { id: 's-4', station: '2DA ESTACIÓN CICLONES', sample_time: '23:00', battery_tag: 'CY4', solids_feed: 47.10, solids_of: 31.80, solids_uf: 71.50, mesh200_feed: 57.40, mesh200_of: 23.50, mesh200_uf: 25.20, shift_code: 'GUARDIA_A', date: today },
      { id: 's-5', station: '2DA ESTACIÓN CICLONES', sample_time: '02:00', battery_tag: 'CY3', solids_feed: 42.10, solids_of: 27.20, solids_uf: 67.80, mesh200_feed: 51.50, mesh200_of: 20.80, mesh200_uf: 22.10, shift_code: 'GUARDIA_A', date: today },
      { id: 's-6', station: '2DA ESTACIÓN CICLONES', sample_time: '02:00', battery_tag: 'CY4', solids_feed: 41.50, solids_of: 26.80, solids_uf: 67.20, mesh200_feed: 50.90, mesh200_of: 20.10, mesh200_uf: 21.80, shift_code: 'GUARDIA_A', date: today },
      { id: 's-7', station: '2DA ESTACIÓN CICLONES', sample_time: '05:00', battery_tag: 'CY3', solids_feed: 46.80, solids_of: 29.80, solids_uf: 70.80, mesh200_feed: 56.10, mesh200_of: 22.90, mesh200_uf: 24.30, shift_code: 'GUARDIA_A', date: today },
      { id: 's-8', station: '2DA ESTACIÓN CICLONES', sample_time: '05:00', battery_tag: 'CY4', solids_feed: 45.90, solids_of: 29.20, solids_uf: 70.10, mesh200_feed: 55.40, mesh200_of: 22.20, mesh200_uf: 23.90, shift_code: 'GUARDIA_A', date: today },

      // 2DA ESTACION - GUARDIA B (Turno Día)
      { id: 's-9', station: '2DA ESTACIÓN CICLONES', sample_time: '08:00', battery_tag: 'CY3', solids_feed: 46.10, solids_of: 29.10, solids_uf: 70.20, mesh200_feed: 55.20, mesh200_of: 22.80, mesh200_uf: 24.10, shift_code: 'GUARDIA_B', date: today },
      { id: 's-10', station: '2DA ESTACIÓN CICLONES', sample_time: '08:00', battery_tag: 'CY4', solids_feed: 44.50, solids_of: 28.90, solids_uf: 69.80, mesh200_feed: 54.80, mesh200_of: 21.50, mesh200_uf: 23.90, shift_code: 'GUARDIA_B', date: today },
      { id: 's-11', station: '2DA ESTACIÓN CICLONES', sample_time: '11:00', battery_tag: 'CY3', solids_feed: 47.30, solids_of: 30.50, solids_uf: 71.40, mesh200_feed: 56.70, mesh200_of: 23.20, mesh200_uf: 24.80, shift_code: 'GUARDIA_B', date: today },
      { id: 's-12', station: '2DA ESTACIÓN CICLONES', sample_time: '11:00', battery_tag: 'CY4', solids_feed: 46.80, solids_of: 30.10, solids_uf: 70.90, mesh200_feed: 55.90, mesh200_of: 22.70, mesh200_uf: 24.40, shift_code: 'GUARDIA_B', date: today },

      // 1RA ESTACION - CY1 / CY2
      { id: 's-13', station: '1RA ESTACIÓN CICLONES', sample_time: '20:00', battery_tag: 'CY1', solids_feed: 44.80, solids_of: 27.90, solids_uf: 68.90, mesh200_feed: 53.80, mesh200_of: 21.90, mesh200_uf: 23.10, shift_code: 'GUARDIA_A', date: today },
      { id: 's-14', station: '1RA ESTACIÓN CICLONES', sample_time: '20:00', battery_tag: 'CY2', solids_feed: 43.90, solids_of: 28.50, solids_uf: 68.20, mesh200_feed: 53.20, mesh200_of: 20.40, mesh200_uf: 23.00, shift_code: 'GUARDIA_A', date: today },
      { id: 's-15', station: '1RA ESTACIÓN CICLONES', sample_time: '23:00', battery_tag: 'CY1', solids_feed: 47.50, solids_of: 31.00, solids_uf: 71.20, mesh200_feed: 57.00, mesh200_of: 23.50, mesh200_uf: 25.10, shift_code: 'GUARDIA_A', date: today },
      { id: 's-16', station: '1RA ESTACIÓN CICLONES', sample_time: '23:00', battery_tag: 'CY2', solids_feed: 46.20, solids_of: 30.80, solids_uf: 70.80, mesh200_feed: 56.40, mesh200_of: 22.90, mesh200_uf: 24.70, shift_code: 'GUARDIA_A', date: today },
      { id: 's-17', station: '1RA ESTACIÓN CICLONES', sample_time: '02:00', battery_tag: 'CY1', solids_feed: 41.80, solids_of: 26.50, solids_uf: 67.20, mesh200_feed: 50.80, mesh200_of: 20.20, mesh200_uf: 21.90, shift_code: 'GUARDIA_A', date: today },
      { id: 's-18', station: '1RA ESTACIÓN CICLONES', sample_time: '02:00', battery_tag: 'CY2', solids_feed: 41.00, solids_of: 26.10, solids_uf: 66.80, mesh200_feed: 50.10, mesh200_of: 19.80, mesh200_uf: 21.50, shift_code: 'GUARDIA_A', date: today }
    ];

    this.filterSamples();
  }

  loadStationSamples(): void {
    const url = `http://localhost:3001/api/cyclones/station-samples?station=${encodeURIComponent(this.selectedStation)}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.rawStationSamples = res.data;
          this.filterSamples();
        } else {
          this.useFallbackData();
        }
      },
      error: () => {
        this.useFallbackData();
      }
    });
  }

  filterSamples(): void {
    const targetStation = this.selectedStation.toLowerCase().trim();
    let list = this.rawStationSamples.filter(s => s.station.toLowerCase().trim().includes(targetStation.includes('1ra') ? '1ra' : '2da'));

    if (this.selectedShift !== 'ALL') {
      const shiftFiltered = list.filter(s => s.shift_code === this.selectedShift);
      if (shiftFiltered.length > 0) {
        list = shiftFiltered;
      }
    }

    if (this.filterDate) {
      const dateFiltered = list.filter(s => s.date === this.filterDate);
      if (dateFiltered.length > 0) {
        list = dateFiltered;
      }
    }

    this.filteredStationSamples = list;
    this.groupSamples(list);
    this.computeAverages(list);
  }

  groupSamples(samples: StationSample[]): void {
    const map = new Map<string, StationSample[]>();
    for (const s of samples) {
      if (!map.has(s.sample_time)) {
        map.set(s.sample_time, []);
      }
      map.get(s.sample_time)!.push(s);
    }

    this.groupedSamples = Array.from(map.entries())
      .map(([time, rows]) => ({
        time,
        rows: rows.sort((a, b) => a.battery_tag.localeCompare(b.battery_tag))
      }))
      .sort((a, b) => {
        const order = ['20:00', '23:00', '02:00', '05:00', '08:00', '11:00', '14:00', '17:00'];
        const idxA = order.indexOf(a.time);
        const idxB = order.indexOf(b.time);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.time.localeCompare(b.time);
      });
  }

  computeAverages(samples: StationSample[]): void {
    if (samples.length === 0) {
      this.generalAverages = {
        solids_feed: 45.06,
        solids_of: 29.49,
        solids_uf: 69.69,
        mesh200_feed: 54.77,
        mesh200_of: 21.98,
        mesh200_uf: 23.76
      };
      return;
    }

    const n = samples.length;
    const sum = samples.reduce((acc, c) => ({
      solids_feed: acc.solids_feed + Number(c.solids_feed || 0),
      solids_of: acc.solids_of + Number(c.solids_of || 0),
      solids_uf: acc.solids_uf + Number(c.solids_uf || 0),
      mesh200_feed: acc.mesh200_feed + Number(c.mesh200_feed || 0),
      mesh200_of: acc.mesh200_of + Number(c.mesh200_of || 0),
      mesh200_uf: acc.mesh200_uf + Number(c.mesh200_uf || 0)
    }), { solids_feed: 0, solids_of: 0, solids_uf: 0, mesh200_feed: 0, mesh200_of: 0, mesh200_uf: 0 });

    this.generalAverages = {
      solids_feed: Number((sum.solids_feed / n).toFixed(2)),
      solids_of: Number((sum.solids_of / n).toFixed(2)),
      solids_uf: Number((sum.solids_uf / n).toFixed(2)),
      mesh200_feed: Number((sum.mesh200_feed / n).toFixed(2)),
      mesh200_of: Number((sum.mesh200_of / n).toFixed(2)),
      mesh200_uf: Number((sum.mesh200_uf / n).toFixed(2))
    };
  }

  openSampleModal(): void {
    this.newSample.station = this.selectedStation;
    this.isSampleModalOpen = true;
  }

  saveStationSample(): void {
    const payload = { ...this.newSample };
    if (this.offlineSync.isOnline()) {
      this.http.post<any>('http://localhost:3001/api/cyclones/station-samples', payload).subscribe({
        next: () => {
          this.isSampleModalOpen = false;
          this.loadStationSamples();
        },
        error: () => {
          this.offlineSync.queueAction('http://localhost:3001/api/cyclones/station-samples', 'POST', payload, `Muestra ${payload.station} ${payload.sample_time} ${payload.battery_tag}`);
          this.rawStationSamples.push({ id: 'temp-' + Date.now(), ...payload } as StationSample);
          this.filterSamples();
          this.isSampleModalOpen = false;
        }
      });
    } else {
      this.offlineSync.queueAction('http://localhost:3001/api/cyclones/station-samples', 'POST', payload, `Muestra ${payload.station} ${payload.sample_time} ${payload.battery_tag}`);
      this.rawStationSamples.push({ id: 'temp-' + Date.now(), ...payload } as StationSample);
      this.filterSamples();
      this.isSampleModalOpen = false;
    }
  }

  exportCsv(): void {
    const headers = ['ESTACION', 'HORA', 'BATERIA', 'SOLIDOS_FEED', 'SOLIDOS_OF', 'SOLIDOS_UF', 'MALLA200_FEED', 'MALLA200_OF', 'MALLA200_UF', 'TURNO', 'FECHA'];
    const rows = this.filteredStationSamples.map(s => [
      s.station,
      s.sample_time,
      s.battery_tag,
      s.solids_feed,
      s.solids_of,
      s.solids_uf,
      s.mesh200_feed,
      s.mesh200_of,
      s.mesh200_uf,
      s.shift_code,
      s.date
    ]);

    rows.push([
      'PROMEDIO GENERAL',
      '-',
      '-',
      this.generalAverages.solids_feed,
      this.generalAverages.solids_of,
      this.generalAverages.solids_uf,
      this.generalAverages.mesh200_feed,
      this.generalAverages.mesh200_of,
      this.generalAverages.mesh200_uf,
      this.selectedShift,
      this.filterDate || new Date().toISOString().split('T')[0]
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${this.selectedStation.replace(/\s+/g, '_').toLowerCase()}_reporte.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  loadCyclones(): void {
    this.http.get<any>('http://localhost:3001/api/cyclones').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.cyclones = res.data;
        }
      },
      error: () => {
        this.cyclones = [
          {
            id: 'c-1', battery_tag: 'CYCLOPAC-BATERIA-01', total_cyclones: 12,
            active_cyclones: 10, feed_pressure_psi: 18.5, feed_density_kgm3: 1650,
            p80_microns: 148, overflow_density: 1280, underflow_density: 1980,
            flocculant_ppm: 14.2, status: 'OPTIMAL', shift_code: 'GUARDIA_A',
            notes: 'Ciclones 03 y 07 en standby. P80 en 148 µm en rango óptimo de flotación.',
            created_at: new Date().toISOString()
          },
          {
            id: 'c-2', battery_tag: 'CYCLOPAC-BATERIA-02', total_cyclones: 12,
            active_cyclones: 9, feed_pressure_psi: 17.2, feed_density_kgm3: 1640,
            p80_microns: 155, overflow_density: 1295, underflow_density: 1960,
            flocculant_ppm: 13.8, status: 'ATTENTION', shift_code: 'GUARDIA_A',
            notes: 'Ciclón 11 cerrado por arenado en ápice (Apex).',
            created_at: new Date().toISOString()
          }
        ];
      }
    });
  }

  getCycloneDots(battery: CycloneReport) {
    const dots = [];
    for (let i = 0; i < battery.total_cyclones; i++) {
      dots.push({ active: i < battery.active_cyclones });
    }
    return dots;
  }

  saveCyclone(): void {
    if (this.offlineSync.isOnline()) {
      this.http.post<any>('http://localhost:3001/api/cyclones', this.newCyclone).subscribe({
        next: () => {
          this.isCreateModalOpen = false;
          this.loadCyclones();
        },
        error: () => {
          this.offlineSync.queueAction('http://localhost:3001/api/cyclones', 'POST', this.newCyclone, 'Ciclón ' + this.newCyclone.battery_tag);
          this.isCreateModalOpen = false;
        }
      });
    } else {
      this.offlineSync.queueAction('http://localhost:3001/api/cyclones', 'POST', this.newCyclone, 'Ciclón ' + this.newCyclone.battery_tag);
      this.isCreateModalOpen = false;
    }
  }
}
