import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { copyToClipboard } from '../../core/utils/clipboard.util';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';

export type CalculatorTab = 'MARCY' | 'FLOCCULANT' | 'DILUTION' | 'PARSHALL';

const STORAGE_KEY = 'calc_state';

interface MineralPreset {
  name: string;
  sg: number;
  description: string;
}

/** Valores de entrada de las 4 calculadoras (null = campo vacío). */
interface CalcValues {
  marcyWeightGrams: number | null;
  marcyGs: number | null;
  waterDensity: number | null;
  flocPulpFlowM3h: number | null;
  flocSolidsWeightPct: number | null;
  flocGs: number | null;
  flocTargetDoseGpt: number | null;
  flocMotherConcPct: number | null;
  dilInitialPulpFlowM3h: number | null;
  dilInitialSolidsPct: number | null;
  dilTargetSolidsPct: number | null;
  dilGs: number | null;
  parshallThroatKey: string;
  parshallHeadCm: number | null;
}

type NumericCalcKey = Exclude<keyof CalcValues, 'parshallThroatKey'>;

/** Campo numérico con su rango válido; la misma definición sirve para la UI y la validación. */
interface FieldDef {
  key: NumericCalcKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  slider?: [number, number];
  help?: string;
}

interface TabDef {
  id: CalculatorTab;
  icon: string;
  title: string;
  /** Pregunta que responde la calculadora (guía al operador al elegir). */
  question: string;
  heading: string;
  description: string;
}

interface HeroResult {
  label: string;
  value: string;
  unit: string;
  action: string;
}

interface SecondaryResult {
  label: string;
  value: string;
  unit: string;
  sub?: string;
}

