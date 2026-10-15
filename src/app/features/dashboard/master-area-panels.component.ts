import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MasterSheetEntry } from '../../core/models/master-sheet.model';
import { MASTER_AREAS, MasterArea, MasterAreaRow } from './master-areas.config';

interface RenderedRow {
  label: string;
  value: string;
  split: string | null;
  note?: string;
  hasData: boolean;
  invalid: boolean;
}

interface RenderedArea {
  area: MasterArea;
  rows: RenderedRow[];
  withData: number;
}

/**
 * Panel de áreas operativas de la Planilla Maestra: muestra TODOS los campos del día,
 * con desglose por turno A/B, y "Sin dato" para lo que la planilla no trae.
 */
@Component({
  selector: 'app-master-area-panels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="areas-toolbar">
      <div>
        <h3>Detalle Operativo por Área</h3>
        <p>{{ totalWithData }} de {{ totalRows }} indicadores con datos en la planilla · {{ entry?.fecha }}</p>
      </div>
      <label class="toggle-empty">
        <input type="checkbox" [checked]="hideEmpty" (change)="hideEmpty = !hideEmpty" />
        Ocultar indicadores sin dato
      </label>
    </div>

    <section class="areas-grid">
      <ng-container *ngFor="let ra of rendered; trackBy: trackArea">
        <article class="area-card glass-panel" *ngIf="!hideEmpty || ra.withData > 0" [style.borderTopColor]="ra.area.color">
          <header class="area-head">
            <div>
              <h4>{{ ra.area.title }}</h4>
              <p>{{ ra.area.caption }}</p>
            </div>
            <span class="coverage" [class.full]="ra.withData === ra.rows.length" [class.empty]="ra.withData === 0">
              {{ ra.withData }}/{{ ra.rows.length }}
            </span>
          </header>

          <ul class="area-rows">
            <ng-container *ngFor="let row of ra.rows">
              <li *ngIf="!hideEmpty || row.hasData" [class.no-data]="!row.hasData" [class.invalid]="row.invalid">
                <div class="row-main">
                  <span class="row-label">{{ row.label }}</span>
                  <span class="row-value" [style.color]="row.hasData && !row.invalid ? ra.area.color : null">{{ row.value }}</span>
                </div>
                <div class="row-sub" *ngIf="row.split || row.note">
                  <span *ngIf="row.split">{{ row.split }}</span>
                  <span *ngIf="row.note" class="row-note">{{ row.note }}</span>
                </div>
              </li>
            </ng-container>
          </ul>
        </article>
      </ng-container>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .areas-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;

      h3 { margin: 0; font-size: 1.05rem; color: var(--text-primary); }
      p { margin: 2px 0 0; font-size: 0.8rem; color: var(--text-muted); }
    }

    .toggle-empty {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
    }

    .areas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 14px;
    }

    .area-card {
      border-top: 3px solid;
      padding: 14px 16px;
      min-width: 0;
    }

    .area-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;

      h4 { margin: 0; font-size: 0.92rem; color: var(--text-primary); }
      p { margin: 2px 0 0; font-size: 0.72rem; color: var(--text-muted); }
    }

    .coverage {
      flex-shrink: 0;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--warning-bg);
      color: var(--warning);

      &.full { background: var(--success-bg); color: var(--success); }
      &.empty { background: var(--bg-card-subtle); color: var(--text-muted); }
    }

    .area-rows {
      list-style: none;
      margin: 0;
      padding: 0;

      li {
        padding: 7px 0;
        border-bottom: 1px dashed var(--border-subtle);

        &:last-child { border-bottom: none; }
      }

      li.no-data .row-value {
        color: var(--text-placeholder);
        font-weight: 500;
        font-style: italic;
      }

      li.invalid .row-value { color: var(--warning); }
    }

    .row-main {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
    }

    .row-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .row-value {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--text-primary);
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .row-sub {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 2px;
      font-size: 0.72rem;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .row-note { font-style: italic; text-align: right; }

    @media (max-width: 480px) {
      .areas-grid { grid-template-columns: 1fr; }
      .row-value { white-space: normal; }
    }
  `]
})
export class MasterAreaPanelsComponent {
  @Input() set entry(value: MasterSheetEntry | null) {
    this._entry = value;
    this.render();
  }
  get entry(): MasterSheetEntry | null {
    return this._entry;
  }

  /** Campos con al menos un valor en la planilla (los demás se muestran "Sin dato"). */
  @Input() set fieldsWithData(value: Set<string>) {
    this._fields = value;
    this.render();
  }

  /** El registro tiene cotas imposibles: las filas de cota / borde libre se muestran como inválidas. */
  @Input() set damInvalid(value: boolean) {
    this._damInvalid = value;
    this.render();
  }

  hideEmpty = false;
  rendered: RenderedArea[] = [];
  totalRows = 0;
  totalWithData = 0;

  private _entry: MasterSheetEntry | null = null;
  private _fields = new Set<string>();
  private _damInvalid = false;

  trackArea = (_: number, ra: RenderedArea) => ra.area.id;

  private render(): void {
    const entry = this._entry;
    if (!entry) {
      this.rendered = [];
      this.totalRows = this.totalWithData = 0;
      return;
    }
    this.rendered = MASTER_AREAS.map(area => {
      const rows = area.rows.map(row => this.renderRow(entry, row));
      return { area, rows, withData: rows.filter(r => r.hasData).length };
    });
    this.totalRows = this.rendered.reduce((n, ra) => n + ra.rows.length, 0);
    this.totalWithData = this.rendered.reduce((n, ra) => n + ra.withData, 0);
  }

  private renderRow(entry: MasterSheetEntry, row: MasterAreaRow): RenderedRow {
    if (row.text) {
      const text = (entry[row.text] ?? '').toString().trim();
      return { label: row.label, value: text || 'Sin dato', split: null, note: row.note, hasData: !!text, invalid: false };
    }

    const has = (f?: string) => !!f && this._fields.has(f);
    const mainHas = has(row.field);
    const splitHas = has(row.a) || has(row.b);
    const hasData = mainHas || splitHas;
    const invalid = !!row.dam && this._damInvalid;
    const fmt = (f?: keyof MasterSheetEntry) => this.format(f ? entry[f] : undefined, row.decimals ?? 2);
    const unit = row.unit ? ` ${row.unit}` : '';

    let value: string;
    if (invalid) {
      value = 'Dato inválido';
    } else if (mainHas) {
      value = fmt(row.field) + unit;
    } else if (splitHas && row.a && row.b) {
      // Sin total en la planilla: se muestra el total calculado solo si suma tiene sentido (volúmenes / horas)
      const additive = row.unit === 'm³' || row.unit === 'h';
      const av = entry[row.a] as number;
      const bv = entry[row.b] as number;
      value = additive
        ? this.format(av + bv, row.decimals ?? 2) + unit
        : this.format((av + bv) / 2, row.decimals ?? 2) + unit + ' prom.';
    } else {
      value = 'Sin dato';
    }

    const split = row.a && row.b && splitHas && !invalid
      ? `Turno A: ${has(row.a) ? fmt(row.a) : '—'} · Turno B: ${has(row.b) ? fmt(row.b) : '—'}`
      : null;

    return { label: row.label, value, split, note: row.note, hasData, invalid };
  }

  private format(value: unknown, decimals: number): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return value.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
}
