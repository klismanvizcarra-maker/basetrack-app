import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PumpStationSheet, PumpReport } from '../pumps/pumps.component';

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
            <div class="tag-badge">FORMATO OFICIAL A4 (1 HOJA)</div>
            <h3>Reporte Oficial de Operación de Bombas & Sentinas</h3>
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
        <div class="report-document-body" id="printable-pump-report">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.4">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 3v18"></path>
                  <path d="M3 12h18"></path>
                </svg>
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">PLANTA CONCENTRADORA — SISTEMA INTEGRAL DE BOMBEO & SENTINAS</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>CÓDIGO:</strong> <span>REP-BMB-{{ sheet?.shift_code || 'G-A' }}</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ sheet?.report_date || todayDate }}</span></div>
              <div class="meta-row"><strong>GUARDIA:</strong> <span>{{ sheet?.shift_code || 'GUARDIA_A' }}</span></div>
              <div class="meta-row"><strong>OPERADOR:</strong> <span>{{ sheet?.operator_name || 'VIZCARRA CORI MANLEY KLISMAN' }}</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>REPORTE DIARIO DE ESTACIONES DE BOMBEO SLURRY, SENTINAS Y NIVELES</h2>
          </div>

          <!-- Resumen de Indicadores Clave (KPIs) -->
          <div class="kpi-banner-grid">
            <div class="kpi-cell">
              <span class="kpi-title">Disponibilidad Bombas</span>
              <span class="kpi-val highlight-emerald">{{ operatingCount }} / {{ totalPumpsCount }} <small>Operando</small></span>
              <span class="kpi-sub">Sala de Bombas Slurry</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Nivel de Sentina Principal</span>
              <span class="kpi-val">{{ sheet?.main_indicators?.nivel_sentina || '45%' }}</span>
              <span class="kpi-sub">Margen Seguro (&lt; 85%)</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Bombeo Intermedia</span>
              <span class="kpi-val">{{ sheet?.main_indicators?.bombeo_turno_intermedia || '1,850 m³' }}</span>
              <span class="kpi-sub">Acumulado Turno</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">pH Aforador / Efluente</span>
              <span class="kpi-val highlight-blue">{{ sheet?.main_indicators?.ph_aforador || '7.8' }}</span>
              <span class="kpi-sub">Rango Estable (7.0 - 8.5)</span>
            </div>
          </div>

          <!-- 1. ESTADO DE EQUIPOS DE BOMBEO -->
          <div class="doc-section">
            <div class="section-heading">1. ESTACIONES DE BOMBEO SLURRY Y BARRERA INTERMEDIA</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>TAG EQUIPO</th>
                  <th>ÁREA / SISTEMA</th>
                  <th>ESTADO</th>
                  <th>CAUDAL (m³/h)</th>
                  <th>PRESIÓN (PSI)</th>
                  <th>CORRIENTE (A)</th>
                  <th>TEMP. MOTOR (°C)</th>
                  <th>VIBRACIÓN (mm/s)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of pumpList">
                  <td class="font-bold">{{ p.tag }}</td>
                  <td>{{ p.system }}</td>
                  <td>
                    <span class="status-pill" [class.active]="p.status === 'OPERATING'" [class.standby]="p.status === 'STANDBY'" [class.maint]="p.status === 'MAINTENANCE' || p.status === 'FAULT'">
                      {{ formatStatus(p.status) }}
                    </span>
                  </td>
                  <td>{{ p.flow_rate_m3h }}</td>
                  <td>{{ (p.pressure_bar * 14.5038) | number:'1.1-1' }}</td>
                  <td>{{ p.current_amps }} A</td>
                  <td>{{ p.bearing_temp_c }} °C</td>
                  <td>{{ p.vibration_mms }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. CONTROL DE POZAS Y SENTINAS (COLUMNA DOBLE CONDENSADA) -->
          <div class="doc-section">
            <div class="section-heading">2. MONITOREO DE SENTINAS, POZAS DE SEDIMENTACIÓN Y CORTAFUGAS</div>
            <div class="two-col-grid">
              <table class="report-table compact-table">
                <thead>
                  <tr>
                    <th>POZA / SECTOR</th>
                    <th>MED. INICIAL</th>
                    <th>FLUJO INI</th>
                    <th>MED. FINAL</th>
                    <th>HORAS OPER.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of (sheet?.pozas_sentina || defaultPozas)">
                    <td class="font-bold">{{ p.poza }}</td>
                    <td>{{ p.medida_ini }}</td>
                    <td>{{ p.flujo_ini }}</td>
                    <td>{{ p.medida_fin }}</td>
                    <td>{{ p.horas }} hrs</td>
                  </tr>
                </tbody>
              </table>

              <div class="levels-summary-box">
                <div class="level-item">
                  <span class="lbl">Nivel Tk-02 / Poza Pulpa:</span>
                  <span class="val">{{ sheet?.main_indicators?.nivel_tko02 || '68%' }}</span>
                </div>
                <div class="level-item">
                  <span class="lbl">Dique de Almacenamiento:</span>
                  <span class="val">{{ sheet?.main_indicators?.dique_almacenamiento || 'Normal' }}</span>
                </div>
                <div class="level-item">
                  <span class="lbl">pH Cortafugas / Drenaje:</span>
                  <span class="val">{{ sheet?.main_indicators?.ph_cortafugas || '7.6' }}</span>
                </div>
                <div class="level-item">
                  <span class="lbl">Dosificación Antincrustante:</span>
                  <span class="val">{{ sheet?.main_indicators?.anticrustante || 'Operativo (45 ml/min)' }}</span>
                </div>
                <div class="level-item">
                  <span class="lbl">Estado Torre 5:</span>
                  <span class="val">{{ sheet?.main_indicators?.torre5_cortafugas || 'Conforme' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. NOVEDADES OPERACIONALES & OBSERVACIONES -->
          <div class="doc-section">
            <div class="section-heading">3. NOVEDADES OPERACIONALES Y CONSIGNAS DE SALA DE BOMBAS</div>
            <div class="notes-content-box">
              {{ sheet?.additional_obs?.notas || 'Operación continua sin novedades críticas. Parámetros de presión y amperaje dentro de ventana segura. Sentinas operando en automático bajo consigna del supervisor.' }}
            </div>
          </div>

          <!-- 4. FIRMAS OFICIALES -->
          <div class="signatures-grid">
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ sheet?.operator_name || 'VIZCARRA CORI MANLEY KLISMAN' }}</span>
              <span class="sig-role">Operador Titular de Sala de Bombas</span>
              <span class="sig-stamp">REG. OPERACIONES CONFORME</span>
            </div>
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">ING. SUPERVISOR DE TURNO</span>
              <span class="sig-role">Supervisor de Planta Concentradora</span>
              <span class="sig-stamp">VALIDADO Y AUDITADO</span>
            </div>
          </div>

          <!-- Pie institucional -->
          <div class="doc-footer">
            <span>BASETRACK APP — Módulo de Sala de Bombas</span>
            <span>Generado: {{ todayDate }} | Página 1 de 1 (Documento Oficial A4)</span>
            <span>Estándar Operacional ISO 9001 / 14001</span>
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

    .status-pill {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 9999px;
      display: inline-block;

      &.active { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      &.standby { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      &.maint { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    }

    .two-col-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 8px;
      align-items: stretch;
    }

    .compact-table {
      font-size: 7pt;
      th, td { padding: 2.5px 5px; }
    }

    .levels-summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 3px;

      .level-item {
        display: flex;
        justify-content: space-between;
        font-size: 7.2pt;
        border-bottom: 1px dashed #e2e8f0;
        padding-bottom: 2px;

        .lbl { color: #475569; font-weight: 600; }
        .val { font-weight: 800; color: #0f172a; }
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

      #printable-pump-report {
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
export class PumpReportPdfComponent implements OnInit {
  @Input() sheet: PumpStationSheet | null = null;
  @Input() pumps: PumpReport[] = [];
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  copiedText = false;
  todayDate: string = new Date().toISOString().split('T')[0];

  defaultPozas = [
    { poza: 'Poza N° 01 Slurry', medida_ini: '1.20 m', flujo_ini: '320 m³/h', medida_fin: '1.15 m', flujo_fin: '315 m³/h', horas: '11.5', acc: '3,650' },
    { poza: 'Poza N° 02 Auxiliar', medida_ini: '0.85 m', flujo_ini: '180 m³/h', medida_fin: '0.80 m', flujo_fin: '180 m³/h', horas: '12.0', acc: '2,160' },
    { poza: 'Sentina Torre 5', medida_ini: '0.45 m', flujo_ini: '95 m³/h', medida_fin: '0.40 m', flujo_fin: '90 m³/h', horas: '6.0', acc: '540' },
    { poza: 'Cortafugas Dique', medida_ini: '0.30 m', flujo_ini: '45 m³/h', medida_fin: '0.28 m', flujo_fin: '45 m³/h', horas: '12.0', acc: '540' }
  ];

  get pumpList(): PumpReport[] {
    if (this.pumps && this.pumps.length > 0) {
      return this.pumps;
    }
    return [
      { id: '1', tag: 'PP-101', name: 'Bomba Slurry 01', system: 'Impulsión Relaves', status: 'OPERATING', flow_rate_m3h: 380, pressure_bar: 5.2, rpm: 890, bearing_temp_c: 54, vibration_mms: 2.1, current_amps: 135, shift_code: 'G-A', operator_name: 'VIZCARRA K.', created_at: '' },
      { id: '2', tag: 'PP-102', name: 'Bomba Slurry 02', system: 'Impulsión Relaves', status: 'OPERATING', flow_rate_m3h: 375, pressure_bar: 5.1, rpm: 885, bearing_temp_c: 56, vibration_mms: 2.3, current_amps: 132, shift_code: 'G-A', operator_name: 'VIZCARRA K.', created_at: '' },
      { id: '3', tag: 'PP-103', name: 'Bomba Standby 03', system: 'Línea de Reserva', status: 'STANDBY', flow_rate_m3h: 0, pressure_bar: 0.0, rpm: 0, bearing_temp_c: 24, vibration_mms: 0.0, current_amps: 0, shift_code: 'G-A', operator_name: 'VIZCARRA K.', created_at: '' },
      { id: '4', tag: 'PP-104', name: 'Bomba Sentina 04', system: 'Sumidero Principal', status: 'OPERATING', flow_rate_m3h: 120, pressure_bar: 2.4, rpm: 1150, bearing_temp_c: 48, vibration_mms: 1.8, current_amps: 42, shift_code: 'G-A', operator_name: 'VIZCARRA K.', created_at: '' }
    ];
  }

  get operatingCount(): number {
    return this.pumpList.filter(p => p.status === 'OPERATING').length;
  }

  get totalPumpsCount(): number {
    return this.pumpList.length;
  }

  ngOnInit(): void {
    if (this.sheet?.report_date) {
      this.todayDate = this.sheet.report_date;
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

  formatStatus(status: string): string {
    switch (status) {
      case 'OPERATING': return 'Operando';
      case 'STANDBY': return 'Stand by';
      case 'MAINTENANCE': return 'Mantenimiento';
      case 'FAULT': return 'Falla';
      default: return status;
    }
  }

  copyExecutiveSummary(): void {
    const summary = `📋 *BASETRACK - REPORTE OFICIAL DE SALA DE BOMBAS (1 HOJA)*
📅 Fecha: ${this.todayDate} | Guardia: ${this.sheet?.shift_code || 'GUARDIA_A'}
👤 Operador: ${this.sheet?.operator_name || 'VIZCARRA CORI MANLEY KLISMAN'}
🌊 Bombas Operando: ${this.operatingCount} de ${this.totalPumpsCount}
💧 Nivel Sentina: ${this.sheet?.main_indicators?.nivel_sentina || '45%'} | Bombeo Intermedia: ${this.sheet?.main_indicators?.bombeo_turno_intermedia || '1,850 m³'}
🧪 pH Aforador: ${this.sheet?.main_indicators?.ph_aforador || '7.8'} (Estable)
📌 Novedad: ${this.sheet?.additional_obs?.notas || 'Operación normal conforme'}
✅ Documento Oficial Validado`;

    navigator.clipboard.writeText(summary).then(() => {
      this.copiedText = true;
      setTimeout(() => {
        this.copiedText = false;
      }, 3000);
    });
  }
}
