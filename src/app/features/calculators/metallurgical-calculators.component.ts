import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type CalculatorTab = 'MARCY' | 'FLOCCULANT' | 'DILUTION' | 'PARSHALL';

interface MineralPreset {
  name: string;
  sg: number;
  description: string;
}

@Component({
  selector: 'app-metallurgical-calculators',
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
          <h2>Calculadora Metalúrgica y de Terreno</h2>
          <p class="subtitle">
            Cálculos de densidad por Balanza Marcy, dosificación de floculante, dilución de pulpa y aforo en canales
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
          <button type="button" class="btn btn-primary" (click)="copySummaryToClipboard()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>{{ copied ? '¡Copiado!' : 'Copiar Resultados' }}</span>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="calc-tabs-bar glass-panel">
        <button
          type="button"
          class="calc-tab-btn"
          [class.active]="activeTab === 'MARCY'"
          (click)="setTab('MARCY')"
        >
          <span class="tab-icon">⚖️</span>
          <div class="tab-meta">
            <span class="tab-title">Balanza Marcy</span>
            <span class="tab-sub">Densidad y % Sólidos</span>
          </div>
        </button>

        <button
          type="button"
          class="calc-tab-btn"
          [class.active]="activeTab === 'FLOCCULANT'"
          (click)="setTab('FLOCCULANT')"
        >
          <span class="tab-icon">🧪</span>
          <div class="tab-meta">
            <span class="tab-title">Floculante</span>
            <span class="tab-sub">Dosificación y Flujo (l/min)</span>
          </div>
        </button>

        <button
          type="button"
          class="calc-tab-btn"
          [class.active]="activeTab === 'DILUTION'"
          (click)="setTab('DILUTION')"
        >
          <span class="tab-icon">💧</span>
          <div class="tab-meta">
            <span class="tab-title">Dilución de Pulpa</span>
            <span class="tab-sub">Agua de ajuste para bombas</span>
          </div>
        </button>

        <button
          type="button"
          class="calc-tab-btn"
          [class.active]="activeTab === 'PARSHALL'"
          (click)="setTab('PARSHALL')"
        >
          <span class="tab-icon">🌊</span>
          <div class="tab-meta">
            <span class="tab-title">Aforador Parshall</span>
            <span class="tab-sub">Caudal en Canales (m³/h)</span>
          </div>
        </button>
      </div>

      <!-- CALCULATOR 1: BALANZA MARCY -->
      <div class="calc-card glass-panel" *ngIf="activeTab === 'MARCY'">
        <div class="calc-header-row">
          <div>
            <h3>⚖️ Cálculo de Balanza Marcy (Jarra de 1,000 cc)</h3>
            <p class="calc-desc">
              Determina la densidad de pulpa, % de sólidos en peso/volumen y concentración a partir del peso de 1 litro de pulpa.
            </p>
          </div>
          <div class="calc-pill-badge">Fórmula Estándar Marcy</div>
        </div>

        <!-- Presets de Mineral -->
        <div class="presets-row">
          <span class="presets-label">Presets de Gravedad Específica ($G_s$):</span>
          <div class="preset-buttons">
            <button
              type="button"
              *ngFor="let p of mineralPresets"
              class="preset-btn"
              [class.selected]="marcyGs === p.sg"
              (click)="marcyGs = p.sg"
              [title]="p.description"
            >
              {{ p.name }} ({{ p.sg }})
            </button>
          </div>
        </div>

        <div class="calc-grid-layout">
          <!-- Inputs Column -->
          <div class="calc-inputs-pane">
            <h4 class="pane-title">1. Parámetros de Entrada</h4>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>Peso de Muestra en Balanza (Gramos para 1,000 cc):</label>
                <span class="value-highlight">{{ marcyWeightGrams }} g</span>
              </div>
              <input
                type="range"
                min="1000"
                max="2400"
                step="5"
                [(ngModel)]="marcyWeightGrams"
                class="range-slider"
              />
              <div class="quick-input-row">
                <input
                  type="number"
                  min="1000"
                  max="2500"
                  [(ngModel)]="marcyWeightGrams"
                  class="form-control"
                  placeholder="Ej. 1420"
                />
                <span class="unit-tag">gramos</span>
              </div>
            </div>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>Gravedad Específica de Sólidos Secos ($G_s$ / S.G.):</label>
                <span class="value-highlight">{{ marcyGs }}</span>
              </div>
              <input
                type="number"
                step="0.05"
                min="1.5"
                max="6.0"
                [(ngModel)]="marcyGs"
                class="form-control"
              />
              <small class="helper-text">Densidad seca del mineral típico en mina: 2.65 a 2.85.</small>
            </div>

            <div class="input-field-group">
              <label>Densidad del Agua Líquida (ρ_w):</label>
              <input type="number" step="0.01" [(ngModel)]="waterDensity" class="form-control" />
              <small class="helper-text">1.00 g/cm³ a temperatura ambiente de planta.</small>
            </div>
          </div>

          <!-- Results Column -->
          <div class="calc-results-pane">
            <h4 class="pane-title">2. Resultados Metalúrgicos Calculados</h4>

            <div class="kpi-cards-grid">
              <div class="kpi-card highlight-cobalt">
                <span class="kpi-title">Densidad de Pulpa (ρ_p)</span>
                <div class="kpi-number">{{ marcyPulpDensity.toFixed(3) }} <small>g/cm³</small></div>
                <span class="kpi-sub">Equivale a {{ (marcyPulpDensity * 1000).toFixed(0) }} kg/m³</span>
              </div>

              <div class="kpi-card highlight-emerald">
                <span class="kpi-title">% Sólidos en Peso ($C_w$)</span>
                <div class="kpi-number">{{ marcySolidsWeightPct.toFixed(2) }} <small>%</small></div>
                <div class="progress-bar-wrap">
                  <div class="progress-fill" [style.width.%]="marcySolidsWeightPct"></div>
                </div>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">% Sólidos en Volumen ($C_v$)</span>
                <div class="kpi-number">{{ marcySolidsVolPct.toFixed(2) }} <small>%</small></div>
                <span class="kpi-sub">Fracción volumétrica sólida</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Concentración de Sólidos ($C_s$)</span>
                <div class="kpi-number">{{ marcyConcentrationGL.toFixed(1) }} <small>g/L</small></div>
                <span class="kpi-sub">Gramos de sólido por litro de pulpa</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Relación Agua / Sólido (R_w/s)</span>
                <div class="kpi-number">{{ marcyWaterSolidRatio.toFixed(2) }} <small>t agua / t sól</small></div>
                <span class="kpi-sub">Para balance hídrico</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Masa de Agua en 1 Litro</span>
                <div class="kpi-number">{{ marcyWaterGrams.toFixed(1) }} <small>g H₂O</small></div>
                <span class="kpi-sub">Volumen de agua: {{ marcyWaterGrams.toFixed(0) }} cc</span>
              </div>
            </div>

            <!-- Formula reference box -->
            <div class="formula-box">
              <strong>Fórmula Aplicada:</strong>
              <code>C_w (%) = [ G_s * (ρ_p - 1) ] / [ ρ_p * (G_s - 1) ] * 100</code>
            </div>
          </div>
        </div>
      </div>

      <!-- CALCULATOR 2: DOSIFICACIÓN DE FLOCULANTE -->
      <div class="calc-card glass-panel" *ngIf="activeTab === 'FLOCCULANT'">
        <div class="calc-header-row">
          <div>
            <h3>🧪 Dosificación de Floculante (Espesadores & Relaves)</h3>
            <p class="calc-desc">
              Calcula el tonelaje de mineral seco tratado, consumo diario de reactivo puro y caudal de inyección de la bomba dosificadora en litros por minuto.
            </p>
          </div>
          <div class="calc-pill-badge">Espesadores Slurry</div>
        </div>

        <div class="calc-grid-layout">
          <!-- Inputs Column -->
          <div class="calc-inputs-pane">
            <h4 class="pane-title">1. Parámetros de Operación</h4>

            <div class="input-field-group">
              <label>Caudal Volumétrico de Pulpa ($Q_p$ en m³/h):</label>
              <input type="number" min="10" max="10000" [(ngModel)]="flocPulpFlowM3h" class="form-control" />
              <small class="helper-text">Caudal de alimentación medido por flujómetro magnético.</small>
            </div>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>% de Sólidos en Peso ($C_w$):</label>
                <span class="value-highlight">{{ flocSolidsWeightPct }} %</span>
              </div>
              <input
                type="range"
                min="10"
                max="75"
                step="0.5"
                [(ngModel)]="flocSolidsWeightPct"
                class="range-slider"
              />
              <input type="number" min="5" max="80" [(ngModel)]="flocSolidsWeightPct" class="form-control" />
            </div>

            <div class="input-field-group">
              <label>Gravedad Específica de Sólidos ($G_s$):</label>
              <input type="number" step="0.05" [(ngModel)]="flocGs" class="form-control" />
            </div>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>Dosis Objetivo de Floculante Seco (g/TMS):</label>
                <span class="value-highlight">{{ flocTargetDoseGpt }} g/t</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="1"
                [(ngModel)]="flocTargetDoseGpt"
                class="range-slider"
              />
              <input type="number" min="1" max="100" [(ngModel)]="flocTargetDoseGpt" class="form-control" />
              <small class="helper-text">Rango habitual en espesadores de relaves: 12 a 25 g/TMS.</small>
            </div>

            <div class="input-field-group">
              <label>Concentración de Solución Madre (% peso/vol):</label>
              <select [(ngModel)]="flocMotherConcPct" class="form-control">
                <option [ngValue]="0.05">0.05 % (0.5 g/L)</option>
                <option [ngValue]="0.10">0.10 % (1.0 g/L - Estándar Planta)</option>
                <option [ngValue]="0.15">0.15 % (1.5 g/L)</option>
                <option [ngValue]="0.20">0.20 % (2.0 g/L)</option>
                <option [ngValue]="0.25">0.25 % (2.5 g/L)</option>
              </select>
            </div>
          </div>

          <!-- Results Column -->
          <div class="calc-results-pane">
            <h4 class="pane-title">2. Régimen de Dosificación Recomendado</h4>

            <div class="kpi-cards-grid">
              <div class="kpi-card highlight-cobalt">
                <span class="kpi-title">Caudal Bomba Dosificadora</span>
                <div class="kpi-number">{{ flocPumpFlowLmin.toFixed(2) }} <small>L/min</small></div>
                <span class="kpi-sub">Ajuste de bomba en terreno</span>
              </div>

              <div class="kpi-card highlight-emerald">
                <span class="kpi-title">Caudal de Dosificación Horario</span>
                <div class="kpi-number">{{ flocPumpFlowLh.toFixed(1) }} <small>L/h</small></div>
                <span class="kpi-sub">Equivale a {{ (flocPumpFlowLh / 1000).toFixed(3) }} m³/h</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Masa Tratada (TMS/h)</span>
                <div class="kpi-number">{{ flocDryTonnageTmh.toFixed(1) }} <small>TMS/h</small></div>
                <span class="kpi-sub">Toneladas métricas secas por hora</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Consumo Floculante Puro</span>
                <div class="kpi-number">{{ (flocConsumpKgDay).toFixed(1) }} <small>kg/día</small></div>
                <span class="kpi-sub">{{ (flocConsumpKgDay / 24).toFixed(2) }} kg/h de polvo seco</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Densidad de Pulpa Estimada</span>
                <div class="kpi-number">{{ flocPulpDensity.toFixed(3) }} <small>g/cm³</small></div>
                <span class="kpi-sub">{{ (flocPulpDensity * 1000).toFixed(0) }} kg/m³</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Masa Total Húmeda Horaria</span>
                <div class="kpi-number">{{ (flocDryTonnageTmh / (flocSolidsWeightPct / 100)).toFixed(1) }} <small>TMH/h</small></div>
                <span class="kpi-sub">Pulpa húmeda total</span>
              </div>
            </div>

            <div class="operational-advice-card">
              <span class="advice-icon">💡</span>
              <div>
                <strong>Ajuste Operativo:</strong>
                Para dosificar <strong>{{ flocTargetDoseGpt }} g/t</strong> a un caudal de <strong>{{ flocPulpFlowM3h }} m³/h</strong>,
                calibre la bomba peristáltica / pistón a <strong>{{ flocPumpFlowLmin.toFixed(2) }} Litros por minuto</strong> ({{ flocPumpFlowLh.toFixed(0) }} L/h).
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CALCULATOR 3: DILUCIÓN DE PULPA -->
      <div class="calc-card glass-panel" *ngIf="activeTab === 'DILUTION'">
        <div class="calc-header-row">
          <div>
            <h3>💧 Dilución de Pulpa y Adición de Agua de Proceso</h3>
            <p class="calc-desc">
              Determina exactamente cuánta agua de dilución (en m³/h y L/s) se debe inyectar al cajón de bombas para bajar la densidad de pulpa al valor de clasificación óptimo.
            </p>
          </div>
          <div class="calc-pill-badge">Ajuste de Bombeo</div>
        </div>

        <div class="calc-grid-layout">
          <!-- Inputs Column -->
          <div class="calc-inputs-pane">
            <h4 class="pane-title">1. Estado Inicial y Objetivo</h4>

            <div class="input-field-group">
              <label>Caudal Inicial de Pulpa Gruesa ($Q_1$ en m³/h):</label>
              <input type="number" min="10" max="10000" [(ngModel)]="dilInitialPulpFlowM3h" class="form-control" />
            </div>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>% Sólidos Inicial (Cw1):</label>
                <span class="value-highlight">{{ dilInitialSolidsPct }} %</span>
              </div>
              <input
                type="range"
                min="30"
                max="75"
                step="0.5"
                [(ngModel)]="dilInitialSolidsPct"
                class="range-slider"
              />
              <input type="number" [(ngModel)]="dilInitialSolidsPct" class="form-control" />
            </div>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>% Sólidos Deseado / Objetivo (Cw2):</label>
                <span class="value-highlight">{{ dilTargetSolidsPct }} %</span>
              </div>
              <input
                type="range"
                min="20"
                max="65"
                step="0.5"
                [(ngModel)]="dilTargetSolidsPct"
                class="range-slider"
              />
              <input type="number" [(ngModel)]="dilTargetSolidsPct" class="form-control" />
              <small class="helper-text">Debe ser menor que el % inicial para ser dilución.</small>
            </div>

            <div class="input-field-group">
              <label>Gravedad Específica de Sólidos ($G_s$):</label>
              <input type="number" step="0.05" [(ngModel)]="dilGs" class="form-control" />
            </div>
          </div>

          <!-- Results Column -->
          <div class="calc-results-pane">
            <h4 class="pane-title">2. Caudal de Agua de Inyección Requerido</h4>

            <div class="alert-box" *ngIf="dilTargetSolidsPct >= dilInitialSolidsPct">
              ⚠️ El % objetivo debe ser estrictamente menor que el inicial para calcular dilución con agua.
            </div>

            <div class="kpi-cards-grid" *ngIf="dilTargetSolidsPct < dilInitialSolidsPct">
              <div class="kpi-card highlight-emerald">
                <span class="kpi-title">Agua de Dilución Requerida</span>
                <div class="kpi-number">{{ dilWaterAdditionM3h.toFixed(1) }} <small>m³/h</small></div>
                <span class="kpi-sub">Caudal a inyectar en cajón</span>
              </div>

              <div class="kpi-card highlight-cobalt">
                <span class="kpi-title">Flujo de Inyección en Litros</span>
                <div class="kpi-number">{{ (dilWaterAdditionM3h * 1000 / 60).toFixed(1) }} <small>L/min</small></div>
                <span class="kpi-sub">{{ (dilWaterAdditionM3h * 1000 / 3600).toFixed(2) }} Litros por segundo</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Nuevo Caudal de Pulpa ($Q_2$)</span>
                <div class="kpi-number">{{ dilFinalPulpFlowM3h.toFixed(1) }} <small>m³/h</small></div>
                <span class="kpi-sub">Caudal total resultante</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Tonelaje Sólido Seco</span>
                <div class="kpi-number">{{ dilDryTonnageTmh.toFixed(1) }} <small>TMS/h</small></div>
                <span class="kpi-sub">Masa de mineral constante</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Densidad Inicial (ρ_p1)</span>
                <div class="kpi-number">{{ dilInitialDensity.toFixed(3) }} <small>g/cm³</small></div>
                <span class="kpi-sub">{{ (dilInitialDensity * 1000).toFixed(0) }} kg/m³</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Densidad Final (ρ_p2)</span>
                <div class="kpi-number">{{ dilFinalDensity.toFixed(3) }} <small>g/cm³</small></div>
                <span class="kpi-sub">{{ (dilFinalDensity * 1000).toFixed(0) }} kg/m³</span>
              </div>
            </div>

            <div class="operational-advice-card" *ngIf="dilTargetSolidsPct < dilInitialSolidsPct">
              <span class="advice-icon">🚰</span>
              <div>
                <strong>Consigna para Operador de Bombas:</strong>
                Abra la válvula de agua de proceso hacia el cajón hasta registrar un flujo de adición de 
                <strong>{{ dilWaterAdditionM3h.toFixed(1) }} m³/h</strong> ({{ (dilWaterAdditionM3h * 1000 / 3600).toFixed(1) }} L/s). 
                La densidad descenderá de <strong>{{ dilInitialDensity.toFixed(3) }}</strong> a <strong>{{ dilFinalDensity.toFixed(3) }} g/cm³</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CALCULATOR 4: AFORADOR PARSHALL -->
      <div class="calc-card glass-panel" *ngIf="activeTab === 'PARSHALL'">
        <div class="calc-header-row">
          <div>
            <h3>🌊 Aforador Parshall y Canales de Flujo</h3>
            <p class="calc-desc">
              Calcula el caudal de escurrimiento en canaletas y aforadores Parshall estándar según la norma ASTM D1941 / Water Measurement Manual.
            </p>
          </div>
          <div class="calc-pill-badge">Canaletas Hidráulicas</div>
        </div>

        <div class="calc-grid-layout">
          <!-- Inputs Column -->
          <div class="calc-inputs-pane">
            <h4 class="pane-title">1. Parámetros de Canal</h4>

            <div class="input-field-group">
              <label>Ancho de Garganta del Aforador ($W$):</label>
              <select [(ngModel)]="parshallThroatKey" class="form-control">
                <option value="3in">3 Pulgadas (7.6 cm)</option>
                <option value="6in">6 Pulgadas (15.2 cm)</option>
                <option value="9in">9 Pulgadas (22.9 cm)</option>
                <option value="12in">12 Pulgadas / 1 Pie (30.5 cm - Estándar Planta)</option>
                <option value="24in">24 Pulgadas / 2 Pies (61.0 cm)</option>
                <option value="36in">36 Pulgadas / 3 Pies (91.4 cm)</option>
              </select>
            </div>

            <div class="input-field-group">
              <div class="label-with-val">
                <label>Altura de Lámina Medida ($H_a$ en centímetros):</label>
                <span class="value-highlight">{{ parshallHeadCm }} cm</span>
              </div>
              <input
                type="range"
                min="3"
                max="80"
                step="0.5"
                [(ngModel)]="parshallHeadCm"
                class="range-slider"
              />
              <div class="quick-input-row">
                <input
                  type="number"
                  min="1"
                  max="120"
                  step="0.1"
                  [(ngModel)]="parshallHeadCm"
                  class="form-control"
                  placeholder="Ej. 18.5"
                />
                <span class="unit-tag">cm</span>
              </div>
              <small class="helper-text">Medido en la regla graduada a 2/3 de la sección convergente.</small>
            </div>
          </div>

          <!-- Results Column -->
          <div class="calc-results-pane">
            <h4 class="pane-title">2. Caudal de Escurrimiento Calculado</h4>

            <div class="kpi-cards-grid">
              <div class="kpi-card highlight-cobalt">
                <span class="kpi-title">Caudal Volumétrico ($Q$)</span>
                <div class="kpi-number">{{ parshallFlowM3h.toFixed(1) }} <small>m³/h</small></div>
                <span class="kpi-sub">Metros cúbicos por hora</span>
              </div>

              <div class="kpi-card highlight-emerald">
                <span class="kpi-title">Caudal en Litros por Segundo</span>
                <div class="kpi-number">{{ parshallFlowLs.toFixed(2) }} <small>L/s</small></div>
                <span class="kpi-sub">Descarga instantánea</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Caudal en Litros por Minuto</span>
                <div class="kpi-number">{{ (parshallFlowLs * 60).toFixed(0) }} <small>L/min</small></div>
                <span class="kpi-sub">Régimen volumétrico</span>
              </div>

              <div class="kpi-card">
                <span class="kpi-title">Caudal Acumulado por Turno</span>
                <div class="kpi-number">{{ (parshallFlowM3h * 12).toFixed(0) }} <small>m³/turno 12h</small></div>
                <span class="kpi-sub">Volumen proyectado en 12 horas</span>
              </div>
            </div>

            <div class="formula-box">
              <strong>Fórmula Parshall Específica:</strong>
              <code>Q (m³/s) = {{ parshallConstantC }} * Ha ^ {{ parshallExponentN }}</code>
            </div>
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

    .calc-pill-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      background: var(--bg-card-subtle);
      color: var(--text-secondary);
      white-space: nowrap;
      border: 1px solid var(--border-subtle);
    }

    /* Presets Row */
    .presets-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      background: var(--bg-card-subtle);
      padding: 10px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }

    .presets-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-secondary);
    }

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
      gap: 24px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
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

    .label-with-val {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .value-highlight {
      font-size: 0.88rem;
      font-weight: 800;
      color: var(--primary-purple);
      font-family: monospace;
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

    .progress-bar-wrap {
      width: 100%;
      height: 6px;
      background: var(--gauge-track);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-top: 4px;
    }

    .progress-fill {
      height: 100%;
      background: var(--success);
      border-radius: var(--radius-full);
      transition: width 0.3s ease;
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

    .operational-advice-card {
      background: var(--primary-bg-subtle);
      border: 1px solid var(--primary-border);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.82rem;
      color: var(--text-primary);
      line-height: 1.45;

      .advice-icon {
        font-size: 1.25rem;
      }
    }

    .alert-box {
      background: var(--warning-bg);
      border: 1px solid var(--warning);
      color: var(--warning);
      padding: 10px 14px;
      border-radius: var(--radius-md);
      font-size: 0.82rem;
      font-weight: 600;
    }
  `]
})
export class MetallurgicalCalculatorsComponent implements OnInit {
  activeTab: CalculatorTab = 'MARCY';
  copied = false;

  mineralPresets: MineralPreset[] = [
    { name: 'Relaves Planta', sg: 2.70, description: 'Densidad típica de pulpa en relaves y molienda' },
    { name: 'Cuarzo / Sílice', sg: 2.65, description: 'Mineral estéril predominante' },
    { name: 'Cobre / Calcopirita', sg: 2.85, description: 'Mineral de sulfuros de cobre' },
    { name: 'Polimetálico', sg: 3.10, description: 'Mezcla Cu-Pb-Zn-Fe' },
    { name: 'Pirita / Hierro', sg: 4.80, description: 'Sulfuros masivos de hierro' }
  ];

  // 1. MARCY BALANCE STATE
  marcyWeightGrams = 1420;
  marcyGs = 2.70;
  waterDensity = 1.00;

  get marcyPulpDensity(): number {
    return Math.max(0.5, this.marcyWeightGrams / 1000);
  }

  get marcySolidsWeightPct(): number {
    const rhoP = this.marcyPulpDensity;
    const gs = this.marcyGs;
    if (rhoP <= this.waterDensity || gs <= this.waterDensity) return 0;
    const cw = (gs * (rhoP - this.waterDensity)) / (rhoP * (gs - this.waterDensity)) * 100;
    return Math.max(0, Math.min(100, cw));
  }

  get marcySolidsVolPct(): number {
    const rhoP = this.marcyPulpDensity;
    const gs = this.marcyGs;
    if (rhoP <= this.waterDensity || gs <= this.waterDensity) return 0;
    const cv = (rhoP - this.waterDensity) / (gs - this.waterDensity) * 100;
    return Math.max(0, Math.min(100, cv));
  }

  get marcyConcentrationGL(): number {
    return this.marcyPulpDensity * (this.marcySolidsWeightPct / 100) * 1000;
  }

  get marcyWaterSolidRatio(): number {
    const cw = this.marcySolidsWeightPct;
    if (cw <= 0) return 0;
    return (100 - cw) / cw;
  }

  get marcyWaterGrams(): number {
    const totalSolidsGrams = 1000 * this.marcyPulpDensity * (this.marcySolidsWeightPct / 100);
    return Math.max(0, this.marcyWeightGrams - totalSolidsGrams);
  }

  // 2. FLOCCULANT STATE
  flocPulpFlowM3h = 1850;
  flocSolidsWeightPct = 62.0;
  flocGs = 2.70;
  flocTargetDoseGpt = 18.0;
  flocMotherConcPct = 0.10; // 0.10% = 1.0 g/L

  get flocPulpDensity(): number {
    const cwFrac = this.flocSolidsWeightPct / 100;
    const gs = this.flocGs;
    if (cwFrac <= 0 || gs <= 0) return 1.0;
    return 1 / (cwFrac / gs + (1 - cwFrac));
  }

  get flocDryTonnageTmh(): number {
    const totalWetTmh = this.flocPulpFlowM3h * this.flocPulpDensity;
    return totalWetTmh * (this.flocSolidsWeightPct / 100);
  }

  get flocConsumpGHour(): number {
    return this.flocDryTonnageTmh * this.flocTargetDoseGpt;
  }

  get flocConsumpKgDay(): number {
    return (this.flocConsumpGHour * 24) / 1000;
  }

  get flocPumpFlowLh(): number {
    const concGL = this.flocMotherConcPct * 10; // 0.10% = 1.0 g/L
    if (concGL <= 0) return 0;
    return this.flocConsumpGHour / concGL;
  }

  get flocPumpFlowLmin(): number {
    return this.flocPumpFlowLh / 60;
  }

  // 3. DILUTION STATE
  dilInitialPulpFlowM3h = 1600;
  dilInitialSolidsPct = 65.0;
  dilTargetSolidsPct = 52.0;
  dilGs = 2.70;

  get dilInitialDensity(): number {
    const gs = Math.max(1.05, this.dilGs || 2.70);
    const cw = Math.max(0, Math.min(0.99, (this.dilInitialSolidsPct || 0) / 100));
    return 1 / (cw / gs + (1 - cw));
  }

  get dilFinalDensity(): number {
    const gs = Math.max(1.05, this.dilGs || 2.70);
    const cw = Math.max(0, Math.min(0.99, (this.dilTargetSolidsPct || 0) / 100));
    return 1 / (cw / gs + (1 - cw));
  }

  get dilDryTonnageTmh(): number {
    const flow = Math.max(0, this.dilInitialPulpFlowM3h || 0);
    const cwFrac = Math.max(0, (this.dilInitialSolidsPct || 0) / 100);
    return flow * this.dilInitialDensity * cwFrac;
  }

  get dilFinalPulpFlowM3h(): number {
    if (!this.dilTargetSolidsPct || this.dilTargetSolidsPct <= 0) return 0;
    const cwFrac = this.dilTargetSolidsPct / 100;
    const finalWetTmh = this.dilDryTonnageTmh / cwFrac;
    return this.dilFinalDensity > 0 ? (finalWetTmh / this.dilFinalDensity) : 0;
  }

  get dilWaterAdditionM3h(): number {
    if (!this.dilInitialSolidsPct || !this.dilTargetSolidsPct) return 0;
    if (this.dilTargetSolidsPct >= this.dilInitialSolidsPct) return 0;
    const initialCw = this.dilInitialSolidsPct / 100;
    const targetCw = this.dilTargetSolidsPct / 100;
    if (initialCw <= 0 || targetCw <= 0) return 0;
    const initialWaterTmh = (this.dilDryTonnageTmh / initialCw) - this.dilDryTonnageTmh;
    const targetWaterTmh = (this.dilDryTonnageTmh / targetCw) - this.dilDryTonnageTmh;
    return Math.max(0, targetWaterTmh - initialWaterTmh);
  }

  // 4. PARSHALL FLUME STATE
  parshallThroatKey = '12in';
  parshallHeadCm = 18.5;

  private parshallCoeffs: Record<string, { C: number; n: number; label: string }> = {
    '3in': { C: 0.176, n: 1.547, label: '3"' },
    '6in': { C: 0.381, n: 1.580, label: '6"' },
    '9in': { C: 0.535, n: 1.530, label: '9"' },
    '12in': { C: 0.690, n: 1.522, label: '12" / 1 pie' },
    '24in': { C: 1.428, n: 1.550, label: '24" / 2 pies' },
    '36in': { C: 2.182, n: 1.566, label: '36" / 3 pies' }
  };

  get parshallConstantC(): number {
    return this.parshallCoeffs[this.parshallThroatKey]?.C || 0.690;
  }

  get parshallExponentN(): number {
    return this.parshallCoeffs[this.parshallThroatKey]?.n || 1.522;
  }

  get parshallFlowM3s(): number {
    const Hmeters = Math.max(0.01, this.parshallHeadCm / 100);
    return this.parshallConstantC * Math.pow(Hmeters, this.parshallExponentN);
  }

  get parshallFlowM3h(): number {
    return this.parshallFlowM3s * 3600;
  }

  get parshallFlowLs(): number {
    return this.parshallFlowM3s * 1000;
  }

  ngOnInit(): void {
    this.loadSavedState();
  }

  setTab(tab: CalculatorTab): void {
    this.activeTab = tab;
    this.saveState();
  }

  resetActiveCalculator(): void {
    if (this.activeTab === 'MARCY') {
      this.marcyWeightGrams = 1420;
      this.marcyGs = 2.70;
    } else if (this.activeTab === 'FLOCCULANT') {
      this.flocPulpFlowM3h = 1850;
      this.flocSolidsWeightPct = 62.0;
      this.flocTargetDoseGpt = 18.0;
      this.flocMotherConcPct = 0.10;
    } else if (this.activeTab === 'DILUTION') {
      this.dilInitialPulpFlowM3h = 1600;
      this.dilInitialSolidsPct = 65.0;
      this.dilTargetSolidsPct = 52.0;
    } else if (this.activeTab === 'PARSHALL') {
      this.parshallThroatKey = '12in';
      this.parshallHeadCm = 18.5;
    }
    this.saveState();
  }

  copySummaryToClipboard(): void {
    let summary = '';
    if (this.activeTab === 'MARCY') {
      summary = `⚖️ BASETRACK - CÁLCULO DE BALANZA MARCY\n` +
        `• Peso Muestra: ${this.marcyWeightGrams} g (1000 cc)\n` +
        `• Gravedad Específica (Gs): ${this.marcyGs}\n` +
        `• Densidad de Pulpa: ${this.marcyPulpDensity.toFixed(3)} g/cm³ (${(this.marcyPulpDensity * 1000).toFixed(0)} kg/m³)\n` +
        `• % Sólidos en Peso (Cw): ${this.marcySolidsWeightPct.toFixed(2)}%\n` +
        `• % Sólidos en Volumen (Cv): ${this.marcySolidsVolPct.toFixed(2)}%\n` +
        `• Concentración Sólidos: ${this.marcyConcentrationGL.toFixed(1)} g/L\n` +
        `• Relación Agua/Sólido: ${this.marcyWaterSolidRatio.toFixed(2)} t agua / t sól`;
    } else if (this.activeTab === 'FLOCCULANT') {
      summary = `🧪 BASETRACK - DOSIFICACIÓN DE FLOCULANTE\n` +
        `• Caudal de Pulpa: ${this.flocPulpFlowM3h} m³/h\n` +
        `• % Sólidos: ${this.flocSolidsWeightPct}% | Gs: ${this.flocGs}\n` +
        `• Masa Seca Tratada: ${this.flocDryTonnageTmh.toFixed(1)} TMS/h\n` +
        `• Dosis Objetivo: ${this.flocTargetDoseGpt} g/TMS\n` +
        `• Caudal Bomba Dosificadora: ${this.flocPumpFlowLmin.toFixed(2)} L/min (${this.flocPumpFlowLh.toFixed(0)} L/h)\n` +
        `• Consumo Reactivo Puro: ${this.flocConsumpKgDay.toFixed(1)} kg/día`;
    } else if (this.activeTab === 'DILUTION') {
      summary = `💧 BASETRACK - DILUCIÓN DE PULPA\n` +
        `• Caudal Inicial: ${this.dilInitialPulpFlowM3h} m³/h (${this.dilInitialSolidsPct}% sól)\n` +
        `• % Sólidos Objetivo: ${this.dilTargetSolidsPct}%\n` +
        `• Agua Requerida: ${this.dilWaterAdditionM3h.toFixed(1)} m³/h (${(this.dilWaterAdditionM3h * 1000 / 3600).toFixed(1)} L/s)\n` +
        `• Nuevo Caudal Resultante: ${this.dilFinalPulpFlowM3h.toFixed(1)} m³/h\n` +
        `• Densidad: De ${this.dilInitialDensity.toFixed(3)} a ${this.dilFinalDensity.toFixed(3)} g/cm³`;
    } else if (this.activeTab === 'PARSHALL') {
      summary = `🌊 BASETRACK - AFORADOR PARSHALL\n` +
        `• Garganta: ${this.parshallThroatKey}\n` +
        `• Altura de Lámina (Ha): ${this.parshallHeadCm} cm\n` +
        `• Caudal Resultante: ${this.parshallFlowM3h.toFixed(1)} m³/h (${this.parshallFlowLs.toFixed(2)} L/s)\n` +
        `• Proyección Turno 12h: ${(this.parshallFlowM3h * 12).toFixed(0)} m³`;
    }

    navigator.clipboard.writeText(summary).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2500);
    });
  }

  private saveState(): void {
    try {
      const data = {
        activeTab: this.activeTab,
        marcyWeightGrams: this.marcyWeightGrams,
        marcyGs: this.marcyGs,
        flocPulpFlowM3h: this.flocPulpFlowM3h,
        flocSolidsWeightPct: this.flocSolidsWeightPct,
        flocTargetDoseGpt: this.flocTargetDoseGpt,
        dilInitialPulpFlowM3h: this.dilInitialPulpFlowM3h,
        dilInitialSolidsPct: this.dilInitialSolidsPct,
        dilTargetSolidsPct: this.dilTargetSolidsPct,
        parshallThroatKey: this.parshallThroatKey,
        parshallHeadCm: this.parshallHeadCm
      };
      localStorage.setItem('basetrack_calc_state', JSON.stringify(data));
    } catch {
      // Ignore localStorage error
    }
  }

  private loadSavedState(): void {
    try {
      const cached = localStorage.getItem('basetrack_calc_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.activeTab) this.activeTab = parsed.activeTab;
        if (parsed.marcyWeightGrams) this.marcyWeightGrams = parsed.marcyWeightGrams;
        if (parsed.marcyGs) this.marcyGs = parsed.marcyGs;
        if (parsed.flocPulpFlowM3h) this.flocPulpFlowM3h = parsed.flocPulpFlowM3h;
        if (parsed.flocSolidsWeightPct) this.flocSolidsWeightPct = parsed.flocSolidsWeightPct;
        if (parsed.flocTargetDoseGpt) this.flocTargetDoseGpt = parsed.flocTargetDoseGpt;
        if (parsed.dilInitialPulpFlowM3h) this.dilInitialPulpFlowM3h = parsed.dilInitialPulpFlowM3h;
        if (parsed.dilInitialSolidsPct) this.dilInitialSolidsPct = parsed.dilInitialSolidsPct;
        if (parsed.dilTargetSolidsPct) this.dilTargetSolidsPct = parsed.dilTargetSolidsPct;
        if (parsed.parshallThroatKey) this.parshallThroatKey = parsed.parshallThroatKey;
        if (parsed.parshallHeadCm) this.parshallHeadCm = parsed.parshallHeadCm;
      }
    } catch {
      // Ignore
    }
  }
}
