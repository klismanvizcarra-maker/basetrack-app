import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ShiftHandover } from '../shift-handover/shift-handover.component';

@Component({
  selector: 'app-shift-report-pdf',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)">
      <div class="report-modal-wrapper animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Header de la ventana flotante (No se imprime) -->
        <div class="report-modal-header no-print">
          <div class="header-info">
            <div class="tag-badge">DOCUMENTO OFICIAL DE PLANTA</div>
            <h3>Informe Consolidado de Turno & Relevo de Guardia</h3>
          </div>
          <div class="header-actions">
            <button class="btn btn-copy" (click)="copyExecutiveSummary()" [title]="copiedText ? 'Copiado!' : 'Copiar Resumen'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {{ copiedText ? '¡Copiado!' : 'Copiar Resumen' }}
            </button>
            <button class="btn btn-print" (click)="triggerPrint()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir / Guardar en PDF
            </button>
            <button class="close-btn" (click)="closeModal()">✕</button>
          </div>
        </div>

        <!-- DOCUMENTO OFICIAL A4 IMPRIMIBLE -->
        <div class="report-document-body" id="printable-shift-report">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">SISTEMA INTEGRAL DE CONTROL Y GESTIÓN OPERACIONAL DE PLANTA</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>CÓDIGO DOC:</strong> <span>REP-GRD-{{ reportData.shift_code }}</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ reportData.date }}</span></div>
              <div class="meta-row"><strong>TURNO:</strong> <span>{{ reportData.shift_type }} (12 HORAS)</span></div>
              <div class="meta-row"><strong>ESTADO:</strong> <span class="status-accepted">OFICIAL CONFORME</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>INFORME OFICIAL DE RELEVO DE GUARDIA Y OPERACIONES DE PLANTA</h2>
          </div>

          <!-- Resumen de Indicadores Clave (KPIs) -->
          <div class="kpi-banner-grid">
            <div class="kpi-cell">
              <span class="kpi-title">Tonelaje Procesado</span>
              <span class="kpi-val">{{ reportData.tonnage_processed | number }} <small>TMS</small></span>
              <span class="kpi-sub">Tratamiento de Planta</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Malla -200 Final (OF)</span>
              <span class="kpi-val highlight-emerald">64.5 <small>%</small></span>
              <span class="kpi-sub">Target Granulométrico</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Disponibilidad Bombas</span>
              <span class="kpi-val">98.4 <small>%</small></span>
              <span class="kpi-sub">5/6 en Operación</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Borde Libre Presa</span>
              <span class="kpi-val highlight-blue">3.8 <small>m</small></span>
              <span class="kpi-sub">Margen Seguro (> 2.5m)</span>
            </div>
          </div>

          <!-- SECCIÓN 1: RELEVO Y NOVEDADES GENERALES -->
          <div class="doc-section">
            <div class="section-heading">1. RELEVO DE GUARDIA Y SUPERVISIÓN</div>
            <div class="grid-2-col">
              <div class="info-card">
                <span class="card-label">Supervisor Saliente (Entrega):</span>
                <span class="card-val">👤 {{ reportData.outgoing_supervisor }}</span>
              </div>
              <div class="info-card">
                <span class="card-label">Supervisor Entrante (Recepción):</span>
                <span class="card-val">👤 {{ reportData.incoming_supervisor || 'Supervisor Turno Siguiente' }}</span>
              </div>
            </div>

            <div class="notes-box">
              <span class="notes-label">Estado General de Operación:</span>
              <p class="notes-content">{{ reportData.plant_status }}</p>
            </div>

            <div class="notes-box highlight-box" *ngIf="reportData.pending_tasks">
              <span class="notes-label">⚠️ Pendientes Críticos y Consignas para la Guardia Entrante:</span>
              <p class="notes-content">{{ reportData.pending_tasks }}</p>
            </div>

            <div class="notes-box">
              <span class="notes-label">Seguridad, Charlas y Medio Ambiente:</span>
              <p class="notes-content">{{ reportData.safety_incidents || 'Sin accidentes ni incidentes con tiempo perdido en el turno. Charla de 5 minutos realizada al inicio de guardia.' }}</p>
            </div>
          </div>

          <!-- SECCIÓN 2: REPORTE DE BOMBAS SLURRY Y ESTACIONES -->
          <div class="doc-section page-break-inside-avoid">
            <div class="section-heading">2. REPORTE DE BOMBAS SLURRY, SENTINAS Y SISTEMA DE AGUA</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>ESTACIÓN / EQUIPO</th>
                  <th>TAG EQUIPO</th>
                  <th>ESTADO</th>
                  <th>CORRIENTE (A)</th>
                  <th>PRESIÓN (PSI)</th>
                  <th>OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sentina Principal</td>
                  <td><strong>PP-101</strong></td>
                  <td><span class="tbl-badge badge-green">OPERANDO</span></td>
                  <td>142 A</td>
                  <td>34.5 PSI</td>
                  <td>Vibración dentro de rango permisible</td>
                </tr>
                <tr>
                  <td>Sentina Principal</td>
                  <td><strong>PP-102</strong></td>
                  <td><span class="tbl-badge badge-slate">STANDBY</span></td>
                  <td>0 A</td>
                  <td>0 PSI</td>
                  <td>Listo para respaldo automático</td>
                </tr>
                <tr>
                  <td>Bombeo Intermedio</td>
                  <td><strong>PP-201</strong></td>
                  <td><span class="tbl-badge badge-green">OPERANDO</span></td>
                  <td>158 A</td>
                  <td>42.0 PSI</td>
                  <td>Caudal sostenido a ciclones</td>
                </tr>
                <tr>
                  <td>Bombeo Intermedio</td>
                  <td><strong>PP-202</strong></td>
                  <td><span class="tbl-badge badge-green">OPERANDO</span></td>
                  <td>155 A</td>
                  <td>41.2 PSI</td>
                  <td>Operación continua normal</td>
                </tr>
                <tr>
                  <td>Estación Torre 5</td>
                  <td><strong>PP-501</strong></td>
                  <td><span class="tbl-badge badge-green">OPERANDO</span></td>
                  <td>110 A</td>
                  <td>28.4 PSI</td>
                  <td>Retorno de agua clara</td>
                </tr>
                <tr>
                  <td>Línea Relaves</td>
                  <td><strong>TL-201</strong></td>
                  <td><span class="tbl-badge badge-green">OPERANDO</span></td>
                  <td>168 A</td>
                  <td>48.0 PSI</td>
                  <td>Descarga estable hacia presa</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN 3: REPORTE DE BATERÍAS DE CICLONES (BALANCE METALÚRGICO) -->
          <div class="doc-section page-break-inside-avoid">
            <div class="section-heading">3. REPORTE DE CICLONES (PLANILLA METALÚRGICA Y MALLA -200)</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>BATERÍA / ESTACIÓN</th>
                  <th>CICLONES ACTIVOS</th>
                  <th>PRESIÓN MANIFOLD</th>
                  <th>% SÓLIDOS ALIM</th>
                  <th>% SÓLIDOS OVER</th>
                  <th>% SÓLIDOS UNDER</th>
                  <th>% MALLA -200 (OF)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>1ra Estación (CY1/2)</strong></td>
                  <td>4 de 6 en línea</td>
                  <td>16.2 PSI</td>
                  <td>58.2 %</td>
                  <td>32.5 %</td>
                  <td>74.8 %</td>
                  <td>52.4 %</td>
                </tr>
                <tr>
                  <td><strong>2da Estación (CY3/4)</strong></td>
                  <td>5 de 6 en línea</td>
                  <td>18.5 PSI</td>
                  <td>52.0 %</td>
                  <td>26.8 %</td>
                  <td>71.5 %</td>
                  <td><strong>64.5 %</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN 4: REPORTE DE DESCARGA Y RELAVES -->
          <div class="doc-section page-break-inside-avoid">
            <div class="section-heading">4. REPORTE DE DESCARGA Y PRESA DE RELAVES</div>
            <div class="grid-4-col">
              <div class="metric-card">
                <span class="m-lbl">Espejo de Agua</span>
                <span class="m-val">4,120.4 <small>msnm</small></span>
                <span class="m-note">Dentro de cota permitida</span>
              </div>
              <div class="metric-card">
                <span class="m-lbl">Borde Libre</span>
                <span class="m-val">3.8 <small>metros</small></span>
                <span class="m-note">Margen de seguridad alto</span>
              </div>
              <div class="metric-card">
                <span class="m-lbl">Piezometría Muro</span>
                <span class="m-val">142.6 <small>kPa</small></span>
                <span class="m-note">Línea freática estable</span>
              </div>
              <div class="metric-card">
                <span class="m-lbl">Turbidez de Agua Clara</span>
                <span class="m-val">12.5 <small>NTU</small></span>
                <span class="m-note">Cumple estándar ambiental</span>
              </div>
            </div>
          </div>

          <!-- SECCIÓN 5: FIRMAS Y CONFORMIDAD OPERACIONAL -->
          <div class="doc-section signatures-section page-break-inside-avoid">
            <div class="section-heading">5. CONFORMIDAD Y FIRMAS DE RELEVO FORMAL</div>
            <div class="signatures-grid">
              <div class="signature-box">
                <div class="sign-line"></div>
                <span class="sign-name">{{ reportData.outgoing_supervisor }}</span>
                <span class="sign-role">SUPERVISOR SALIENTE</span>
                <span class="sign-date">Fecha/Hora: {{ reportData.date }} 19:00</span>
                <span class="sign-status-tag">ENTREGADO CONFORME</span>
              </div>
              <div class="signature-box">
                <div class="sign-line"></div>
                <span class="sign-name">{{ reportData.incoming_supervisor || 'Supervisor Entrante' }}</span>
                <span class="sign-role">SUPERVISOR ENTRANTE</span>
                <span class="sign-date">Fecha/Hora: {{ reportData.date }} 19:15</span>
                <span class="sign-status-tag">RECIBIDO CONFORME</span>
              </div>
            </div>
          </div>

          <!-- Pie de página del documento impreso -->
          <div class="doc-footer">
            <span>BASETRACK APP © 2026 - Generado digitalmente por sistema SCADA operacional</span>
            <span>Página 1 de 1</span>
          </div>

        </div>

      </div>
    </div>
  `,
  styles: [`
    .report-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 1200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow-y: auto;
    }

    .report-modal-wrapper {
      background: #ffffff;
      width: 100%;
      max-width: 960px;
      max-height: 92vh;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .report-modal-header {
      padding: 1.25rem 1.75rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-shrink: 0;

      .tag-badge {
        font-size: 0.7rem;
        font-weight: 700;
        color: #059669;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      h3 {
        margin: 0.2rem 0 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #0f172a;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .btn-copy {
      background: #ffffff;
      border-color: #cbd5e1;
      color: #334155;
      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
    }

    .btn-print {
      background: #059669;
      color: #ffffff;
      &:hover {
        background: #047857;
      }
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.25rem;
      color: #64748b;
      cursor: pointer;
      padding: 0.4rem;
      border-radius: 6px;
      &:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
    }

    .report-document-body {
      padding: 2.5rem;
      overflow-y: auto;
      background: #ffffff;
      color: #0f172a;
      font-family: inherit;
    }

    /* ESTILOS DEL DOCUMENTO A4 */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #059669;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .doc-logo-group {
      display: flex;
      align-items: center;
      gap: 1rem;

      .brand-symbol {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .brand-titles {
        h1 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }
        .doc-sub {
          margin: 0.15rem 0 0;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
      }
    }

    .doc-meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.6rem 1rem;
      font-size: 0.75rem;

      .meta-row {
        margin-bottom: 0.25rem;
        display: flex;
        justify-content: space-between;
        gap: 1.5rem;
        &:last-child { margin-bottom: 0; }
        strong { color: #475569; }
        span { font-weight: 600; color: #0f172a; }
      }

      .status-accepted {
        color: #059669 !important;
      }
    }

    .doc-title-banner {
      background: #ecfdf5;
      border-left: 4px solid #059669;
      padding: 0.75rem 1.25rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 1.75rem;

      h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        color: #065f46;
        letter-spacing: -0.01em;
      }
    }

    .kpi-banner-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;

      .kpi-cell {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.85rem;
        text-align: center;

        .kpi-title {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .kpi-val {
          display: block;
          font-size: 1.4rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0.2rem 0;
          small { font-size: 0.8rem; font-weight: 500; }
        }

        .highlight-emerald { color: #059669; }
        .highlight-blue { color: #0284c7; }

        .kpi-sub {
          font-size: 0.7rem;
          color: #94a3b8;
        }
      }
    }

    .doc-section {
      margin-bottom: 1.75rem;

      .section-heading {
        font-size: 0.85rem;
        font-weight: 800;
        color: #0f172a;
        background: #f1f5f9;
        padding: 0.45rem 0.75rem;
        border-radius: 6px;
        margin-bottom: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border-left: 3px solid #059669;
      }
    }

    .grid-2-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 0.85rem;

      .info-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.75rem 1rem;

        .card-label {
          display: block;
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 600;
        }

        .card-val {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin-top: 0.25rem;
        }
      }
    }

    .notes-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.65rem;

      .notes-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: #475569;
        display: block;
        margin-bottom: 0.2rem;
      }

      .notes-content {
        margin: 0;
        font-size: 0.85rem;
        color: #1e293b;
        line-height: 1.45;
      }

      &.highlight-box {
        background: #fffbeb;
        border-color: #fde68a;
        .notes-label { color: #92400e; }
        .notes-content { color: #78350f; font-weight: 600; }
      }
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      background: #ffffff;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        text-align: left;
        padding: 0.55rem 0.75rem;
        border: 1px solid #e2e8f0;
        text-transform: uppercase;
        font-size: 0.7rem;
      }

      td {
        padding: 0.55rem 0.75rem;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }

      tbody tr:nth-child(even) {
        background: #fbfcfe;
      }
    }

    .tbl-badge {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;

      &.badge-green {
        background: #ecfdf5;
        color: #047857;
      }

      &.badge-slate {
        background: #f1f5f9;
        color: #475569;
      }
    }

    .grid-4-col {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.85rem;

      .metric-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.75rem;
        text-align: center;

        .m-lbl {
          font-size: 0.7rem;
          font-weight: 700;
          color: #64748b;
          display: block;
        }

        .m-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0.2rem 0;
          small { font-size: 0.75rem; font-weight: 500; }
        }

        .m-note {
          font-size: 0.65rem;
          color: #059669;
          font-weight: 600;
        }
      }
    }

    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      margin-top: 2rem;

      .signature-box {
        text-align: center;
        padding: 0.5rem;

        .sign-line {
          width: 80%;
          height: 1px;
          background: #94a3b8;
          margin: 0 auto 0.75rem;
        }

        .sign-name {
          display: block;
          font-weight: 800;
          font-size: 0.9rem;
          color: #0f172a;
        }

        .sign-role {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
          margin: 0.15rem 0;
        }

        .sign-date {
          display: block;
          font-size: 0.68rem;
          color: #94a3b8;
          margin-bottom: 0.4rem;
        }

        .sign-status-tag {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          color: #047857;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          padding: 0.15rem 0.6rem;
          border-radius: 9999px;
        }
      }
    }

    .doc-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 1rem;
      margin-top: 2rem;
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      color: #94a3b8;
    }

    /* REGLAS DE IMPRESIÓN OFICIAL A4 */
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

      #printable-shift-report {
        position: static !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }

      .page-break-inside-avoid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  `]
})
export class ShiftReportPdfComponent implements OnInit {
  @Input() handover: ShiftHandover | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  copiedText = false;

  reportData: ShiftHandover = {
    id: 'DEMO-1',
    shift_code: 'G-A-01',
    date: new Date().toISOString().split('T')[0],
    shift_type: 'DIA',
    outgoing_supervisor: 'VIZCARRA CORI MANLEY KLISMAN',
    incoming_supervisor: 'Ing. Roberto Silva',
    plant_status: 'Operación normal a ritmo de tratamiento continuo. Se mantuvo estabilidad en flotación y clasificación.',
    tonnage_processed: 24500,
    safety_incidents: 'Sin accidentes ni incidentes con tiempo perdido en el turno. Charla de seguridad realizada.',
    operational_highlights: 'Buen rendimiento en nidos Cyclopac CY3/4.',
    pending_tasks: 'Inspección de desgaste en impulsor de Bomba PP-101 para la parada programada de mañana a las 10:00.',
    status: 'ACCEPTED',
    created_at: new Date().toISOString()
  };

  ngOnInit(): void {
    if (this.handover) {
      this.reportData = { ...this.handover };
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
    const summary = `📋 *BASETRACK - REPORTE OFICIAL DE RELEVO DE GUARDIA*
📅 Fecha: ${this.reportData.date} | Turno: ${this.reportData.shift_type} | Código: ${this.reportData.shift_code}
👤 Entrega: ${this.reportData.outgoing_supervisor}
👤 Recibe: ${this.reportData.incoming_supervisor || 'Guardia Siguiente'}
⚖️ Tonelaje Procesado: ${this.reportData.tonnage_processed.toLocaleString()} TMS
🌪️ Malla -200 Final: 64.5%
🌊 Borde Libre Presa: 3.8m (Estable)
📌 Novedad de Planta: ${this.reportData.plant_status}
⚠️ Pendientes Críticos: ${this.reportData.pending_tasks || 'Ninguno'}
✅ Estado: ACEPTADO Y CONFORME`;

    navigator.clipboard.writeText(summary).then(() => {
      this.copiedText = true;
      setTimeout(() => {
        this.copiedText = false;
      }, 3000);
    });
  }
}
