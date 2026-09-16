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
        <div>
          <h2>Baterías de Ciclones (Cyclopac & Estaciones)</h2>
          <p class="section-sub">Control granulométrico de malla -200, balance de sólidos y presión manifold</p>
        </div>
        <div class="top-actions">
          <button class="btn btn-secondary" (click)="exportCsv()">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar CSV
          </button>
          <button class="btn btn-emerald" (click)="openSampleModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Registrar Muestreo de Estación
          </button>
          <button class="btn btn-primary" (click)="isCreateModalOpen = true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Inspección Nido Cyclopac
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
            2DA ESTACIÓN CICLONES (CY3 / CY4)
          </button>
          <button
            class="station-tab-btn"
            [class.active]="selectedStation === '1RA ESTACIÓN CICLONES'"
            (click)="selectStation('1RA ESTACIÓN CICLONES')"
          >
            <span class="dot-indicator"></span>
            1RA ESTACIÓN CICLONES (CY1 / CY2)
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
        </div>
      </div>

      <!-- METALLURGICAL STATION TABLE (Exact replica of user's specification) -->
      <div class="metallurgical-sheet-wrapper">
        <!-- Main Emerald Header Banner -->
        <div class="station-banner-header">
          <h3>{{ selectedStation }}</h3>
        </div>

        <!-- Table Container -->
        <div class="table-responsive">
          <table class="metallurgical-table">
            <thead>
              <tr class="th-main-row">
                <th rowspan="2" class="col-hora">HORA</th>
                <th rowspan="2" class="col-baterias">BATERÍAS</th>
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
                  <td *ngIf="i === 0" [attr.rowspan]="group.rows.length" class="cell-hora font-bold">
                    {{ group.time }}
                  </td>
                  <!-- Battery Tag -->
                  <td class="cell-battery font-bold">
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

              <!-- Empty state fallback -->
              <tr *ngIf="groupedSamples.length === 0">
                <td colspan="8" class="empty-message">No hay registros de muestreo para la estación y filtros seleccionados.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="row-promedio-general">
                <td colspan="2" class="cell-promedio-title font-bold">PROMEDIO GENERAL</td>
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

        <!-- Promedios Clave Card (Exact replica) -->
        <div class="promedios-clave-card">
          <span class="clave-title">Promedios Clave:</span>
          <span class="clave-metric">
            UF Sólidos: <strong class="green-highlight">{{ generalAverages.solids_uf | number:'1.2-2' }}%</strong>
          </span>
          <span class="clave-divider">|</span>
          <span class="clave-metric">
            UF Malla 200: <strong class="green-highlight">{{ generalAverages.mesh200_uf | number:'1.2-2' }}%</strong>
          </span>
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
      <app-modal [isOpen]="isSampleModalOpen" [title]="'Registrar Muestreo de Estación de Ciclones'" (close)="isSampleModalOpen = false">
        <form (ngSubmit)="saveStationSample()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Estación de Ciclones</label>
              <select [(ngModel)]="newSample.station" name="station" required>
                <option value="2DA ESTACIÓN CICLONES">2DA ESTACIÓN CICLONES</option>
                <option value="1RA ESTACIÓN CICLONES">1RA ESTACIÓN CICLONES</option>
              </select>
            </div>
            <div class="form-group">
              <label>Hora de Muestreo</label>
              <select [(ngModel)]="newSample.sample_time" name="sample_time" required>
                <option value="20:00">20:00 (Noche)</option>
                <option value="23:00">23:00 (Noche)</option>
                <option value="02:00">02:00 (Noche)</option>
                <option value="05:00">05:00 (Noche)</option>
                <option value="08:00">08:00 (Día)</option>
                <option value="11:00">11:00 (Día)</option>
                <option value="14:00">14:00 (Día)</option>
                <option value="17:00">17:00 (Día)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Batería</label>
              <select [(ngModel)]="newSample.battery_tag" name="battery_tag" required>
                <option value="CY3">CY3</option>
                <option value="CY4">CY4</option>
                <option value="CY1">CY1</option>
                <option value="CY2">CY2</option>
              </select>
            </div>
            <div class="form-group">
              <label>Guardia / Turno</label>
              <select [(ngModel)]="newSample.shift_code" name="shift_code">
                <option value="GUARDIA_A">Guardia A</option>
                <option value="GUARDIA_B">Guardia B</option>
                <option value="GUARDIA_C">Guardia C</option>
              </select>
            </div>
          </div>

          <div class="form-section-title">
            <span>Parámetros de % SÓLIDOS</span>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label>FEED (%)</label>
              <input type="number" step="0.01" [(ngModel)]="newSample.solids_feed" name="solids_feed" required />
            </div>
            <div class="form-group">
              <label>OF (Overflow %)</label>
              <input type="number" step="0.01" [(ngModel)]="newSample.solids_of" name="solids_of" required />
            </div>
            <div class="form-group">
              <label>UF (Underflow %)</label>
              <input type="number" step="0.01" [(ngModel)]="newSample.solids_uf" name="solids_uf" required />
            </div>
          </div>

          <div class="form-section-title">
            <span>Parámetros de % MALLA 200</span>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label>FEED (%)</label>
              <input type="number" step="0.01" [(ngModel)]="newSample.mesh200_feed" name="mesh200_feed" required />
            </div>
            <div class="form-group">
              <label>OF (Overflow %)</label>
              <input type="number" step="0.01" [(ngModel)]="newSample.mesh200_of" name="mesh200_of" required />
            </div>
            <div class="form-group">
              <label>UF (Underflow %)</label>
              <input type="number" step="0.01" [(ngModel)]="newSample.mesh200_uf" name="mesh200_uf" required />
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
              <input type="number" step="0.1" [(ngModel)]="newCyclone.feed_pressure_psi" name="press" />
            </div>
            <div class="form-group">
              <label>Densidad de Pulpa (kg/m³)</label>
              <input type="number" [(ngModel)]="newCyclone.feed_density_kgm3" name="dens" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Corte P80 (µm)</label>
              <input type="number" [(ngModel)]="newCyclone.p80_microns" name="p80" />
            </div>
            <div class="form-group">
              <label>Floculante (ppm)</label>
              <input type="number" step="0.1" [(ngModel)]="newCyclone.flocculant_ppm" name="floc" />
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
      gap: 24px;
    }

    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;

      h2 {
        font-size: 1.45rem;
        font-weight: 800;
        color: var(--text-primary);
      }

      .section-sub {
        font-size: 0.82rem;
        color: var(--text-muted);
        margin-top: 3px;
      }
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
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
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
    }

    .station-tabs {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .station-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: var(--radius-md);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
      background: var(--bg-card-subtle);
      color: var(--text-secondary);
      transition: var(--transition-smooth);

      .dot-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-muted);
      }

      &.active {
        background: rgba(5, 150, 105, 0.18);
        border-color: #059669;
        color: #34d399;

        .dot-indicator {
          background: #34d399;
          box-shadow: 0 0 8px rgba(52, 211, 153, 0.7);
        }
      }

      &:hover:not(.active) {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }
    }

    .station-filters {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .filter-item {
      display: flex;
      align-items: center;
      gap: 8px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-muted);
      }

      select, input {
        padding: 6px 12px;
        font-size: 0.8rem;
      }
    }

    /* METALLURGICAL SHEET STYLING (Faithful to Image) */
    .metallurgical-sheet-wrapper {
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      border: 1px solid #cbd5e1;
    }

    .station-banner-header {
      background: #084c2a;
      background: linear-gradient(180deg, #0a5c36 0%, #074626 100%);
      padding: 13px 20px;
      text-align: center;
      border-bottom: 2px solid #063c20;

      h3 {
        margin: 0;
        color: #ffffff;
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
    }

    .metallurgical-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      color: #1e293b;
      text-align: center;

      th, td {
        border: 1px solid #d1dced;
        padding: 10px 14px;
        vertical-align: middle;
      }

      /* Headers */
      thead {
        background-color: #ebf2f8;

        th {
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.03em;
        }

        .th-main-row {
          .col-hora, .col-baterias {
            font-size: 0.85rem;
            width: 11%;
          }

          .col-group {
            font-size: 0.88rem;
            background-color: #e5eff8;
            border-bottom: 1px solid #cbd5e1;
          }
        }

        .th-sub-row {
          .sub-col {
            font-size: 0.82rem;
            padding: 8px 10px;
            color: #334155;
          }
        }
      }

      /* Body */
      tbody {
        background-color: #ffffff;

        .data-row {
          transition: background-color 0.15s ease;

          &:hover {
            background-color: #f8fafc;
          }
        }

        .cell-hora {
          background-color: #ffffff;
          font-size: 0.95rem;
          color: #0f172a;
          border-right: 1px solid #d1dced;
        }

        .cell-battery {
          color: #0d9488;
          font-size: 0.92rem;
          background-color: #ffffff;
        }

        .cell-val {
          color: #1e293b;
          font-variant-numeric: tabular-nums;
        }

        .cell-uf {
          color: #059669;
          font-size: 0.92rem;
        }

        .empty-message {
          padding: 28px;
          color: #64748b;
          font-style: italic;
        }
      }

      /* Footer */
      tfoot {
        .row-promedio-general {
          background-color: #059669;
          color: #ffffff;

          td {
            border: 1px solid #047857;
            padding: 11px 14px;
            font-size: 0.92rem;
            font-variant-numeric: tabular-nums;
          }

          .cell-promedio-title {
            text-align: center;
            letter-spacing: 0.05em;
          }
        }
      }
    }

    /* Key Averages Banner */
    .promedios-clave-card {
      background-color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      font-size: 0.92rem;
      color: #1e293b;
      border-top: 1px solid #d1dced;
      flex-wrap: wrap;

      .clave-title {
        font-weight: 700;
        color: #334155;
      }

      .clave-metric {
        color: #1e293b;
      }

      .green-highlight {
        color: #059669;
        font-size: 1rem;
        font-weight: 800;
      }

      .clave-divider {
        color: #94a3b8;
        font-weight: 300;
      }
    }

    /* Section divider */
    .section-divider {
      margin-top: 12px;
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
      gap: 24px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .battery-card {
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 16px;

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
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--primary-lavender);
      display: block;
    }

    .active-badge {
      font-size: 0.75rem;
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
      font-size: 0.75rem;
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
        background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
        box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
      }

      &.standby {
        background: #362e52;
        border: 1px dashed rgba(255, 255, 255, 0.15);
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
      font-size: 0.85rem;
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
      gap: 14px;
    }

    .form-section-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #34d399;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid rgba(52, 211, 153, 0.2);
      padding-bottom: 4px;
      margin-top: 6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
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
      margin-top: 10px;
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

  loadStationSamples(): void {
    const url = `http://localhost:3001/api/cyclones/station-samples?station=${encodeURIComponent(this.selectedStation)}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.rawStationSamples = res.data;
          this.filterSamples();
          if (res.generalAverages) {
            this.generalAverages = res.generalAverages;
          }
        }
      },
      error: () => {
        // Fallback default samples (exact data from the user screenshot)
        this.rawStationSamples = [
          { id: 's-1', station: '2DA ESTACIÓN CICLONES', sample_time: '20:00', battery_tag: 'CY3', solids_feed: 45.30, solids_of: 28.60, solids_uf: 69.40, mesh200_feed: 54.60, mesh200_of: 22.40, mesh200_uf: 23.40, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-2', station: '2DA ESTACIÓN CICLONES', sample_time: '20:00', battery_tag: 'CY4', solids_feed: 43.20, solids_of: 30.10, solids_uf: 68.60, mesh200_feed: 54.10, mesh200_of: 19.80, mesh200_uf: 23.60, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-3', station: '2DA ESTACIÓN CICLONES', sample_time: '23:00', battery_tag: 'CY3', solids_feed: 48.60, solids_of: 32.40, solids_uf: 72.10, mesh200_feed: 58.20, mesh200_of: 24.10, mesh200_uf: 25.80, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-4', station: '2DA ESTACIÓN CICLONES', sample_time: '23:00', battery_tag: 'CY4', solids_feed: 47.10, solids_of: 31.80, solids_uf: 71.50, mesh200_feed: 57.40, mesh200_of: 23.50, mesh200_uf: 25.20, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-5', station: '2DA ESTACIÓN CICLONES', sample_time: '02:00', battery_tag: 'CY3', solids_feed: 42.10, solids_of: 27.20, solids_uf: 67.80, mesh200_feed: 51.50, mesh200_of: 20.80, mesh200_uf: 22.10, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-6', station: '2DA ESTACIÓN CICLONES', sample_time: '02:00', battery_tag: 'CY4', solids_feed: 41.50, solids_of: 26.80, solids_uf: 67.20, mesh200_feed: 50.90, mesh200_of: 20.10, mesh200_uf: 21.80, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-7', station: '2DA ESTACIÓN CICLONES', sample_time: '05:00', battery_tag: 'CY3', solids_feed: 46.80, solids_of: 29.80, solids_uf: 70.80, mesh200_feed: 56.10, mesh200_of: 22.90, mesh200_uf: 24.30, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] },
          { id: 's-8', station: '2DA ESTACIÓN CICLONES', sample_time: '05:00', battery_tag: 'CY4', solids_feed: 45.90, solids_of: 29.20, solids_uf: 70.10, mesh200_feed: 55.40, mesh200_of: 22.20, mesh200_uf: 23.90, shift_code: 'GUARDIA_A', date: new Date().toISOString().split('T')[0] }
        ];
        this.filterSamples();
      }
    });
  }

  filterSamples(): void {
    let list = this.rawStationSamples.filter(s => s.station === this.selectedStation);
    if (this.selectedShift !== 'ALL') {
      list = list.filter(s => s.shift_code === this.selectedShift);
    }
    if (this.filterDate) {
      list = list.filter(s => s.date === this.filterDate);
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
        // Orden temporal de turnos mineros (ej: 20:00, 23:00, 02:00, 05:00 o turno día 08, 11, 14, 17)
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
        solids_feed: 0,
        solids_of: 0,
        solids_uf: 0,
        mesh200_feed: 0,
        mesh200_of: 0,
        mesh200_uf: 0
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

    // Add general average line
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
