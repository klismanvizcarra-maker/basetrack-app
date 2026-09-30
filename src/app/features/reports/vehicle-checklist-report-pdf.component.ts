import { Component, Input, Output, EventEmitter, OnInit, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VehicleChecklist, VehicleInfo, InspectionCheckItem } from '../../core/services/vehicle-checklist.service';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { CrewService } from '../../core/services/crew.service';
import { copyToClipboard } from '../../core/utils/clipboard.util';

@Component({
  selector: 'app-vehicle-checklist-report-pdf',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="report-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)">
      <div class="report-modal-wrapper animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Modal Action Header (No se imprime) -->
        <div class="report-modal-header no-print">
          <div class="header-info">
            <div class="tag-badge">FORMATO OFICIAL SST A4 (DS-024-2016-EM)</div>
            <h3>Checklist de Inspección Pre-Uso de Camioneta {{ checklist?.vehicle_plate }}</h3>
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
        <div class="report-document-body" id="printable-vehicle-checklist-report" *ngIf="checklist">
          
          <!-- Encabezado Institucional -->
          <div class="doc-header">
            <div class="doc-logo-group">
              <div class="brand-symbol">
                <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK" class="brand-img" />
              </div>
              <div class="brand-titles">
                <h1>BASETRACK INDUSTRIAL</h1>
                <p class="doc-sub">SISTEMA INTEGRADO DE GESTIÓN SST & FLOTA VEHICULAR OPERATIVA</p>
              </div>
            </div>

            <div class="doc-meta-box">
              <div class="meta-row"><strong>FORMATO:</strong> <span>FOR-SST-VEH-01</span></div>
              <div class="meta-row"><strong>VERSIÓN:</strong> <span>03 (2026)</span></div>
              <div class="meta-row"><strong>FECHA:</strong> <span>{{ checklist.date }} {{ checklist.time }}</span></div>
              <div class="meta-row"><strong>PLACA / TAG:</strong> <span>{{ checklist.vehicle_plate }} / {{ vehicleInfo?.tag || 'CAM-01' }}</span></div>
            </div>
          </div>

          <div class="doc-title-banner">
            <h2>CHECKLIST DE INSPECCIÓN PRE-USO DE VEHÍCULOS LIVIANOS / CAMIONETAS 4X4 (D.S. 024-2016-EM)</h2>
          </div>

          <!-- Datos de Unidad y Conductor -->
          <div class="unit-driver-banner">
            <div class="unit-col">
              <div class="row-spec"><strong>VEHÍCULO:</strong> <span>{{ vehicleInfo?.model || 'Toyota Hilux 4x4 Turbodiésel' }} ({{ vehicleInfo?.color || 'Blanco' }})</span></div>
              <div class="row-spec"><strong>ÁREA ASIGNADA:</strong> <span>{{ vehicleInfo?.area || 'Operaciones Planta' }}</span></div>
              <div class="row-spec"><strong>ODÓMETRO / KM:</strong> <span class="highlight-val">{{ checklist.odometer | number }} km</span></div>
            </div>
            <div class="driver-col">
              <div class="row-spec"><strong>CONDUCTOR:</strong> <span class="highlight-driver">{{ checklist.driver_name }}</span></div>
              <div class="row-spec"><strong>DNI / BREVETE:</strong> <span>DNI {{ checklist.driver_dni }} • Lic. {{ checklist.driver_license || 'Vigente' }}</span></div>
              <div class="row-spec"><strong>GUARDIA / TURNO:</strong> <span>Guardia {{ checklist.shift }} (Turno {{ checklist.shift_type }})</span></div>
            </div>
            <div class="status-col">
              <span class="status-header">CONDICIÓN OPERATIVA</span>
              <div class="status-badge-box" [class]="'badge-' + (checklist.operational_status || 'APTO').toLowerCase()">
                {{ checklist.operational_status }}
              </div>
              <span class="status-sub">
                {{ checklist.operational_status === 'APTO' ? 'AUTORIZADO PARA CIRCULAR' : (checklist.operational_status === 'OBSERVADO' ? 'CIRCULACIÓN CONDICIONADA' : 'INMOVILIZADO / PROHIBIDO') }}
              </span>
            </div>
          </div>

          <!-- Indicadores de Cumplimiento -->
          <div class="kpi-mini-grid">
            <div class="kpi-box">
              <span class="kpi-lbl">TOTAL PUNTOS AUDITADOS</span>
              <span class="kpi-num">{{ totalItemsCount }} Ítems</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-lbl">CONFORMES (BUENO)</span>
              <span class="kpi-num color-green">{{ goodItemsCount }} Conformes</span>
            </div>
            <div class="kpi-box">
              <span class="kpi-lbl">OBSERVADOS (MALO)</span>
              <span class="kpi-num" [class.color-red]="badItemsCount > 0" [class.color-neutral]="badItemsCount === 0">
                {{ badItemsCount }} Observaciones
              </span>
            </div>
            <div class="kpi-box">
              <span class="kpi-lbl">ÍNDICE DE CONFORMIDAD</span>
              <span class="kpi-num color-blue">{{ complianceRate | number:'1.0-1' }}%</span>
            </div>
          </div>

          <!-- Tabla Compacta de 26 Ítems en 2 Columnas -->
          <div class="doc-section">
            <div class="section-heading">INSPECCIÓN DETALLADA DE 26 PUNTOS NORMATIVOS DE SEGURIDAD (D.S. 024-2016-EM)</div>
            
            <div class="two-columns-items">
              
              <!-- Columna Izquierda (Grupos 1, 2, 3) -->
              <div class="items-column">
                
                <!-- 1. Luces y Sistema Eléctrico -->
                <div class="category-block">
                  <div class="category-title">1. SISTEMA ELÉCTRICO Y LUCES</div>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 75%">Ítem Evaluado</th>
                        <th style="width: 25%; text-align: center;">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of group1Items">
                        <td>{{ item.name }}</td>
                        <td class="status-cell" [class.status-cell-b]="item.status === 'B'" [class.status-cell-m]="item.status === 'M'">
                          {{ item.status === 'B' ? 'CONFORME (B)' : (item.status === 'M' ? 'DEFECTUOSO (M)' : 'N/A') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 2. Niveles y Motor -->
                <div class="category-block">
                  <div class="category-title">2. NIVELES DE FLUIDOS Y MECÁNICA DE MOTOR</div>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 75%">Ítem Evaluado</th>
                        <th style="width: 25%; text-align: center;">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of group2Items">
                        <td>{{ item.name }}</td>
                        <td class="status-cell" [class.status-cell-b]="item.status === 'B'" [class.status-cell-m]="item.status === 'M'">
                          {{ item.status === 'B' ? 'CONFORME (B)' : (item.status === 'M' ? 'DEFECTUOSO (M)' : 'N/A') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 3. Neumáticos -->
                <div class="category-block">
                  <div class="category-title">3. NEUMÁTICOS Y SISTEMA DE RODAMIENTO</div>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 75%">Ítem Evaluado</th>
                        <th style="width: 25%; text-align: center;">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of group3Items">
                        <td>{{ item.name }}</td>
                        <td class="status-cell" [class.status-cell-b]="item.status === 'B'" [class.status-cell-m]="item.status === 'M'">
                          {{ item.status === 'B' ? 'CONFORME (B)' : (item.status === 'M' ? 'DEFECTUOSO (M)' : 'N/A') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>

              <!-- Columna Derecha (Grupos 4, 5, 6) -->
              <div class="items-column">
                
                <!-- 4. Cabina y Frenos -->
                <div class="category-block">
                  <div class="category-title">4. CABINA, FRENOS Y VISIBILIDAD</div>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 75%">Ítem Evaluado</th>
                        <th style="width: 25%; text-align: center;">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of group4Items">
                        <td>{{ item.name }}</td>
                        <td class="status-cell" [class.status-cell-b]="item.status === 'B'" [class.status-cell-m]="item.status === 'M'">
                          {{ item.status === 'B' ? 'CONFORME (B)' : (item.status === 'M' ? 'DEFECTUOSO (M)' : 'N/A') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 5. Equipo de Emergencia -->
                <div class="category-block">
                  <div class="category-title">5. EQUIPAMIENTO DE EMERGENCIA MINERO</div>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 75%">Ítem Evaluado</th>
                        <th style="width: 25%; text-align: center;">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of group5Items">
                        <td>{{ item.name }}</td>
                        <td class="status-cell" [class.status-cell-b]="item.status === 'B'" [class.status-cell-m]="item.status === 'M'">
                          {{ item.status === 'B' ? 'CONFORME (B)' : (item.status === 'M' ? 'DEFECTUOSO (M)' : 'N/A') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 6. Documentación Oficial -->
                <div class="category-block">
                  <div class="category-title">6. DOCUMENTACIÓN REGLAMENTARIA (MTC / MINERÍA)</div>
                  <table class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 75%">Ítem Evaluado</th>
                        <th style="width: 25%; text-align: center;">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let item of group6Items">
                        <td>{{ item.name }}</td>
                        <td class="status-cell" [class.status-cell-b]="item.status === 'B'" [class.status-cell-m]="item.status === 'M'">
                          {{ item.status === 'B' ? 'CONFORME (B)' : (item.status === 'M' ? 'DEFECTUOSO (M)' : 'N/A') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          </div>

          <!-- Observaciones, Evidencia Fotográfica y Declaración Jurada -->
          <div class="doc-section">
            <div class="section-heading">OBSERVACIONES OPERATIVAS, EVIDENCIA FOTOGRÁFICA Y DECLARACIÓN JURADA</div>
            <div class="obs-container-row">
              
              <!-- Columna Principal: Notas, Alertas e Inspección Legal -->
              <div class="obs-notes-box" [class.has-alert]="checklist.has_observations || defectiveItems.length > 0">
                
                <div class="obs-header-status">
                  <div class="obs-status-tag" [class.tag-alert]="checklist.has_observations || defectiveItems.length > 0" [class.tag-ok]="!checklist.has_observations && defectiveItems.length === 0">
                    <span class="status-icon">{{ (checklist.has_observations || defectiveItems.length > 0) ? '⚠️' : '✅' }}</span>
                    <span>{{ (checklist.has_observations || defectiveItems.length > 0) ? 'CONDICIÓN CON OBSERVACIONES REPORTADAS' : 'INSPECCIÓN PRE-OPERACIONAL 100% CONFORME' }}</span>
                  </div>
                  <span class="obs-timestamp">Inspección: {{ checklist.date }} • {{ checklist.time }} hrs</span>
                </div>

                <!-- Lista de Ítems Críticos/Observados si existen -->
                <div *ngIf="defectiveItems.length > 0" class="defective-items-block">
                  <span class="defective-title">HALLAZGOS ESPECÍFICOS OBSERVADOS:</span>
                  <div class="defective-tags-row">
                    <span *ngFor="let def of defectiveItems" class="def-pill">
                      <strong>{{ def.name }}</strong> ({{ def.category }})
                    </span>
                  </div>
                </div>

                <!-- Notas del Conductor -->
                <div class="notes-content-box">
                  <span class="obs-lbl">NOTAS DEL CONDUCTOR / OPERADOR:</span>
                  <p class="obs-text">
                    {{ checklist.observation_notes || (checklist.has_observations ? 'Unidad presenta observaciones en inspección visual de inicio de turno.' : 'Sin novedades operativas. Unidad 100% apta para operaciones, transporte de personal y acarreo en faena minera.') }}
                  </p>
                </div>

                <!-- Declaración Jurada Minera Formal -->
                <div class="declaration-legal-card">
                  <div class="dec-header">
                    <span class="dec-scale">⚖️</span>
                    <strong>DECLARACIÓN JURADA DE INSPECCIÓN VEHICULAR (D.S. 024-2016-EM):</strong>
                  </div>
                  <p class="dec-body">
                    Certifico bajo juramento que he inspeccionado físicamente la camioneta <strong>{{ checklist.vehicle_plate }}</strong> antes de su puesta en marcha, habiendo realizado la prueba efectiva de frenos, dirección, neumáticos, luces, circulina, pértiga, extintor y equipo de emergencia. Asumo plena responsabilidad legal por la veracidad de la información reportada conforme al Artículo 268 y 269 del Reglamento de Seguridad Minera.
                  </p>
                </div>

              </div>

              <!-- Columna Lateral: Marco de Evidencia Fotográfica HD -->
              <div class="obs-photo-box" [class.has-real-photo]="!!checklist.photo_url">
                <div *ngIf="checklist.photo_url" class="photo-frame">
                  <div class="photo-banner-header">
                    <span>EVIDENCIA PRE-USO</span>
                    <span class="photo-res">HD 📷</span>
                  </div>
                  <img [src]="checklist.photo_url" alt="Foto evidencia" class="pdf-obs-img" />
                  <div class="photo-footer-badge">
                    <span>{{ checklist.vehicle_plate }} • {{ checklist.odometer | number }} km</span>
                  </div>
                </div>

                <div *ngIf="!checklist.photo_url" class="no-photo-card">
                  <div class="no-photo-seal-box">
                    <div class="seal-ring">
                      <span class="seal-icon">✓</span>
                      <span class="seal-txt">VERIFICADO</span>
                    </div>
                  </div>
                  <span class="no-photo-title">INSPECCIÓN VISUAL CONFORME</span>
                  <span class="no-photo-desc">Carrocería, lunas y neumáticos sin averías ni abolladuras reportadas.</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Firmas Oficiales de Conformidad -->
          <div class="signatures-grid">
            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ checklist.driver_name }}</span>
              <span class="sig-role">CONDUCTOR / INSPECTOR VEHICULAR</span>
              <span class="sig-detail">DNI: {{ checklist.driver_dni }} • Brevete: {{ checklist.driver_license || 'Conforme' }}</span>
              <span class="sig-stamp">Firma Digital Registrada • {{ checklist.date }} {{ checklist.time }}</span>
            </div>

            <div class="signature-box">
              <div class="sig-line"></div>
              <span class="sig-name">{{ supervisorName }}</span>
              <span class="sig-role">SUPERVISOR DE GUARDIA {{ checklist.shift }} / RESPONSABLE SST</span>
              <span class="sig-detail">DNI: {{ supervisorDni }} • BASETRACK INDUSTRIAL</span>
              <span class="sig-stamp">Validación de Turno Aprobada</span>
            </div>
          </div>

          <!-- Pie Institucional -->
          <div class="doc-footer">
            <div class="doc-legal-note">
              Este documento constituye un registro legal de cumplimiento obligatorio según el Reglamento de Seguridad y Salud Ocupacional en Minería (D.S. 024-2016-EM, Art. 268 y 269). Prohibida su alteración. Documento generado por Sistema BASETRACK v2.4.
            </div>
            <div class="doc-footer-meta">
              <span>PÁGINA 1 DE 1</span>
              <span>REG: {{ checklist.id }}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  `,
  styles: [`
    /* BACKDROP & MODAL */
    .report-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(6px);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow-y: auto;
      padding: 20px 10px;
    }

    .report-modal-wrapper {
      background: #ffffff;
      width: 100%;
      max-width: 900px;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      margin: auto;
      color: #0f172a;
      display: flex;
      flex-direction: column;
    }

    /* ACTION HEADER (NO PRINT) */
    .report-modal-header {
      background: #0f172a;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0284c7;

      .header-info {
        .tag-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          background: #0284c7;
          color: #ffffff;
          padding: 2px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #ffffff;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;

          &.btn-download-pdf {
            background: #0284c7;
            color: #ffffff;
            &:hover:not(:disabled) { background: #0369a1; }
            &:disabled { opacity: 0.6; cursor: not-allowed; }
          }

          &.btn-print {
            background: #334155;
            color: #ffffff;
            &:hover { background: #475569; }
          }

          &.btn-copy {
            background: #1e293b;
            color: #94a3b8;
            border: 1px solid #334155;
            &:hover { color: #ffffff; background: #334155; }
          }
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.3rem;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          &:hover { color: #ffffff; background: #334155; }
        }
      }
    }

    /* DOCUMENT BODY (PRINTABLE A4 1 PAGE) */
    .report-document-body {
      background: #ffffff;
      padding: 14px 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 8pt;
      line-height: 1.25;
      color: #0f172a;
    }

    /* HEADER */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }

    .doc-logo-group {
      display: flex;
      align-items: center;
      gap: 10px;

      .brand-symbol .brand-img {
        width: 38px;
        height: 38px;
        object-fit: contain;
      }

      .brand-titles {
        h1 {
          font-size: 1.15rem;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .doc-sub {
          margin: 0;
          font-size: 0.62rem;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.04em;
        }
      }
    }

    .doc-meta-box {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 4px;
      padding: 4px 8px;
      min-width: 175px;

      .meta-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.62rem;
        line-height: 1.35;
        strong { color: #334155; margin-right: 6px; font-weight: 800; }
        span { color: #0f172a; font-weight: 700; }
      }
    }

    .doc-title-banner {
      background: #0f172a;
      color: #ffffff;
      text-align: center;
      padding: 4px 6px;
      border-radius: 3px;
      margin-bottom: 6px;

      h2 {
        margin: 0;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.03em;
      }
    }

    /* UNIT & DRIVER BANNER */
    .unit-driver-banner {
      display: grid;
      grid-template-columns: 1.2fr 1.2fr 0.9fr;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 10px;
      margin-bottom: 6px;

      .row-spec {
        font-size: 0.68rem;
        line-height: 1.35;
        strong { color: #475569; font-weight: 800; display: inline-block; width: 105px; }
        span { color: #0f172a; font-weight: 600; }
        .highlight-val { color: #0284c7; font-weight: 800; }
        .highlight-driver { color: #0f172a; font-weight: 800; }
      }

      .status-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-left: 1px dashed #cbd5e1;
        padding-left: 8px;

        .status-header {
          font-size: 0.6rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .status-badge-box {
          font-size: 0.95rem;
          font-weight: 900;
          padding: 2px 14px;
          border-radius: 4px;
          letter-spacing: 0.05em;

          &.badge-apto {
            background: #dcfce7;
            color: #15803d;
            border: 1.5px solid #22c55e;
          }
          &.badge-observado {
            background: #fef3c7;
            color: #b45309;
            border: 1.5px solid #f59e0b;
          }
          &.badge-no_apto {
            background: #fee2e2;
            color: #b91c1c;
            border: 1.5px solid #ef4444;
          }
        }

        .status-sub {
          font-size: 0.58rem;
          font-weight: 700;
          color: #64748b;
          margin-top: 3px;
          text-align: center;
        }
      }
    }

    /* KPI MINI GRID */
    .kpi-mini-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 6px;

      .kpi-box {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 4px 6px;
        text-align: center;

        .kpi-lbl {
          font-size: 0.56rem;
          font-weight: 800;
          color: #64748b;
          display: block;
        }

        .kpi-num {
          font-size: 0.88rem;
          font-weight: 900;
          color: #0f172a;

          &.color-green { color: #16a34a; }
          &.color-red { color: #dc2626; }
          &.color-blue { color: #0284c7; }
          &.color-neutral { color: #64748b; }
        }
      }
    }

    /* SECTION */
    .doc-section {
      margin-bottom: 6px;
      page-break-inside: avoid;
    }

    .section-heading {
      font-size: 0.68rem;
      font-weight: 800;
      color: #0284c7;
      background: #f0f9ff;
      padding: 3px 6px;
      border-radius: 3px;
      border-left: 3px solid #0284c7;
      margin-bottom: 4px;
      letter-spacing: 0.02em;
    }

    /* 2 COLUMNS ITEMS LAYOUT */
    .two-columns-items {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .category-block {
      margin-bottom: 5px;

      .category-title {
        font-size: 0.6rem;
        font-weight: 800;
        color: #334155;
        background: #e2e8f0;
        padding: 2px 5px;
        border-radius: 2px;
        margin-bottom: 2px;
      }
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6.8pt;

      th {
        background: #f8fafc;
        color: #475569;
        font-weight: 800;
        padding: 2px 4px;
        border: 1px solid #cbd5e1;
        font-size: 6.5pt;
      }

      td {
        padding: 2px 4px;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }

      .status-cell {
        text-align: center;
        font-weight: 800;
        font-size: 6.3pt;
        letter-spacing: 0.02em;

        &.status-cell-b {
          background: #f0fdf4;
          color: #15803d;
        }

        &.status-cell-m {
          background: #fef2f2;
          color: #b91c1c;
        }
      }
    }

    /* OBSERVATIONS & PHOTO ENHANCED */
    .obs-container-row {
      display: grid;
      grid-template-columns: 1fr 145px;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 8px;

      .obs-notes-box {
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.has-alert {
          border-left: 3px solid #f59e0b;
          padding-left: 6px;
        }

        .obs-header-status {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .obs-status-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 6.2pt;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 3px;
            letter-spacing: 0.02em;

            &.tag-ok {
              background: #ecfdf5;
              color: #047857;
              border: 1px solid #a7f3d0;
            }

            &.tag-alert {
              background: #fffbeb;
              color: #b45309;
              border: 1px solid #fde68a;
            }
          }

          .obs-timestamp {
            font-size: 5.6pt;
            font-weight: 700;
            color: #64748b;
          }
        }

        .defective-items-block {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 3px;
          padding: 3px 6px;

          .defective-title {
            font-size: 5.6pt;
            font-weight: 900;
            color: #b91c1c;
            display: block;
            margin-bottom: 2px;
          }

          .defective-tags-row {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;

            .def-pill {
              font-size: 5.6pt;
              background: #ffffff;
              color: #991b1b;
              border: 1px solid #fca5a5;
              padding: 1px 5px;
              border-radius: 3px;
              strong { font-weight: 800; }
            }
          }
        }

        .notes-content-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 3px;
          padding: 3px 6px;

          .obs-lbl {
            font-size: 5.8pt;
            font-weight: 800;
            color: #475569;
            display: block;
            margin-bottom: 1px;
          }

          .obs-text {
            margin: 0;
            font-size: 6.8pt;
            font-weight: 600;
            color: #0f172a;
            line-height: 1.25;
          }
        }

        .declaration-legal-card {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 3px;
          padding: 3px 6px;

          .dec-header {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 5.8pt;
            font-weight: 900;
            color: #0369a1;
            margin-bottom: 2px;
          }

          .dec-body {
            margin: 0;
            font-size: 5.5pt;
            color: #334155;
            line-height: 1.22;
            text-align: justify;

            strong {
              color: #0f172a;
              font-weight: 800;
            }
          }
        }
      }

      .obs-photo-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-left: 1px dashed #cbd5e1;
        padding-left: 6px;

        .photo-frame {
          width: 100%;
          border: 1.5px solid #0284c7;
          border-radius: 4px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;

          .photo-banner-header {
            background: #0284c7;
            color: #ffffff;
            font-size: 5.5pt;
            font-weight: 900;
            padding: 2px 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            letter-spacing: 0.05em;
          }

          .pdf-obs-img {
            width: 100%;
            height: 72px;
            object-fit: cover;
            display: block;
          }

          .photo-footer-badge {
            background: #0f172a;
            color: #94a3b8;
            font-size: 5.2pt;
            font-weight: 700;
            text-align: center;
            padding: 1px 3px;
          }
        }

        .no-photo-card {
          width: 100%;
          height: 100%;
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          background: #f8fafc;
          padding: 6px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;

          .no-photo-seal-box {
            margin-bottom: 3px;

            .seal-ring {
              border: 1.5px solid #10b981;
              border-radius: 20px;
              padding: 1px 8px;
              display: inline-flex;
              align-items: center;
              gap: 3px;
              background: #ecfdf5;

              .seal-icon {
                color: #059669;
                font-weight: 900;
                font-size: 6.5pt;
              }

              .seal-txt {
                color: #047857;
                font-weight: 900;
                font-size: 5.5pt;
                letter-spacing: 0.05em;
              }
            }
          }

          .no-photo-title {
            font-size: 5.6pt;
            font-weight: 800;
            color: #334155;
            display: block;
            margin-bottom: 2px;
          }

          .no-photo-desc {
            font-size: 4.8pt;
            color: #64748b;
            line-height: 1.15;
          }
        }
      }
    }

    /* SIGNATURES */
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 8px;
      margin-bottom: 4px;
      page-break-inside: avoid;
    }

    .signature-box {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;

      .sig-line {
        width: 80%;
        border-top: 1.2px solid #0f172a;
        margin-bottom: 3px;
      }

      .sig-name {
        font-size: 6.8pt;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.02em;
      }

      .sig-role {
        font-size: 5.8pt;
        font-weight: 700;
        color: #475569;
        margin: 1px 0;
      }

      .sig-detail {
        font-size: 5.5pt;
        color: #64748b;
      }

      .sig-stamp {
        font-size: 5.2pt;
        font-weight: 700;
        color: #0284c7;
        margin-top: 2px;
        background: #f0f9ff;
        padding: 1px 6px;
        border-radius: 3px;
      }
    }

    /* FOOTER */
    .doc-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 5.8pt;
      color: #94a3b8;

      .doc-legal-note {
        max-width: 80%;
        line-height: 1.2;
      }

      .doc-footer-meta {
        font-weight: 700;
        text-align: right;
        display: flex;
        flex-direction: column;
      }
    }

    /* ANIMATIONS & PRINT RULES */
    .animate-scale-in {
      animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    @media print {
      body * {
        visibility: hidden;
      }
      .report-backdrop {
        position: static !important;
        padding: 0 !important;
        background: none !important;
      }
      .no-print {
        display: none !important;
      }
      #printable-vehicle-checklist-report,
      #printable-vehicle-checklist-report * {
        visibility: visible;
      }
      #printable-vehicle-checklist-report {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 10mm;
      }
    }
  `]
})
export class VehicleChecklistReportPdfComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() checklist: VehicleChecklist | null = null;
  @Input() vehicleInfo: VehicleInfo | null = null;
  @Output() close = new EventEmitter<void>();

  private pdfExportService = inject(PdfExportService);
  private crewService = inject(CrewService);

  isDownloading = false;
  downloadSuccess = false;
  copiedText = false;

  supervisorName = 'FERNANDEZ ASCURRA DANTE PACO';
  supervisorDni = '18110964';

  ngOnInit(): void {
    this.updateSupervisor();
  }

  ngOnChanges(): void {
    this.updateSupervisor();
  }

  private updateSupervisor(): void {
    const shift = this.checklist?.shift || 'G4';
    const sup = this.crewService.getActiveSupervisorForShift(shift);
    if (sup) {
      this.supervisorName = sup.name;
      this.supervisorDni = sup.document_id || '18110964';
    } else {
      const fallback = CrewService.OFFICIAL_SUPERVISOR_MAP[shift] || CrewService.OFFICIAL_SUPERVISOR_MAP['G4'];
      this.supervisorName = fallback.name;
      this.supervisorDni = fallback.document_id;
    }
  }

  // Categorized items
  get group1Items(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.category === 'Luces y Eléctrico');
  }

  get group2Items(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.category === 'Niveles y Motor');
  }

  get group3Items(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.category === 'Neumáticos');
  }

  get group4Items(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.category === 'Cabina y Frenos');
  }

  get group5Items(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.category === 'Equipo Emergencia');
  }

  get group6Items(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.category === 'Documentación');
  }

  get totalItemsCount(): number {
    return this.checklist?.items?.length || 26;
  }

  get goodItemsCount(): number {
    return (this.checklist?.items || []).filter(i => i.status === 'B').length;
  }

  get badItemsCount(): number {
    return (this.checklist?.items || []).filter(i => i.status === 'M').length;
  }

  get defectiveItems(): InspectionCheckItem[] {
    return (this.checklist?.items || []).filter(i => i.status === 'M');
  }

  get complianceRate(): number {
    if (!this.totalItemsCount) return 100;
    return (this.goodItemsCount / this.totalItemsCount) * 100;
  }

  closeModal(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    this.closeModal();
  }

  async downloadDirectPdf(): Promise<void> {
    if (!this.checklist || this.isDownloading) return;
    this.isDownloading = true;

    const filename = `CHECKLIST_PREUSO_${this.checklist.vehicle_plate}_${this.checklist.date}_${this.checklist.shift}.pdf`;
    const success = await this.pdfExportService.exportToPdf('printable-vehicle-checklist-report', filename);

    this.isDownloading = false;
    if (success) {
      this.downloadSuccess = true;
      setTimeout(() => this.downloadSuccess = false, 3000);
    }
  }

  triggerPrint(): void {
    window.print();
  }

  copyExecutiveSummary(): void {
    if (!this.checklist) return;
    const summary = `=====================================================
BASETRACK INDUSTRIAL - INSPECCIÓN PRE-USO CAMIONETA 4X4
=====================================================
Placa: ${this.checklist.vehicle_plate} (${this.vehicleInfo?.model || 'Toyota Hilux'})
Fecha/Hora: ${this.checklist.date} ${this.checklist.time}
Guardia: ${this.checklist.shift} (${this.checklist.shift_type})
Conductor: ${this.checklist.driver_name} (DNI: ${this.checklist.driver_dni})
Odómetro: ${this.checklist.odometer.toLocaleString()} km
Estado Operativo: ${this.checklist.operational_status}
Conformidad: ${this.goodItemsCount}/${this.totalItemsCount} ítems (${this.complianceRate.toFixed(1)}%)
Observaciones: ${this.checklist.observation_notes || 'Sin observaciones'}
Supervisor: ${this.supervisorName}
=====================================================`;

    copyToClipboard(summary);
    this.copiedText = true;
    setTimeout(() => this.copiedText = false, 2500);
  }
}
