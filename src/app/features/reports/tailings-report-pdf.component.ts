import { Component, Input, Output, EventEmitter, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TailingsReport } from '../tailings/tailings.component';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { CrewService } from '../../core/services/crew.service';
import { PlantParametersService } from '../../core/services/plant-parameters.service';
import { copyToClipboard } from '../../core/utils/clipboard.util';
import { getCurrentActiveShift } from '../../shared/utils/roster.util';

@Component({
  selector: 'app-tailings-report-pdf',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)">
      <div class="report-modal-wrapper animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Modal Action Header (No se imprime) -->
        <div class="report-modal-header no-print">
          <div class="header-info">
            <div class="tag-badge">FORMATO OFICIAL A4 (1 HOJA)</div>
            <h3>Reporte Oficial de Presa de Relaves, Descarga & Espesamiento</h3>
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
            <button type="button" class="close-btn" (click)="closeModal()" aria-label="Cerrar modal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- DOCUMENTO OFICIAL A4 IMPRIMIBLE (1 SOLA PÁGINA) -->
        <div class="report-document-body" id="printable-tailings-report">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK" class="brand-img" />
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">PLANTA CONCENTRADORA — SISTEMA DE IMPULSIÓN & PRESA DE RELAVES</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>CÓDIGO:</strong> <span>REP-DES-{{ displayShift }}</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ todayDate }}</span></div>
              <div class="meta-row"><strong>SISTEMA:</strong> <span>LÍNEA HDPE & PRESA PRINCIPAL</span></div>
              <div class="meta-row"><strong>OPERADOR:</strong> <span>{{ operatorName }}</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>REPORTE DIARIO DE DESCARGA, ESPESAMIENTO Y ESTABILIDAD FÍSICA DE PRESA</h2>
          </div>

          <!-- Resumen de Indicadores Clave (KPIs): última lectura registrada, nunca valores supuestos -->
          <div class="kpi-banner-grid">
            <div class="kpi-cell">
              <span class="kpi-title">Borde Libre (Freeboard)</span>
              <span class="kpi-val" [class.highlight-emerald]="freeboardState === 'ok'" [class.highlight-red]="freeboardState === 'critical'" [class.highlight-amber]="freeboardState === 'warning'">{{ fmt(latest?.freeboard_meters, '1.1-2') }} <small *ngIf="latest">m</small></span>
              <span class="kpi-sub">{{ freeboardLabel }}</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Nivel de Presa</span>
              <span class="kpi-val">{{ fmt(latest?.dam_level_meters, '1.1-1') }} <small *ngIf="latest">m</small></span>
              <span class="kpi-sub">{{ latest ? 'Última lectura registrada' : 'Sin registros' }}</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Piezómetro Muro Principal</span>
              <span class="kpi-val highlight-blue">{{ fmt(latest?.piezometer_kpa, '1.1-1') }} <small *ngIf="hasValue(latest?.piezometer_kpa)">kPa</small></span>
              <span class="kpi-sub">{{ hasValue(latest?.piezometer_kpa) ? 'Última lectura registrada' : 'Sin lectura' }}</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Turbidez Sobrenadante</span>
              <span class="kpi-val">{{ fmt(latest?.turbidity_ntu, '1.1-1') }} <small *ngIf="hasValue(latest?.turbidity_ntu)">NTU</small></span>
              <span class="kpi-sub">{{ hasValue(latest?.turbidity_ntu) ? 'Última lectura registrada' : 'Sin lectura' }}</span>
            </div>
          </div>

          <!-- 1. ESTACIONES DE DESCARGA Y ESPESADORES -->
          <div class="doc-section">
            <div class="section-heading">1. ESTACIONES DE MONITOREO DE DESCARGA, ESPESAMIENTO Y LÍNEAS DE RELAVES</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>ESTACIÓN / PUNTO</th>
                  <th>CAUDAL (m³/h)</th>
                  <th>% SÓLIDOS</th>
                  <th>ESTADO LÍNEA</th>
                  <th>NIVEL PRESA (m)</th>
                  <th>PIEZÓMETRO (kPa)</th>
                  <th>TURBIDEZ (NTU)</th>
                  <th>OPERADOR A CARGO</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of displayItems">
                  <td class="font-bold">{{ item.station_tag }}</td>
                  <td>{{ item.flow_rate_m3h | number }} m³/h</td>
                  <td><span class="badge-solids font-bold">{{ item.solids_percentage }}%</span></td>
                  <td>
                    <span class="status-pill" [class.active]="item.pumping_line_status === 'NORMAL'" [class.alert]="item.pumping_line_status === 'ALERT'" [class.restr]="item.pumping_line_status === 'RESTRICTED'">
                      {{ item.pumping_line_status }}
                    </span>
                  </td>
                  <td>{{ item.dam_level_meters }} m</td>
                  <td>{{ item.piezometer_kpa }} kPa</td>
                  <td>{{ item.turbidity_ntu }} NTU</td>
                  <td>{{ item.operator_name }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. RESUMEN DE LAS LECTURAS DEL PERIODO (calculado de los registros) -->
          <div class="doc-section">
            <div class="section-heading">2. RESUMEN DE LECTURAS REGISTRADAS</div>
            <div class="three-col-grid">
              <div class="info-block">
                <span class="block-title">Lecturas registradas:</span>
                <span class="block-val">{{ displayItems.length }}</span>
                <span class="block-sub">{{ stationCount }} estación(es) de descarga</span>
              </div>
              <div class="info-block">
                <span class="block-title">Caudal promedio:</span>
                <span class="block-val highlight-blue">{{ avgFlow !== null ? (avgFlow | number:'1.0-1') + ' m³/h' : '—' }}</span>
                <span class="block-sub">% sólidos promedio: {{ avgSolids !== null ? (avgSolids | number:'1.1-1') + '%' : '—' }}</span>
              </div>
              <div class="info-block">
                <span class="block-title">Líneas en alerta o restringidas:</span>
                <span class="block-val" [class.highlight-red]="lineIssues > 0">{{ lineIssues }}</span>
                <span class="block-sub">Borde libre mínimo del periodo: {{ minFreeboardInPeriod !== null ? (minFreeboardInPeriod | number:'1.1-2') + ' m' : '—' }}</span>
              </div>
            </div>
          </div>

          <!-- 3. OBSERVACIONES: solo las notas escritas por los operadores -->
          <div class="doc-section">
            <div class="section-heading">3. OBSERVACIONES GEOTÉCNICAS, SEGURIDAD AMBIENTAL Y CONSIGNAS DE TURNO</div>
            <div class="notes-content-box">
              <ng-container *ngIf="observationNotes.length > 0; else noNotes">
                <div *ngFor="let n of observationNotes">• {{ n }}</div>
              </ng-container>
              <ng-template #noNotes>Sin observaciones registradas en las lecturas del periodo.</ng-template>
              <div *ngIf="freeboardState === 'critical'" class="critical-note">
                ALERTA: borde libre por debajo del mínimo normativo de {{ regulatoryMinFreeboard }} m (D.S. 024-2016-EM).
              </div>
            </div>
          </div>

          <!-- 4. FIRMAS OFICIALES -->
          <div class="signatures-grid">
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ operatorName }}</span>
              <div class="sign-meta-block">
                <span class="sign-dni">DNI: <strong>{{ operatorDni }}</strong></span>
                <span class="sign-role">{{ operatorRole }}</span>
              </div>
              <span class="sig-stamp">FIRMA DEL OPERADOR</span>
            </div>
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ supervisorName }}</span>
              <div class="sign-meta-block">
                <span class="sign-dni">DNI: <strong>{{ supervisorDni }}</strong></span>
                <span class="sign-role">{{ supervisorRole }}</span>
              </div>
              <span class="sig-stamp">FIRMA DEL SUPERVISOR</span>
            </div>
          </div>

          <!-- Pie institucional -->
          <div class="doc-footer">
            <span>BASETRACK APP — Módulo de Presa de Relaves & Descarga</span>
            <span>Generado: {{ todayDate }} | Página 1 de 1 (Documento Oficial A4)</span>
            <span>Estándar GISTM / Marco Ambiental OEFA</span>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .critical-note {
      margin-top: 6px;
      font-weight: 700;
      color: #dc2626;
    }

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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        cursor: pointer;
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
        &.highlight-red { color: #dc2626; }
        &.highlight-amber { color: #d97706; }
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
      font-size: 7.5pt;

      th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 800;
        padding: 4px 6px;
        text-align: left;
        border: 1px solid #cbd5e1;
      }

      td {
        padding: 3.5px 6px;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }

      tbody tr:nth-child(even) {
        background: #f8fafc;
      }
    }

    .font-bold { font-weight: 700; }

    .badge-solids {
      color: #6b21a8;
      background: #f3e8ff;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #e9d5ff;
    }

    .status-pill {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 9999px;
      display: inline-block;

      &.active { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      &.alert { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      &.restr { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
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

        &.highlight-emerald { color: #047857; }
        &.highlight-blue { color: #0284c7; }
        &.highlight-red { color: #dc2626; }
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

      .sign-meta-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        margin: 1px 0;
      }

      .sign-dni {
        font-size: 6.6pt;
        color: #1e293b;
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

      #printable-tailings-report {
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
export class TailingsReportPdfComponent implements OnInit {
  private pdfService = inject(PdfExportService);
  private crewService = inject(CrewService);
  private plantParams = inject(PlantParametersService);
  private decimal = new DecimalPipe('en-US');

  @Input() items: TailingsReport[] = [];
  
  private _isOpen = false;
  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val) {
      // Las firmas dependen de la estación, guardia y datos vigentes al abrir, no al crear el componente
      this.ngOnInit();
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
  todayDate: string = getCurrentActiveShift().dateStr;
  displayShift: string = getCurrentActiveShift().activeGuard.code;
  operatorName = '--- Vacante ---';
  operatorDni = '---';
  operatorRole = 'Operador de descarga 1';
  supervisorName = getCurrentActiveShift().activeGuard.supervisorName;
  supervisorDni = '---';
  supervisorRole = 'Supervisor de guardia';

  defaultItems: TailingsReport[] = [];

  get displayItems(): TailingsReport[] {
    return this.items || [];
  }

  /** Mínimo normativo de borde libre (CLAUDE.md §3.5); la meta de planta es un parámetro configurable. */
  readonly regulatoryMinFreeboard = 1.0;

  /** Lectura más reciente (la lista llega ordenada de la más nueva a la más antigua). */
  get latest(): TailingsReport | null {
    return this.displayItems[0] || null;
  }

  hasValue(v: unknown): boolean {
    return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  }

  fmt(v: unknown, digits: string): string {
    return this.hasValue(v) ? (this.decimal.transform(Number(v), digits) || '—') : '—';
  }

  get freeboardState(): 'none' | 'critical' | 'warning' | 'ok' {
    const fb = this.latest?.freeboard_meters;
    if (!this.hasValue(fb)) return 'none';
    if (Number(fb) < this.regulatoryMinFreeboard) return 'critical';
    if (Number(fb) < this.plantParams.minFreeboard()) return 'warning';
    return 'ok';
  }

  get freeboardLabel(): string {
    switch (this.freeboardState) {
      case 'critical': return `Bajo mínimo normativo (< ${this.regulatoryMinFreeboard} m)`;
      case 'warning': return `Bajo meta de planta (< ${this.plantParams.minFreeboard()} m)`;
      case 'ok': return `Dentro de meta (≥ ${this.plantParams.minFreeboard()} m)`;
      default: return 'Sin registros';
    }
  }

  private avgOf(field: keyof TailingsReport): number | null {
    const vals = this.displayItems.map(i => Number(i[field])).filter(v => Number.isFinite(v) && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  get avgFlow(): number | null { return this.avgOf('flow_rate_m3h'); }
  get avgSolids(): number | null { return this.avgOf('solids_percentage'); }

  get stationCount(): number {
    return new Set(this.displayItems.map(i => i.station_tag)).size;
  }

  get lineIssues(): number {
    return this.displayItems.filter(i => i.pumping_line_status === 'ALERT' || i.pumping_line_status === 'RESTRICTED').length;
  }

  get minFreeboardInPeriod(): number | null {
    const vals = this.displayItems.map(i => Number(i.freeboard_meters)).filter(v => Number.isFinite(v));
    return vals.length ? Math.min(...vals) : null;
  }

  get observationNotes(): string[] {
    return this.displayItems
      .filter(i => i.notes && i.notes.trim())
      .map(i => `${i.station_tag}: ${i.notes!.trim()}`);
  }

  ngOnInit(): void {
    // Se recalcula en cada apertura: no arrastrar firmantes de una estación o guardia anterior
    this.operatorName = '--- Vacante ---';
    this.operatorDni = '---';
    this.supervisorName = getCurrentActiveShift().activeGuard.supervisorName;
    this.supervisorDni = '---';
    // Guardia del reporte solo si es válida (G1–G4); si no, la guardia activa (el supervisor y su DNI deben coincidir)
    const reported = this.items?.[0]?.shift_code;
    const shift = reported && /^G[1-4]$/.test(reported) ? reported : getCurrentActiveShift().activeGuard.code;
    this.displayShift = shift;

    const assignedOp = this.crewService.getAssignedOperatorForPosition('DESCARGA_1', shift);
    if (assignedOp) {
      this.operatorName = assignedOp.name;
      this.operatorDni = assignedOp.document_id;
      this.operatorRole = 'Operador de descarga 1';
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
    const cleanDate = this.todayDate.replace(/[\/\\]/g, '-');
    const filename = `Reporte_Oficial_Descarga_${cleanDate}.pdf`;
    const success = await this.pdfService.exportToPdf('printable-tailings-report', filename);
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
    const l = this.latest;
    const summary = `*BASETRACK - REPORTE DE PRESA DE RELAVES*
Fecha: ${this.todayDate} | Guardia: ${this.displayShift}
Operador: ${this.operatorName}
Borde Libre: ${this.fmt(l?.freeboard_meters, '1.1-2')} m (${this.freeboardLabel}) | Nivel de presa: ${this.fmt(l?.dam_level_meters, '1.1-1')} m
Piezómetro: ${this.fmt(l?.piezometer_kpa, '1.1-1')} kPa | Turbidez: ${this.fmt(l?.turbidity_ntu, '1.1-1')} NTU
Lecturas: ${this.displayItems.length} | Líneas en alerta/restringidas: ${this.lineIssues}`;

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
