import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ModalComponent } from '../../shared/ui/modal.component';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';
import { TailingsReportPdfComponent } from '../reports/tailings-report-pdf.component';

export interface TailingsReport {
  id: string;
  station_tag: string;
  flow_rate_m3h: number;
  solids_percentage: number;
  dam_level_meters: number;
  freeboard_meters: number;
  piezometer_kpa: number;
  turbidity_ntu: number;
  pumping_line_status: 'NORMAL' | 'ALERT' | 'RESTRICTED';
  operator_name: string;
  shift_code: string;
  notes?: string;
  created_at: string;
}

@Component({
  selector: 'app-tailings',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, TailingsReportPdfComponent],
  template: `
    <div class="tailings-page animate-fade-in">
      <div class="page-top-bar">
        <div>
          <h2>Reporte de Descarga</h2>
          <p class="section-sub">Espesamiento de pulpas, porcentaje de sólidos y estabilidad de presa</p>
        </div>
        <div class="top-actions">
          <button class="btn btn-secondary action-btn-pdf" (click)="isPdfModalOpen = true" title="Exportar reporte de relaves en PDF a una sola hoja">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span class="btn-text">Exportar PDF (1 Hoja)</span>
          </button>
          <button class="btn btn-primary" (click)="isCreateModalOpen = true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Registrar Lectura de Relaves
          </button>
        </div>
      </div>

      <!-- Dam Level & Safety Metrics Row -->
      <div class="safety-metrics-grid">
        <div class="metric-box glass-panel">
          <span class="m-title">Nivel de Espejo de Agua</span>
          <span class="m-val">4,120.4 <small>msnm</small></span>
          <span class="m-status normal">Dentro de Cota de Diseño</span>
        </div>
        <div class="metric-box glass-panel">
          <span class="m-title">Borde Libre (Freeboard)</span>
          <span class="m-val">3.8 <small>metros</small></span>
          <span class="m-status normal">Margen Seguro (> 2.5m)</span>
        </div>
        <div class="metric-box glass-panel">
          <span class="m-title">Presión Piezométrica Muro</span>
          <span class="m-val">142.6 <small>kPa</small></span>
          <span class="m-status normal">Línea Freática Estable</span>
        </div>
        <div class="metric-box glass-panel">
          <span class="m-title">Turbidez Sobrenadante</span>
          <span class="m-val">12.4 <small>NTU</small></span>
          <span class="m-status normal">Clarificado para Reúso</span>
        </div>
      </div>

      <!-- Tailings Monitoring Stations Table -->
      <div class="table-card glass-panel">
        <div class="card-head">
          <h3>Estaciones de Descarga y Espesamiento</h3>
          <span class="counter">{{ tailings.length }} Estaciones Activas</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Estación</th>
                <th>Caudal Relaves</th>
                <th>% Sólidos</th>
                <th>Línea de Bombeo</th>
                <th>Nivel Presa</th>
                <th>Piezómetro</th>
                <th>Operador</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of tailings">
                <td class="font-bold">{{ item.station_tag }}</td>
                <td>{{ item.flow_rate_m3h | number }} m³/h</td>
                <td><span class="badge badge-purple font-bold">{{ item.solids_percentage }}%</span></td>
                <td>
                  <span class="badge" [class.badge-success]="item.pumping_line_status === 'NORMAL'" [class.badge-warning]="item.pumping_line_status === 'ALERT'" [class.badge-danger]="item.pumping_line_status === 'RESTRICTED'">
                    {{ item.pumping_line_status }}
                  </span>
                </td>
                <td>{{ item.dam_level_meters }} m</td>
                <td>{{ item.piezometer_kpa }} kPa</td>
                <td>{{ item.operator_name }}</td>
                <td class="notes-col">{{ item.notes || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal Create -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Registrar Nueva Lectura de Presa / Espesador'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="saveTailings()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Estación o Punto de Descarga</label>
              <input type="text" [(ngModel)]="newTailings.station_tag" name="tag" required />
            </div>
            <div class="form-group">
              <label>Estado de Línea</label>
              <select [(ngModel)]="newTailings.pumping_line_status" name="status">
                <option value="NORMAL">Normal (NORMAL)</option>
                <option value="ALERT">Alerta (ALERT)</option>
                <option value="RESTRICTED">Restringido (RESTRICTED)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Caudal Relaves (m³/h)</label>
              <input type="number" [(ngModel)]="newTailings.flow_rate_m3h" name="flow" />
            </div>
            <div class="form-group">
              <label>% Sólidos (Concentración)</label>
              <input type="number" step="0.1" [(ngModel)]="newTailings.solids_percentage" name="solids" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Cota Nivel Presa (msnm)</label>
              <input type="number" step="0.1" [(ngModel)]="newTailings.dam_level_meters" name="level" />
            </div>
            <div class="form-group">
              <label>Borde Libre (m)</label>
              <input type="number" step="0.1" [(ngModel)]="newTailings.freeboard_meters" name="freeboard" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Piezómetro (kPa)</label>
              <input type="number" step="0.1" [(ngModel)]="newTailings.piezometer_kpa" name="piezometer" />
            </div>
            <div class="form-group">
              <label>Turbidez (NTU)</label>
              <input type="number" step="0.1" [(ngModel)]="newTailings.turbidity_ntu" name="turb" />
            </div>
          </div>

          <div class="form-group">
            <label>Observaciones Operacionales</label>
            <textarea rows="2" [(ngModel)]="newTailings.notes" name="notes"></textarea>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar Reporte</button>
          </div>
        </form>
      </app-modal>

      <!-- Modal Exportar Reporte PDF Oficial a 1 Hoja -->
      <app-tailings-report-pdf
        [isOpen]="isPdfModalOpen"
        [items]="tailings"
        (close)="isPdfModalOpen = false">
      </app-tailings-report-pdf>
    </div>
  `,
  styles: [`
    .tailings-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;

      .top-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

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

    .safety-metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .metric-box {
      padding: 20px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .m-title {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .m-val {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--text-primary);

      small {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-weight: 400;
      }
    }

    .m-status {
      font-size: 0.72rem;
      font-weight: 600;

      &.normal { color: var(--success); }
      &.warn { color: var(--warning); }
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

    .notes-col {
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
export class TailingsComponent implements OnInit {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);

  tailings: TailingsReport[] = [];
  isCreateModalOpen = false;
  isPdfModalOpen = false;

  newTailings = {
    station_tag: 'CANALETA-RELAVES-02',
    flow_rate_m3h: 2100,
    solids_percentage: 64.2,
    dam_level_meters: 4120.5,
    freeboard_meters: 3.7,
    piezometer_kpa: 141.2,
    turbidity_ntu: 11.8,
    pumping_line_status: 'NORMAL' as const,
    notes: 'Flujo estable hacia el sector este de la presa'
  };

  ngOnInit(): void {
    this.loadTailings();
  }

  loadTailings(): void {
    const cached = getRealtimeData<TailingsReport[]>('tailings_reports', []);
    if (cached && cached.length > 0) {
      this.tailings = cached;
    }

    this.http.get<any>('http://localhost:3001/api/tailings').subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.tailings = res.data;
          saveRealtimeData('tailings_reports', this.tailings);
        } else if (!cached || cached.length === 0) {
          this.loadDefaultTailings();
        }
      },
      error: () => {
        if (!cached || cached.length === 0) {
          this.loadDefaultTailings();
        }
      }
    });
  }

  private loadDefaultTailings(): void {
    this.tailings = [
      {
        id: 't-1', station_tag: 'PRESA-SECTOR-NORTE', flow_rate_m3h: 2150,
        solids_percentage: 64.8, dam_level_meters: 4120.4, freeboard_meters: 3.8,
        piezometer_kpa: 142.6, turbidity_ntu: 12.4, pumping_line_status: 'NORMAL',
        operator_name: 'VIZCARRA CORI MANLEY KLISMAN', shift_code: 'GUARDIA_A',
        notes: 'Espesador de relaves con torque al 48%. Nivel freático en muro dentro de rango seguro.',
        created_at: new Date().toISOString()
      },
      {
        id: 't-2', station_tag: 'ESP-RELAVES-01', flow_rate_m3h: 1980,
        solids_percentage: 63.5, dam_level_meters: 4119.8, freeboard_meters: 4.2,
        piezometer_kpa: 138.0, turbidity_ntu: 10.1, pumping_line_status: 'NORMAL',
        operator_name: 'PILCO APAZA CARLOS EDUARDO', shift_code: 'GUARDIA_A',
        notes: 'Dosificación de floculante aniónico optimizada. Sobrenadante clarificado.',
        created_at: new Date().toISOString()
      }
    ];
    saveRealtimeData('tailings_reports', this.tailings);
  }

  saveTailings(): void {
    const report: TailingsReport = {
      id: 't-' + Date.now(),
      station_tag: this.newTailings.station_tag,
      flow_rate_m3h: this.newTailings.flow_rate_m3h,
      solids_percentage: this.newTailings.solids_percentage,
      dam_level_meters: this.newTailings.dam_level_meters,
      freeboard_meters: this.newTailings.freeboard_meters,
      piezometer_kpa: this.newTailings.piezometer_kpa,
      turbidity_ntu: this.newTailings.turbidity_ntu,
      pumping_line_status: this.newTailings.pumping_line_status as any,
      operator_name: 'VIZCARRA CORI MANLEY KLISMAN',
      shift_code: 'GUARDIA_A',
      notes: this.newTailings.notes,
      created_at: new Date().toISOString()
    };

    // Optimistic real-time storage
    this.tailings.unshift(report);
    saveRealtimeData('tailings_reports', this.tailings);
    this.isCreateModalOpen = false;

    if (this.offlineSync.isOnline()) {
      this.http.post<any>('http://localhost:3001/api/tailings', this.newTailings).subscribe({
        next: () => {
          this.loadTailings();
        },
        error: () => {
          this.offlineSync.queueAction('http://localhost:3001/api/tailings', 'POST', this.newTailings, 'Relaves ' + this.newTailings.station_tag);
        }
      });
    } else {
      this.offlineSync.queueAction('http://localhost:3001/api/tailings', 'POST', this.newTailings, 'Relaves ' + this.newTailings.station_tag);
    }
  }
}
