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

export interface TrendMetricConfig {
  id: string;
  label: string;
  primaryLabel: string;
  color: string;
  unit: string;
  decimals: number;
  secondaryLabel?: string;
  secondaryColor?: string;
  secondaryUnit?: string;
  secondaryDecimals?: number;
  thresholdLabel?: string;
  thresholdVal?: number;
  getValue: (entry: MasterSheetEntry) => number;
  getSecondaryValue?: (entry: MasterSheetEntry) => number;
}

export interface TrendDataPoint {
  x: number;
  y: number;
  fecha: string;
  val: number;
  formattedVal: string;
  displayVal: string;
}

export interface TrendStatsSummary {
  formattedLast: string;
  lastDate: string;
  deltaPct: number;
  formattedAvg: string;
  formattedMax: string;
  maxDate: string;
  formattedMin: string;
  minDate: string;
}

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

          <!-- INTERACTIVE DAM CROSS-SECTION & RESERVOIR PROFILE -->
          <section class="dam-cross-section glass-panel">
            <div class="dam-section-header">
              <div class="head-titles">
                <div class="dam-title-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#031795" stroke-width="2.2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                  <h3>Perfil Transversal de Seguridad del Dique de Relaves</h3>
                </div>
                <p class="subtitle">Modelo 2D interactivo: Cotas de corona, espejo de agua dinámico, revancha y playa de relaves</p>
              </div>

              <!-- View Mode Toggles & Status Pill -->
              <div class="dam-header-actions">
                <div class="dam-mode-pills">
                  <button
                    class="dam-pill"
                    [class.active]="damViewMode === 'operational'"
                    (click)="damViewMode = 'operational'"
                  >
                    📐 Cotas Operativas
                  </button>
                  <button
                    class="dam-pill"
                    [class.active]="damViewMode === 'geotechnical'"
                    (click)="damViewMode = 'geotechnical'"
                  >
                    🧱 Zonificación Geotécnica
                  </button>
                </div>

                <div
                  class="dam-status-pill"
                  [class.safe]="!damIsFreeboardWarning && !damIsFreeboardCritical"
                  [class.warning]="damIsFreeboardWarning"
                  [class.critical]="damIsFreeboardCritical"
                >
                  <span class="pulse-beacon"></span>
                  <span>{{ damFreeboardStatusText }}</span>
                </div>
              </div>
            </div>

            <!-- Quick Metrics Header Strip -->
            <div class="dam-metrics-strip">
              <div class="dam-metric-badge" (mouseenter)="activeDamPart = 'corona'" (mouseleave)="activeDamPart = null">
                <span class="m-label">Cota Corona Dique</span>
                <span class="m-val">{{ current.cotaCoronaMsnm.toFixed(2) }} msnm</span>
              </div>
              <div class="dam-metric-badge" (mouseenter)="activeDamPart = 'embalse'" (mouseleave)="activeDamPart = null">
                <span class="m-label">Cota Espejo de Agua</span>
                <span class="m-val highlight-blue">{{ current.cotaEmbalseMsnm.toFixed(2) }} msnm</span>
              </div>
              <div class="dam-metric-badge" (mouseenter)="activeDamPart = 'borde_libre'" (mouseleave)="activeDamPart = null">
                <span class="m-label">Borde Libre (Revancha)</span>
                <span
                  class="m-val highlight-status"
                  [class.text-safe]="!damIsFreeboardWarning && !damIsFreeboardCritical"
                  [class.text-warn]="damIsFreeboardWarning"
                  [class.text-crit]="damIsFreeboardCritical"
                >
                  {{ current.bordeLibreM.toFixed(2) }} m
                </span>
              </div>
              <div class="dam-metric-badge" (mouseenter)="activeDamPart = 'playa'" (mouseleave)="activeDamPart = null">
                <span class="m-label">Longitud de Playa</span>
                <span class="m-val">{{ current.longitudPlayaM }} m</span>
              </div>
              <div class="dam-metric-badge" (mouseenter)="activeDamPart = 'talud'" (mouseleave)="activeDamPart = null">
                <span class="m-label">Crecimiento Dique</span>
                <span class="m-val">+{{ current.crecimientoPresaM.toFixed(2) }} m/día</span>
              </div>
              <div class="dam-metric-badge" (mouseenter)="activeDamPart = 'torre5'" (mouseleave)="activeDamPart = null">
                <span class="m-label">Extracción Torre 5</span>
                <span class="m-val">{{ current.torre5VolDiaM3.toLocaleString() }} m³</span>
              </div>
            </div>

            <!-- Interactive SVG Diagram Viewport -->
            <div class="dam-svg-container">
              <svg viewBox="0 0 940 330" class="dam-profile-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <!-- Gradients -->
                  <linearGradient id="damWaterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85"></stop>
                    <stop offset="60%" stop-color="#0284c7" stop-opacity="0.90"></stop>
                    <stop offset="100%" stop-color="#0369a1" stop-opacity="0.95"></stop>
                  </linearGradient>

                  <linearGradient id="damSandGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#fef3c7"></stop>
                    <stop offset="50%" stop-color="#fde68a"></stop>
                    <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.65"></stop>
                  </linearGradient>

                  <linearGradient id="damRiprapGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#cbd5e1"></stop>
                    <stop offset="100%" stop-color="#94a3b8"></stop>
                  </linearGradient>

                  <linearGradient id="damBeachGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#fed7aa"></stop>
                    <stop offset="100%" stop-color="#fde68a"></stop>
                  </linearGradient>

                  <linearGradient id="damSludgeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#94a3b8"></stop>
                    <stop offset="100%" stop-color="#64748b"></stop>
                  </linearGradient>

                  <linearGradient id="damSkyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#f8fafc"></stop>
                    <stop offset="100%" stop-color="#eff6ff"></stop>
                  </linearGradient>

                  <!-- Hatches & Patterns -->
                  <pattern id="damGroundHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" stroke-width="1.2"></line>
                  </pattern>

                  <pattern id="damRiprapPattern" width="14" height="14" patternUnits="userSpaceOnUse">
                    <circle cx="7" cy="7" r="4" fill="#94a3b8" opacity="0.3"></circle>
                    <circle cx="2" cy="2" r="2.5" fill="#64748b" opacity="0.3"></circle>
                    <circle cx="12" cy="12" r="2" fill="#64748b" opacity="0.3"></circle>
                  </pattern>

                  <!-- Arrow Markers -->
                  <marker id="arrowUp" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 10 L 5 0 L 10 10 z" fill="#031795"></path>
                  </marker>
                  <marker id="arrowDown" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 5 10 L 10 0 z" fill="#031795"></path>
                  </marker>
                  <marker id="arrowUpCrit" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 10 L 5 0 L 10 10 z" fill="#dc2626"></path>
                  </marker>
                  <marker id="arrowDownCrit" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 5 10 L 10 0 z" fill="#dc2626"></path>
                  </marker>
                </defs>

                <!-- Sky / Air Background -->
                <rect x="0" y="0" width="940" height="280" fill="url(#damSkyGrad)"></rect>

                <!-- Geotechnical Foundation / Ground Baseline (y=280) -->
                <rect x="0" y="280" width="940" height="50" fill="#f1f5f9"></rect>
                <rect x="0" y="280" width="940" height="50" fill="url(#damGroundHatch)" opacity="0.35"></rect>
                <line x1="0" y1="280" x2="940" y2="280" stroke="#475569" stroke-width="2.5"></line>
                <text x="50" y="302" fill="#64748b" font-size="10" font-weight="700">TERRENO DE FUNDACIÓN / ROCA BASAL</text>

                <!-- 1. Fine Tailings Slimes Sediment (Lamas finas sedimentadas) -->
                <polygon
                  [attr.points]="damSludgePolygonPoints"
                  fill="url(#damSludgeGrad)"
                  stroke="#475569"
                  stroke-width="1"
                ></polygon>

                <!-- 2. Tailings Beach (Playa de relaves segregados) -->
                <polygon
                  [attr.points]="'360,80 ' + damBeachWaterX + ',' + damWaterY + ' ' + damBeachWaterX + ',240 440,280 360,280'"
                  fill="url(#damBeachGrad)"
                  stroke="#d97706"
                  stroke-width="1.2"
                  class="interactive-dam-zone"
                  (mouseenter)="activeDamPart = 'playa'"
                  (mouseleave)="activeDamPart = null"
                ></polygon>

                <!-- 3. Dam Structural Body (Cuerpo de arenas compactadas) -->
                <polygon
                  points="60,280 180,190 210,190 290,80 360,80 360,280"
                  fill="url(#damSandGrad)"
                  stroke="#d97706"
                  stroke-width="1.5"
                  class="interactive-dam-zone"
                  (mouseenter)="activeDamPart = 'talud'"
                  (mouseleave)="activeDamPart = null"
                ></polygon>

                <!-- 4. Riprap / Downstream Armor Shell (Protección Talud Aguas Abajo) -->
                <polygon
                  points="60,280 180,190 210,190 290,80 270,80 195,190 165,190 45,280"
                  fill="url(#damRiprapGrad)"
                  opacity="0.4"
                ></polygon>
                <polygon
                  points="60,280 180,190 210,190 290,80 270,80 195,190 165,190 45,280"
                  fill="url(#damRiprapPattern)"
                  opacity="0.6"
                ></polygon>

                <!-- 5. Phreatic Line (Línea Freática dentro del dique) -->
                <path
                  [attr.d]="'M ' + damBeachWaterX + ',' + damWaterY + ' Q 320,' + (damWaterY + 30) + ' 210,275'"
                  fill="none"
                  stroke="#0284c7"
                  stroke-width="1.8"
                  stroke-dasharray="4 3"
                ></path>
                <text x="250" [attr.y]="damWaterY + 50" fill="#0284c7" font-size="9" font-weight="700">Línea Freática (Abatida)</text>

                <!-- 6. Basal Drainage Blanket (Dren Basal) -->
                <rect
                  x="180"
                  y="272"
                  width="70"
                  height="8"
                  fill="#475569"
                  stroke="#334155"
                  stroke-width="1"
                  class="interactive-dam-zone"
                  (mouseenter)="activeDamPart = 'dren'"
                  (mouseleave)="activeDamPart = null"
                ></rect>
                <line x1="175" y1="276" x2="145" y2="276" stroke="#0284c7" stroke-width="2"></line>
                <polygon points="145,273 138,276 145,279" fill="#0284c7"></polygon>
                <text x="135" y="271" fill="#0284c7" font-size="8.5" font-weight="700" text-anchor="end">Dren Basal ({{ current.filtracionesTotalLs }} L/s)</text>

                <!-- 7. Lagoon / Water Pond (Espejo de Agua Dinámico) -->
                <polygon
                  [attr.points]="damWaterPolygonPoints"
                  fill="url(#damWaterGrad)"
                  class="interactive-dam-zone water-pond"
                  (mouseenter)="activeDamPart = 'embalse'"
                  (mouseleave)="activeDamPart = null"
                ></polygon>

                <!-- Dynamic Water Surface Wave / Top Line -->
                <line
                  [attr.x1]="damBeachWaterX"
                  [attr.y1]="damWaterY"
                  x2="910"
                  [attr.y2]="damWaterY"
                  stroke="#bae6fd"
                  stroke-width="3"
                ></line>
                <path
                  [attr.d]="'M ' + damBeachWaterX + ',' + damWaterY + ' q 20,-3 40,0 t 40,0 t 40,0 t 40,0 t 40,0 t 40,0 t 40,0 t 40,0 t 40,0'"
                  fill="none"
                  stroke="#ffffff"
                  stroke-width="1.5"
                  opacity="0.8"
                ></path>

                <!-- Water Elevation Flag -->
                <rect
                  [attr.x]="damBeachWaterX + 45"
                  [attr.y]="damWaterY - 26"
                  width="180"
                  height="22"
                  rx="6"
                  fill="#0369a1"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                ></rect>
                <text
                  [attr.x]="damBeachWaterX + 135"
                  [attr.y]="damWaterY - 11"
                  fill="#ffffff"
                  font-size="10.5"
                  font-weight="700"
                  text-anchor="middle"
                >
                  💧 Cota Agua: {{ current.cotaEmbalseMsnm.toFixed(2) }} msnm
                </text>

                <!-- 8. Decant Tower 5 (Torre 5 de Captación) -->
                <g
                  class="interactive-dam-zone tower-zone"
                  (mouseenter)="activeDamPart = 'torre5'"
                  (mouseleave)="activeDamPart = null"
                >
                  <!-- Tower Pier Concrete Shaft -->
                  <rect x="785" y="65" width="22" height="205" rx="2" fill="#475569" stroke="#1e293b" stroke-width="1.5"></rect>
                  <!-- Intake Ring Windows -->
                  <rect x="788" y="90" width="16" height="6" fill="#0284c7" opacity="0.8"></rect>
                  <rect x="788" y="110" width="16" height="6" fill="#0284c7" opacity="0.8"></rect>
                  <rect x="788" y="130" width="16" height="6" fill="#0284c7" opacity="0.8"></rect>
                  <rect x="788" y="150" width="16" height="6" fill="#0284c7" opacity="0.8"></rect>
                  <rect x="788" y="170" width="16" height="6" fill="#0284c7" opacity="0.8"></rect>
                  <rect x="788" y="190" width="16" height="6" fill="#0284c7" opacity="0.8"></rect>
                  <!-- Walkway bridge to abutment -->
                  <line x1="807" y1="72" x2="910" y2="72" stroke="#64748b" stroke-width="4"></line>
                  <line x1="807" y1="67" x2="910" y2="67" stroke="#94a3b8" stroke-width="1.5"></line>
                  <!-- Tower Top House -->
                  <rect x="780" y="50" width="32" height="15" rx="3" fill="#0f172a"></rect>
                  <circle cx="796" cy="57" r="2.5" fill="#10b981"></circle>
                  <!-- Tag -->
                  <rect x="735" y="24" width="125" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"></rect>
                  <text x="797" y="38" fill="#0f172a" font-size="9.5" font-weight="700" text-anchor="middle">
                    Torre 5 ({{ current.torre5VolDiaM3.toLocaleString() }} m³)
                  </text>
                </g>

                <!-- 9. Crest / Corona del Dique -->
                <g
                  class="interactive-dam-zone crest-zone"
                  (mouseenter)="activeDamPart = 'corona'"
                  (mouseleave)="activeDamPart = null"
                >
                  <rect x="290" y="77" width="70" height="6" fill="#d97706" rx="1"></rect>
                  <!-- Crest Elevation Pill -->
                  <rect x="250" y="44" width="150" height="25" rx="7" fill="#031795" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"></rect>
                  <text x="325" y="60" fill="#ffffff" font-size="11" font-weight="800" text-anchor="middle">
                    ▲ Corona: {{ current.cotaCoronaMsnm.toFixed(2) }} msnm
                  </text>
                  <!-- Crest Width text -->
                  <text x="325" y="93" fill="#64748b" font-size="9" font-weight="600" text-anchor="middle">Ancho Corona</text>
                </g>

                <!-- 10. GISTM Minimum Safety Threshold Line (2.00 m below crest -> y = 120) -->
                <g>
                  <line
                    x1="385"
                    [attr.y1]="damGistmThresholdY"
                    x2="910"
                    [attr.y2]="damGistmThresholdY"
                    stroke="#ef4444"
                    stroke-width="1.8"
                    stroke-dasharray="6 4"
                  ></line>
                  <rect
                    x="560"
                    [attr.y]="damGistmThresholdY - 18"
                    width="190"
                    height="18"
                    rx="4"
                    fill="#fef2f2"
                    stroke="#fca5a5"
                    stroke-width="1"
                  ></rect>
                  <text
                    x="655"
                    [attr.y]="damGistmThresholdY - 5"
                    fill="#dc2626"
                    font-size="9.5"
                    font-weight="700"
                    text-anchor="middle"
                  >
                    ⚠️ Límite Mínimo GISTM: 2.00 m
                  </text>
                </g>

                <!-- 11. FREEBOARD TECHNICAL DIMENSION LINE (Between y=80 and y=damWaterY) -->
                <g
                  class="interactive-dam-zone freeboard-dim-zone"
                  (mouseenter)="activeDamPart = 'borde_libre'"
                  (mouseleave)="activeDamPart = null"
                >
                  <!-- Top extension line from crest -->
                  <line x1="360" y1="80" x2="445" y2="80" stroke="#64748b" stroke-width="1" stroke-dasharray="2 2"></line>
                  <!-- Bottom extension line from water -->
                  <line [attr.x1]="damBeachWaterX" [attr.y1]="damWaterY" x2="445" [attr.y2]="damWaterY" stroke="#64748b" stroke-width="1" stroke-dasharray="2 2"></line>

                  <!-- Vertical Dimension Double-Arrow Line -->
                  <line
                    x1="435"
                    y1="85"
                    x2="435"
                    [attr.y2]="damWaterY - 5"
                    [attr.stroke]="damIsFreeboardCritical ? '#dc2626' : '#031795'"
                    stroke-width="2.5"
                    [attr.marker-start]="damIsFreeboardCritical ? 'url(#arrowUpCrit)' : 'url(#arrowUp)'"
                    [attr.marker-end]="damIsFreeboardCritical ? 'url(#arrowDownCrit)' : 'url(#arrowDown)'"
                  ></line>

                  <!-- Freeboard Badge Floating on dimension line -->
                  <rect
                    x="375"
                    [attr.y]="(80 + damWaterY) / 2 - 13"
                    width="120"
                    height="26"
                    rx="13"
                    [attr.fill]="damIsFreeboardCritical ? '#fef2f2' : (!damIsFreeboardWarning ? '#ecfdf5' : '#fffbeb')"
                    [attr.stroke]="damIsFreeboardCritical ? '#f87171' : (!damIsFreeboardWarning ? '#6ee7b7' : '#fcd34d')"
                    stroke-width="1.5"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  ></rect>
                  <text
                    x="435"
                    [attr.y]="(80 + damWaterY) / 2 + 4"
                    [attr.fill]="damIsFreeboardCritical ? '#dc2626' : (!damIsFreeboardWarning ? '#065f46' : '#92400e')"
                    font-size="11"
                    font-weight="800"
                    text-anchor="middle"
                  >
                    ↔ {{ current.bordeLibreM.toFixed(2) }} m
                  </text>
                </g>

                <!-- 12. Beach Length Dimension Arrow -->
                <g
                  class="interactive-dam-zone"
                  (mouseenter)="activeDamPart = 'playa'"
                  (mouseleave)="activeDamPart = null"
                >
                  <line
                    x1="365"
                    y1="165"
                    [attr.x2]="damBeachWaterX - 5"
                    y2="165"
                    stroke="#d97706"
                    stroke-width="1.5"
                    stroke-dasharray="3 2"
                  ></line>
                  <rect
                    [attr.x]="(365 + damBeachWaterX) / 2 - 60"
                    y="153"
                    width="120"
                    height="20"
                    rx="4"
                    fill="#fffbeb"
                    stroke="#fde68a"
                    stroke-width="1"
                  ></rect>
                  <text
                    [attr.x]="(365 + damBeachWaterX) / 2"
                    y="167"
                    fill="#92400e"
                    font-size="9.5"
                    font-weight="700"
                    text-anchor="middle"
                  >
                    Playa: {{ current.longitudPlayaM }} m
                  </text>
                </g>

                <!-- Geotechnical Material Labels (when damViewMode === 'geotechnical') -->
                <g *ngIf="damViewMode === 'geotechnical'">
                  <rect x="90" y="220" width="115" height="24" rx="4" fill="#ffffff" stroke="#94a3b8" stroke-width="1"></rect>
                  <text x="147" y="235" fill="#334155" font-size="9" font-weight="700" text-anchor="middle">Enrocado / Riprap</text>

                  <rect x="210" y="140" width="130" height="24" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1"></rect>
                  <text x="275" y="155" fill="#92400e" font-size="9" font-weight="700" text-anchor="middle">Arenas Compactadas</text>

                  <rect x="420" y="210" width="120" height="24" rx="4" fill="#ffffff" stroke="#b45309" stroke-width="1"></rect>
                  <text x="480" y="225" fill="#78350f" font-size="9" font-weight="700" text-anchor="middle">Playa de Relaves</text>

                  <rect x="680" y="240" width="140" height="24" rx="4" fill="#ffffff" stroke="#64748b" stroke-width="1"></rect>
                  <text x="750" y="255" fill="#1e293b" font-size="9" font-weight="700" text-anchor="middle">Lamas Sedimentadas</text>
                </g>

                <!-- Downstream Slope Notation -->
                <text x="110" y="210" fill="#64748b" font-size="9" font-weight="600" transform="rotate(-30 110 210)">
                  Talud 1:2.5 (Aguas Abajo)
                </text>
              </svg>
            </div>

            <!-- Dynamic Inspector Panel on Hover / Selection -->
            <div class="dam-inspector-panel" *ngIf="damActivePartDetails as part">
              <div class="inspector-badge-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div class="inspector-text">
                <span class="inspector-title"><strong>{{ part.title }}</strong>: <span class="inspector-val">{{ part.value }}</span></span>
                <p class="inspector-desc">{{ part.note }}</p>
              </div>
            </div>

            <!-- Bottom Geotechnical Legend & Technical Notes -->
            <div class="dam-footer-legend">
              <div class="legend-chip">
                <span class="color-box crest"></span>
                <span>Corona Dique (msnm)</span>
              </div>
              <div class="legend-chip">
                <span class="color-box water"></span>
                <span>Espejo de Agua</span>
              </div>
              <div class="legend-chip">
                <span class="color-box sand"></span>
                <span>Arenas Compactadas</span>
              </div>
              <div class="legend-chip">
                <span class="color-box beach"></span>
                <span>Playa de Relaves</span>
              </div>
              <div class="legend-chip">
                <span class="color-box tower"></span>
                <span>Torre 5 de Captación</span>
              </div>
              <div class="legend-chip">
                <span class="color-box threshold"></span>
                <span>Límite Mínimo GISTM (2.0m)</span>
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

          <!-- HISTORICAL MULTI-METRIC TREND ANALYSIS CENTER -->
          <section class="trend-chart-section glass-panel">
            <div class="trend-section-header">
              <div class="head-titles">
                <div class="trend-title-badge">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#031795" stroke-width="2.2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  <h3>Centro de Análisis de Tendencias Operativas</h3>
                </div>
                <p class="subtitle">Monitoreo multivariable continuo, umbrales GISTM de diseño y correlación histórica día a día</p>
              </div>

              <!-- Time Range Selector -->
              <div class="range-selector-pills">
                <button
                  class="range-pill"
                  [class.active]="selectedTrendRange === '7d'"
                  (click)="selectedTrendRange = '7d'"
                >
                  7 Días
                </button>
                <button
                  class="range-pill"
                  [class.active]="selectedTrendRange === '15d'"
                  (click)="selectedTrendRange = '15d'"
                >
                  15 Días
                </button>
                <button
                  class="range-pill"
                  [class.active]="selectedTrendRange === '30d'"
                  (click)="selectedTrendRange = '30d'"
                >
                  30 Días
                </button>
                <button
                  class="range-pill"
                  [class.active]="selectedTrendRange === 'all'"
                  (click)="selectedTrendRange = 'all'"
                >
                  Todo el Histórico
                </button>
              </div>
            </div>

            <!-- Metric Selector Ribbon (Chips with icons and theme colors) -->
            <div class="metric-ribbon">
              <button
                *ngFor="let m of trendMetricConfigs"
                class="metric-chip"
                [class.active]="selectedTrendMetricId === m.id"
                (click)="selectedTrendMetricId = m.id"
              >
                <span class="chip-dot" [style.backgroundColor]="m.color"></span>
                <span class="chip-name">{{ m.label }}</span>
              </button>
            </div>

            <!-- Statistical Summary 4-Card Bar -->
            <div class="trend-stats-grid" *ngIf="trendStats as stats">
              <div class="stat-mini-card">
                <span class="stat-mini-label">Último Valor Registrado</span>
                <div class="stat-mini-val-row">
                  <span class="stat-mini-val" [style.color]="currentMetricConfig.color">{{ stats.formattedLast }}</span>
                  <span class="stat-delta-badge" [class.positive]="stats.deltaPct >= 0" [class.negative]="stats.deltaPct < 0">
                    {{ stats.deltaPct >= 0 ? '▲ +' : '▼ ' }}{{ stats.deltaPct }}%
                  </span>
                </div>
                <span class="stat-mini-sub">Última fecha: {{ stats.lastDate }}</span>
              </div>

              <div class="stat-mini-card">
                <span class="stat-mini-label">Promedio del Periodo</span>
                <span class="stat-mini-val">{{ stats.formattedAvg }}</span>
                <span class="stat-mini-sub">{{ trendFilteredEntries.length }} registros evaluados</span>
              </div>

              <div class="stat-mini-card">
                <span class="stat-mini-label">Máximo Registrado</span>
                <span class="stat-mini-val text-max">{{ stats.formattedMax }}</span>
                <span class="stat-mini-sub">Fecha pico: {{ stats.maxDate }}</span>
              </div>

              <div class="stat-mini-card">
                <span class="stat-mini-label">Mínimo Registrado</span>
                <span class="stat-mini-val text-min">{{ stats.formattedMin }}</span>
                <span class="stat-mini-sub">Fecha valle: {{ stats.minDate }}</span>
              </div>
            </div>

            <!-- Interactive Legend & Secondary Curve Toggle -->
            <div class="chart-legend-toolbar">
              <div class="legend-items-group">
                <div class="legend-badge">
                  <span class="legend-line" [style.backgroundColor]="currentMetricConfig.color"></span>
                  <strong>{{ currentMetricConfig.primaryLabel }}</strong> (Eje Principal)
                </div>
                <div class="legend-badge secondary" *ngIf="currentMetricConfig.secondaryLabel">
                  <label class="toggle-secondary-label">
                    <input type="checkbox" [(ngModel)]="showSecondaryCurve" />
                    <span class="legend-line-dashed" [style.borderColor]="currentMetricConfig.secondaryColor"></span>
                    <span>{{ currentMetricConfig.secondaryLabel }}</span>
                  </label>
                </div>
                <div class="legend-badge threshold" *ngIf="currentMetricConfig.thresholdLabel">
                  <span class="legend-line-red"></span>
                  <span>{{ currentMetricConfig.thresholdLabel }}</span>
                </div>
              </div>

              <span class="legend-tip">
                💡 Haz clic en cualquier punto del gráfico para ver ese día en todo el Dashboard
              </span>
            </div>

            <!-- SVG Chart Viewport -->
            <div class="svg-chart-container" *ngIf="trendPrimaryPoints.length > 0">
              <svg viewBox="0 0 800 260" class="historical-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendMetricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" [attr.stop-color]="currentMetricConfig.color" stop-opacity="0.32"></stop>
                    <stop offset="100%" [attr.stop-color]="currentMetricConfig.color" stop-opacity="0.02"></stop>
                  </linearGradient>
                </defs>

                <!-- Grid Horizontal Lines & Y-Axis Labels -->
                <g *ngFor="let line of trendGridY">
                  <line x1="65" [attr.y1]="line.y" x2="770" [attr.y2]="line.y" stroke="#f1f5f9" stroke-width="1.2"></line>
                  <text x="58" [attr.y]="line.y + 3" fill="#94a3b8" font-size="10" font-weight="600" text-anchor="end">
                    {{ line.formatted }}
                  </text>
                </g>

                <!-- Bottom X baseline -->
                <line x1="65" y1="210" x2="770" y2="210" stroke="#cbd5e1" stroke-width="1.5"></line>

                <!-- Threshold reference line (if in visible range) -->
                <g *ngIf="trendThresholdY !== null">
                  <line
                    x1="65"
                    [attr.y1]="trendThresholdY"
                    x2="770"
                    [attr.y2]="trendThresholdY"
                    stroke="#ef4444"
                    stroke-width="1.6"
                    stroke-dasharray="5 4"
                  ></line>
                  <rect
                    [attr.x]="600"
                    [attr.y]="trendThresholdY - 14"
                    width="170"
                    height="18"
                    rx="4"
                    fill="#fef2f2"
                    stroke="#fca5a5"
                    stroke-width="1"
                  ></rect>
                  <text
                    [attr.x]="685"
                    [attr.y]="trendThresholdY - 2"
                    fill="#dc2626"
                    font-size="9"
                    font-weight="700"
                    text-anchor="middle"
                  >
                    {{ currentMetricConfig.thresholdLabel }}
                  </text>
                </g>

                <!-- Primary Area Fill -->
                <polygon [attr.points]="trendPrimaryAreaPath" fill="url(#trendMetricGrad)"></polygon>

                <!-- Secondary Line (if toggled) -->
                <polyline
                  *ngIf="showSecondaryCurve && trendSecondaryLinePath"
                  [attr.points]="trendSecondaryLinePath"
                  fill="none"
                  [attr.stroke]="currentMetricConfig.secondaryColor"
                  stroke-width="2.2"
                  stroke-dasharray="4 3"
                ></polyline>

                <!-- Primary Line -->
                <polyline
                  [attr.points]="trendPrimaryLinePath"
                  fill="none"
                  [attr.stroke]="currentMetricConfig.color"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></polyline>

                <!-- Data Points / Circles -->
                <g *ngFor="let pt of trendPrimaryPoints">
                  <circle
                    [attr.cx]="pt.x"
                    [attr.cy]="pt.y"
                    r="5.5"
                    fill="#ffffff"
                    [attr.stroke]="currentMetricConfig.color"
                    stroke-width="2.8"
                    class="chart-circle"
                    (mouseenter)="hoveredTrendPoint = pt"
                    (mouseleave)="hoveredTrendPoint = null"
                    (click)="masterService.selectDate(pt.fecha)"
                  >
                    <title>{{ pt.fecha }}: {{ pt.formattedVal }}</title>
                  </circle>

                  <!-- Date label below -->
                  <text [attr.x]="pt.x" y="230" fill="#64748b" font-size="10" font-weight="500" text-anchor="middle">
                    {{ pt.fecha.slice(0, 5) }}
                  </text>

                  <!-- Value label above point -->
                  <text
                    [attr.x]="pt.x"
                    [attr.y]="pt.y - 10"
                    fill="#0f172a"
                    font-size="10"
                    font-weight="700"
                    text-anchor="middle"
                  >
                    {{ pt.displayVal }}
                  </text>
                </g>
              </svg>

              <!-- Floating Tooltip Card on Hover -->
              <div
                class="chart-floating-tooltip"
                *ngIf="hoveredTrendPoint as hov"
                [style.left.px]="hov.x"
                [style.top.px]="hov.y - 65"
              >
                <div class="tooltip-header">
                  <span>📅 {{ hov.fecha }}</span>
                </div>
                <div class="tooltip-val" [style.color]="currentMetricConfig.color">
                  <strong>{{ hov.formattedVal }}</strong>
                </div>
                <div class="tooltip-hint">Clic para inspeccionar día</div>
              </div>
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

    /* Dam Cross-Section Section */
    .dam-cross-section {
      padding: 24px;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .dam-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
    }

    .dam-title-badge {
      display: flex;
      align-items: center;
      gap: 8px;

      h3 {
        font-size: 1.15rem;
        font-weight: 800;
        color: #0f172a;
      }
    }

    .dam-header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .dam-mode-pills {
      display: flex;
      align-items: center;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;
      border: 1px solid #e2e8f0;
    }

    .dam-pill {
      padding: 6px 12px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: #0f172a;
      }

      &.active {
        background: #ffffff;
        color: #031795;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .dam-status-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.76rem;
      font-weight: 700;

      &.safe {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        .pulse-beacon { background: #10b981; }
      }

      &.warning {
        background: #fffbeb;
        color: #92400e;
        border: 1px solid #fde68a;
        .pulse-beacon { background: #f59e0b; }
      }

      &.critical {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
        .pulse-beacon { background: #ef4444; }
      }
    }

    .pulse-beacon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
      animation: beaconPulse 2s infinite;
    }

    @keyframes beaconPulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    .dam-metrics-strip {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 640px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .dam-metric-badge {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      transition: all 0.2s;
      cursor: pointer;

      &:hover {
        background: #eff6ff;
        border-color: #93c5fd;
      }
    }

    .m-label {
      font-size: 0.68rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }

    .m-val {
      font-size: 0.88rem;
      font-weight: 800;
      color: #0f172a;

      &.highlight-blue {
        color: #0284c7;
      }

      &.text-safe {
        color: #059669;
      }
      &.text-warn {
        color: #d97706;
      }
      &.text-crit {
        color: #dc2626;
      }
    }

    .dam-svg-container {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.03);
    }

    .dam-profile-svg {
      width: 100%;
      height: auto;
      max-height: 400px;
      display: block;
    }

    .interactive-dam-zone {
      cursor: pointer;
      transition: filter 0.2s, opacity 0.2s;

      &:hover {
        filter: brightness(1.08) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
      }
    }

    .dam-inspector-panel {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      animation: fadeIn 0.2s ease-in;
    }

    .inspector-badge-icon {
      color: #1e40af;
      display: flex;
      align-items: center;
    }

    .inspector-text {
      font-size: 0.82rem;
      color: #1e3a8a;

      .inspector-val {
        font-weight: 800;
        color: #031795;
      }
    }

    .inspector-desc {
      font-size: 0.74rem;
      color: #3b82f6;
      margin-top: 2px;
    }

    .dam-footer-legend {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 4px;
    }

    .legend-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #475569;
      font-weight: 500;
    }

    .color-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;

      &.crest { background: #031795; }
      &.water { background: #0284c7; }
      &.sand { background: #f59e0b; }
      &.beach { background: #fed7aa; border: 1px solid #f59e0b; }
      &.tower { background: #475569; }
      &.threshold {
        width: 16px;
        height: 2px;
        background: #ef4444;
      }
    }

    /* Trend Chart Section */
    .trend-chart-section {
      padding: 24px;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .trend-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
    }

    .trend-title-badge {
      display: flex;
      align-items: center;
      gap: 8px;

      h3 {
        font-size: 1.15rem;
        font-weight: 800;
        color: #0f172a;
      }
    }

    .range-selector-pills {
      display: flex;
      align-items: center;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;
      border: 1px solid #e2e8f0;
    }

    .range-pill {
      padding: 6px 12px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: #0f172a;
      }

      &.active {
        background: #ffffff;
        color: #031795;
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .metric-ribbon {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: thin;
    }

    .metric-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #f8fafc;
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      &.active {
        background: #ffffff;
        border-color: #031795;
        color: #031795;
        font-weight: 700;
        box-shadow: 0 2px 4px rgba(3, 23, 149, 0.12);
      }
    }

    .chip-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .trend-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;

      @media (max-width: 900px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-mini-card {
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .stat-mini-label {
      font-size: 0.68rem;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
    }

    .stat-mini-val-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .stat-mini-val {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;

      &.text-max { color: #0284c7; }
      &.text-min { color: #d97706; }
    }

    .stat-delta-badge {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;

      &.positive {
        background: #ecfdf5;
        color: #059669;
      }
      &.negative {
        background: #fef2f2;
        color: #dc2626;
      }
    }

    .stat-mini-sub {
      font-size: 0.68rem;
      color: #94a3b8;
    }

    .chart-legend-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 4px 0;
    }

    .legend-items-group {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }

    .legend-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #334155;
    }

    .legend-line {
      width: 14px;
      height: 3.5px;
      border-radius: 2px;
    }

    .legend-line-dashed {
      display: inline-block;
      width: 14px;
      height: 0;
      border-top: 2.5px dashed;
    }

    .legend-line-red {
      display: inline-block;
      width: 14px;
      height: 0;
      border-top: 2px dashed #ef4444;
    }

    .toggle-secondary-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    .legend-tip {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 500;
    }

    .svg-chart-container {
      position: relative;
      width: 100%;
      height: 260px;
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
        r: 8;
        stroke-width: 4;
      }
    }

    .chart-floating-tooltip {
      position: absolute;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      padding: 6px 12px;
      border-radius: 8px;
      pointer-events: none;
      transform: translate(-50%, -100%);
      z-index: 10;
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tooltip-header {
      font-size: 0.7rem;
      color: #64748b;
      font-weight: 600;
    }

    .tooltip-val {
      font-size: 0.88rem;
      font-weight: 800;
    }

    .tooltip-hint {
      font-size: 0.65rem;
      color: #94a3b8;
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

  // --- Historical Trend Analysis Center Engine ---
  selectedTrendMetricId: string = 'borde_libre';
  selectedTrendRange: '7d' | '15d' | '30d' | 'all' = '15d';
  showSecondaryCurve: boolean = false;
  hoveredTrendPoint: TrendDataPoint | null = null;

  trendMetricConfigs: TrendMetricConfig[] = [
    {
      id: 'borde_libre',
      label: 'Borde Libre',
      primaryLabel: 'Borde Libre (m)',
      color: '#031795',
      unit: 'm',
      decimals: 2,
      secondaryLabel: 'Crecimiento Dique (m)',
      secondaryColor: '#d97706',
      secondaryUnit: 'm',
      secondaryDecimals: 2,
      thresholdLabel: 'GISTM Mínimo: 2.00 m',
      thresholdVal: 2.0,
      getValue: (e) => e.bordeLibreM ?? 0,
      getSecondaryValue: (e) => e.crecimientoPresaM ?? 0
    },
    {
      id: 'relaves',
      label: 'Relaves a Presa',
      primaryLabel: 'Relave Diario (m³)',
      color: '#10b981',
      unit: 'm³',
      decimals: 0,
      secondaryLabel: 'Torre 5 Recup. (m³)',
      secondaryColor: '#0284c7',
      secondaryUnit: 'm³',
      secondaryDecimals: 0,
      thresholdLabel: 'Capacidad Nom.: 30,000 m³',
      thresholdVal: 30000,
      getValue: (e) => e.relaveTotalVolDiaM3 ?? 0,
      getSecondaryValue: (e) => e.torre5VolDiaM3 ?? 0
    },
    {
      id: 'torre5',
      label: 'Torre 5 Recup.',
      primaryLabel: 'Torre 5 (m³/día)',
      color: '#0284c7',
      unit: 'm³',
      decimals: 0,
      secondaryLabel: 'Sentina Drenes (m³)',
      secondaryColor: '#8b5cf6',
      secondaryUnit: 'm³',
      secondaryDecimals: 0,
      thresholdLabel: 'Meta Recup.: 20,000 m³',
      thresholdVal: 20000,
      getValue: (e) => e.torre5VolDiaM3 ?? 0,
      getSecondaryValue: (e) => e.sentinaBombeadoTotalM3 ?? 0
    },
    {
      id: 'ciclones',
      label: 'Ciclones 2da Estación',
      primaryLabel: '% Sólidos Arenas',
      color: '#7c3aed',
      unit: '%',
      decimals: 2,
      secondaryLabel: '% Malla -200 Pasante',
      secondaryColor: '#f59e0b',
      secondaryUnit: '%',
      secondaryDecimals: 2,
      thresholdLabel: 'Meta Sólidos: 70.0%',
      thresholdVal: 70.0,
      getValue: (e) => e.ciclones2daSolidosPromPct ?? 0,
      getSecondaryValue: (e) => e.ciclones2daMalla200PromPct ?? 0
    },
    {
      id: 'filtraciones',
      label: 'Filtraciones Totales',
      primaryLabel: 'Filtraciones (L/s)',
      color: '#ef4444',
      unit: 'L/s',
      decimals: 2,
      secondaryLabel: 'Vertedero (L/s)',
      secondaryColor: '#06b6d4',
      secondaryUnit: 'L/s',
      secondaryDecimals: 2,
      thresholdLabel: 'Límite Alerta: 5.0 L/s',
      thresholdVal: 5.0,
      getValue: (e) => e.filtracionesTotalLs ?? 0,
      getSecondaryValue: (e) => e.vertederoPromLs ?? 0
    },
    {
      id: 'arenas',
      label: 'Arenas Compactadas',
      primaryLabel: 'Arenas Flujómetro (m³)',
      color: '#d97706',
      unit: 'm³',
      decimals: 0,
      secondaryLabel: 'Topografía (m³)',
      secondaryColor: '#10b981',
      secondaryUnit: 'm³',
      secondaryDecimals: 0,
      thresholdLabel: 'Meta Diaria: 10,000 m³',
      thresholdVal: 10000,
      getValue: (e) => e.arenasProdFlujometroM3 ?? 0,
      getSecondaryValue: (e) => e.arenasProdTopografiaM3 ?? 0
    },
    {
      id: 'ph',
      label: 'Control de pH',
      primaryLabel: 'pH Embalse',
      color: '#059669',
      unit: 'pH',
      decimals: 2,
      secondaryLabel: 'pH Vertedero',
      secondaryColor: '#2563eb',
      secondaryUnit: 'pH',
      secondaryDecimals: 2,
      thresholdLabel: 'Límite Ambiental: 9.0 pH',
      thresholdVal: 9.0,
      getValue: (e) => e.phEmbalseA ?? 0,
      getSecondaryValue: (e) => e.phVertederoA ?? 0
    }
  ];

  get currentMetricConfig(): TrendMetricConfig {
    return this.trendMetricConfigs.find(c => c.id === this.selectedTrendMetricId) || this.trendMetricConfigs[0];
  }

  get trendFilteredEntries(): MasterSheetEntry[] {
    const list = this.masterService.entries();
    if (!list || list.length === 0) return [];
    let sliceCount: number;
    switch (this.selectedTrendRange) {
      case '7d':
        sliceCount = 7;
        break;
      case '15d':
        sliceCount = 15;
        break;
      case '30d':
        sliceCount = 30;
        break;
      case 'all':
      default:
        sliceCount = list.length;
        break;
    }
    return list.slice(0, sliceCount).reverse();
  }

  get trendStats(): TrendStatsSummary | null {
    const entries = this.trendFilteredEntries;
    if (entries.length === 0) return null;

    const config = this.currentMetricConfig;
    const lastEntry = entries[entries.length - 1];
    const lastVal = config.getValue(lastEntry);

    let prevVal: number | null = null;
    if (entries.length >= 2) {
      prevVal = config.getValue(entries[entries.length - 2]);
    }

    let deltaPct = 0;
    if (prevVal !== null && prevVal !== 0) {
      deltaPct = Math.round(((lastVal - prevVal) / Math.abs(prevVal)) * 1000) / 10;
    }

    let minVal = Infinity;
    let minDate = lastEntry.fecha;
    let maxVal = -Infinity;
    let maxDate = lastEntry.fecha;
    let sum = 0;

    for (const e of entries) {
      const v = config.getValue(e);
      if (v < minVal) {
        minVal = v;
        minDate = e.fecha;
      }
      if (v > maxVal) {
        maxVal = v;
        maxDate = e.fecha;
      }
      sum += v;
    }

    if (minVal === Infinity) minVal = 0;
    if (maxVal === -Infinity) maxVal = 0;

    const avgVal = sum / entries.length;

    return {
      formattedLast: this.formatMetricVal(lastVal, config.unit, config.decimals),
      lastDate: lastEntry.fecha,
      deltaPct,
      formattedAvg: this.formatMetricVal(avgVal, config.unit, config.decimals),
      formattedMax: this.formatMetricVal(maxVal, config.unit, config.decimals),
      maxDate,
      formattedMin: this.formatMetricVal(minVal, config.unit, config.decimals),
      minDate
    };
  }

  get trendYScaleBounds(): { scaleMin: number; scaleMax: number } {
    const entries = this.trendFilteredEntries;
    const config = this.currentMetricConfig;

    if (entries.length === 0) {
      return { scaleMin: 0, scaleMax: 10 };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const e of entries) {
      const v = config.getValue(e);
      if (v < min) min = v;
      if (v > max) max = v;

      if (this.showSecondaryCurve && config.getSecondaryValue) {
        const sv = config.getSecondaryValue(e);
        if (sv < min) min = sv;
        if (sv > max) max = sv;
      }
    }

    if (config.thresholdVal !== undefined && config.thresholdVal !== null) {
      if (config.thresholdVal < min) min = config.thresholdVal;
      if (config.thresholdVal > max) max = config.thresholdVal;
    }

    if (min === Infinity || max === -Infinity) {
      return { scaleMin: 0, scaleMax: 10 };
    }

    let pad = (max - min) * 0.15;
    if (pad === 0) {
      pad = max !== 0 ? Math.abs(max * 0.15) : 1;
    }

    const scaleMin = min >= 0 ? Math.max(0, min - pad) : min - pad;
    const scaleMax = max + pad;

    return { scaleMin, scaleMax };
  }

  get trendGridY(): { y: number; val: number; formatted: string }[] {
    const { scaleMin, scaleMax } = this.trendYScaleBounds;
    const range = scaleMax - scaleMin || 1;
    const config = this.currentMetricConfig;
    const minY = 35;
    const maxY = 205;
    const steps = 4;
    const lines: { y: number; val: number; formatted: string }[] = [];

    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const y = Math.round(maxY - ratio * (maxY - minY));
      const val = scaleMin + ratio * range;
      lines.push({
        y,
        val,
        formatted: this.formatMetricAxisVal(val, config.unit, config.decimals)
      });
    }

    return lines;
  }

  get trendThresholdY(): number | null {
    const config = this.currentMetricConfig;
    if (config.thresholdVal === undefined || config.thresholdVal === null) return null;

    const { scaleMin, scaleMax } = this.trendYScaleBounds;
    if (config.thresholdVal < scaleMin || config.thresholdVal > scaleMax) return null;

    const range = scaleMax - scaleMin || 1;
    const minY = 35;
    const maxY = 205;
    const norm = (config.thresholdVal - scaleMin) / range;
    return Math.round(maxY - norm * (maxY - minY));
  }

  get trendPrimaryPoints(): TrendDataPoint[] {
    const entries = this.trendFilteredEntries;
    if (entries.length === 0) return [];

    const { scaleMin, scaleMax } = this.trendYScaleBounds;
    const range = scaleMax - scaleMin || 1;
    const config = this.currentMetricConfig;
    const minX = 75;
    const maxX = 760;
    const minY = 35;
    const maxY = 205;
    const step = entries.length > 1 ? (maxX - minX) / (entries.length - 1) : 0;

    return entries.map((e, idx) => {
      const x = entries.length === 1 ? (minX + maxX) / 2 : minX + idx * step;
      const val = config.getValue(e);
      const norm = (val - scaleMin) / range;
      const clampedNorm = Math.max(0, Math.min(1, norm));
      const y = maxY - clampedNorm * (maxY - minY);

      return {
        x: Math.round(x),
        y: Math.round(y),
        fecha: e.fecha,
        val,
        formattedVal: this.formatMetricVal(val, config.unit, config.decimals),
        displayVal: this.formatMetricPointVal(val, config.unit, config.decimals)
      };
    });
  }

  get trendSecondaryPoints(): { x: number; y: number; val: number }[] {
    const entries = this.trendFilteredEntries;
    const config = this.currentMetricConfig;
    if (!this.showSecondaryCurve || !config.getSecondaryValue || entries.length === 0) return [];

    const { scaleMin, scaleMax } = this.trendYScaleBounds;
    const range = scaleMax - scaleMin || 1;
    const minX = 75;
    const maxX = 760;
    const minY = 35;
    const maxY = 205;
    const step = entries.length > 1 ? (maxX - minX) / (entries.length - 1) : 0;

    return entries.map((e, idx) => {
      const x = entries.length === 1 ? (minX + maxX) / 2 : minX + idx * step;
      const val = config.getSecondaryValue!(e);
      const norm = (val - scaleMin) / range;
      const clampedNorm = Math.max(0, Math.min(1, norm));
      const y = maxY - clampedNorm * (maxY - minY);

      return {
        x: Math.round(x),
        y: Math.round(y),
        val
      };
    });
  }

  get trendPrimaryLinePath(): string {
    return this.trendPrimaryPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  get trendPrimaryAreaPath(): string {
    const pts = this.trendPrimaryPoints;
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${first.x},210 ` + pts.map(p => `${p.x},${p.y}`).join(' ') + ` ${last.x},210`;
  }

  get trendSecondaryLinePath(): string {
    return this.trendSecondaryPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  formatMetricVal(val: number, unit: string, decimals: number = 2): string {
    if (val === undefined || val === null || isNaN(val)) return `0 ${unit}`;
    const formatted = decimals > 0
      ? val.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.round(val).toLocaleString('es-PE');
    return `${formatted} ${unit}`;
  }

  formatMetricPointVal(val: number, unit: string, decimals: number = 2): string {
    if (val === undefined || val === null || isNaN(val)) return '0';
    if (Math.abs(val) >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 10000) {
      return `${(val / 1000).toFixed(0)}k`;
    }
    if (decimals > 0) {
      return val.toFixed(decimals);
    }
    return Math.round(val).toString();
  }

  formatMetricAxisVal(val: number, unit: string, decimals: number = 0): string {
    if (Math.abs(val) >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M ${unit}`;
    }
    if (Math.abs(val) >= 10000) {
      return `${(val / 1000).toFixed(0)}k ${unit}`;
    }
    if (decimals > 0) {
      return `${val.toFixed(decimals)} ${unit}`;
    }
    return `${Math.round(val)} ${unit}`;
  }

  // --- Interactive Dam Cross-Section & Reservoir Profile State ---
  damViewMode: 'operational' | 'geotechnical' = 'operational';
  activeDamPart: 'corona' | 'embalse' | 'borde_libre' | 'playa' | 'talud' | 'torre5' | 'dren' | null = null;

  get damWaterY(): number {
    const entry = this.masterService.activeEntry();
    const fb = entry ? entry.bordeLibreM : 4.0;
    const clamped = Math.max(0.5, Math.min(6.5, fb));
    // Crest elevation is at y=80.
    // Safe freeboard ~4.0m -> y = 160.
    // GISTM minimum threshold 2.0m -> y = 120.
    // Critical hazard <2.0m -> y < 120.
    return Math.round(80 + clamped * 20);
  }

  get damGistmThresholdY(): number {
    // 2.0m below crest (80 + 2.0*20 = 120)
    return 120;
  }

  get damBeachWaterX(): number {
    const wy = this.damWaterY;
    // As water level drops (wy > 160), beach extends to the right (x increases).
    // As water level rises (wy < 160), beach is submerged (x decreases towards 480).
    return Math.round(540 + (wy - 160) * 1.5);
  }

  get damWaterPolygonPoints(): string {
    const bx = this.damBeachWaterX;
    const wy = this.damWaterY;
    return `${bx},${wy} 910,${wy} 910,265 ${bx},240`;
  }

  get damSludgePolygonPoints(): string {
    const bx = this.damBeachWaterX;
    return `${bx},240 910,265 910,280 440,280`;
  }

  get damIsFreeboardCritical(): boolean {
    const entry = this.masterService.activeEntry();
    return !!entry && entry.bordeLibreM < 2.0;
  }

  get damIsFreeboardWarning(): boolean {
    const entry = this.masterService.activeEntry();
    return !!entry && entry.bordeLibreM >= 2.0 && entry.bordeLibreM < 4.0;
  }

  get damFreeboardStatusText(): string {
    const entry = this.masterService.activeEntry();
    if (!entry) return 'Sin Datos';
    if (entry.bordeLibreM >= 4.0) return 'Operación Segura (> 4.0 m)';
    if (entry.bordeLibreM >= 2.0) return 'Alerta Operativa (2.0 - 4.0 m)';
    return '¡Alerta Crítica GISTM (< 2.0 m)!';
  }

  get damActivePartDetails(): { title: string; value: string; note: string; statusClass?: string } | null {
    const entry = this.masterService.activeEntry();
    if (!entry || !this.activeDamPart) return null;
    switch (this.activeDamPart) {
      case 'corona':
        return {
          title: 'Corona del Dique (Cresta)',
          value: `${entry.cotaCoronaMsnm.toFixed(2)} msnm`,
          note: `Nivel estructural superior de coronamiento. Crecimiento diario de presa: +${entry.crecimientoPresaM.toFixed(2)} m/día.`
        };
      case 'embalse':
        return {
          title: 'Espejo de Agua / Laguna de Relaves',
          value: `${entry.cotaEmbalseMsnm.toFixed(2)} msnm`,
          note: `Nivel de espejo libre de agua en vaso. Almacenamiento real acumulado: ${entry.volAguaRealAcumuladoM3.toLocaleString()} m³.`
        };
      case 'borde_libre':
        const isCrit = entry.bordeLibreM < 2.0;
        const isWarn = entry.bordeLibreM >= 2.0 && entry.bordeLibreM < 4.0;
        return {
          title: 'Borde Libre Operacional (Freeboard)',
          value: `${entry.bordeLibreM.toFixed(2)} m`,
          note: isCrit
            ? '¡PELIGRO CRÍTICO! Revancha menor a 2.00 m según estándar global de relaves GISTM.'
            : isWarn
            ? 'Alerta preventiva: Revancha ajustada (2.0 a 4.0 m). Monitorear recirculación de Torre 5.'
            : 'Margen seguro de operación (> 4.00 m) conforme a diseño y cota máxima permisible.',
          statusClass: isCrit ? 'critical' : isWarn ? 'warning' : 'safe'
        };
      case 'playa':
        return {
          title: 'Playa de Relaves (Tailings Beach)',
          value: `${entry.longitudPlayaM} m de longitud`,
          note: `Distancia entre la corona del dique y el borde del agua para disipación de energía, desborde hidráulico y segregación de arenas.`
        };
      case 'talud':
        return {
          title: 'Talud de Aguas Abajo (Downstream Slope)',
          value: `Compactación Proctor: ${entry.compactacionPct}%`,
          note: `Cuerpo resistente peraltado con arenas compactadas (${entry.arenasProdTopografiaM3.toLocaleString()} m³), bermas intermedias y enrocado riprap.`
        };
      case 'torre5':
        return {
          title: 'Torre 5 de Captación (Decant Tower)',
          value: `${entry.torre5VolDiaM3.toLocaleString()} m³/día`,
          note: `Extracción y recirculación continua de agua clarificada hacia la Planta Concentradora (Acumulado: ${(entry.torre5VolAcumuladoM3 / 1000000).toFixed(2)} M m³).`
        };
      case 'dren':
        return {
          title: 'Sistema de Drenaje Basal & Subdrenaje',
          value: `${entry.filtracionesTotalLs} L/s (${entry.filtracionesTotalM3Dia} m³/día)`,
          note: `Red de control piezométrico y colchón drenante para abatir la línea freática en el cuerpo del dique.`
        };
      default:
        return null;
    }
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
