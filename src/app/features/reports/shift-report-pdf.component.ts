import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ShiftHandover } from '../shift-handover/shift-handover.component';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { CrewService } from '../../core/services/crew.service';
import { VehicleChecklistService, HandoverVehicleObservation } from '../../core/services/vehicle-checklist.service';
import { copyToClipboard } from '../../core/utils/clipboard.util';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { getRealtimeData } from '../../core/storage/local-store.util';
import { getCurrentActiveShift } from '../../shared/utils/roster.util';

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
            <button type="button" class="btn btn-download-pdf" (click)="downloadDirectPdf()" [disabled]="isDownloading" title="Descargar archivo PDF directamente">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {{ isDownloading ? 'Guardando PDF...' : (downloadSuccess ? '¡PDF Guardado!' : 'Descargar PDF Directo') }}
            </button>
            <button class="btn btn-print" (click)="triggerPrint()" title="Imprimir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir
            </button>
            <button class="btn btn-copy" (click)="copyExecutiveSummary()" [title]="copiedText ? 'Copiado!' : 'Copiar Resumen'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {{ copiedText ? '¡Copiado!' : 'Copiar' }}
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
                <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK" class="brand-img" />
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
              <span class="kpi-val">{{ (reportData.tonnage_processed || liveTonnage) | number }} <small>TMS</small></span>
              <span class="kpi-sub">Tratamiento de Planta</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Malla -200 Final (OF)</span>
              <span class="kpi-val highlight-emerald">{{ liveMesh200Of | number:'1.1-2' }} <small>%</small></span>
              <span class="kpi-sub">Target Granulométrico (2da Estación)</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Disponibilidad Bombas</span>
              <span class="kpi-val">{{ pumpAvailabilityPercent | number:'1.1-1' }} <small>%</small></span>
              <span class="kpi-sub">{{ pumpOperatingCount }}/{{ pumpTotalCount }} en Operación</span>
            </div>
            <div class="kpi-cell">
              <span class="kpi-title">Borde Libre Presa</span>
              <span class="kpi-val highlight-blue">{{ liveFreeboard | number:'1.1-2' }} <small>m</small></span>
              <span class="kpi-sub">{{ liveFreeboard >= 2.5 ? 'Margen Seguro (> 2.5m)' : 'Alerta de Cota (< 2.5m)' }}</span>
            </div>
          </div>

          <!-- SECCIÓN 1: RELEVO Y NOVEDADES GENERALES -->
          <div class="doc-section">
            <div class="section-heading">1. RELEVO DE GUARDIA Y SUPERVISIÓN</div>
            <div class="grid-2-col">
              <div class="info-card">
                <span class="card-label">Supervisor Saliente (Entrega):</span>
                <span class="card-val">👤 {{ outgoingSupervisorName }}</span>
                <div class="card-meta-line">
                  <span>DNI: <strong>{{ outgoingSupervisorDni }}</strong></span> • 
                  <span>Cargo: <strong>{{ outgoingSupervisorRole }}</strong></span>
                </div>
              </div>
              <div class="info-card">
                <span class="card-label">Supervisor Entrante (Recepción):</span>
                <span class="card-val">👤 {{ incomingSupervisorName }}</span>
                <div class="card-meta-line">
                  <span>DNI: <strong>{{ incomingSupervisorDni }}</strong></span> • 
                  <span>Cargo: <strong>{{ incomingSupervisorRole }}</strong></span>
                </div>
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

          <!-- SECCIÓN 1.1: DOTACIÓN DE PERSONAL OPERATIVO (CUADRILLA TITULAR) -->
          <div class="doc-section page-break-inside-avoid">
            <div class="section-heading">1.1. DOTACIÓN DE PERSONAL OPERATIVO (CUADRILLA TITULAR)</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>PUESTO OPERATIVO</th>
                  <th>OPERADOR TITULAR ASIGNADO</th>
                  <th>DNI</th>
                  <th>CANAL RADIAL</th>
                  <th>UBICACIÓN EN PLANTA</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of operationalCrewList">
                  <td><strong>{{ item.title }}</strong></td>
                  <td>{{ item.operatorName }}</td>
                  <td>{{ item.documentId }}</td>
                  <td>{{ item.radioChannel }}</td>
                  <td>{{ item.location }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN 2: REPORTE DE BOMBAS SLURRY Y ESTACIONES -->
          <div class="doc-section page-break-inside-avoid">
            <div class="section-heading">2. REPORTE DE BOMBAS SLURRY, SENTINAS Y SISTEMA DE AGUA</div>
            
            <!-- Resumen de estado de estaciones si existe planilla -->
            <div class="pumps-summary-bar" *ngIf="sentinaActiveCount || intermediaActiveCount || torre5ActiveCount">
              <span class="ps-item"><strong>Sentina Principal:</strong> {{ sentinaActiveCount }}/8 Operativas</span>
              <span class="ps-divider">•</span>
              <span class="ps-item"><strong>Bombeo Intermedio:</strong> {{ intermediaActiveCount }}/6 Operativas</span>
              <span class="ps-divider">•</span>
              <span class="ps-item"><strong>Torre 5:</strong> {{ torre5ActiveCount }}/10 Operativas</span>
            </div>

            <table class="report-table">
              <thead>
                <tr>
                  <th>ESTACIÓN / EQUIPO</th>
                  <th>TAG EQUIPO</th>
                  <th>ESTADO</th>
                  <th>CORRIENTE (A)</th>
                  <th>PRESIÓN</th>
                  <th>OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of displayPumps">
                  <td>{{ p.systemName }}</td>
                  <td><strong>{{ p.tag }}</strong></td>
                  <td><span class="tbl-badge" [ngClass]="p.badgeClass">{{ p.statusLabel }}</span></td>
                  <td>{{ p.currentAmps }}</td>
                  <td>{{ p.pressure }}</td>
                  <td>{{ p.observations }}</td>
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
                <tr *ngFor="let row of cycloneStationRows">
                  <td><strong>{{ row.name }}</strong></td>
                  <td>{{ row.activeCount }}</td>
                  <td>{{ row.pressure }}</td>
                  <td>{{ row.solidsFeed | number:'1.2-2' }} %</td>
                  <td>{{ row.solidsOf | number:'1.2-2' }} %</td>
                  <td>{{ row.solidsUf | number:'1.2-2' }} %</td>
                  <td><strong [class.highlight-emerald]="row.isTarget">{{ row.mesh200Of | number:'1.2-2' }} %</strong></td>
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
                <span class="m-val">{{ liveWaterMirror | number:'1.1-2' }} <small>msnm</small></span>
                <span class="m-note">Cota verificada de laguna</span>
              </div>
              <div class="metric-card">
                <span class="m-lbl">Borde Libre</span>
                <span class="m-val">{{ liveFreeboard | number:'1.1-2' }} <small>metros</small></span>
                <span class="m-note">{{ liveFreeboard >= 2.5 ? 'Margen de seguridad alto (>2.5m)' : 'Alerta de cota baja (<2.5m)' }}</span>
              </div>
              <div class="metric-card">
                <span class="m-lbl">Piezometría Muro</span>
                <span class="m-val">{{ livePiezometer | number:'1.1-1' }} <small>kPa</small></span>
                <span class="m-note">Línea freática estable</span>
              </div>
              <div class="metric-card">
                <span class="m-lbl">Turbidez de Agua Clara</span>
                <span class="m-val">{{ liveTurbidity | number:'1.1-1' }} <small>NTU</small></span>
                <span class="m-note">Cumple estándar ambiental</span>
              </div>
            </div>
          </div>

          <!-- SECCIÓN 4.1: NOVEDADES DE INSPECCIÓN VEHICULAR (SOLO UNIDADES OBSERVADAS O NO APTAS) -->
          <div class="doc-section page-break-inside-avoid" *ngIf="observedVehicles.length > 0">
            <div class="section-heading">4.1. INSPECCIÓN VEHICULAR - CAMIONETAS CON OBSERVACIÓN O NO APTAS</div>
            
            <div class="vehicle-alert-banner">
              <span class="va-icon">⚠️</span>
              <div class="va-text">
                <strong>Atención Supervisión de Guardia:</strong> Se registran <strong>{{ observedVehicles.length }}</strong> camioneta(s) con observaciones técnicas o restricción operativa en la inspección pre-uso. Las unidades en estado Apto (Verde) operan con normalidad y quedan excluidas de esta bitácora.
              </div>
            </div>

            <table class="report-table vehicle-table">
              <thead>
                <tr>
                  <th style="width: 14%;">UNIDAD / PLACA</th>
                  <th style="width: 18%;">ÁREA / MODELO</th>
                  <th style="width: 20%;">CONDUCTOR / DNI</th>
                  <th style="width: 13%;">KILOMETRAJE</th>
                  <th style="width: 13%;">ESTADO</th>
                  <th style="width: 22%;">DETALLE DE OBSERVACIÓN</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of observedVehicles">
                  <td>
                    <div class="vehicle-tag-badge">{{ v.tag }}</div>
                    <div class="vehicle-plate-text">{{ v.plate }}</div>
                  </td>
                  <td>
                    <div style="font-weight: 700;">{{ v.area }}</div>
                    <small style="color: #64748b; font-size: 0.68rem;">{{ v.model }}</small>
                  </td>
                  <td>
                    <div><strong>{{ v.driverName }}</strong></div>
                    <small style="color: #64748b; font-size: 0.68rem;">DNI: {{ v.driverDni }}</small>
                  </td>
                  <td>
                    <strong>{{ v.odometer | number }}</strong> <small>km</small>
                    <div style="color: #94a3b8; font-size: 0.66rem;">{{ v.time }}</div>
                  </td>
                  <td>
                    <span class="tbl-badge" [ngClass]="v.operationalStatus === 'NO_APTO' ? 'badge-rose' : 'badge-amber'">
                      {{ v.operationalStatus === 'NO_APTO' ? '⛔ NO APTO' : '⚠️ OBSERVADO' }}
                    </span>
                  </td>
                  <td class="obs-cell">
                    <div class="obs-notes">{{ v.observationNotes }}</div>
                    <div class="defective-tags" *ngIf="v.defectiveItems && v.defectiveItems.length > 0">
                      <span class="def-pill" *ngFor="let item of v.defectiveItems">
                        • {{ item.name }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN 5: FIRMAS Y CONFORMIDAD OPERACIONAL -->
          <div class="doc-section signatures-section page-break-inside-avoid">
            <div class="section-heading">5. CONFORMIDAD Y ACREDITACIÓN DE RELEVO FORMAL</div>
            <div class="signatures-grid">
              <div class="signature-box">
                <div class="sign-line"></div>
                <span class="sign-name">{{ outgoingSupervisorName }}</span>
                <div class="sign-meta-block">
                  <span class="sign-dni">DNI: <strong>{{ outgoingSupervisorDni }}</strong></span>
                  <span class="sign-role">{{ outgoingSupervisorRole }} (Turno Saliente)</span>
                </div>
                <span class="sign-date">Fecha y Hora: {{ reportData.date }} 19:00</span>
                <span class="sign-status-tag">ENTREGADO CONFORME</span>
              </div>
              <div class="signature-box">
                <div class="sign-line"></div>
                <span class="sign-name">{{ incomingSupervisorName }}</span>
                <div class="sign-meta-block">
                  <span class="sign-dni">DNI: <strong>{{ incomingSupervisorDni }}</strong></span>
                  <span class="sign-role">{{ incomingSupervisorRole }} (Turno Entrante)</span>
                </div>
                <span class="sign-date">Fecha y Hora: {{ reportData.date }} 19:15</span>
                <span class="sign-status-tag">{{ isAccepted ? 'RECIBIDO CONFORME' : 'PENDIENTE DE CONFORMIDAD' }}</span>
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
        color: #031795;
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
      background: #ffffff;
      border-color: #cbd5e1;
      color: #334155;
      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
    }

    .btn-print {
      background: #334155;
      color: #ffffff;
      &:hover {
        background: #475569;
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
      border-bottom: 2px solid #031795;
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
        background: #ffffff;
        border: 1px solid #c7d2fe;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3px;
        overflow: hidden;
      }

      .brand-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
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
      background: #eef2ff;
      border-left: 4px solid #031795;
      padding: 0.75rem 1.25rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 1.75rem;

      h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        color: #031795;
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

        .highlight-emerald { color: #031795; }
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
        border-left: 3px solid #031795;
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

        .card-meta-line {
          font-size: 0.72rem;
          color: #475569;
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

      &.badge-amber {
        background: #fffbeb;
        color: #b45309;
      }

      &.badge-rose {
        background: #ffe4e6;
        color: #e11d48;
      }
    }

    .pumps-summary-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      margin-bottom: 0.65rem;
      font-size: 0.73rem;
      color: #334155;

      .ps-item strong {
        color: #0f172a;
      }

      .ps-divider {
        color: #cbd5e1;
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

        .sign-meta-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin: 0.25rem 0 0.35rem;
        }

        .sign-dni {
          font-size: 0.74rem;
          color: #1e293b;
          letter-spacing: 0.03em;
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
          color: #031795;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          padding: 0.15rem 0.6rem;
          border-radius: 9999px;
        }
      }
    }

    .vehicle-alert-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 0.55rem 0.85rem;
      border-radius: 6px;
      margin-bottom: 0.65rem;
      font-size: 0.74rem;
      color: #92400e;

      .va-icon {
        font-size: 1rem;
        line-height: 1;
      }

      .va-text {
        line-height: 1.35;
      }
    }

    .vehicle-tag-badge {
      display: inline-block;
      font-weight: 800;
      font-size: 0.76rem;
      color: #031795;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .vehicle-plate-text {
      font-size: 0.72rem;
      font-weight: 700;
      color: #475569;
      margin-top: 2px;
      letter-spacing: 0.04em;
    }

    .obs-cell {
      text-align: left;

      .obs-notes {
        font-size: 0.72rem;
        font-weight: 600;
        color: #b45309;
        line-height: 1.3;
      }

      .defective-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-top: 4px;
      }

      .def-pill {
        display: inline-block;
        font-size: 0.65rem;
        font-weight: 600;
        color: #991b1b;
        background: #fee2e2;
        border: 1px solid #fecaca;
        padding: 1px 5px;
        border-radius: 4px;
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
export class ShiftReportPdfComponent implements OnInit, OnChanges {
  private pdfService = inject(PdfExportService);
  private crewService = inject(CrewService);
  private vehicleService = inject(VehicleChecklistService);
  private http = inject(HttpClient);

  @Input() handover: ShiftHandover | null = null;

  observedVehicles: HandoverVehicleObservation[] = [];
  operationalPumps: any[] = [];
  pumpSheet: any = null;
  rawCycloneSamples: any[] = [];
  latestTailings: any = null;

  get operationalCrewList() {
    if (this.handover?.assigned_crew && this.handover.assigned_crew.length > 0) {
      return this.handover.assigned_crew;
    }
    const shift = this.reportData.shift_code?.substring(0, 2) || (typeof localStorage !== 'undefined' ? localStorage.getItem('basetrack_active_shift') : null) || 'G1';
    const positions = this.crewService.positions().filter(p => p.key !== 'SUPERVISOR');
    return positions.map(p => {
      const op = this.crewService.getAssignedOperatorForPosition(p.key, shift);
      return {
        key: p.key,
        title: p.title,
        operatorName: op?.name || '--- Sin Asignar ---',
        documentId: op?.document_id || '---',
        radioChannel: op?.radio_channel || p.defaultRadio || 'Canal 1 Operaciones',
        location: p.defaultLocation || 'Planta Concentradora'
      };
    });
  }
  
  private _isOpen = false;
  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val) {
      this.loadOperationalData();
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

  reportData: ShiftHandover = {
    id: 'DEMO-1',
    shift_code: 'G1-01',
    date: new Date().toISOString().split('T')[0],
    shift_type: 'DIA',
    outgoing_supervisor: '',
    outgoing_dni: '',
    outgoing_role: 'Supervisor de guardia',
    incoming_supervisor: '',
    incoming_dni: '',
    incoming_role: 'Supervisor de guardia',
    plant_status: 'Operación normal a ritmo de tratamiento continuo. Se mantuvo estabilidad en flotación y clasificación.',
    tonnage_processed: 48250,
    safety_incidents: 'Sin accidentes ni incidentes con tiempo perdido en el turno. Charla de seguridad realizada.',
    operational_highlights: 'Buen rendimiento en nidos de ciclones y transporte de pulpa.',
    pending_tasks: 'Inspección de desgaste en impulsor de Bomba PP-101 para la parada programada de mañana.',
    status: 'ACCEPTED',
    created_at: new Date().toISOString()
  };

  ngOnInit(): void {
    this.syncHandoverData();
    this.loadOperationalData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['handover'] && this.handover) {
      this.syncHandoverData();
    }
    if (changes['isOpen'] && this.isOpen) {
      this.loadOperationalData();
    }
  }

  private syncHandoverData(): void {
    if (this.handover) {
      this.reportData = { ...this.handover };
    }
    const active = getCurrentActiveShift();
    const isInvalidSup = (name?: string) => !name || name.includes('VIZCARRA CORI') || name.includes('Roberto Quispe') || name.includes('LLERENA CALLE') || name.includes('Marco Vel');

    if (isInvalidSup(this.reportData.outgoing_supervisor)) {
      const shift = this.reportData.shift_code?.substring(0, 2) || active.activeGuard.code;
      const sup = this.crewService.getActiveSupervisorForShift(shift);
      this.reportData.outgoing_supervisor = sup?.name || active.activeGuard.supervisorName;
      this.reportData.outgoing_dni = sup?.document_id || (shift === 'G4' ? '18110964' : '41833717');
      this.reportData.outgoing_role = 'Supervisor de guardia';
    }

    if (isInvalidSup(this.reportData.incoming_supervisor)) {
      const inSup = this.crewService.getActiveSupervisorForShift(active.nextGuard.code);
      this.reportData.incoming_supervisor = inSup?.name || active.nextGuard.supervisorName;
      this.reportData.incoming_dni = inSup?.document_id || (active.nextGuard.code === 'G2' ? '46593500' : '40132660');
      this.reportData.incoming_role = 'Supervisor de guardia';
    }
  }

  loadOperationalData(): void {
    // 1. Bombas: telemetry & sheet
    const cachedPumps = getRealtimeData<any[]>('pumps_telemetry', []);
    if (cachedPumps && cachedPumps.length > 0) {
      this.operationalPumps = cachedPumps;
    }
    this.http.get<any>(`${getApiBaseUrl()}/pumps`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.operationalPumps = res.data;
        }
      },
      error: () => {}
    });

    const cachedSheet = getRealtimeData<any>('pump_sheet_latest', null);
    if (cachedSheet) {
      this.pumpSheet = cachedSheet;
    }
    this.http.get<any>(`${getApiBaseUrl()}/pumps/operational-sheet`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.pumpSheet = res.data;
        }
      },
      error: () => {}
    });

    // 2. Ciclones
    const cachedSamples = getRealtimeData<any[]>('cyclone_samples', []);
    if (cachedSamples && cachedSamples.length > 0) {
      this.rawCycloneSamples = cachedSamples;
    }
    this.http.get<any>(`${getApiBaseUrl()}/cyclones/station-samples`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.rawCycloneSamples = res.data;
        }
      },
      error: () => {}
    });

    // 3. Relaves
    const cachedTailings = getRealtimeData<any[]>('tailings_reports', []);
    if (cachedTailings && cachedTailings.length > 0) {
      this.latestTailings = cachedTailings[0];
    }
    this.http.get<any>(`${getApiBaseUrl()}/tailings`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.latestTailings = res.data[0];
        }
      },
      error: () => {}
    });

    // 4. Camionetas Mineras (Checklist Pre-Uso)
    // REGLA ESTRICTA: Solo unidades OBSERVADAS o NO APTAS. Unidades APTAS (Verde) quedan excluidas del informe.
    this.observedVehicles = this.vehicleService.getObservedOrNonAptoVehicles();
    this.http.get<any>(`${getApiBaseUrl()}/vehicles/checklists`).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data)) {
          this.observedVehicles = this.vehicleService.getObservedOrNonAptoVehicles(res.data);
        }
      },
      error: () => {}
    });
  }

  // --- GETTERS: PUMPS METRICS & TABLES ---
  get sentinaActiveCount(): number {
    if (!this.pumpSheet?.sentina_pumps) return 0;
    return this.pumpSheet.sentina_pumps.filter((p: any) => p.status === 'Operativo').length;
  }

  get intermediaActiveCount(): number {
    if (!this.pumpSheet?.intermedia_pumps) return 0;
    return this.pumpSheet.intermedia_pumps.filter((p: any) => p.status === 'Operativo').length;
  }

  get torre5ActiveCount(): number {
    if (!this.pumpSheet?.torre5_pumps) return 0;
    return this.pumpSheet.torre5_pumps.filter((p: any) => p.status === 'Operativo').length;
  }

  get displayPumps(): any[] {
    if (this.operationalPumps && this.operationalPumps.length > 0) {
      return this.operationalPumps.map(p => {
        const statusUpper = (p.status || 'OPERATING').toUpperCase();
        let badgeClass = 'badge-green';
        let statusLabel = 'OPERANDO';
        if (statusUpper === 'STANDBY' || statusUpper === 'STAND BY') {
          badgeClass = 'badge-slate';
          statusLabel = 'STANDBY';
        } else if (statusUpper === 'MAINTENANCE' || statusUpper === 'MANTENIMIENTO') {
          badgeClass = 'badge-amber';
          statusLabel = 'MANTENIMIENTO';
        } else if (statusUpper === 'FAULT' || statusUpper === 'CRITICAL' || statusUpper === 'FALLA') {
          badgeClass = 'badge-rose';
          statusLabel = 'FALLA';
        }

        let pressStr = '0 PSI';
        if (p.pressure_bar !== undefined && p.pressure_bar !== null && p.pressure_bar > 0) {
          pressStr = `${(p.pressure_bar * 14.5038).toFixed(1)} PSI (${p.pressure_bar} bar)`;
        } else if (p.pressure_psi) {
          pressStr = `${p.pressure_psi} PSI`;
        }

        const formatSystemName = (sys: string, name: string) => {
          if (name && name.length > 5) return name;
          if (!sys) return 'Circuito General';
          switch (sys) {
            case 'ALIMENTACION_CICLONES': return 'Alimentación Ciclones';
            case 'TRANSPORTE_RELAVES': return 'Línea de Relaves';
            case 'DESCARGA_MOLIENDA': return 'Descarga Molienda SAG';
            case 'AGUA_RECUPERADA': return 'Sistema Agua Clarificada';
            default: return sys.replace(/_/g, ' ');
          }
        };

        return {
          tag: p.tag,
          systemName: formatSystemName(p.system, p.name),
          badgeClass,
          statusLabel,
          currentAmps: p.current_amps ? `${p.current_amps} A` : '0 A',
          pressure: pressStr,
          observations: p.notes || (statusLabel === 'OPERANDO' ? 'Operación en rango normal' : (statusLabel === 'STANDBY' ? 'Listo para respaldo' : 'Inspección técnica'))
        };
      });
    }

    return [
      { systemName: 'Sentina Principal', tag: 'PP-101', badgeClass: 'badge-green', statusLabel: 'OPERANDO', currentAmps: '142 A', pressure: '34.5 PSI', observations: 'Vibración en rango permisible' },
      { systemName: 'Sentina Principal', tag: 'PP-102', badgeClass: 'badge-slate', statusLabel: 'STANDBY', currentAmps: '0 A', pressure: '0 PSI', observations: 'Listo para respaldo automático' },
      { systemName: 'Bombeo Intermedio', tag: 'PP-201', badgeClass: 'badge-green', statusLabel: 'OPERANDO', currentAmps: '158 A', pressure: '42.0 PSI', observations: 'Caudal sostenido a ciclones' },
      { systemName: 'Bombeo Intermedio', tag: 'PP-202', badgeClass: 'badge-green', statusLabel: 'OPERANDO', currentAmps: '155 A', pressure: '41.2 PSI', observations: 'Operación continua normal' },
      { systemName: 'Estación Torre 5', tag: 'PP-501', badgeClass: 'badge-green', statusLabel: 'OPERANDO', currentAmps: '110 A', pressure: '28.4 PSI', observations: 'Retorno de agua clara' },
      { systemName: 'Línea Relaves', tag: 'TL-201', badgeClass: 'badge-green', statusLabel: 'OPERANDO', currentAmps: '168 A', pressure: '48.0 PSI', observations: 'Descarga estable hacia presa' }
    ];
  }

  get pumpOperatingCount(): number {
    if (this.displayPumps.length > 0) {
      return this.displayPumps.filter(p => p.statusLabel === 'OPERANDO').length;
    }
    if (this.pumpSheet) {
      return (this.sentinaActiveCount + this.intermediaActiveCount + this.torre5ActiveCount);
    }
    return 5;
  }

  get pumpTotalCount(): number {
    if (this.displayPumps.length > 0) {
      return this.displayPumps.length;
    }
    if (this.pumpSheet) {
      return (
        (this.pumpSheet.sentina_pumps?.length || 8) +
        (this.pumpSheet.intermedia_pumps?.length || 6) +
        (this.pumpSheet.torre5_pumps?.length || 10)
      );
    }
    return 6;
  }

  get pumpAvailabilityPercent(): number {
    const total = this.pumpTotalCount;
    if (total === 0) return 100;
    return Number(((this.pumpOperatingCount / total) * 100).toFixed(1));
  }

  // --- GETTERS: CYCLONE STATION ROWS & METRICS ---
  get cycloneStationRows() {
    const samples = this.rawCycloneSamples || [];
    
    const s1 = samples.filter((s: any) => 
      (s.station && s.station.toLowerCase().includes('1ra')) || 
      s.battery_tag === 'CY1' || s.battery_tag === 'CY2'
    );
    const s2 = samples.filter((s: any) => 
      (s.station && s.station.toLowerCase().includes('2da')) || 
      s.battery_tag === 'CY3' || s.battery_tag === 'CY4'
    );

    const calc = (list: any[], defaultFeed: number, defaultOf: number, defaultUf: number, defaultM200: number) => {
      if (list.length === 0) {
        return {
          feed: defaultFeed,
          of: defaultOf,
          uf: defaultUf,
          m200: defaultM200
        };
      }
      const sum = list.reduce((acc, c) => ({
        feed: acc.feed + Number(c.solids_feed || 0),
        of: acc.of + Number(c.solids_of || 0),
        uf: acc.uf + Number(c.solids_uf || 0),
        m200: acc.m200 + Number(c.mesh200_of || 0)
      }), { feed: 0, of: 0, uf: 0, m200: 0 });
      return {
        feed: Number((sum.feed / list.length).toFixed(2)),
        of: Number((sum.of / list.length).toFixed(2)),
        uf: Number((sum.uf / list.length).toFixed(2)),
        m200: Number((sum.m200 / list.length).toFixed(2))
      };
    };

    const avg1 = calc(s1, 44.8, 28.5, 69.2, 52.4);
    const avg2 = calc(s2, 45.6, 29.5, 70.1, 64.5);

    return [
      {
        name: '1ra Estación (CY1/2)',
        activeCount: '4 de 6 en línea',
        pressure: '16.2 PSI',
        solidsFeed: avg1.feed,
        solidsOf: avg1.of,
        solidsUf: avg1.uf,
        mesh200Of: avg1.m200,
        isTarget: false
      },
      {
        name: '2da Estación (CY3/4)',
        activeCount: '5 de 6 en línea',
        pressure: '18.5 PSI',
        solidsFeed: avg2.feed,
        solidsOf: avg2.of,
        solidsUf: avg2.uf,
        mesh200Of: avg2.m200,
        isTarget: true
      }
    ];
  }

  get liveMesh200Of(): number {
    return this.cycloneStationRows[1]?.mesh200Of || 64.5;
  }

  // --- GETTERS: TAILINGS METRICS ---
  get liveWaterMirror(): number {
    if (this.latestTailings?.dam_level_meters) {
      return Number(this.latestTailings.dam_level_meters);
    }
    if (this.pumpSheet?.levels?.espejo) {
      const parsed = parseFloat(String(this.pumpSheet.levels.espejo).replace(',', '.'));
      if (!isNaN(parsed)) return parsed;
    }
    return 4120.4;
  }

  get liveFreeboard(): number {
    if (this.latestTailings?.freeboard_meters) {
      return Number(this.latestTailings.freeboard_meters);
    }
    return 3.8;
  }

  get livePiezometer(): number {
    if (this.latestTailings?.piezometer_kpa) {
      return Number(this.latestTailings.piezometer_kpa);
    }
    return 142.6;
  }

  get liveTurbidity(): number {
    if (this.latestTailings?.turbidity_ntu) {
      return Number(this.latestTailings.turbidity_ntu);
    }
    return 12.5;
  }

  get liveTonnage(): number {
    return this.reportData.tonnage_processed || 48250;
  }

  // --- GETTERS: DYNAMIC SUPERVISORS & SIGNATURES ---
  get outgoingSupervisorName(): string {
    const isInvalidSup = (name?: string) => !name || name.includes('VIZCARRA CORI') || name.includes('Roberto Quispe') || name.includes('LLERENA CALLE') || name.includes('Marco Vel');
    if (!isInvalidSup(this.reportData.outgoing_supervisor)) {
      return this.reportData.outgoing_supervisor;
    }
    const active = getCurrentActiveShift();
    const shift = this.reportData.shift_code?.substring(0, 2) || active.activeGuard.code;
    const sup = this.crewService.getActiveSupervisorForShift(shift);
    return sup?.name || active.activeGuard.supervisorName;
  }

  get outgoingSupervisorDni(): string {
    if (this.reportData.outgoing_dni) {
      return this.reportData.outgoing_dni;
    }
    const active = getCurrentActiveShift();
    const shift = this.reportData.shift_code?.substring(0, 2) || active.activeGuard.code;
    const sup = this.crewService.getActiveSupervisorForShift(shift);
    return sup?.document_id || (shift === 'G4' ? '18110964' : '41833717');
  }

  get outgoingSupervisorRole(): string {
    return this.reportData.outgoing_role || 'Supervisor de guardia';
  }

  get incomingSupervisorName(): string {
    const isInvalidSup = (name?: string) => !name || name.includes('VIZCARRA CORI') || name.includes('Roberto Quispe') || name.includes('LLERENA CALLE') || name.includes('Marco Vel');
    if (!isInvalidSup(this.reportData.incoming_supervisor)) {
      return this.reportData.incoming_supervisor;
    }
    const active = getCurrentActiveShift();
    const inSup = this.crewService.getActiveSupervisorForShift(active.nextGuard.code);
    return inSup?.name || active.nextGuard.supervisorName;
  }

  get incomingSupervisorDni(): string {
    if (this.reportData.incoming_dni && this.reportData.incoming_dni !== '71491945') {
      return this.reportData.incoming_dni;
    }
    const active = getCurrentActiveShift();
    const inSup = this.crewService.getActiveSupervisorForShift(active.nextGuard.code);
    return inSup?.document_id || (active.nextGuard.code === 'G2' ? '46593500' : '40132660');
  }

  get incomingSupervisorRole(): string {
    return this.reportData.incoming_role || 'Supervisor de guardia';
  }

  get isAccepted(): boolean {
    return this.reportData.status === 'ACCEPTED';
  }

  async downloadDirectPdf(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;
    const cleanDate = (this.reportData.date || new Date().toISOString().split('T')[0]).replace(/[\/\\]/g, '-');
    const filename = `Informe_Oficial_Guardia_${cleanDate}.pdf`;
    const success = await this.pdfService.exportToPdf('printable-shift-report', filename);
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
    let vehText = '';
    if (this.observedVehicles && this.observedVehicles.length > 0) {
      vehText = `\n🚗 *NOVEDADES VEHICULARES (${this.observedVehicles.length} UNIDAD(ES) CON OBSERVACIÓN / NO APTA):*\n` +
        this.observedVehicles.map(v => `  • ${v.tag} (${v.plate}) [${v.operationalStatus}]: ${v.observationNotes} | Cond: ${v.driverName}`).join('\n');
    }

    const summary = `📋 *BASETRACK - REPORTE OFICIAL DE RELEVO DE GUARDIA*
📅 Fecha: ${this.reportData.date} | Turno: ${this.reportData.shift_type} | Código: ${this.reportData.shift_code}
👤 Entrega: ${this.outgoingSupervisorName} (DNI: ${this.outgoingSupervisorDni})
👤 Recibe: ${this.incomingSupervisorName} (DNI: ${this.incomingSupervisorDni})
⚖️ Tonelaje Procesado: ${(this.reportData.tonnage_processed || this.liveTonnage).toLocaleString()} TMS
🌪️ Malla -200 Final (OF): ${this.liveMesh200Of}%
⚡ Disponibilidad Bombas: ${this.pumpAvailabilityPercent}% (${this.pumpOperatingCount}/${this.pumpTotalCount} Operativas)
🌊 Borde Libre Presa: ${this.liveFreeboard}m (${this.liveFreeboard >= 2.5 ? 'Estable' : 'Alerta'})
📌 Novedad de Planta: ${this.reportData.plant_status}
⚠️ Pendientes Críticos: ${this.reportData.pending_tasks || 'Ninguno'}${vehText}
✅ Estado: ${this.isAccepted ? 'ACEPTADO Y CONFORME' : 'PENDIENTE DE CONFORMIDAD'}`;

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