@Component({
  selector: 'app-metallurgical-calculators',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="calc-page animate-fade-in">
      <!-- Top Action Bar -->
      <div class="page-top-bar glass-panel">
        <div class="title-group">
          <div class="title-with-badge">
            <span class="badge-blue">HERRAMIENTAS OPERACIONALES</span>
            <span class="live-pill"><span class="dot"></span> CÁLCULO EN VIVO</span>
          </div>
          <h2>Calculadora de Planta</h2>
          <p class="subtitle">
            Elige un cálculo, ingresa lo medido en terreno y la respuesta se actualiza al instante. Los valores se guardan en este equipo.
          </p>
        </div>

        <div class="top-actions">
          <button type="button" class="btn btn-secondary" (click)="resetActiveCalculator()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            <span>Restablecer</span>
          </button>
          <button type="button" class="btn btn-primary" (click)="copySummaryToClipboard()" [disabled]="!isValid">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>{{ copied ? '¡Copiado!' : 'Copiar Resultados' }}</span>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="calc-tabs-bar glass-panel" role="tablist">
        <button
          *ngFor="let t of tabs"
          type="button"
          role="tab"
          class="calc-tab-btn"
          [class.active]="activeTab === t.id"
          [attr.aria-selected]="activeTab === t.id"
          (click)="setTab(t.id)"
        >
          <span class="tab-icon">{{ t.icon }}</span>
          <div class="tab-meta">
            <span class="tab-title">{{ t.title }}</span>
            <span class="tab-sub">{{ t.question }}</span>
          </div>
        </button>
      </div>

      <!-- Reusable numeric field: label, optional slider, input with unit, help and validation -->
      <ng-template #numField let-f>
        <div class="input-field-group" [class.has-error]="fieldError(f)">
          <label [attr.for]="'calc-' + f.key">{{ f.label }}</label>
          <input
            *ngIf="f.slider"
            type="range"
            [min]="f.slider[0]"
            [max]="f.slider[1]"
            [step]="f.step"
            [ngModel]="fieldValue(f)"
            (ngModelChange)="setValue(f.key, $event)"
            class="range-slider"
            [attr.aria-label]="f.label"
          />
          <div class="quick-input-row">
            <input
              [id]="'calc-' + f.key"
              type="number"
              inputmode="decimal"
              [step]="f.step"
              [ngModel]="fieldValue(f)"
              (ngModelChange)="setValue(f.key, $event)"
              class="form-control"
              [class.invalid]="fieldError(f)"
              [placeholder]="'Ej. ' + fieldDefault(f)"
            />
            <span class="unit-tag" *ngIf="f.unit">{{ f.unit }}</span>
          </div>
          <small class="error-text" *ngIf="fieldError(f) as err">{{ err }}</small>
          <small class="helper-text" *ngIf="!fieldError(f) && f.help">{{ f.help }}</small>
        </div>
      </ng-template>

      <div class="calc-card glass-panel">
        <div class="calc-header-row">
          <div>
            <h3>{{ activeTabDef.icon }} {{ activeTabDef.heading }}</h3>
            <p class="calc-desc">{{ activeTabDef.description }}</p>
          </div>
        </div>

        <div class="calc-grid-layout">
          <!-- 1. DATOS DE TERRENO -->
          <div class="calc-inputs-pane">
            <h4 class="pane-title">1. Datos medidos en terreno</h4>

            <!-- Marcy: tipo de mineral define la gravedad específica -->
            <div class="input-field-group" *ngIf="activeTab === 'MARCY'">
              <label>Tipo de mineral</label>
              <div class="preset-buttons">
                <button
                  type="button"
                  *ngFor="let p of mineralPresets"
                  class="preset-btn"
                  [class.selected]="v.marcyGs === p.sg"
                  (click)="setValue('marcyGs', p.sg)"
                  [title]="p.description"
                >
                  {{ p.name }} <small>({{ p.sg }})</small>
                </button>
              </div>
              <small class="helper-text">Define la gravedad específica del sólido; puedes ajustarla en "Ajustes avanzados".</small>
            </div>

            <!-- Parshall: tamaño de garganta -->
            <div class="input-field-group" *ngIf="activeTab === 'PARSHALL'">
              <label for="calc-throat">Tamaño de la garganta del aforador</label>
              <select id="calc-throat" [ngModel]="v.parshallThroatKey" (ngModelChange)="setValue('parshallThroatKey', $event)" class="form-control">
                <option *ngFor="let t of parshallThroats" [value]="t.key">{{ t.label }}</option>
              </select>
            </div>

            <ng-container *ngFor="let f of mainFields">
              <ng-container *ngTemplateOutlet="numField; context: { $implicit: f }"></ng-container>
            </ng-container>

            <!-- Ajustes avanzados (rara vez cambian) -->
            <details class="advanced-box" [open]="advancedHasError">
              <summary>
                <span>Ajustes avanzados</span>
                <small>{{ advancedSummary }}</small>
              </summary>
              <div class="advanced-body">
                <ng-container *ngFor="let f of advancedFields">
                  <ng-container *ngTemplateOutlet="numField; context: { $implicit: f }"></ng-container>
                </ng-container>

                <div class="input-field-group" *ngIf="activeTab === 'FLOCCULANT'">
                  <label for="calc-conc">Concentración de la solución preparada</label>
                  <select id="calc-conc" [ngModel]="v.flocMotherConcPct" (ngModelChange)="setValue('flocMotherConcPct', $event)" class="form-control">
                    <option [ngValue]="0.05">0.05 % (0.5 g/L)</option>
                    <option [ngValue]="0.10">0.10 % (1.0 g/L · estándar de planta)</option>
                    <option [ngValue]="0.15">0.15 % (1.5 g/L)</option>
                    <option [ngValue]="0.20">0.20 % (2.0 g/L)</option>
                    <option [ngValue]="0.25">0.25 % (2.5 g/L)</option>
                  </select>
                </div>

                <div class="formula-box">
                  <strong>Fórmula aplicada</strong>
                  <code>{{ formulaText }}</code>
                </div>
              </div>
            </details>
          </div>

          <!-- 2. RESPUESTA PRINCIPAL (a la derecha en escritorio, bajo los datos en celular) -->
          <section class="hero-result" [class.invalid]="!isValid" aria-live="polite">
            <ng-container *ngIf="isValid; else incompleteHero">
              <span class="hero-label">{{ hero.label }}</span>
              <div class="hero-value">{{ hero.value }} <small>{{ hero.unit }}</small></div>
              <p class="hero-action">{{ hero.action }}</p>
            </ng-container>
            <ng-template #incompleteHero>
              <span class="hero-label">Faltan datos</span>
              <div class="hero-value small">Completa los campos marcados en rojo</div>
              <p class="hero-action">El resultado aparecerá en cuanto los datos sean válidos.</p>
            </ng-template>
            <p class="hero-warning" *ngIf="isValid && warning">⚠️ {{ warning }}</p>
          </section>

          <!-- 3. RESULTADOS COMPLEMENTARIOS -->
          <div class="calc-results-pane">
            <h4 class="pane-title">2. Otros resultados</h4>
            <div class="kpi-cards-grid" *ngIf="isValid; else noResults">
              <div class="kpi-card" *ngFor="let r of secondaryResults">
                <span class="kpi-title">{{ r.label }}</span>
                <div class="kpi-number">{{ r.value }} <small>{{ r.unit }}</small></div>
                <span class="kpi-sub" *ngIf="r.sub">{{ r.sub }}</span>
              </div>
            </div>
            <ng-template #noResults>
              <p class="helper-text">Sin resultados hasta completar los datos.</p>
            </ng-template>
          </div>
        </div>
      </div>
    </div>
`,
  styles: [`
    .calc-page {
      padding: 0 0 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
      padding: 20px 24px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-sm);

      @media (max-width: 768px) {
        flex-direction: column;
        gap: 14px;
      }
    }

    .title-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .badge-blue {
      font-size: 0.72rem;
      font-weight: 800;
      color: #031795;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 3px 8px;
      border-radius: var(--radius-full);
      letter-spacing: 0.04em;
    }

    .live-pill {
      font-size: 0.72rem;
      font-weight: 700;
      color: #059669;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      gap: 6px;

      .dot {
        width: 6px;
        height: 6px;
        border-radius: var(--radius-full);
        background: #059669;
        animation: pulse 1.5s infinite;
      }
    }

    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }

    .title-group h2 {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: var(--radius-md);
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: var(--transition-smooth);

      &.btn-secondary {
        background: var(--bg-card-subtle);
        color: var(--text-primary);
        border: 1px solid var(--border-subtle);

        &:hover {
          background: var(--bg-card-hover);
        }
      }

      &.btn-primary {
        background: var(--primary-purple);
        color: #ffffff;
        box-shadow: 0 2px 6px var(--primary-glow);

        &:hover {
          background: var(--primary-violet);
          transform: translateY(-1px);
        }
      }
    }

    /* Tabs Bar */
    .calc-tabs-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding: 10px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);

      @media (max-width: 900px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }
    }

    .calc-tab-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-md);
      border: 1.5px solid transparent;
      background: var(--bg-card-subtle);
      cursor: pointer;
      text-align: left;
      transition: var(--transition-smooth);

      .tab-icon {
        font-size: 1.6rem;
      }

      .tab-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .tab-title {
        font-size: 0.86rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .tab-sub {
        font-size: 0.72rem;
        color: var(--text-muted);
      }

      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--border-subtle);
      }

      &.active {
        background: var(--primary-bg-subtle);
        border-color: var(--primary-purple);
        box-shadow: 0 2px 8px var(--primary-glow);

        .tab-title {
          color: var(--primary-purple);
        }
      }
    }

    /* Calc Card */
    .calc-card {
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .calc-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 16px;

      h3 {
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0 0 4px;
      }

      .calc-desc {
        font-size: 0.82rem;
        color: var(--text-secondary);
        margin: 0;
      }
    }

    /* Presets Row */
    .preset-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .preset-btn {
      border: 1px solid var(--border-subtle);
      background: var(--bg-card);
      color: var(--text-primary);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition-smooth);

      // Altura cómoda para el dedo en teléfonos
      @media (max-width: 600px) {
        min-height: 36px;
        padding: 6px 12px;
      }

      &:hover {
        border-color: var(--primary-purple);
        color: var(--primary-purple);
      }

      &.selected {
        background: var(--primary-purple);
        color: #ffffff;
        border-color: var(--primary-purple);
      }
    }

    /* Grid Layout */
    .calc-grid-layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      grid-template-areas:
        'inputs hero'
        'inputs results';
      grid-template-rows: auto 1fr;
      gap: 20px 24px;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        grid-template-rows: auto;
        grid-template-areas:
          'inputs'
          'hero'
          'results';
      }
    }

    .calc-inputs-pane { grid-area: inputs; }
    .calc-results-pane { grid-area: results; }

    /* Respuesta principal: lo primero que busca el operador */
    .hero-result {
      grid-area: hero;
      padding: 18px 20px;
      border-radius: var(--radius-lg);
      background: var(--primary-bg-subtle);
      border: 1.5px solid var(--primary-border);
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.invalid {
        background: var(--danger-bg);
        border-color: var(--danger);
      }

      .hero-label {
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--primary-lavender);
      }

      &.invalid .hero-label { color: var(--danger); }

      .hero-value {
        font-size: 2.4rem;
        font-weight: 800;
        line-height: 1.1;
        color: var(--primary-purple);
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;

        small {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        &.small {
          font-size: 1.15rem;
          color: var(--danger);
        }
      }

      .hero-action {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }

      .hero-warning {
        margin: 6px 0 0;
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        background: var(--warning-bg);
        color: var(--warning);
        font-size: 0.78rem;
        font-weight: 600;
      }

      /* En pantallas angostas va justo debajo de los datos (los ajustes avanzados están plegados) */
      @media (max-width: 900px) {
        .hero-value { font-size: 1.8rem; }
      }
    }

    .form-control.invalid {
      border-color: var(--danger);
      background: var(--danger-bg);

      &:focus { box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18); }
    }

    .error-text {
      font-size: 0.74rem;
      font-weight: 700;
      color: var(--danger);
    }

    .preset-btn small { opacity: 0.7; }

    /* Ajustes avanzados plegables */
    .advanced-box {
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 10px 12px;

      summary {
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--text-primary);
        list-style: none;

        &::-webkit-details-marker { display: none; }

        &::before {
          content: '▸';
          color: var(--text-muted);
          transition: transform 0.15s ease;
        }

        span { flex: 1; }

        small {
          font-weight: 500;
          color: var(--text-muted);
          font-size: 0.72rem;
        }
      }

      &[open] summary::before { transform: rotate(90deg); }
    }

    .advanced-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 12px;
    }

    .calc-inputs-pane, .calc-results-pane {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .pane-title {
      font-size: 0.88rem;
      font-weight: 800;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0;
      padding-bottom: 6px;
      border-bottom: 1.5px solid var(--border-subtle);
    }

    .input-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--text-primary);
      }
    }

    .range-slider {
      width: 100%;
      height: 6px;
      border-radius: var(--radius-full);
      accent-color: var(--primary-purple);
      cursor: pointer;
    }

    .quick-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-control {
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: var(--bg-input);
      font-size: 0.88rem;
      color: var(--text-primary);
      outline: none;
      transition: var(--transition-smooth);
      width: 100%;

      &:focus {
        border-color: var(--border-focus);
        box-shadow: 0 0 0 3px var(--primary-glow);
      }
    }

    .unit-tag {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .helper-text {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    /* KPI Results Grid */
    .kpi-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      padding: 14px;
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.highlight-cobalt {
        background: var(--primary-bg-subtle);
        border-color: var(--primary-border);

        .kpi-title {
          color: var(--primary-lavender);
        }

        .kpi-number {
          color: var(--primary-purple);
        }
      }

      &.highlight-emerald {
        background: var(--success-bg);
        border-color: rgba(16, 185, 129, 0.3);

        .kpi-title {
          color: var(--success);
        }

        .kpi-number {
          color: var(--success);
        }
      }
    }

    .kpi-title {
      font-size: 0.74rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .kpi-number {
      font-size: 1.55rem;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: -0.02em;

      small {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-muted);
      }
    }

    .kpi-sub {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .formula-box {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      font-size: 0.78rem;
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
      gap: 4px;

      code {
        font-family: monospace;
        color: var(--primary-lavender);
        font-weight: 700;
        font-size: 0.82rem;
      }
    }

  `]
})
export class MetallurgicalCalculatorsComponent implements OnInit {
  activeTab: CalculatorTab = 'MARCY';
  copied = false;

  readonly tabs: TabDef[] = [
    {
      id: 'MARCY', icon: '⚖️', title: 'Balanza Marcy', question: '¿Qué % de sólidos tiene la pulpa?',
      heading: 'Densidad y % de sólidos (Balanza Marcy)',
      description: 'Con el peso de 1 litro de pulpa en la jarra Marcy obtienes la densidad y el porcentaje de sólidos.'
    },
    {
      id: 'FLOCCULANT', icon: '🧪', title: 'Floculante', question: '¿A cuánto calibro la bomba?',
      heading: 'Dosificación de floculante',
      description: 'Calcula el caudal de la bomba dosificadora para aplicar la dosis objetivo de floculante a la pulpa.'
    },
    {
      id: 'DILUTION', icon: '💧', title: 'Dilución de Pulpa', question: '¿Cuánta agua agrego?',
      heading: 'Agua para diluir la pulpa',
      description: 'Calcula cuánta agua de proceso inyectar al cajón para bajar el % de sólidos al valor deseado.'
    },
    {
      id: 'PARSHALL', icon: '🌊', title: 'Aforador Parshall', question: '¿Cuánto caudal pasa?',
      heading: 'Caudal en aforador Parshall',
      description: 'Con la altura de agua leída en la regla del aforador obtienes el caudal que pasa por el canal.'
    }
  ];

  mineralPresets: MineralPreset[] = [
    { name: 'Relaves Planta', sg: 2.70, description: 'Densidad típica de pulpa en relaves y molienda' },
    { name: 'Cuarzo / Sílice', sg: 2.65, description: 'Mineral estéril predominante' },
    { name: 'Cobre / Calcopirita', sg: 2.85, description: 'Mineral de sulfuros de cobre' },
    { name: 'Polimetálico', sg: 3.10, description: 'Mezcla Cu-Pb-Zn-Fe' },
    { name: 'Pirita / Hierro', sg: 4.80, description: 'Sulfuros masivos de hierro' }
  ];

  /** Rangos de medición recomendados por garganta (USBR Water Measurement Manual). */
  readonly parshallThroats: { key: string; label: string; C: number; n: number; minCm: number; maxCm: number }[] = [
    { key: '3in', label: '3 pulgadas (7.6 cm)', C: 0.176, n: 1.547, minCm: 3, maxCm: 33 },
    { key: '6in', label: '6 pulgadas (15.2 cm)', C: 0.381, n: 1.580, minCm: 3, maxCm: 45 },
    { key: '9in', label: '9 pulgadas (22.9 cm)', C: 0.535, n: 1.530, minCm: 3, maxCm: 61 },
    { key: '12in', label: '12 pulgadas / 1 pie (30.5 cm · estándar de planta)', C: 0.690, n: 1.522, minCm: 3, maxCm: 76 },
    { key: '24in', label: '24 pulgadas / 2 pies (61.0 cm)', C: 1.428, n: 1.550, minCm: 4.6, maxCm: 76 },
    { key: '36in', label: '36 pulgadas / 3 pies (91.4 cm)', C: 2.182, n: 1.566, minCm: 4.6, maxCm: 76 }
  ];

  readonly defaults: CalcValues = {
    marcyWeightGrams: 1420,
    marcyGs: 2.70,
    waterDensity: 1.00,
    flocPulpFlowM3h: 1850,
    flocSolidsWeightPct: 62,
    flocGs: 2.70,
    flocTargetDoseGpt: 18,
    flocMotherConcPct: 0.10,
    dilInitialPulpFlowM3h: 1600,
    dilInitialSolidsPct: 65,
    dilTargetSolidsPct: 52,
    dilGs: 2.70,
    parshallThroatKey: '12in',
    parshallHeadCm: 18.5
  };

  /** Valores actuales (null = campo vacío). */
  v: CalcValues = { ...this.defaults };

  private readonly fields: Record<CalculatorTab, { main: FieldDef[]; advanced: FieldDef[] }> = {
    MARCY: {
      main: [
        { key: 'marcyWeightGrams', label: 'Peso de 1 litro de pulpa (jarra Marcy)', unit: 'g', min: 1000, max: 3000, step: 5, slider: [1000, 2400], help: 'Peso neto de la jarra llena hasta 1,000 cc.' }
      ],
      advanced: [
        { key: 'marcyGs', label: 'Gravedad específica del sólido seco', unit: '', min: 1.5, max: 8, step: 0.01, help: 'Típico en mina: 2.65 a 2.85.' },
        { key: 'waterDensity', label: 'Densidad del agua', unit: 'g/cm³', min: 0.95, max: 1.1, step: 0.01, help: '1.00 a temperatura ambiente.' }
      ]
    },
    FLOCCULANT: {
      main: [
        { key: 'flocPulpFlowM3h', label: 'Caudal de pulpa', unit: 'm³/h', min: 1, max: 20000, step: 10, help: 'Lectura del flujómetro de alimentación.' },
        { key: 'flocSolidsWeightPct', label: 'Sólidos en peso', unit: '%', min: 1, max: 80, step: 0.5, slider: [10, 75] },
        { key: 'flocTargetDoseGpt', label: 'Dosis objetivo de floculante', unit: 'g/t', min: 0.1, max: 200, step: 0.5, slider: [5, 60], help: 'Gramos por tonelada seca. Habitual en relaves: 12 a 25 g/t.' }
      ],
      advanced: [
        { key: 'flocGs', label: 'Gravedad específica del sólido seco', unit: '', min: 1.5, max: 8, step: 0.01 }
      ]
    },
    DILUTION: {
      main: [
        { key: 'dilInitialPulpFlowM3h', label: 'Caudal actual de pulpa', unit: 'm³/h', min: 1, max: 20000, step: 10 },
        { key: 'dilInitialSolidsPct', label: 'Sólidos actuales', unit: '%', min: 1, max: 85, step: 0.5, slider: [30, 75] },
        { key: 'dilTargetSolidsPct', label: 'Sólidos deseados', unit: '%', min: 1, max: 85, step: 0.5, slider: [20, 65], help: 'Debe ser menor que los sólidos actuales.' }
      ],
      advanced: [
        { key: 'dilGs', label: 'Gravedad específica del sólido seco', unit: '', min: 1.5, max: 8, step: 0.01 }
      ]
    },
    PARSHALL: {
      main: [
        { key: 'parshallHeadCm', label: 'Altura de agua en la regla (Ha)', unit: 'cm', min: 0.5, max: 120, step: 0.1, slider: [3, 80], help: 'Leída a 2/3 de la sección convergente del aforador.' }
      ],
      advanced: []
    }
  };

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Definición activa ---

  get activeTabDef(): TabDef {
    return this.tabs.find(t => t.id === this.activeTab) ?? this.tabs[0];
  }

  get mainFields(): FieldDef[] {
    return this.fields[this.activeTab].main;
  }

  get advancedFields(): FieldDef[] {
    return this.fields[this.activeTab].advanced;
  }

  get advancedSummary(): string {
    switch (this.activeTab) {
      case 'MARCY': return `G.E. ${this.fmtRaw(this.v.marcyGs)} · agua ${this.fmtRaw(this.v.waterDensity)} g/cm³`;
      case 'FLOCCULANT': return `G.E. ${this.fmtRaw(this.v.flocGs)} · solución ${this.v.flocMotherConcPct} %`;
      case 'DILUTION': return `G.E. ${this.fmtRaw(this.v.dilGs)}`;
      default: return `Q = ${this.parshall.C} · Ha^${this.parshall.n}`;
    }
  }

  get formulaText(): string {
    switch (this.activeTab) {
      case 'MARCY': return '% sólidos = G.E. × (ρ pulpa − ρ agua) / [ρ pulpa × (G.E. − ρ agua)] × 100';
      case 'FLOCCULANT': return 'L/h bomba = (t secas/h × dosis g/t) / concentración g/L';
      case 'DILUTION': return 'Agua = t secas/h × (1/%deseado − 1/%actual)';
      default: return `Q (m³/s) = ${this.parshall.C} × Ha(m)^${this.parshall.n}`;
    }
  }

  // --- Validación ---

  /** Mensaje de error por campo del cálculo activo (vacío si todo es válido). */
  get errors(): Partial<Record<keyof CalcValues, string>> {
    const out: Partial<Record<keyof CalcValues, string>> = {};
    const { main, advanced } = this.fields[this.activeTab];
    for (const f of [...main, ...advanced]) {
      const value = this.v[f.key] as number | null;
      if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
        out[f.key] = 'Dato requerido';
      } else if (value < f.min || value > f.max) {
        out[f.key] = `Debe estar entre ${this.fmtRaw(f.min)} y ${this.fmtRaw(f.max)}${f.unit ? ' ' + f.unit : ''}`;
      }
    }
    if (this.activeTab === 'DILUTION' && !out.dilTargetSolidsPct && !out.dilInitialSolidsPct &&
        (this.v.dilTargetSolidsPct as number) >= (this.v.dilInitialSolidsPct as number)) {
      out.dilTargetSolidsPct = `Debe ser menor que los sólidos actuales (${this.v.dilInitialSolidsPct} %)`;
    }
    if (this.activeTab === 'MARCY' && !out.marcyWeightGrams && !out.waterDensity &&
        (this.v.marcyWeightGrams as number) / 1000 <= (this.v.waterDensity as number)) {
      out.marcyWeightGrams = 'La pulpa debe pesar más que 1 litro de agua';
    }
    return out;
  }

  // Accesores para la plantilla del campo (el contexto de ng-template no está tipado)
  fieldValue(f: FieldDef): number | null {
    return this.v[f.key];
  }

  fieldError(f: FieldDef): string | undefined {
    return this.errors[f.key];
  }

  fieldDefault(f: FieldDef): number | null {
    return this.defaults[f.key];
  }

  get isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  get advancedHasError(): boolean {
    const errs = this.errors;
    return this.advancedFields.some(f => !!errs[f.key]);
  }

  /** Aviso no bloqueante (el resultado se muestra, pero con menor confiabilidad). */
  get warning(): string | null {
    if (this.activeTab === 'PARSHALL') {
      const h = this.num('parshallHeadCm');
      const t = this.parshall;
      if (h < t.minCm || h > t.maxCm) {
        return `La altura está fuera del rango de medición de esta garganta (${t.minCm} a ${t.maxCm} cm); el caudal es solo referencial.`;
      }
    }
    if (this.activeTab === 'FLOCCULANT' && this.flocPumpFlowLmin > 0 && this.flocPumpFlowLmin < 0.05) {
      return 'Caudal de bomba muy bajo: revise la concentración de la solución.';
    }
    return null;
  }

  // --- Respuesta principal y resultados complementarios ---

  get hero(): HeroResult {
    switch (this.activeTab) {
      case 'MARCY':
        return {
          label: 'Sólidos en peso',
          value: this.fmt(this.marcySolidsWeightPct, 2),
          unit: '%',
          action: `Pulpa de ${this.fmt(this.marcyPulpDensity, 3)} g/cm³ (${this.fmt(this.marcyPulpDensity * 1000, 0)} kg/m³).`
        };
      case 'FLOCCULANT':
        return {
          label: 'Calibra la bomba dosificadora a',
          value: this.fmt(this.flocPumpFlowLmin, 2),
          unit: 'L/min',
          action: `${this.fmt(this.flocPumpFlowLh, 0)} L/h para aplicar ${this.v.flocTargetDoseGpt} g/t a ${this.fmt(this.flocDryTonnageTmh, 1)} t secas/h.`
        };
      case 'DILUTION':
        return {
          label: 'Agrega agua de proceso',
          value: this.fmt(this.dilWaterAdditionM3h, 1),
          unit: 'm³/h',
          action: `${this.fmt(this.dilWaterAdditionM3h * 1000 / 3600, 1)} L/s al cajón: la densidad baja de ${this.fmt(this.dilInitialDensity, 3)} a ${this.fmt(this.dilFinalDensity, 3)} g/cm³.`
        };
      default:
        return {
          label: 'Caudal en el canal',
          value: this.fmt(this.parshallFlowLs, 2),
          unit: 'L/s',
          action: `${this.fmt(this.parshallFlowM3h, 1)} m³/h · ${this.fmt(this.parshallFlowM3h * 12, 0)} m³ por turno de 12 h.`
        };
    }
  }

  get secondaryResults(): SecondaryResult[] {
    switch (this.activeTab) {
      case 'MARCY':
        return [
          { label: 'Densidad de pulpa', value: this.fmt(this.marcyPulpDensity, 3), unit: 'g/cm³' },
          { label: 'Sólidos en volumen', value: this.fmt(this.marcySolidsVolPct, 2), unit: '%' },
          { label: 'Sólidos por litro', value: this.fmt(this.marcyConcentrationGL, 1), unit: 'g/L' },
          { label: 'Relación agua / sólido', value: this.fmt(this.marcyWaterSolidRatio, 2), unit: 't/t', sub: 'Para balance hídrico' },
          { label: 'Agua en 1 litro', value: this.fmt(this.marcyWaterGrams, 0), unit: 'g', sub: `≈ ${this.fmt(this.marcyWaterGrams, 0)} cc de agua` }
        ];
      case 'FLOCCULANT':
        return [
          { label: 'Mineral seco tratado', value: this.fmt(this.flocDryTonnageTmh, 1), unit: 't/h' },
          { label: 'Floculante en polvo', value: this.fmt(this.flocConsumpKgDay, 1), unit: 'kg/día', sub: `${this.fmt(this.flocConsumpKgDay / 24, 2)} kg/h` },
          { label: 'Densidad de pulpa', value: this.fmt(this.flocPulpDensity, 3), unit: 'g/cm³' },
          { label: 'Pulpa húmeda', value: this.fmt(this.flocDryTonnageTmh / (this.num('flocSolidsWeightPct') / 100), 1), unit: 't/h' }
        ];
      case 'DILUTION':
        return [
          { label: 'Agua a inyectar', value: this.fmt(this.dilWaterAdditionM3h * 1000 / 60, 0), unit: 'L/min' },
          { label: 'Nuevo caudal de pulpa', value: this.fmt(this.dilFinalPulpFlowM3h, 1), unit: 'm³/h' },
          { label: 'Mineral seco', value: this.fmt(this.dilDryTonnageTmh, 1), unit: 't/h', sub: 'No cambia al diluir' },
          { label: 'Densidad final', value: this.fmt(this.dilFinalDensity, 3), unit: 'g/cm³', sub: `Inicial: ${this.fmt(this.dilInitialDensity, 3)} g/cm³` }
        ];
      default:
        return [
          { label: 'Caudal horario', value: this.fmt(this.parshallFlowM3h, 1), unit: 'm³/h' },
          { label: 'Caudal por minuto', value: this.fmt(this.parshallFlowLs * 60, 0), unit: 'L/min' },
          { label: 'Volumen por turno', value: this.fmt(this.parshallFlowM3h * 12, 0), unit: 'm³', sub: 'Turno de 12 horas' }
        ];
    }
  }

  // --- 1. Balanza Marcy ---

  get marcyPulpDensity(): number {
    return this.num('marcyWeightGrams') / 1000;
  }

  get marcySolidsWeightPct(): number {
    const rhoP = this.marcyPulpDensity;
    const gs = this.num('marcyGs');
    const rhoW = this.num('waterDensity');
    if (rhoP <= rhoW || gs <= rhoW) return 0;
    return Math.min(100, (gs * (rhoP - rhoW)) / (rhoP * (gs - rhoW)) * 100);
  }

  get marcySolidsVolPct(): number {
    const rhoP = this.marcyPulpDensity;
    const gs = this.num('marcyGs');
    const rhoW = this.num('waterDensity');
    if (rhoP <= rhoW || gs <= rhoW) return 0;
    return Math.min(100, (rhoP - rhoW) / (gs - rhoW) * 100);
  }

  get marcyConcentrationGL(): number {
    return this.marcyPulpDensity * (this.marcySolidsWeightPct / 100) * 1000;
  }

  get marcyWaterSolidRatio(): number {
    const cw = this.marcySolidsWeightPct;
    return cw > 0 ? (100 - cw) / cw : 0;
  }

  get marcyWaterGrams(): number {
    const solidsGrams = 1000 * this.marcyPulpDensity * (this.marcySolidsWeightPct / 100);
    return Math.max(0, this.num('marcyWeightGrams') - solidsGrams);
  }

  // --- 2. Floculante ---

  get flocPulpDensity(): number {
    const cw = this.num('flocSolidsWeightPct') / 100;
    const gs = this.num('flocGs');
    if (cw <= 0 || gs <= 0) return 1;
    return 1 / (cw / gs + (1 - cw));
  }

  get flocDryTonnageTmh(): number {
    return this.num('flocPulpFlowM3h') * this.flocPulpDensity * (this.num('flocSolidsWeightPct') / 100);
  }

  get flocConsumpGHour(): number {
    return this.flocDryTonnageTmh * this.num('flocTargetDoseGpt');
  }

  get flocConsumpKgDay(): number {
    return (this.flocConsumpGHour * 24) / 1000;
  }

  get flocPumpFlowLh(): number {
    const concGL = this.num('flocMotherConcPct') * 10; // 0.10 % = 1.0 g/L
    return concGL > 0 ? this.flocConsumpGHour / concGL : 0;
  }

  get flocPumpFlowLmin(): number {
    return this.flocPumpFlowLh / 60;
  }

  // --- 3. Dilución ---

  private densityFor(cwPct: number, gs: number): number {
    const cw = Math.max(0, Math.min(0.99, cwPct / 100));
    return 1 / (cw / gs + (1 - cw));
  }

  get dilInitialDensity(): number {
    return this.densityFor(this.num('dilInitialSolidsPct'), this.num('dilGs'));
  }

  get dilFinalDensity(): number {
    return this.densityFor(this.num('dilTargetSolidsPct'), this.num('dilGs'));
  }

  get dilDryTonnageTmh(): number {
    return this.num('dilInitialPulpFlowM3h') * this.dilInitialDensity * (this.num('dilInitialSolidsPct') / 100);
  }

  get dilFinalPulpFlowM3h(): number {
    const cw = this.num('dilTargetSolidsPct') / 100;
    if (cw <= 0 || this.dilFinalDensity <= 0) return 0;
    return (this.dilDryTonnageTmh / cw) / this.dilFinalDensity;
  }

  get dilWaterAdditionM3h(): number {
    const initialCw = this.num('dilInitialSolidsPct') / 100;
    const targetCw = this.num('dilTargetSolidsPct') / 100;
    if (initialCw <= 0 || targetCw <= 0 || targetCw >= initialCw) return 0;
    const dry = this.dilDryTonnageTmh;
    return Math.max(0, (dry / targetCw - dry) - (dry / initialCw - dry));
  }

  // --- 4. Parshall ---

  get parshall() {
    return this.parshallThroats.find(t => t.key === this.v.parshallThroatKey) ?? this.parshallThroats[3];
  }

  get parshallFlowM3s(): number {
    const h = Math.max(0, this.num('parshallHeadCm') / 100);
    return this.parshall.C * Math.pow(h, this.parshall.n);
  }

  get parshallFlowM3h(): number {
    return this.parshallFlowM3s * 3600;
  }

  get parshallFlowLs(): number {
    return this.parshallFlowM3s * 1000;
  }

  // --- Acciones ---

  ngOnInit(): void {
    this.loadSavedState();
  }

  setTab(tab: CalculatorTab): void {
    this.activeTab = tab;
    this.saveState();
  }

  /** Actualiza un valor y lo guarda en este equipo (los campos vacíos quedan como null). */
  setValue(key: keyof CalcValues, value: unknown): void {
    if (key === 'parshallThroatKey') {
      this.v = { ...this.v, parshallThroatKey: String(value) };
    } else {
      const n = value === '' || value === null || value === undefined ? null : Number(value);
      this.v = { ...this.v, [key]: n !== null && Number.isNaN(n) ? null : n };
    }
    this.scheduleSave();
  }

  resetActiveCalculator(): void {
    const keys: (keyof CalcValues)[] = [...this.fields[this.activeTab].main, ...this.fields[this.activeTab].advanced].map(f => f.key);
    if (this.activeTab === 'FLOCCULANT') keys.push('flocMotherConcPct');
    if (this.activeTab === 'PARSHALL') keys.push('parshallThroatKey');
    const next = { ...this.v };
    for (const k of keys) (next as any)[k] = this.defaults[k];
    this.v = next;
    this.saveState();
  }

  copySummaryToClipboard(): void {
    if (!this.isValid) return;
    const tab = this.activeTabDef;
    const inputs = [...this.mainFields, ...this.advancedFields]
      .map(f => `• ${f.label}: ${this.fmtRaw(this.v[f.key] as number)}${f.unit ? ' ' + f.unit : ''}`);
    if (this.activeTab === 'PARSHALL') inputs.unshift(`• Garganta: ${this.parshall.label}`);
    if (this.activeTab === 'FLOCCULANT') inputs.push(`• Solución preparada: ${this.v.flocMotherConcPct} %`);
    const hero = this.hero;
    const summary = [
      `${tab.icon} BASETRACK - ${tab.heading.toUpperCase()}`,
      ...inputs,
      `➡️ ${hero.label}: ${hero.value} ${hero.unit}`,
      `   ${hero.action}`,
      ...this.secondaryResults.map(r => `• ${r.label}: ${r.value} ${r.unit}`),
      ...(this.warning ? [`⚠️ ${this.warning}`] : [])
    ].join('\n');

    copyToClipboard(summary).then((success) => {
      if (success) {
        this.copied = true;
        setTimeout(() => (this.copied = false), 2500);
      }
    });
  }

  // --- Utilidades ---

  /** Valor numérico de un campo (0 si está vacío; la validación impide mostrar ese resultado). */
  private num(key: keyof CalcValues): number {
    const value = this.v[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  fmt(value: number, decimals: number): string {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  private fmtRaw(value: number | null | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('es-PE', { maximumFractionDigits: 3 }) : '—';
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveState(), 400);
  }

  /** Guarda los valores solo en este equipo (clave local: no se replica a otras terminales). */
  private saveState(): void {
    saveRealtimeData(STORAGE_KEY, { activeTab: this.activeTab, ...this.v }, { skipBroadcast: true });
  }

  private loadSavedState(): void {
    const saved = getRealtimeData<any>(STORAGE_KEY, null);
    if (!saved || typeof saved !== 'object') return;
    if (this.tabs.some(t => t.id === saved.activeTab)) this.activeTab = saved.activeTab;
    const next = { ...this.v };
    for (const key of Object.keys(this.defaults) as (keyof CalcValues)[]) {
      const value = saved[key];
      if (key === 'parshallThroatKey') {
        if (this.parshallThroats.some(t => t.key === value)) next.parshallThroatKey = value;
      } else if (value === null || (typeof value === 'number' && Number.isFinite(value))) {
        (next as any)[key] = value;
      }
    }
    this.v = next;
  }
}
