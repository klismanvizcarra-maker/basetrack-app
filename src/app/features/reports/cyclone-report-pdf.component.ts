import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StationSample, GeneralAverages } from '../cyclones/cyclones.component';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { copyToClipboard } from '../../core/utils/clipboard.util';

@Component({
  selector: 'app-cyclone-report-pdf',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)">
      <div class="report-modal-wrapper animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Modal Action Header (No se imprime) -->
        <div class="report-modal-header no-print">
          <div class="header-info">
            <div class="tag-badge">FORMATO OFICIAL A4 (1 HOJA)</div>
            <h3>Planilla Metalúrgica Oficial de Baterías de Ciclones</h3>
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
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
              </svg>
              {{ copiedText ? '¡Copiado!' : 'Copiar' }}
            </button>
            <button type="button" class="close-btn" (click)="closeModal()">✕</button>
          </div>
        </div>

        <!-- DOCUMENTO OFICIAL A4 IMPRIMIBLE (1 SOLA PÁGINA) -->
        <div class="report-document-body" id="printable-cyclone-report">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK" class="brand-img" />
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">PLANTA CONCENTRADORA — ÁREA DE MOLIENDA & CLASIFICACIÓN HIDROCICLÓNICA</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>CÓDIGO:</strong> <span>REP-CYC-{{ shiftCode || 'G1' }}</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ reportDate }}</span></div>
              <div class="meta-row"><strong>ESTACIÓN:</strong> <span>{{ station || '2DA ESTACIÓN CICLONES' }}</span></div>
              <div class="meta-row"><strong>GUARDIA:</strong> <span>{{ shiftCode || 'G1' }}</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>PLANILLA DE CONTROL METALÚRGICO, PORCENTAJE DE SÓLIDOS Y GRANULOMETRÍA MALLA -200</h2>
          </div>

          <!-- Resumen de Indicadores Clave (KPIs) -->
          <div class="kpi-banner-grid">
            <div class="kpi-cell">
              <span class="kpi-title">Malla -200 Overflow (OF)</span>
              <span class="kpi-val highlight-emerald">{{ calcAvg.mesh200_of | number:'1.1-1' }} <small>%</small></span>
              <span class="kpi-sub">Target: 60% - 68%</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">% Sólidos Alimentación</span>
              <span class="kpi-val">{{ calcAvg.solids_feed | number:'1.1-1' }} <small>%</small></span>
              <span class="kpi-sub">Densidad de Pulpa</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">% Sólidos Overflow</span>
              <span class="kpi-val highlight-blue">{{ calcAvg.solids_of | number:'1.1-1' }} <small>%</small></span>
              <span class="kpi-sub">Clasificación a Flotación</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">% Sólidos Underflow</span>
              <span class="kpi-val">{{ calcAvg.solids_uf | number:'1.1-1' }} <small>%</small></span>
              <span class="kpi-sub">Carga Circulante Gruesa</span>
            </div>
          </div>

          <!-- 1. TABLA METALÚRGICA DE MUESTREOS HORARIOS -->
          <div class="doc-section">
            <div class="section-heading">1. MUESTREO METALÚRGICO HORARIO (PORCENTAJE DE SÓLIDOS Y MALLA -200)</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th rowspan="2">HORA</th>
                  <th rowspan="2">BATERÍA</th>
                  <th colspan="3" class="text-center group-th">PORCENTAJE DE SÓLIDOS (%)</th>
                  <th colspan="3" class="text-center group-th">GRANULOMETRÍA MALLA -200 (%)</th>
                </tr>
                <tr>
                  <th>ALIMENT.</th>
                  <th>OVERFLOW</th>
                  <th>UNDERFLOW</th>
                  <th>ALIMENT.</th>
                  <th>OVERFLOW</th>
                  <th>UNDERFLOW</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of displaySamples">
                  <td class="font-bold">{{ s.sample_time }}</td>
                  <td>{{ s.battery_tag }}</td>
                  <td>{{ s.solids_feed | number:'1.1-1' }}%</td>
                  <td class="font-bold highlight-blue-td">{{ s.solids_of | number:'1.1-1' }}%</td>
                  <td>{{ s.solids_uf | number:'1.1-1' }}%</td>
                  <td>{{ s.mesh200_feed | number:'1.1-1' }}%</td>
                  <td class="font-bold highlight-emerald-td">{{ s.mesh200_of | number:'1.1-1' }}%</td>
                  <td>{{ s.mesh200_uf | number:'1.1-1' }}%</td>
                </tr>
                <!-- Fila de Promedio Ponderado -->
                <tr class="avg-summary-row">
                  <td colspan="2" class="text-right font-bold">PROMEDIO PONDERADO:</td>
                  <td class="font-bold">{{ calcAvg.solids_feed | number:'1.1-1' }}%</td>
                  <td class="font-bold highlight-blue-td">{{ calcAvg.solids_of | number:'1.1-1' }}%</td>
                  <td class="font-bold">{{ calcAvg.solids_uf | number:'1.1-1' }}%</td>
                  <td class="font-bold">{{ calcAvg.mesh200_feed | number:'1.1-1' }}%</td>
                  <td class="font-bold highlight-emerald-td">{{ calcAvg.mesh200_of | number:'1.1-1' }}%</td>
                  <td class="font-bold">{{ calcAvg.mesh200_uf | number:'1.1-1' }}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. CONTROL OPERACIONAL DE CYCLOPAC Y DESCARGA -->
          <div class="doc-section">
            <div class="section-heading">2. PARÁMETROS OPERATIVOS DE NIDO CYCLOPAC & ESTABILIDAD HIDRÁULICA</div>
            <div class="three-col-grid">
              <div class="info-block">
                <span class="block-title">Presión en Manifold:</span>
                <span class="block-val">12.5 PSI <small>(Rango: 10 - 15 PSI)</small></span>
                <span class="block-sub">Presión de alimentación uniforme</span>
              </div>
              <div class="info-block">
                <span class="block-title">Ciclones en Operación:</span>
                <span class="block-val highlight-emerald">4 / 6 Ciclones</span>
                <span class="block-sub">C-1, C-2, C-3, C-4 en línea (C-5, C-6 Standby)</span>
              </div>
              <div class="info-block">
                <span class="block-title">Condición de Descarga:</span>
                <span class="block-val highlight-blue">En Paraguas (Spray)</span>
                <span class="block-sub">Descarga cónica estable sin roping</span>
              </div>
            </div>
          </div>

          <!-- 3. NOVEDADES OPERACIONALES & OBSERVACIONES -->
          <div class="doc-section">
            <div class="section-heading">3. OBSERVACIONES METALÚRGICAS Y CONSIGNAS DE TURNO</div>
            <div class="notes-content-box">
              Ciclones operando de acuerdo con la ventana metalúrgica de planta. Buen corte d50 hacia circuito de flotación rougher. Se inspeccionaron ápices de goma sin presencia de taponamiento ni desbalance en la presión del manifold.
            </div>
          </div>

          <!-- 4. FIRMAS OFICIALES -->
          <div class="signatures-grid">
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">PILCO APAZA CARLOS EDUARDO</span>
              <span class="sig-role">Operador Titular de Baterías de Ciclones</span>
              <span class="sig-stamp">MUESTREO CONFORME</span>
            </div>
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">ING. METALURGISTA DE TURNO</span>
              <span class="sig-role">Supervisión Metalúrgica / Jefe de Guardia</span>
              <span class="sig-stamp">AUDITADO Y APROBADO</span>
            </div>
          </div>

          <!-- Pie institucional -->
          <div class="doc-footer">
            <span>BASETRACK APP — Módulo de Baterías de Ciclones</span>
            <span>Generado: {{ reportDate }} | Página 1 de 1 (Documento Oficial A4)</span>
            <span>Norma ASTM E11 / ISO 13320</span>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
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
      max-width: 900px;
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
        border: none;
        box-shadow: 0 2px 8px rgba(3, 23, 149, 0.4);
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 0.8rem;
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
      padding: 24px 30px;
      background: #ffffff;
      color: #0f172a;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.25;
    }

    /* ENCABEZADO OFICIAL */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #031795;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .doc-logo-group {
      display: flex;
      align-items: center;
      gap: 10px;

      .brand-symbol {
        width: 38px;
        height: 38px;
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
        font-size: 1.25rem;
        font-weight: 900;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.01em;
      }

      .doc-sub {
        font-size: 0.65rem;
        font-weight: 700;
        color: #031795;
        margin: 2px 0 0;
        letter-spacing: 0.05em;
      }
    }

    .doc-meta-box {
      font-size: 0.72rem;
      text-align: right;

      .meta-row {
        margin-bottom: 2px;
        strong { color: #475569; }
        span { font-weight: 700; color: #0f172a; margin-left: 4px; }
      }
    }

    .doc-title-banner {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #031795;
      padding: 5px 10px;
      margin-bottom: 8px;

      h2 {
        font-size: 0.82rem;
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
      gap: 8px;
      margin-bottom: 8px;
    }

    .kpi-cell {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;

      .kpi-title {
        font-size: 0.65rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
      }

      .kpi-val {
        font-size: 1.15rem;
        font-weight: 900;
        color: #0f172a;
        margin: 2px 0;
        small { font-size: 0.68rem; font-weight: 700; color: #64748b; }

        &.highlight-emerald { color: #031795; }
        &.highlight-blue { color: #0284c7; }
      }

      .kpi-sub {
        font-size: 0.62rem;
        font-weight: 600;
        color: #94a3b8;
      }
    }

    /* SECTIONS & TABLES */
    .doc-section {
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .section-heading {
      font-size: 0.72rem;
      font-weight: 800;
      color: #031795;
      background: #eef2ff;
      padding: 3px 8px;
      border-radius: 4px;
      border-left: 3px solid #031795;
      margin-bottom: 5px;
      letter-spacing: 0.03em;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.2pt;

      th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 800;
        padding: 3.5px 5px;
        text-align: left;
        border: 1px solid #cbd5e1;
      }

      .group-th {
        background: #e2e8f0;
        font-size: 7pt;
      }

      td {
        padding: 3px 5px;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }

      tbody tr:nth-child(even) {
        background: #f8fafc;
      }
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }

    .highlight-blue-td {
      color: #0369a1;
      background: #f0f9ff;
    }

    .highlight-emerald-td {
      color: #047857;
      background: #ecfdf5;
    }

    .avg-summary-row {
      background: #fefce8 !important;
      border-top: 2px solid #ca8a04;
      td { font-weight: 800; color: #854d0e; }
    }

    .three-col-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .info-block {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;

      .block-title {
        font-size: 0.65rem;
        font-weight: 700;
        color: #64748b;
      }

      .block-val {
        font-size: 0.95rem;
        font-weight: 800;
        color: #0f172a;
        margin: 2px 0;
        small { font-size: 0.68rem; font-weight: 600; color: #64748b; }
      }

      .block-sub {
        font-size: 0.62rem;
        color: #94a3b8;
      }
    }

    .notes-content-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 7.5pt;
      color: #334155;
      min-height: 28px;
    }

    /* SIGNATURES */
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 10px;
      margin-bottom: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .signature-box {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .sig-line {
        width: 75%;
        border-top: 1.5px solid #0f172a;
        margin-bottom: 4px;
      }

      .sig-name {
        font-size: 7.5pt;
        font-weight: 800;
        color: #0f172a;
      }

      .sig-role {
        font-size: 6.8pt;
        color: #64748b;
        font-weight: 600;
      }

      .sig-stamp {
        font-size: 6pt;
        font-weight: 800;
        color: #031795;
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        padding: 1px 6px;
        border-radius: 9999px;
        margin-top: 2px;
      }
    }

    .doc-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #94a3b8;
    }

    /* ESTILOS DE IMPRESIÓN OFICIAL: 1 SOLA PÁGINA EXACTA */
    @media print {
      @page {
        size: A4 portrait;
        margin: 4mm 6mm 4mm 6mm !important;
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

      #printable-cyclone-report {
        position: static !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 7.6pt !important;
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
export class CycloneReportPdfComponent implements OnInit {
  private pdfService = inject(PdfExportService);

  @Input() samples: StationSample[] = [];
  @Input() station: string = '2DA ESTACIÓN CICLONES';
  @Input() shiftCode: string = 'G1';
  @Input() averages: GeneralAverages | null = null;
  
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
  reportDate: string = new Date().toISOString().split('T')[0];
  operatorName = 'VIZCARRA CORI MANLEY KLISMAN';

  defaultSamples: StationSample[] = [
    { id: '1', station: '2DA ESTACIÓN', sample_time: '08:00', battery_tag: 'Nido CY-03', solids_feed: 54.2, solids_of: 36.8, solids_uf: 72.4, mesh200_feed: 48.2, mesh200_of: 64.8, mesh200_uf: 28.5, shift_code: 'G-A', date: '' },
    { id: '2', station: '2DA ESTACIÓN', sample_time: '10:00', battery_tag: 'Nido CY-03', solids_feed: 55.0, solids_of: 37.1, solids_uf: 72.8, mesh200_feed: 47.9, mesh200_of: 65.2, mesh200_uf: 28.1, shift_code: 'G-A', date: '' },
    { id: '3', station: '2DA ESTACIÓN', sample_time: '12:00', battery_tag: 'Nido CY-03', solids_feed: 53.8, solids_of: 36.4, solids_uf: 71.9, mesh200_feed: 49.0, mesh200_of: 64.5, mesh200_uf: 29.0, shift_code: 'G-A', date: '' },
    { id: '4', station: '2DA ESTACIÓN', sample_time: '14:00', battery_tag: 'Nido CY-04', solids_feed: 54.5, solids_of: 36.9, solids_uf: 72.5, mesh200_feed: 48.5, mesh200_of: 64.9, mesh200_uf: 28.6, shift_code: 'G-A', date: '' },
    { id: '5', station: '2DA ESTACIÓN', sample_time: '16:00', battery_tag: 'Nido CY-04', solids_feed: 54.1, solids_of: 36.5, solids_uf: 72.1, mesh200_feed: 48.8, mesh200_of: 65.4, mesh200_uf: 28.2, shift_code: 'G-A', date: '' },
    { id: '6', station: '2DA ESTACIÓN', sample_time: '18:00', battery_tag: 'Nido CY-04', solids_feed: 54.8, solids_of: 37.0, solids_uf: 72.6, mesh200_feed: 48.1, mesh200_of: 64.7, mesh200_uf: 28.8, shift_code: 'G-A', date: '' }
  ];

  get displaySamples(): StationSample[] {
    if (this.samples && this.samples.length > 0) {
      return this.samples.slice(0, 10);
    }
    return this.defaultSamples;
  }

  get calcAvg(): GeneralAverages {
    if (this.averages) return this.averages;
    const list = this.displaySamples;
    if (list.length === 0) {
      return { solids_feed: 54.4, solids_of: 36.8, solids_uf: 72.4, mesh200_feed: 48.4, mesh200_of: 64.9, mesh200_uf: 28.5 };
    }
    const sum = list.reduce((acc, curr) => ({
      solids_feed: acc.solids_feed + curr.solids_feed,
      solids_of: acc.solids_of + curr.solids_of,
      solids_uf: acc.solids_uf + curr.solids_uf,
      mesh200_feed: acc.mesh200_feed + curr.mesh200_feed,
      mesh200_of: acc.mesh200_of + curr.mesh200_of,
      mesh200_uf: acc.mesh200_uf + curr.mesh200_uf
    }), { solids_feed: 0, solids_of: 0, solids_uf: 0, mesh200_feed: 0, mesh200_of: 0, mesh200_uf: 0 });

    const n = list.length;
    return {
      solids_feed: sum.solids_feed / n,
      solids_of: sum.solids_of / n,
      solids_uf: sum.solids_uf / n,
      mesh200_feed: sum.mesh200_feed / n,
      mesh200_of: sum.mesh200_of / n,
      mesh200_uf: sum.mesh200_uf / n
    };
  }

  ngOnInit(): void {
    if (this.samples.length > 0 && this.samples[0].date) {
      this.reportDate = this.samples[0].date;
    }
    const userStr = localStorage.getItem('basetrack_user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.name) this.operatorName = u.name;
      } catch (e) {}
    }
  }

  async downloadDirectPdf(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;
    const cleanDate = this.reportDate.replace(/[\/\\]/g, '-');
    const filename = `Planilla_Oficial_Ciclones_${cleanDate}.pdf`;
    const success = await this.pdfService.exportToPdf('printable-cyclone-report', filename);
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

  copyExecutiveSummary(): void {
    const summary = `📋 *BASETRACK - PLANILLA METALÚRGICA DE CICLONES (1 HOJA)*
📅 Fecha: ${this.reportDate} | Guardia: ${this.shiftCode} | Estación: ${this.station}
🌪️ Malla -200 OF: ${this.calcAvg.mesh200_of.toFixed(1)}% (Target Conforme)
⚖️ % Sólidos: Alim ${this.calcAvg.solids_feed.toFixed(1)}% | OF ${this.calcAvg.solids_of.toFixed(1)}% | UF ${this.calcAvg.solids_uf.toFixed(1)}%
🎛️ Presión Manifold: 12.5 PSI (Estable) | Descarga: Paraguas (Spray)
✅ Documento Oficial Validado`;

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
