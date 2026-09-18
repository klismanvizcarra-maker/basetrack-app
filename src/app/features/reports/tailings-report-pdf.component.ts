import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TailingsReport } from '../tailings/tailings.component';

@Component({
  selector: 'app-tailings-report-pdf',
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
            <button type="button" class="btn btn-copy" (click)="copyExecutiveSummary()" [title]="copiedText ? '¡Copiado!' : 'Copiar Resumen'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {{ copiedText ? '¡Copiado!' : 'Copiar Resumen' }}
            </button>
            <button type="button" class="btn btn-print" (click)="triggerPrint()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir / Guardar en PDF
            </button>
            <button type="button" class="close-btn" (click)="closeModal()">✕</button>
          </div>
        </div>

        <!-- DOCUMENTO OFICIAL A4 IMPRIMIBLE (1 SOLA PÁGINA) -->
        <div class="report-document-body" id="printable-tailings-report">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.4">
                  <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
                </svg>
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">PLANTA CONCENTRADORA — SISTEMA DE IMPULSIÓN & PRESA DE RELAVES</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>CÓDIGO:</strong> <span>REP-DES-G-A</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ todayDate }}</span></div>
              <div class="meta-row"><strong>SISTEMA:</strong> <span>LÍNEA HDPE & PRESA PRINCIPAL</span></div>
              <div class="meta-row"><strong>OPERADOR:</strong> <span>VILCAMIZA PEVE JORGE RICARDO</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>REPORTE DIARIO DE DESCARGA, ESPESAMIENTO Y ESTABILIDAD FÍSICA DE PRESA</h2>
          </div>

          <!-- Resumen de Indicadores Clave (KPIs) -->
          <div class="kpi-banner-grid">
            <div class="kpi-cell">
              <span class="kpi-title">Borde Libre (Freeboard)</span>
              <span class="kpi-val highlight-emerald">3.8 <small>m</small></span>
              <span class="kpi-sub">Margen Seguro (&gt; 2.5m)</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Cota Espejo de Agua</span>
              <span class="kpi-val">4,120.4 <small>msnm</small></span>
              <span class="kpi-sub">Dentro de Cota de Diseño</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Piezómetro Muro Principal</span>
              <span class="kpi-val highlight-blue">142.6 <small>kPa</small></span>
              <span class="kpi-sub">Línea Freática Estable</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Turbidez Sobrenadante</span>
              <span class="kpi-val">12.4 <small>NTU</small></span>
              <span class="kpi-sub">Apta para Recirculación</span>
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

          <!-- 2. CONTROL DE ESPIGOTAMIENTO Y AGUA RECUPERADA -->
          <div class="doc-section">
            <div class="section-heading">2. CONTROL DE ESPIGOTAMIENTO, BALSA DE AGUA CLARIFICADA Y PLAYA DE RELAVES</div>
            <div class="three-col-grid">
              <div class="info-block">
                <span class="block-title">Rotación de Espigotes:</span>
                <span class="block-val highlight-emerald">Espigotes #04 a #08 Abiertos</span>
                <span class="block-sub">Descarga hacia margen este formando playa</span>
              </div>
              <div class="info-block">
                <span class="block-title">Balsa de Agua Recuperada:</span>
                <span class="block-val highlight-blue">740 m³/h <small>(Operando)</small></span>
                <span class="block-sub">Retorno constante a cajón de agua de proceso</span>
              </div>
              <div class="info-block">
                <span class="block-title">Inspección de Línea HDPE:</span>
                <span class="block-val">Sin Fugas ni Atoros</span>
                <span class="block-sub">Inspección de termofusiones y bridas OK</span>
              </div>
            </div>
          </div>

          <!-- 3. OBSERVACIONES GEOTÉCNICAS Y CONSIGNAS DE SEGURIDAD -->
          <div class="doc-section">
            <div class="section-heading">3. OBSERVACIONES GEOTÉCNICAS, SEGURIDAD AMBIENTAL Y CONSIGNAS DE TURNO</div>
            <div class="notes-content-box">
              Presa de relaves operando con estabilidad física y química conforme a los estándares de diseño. Se verificó el borde libre de 3.8 metros, garantizando margen de resguardo ante eventos hidrológicos. Laguna alejada a más de 85 metros de la corona del dique.
            </div>
          </div>

          <!-- 4. FIRMAS OFICIALES -->
          <div class="signatures-grid">
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">VILCAMIZA PEVE JORGE RICARDO</span>
              <span class="sig-role">Operador Titular de Presa & Descarga</span>
              <span class="sig-stamp">INSPECCIÓN CONFORME</span>
            </div>
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">ING. SUPERVISOR DE RELAVES</span>
              <span class="sig-role">Supervisión Geotécnica & Presa</span>
              <span class="sig-stamp">AUDITADO Y APROBADO</span>
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

      .btn-copy {
        background: #1e293b;
        color: #cbd5e1;
        border: 1px solid #334155;
        &:hover { background: #334155; color: #ffffff; }
      }

      .btn-print {
        background: #059669;
        color: #ffffff;
        &:hover { background: #047857; }
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
      border-bottom: 2px solid #059669;
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
        background: #ecfdf5;
        border: 1.5px solid #a7f3d0;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
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
        color: #059669;
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
      border-left: 4px solid #059669;
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

        &.highlight-emerald { color: #047857; }
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
      color: #047857;
      background: #ecfdf5;
      padding: 3px 8px;
      border-radius: 4px;
      border-left: 3px solid #059669;
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
        color: #047857;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
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
        margin: 6mm 8mm 6mm 8mm;
      }

      body * {
        visibility: hidden !important;
      }

      .no-print, .header-actions, .close-btn {
        display: none !important;
      }

      .report-backdrop {
        position: static !important;
        background: transparent !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      .report-modal-wrapper {
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        max-height: none !important;
      }

      #printable-tailings-report, #printable-tailings-report * {
        visibility: visible !important;
      }

      #printable-tailings-report {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        padding: 0 !important;
        font-size: 8pt !important;
        line-height: 1.15 !important;
      }

      .doc-section, .signatures-grid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  `]
})
export class TailingsReportPdfComponent implements OnInit {
  @Input() items: TailingsReport[] = [];
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  copiedText = false;
  todayDate: string = new Date().toISOString().split('T')[0];

  defaultItems: TailingsReport[] = [
    { id: '1', station_tag: 'Spigot-01 Corona Principal', flow_rate_m3h: 380, solids_percentage: 58.5, dam_level_meters: 14.2, freeboard_meters: 3.8, piezometer_kpa: 142.6, turbidity_ntu: 12.4, pumping_line_status: 'NORMAL', operator_name: 'VILCAMIZA P.', shift_code: 'G-A', notes: 'Formación de playa este uniforme', created_at: '' },
    { id: '2', station_tag: 'Spigot-02 Descarga Lateral', flow_rate_m3h: 370, solids_percentage: 59.0, dam_level_meters: 14.2, freeboard_meters: 3.8, piezometer_kpa: 139.8, turbidity_ntu: 11.8, pumping_line_status: 'NORMAL', operator_name: 'VILCAMIZA P.', shift_code: 'G-A', notes: 'Descarga controlada', created_at: '' },
    { id: '3', station_tag: 'Espesador de Relaves E-01', flow_rate_m3h: 750, solids_percentage: 61.2, dam_level_meters: 14.0, freeboard_meters: 4.0, piezometer_kpa: 145.2, turbidity_ntu: 14.2, pumping_line_status: 'NORMAL', operator_name: 'VILCAMIZA P.', shift_code: 'G-A', notes: 'Dosificación de floculante a 18 g/t', created_at: '' },
    { id: '4', station_tag: 'Balsa de Agua Recuperada', flow_rate_m3h: 740, solids_percentage: 0.1, dam_level_meters: 14.2, freeboard_meters: 3.8, piezometer_kpa: 128.5, turbidity_ntu: 9.6, pumping_line_status: 'NORMAL', operator_name: 'VILCAMIZA P.', shift_code: 'G-A', notes: 'Retorno continuo a planta concentradora', created_at: '' }
  ];

  get displayItems(): TailingsReport[] {
    if (this.items && this.items.length > 0) {
      return this.items;
    }
    return this.defaultItems;
  }

  ngOnInit(): void {}

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
    const summary = `📋 *BASETRACK - REPORTE OFICIAL DE PRESA DE RELAVES (1 HOJA)*
📅 Fecha: ${this.todayDate} | Guardia: GUARDIA_A
👤 Operador: VILCAMIZA PEVE JORGE RICARDO
🌊 Borde Libre: 3.8m (Margen Seguro > 2.5m) | Cota Espejo: 4,120.4 msnm
📉 Presión Piezométrica: 142.6 kPa (Línea Freática Conforme)
💧 Agua Recuperada: 740 m³/h | Turbidez: 12.4 NTU
📌 Operación y descarga de relaves estable
✅ Documento Oficial Validado`;

    navigator.clipboard.writeText(summary).then(() => {
      this.copiedText = true;
      setTimeout(() => {
        this.copiedText = false;
      }, 3000);
    });
  }
}
