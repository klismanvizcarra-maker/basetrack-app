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

@Component({
  selector: 'app-cyclones',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="cyclones-page animate-fade-in">
      <div class="page-top-bar">
        <div>
          <h2>Baterías de Ciclones (Cyclopac)</h2>
          <p class="section-sub">Clasificación hidráulica, corte granulométrico P80 y presión manifold</p>
        </div>
        <button class="btn btn-primary" (click)="isCreateModalOpen = true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Registrar Inspección de Nido
        </button>
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

          <!-- Cyclone Pod Visual Indicator (Dots of individual hydrocyclones) -->
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

      <!-- Create Cyclone Modal -->
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
export class CyclonesComponent implements OnInit {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);

  cyclones: CycloneReport[] = [];
  isCreateModalOpen = false;

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
