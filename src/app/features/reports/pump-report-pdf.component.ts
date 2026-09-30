import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PumpStationSheet, PumpReport } from '../pumps/pumps.component';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { CrewService } from '../../core/services/crew.service';
import { copyToClipboard } from '../../core/utils/clipboard.util';
import { getCurrentActiveShift } from '../../shared/utils/roster.util';

@Component({
  selector: 'app-pump-report-pdf',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)">
      <div class="report-modal-wrapper animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Modal Action Header (No se imprime) -->
        <div class="report-modal-header no-print">
          <div class="header-info">
            <div class="tag-badge">FORMATO OFICIAL PLANTA A4 (1 HOJA)</div>
            <h3>Reporte Integral de Bombas & Sentinas (Secciones A - E)</h3>
          </div>
          <div class="header-actions">
            <button type="button" class="btn btn-download-pdf" (click)="downloadDirectPdf()" [disabled]="isDownloading" title="Descargar archivo PDF directamente">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {{ isDownloading ? 'Guardando PDF...' : (downloadSuccess ? '¡PDF Guardado!' : 'Descargar PDF Directo') }}
            </button>
            <button type="button" class="btn btn-print" (click)="triggerPrint()" title="Imprimir documento">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir
            </button>
            <button type="button" class="btn btn-copy" (click)="copyExecutiveSummary()" [title]="copiedText ? '¡Copiado!' : 'Copiar Resumen'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {{ copiedText ? '¡Copiado!' : 'Copiar' }}
            </button>
            <button type="button" class="close-btn" (click)="closeModal()">✕</button>
          </div>
        </div>

        <!-- DOCUMENTO OFICIAL A4 IMPRIMIBLE (1 SOLA PÁGINA) -->
        <div class="report-document-body" id="printable-pump-report">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK" class="brand-img" />
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">PLANTA CONCENTRADORA — SISTEMA INTEGRAL DE BOMBEO & SENTINAS</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>CÓDIGO:</strong> <span>REP-BMB-{{ activeSheet.shift_code || 'G1' }}</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ activeSheet.report_date || todayDate }}</span></div>
              <div class="meta-row"><strong>GUARDIA:</strong> <span>{{ activeSheet.shift_code || 'G1' }}</span></div>
              <div class="meta-row"><strong>OPERADOR:</strong> <span>{{ activeSheet.operator_name || operatorName }}</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>REPORTE DIARIO DE ESTACIONES DE BOMBEO, SENTINAS Y NIVELES (FORMATO PLANTA SECCIONES A - E)</h2>
          </div>

          <!-- Resumen de Indicadores Clave (KPIs) -->
          <div class="kpi-banner-grid">
            <div class="kpi-cell">
              <span class="kpi-title">Sentina Operando</span>
              <span class="kpi-val highlight-emerald">{{ sentinaOperatingCount }} / {{ activeSheet.sentina_pumps.length || 8 }}</span>
              <span class="kpi-sub">Estación Sentina</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Intermedia Operando</span>
              <span class="kpi-val highlight-blue">{{ intermediaOperatingCount }} / {{ activeSheet.intermedia_pumps.length || 6 }}</span>
              <span class="kpi-sub">Barrera Intermedia</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Torre 5 Operando</span>
              <span class="kpi-val highlight-purple">{{ torre5OperatingCount }} / {{ activeSheet.torre5_pumps.length || 10 }}</span>
              <span class="kpi-sub">Torre 5 Impulsión</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Disponibilidad Total</span>
              <span class="kpi-val highlight-navy">{{ totalOperatingCount }} / {{ totalPumpsCount }}</span>
              <span class="kpi-sub">{{ ((totalOperatingCount / totalPumpsCount) * 100) | number:'1.0-0' }}% En Servicio</span>
            </div>
          </div>

          <!-- SECCIÓN A: REPORTE DE BOMBAS -->
          <div class="doc-section">
            <div class="section-heading">SECCIÓN A: REPORTE DE BOMBAS (SENTINA, INTERMEDIA, TORRE 5)</div>
            <table class="report-table pumps-grid-table">
              <thead>
                <tr>
                  <th colspan="2" class="th-group th-sentina">SENTINA</th>
                  <th colspan="2" class="th-group th-intermedia">INTERMEDIA</th>
                  <th colspan="2" class="th-group th-torre">TORRE 5</th>
                </tr>
                <tr class="sub-th-row">
                  <th class="col-tag">EQUIPO</th>
                  <th class="col-status">STATUS</th>
                  <th class="col-tag">EQUIPO</th>
                  <th class="col-status">STATUS</th>
                  <th class="col-tag">EQUIPO</th>
                  <th class="col-status">STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let idx of maxRowsArray">
                  <!-- Sentina (PU001 - PU008) -->
                  <td class="cell-tag font-bold">{{ activeSheet.sentina_pumps[idx]?.tag || '' }}</td>
                  <td class="cell-status">
                    <span *ngIf="activeSheet.sentina_pumps[idx]" class="pdf-status-pill" [ngClass]="getStatusClass(activeSheet.sentina_pumps[idx].status)">
                      {{ activeSheet.sentina_pumps[idx].status }}
                    </span>
                  </td>

                  <!-- Intermedia (PU011 - PU016) -->
                  <td class="cell-tag font-bold">{{ activeSheet.intermedia_pumps[idx]?.tag || '' }}</td>
                  <td class="cell-status">
                    <span *ngIf="activeSheet.intermedia_pumps[idx]" class="pdf-status-pill" [ngClass]="getStatusClass(activeSheet.intermedia_pumps[idx].status)">
                      {{ activeSheet.intermedia_pumps[idx].status }}
                    </span>
                  </td>

                  <!-- Torre 5 (PU021 - PU030) -->
                  <td class="cell-tag font-bold">{{ activeSheet.torre5_pumps[idx]?.tag || '' }}</td>
                  <td class="cell-status">
                    <span *ngIf="activeSheet.torre5_pumps[idx]" class="pdf-status-pill" [ngClass]="getStatusClass(activeSheet.torre5_pumps[idx].status)">
                      {{ activeSheet.torre5_pumps[idx].status }}
                    </span>
                  </td>
                </tr>

                <!-- Resumen de fila -->
                <tr class="summary-table-row">
                  <td colspan="2" class="summary-cell sentina-summary">
                    Sentina: <strong>{{ sentinaOperatingCount }} / {{ activeSheet.sentina_pumps.length || 8 }} Operando</strong>
                  </td>
                  <td colspan="2" class="summary-cell intermedia-summary">
                    Intermedia: <strong>{{ intermediaOperatingCount }} / {{ activeSheet.intermedia_pumps.length || 6 }} Operando</strong>
                  </td>
                  <td colspan="2" class="summary-cell torre-summary">
                    Torre 5: <strong>{{ torre5OperatingCount }} / {{ activeSheet.torre5_pumps.length || 10 }} Operando</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN B: OBSERVACIONES DE NIVELES -->
          <div class="doc-section">
            <div class="section-heading">SECCIÓN B: OBSERVACIONES DE NIVELES</div>
            <div class="levels-boxes-row">
              <div class="level-box">
                <span class="lvl-label">ORCA:</span>
                <strong class="lvl-val cyan">{{ activeSheet.levels?.orca || '---' }}</strong>
              </div>
              <div class="level-box">
                <span class="lvl-label">Espejo:</span>
                <strong class="lvl-val emerald">{{ activeSheet.levels?.espejo || '---' }}</strong>
              </div>
              <div class="level-box">
                <span class="lvl-label">Captación:</span>
                <strong class="lvl-val purple">{{ activeSheet.levels?.captacion || '---' }}</strong>
              </div>
            </div>
          </div>

          <!-- SECCIÓN C: INDICADORES PRINCIPALES -->
          <div class="doc-section">
            <div class="section-heading">SECCIÓN C: INDICADORES PRINCIPALES</div>
            <div class="indicators-dual-box">
              <div class="ind-col">
                <div class="ind-item"><span class="ind-k">Nivel de sentina (%)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.nivel_sentina || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Bombeo Turno Intermedia (m³)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.bombeo_turno_intermedia || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Nivel TKO02 (%)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.nivel_tko02 || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Aforador (m)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.aforador || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Cortafugas (l/s)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.cortafugas || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">pH aforador</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.ph_aforador || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">pH Cortafugas</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.ph_cortafugas || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">H Embalas</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.h_embalas || '---' }}</strong></div>
              </div>
              <div class="ind-col">
                <div class="ind-item"><span class="ind-k">Dique Almacenamiento (%)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.dique_almacenamiento || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Drenaje del Dique (%)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.drenaje_dique || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Agua a car</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.agua_a_car || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Anticrustante (%)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.anticrustante || '---' }}</strong></div>
                <div class="ind-item"><span class="ind-k">Torre 5 Cortafugas (%)</span><span class="ind-dots"></span><strong class="ind-v">{{ activeSheet.main_indicators?.torre5_cortafugas || '---' }}</strong></div>
                <div class="ind-item">
                  <span class="ind-k">Torre 5 Status 1</span><span class="ind-dots"></span>
                  <span class="pdf-status-pill" [ngClass]="getStatusClass(activeSheet.main_indicators?.torre5_status1 || 'Stand by')">
                    {{ activeSheet.main_indicators?.torre5_status1 || 'Stand by' }}
                  </span>
                </div>
                <div class="ind-item">
                  <span class="ind-k">Torre 5 Status 2</span><span class="ind-dots"></span>
                  <span class="pdf-status-pill" [ngClass]="getStatusClass(activeSheet.main_indicators?.torre5_status2 || 'Stand by')">
                    {{ activeSheet.main_indicators?.torre5_status2 || 'Stand by' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- SECCIÓN D: POZAS SENTINA -->
          <div class="doc-section">
            <div class="section-heading">SECCIÓN D: POZAS SENTINA</div>
            <table class="report-table compact-table">
              <thead>
                <tr>
                  <th class="th-dark-green">POZA</th>
                  <th class="th-dark-green">MEDIDA INICIAL</th>
                  <th class="th-dark-green">FLUJO INICIAL</th>
                  <th class="th-dark-green">MEDIDA FINAL</th>
                  <th class="th-dark-green">FLUJO FINAL</th>
                  <th class="th-dark-green">HORAS DE BOMBEO</th>
                  <th class="th-dark-green">ACC.</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of activeSheet.pozas_sentina">
                  <td class="font-bold text-center highlight-blue-td">{{ p.poza }}</td>
                  <td class="text-center">{{ p.medida_ini || 'n/d' }}</td>
                  <td class="text-center">{{ p.flujo_ini || 'n/d' }}</td>
                  <td class="text-center">{{ p.medida_fin || 'n/d' }}</td>
                  <td class="text-center">{{ p.flujo_fin || 'n/d' }}</td>
                  <td class="text-center">{{ p.horas || 'n/d' }}</td>
                  <td class="text-center">{{ p.acc || '---' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN E: OBSERVACIONES ADICIONALES -->
          <div class="doc-section">
            <div class="section-heading">SECCIÓN E: OBSERVACIONES ADICIONALES</div>
            <div class="obs-dual-grid">
              <div class="notes-content-box">
                <span class="notes-label">NOTAS Y EVENTOS DEL TURNO:</span>
                <p class="notes-p">{{ activeSheet.additional_obs?.notas || 'Operación sin novedades críticas registradas durante la guardia.' }}</p>
              </div>
              <div class="side-metrics-box">
                <div class="side-m-row"><span class="sm-k">Af. Cantera:</span><span class="sm-dots"></span><strong class="sm-v">{{ activeSheet.additional_obs?.af_cantera || '---' }}</strong></div>
                <div class="side-m-row"><span class="sm-k">Escorrentia:</span><span class="sm-dots"></span><strong class="sm-v">{{ activeSheet.additional_obs?.escorrentia || '---' }}</strong></div>
                <div class="side-m-row"><span class="sm-k">pH C/5 (1):</span><span class="sm-dots"></span><strong class="sm-v">{{ activeSheet.additional_obs?.ph_c5_1 || '---' }}</strong></div>
                <div class="side-m-row"><span class="sm-k">pH C/5 (2):</span><span class="sm-dots"></span><strong class="sm-v">{{ activeSheet.additional_obs?.ph_c5_2 || '---' }}</strong></div>
              </div>
            </div>
          </div>

          <!-- FIRMAS OFICIALES -->
          <div class="signatures-grid">
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ activeSheet.operator_name || operatorName }}</span>
              <div class="sign-meta-block">
                <span class="sign-dni">DNI: <strong>{{ operatorDni }}</strong></span>
                <span class="sig-role">{{ operatorRole }}</span>
              </div>
              <span class="sig-stamp">REG. OPERACIONES CONFORME</span>
            </div>
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ supervisorName }}</span>
              <div class="sign-meta-block">
                <span class="sign-dni">DNI: <strong>{{ supervisorDni }}</strong></span>
                <span class="sig-role">{{ supervisorRole }}</span>
              </div>
              <span class="sig-stamp">VALIDADO Y AUDITADO</span>
            </div>
          </div>

          <!-- Pie institucional -->
          <div class="doc-footer">
            <span>BASETRACK APP — Módulo de Estaciones de Bombeo y Sentinas</span>
            <span>Generado: {{ todayDate }} | Página 1 de 1 (Documento Oficial A4)</span>
            <span>Estándar Operacional ISO 9001 / ISO 14001</span>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(5px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
    }

    .report-modal-wrapper {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
      width: 100%;
      max-width: 920px;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .report-modal-header {
      padding: 12px 20px;
      background: #0f172a;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;

      .tag-badge {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #34d399;
      }

      h3 {
        margin: 2px 0 0;
        font-size: 1.05rem;
        font-weight: 800;
      }
    }

    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;

      button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        border: none;
      }

      .btn-download-pdf {
        background: #031795;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(3, 23, 149, 0.4);
        transition: all 0.2s;

        &:hover {
          background: #1e40af;
          transform: translateY(-1px);
        }

        &:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      }

      .btn-copy {
        background: #1e293b;
        color: #cbd5e1;
        border: 1px solid #334155;
        &:hover { background: #334155; color: #ffffff; }
      }

      .btn-print {
        background: #334155;
        color: #ffffff;
        &:hover { background: #475569; }
      }

      .close-btn {
        background: transparent;
        color: #94a3b8;
        font-size: 1.1rem;
        padding: 4px 8px;
        &:hover { color: #ffffff; }
      }
    }

    .report-document-body {
      padding: 16px 22px;
      background: #ffffff;
      color: #0f172a;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 7.2pt;
      line-height: 1.2;
    }

    /* ENCABEZADO INSTITUCIONAL */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #031795;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }

    .doc-logo-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .brand-symbol {
        width: 34px;
        height: 34px;
        background: #ffffff;
        border: 1.5px solid #c7d2fe;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        overflow: hidden;
      }

      .brand-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      h1 {
        font-size: 1.15rem;
        font-weight: 900;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.01em;
      }

      .doc-sub {
        font-size: 0.62rem;
        font-weight: 700;
        color: #031795;
        margin: 1px 0 0;
        letter-spacing: 0.05em;
      }
    }

    .doc-meta-box {
      font-size: 0.68rem;
      text-align: right;

      .meta-row {
        margin-bottom: 1.5px;
        strong { color: #475569; }
        span { font-weight: 700; color: #0f172a; margin-left: 4px; }
      }
    }

    .doc-title-banner {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #031795;
      padding: 4px 8px;
      margin-bottom: 6px;

      h2 {
        font-size: 0.78rem;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
        letter-spacing: 0.02em;
      }
    }

    /* KPI BANNER */
    .kpi-banner-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 6px;
    }

    .kpi-cell {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 4px 8px;
      display: flex;
      flex-direction: column;

      .kpi-title {
        font-size: 0.6rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
      }

      .kpi-val {
        font-size: 1.05rem;
        font-weight: 900;
        margin: 1px 0;

        &.highlight-emerald { color: #059669; }
        &.highlight-blue { color: #0284c7; }
        &.highlight-purple { color: #4f46e5; }
        &.highlight-navy { color: #031795; }
      }

      .kpi-sub {
        font-size: 0.58rem;
        font-weight: 600;
        color: #94a3b8;
      }
    }

    /* SECTIONS & TABLES */
    .doc-section {
      margin-bottom: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .section-heading {
      font-size: 0.68rem;
      font-weight: 800;
      color: #031795;
      background: #eef2ff;
      padding: 2.5px 7px;
      border-radius: 4px;
      border-left: 3px solid #031795;
      margin-bottom: 4px;
      letter-spacing: 0.03em;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;

      th {
        background: #031795;
        color: #ffffff;
        font-weight: 800;
        padding: 3px 5px;
        text-align: center;
        border: 1px solid #cbd5e1;
        font-size: 6.8pt;
      }

      td {
        padding: 2.2px 4px;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }

      tbody tr:nth-child(even) {
        background: #f8fafc;
      }
    }

    /* PUMPS 3-COLUMN TABLE */
    .pumps-grid-table {
      .th-group {
        font-size: 7.2pt;
        letter-spacing: 0.04em;
      }
      .th-sentina { background: #031795; }
      .th-intermedia { background: #0284c7; }
      .th-torre { background: #1e1b4b; }

      .sub-th-row th {
        background: #f1f5f9;
        color: #334155;
        font-size: 6.2pt;
        padding: 2px 4px;
      }

      .col-tag { width: 14%; text-align: center; }
      .col-status { width: 19%; text-align: center; }

      .cell-tag {
        color: #031795;
        text-align: center;
        background: rgba(3, 23, 149, 0.04);
        font-weight: 700;
      }

      .cell-status {
        text-align: center;
        padding: 1.5px 3px;
      }

      .summary-table-row td {
        background: #f1f5f9;
        font-size: 6.6pt;
        padding: 3px 6px;
        text-align: center;
      }
    }

    /* STATUS PILLS FOR PDF */
    .pdf-status-pill {
      font-size: 6.2pt;
      font-weight: 800;
      padding: 1.2px 6px;
      border-radius: 9999px;
      display: inline-block;
      line-height: 1.1;

      &.pdf-status-operativo {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #86efac;
      }
      &.pdf-status-standby {
        background: #e0f2fe;
        color: #0369a1;
        border: 1px solid #7dd3fc;
      }
      &.pdf-status-mantenimiento {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fcd34d;
      }
      &.pdf-status-falla {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
      }
    }

    /* SECCIÓN B: LEVELS BOXES */
    .levels-boxes-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;

      .level-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 4px 10px;

        .lvl-label {
          font-weight: 700;
          color: #475569;
          font-size: 7.2pt;
        }

        .lvl-val {
          font-size: 8.5pt;
          font-weight: 800;

          &.cyan { color: #0284c7; }
          &.emerald { color: #059669; }
          &.purple { color: #4338ca; }
        }
      }
    }

    /* SECCIÓN C: DUAL INDICATORS */
    .indicators-dual-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 5px 10px;

      .ind-col {
        display: flex;
        flex-direction: column;
        gap: 2.5px;
      }

      .ind-item {
        display: flex;
        align-items: center;
        font-size: 6.9pt;

        .ind-k {
          color: #475569;
          white-space: nowrap;
          font-weight: 600;
        }

        .ind-dots {
          flex: 1;
          border-bottom: 1px dotted #cbd5e1;
          margin: 0 6px;
        }

        .ind-v {
          color: #0284c7;
          font-weight: 800;
          white-space: nowrap;
        }
      }
    }

    /* SECCIÓN D: POZAS TABLE */
    .compact-table {
      font-size: 6.8pt;

      .th-dark-green {
        background: #031795;
        color: #ffffff;
      }

      th, td {
        padding: 2px 4px;
      }

      .highlight-blue-td {
        color: #0284c7;
        font-weight: 800;
      }
    }

    /* SECCIÓN E: OBS DUAL GRID */
    .obs-dual-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 10px;

      .notes-content-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 4px 8px;
        min-height: 38px;
        display: flex;
        flex-direction: column;

        .notes-label {
          font-size: 6.2pt;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .notes-p {
          margin: 0;
          font-size: 6.8pt;
          color: #1e293b;
          line-height: 1.3;
        }
      }

      .side-metrics-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 4px 8px;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        gap: 2px;

        .side-m-row {
          display: flex;
          align-items: center;
          font-size: 6.8pt;

          .sm-k {
            color: #475569;
            font-weight: 600;
            white-space: nowrap;
          }

          .sm-dots {
            flex: 1;
            border-bottom: 1px dotted #cbd5e1;
            margin: 0 6px;
          }

          .sm-v {
            color: #0284c7;
            font-weight: 800;
          }
        }
      }
    }

    /* SIGNATURES */
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 6px;
      margin-bottom: 4px;
      page-break-inside: avoid;
      break-inside: avoid;

      .signature-box {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;

        .sig-line {
          width: 70%;
          border-top: 1.2px solid #0f172a;
          margin-bottom: 2px;
        }

        .sig-name {
          font-size: 7pt;
          font-weight: 800;
          color: #0f172a;
        }

        .sig-role {
          font-size: 6.3pt;
          color: #64748b;
          font-weight: 600;
        }

        .sign-meta-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          margin: 1px 0;
        }

        .sign-dni {
          font-size: 6.3pt;
          color: #1e293b;
          font-weight: 600;
        }

        .sig-stamp {
          font-size: 5.6pt;
          font-weight: 800;
          color: #031795;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          padding: 1px 5px;
          border-radius: 9999px;
          margin-top: 2px;
        }
      }
    }

    .doc-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 3px;
      display: flex;
      justify-content: space-between;
      font-size: 6pt;
      color: #94a3b8;
    }

    /* ESTILOS DE IMPRESIÓN OFICIAL: 1 SOLA PÁGINA EXACTA */
    @media print {
      @page {
        size: A4 portrait;
        margin: 3mm 5mm 3mm 5mm !important;
      }

      .no-print, .header-actions, .close-btn, button, .report-modal-header {
        display: none !important;
        visibility: hidden !important;
      }

      .report-backdrop {
        position: static !important;
        background: transparent !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: visible !important;
        display: block !important;
      }

      .report-modal-wrapper {
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        max-height: none !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: visible !important;
        display: block !important;
      }

      #printable-pump-report {
        position: static !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 7.2pt !important;
        line-height: 1.15 !important;
        display: block !important;
      }

      .doc-section, .signatures-grid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  `]
})
export class PumpReportPdfComponent implements OnInit {
  private pdfService = inject(PdfExportService);
  private crewService = inject(CrewService);

  @Input() sheet: PumpStationSheet | null = null;
  @Input() pumps: PumpReport[] = [];
  
  private _isOpen = false;
  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val) {
      setTimeout(() => {
        this.downloadDirectPdf();
      }, 350);
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }

  @Output() close = new EventEmitter<void>();

  isDownloading = false;
  downloadSuccess = false;
  copiedText = false;
  todayDate: string = new Date().toISOString().split('T')[0];
  operatorName = 'MONTES RODRIGUEZ DIEGO ALEXANDER';
  operatorDni = '45437279';
  operatorRole = 'Operador de bombas';
  supervisorName = 'FERNANDEZ ASCURRA DANTE PACO';
  supervisorDni = '18110964';
  supervisorRole = 'Supervisor de guardia';

  readonly maxRowsArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  defaultSheet: PumpStationSheet = {
    report_date: new Date().toLocaleDateString('es-PE'),
    shift_code: 'G4',
    operator_name: 'MONTES RODRIGUEZ DIEGO ALEXANDER',
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
    levels: { orca: '', espejo: '', captacion: '' },
    main_indicators: {
      nivel_sentina: '', bombeo_turno_intermedia: '', nivel_tko02: '',
      aforador: '', cortafugas: '', ph_aforador: '', ph_cortafugas: '',
      h_embalas: '', dique_almacenamiento: '', drenaje_dique: '',
      agua_a_car: '', anticrustante: '', torre5_cortafugas: '',
      torre5_status1: 'Stand by', torre5_status2: 'Stand by'
    },
    pozas_sentina: [
      { poza: 'S-QCOR.R_02', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' },
      { poza: 'S-QCOR.R_03', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' }
    ],
    additional_obs: { notas: '', af_cantera: '', escorrentia: '', ph_c5_1: '', ph_c5_2: '' }
  };

  get activeSheet(): PumpStationSheet {
    return this.sheet || this.defaultSheet;
  }

  get sentinaOperatingCount(): number {
    return (this.activeSheet.sentina_pumps || []).filter(p => p.status === 'Operativo').length;
  }

  get intermediaOperatingCount(): number {
    return (this.activeSheet.intermedia_pumps || []).filter(p => p.status === 'Operativo').length;
  }

  get torre5OperatingCount(): number {
    return (this.activeSheet.torre5_pumps || []).filter(p => p.status === 'Operativo').length;
  }

  get totalOperatingCount(): number {
    return this.sentinaOperatingCount + this.intermediaOperatingCount + this.torre5OperatingCount;
  }

  get totalPumpsCount(): number {
    const s = this.activeSheet;
    return (s.sentina_pumps?.length || 8) + (s.intermedia_pumps?.length || 6) + (s.torre5_pumps?.length || 10);
  }

  ngOnInit(): void {
    if (this.sheet?.report_date) {
      this.todayDate = this.sheet.report_date;
    }
    const currentShift = getCurrentActiveShift();
    const shift = this.activeSheet?.shift_code || currentShift.activeGuard.code;
    const assignedOp = this.crewService.getAssignedOperatorForPosition('BOMBAS', shift);
    if (assignedOp) {
      this.operatorName = assignedOp.name;
      this.operatorDni = assignedOp.document_id;
      this.operatorRole = 'Operador de bombas';
    }
    const sup = this.crewService.getActiveSupervisorForShift(shift);
    if (sup) {
      this.supervisorName = sup.name;
      this.supervisorDni = sup.document_id;
      this.supervisorRole = 'Supervisor de guardia';
    }
    const userStr = localStorage.getItem('basetrack_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.fullName || u.name) {
          const name = u.fullName || u.name;
          if (u.role === 'SUPERVISOR') {
            this.supervisorName = name;
            if (u.document_id) this.supervisorDni = u.document_id;
          }
        }
      } catch (e) {}
    }
  }

  async downloadDirectPdf(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;
    const cleanDate = (this.activeSheet.report_date || this.todayDate).replace(/[\/\\]/g, '-');
    const filename = `Reporte_Oficial_Bombas_${cleanDate}.pdf`;
    const success = await this.pdfService.exportToPdf('printable-pump-report', filename);
    this.isDownloading = false;
    if (success) {
      this.downloadSuccess = true;
      setTimeout(() => {
        this.downloadSuccess = false;
      }, 3500);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('report-backdrop')) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  triggerPrint(): void {
    window.print();
  }

  getStatusClass(status: string | undefined): string {
    switch (status) {
      case 'Operativo': return 'pdf-status-operativo';
      case 'Stand by': return 'pdf-status-standby';
      case 'Mantenimiento': return 'pdf-status-mantenimiento';
      case 'Falla': return 'pdf-status-falla';
      default: return 'pdf-status-operativo';
    }
  }

  copyExecutiveSummary(): void {
    const s = this.activeSheet;
    const summary = `📋 *BASETRACK - REPORTE DE BOMBAS Y SENTINAS (FORMATO PLANTA)*
📅 Fecha: ${s.report_date || this.todayDate} | Guardia: ${s.shift_code || 'G1'}
👤 Operador: ${s.operator_name || this.operatorName}
🌊 Bombas Operando: ${this.totalOperatingCount} de ${this.totalPumpsCount} (Sentina: ${this.sentinaOperatingCount}/8, Intermedia: ${this.intermediaOperatingCount}/6, Torre 5: ${this.torre5OperatingCount}/10)
📊 Niveles: ORCA: ${s.levels?.orca || '---'} | Espejo: ${s.levels?.espejo || '---'} | Captación: ${s.levels?.captacion || '---'}
💧 Nivel Sentina: ${s.main_indicators?.nivel_sentina || '---'} | Bombeo Turno: ${s.main_indicators?.bombeo_turno_intermedia || '---'}
🧪 pH Aforador: ${s.main_indicators?.ph_aforador || '---'} | pH Cortafugas: ${s.main_indicators?.ph_cortafugas || '---'}
📌 Notas: ${s.additional_obs?.notas || '---'}
✅ Reporte Oficial Validado`;

    copyToClipboard(summary).then((success) => {
      if (success) {
        this.copiedText = true;
        setTimeout(() => {
          this.copiedText = false;
        }, 3000);
      }
    });
  }
}
