import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { timeout, catchError, of } from 'rxjs';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { CircularGaugeComponent } from '../../shared/ui/circular-gauge.component';
import { DistributionDonutComponent } from '../../shared/ui/distribution-donut.component';
import { WeeklyBarChartComponent } from '../../shared/ui/weekly-bar-chart.component';
import { WaveAreaChartComponent } from '../../shared/ui/wave-area-chart.component';
import { MasterSheetService } from '../../core/services/master-sheet.service';
import { MasterSheetEntry, SheetSummary } from '../../core/models/master-sheet.model';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatCardComponent,
    CircularGaugeComponent,
    DistributionDonutComponent,
    WeeklyBarChartComponent,
    WaveAreaChartComponent
  ],
  template: `
    <div class="dashboard-page animate-fade-in">
      <!-- 0. Main View Mode Switcher -->
      <header class="dashboard-header-bar">
        <div class="header-left">
          <div class="view-switch-tabs">
            <button
              class="tab-btn"
              [class.active]="activeTab === 'telemetry'"
              (click)="activeTab = 'telemetry'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
              <span>Telemetría en Vivo (SCADA)</span>
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab === 'mastersheet'"
              (click)="activeTab = 'mastersheet'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Planilla Maestra de Presa & Relaves</span>
              <span class="badge-office">Excel / CSV</span>
            </button>
          </div>
        </div>

        <div class="header-right" *ngIf="activeTab === 'mastersheet'">
          <!-- Fast Actions for Master Sheet -->
          <div class="action-buttons-group">
            <button class="btn-action primary" (click)="openUploadModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Cargar Excel / CSV</span>
            </button>

            <button class="btn-action outline" (click)="masterService.downloadMasterTemplate()" title="Descargar formato oficial en blanco para Excel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Descargar Plantilla .xlsx</span>
            </button>

            <button class="btn-action outline" (click)="masterService.exportCurrentRecords()" title="Exportar todos los días cargados">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>Exportar Reporte</span>
            </button>
          </div>
        </div>
      </header>

      <!-- ========================================== -->
      <!-- TAB 1: TELEMETRÍA EN VIVO (SCADA)          -->
      <!-- ========================================== -->
      <ng-container *ngIf="activeTab === 'telemetry'">
        <!-- 1. Top Row: 5 KPI Cards -->
        <section class="kpi-grid">
          <app-stat-card
            *ngFor="let card of kpiCards"
            [title]="card.title"
            [value]="card.value"
            [trend]="card.trend"
            [isPositive]="card.isPositive"
          >
          </app-stat-card>
        </section>

        <!-- 2. Second Row: Order Summary, Overview, Top Items -->
        <section class="mid-grid">
          <div class="dashboard-card glass-panel summary-panel">
            <div class="card-head">
              <div class="head-titles">
                <h3>Resumen Operativo</h3>
                <p class="subtitle">Disponibilidad del circuito de bombeo</p>
              </div>
              <div class="filter-dropdown">
                <span>Hoy</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            <div class="gauges-row">
              <app-circular-gauge
                *ngFor="let gauge of operationGauges"
                [percentage]="gauge.percentage"
                [label]="gauge.label"
                [color]="gauge.color"
              >
              </app-circular-gauge>
            </div>
          </div>

          <div class="dashboard-card glass-panel overview-panel">
            <div class="card-head">
              <div class="head-titles">
                <h3>Visión General</h3>
                <p class="subtitle">Aporte volumétrico por guardia</p>
              </div>
              <span class="view-all-link">Ver Todo</span>
            </div>

            <app-distribution-donut
              [heroPercentage]="shiftDistribution.heroPercentage"
              [slices]="shiftDistribution.slices"
            >
            </app-distribution-donut>
          </div>

          <div class="dashboard-card glass-panel top-items-panel">
            <div class="card-head">
              <div class="head-titles">
                <h3>Equipos Críticos</h3>
                <p class="subtitle">Telemetría de mayor impacto</p>
              </div>
              <span class="view-all-link">Ver Todo</span>
            </div>

            <div class="items-list">
              <div *ngFor="let item of topEquipment" class="item-row">
                <img [src]="item.imageUrl" [alt]="item.name" class="item-thumb" />
                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-system">{{ item.system }}</span>
                </div>
                <span class="item-metric">{{ item.metric }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Third Row: Weekly Comparison & Annual Production Curve -->
        <section class="bottom-grid">
          <div class="dashboard-card glass-panel chart-panel">
            <app-weekly-bar-chart
              [title]="'Monitoreo Semanal de Caudales'"
              [subtitle]="'Comparativa día a día (m³/h)'"
              [data]="weeklyComparisonData"
            >
            </app-weekly-bar-chart>
          </div>

          <div class="dashboard-card glass-panel chart-panel">
            <app-wave-area-chart
              [title]="'Tonelaje Procesado y Rendimiento Anual'"
              [points]="productionCurveData"
            >
            </app-wave-area-chart>
          </div>
        </section>
      </ng-container>

      <!-- ======================================================== -->
      <!-- TAB 2: PLANILLA MAESTRA DE PRESA & RELAVES (EXCEL / CSV) -->
      <!-- ======================================================== -->
      <ng-container *ngIf="activeTab === 'mastersheet'">
        <!-- Date Navigator & Logbook Status Banner -->
        <div class="mastersheet-toolbar glass-panel">
          <div class="toolbar-date-navigator">
            <button
              class="nav-date-btn"
              [disabled]="!masterService.hasPrevDate()"
              (click)="masterService.goToPrevDate()"
              title="Día anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Anterior</span>
            </button>

            <div class="date-selector-wrapper">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="calendar-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <select
                class="date-select"
                [ngModel]="masterService.selectedDate()"
                (ngModelChange)="masterService.selectDate($event)"
              >
                <option *ngFor="let d of masterService.availableDates()" [value]="d">
                  📅 Operación: {{ d }}
                </option>
              </select>
            </div>

            <button
              class="nav-date-btn"
              [disabled]="!masterService.hasNextDate()"
              (click)="masterService.goToNextDate()"
              title="Día posterior"
            >
              <span>Siguiente</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div class="toolbar-stats">
            <span class="stat-pill">
              <span class="live-dot"></span>
              <strong>{{ masterService.entries().length }}</strong> días registrados
            </span>
            <span class="stat-pill info">
              Guardias A y B (24h de operación continua)
            </span>
            <button class="btn-restore-link" (click)="masterService.resetToDemo()" title="Restaurar a datos de ejemplo de la mina">
              Restaurar Ejemplo
            </button>
          </div>
        </div>

        <div *ngIf="masterService.activeEntry() as current">
          <!-- HERO: GISTM Borde Libre & Seguridad Operativa -->
          <section class="hero-semaphore-card glass-panel" [style.borderColor]="masterService.freeboardEval().borderColor">
            <div class="hero-semaphore-left">
              <div class="status-badge" [style.backgroundColor]="masterService.freeboardEval().bgColor" [style.color]="masterService.freeboardEval().color">
                <span class="beacon-circle" [style.backgroundColor]="masterService.freeboardEval().color"></span>
                <span>{{ masterService.freeboardEval().badgeLabel }}</span>
              </div>
              <h2 class="hero-metric-title">
                Borde Libre Operacional:
                <span class="highlight-val" [style.color]="masterService.freeboardEval().color">
                  {{ current.bordeLibreM.toFixed(2) }} m
                </span>
              </h2>
              <p class="hero-metric-desc">
                {{ masterService.freeboardEval().message }}
              </p>
            </div>

            <div class="hero-semaphore-right">
              <div class="cota-level-breakdown">
                <div class="cota-item">
                  <span class="cota-label">Cota Corona Dique</span>
                  <span class="cota-val">{{ current.cotaCoronaMsnm.toFixed(2) }} msnm</span>
                </div>
                <div class="cota-divider">-</div>
                <div class="cota-item">
                  <span class="cota-label">Cota Embalse Agua/Relave</span>
                  <span class="cota-val">{{ current.cotaEmbalseMsnm.toFixed(2) }} msnm</span>
                </div>
                <div class="cota-divider">=</div>
                <div class="cota-item active">
                  <span class="cota-label">Revancha Real</span>
                  <span class="cota-val highlight">{{ current.bordeLibreM.toFixed(2) }} m</span>
                </div>
              </div>
            </div>
          </section>

          <!-- TOP MASTER KPIS (6 Cards) -->
          <section class="master-kpis-grid">
            <div class="master-kpi-card glass-panel">
              <div class="kpi-icon-wrap blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div class="kpi-info">
                <span class="kpi-label">Relave Enviado a Presa</span>
                <span class="kpi-value">{{ current.relaveTotalVolDiaM3.toLocaleString() }} m³</span>
                <span class="kpi-sub">Turno A: {{ current.relaveVolAM3.toLocaleString() }} | B: {{ current.relaveVolBM3.toLocaleString() }} m³</span>
              </div>
            </div>

            <div class="master-kpi-card glass-panel">
              <div class="kpi-icon-wrap cyan">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
              </div>
              <div class="kpi-info">
                <span class="kpi-label">Agua Recuperada (Torre 5)</span>
                <span class="kpi-value">{{ current.torre5VolDiaM3.toLocaleString() }} m³</span>
                <span class="kpi-sub">Bombeo 24h continuo a Planta Concentradora</span>
              </div>
            </div>

            <div class="master-kpi-card glass-panel">
              <div class="kpi-icon-wrap purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="4"></circle>
                  <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line>
                  <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line>
                </svg>
              </div>
              <div class="kpi-info">
                <span class="kpi-label">2da Estación Ciclones</span>
                <span class="kpi-value">{{ current.ciclones2daSolidosPromPct }}% <small>Sólidos</small></span>
                <span class="kpi-sub">{{ current.ciclones2daMalla200PromPct }}% Malla -200 | {{ current.ciclonesPresionPsi }} PSI</span>
              </div>
            </div>

            <div class="master-kpi-card glass-panel">
              <div class="kpi-icon-wrap amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <div class="kpi-info">
                <span class="kpi-label">Arenas Compactadas</span>
                <span class="kpi-value">{{ current.arenasProdTopografiaM3.toLocaleString() }} m³</span>
                <span class="kpi-sub">Densidad Proctor: {{ current.compactacionPct }}%</span>
              </div>
            </div>

            <div class="master-kpi-card glass-panel">
              <div class="kpi-icon-wrap emerald">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </div>
              <div class="kpi-info">
                <span class="kpi-label">Filtraciones Totales</span>
                <span class="kpi-value">{{ current.filtracionesTotalLs }} L/s</span>
                <span class="kpi-sub">{{ current.filtracionesTotalM3Dia }} m³/día (Drenes + Subdrenaje)</span>
              </div>
            </div>

            <div class="master-kpi-card glass-panel">
              <div class="kpi-icon-wrap indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 12h8"></path>
                  <path d="M12 8v8"></path>
                </svg>
              </div>
              <div class="kpi-info">
                <span class="kpi-label">Control de pH Embalse</span>
                <span class="kpi-value">{{ current.phEmbalseA }} pH</span>
                <span class="kpi-sub">Vertedero: {{ current.phVertederoA }} pH | Sentina: {{ current.phSentina }} pH</span>
              </div>
            </div>
          </section>

          <!-- OPERATIONAL DETAIL CARDS (2-Column Grid) -->
          <section class="master-details-grid">
            <!-- 1. Topografía & Geometría del Dique -->
            <div class="detail-card glass-panel">
              <div class="card-header-clean">
                <div class="header-icon-box">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <div>
                  <h4>1. Topografía, Dique & Borde Libre</h4>
                  <p class="card-caption">Control de cotas, crecimiento y revancha según GISTM</p>
                </div>
              </div>

              <div class="metrics-table-wrapper">
                <table class="detail-table">
                  <tbody>
                    <tr>
                      <td class="col-title">Cota Corona Dique</td>
                      <td class="col-val"><strong>{{ current.cotaCoronaMsnm.toFixed(2) }}</strong> msnm</td>
                      <td class="col-note">Nivel estructural del coronamiento</td>
                    </tr>
                    <tr>
                      <td class="col-title">Cota Embalse / Agua</td>
                      <td class="col-val"><strong>{{ current.cotaEmbalseMsnm.toFixed(2) }}</strong> msnm</td>
                      <td class="col-note">Superficie espejo de agua</td>
                    </tr>
                    <tr>
                      <td class="col-title">Borde Libre (Freeboard)</td>
                      <td class="col-val highlight-green"><strong>{{ current.bordeLibreM.toFixed(2) }}</strong> m</td>
                      <td class="col-note">Mínimo regulatorio: 2.00 m</td>
                    </tr>
                    <tr>
                      <td class="col-title">Crecimiento Diario Presa</td>
                      <td class="col-val"><strong>{{ current.crecimientoPresaM.toFixed(2) }}</strong> m</td>
                      <td class="col-note">Avance vertical de peralte</td>
                    </tr>
                    <tr>
                      <td class="col-title">Altura Libre Operacional</td>
                      <td class="col-val"><strong>{{ current.alturaLibreOperacionalM.toFixed(2) }}</strong> m</td>
                      <td class="col-note">Margen neto de seguridad</td>
                    </tr>
                    <tr>
                      <td class="col-title">Volumen Agua Real Acumulado</td>
                      <td class="col-val"><strong>{{ current.volAguaRealAcumuladoM3.toLocaleString() }}</strong> m³</td>
                      <td class="col-note">Almacenamiento total en vaso</td>
                    </tr>
                    <tr>
                      <td class="col-title">Longitud de Playa de Relaves</td>
                      <td class="col-val"><strong>{{ current.longitudPlayaM }}</strong> m</td>
                      <td class="col-note">Distancia corona a espejo libre</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 2. Circuito Hídrico: Torre 5, Sentina, EI, Vertedero -->
            <div class="detail-card glass-panel">
              <div class="card-header-clean">
                <div class="header-icon-box cyan">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div>
                  <h4>2. Circuito Hídrico & Bombeo</h4>
                  <p class="card-caption">Recuperación de agua de procesos y subdrenaje</p>
                </div>
              </div>

              <div class="metrics-table-wrapper">
                <table class="detail-table">
                  <tbody>
                    <tr>
                      <td class="col-title">Torre 5 (Agua Recuperada)</td>
                      <td class="col-val highlight-blue"><strong>{{ current.torre5VolDiaM3.toLocaleString() }}</strong> m³</td>
                      <td class="col-note">A: {{ current.torre5VolAM3.toLocaleString() }} | B: {{ current.torre5VolBM3.toLocaleString() }} m³</td>
                    </tr>
                    <tr>
                      <td class="col-title">Agua Acumulada Torre 5</td>
                      <td class="col-val"><strong>{{ (current.torre5VolAcumuladoM3 / 1000000).toFixed(2) }}</strong> M m³</td>
                      <td class="col-note">Acumulado anual recirculado</td>
                    </tr>
                    <tr>
                      <td class="col-title">Sentina Drenes (PO-001)</td>
                      <td class="col-val"><strong>{{ current.sentinaBombeadoTotalM3 }}</strong> m³/día</td>
                      <td class="col-note">Nivel PO-001: {{ current.sentinaPo001NivelAPct }}% (A) / {{ current.sentinaPo001NivelBPct }}% (B)</td>
                    </tr>
                    <tr>
                      <td class="col-title">Estación Intermedia (EI)</td>
                      <td class="col-val"><strong>{{ current.eiTotalM3 }}</strong> m³/día</td>
                      <td class="col-note">Caudal medio: {{ current.eiCaudalPromLs }} L/s</td>
                    </tr>
                    <tr>
                      <td class="col-title">Flujo Vertedero (Aforo)</td>
                      <td class="col-val"><strong>{{ current.vertederoPromLs }}</strong> L/s</td>
                      <td class="col-note">{{ current.vertederoTotalDiaM3 }} m³/día total</td>
                    </tr>
                    <tr>
                      <td class="col-title">Agua Fresca a Planta</td>
                      <td class="col-val"><strong>{{ current.aguaFrescaTotalDiaM3.toLocaleString() }}</strong> m³</td>
                      <td class="col-note">Ratio: {{ current.ratioAguaTon }} m³/t tratada</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 3. Clasificación Metalúrgica: Baterías de Ciclones -->
            <div class="detail-card glass-panel">
              <div class="card-header-clean">
                <div class="header-icon-box purple">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="12 8 8 12 12 16 16 12 12 8"></polygon>
                  </svg>
                </div>
                <div>
                  <h4>3. Ciclones & Granulometría (1ra y 2da Estación)</h4>
                  <p class="card-caption">Control de arenas de dique y separación hidrociclónica</p>
                </div>
              </div>

              <div class="metrics-table-wrapper">
                <table class="detail-table">
                  <tbody>
                    <tr>
                      <td class="col-title">2da Estación: % Sólidos Promedio</td>
                      <td class="col-val highlight-purple"><strong>{{ current.ciclones2daSolidosPromPct }}%</strong></td>
                      <td class="col-note">Turno A: {{ current.ciclones2daSolidosAPct }}% | B: {{ current.ciclones2daSolidosBPct }}%</td>
                    </tr>
                    <tr>
                      <td class="col-title">2da Estación: % Malla -200 Promedio</td>
                      <td class="col-val highlight-purple"><strong>{{ current.ciclones2daMalla200PromPct }}%</strong></td>
                      <td class="col-note">Objetivo dique: &le; 10% pasante</td>
                    </tr>
                    <tr>
                      <td class="col-title">1ra Estación: % Sólidos Promedio</td>
                      <td class="col-val"><strong>{{ current.ciclones1raSolidosPromPct }}%</strong></td>
                      <td class="col-note">Turno A: {{ current.ciclones1raSolidosAPct }}% | B: {{ current.ciclones1raSolidosBPct }}%</td>
                    </tr>
                    <tr>
                      <td class="col-title">1ra Estación: % Malla -200 Promedio</td>
                      <td class="col-val"><strong>{{ current.ciclones1raMalla200PromPct }}%</strong></td>
                      <td class="col-note">Turno A: {{ current.ciclones1raMalla200APct }}% | B: {{ current.ciclones1raMalla200BPct }}%</td>
                    </tr>
                    <tr>
                      <td class="col-title">Presión de Operación Baterías</td>
                      <td class="col-val"><strong>{{ current.ciclonesPresionPsi }}</strong> PSI</td>
                      <td class="col-note">Presión manométrica de alimentación</td>
                    </tr>
                    <tr>
                      <td class="col-title">Densidad de Pulpa de Arenas</td>
                      <td class="col-val"><strong>{{ current.densidadPulpaProm }}</strong> t/m³</td>
                      <td class="col-note">A: {{ current.densidadPulpaA }} | B: {{ current.densidadPulpaB }} t/m³</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 4. Disposición de Arenas, Talud & Líneas de Embalse -->
            <div class="detail-card glass-panel">
              <div class="card-header-clean">
                <div class="header-icon-box amber">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <circle cx="11.5" cy="14.5" r="2.5"></circle>
                  </svg>
                </div>
                <div>
                  <h4>4. Disposición de Arenas & Talud</h4>
                  <p class="card-caption">Líneas de descarga, distribución y compactación</p>
                </div>
              </div>

              <div class="metrics-table-wrapper">
                <table class="detail-table">
                  <tbody>
                    <tr>
                      <td class="col-title">Descarga en Talud (Horas)</td>
                      <td class="col-val"><strong>{{ current.descargaTaludHorasA + current.descargaTaludHorasB }}</strong> h/día</td>
                      <td class="col-note">Turno A: {{ current.descargaTaludHorasA }}h | Turno B: {{ current.descargaTaludHorasB }}h</td>
                    </tr>
                    <tr>
                      <td class="col-title">Descarga Corona Dique</td>
                      <td class="col-val"><strong>{{ current.descargaCoronaM3.toLocaleString() }}</strong> m³</td>
                      <td class="col-note">Relleno de coronamiento</td>
                    </tr>
                    <tr>
                      <td class="col-title">Dren Basal</td>
                      <td class="col-val"><strong>{{ current.drenBasalM3.toLocaleString() }}</strong> m³</td>
                      <td class="col-note">Disposición en base de presa</td>
                    </tr>
                    <tr>
                      <td class="col-title">Líneas Activas en Embalse</td>
                      <td class="col-val highlight-dark"><strong>{{ current.lineasActivas }}</strong></td>
                      <td class="col-note">{{ current.spigotsActivosTotal }} Spigots abiertos</td>
                    </tr>
                    <tr>
                      <td class="col-title">Zona de Operación</td>
                      <td class="col-val"><strong>{{ current.zonaOperativa }}</strong></td>
                      <td class="col-note">Cola 16": {{ current.cola16PulgActiva ? 'Activa' : 'Inactiva' }}</td>
                    </tr>
                    <tr>
                      <td class="col-title">Factor Corrección Flujo vs Topografía</td>
                      <td class="col-val"><strong>{{ current.factorCorreccion }}</strong></td>
                      <td class="col-note">Flujo: {{ current.arenasProdFlujometroM3 }} m³ | Topo: {{ current.arenasProdTopografiaM3 }} m³</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- HISTORICAL TREND CHART (Interactive SVG) -->
          <section class="trend-chart-section glass-panel">
            <div class="chart-header">
              <div class="head-titles">
                <h3>Tendencia Operativa: Borde Libre & Volumen de Relaves</h3>
                <p class="subtitle">Evolución día a día de revancha (m) y volumen diario (m³)</p>
              </div>
              <div class="chart-legend">
                <span class="legend-item"><span class="legend-color-box green"></span> Borde Libre (m)</span>
                <span class="legend-item"><span class="legend-color-box blue"></span> Relave Enviado (m³)</span>
              </div>
            </div>

            <div class="svg-chart-container" *ngIf="trendPoints.length > 0">
              <svg viewBox="0 0 800 240" class="historical-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="freeboardGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"></stop>
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"></stop>
                  </linearGradient>
                </defs>

                <!-- Grid horizontal lines -->
                <line x1="40" y1="30" x2="780" y2="30" stroke="#f1f5f9" stroke-width="1"></line>
                <line x1="40" y1="80" x2="780" y2="80" stroke="#f1f5f9" stroke-width="1"></line>
                <line x1="40" y1="130" x2="780" y2="130" stroke="#f1f5f9" stroke-width="1"></line>
                <line x1="40" y1="180" x2="780" y2="180" stroke="#e2e8f0" stroke-width="1.5"></line>

                <!-- Critical safety limit line (2.0 m) -->
                <line x1="40" y1="150" x2="780" y2="150" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 4"></line>
                <text x="730" y="145" fill="#dc2626" font-size="10" font-weight="600">Límite Crítico 2m</text>

                <!-- Freeboard Area & Line -->
                <polygon [attr.points]="trendFreeboardAreaPath" fill="url(#freeboardGrad)"></polygon>
                <polyline [attr.points]="trendFreeboardLinePath" fill="none" stroke="#10b981" stroke-width="3"></polyline>

                <!-- Freeboard Dots -->
                <g *ngFor="let pt of trendPoints">
                  <circle
                    [attr.cx]="pt.x"
                    [attr.cy]="pt.y"
                    r="5"
                    fill="#ffffff"
                    stroke="#10b981"
                    stroke-width="2.5"
                    class="chart-circle"
                    (click)="masterService.selectDate(pt.fecha)"
                  >
                    <title>{{ pt.fecha }}: {{ pt.bordeLibre }} m</title>
                  </circle>
                  <text [attr.x]="pt.x" y="202" fill="#64748b" font-size="10" text-anchor="middle">
                    {{ pt.fecha.slice(0, 5) }}
                  </text>
                  <text [attr.x]="pt.x" [attr.y]="pt.y - 10" fill="#0f172a" font-size="10" font-weight="700" text-anchor="middle">
                    {{ pt.bordeLibre.toFixed(1) }}m
                  </text>
                </g>
              </svg>
            </div>
          </section>

          <!-- COMPREHENSIVE RECORD EXPLORER TABLE -->
          <section class="master-table-section glass-panel">
            <div class="table-top-bar">
              <div class="head-titles">
                <h3>Bitácora Maestra de Registros Diarios</h3>
                <p class="subtitle">Haga clic en cualquier fila para cargar y analizar ese día operativo</p>
              </div>
              <div class="table-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Buscar fecha..."
                  [(ngModel)]="searchFilter"
                  class="search-input"
                />
              </div>
            </div>

            <div class="table-responsive">
              <table class="master-log-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Borde Libre</th>
                    <th>Cota Embalse</th>
                    <th>Relave Día (m³)</th>
                    <th>Torre 5 (m³)</th>
                    <th>Ciclones 2da (% Sólidos)</th>
                    <th>Filtraciones (L/s)</th>
                    <th>Arenas Comp. (m³)</th>
                    <th>Estado GISTM</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    *ngFor="let item of filteredEntries"
                    [class.selected-row]="item.fecha === masterService.selectedDate()"
                    (click)="masterService.selectDate(item.fecha)"
                  >
                    <td class="col-date">
                      <span class="date-badge">{{ item.fecha }}</span>
                    </td>
                    <td class="col-highlight" [class.danger]="item.bordeLibreM < 2.0" [class.warning]="item.bordeLibreM >= 2.0 && item.bordeLibreM < 4.0">
                      <strong>{{ item.bordeLibreM.toFixed(2) }} m</strong>
                    </td>
                    <td>{{ item.cotaEmbalseMsnm.toFixed(2) }} msnm</td>
                    <td>{{ item.relaveTotalVolDiaM3.toLocaleString() }}</td>
                    <td>{{ item.torre5VolDiaM3.toLocaleString() }}</td>
                    <td>{{ item.ciclones2daSolidosPromPct }}% ({{ item.ciclones2daMalla200PromPct }}% -200)</td>
                    <td>{{ item.filtracionesTotalLs }} L/s</td>
                    <td>{{ item.arenasProdTopografiaM3.toLocaleString() }}</td>
                    <td>
                      <span
                        class="status-tag-pill"
                        [class.normal]="item.bordeLibreM >= 4.0"
                        [class.warning]="item.bordeLibreM >= 2.0 && item.bordeLibreM < 4.0"
                        [class.critical]="item.bordeLibreM < 2.0"
                      >
                        {{ item.bordeLibreM >= 4.0 ? 'Normal' : item.bordeLibreM >= 2.0 ? 'Alerta' : 'Crítico' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </ng-container>

      <!-- ======================================================== -->
      <!-- UPLOAD MODAL FOR OFFICE EXCEL (.XLSX) AND CSV FILES      -->
      <!-- ======================================================== -->
      <div class="modal-backdrop" *ngIf="showUploadModal" (click)="closeUploadModal()">
        <div class="modal-card glass-panel" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="modal-title-group">
              <div class="modal-icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div>
                <h3>Cargar Planilla Excel o CSV</h3>
                <p class="subtitle">Soporta archivos directos de Microsoft Office (.xlsx, .xls) y CSV</p>
              </div>
            </div>
            <button class="btn-close" (click)="closeUploadModal()">✕</button>
          </div>

          <div class="modal-body">
            <!-- Drag & Drop Zone -->
            <div
              class="drop-zone"
              [class.drag-over]="isDragging"
              (dragover)="onDragOver($event)"
              (dragleave)="isDragging = false"
              (drop)="onFileDrop($event)"
              (click)="fileInput.click()"
            >
              <input
                #fileInput
                type="file"
                accept=".xlsx,.xls,.csv"
                (change)="onFileSelected($event)"
                style="display: none"
              />
              <div class="drop-illustration">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#031795" stroke-width="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M12 18v-6"></path>
                  <path d="M9 15l3-3 3 3"></path>
                </svg>
              </div>
              <p class="drop-main-text">
                <strong *ngIf="!selectedFile">Arrastra tu archivo aquí o haz clic para explorar</strong>
                <strong *ngIf="selectedFile">{{ selectedFile.name }}</strong>
              </p>
              <p class="drop-sub-text">
                Formatos permitidos: .xlsx, .xls, .csv (tamaño ilimitado, procesamiento 100% en cliente sin fugas de datos)
              </p>
              <div *ngIf="selectedFile" class="file-badge">
                <span>{{ (selectedFile.size / 1024).toFixed(1) }} KB</span>
              </div>
            </div>

            <!-- Detected Sheet Selector (if workbook has multiple sheets) -->
            <div *ngIf="availableSheets.length > 0" class="sheet-selector-wrapper">
              <label class="sheet-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>Hoja de cálculo detectada:</span>
              </label>
              <select [(ngModel)]="selectedSheetName" class="sheet-select-dropdown">
                <option *ngFor="let s of availableSheets" [value]="s.name">
                  📄 {{ s.name }} ({{ s.rowCount }} filas {{ s.hasDates ? '• con fechas' : '' }}) {{ s.isRecommended ? '⭐ Recomendada' : '' }}
                </option>
              </select>
            </div>

            <!-- Ingestion Mode Selector -->
            <div class="ingest-options">
              <label class="radio-label">
                <input type="radio" name="ingestMode" [(ngModel)]="uploadMode" value="merge" />
                <div>
                  <strong>Combinar & Actualizar</strong>
                  <p>Mantiene registros históricos existentes e inserta o actualiza las fechas del nuevo archivo.</p>
                </div>
              </label>
              <label class="radio-label">
                <input type="radio" name="ingestMode" [(ngModel)]="uploadMode" value="replace" />
                <div>
                  <strong>Reemplazar Todo</strong>
                  <p>Sustituye completamente la planilla actual por los datos del archivo subido.</p>
                </div>
              </label>
            </div>

            <!-- Parsing / Feedback Messages -->
            <div *ngIf="uploadStatusMessage" class="feedback-box" [class.success]="isUploadSuccess" [class.error]="!isUploadSuccess">
              <p>{{ uploadStatusMessage }}</p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-action outline" (click)="closeUploadModal()">
              Cancelar
            </button>
            <button
              class="btn-action primary"
              [disabled]="!selectedFile || isProcessingUpload"
              (click)="processUpload()"
            >
              <span *ngIf="!isProcessingUpload">Procesar e Importar Datos</span>
              <span *ngIf="isProcessingUpload">Procesando planilla...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 20px;

      @media (max-width: 768px) {
        gap: 14px;
      }
    }

    /* Header Bar & Tabs */
    .dashboard-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 4px;
    }

    .view-switch-tabs {
      display: inline-flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      gap: 4px;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 0.86rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;

      svg {
        stroke: currentColor;
      }

      &:hover {
        color: #0f172a;
      }

      &.active {
        background: #ffffff;
        color: #031795;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .badge-office {
      font-size: 0.68rem;
      padding: 2px 6px;
      background: #e0e7ff;
      color: #031795;
      border-radius: 6px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    .action-buttons-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;

      &.primary {
        background: #031795;
        color: #ffffff;
        box-shadow: 0 2px 4px rgba(3, 23, 149, 0.2);

        &:hover {
          background: #021278;
        }

        &:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }
      }

      &.outline {
        background: #ffffff;
        color: #334155;
        border-color: #cbd5e1;

        &:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
      }
    }

    /* KPI Grid (SCADA) */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 18px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;

        app-stat-card:last-child {
          grid-column: span 2;
        }
      }
      @media (max-width: 480px) {
        grid-template-columns: 1fr;
        app-stat-card:last-child {
          grid-column: span 1;
        }
      }
    }

    .mid-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1.1fr;
      gap: 20px;

      @media (max-width: 1280px) {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    .dashboard-card {
      padding: 24px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;

      @media (max-width: 768px) {
        padding: 16px 14px;
      }
    }

    .card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .head-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;

      h3 {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
      }

      .subtitle {
        font-size: 0.75rem;
        color: #64748b;
      }
    }

    .filter-dropdown {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.78rem;
      color: #475569;
      cursor: pointer;
    }

    .view-all-link {
      font-size: 0.75rem;
      color: #031795;
      cursor: pointer;
      font-weight: 600;
    }

    .gauges-row {
      display: flex;
      align-items: center;
      justify-content: space-around;
      gap: 16px;
      padding: 10px 0;
    }

    .items-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .item-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 10px;
      border-radius: 8px;

      &:hover {
        background: #f8fafc;
      }
    }

    .item-thumb {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #e2e8f0;
    }

    .item-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #0f172a;
    }

    .item-system {
      font-size: 0.72rem;
      color: #64748b;
    }

    .item-metric {
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
    }

    /* ========================================= */
    /* MASTER SHEET STYLES                       */
    /* ========================================= */
    .mastersheet-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
      padding: 14px 20px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .toolbar-date-navigator {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .nav-date-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        background: #e2e8f0;
        color: #0f172a;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .date-selector-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f1f5f9;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
    }

    .calendar-icon {
      color: #031795;
    }

    .date-select {
      border: none;
      background: transparent;
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
      outline: none;
      cursor: pointer;
    }

    .toolbar-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #475569;
      background: #f8fafc;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;

      &.info {
        background: #eff6ff;
        color: #1e40af;
        border-color: #bfdbfe;
      }
    }

    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
    }

    .btn-restore-link {
      background: none;
      border: none;
      font-size: 0.75rem;
      color: #64748b;
      cursor: pointer;
      text-decoration: underline;

      &:hover {
        color: #0f172a;
      }
    }

    /* Hero Semaphore */
    .hero-semaphore-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      padding: 22px 26px;
      border-radius: 14px;
      background: #ffffff;
      border-left: 6px solid;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      margin-top: 14px;
    }

    .hero-semaphore-left {
      max-width: 600px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      width: fit-content;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .beacon-circle {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .hero-metric-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
    }

    .highlight-val {
      font-size: 1.6rem;
    }

    .hero-metric-desc {
      font-size: 0.85rem;
      color: #475569;
      line-height: 1.4;
    }

    .hero-semaphore-right {
      display: flex;
      align-items: center;
    }

    .cota-level-breakdown {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      padding: 12px 18px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;

      @media (max-width: 600px) {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    .cota-item {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.active {
        background: #ffffff;
        padding: 4px 10px;
        border-radius: 6px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
    }

    .cota-label {
      font-size: 0.68rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }

    .cota-val {
      font-size: 0.92rem;
      font-weight: 700;
      color: #0f172a;

      &.highlight {
        color: #031795;
      }
    }

    .cota-divider {
      font-weight: 700;
      color: #94a3b8;
    }

    /* Master KPIs Grid */
    .master-kpis-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 14px;
      margin-top: 14px;

      @media (max-width: 1400px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .master-kpi-card {
      padding: 16px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .kpi-icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.blue { background: #eff6ff; color: #2563eb; }
      &.cyan { background: #ecfeff; color: #0891b2; }
      &.purple { background: #f5f3ff; color: #7c3aed; }
      &.amber { background: #fffbeb; color: #d97706; }
      &.emerald { background: #ecfdf5; color: #059669; }
      &.indigo { background: #eef2ff; color: #4f46e5; }
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .kpi-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .kpi-value {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;

      small {
        font-size: 0.78rem;
        font-weight: 600;
        color: #64748b;
      }
    }

    .kpi-sub {
      font-size: 0.7rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Master Details Grid */
    .master-details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 18px;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
      }
    }

    .detail-card {
      padding: 22px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .card-header-clean {
      display: flex;
      align-items: center;
      gap: 12px;

      h4 {
        font-size: 0.98rem;
        font-weight: 700;
        color: #0f172a;
      }

      .card-caption {
        font-size: 0.74rem;
        color: #64748b;
      }
    }

    .header-icon-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #eff6ff;
      color: #031795;
      display: flex;
      align-items: center;
      justify-content: center;

      &.cyan { background: #ecfeff; color: #0891b2; }
      &.purple { background: #f5f3ff; color: #7c3aed; }
      &.amber { background: #fffbeb; color: #d97706; }
    }

    .metrics-table-wrapper {
      overflow-x: auto;
    }

    .detail-table {
      width: 100%;
      border-collapse: collapse;

      tr {
        border-bottom: 1px solid #f1f5f9;

        &:last-child {
          border-bottom: none;
        }
      }

      td {
        padding: 9px 8px;
        font-size: 0.8rem;
      }

      .col-title {
        color: #475569;
        font-weight: 500;
        width: 44%;
      }

      .col-val {
        color: #0f172a;
        white-space: nowrap;

        &.highlight-green { color: #059669; }
        &.highlight-blue { color: #2563eb; }
        &.highlight-purple { color: #7c3aed; }
        &.highlight-dark { color: #031795; }
      }

      .col-note {
        color: #94a3b8;
        font-size: 0.72rem;
        text-align: right;
      }
    }

    /* Trend Chart Section */
    .trend-chart-section {
      padding: 22px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 0.78rem;
      color: #475569;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .legend-color-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;

      &.green { background: #10b981; }
      &.blue { background: #031795; }
    }

    .svg-chart-container {
      width: 100%;
      height: 220px;
      overflow-x: auto;
    }

    .historical-svg {
      width: 100%;
      height: 100%;
    }

    .chart-circle {
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        r: 7;
        stroke-width: 4;
      }
    }

    /* Master Log Table */
    .master-table-section {
      padding: 22px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      margin-top: 18px;
    }

    .table-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .table-search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;

      svg {
        stroke: #64748b;
      }

      .search-input {
        border: none;
        background: transparent;
        font-size: 0.8rem;
        color: #0f172a;
        outline: none;
      }
    }

    .table-responsive {
      overflow-x: auto;
    }

    .master-log-table {
      width: 100%;
      border-collapse: collapse;

      th {
        text-align: left;
        padding: 10px 12px;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }

      td {
        padding: 12px;
        font-size: 0.8rem;
        color: #334155;
        border-bottom: 1px solid #f1f5f9;
      }

      tbody tr {
        cursor: pointer;
        transition: background 0.15s;

        &:hover {
          background: #f8fafc;
        }

        &.selected-row {
          background: #eff6ff;
          td {
            color: #031795;
          }
        }
      }
    }

    .date-badge {
      font-weight: 700;
      color: #0f172a;
    }

    .status-tag-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;

      &.normal {
        background: #ecfdf5;
        color: #059669;
      }
      &.warning {
        background: #fffbeb;
        color: #d97706;
      }
      &.critical {
        background: #fef2f2;
        color: #dc2626;
      }
    }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-card {
      width: 100%;
      max-width: 580px;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-title-group {
      display: flex;
      align-items: center;
      gap: 12px;

      h3 {
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
      }

      .subtitle {
        font-size: 0.76rem;
        color: #64748b;
      }
    }

    .modal-icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #eff6ff;
      color: #031795;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-close {
      border: none;
      background: transparent;
      font-size: 1.1rem;
      color: #94a3b8;
      cursor: pointer;

      &:hover {
        color: #0f172a;
      }
    }

    .modal-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .drop-zone {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 30px 20px;
      text-align: center;
      cursor: pointer;
      background: #f8fafc;
      transition: all 0.2s;

      &:hover, &.drag-over {
        border-color: #031795;
        background: #f0f4ff;
      }
    }

    .drop-illustration {
      margin-bottom: 10px;
    }

    .drop-main-text {
      font-size: 0.9rem;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .drop-sub-text {
      font-size: 0.75rem;
      color: #64748b;
    }

    .file-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 3px 10px;
      background: #031795;
      color: #ffffff;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .ingest-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .radio-label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      background: #ffffff;

      input {
        margin-top: 3px;
      }

      strong {
        font-size: 0.84rem;
        color: #0f172a;
      }

      p {
        font-size: 0.74rem;
        color: #64748b;
        margin-top: 2px;
      }

      &:hover {
        background: #f8fafc;
      }
    }

    .feedback-box {
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 0.82rem;

      &.success {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }

      &.error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
    }

    .sheet-selector-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
    }

    .sheet-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #1e40af;
    }

    .sheet-select-dropdown {
      padding: 8px 12px;
      background: #ffffff;
      border: 1px solid #93c5fd;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #0f172a;
      outline: none;
      cursor: pointer;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  public masterService = inject(MasterSheetService);

  // Active view tab: 'telemetry' or 'mastersheet'
  activeTab: 'telemetry' | 'mastersheet' = 'mastersheet';

  // Modal & File Upload State
  showUploadModal = false;
  isDragging = false;
  selectedFile: File | null = null;
  availableSheets: SheetSummary[] = [];
  selectedSheetName = '';
  uploadMode: 'merge' | 'replace' = 'merge';
  isProcessingUpload = false;
  uploadStatusMessage = '';
  isUploadSuccess = false;

  // Search filter in table
  searchFilter = '';

  // SCADA / Telemetry state
  kpiCards = [
    { title: 'Caudal Total Slurry', value: '0 m³/h', trend: 'Sincronizado', isPositive: true },
    { title: 'Tonelaje Procesado', value: '0.0 kTon', trend: 'Sin entregas', isPositive: true },
    { title: 'Disponibilidad Planta', value: '100 %', trend: 'Normal', isPositive: true },
    { title: 'Bombas en Servicio', value: '0 / 0', trend: 'Normal', isPositive: true },
    { title: 'Personal en Turno', value: '0 Oper.', trend: 'Sincronizado', isPositive: true }
  ];

  operationGauges = [
    { label: 'En Standby', percentage: 25, color: '#f59e0b' },
    { label: 'Bombeo Activo', percentage: 85, color: '#031795' },
    { label: 'Alertas', percentage: 7, color: '#dc2626' }
  ];

  shiftDistribution = {
    heroPercentage: 25,
    slices: [
      { name: 'Guardia 1 (G1)', percentage: 25, color: '#031795' },
      { name: 'Guardia 2 (G2)', percentage: 25, color: '#1d4ed8' },
      { name: 'Guardia 3 (G3)', percentage: 25, color: '#3b82f6' },
      { name: 'Guardia 4 (G4)', percentage: 25, color: '#93c5fd' }
    ]
  };

  topEquipment = [
    {
      name: 'Bomba Slurry PP-101',
      system: 'Alimentación Ciclones 01',
      metric: '1,850 m³/h',
      imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=120&q=80'
    },
    {
      name: 'Bomba Relaves TL-201',
      system: 'Transporte a Presa Principal',
      metric: '2,150 m³/h',
      imageUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=120&q=80'
    },
    {
      name: 'Batería Cyclopac 01',
      system: 'Clasificación Molienda',
      metric: '18.5 PSI',
      imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=120&q=80'
    }
  ];

  weeklyComparisonData = [
    { day: 'Dom', current: 780, previous: 650 },
    { day: 'Lun', current: 510, previous: 480 },
    { day: 'Mar', current: 740, previous: 520 },
    { day: 'Mié', current: 410, previous: 490 },
    { day: 'Jue', current: 430, previous: 530 },
    { day: 'Vie', current: 670, previous: 620 },
    { day: 'Sáb', current: 820, previous: 690 }
  ];

  productionCurveData = [
    { label: 'ene', value: 18 },
    { label: 'feb', value: 22 },
    { label: 'mar', value: 20 },
    { label: 'abr', value: 26 },
    { label: 'may', value: 34 },
    { label: 'jun', value: 45 },
    { label: 'jul', value: 30 },
    { label: 'ago', value: 35 },
    { label: 'sep', value: 39 },
    { label: 'oct', value: 42 },
    { label: 'nov', value: 50 },
    { label: 'dic', value: 58 }
  ];

  private syncListener = (e: any) => {
    if (e?.detail?.source === 'local') return;
    this.ngZone.run(() => {
      this.fetchMetrics();
    });
  };

  ngOnInit(): void {
    this.fetchMetrics();
    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  fetchMetrics(): void {
    this.http.get<any>(`${getApiBaseUrl()}/dashboard/metrics`).pipe(
      timeout(3500),
      catchError(() => of(null))
    ).subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const d = res.data;
          if (d.kpiCards) this.kpiCards = d.kpiCards;
          if (d.operationSummary?.gauges) this.operationGauges = d.operationSummary.gauges;
          if (d.shiftDistribution) this.shiftDistribution = d.shiftDistribution;
          if (d.topCriticalEquipment) this.topEquipment = d.topCriticalEquipment;
          if (d.weeklyComparison?.days) this.weeklyComparisonData = d.weeklyComparison.days;
          if (d.productionCurve?.points) this.productionCurveData = d.productionCurve.points;
          this.cdr.markForCheck();
        }
      }
    });
  }

  // --- Filtered Master Sheet Table ---
  get filteredEntries(): MasterSheetEntry[] {
    const list = this.masterService.entries();
    if (!this.searchFilter.trim()) return list;
    const q = this.searchFilter.toLowerCase().trim();
    return list.filter(e => e.fecha.toLowerCase().includes(q));
  }

  // --- SVG Chart Computed Coordinates ---
  get trendPoints(): { x: number; y: number; fecha: string; bordeLibre: number }[] {
    const raw = this.masterService.entries().slice(0, 10).reverse();
    if (raw.length === 0) return [];

    const minX = 70;
    const maxX = 740;
    const minY = 35;
    const maxY = 175;

    // Freeboard ranges from 0m to 6m
    const minVal = 1.0;
    const maxVal = 6.0;

    const step = raw.length > 1 ? (maxX - minX) / (raw.length - 1) : 0;

    return raw.map((item, idx) => {
      const x = raw.length === 1 ? (minX + maxX) / 2 : minX + idx * step;
      const normalized = (item.bordeLibreM - minVal) / (maxVal - minVal);
      // Invert Y for SVG coordinates
      const y = maxY - normalized * (maxY - minY);
      return {
        x: Math.round(x),
        y: Math.round(y),
        fecha: item.fecha,
        bordeLibre: item.bordeLibreM
      };
    });
  }

  get trendFreeboardLinePath(): string {
    return this.trendPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  get trendFreeboardAreaPath(): string {
    const pts = this.trendPoints;
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${first.x},180 ` + pts.map(p => `${p.x},${p.y}`).join(' ') + ` ${last.x},180`;
  }

  // --- Upload Modal Handlers ---
  openUploadModal(): void {
    this.selectedFile = null;
    this.availableSheets = [];
    this.selectedSheetName = '';
    this.uploadStatusMessage = '';
    this.isUploadSuccess = false;
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.selectedFile = null;
    this.availableSheets = [];
    this.selectedSheetName = '';
    this.uploadStatusMessage = '';
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  async onFileDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      await this.handleFileSelection(e.dataTransfer.files[0]);
    }
  }

  async onFileSelected(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.handleFileSelection(input.files[0]);
    }
  }

  async handleFileSelection(file: File): Promise<void> {
    this.selectedFile = file;
    this.uploadStatusMessage = '';
    this.availableSheets = [];
    this.selectedSheetName = '';

    const sheets = await this.masterService.inspectFile(file);
    this.availableSheets = sheets;
    if (sheets.length > 0) {
      const rec = sheets.find(s => s.isRecommended) || sheets.find(s => s.rowCount > 0) || sheets[0];
      this.selectedSheetName = rec ? rec.name : '';
    }
    this.cdr.detectChanges();
  }

  async processUpload(): Promise<void> {
    if (!this.selectedFile) return;

    this.isProcessingUpload = true;
    this.uploadStatusMessage = 'Leyendo y procesando columnas de la planilla...';

    const result = await this.masterService.parseUploadedFile(this.selectedFile, this.uploadMode, this.selectedSheetName);
    this.isProcessingUpload = false;

    if (result.success) {
      this.isUploadSuccess = true;
      this.uploadStatusMessage = result.message;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.closeUploadModal();
      }, 1400);
    } else {
      this.isUploadSuccess = false;
      this.uploadStatusMessage = result.message;
      this.cdr.detectChanges();
    }
  }
}
