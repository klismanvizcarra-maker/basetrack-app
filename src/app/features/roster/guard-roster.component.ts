import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  GuardCode,
  GuardInfo,
  DayRoster,
  MonthRoster,
  GUARDS_CATALOG,
  updateGuardsCatalog,
  getRosterForDate,
  getMonthRoster,
  getCurrentActiveShift
} from '../../shared/utils/roster.util';
import { PdfExportService } from '../../core/services/pdf-export.service';
import { AuthService } from '../../core/auth/auth.service';
import { CrewService } from '../../core/services/crew.service';

@Component({
  selector: 'app-guard-roster',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="roster-page-container animate-fade-in">
      
      <!-- TOP HERO BANNER -->
      <div class="hero-banner glass-panel">
        <div class="hero-main">
          <div class="hero-title-group">
            <div class="icon-chip">📅</div>
            <div>
              <div class="badge-regime">Régimen Minero Continuo 8x8</div>
              <h2>Rol de Guardias & Roster Operacional</h2>
              <p class="hero-subtitle">
                Rotación 24/7: <strong>4 Días de Turno Día</strong> (07:00–19:00) ➔ <strong>4 Noches de Turno Noche</strong> (19:00–07:00) ➔ <strong>8 Días de Descanso / Bajada</strong>.
              </p>
            </div>
          </div>
          <div class="hero-actions">
            <button 
              type="button" 
              class="btn-export-pdf" 
              (click)="exportRosterPdf()" 
              [disabled]="isExportingPdf"
              title="Descargar Rol Oficial del Mes en Formato PDF A4"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <span>{{ isExportingPdf ? 'Generando PDF...' : 'Imprimir Rol PDF (A4)' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- LIVE TODAY STATUS CARD (ESTADO OPERACIONAL EN TIEMPO REAL) -->
      <div class="today-status-card glass-panel" *ngIf="todayRoster">
        <div class="today-header">
          <div class="today-date-badge">
            <span class="live-pulse"></span>
            <strong>HOY: {{ todayRoster.dayName }}, {{ todayRoster.dayNumber }} de {{ currentMonthName }} de {{ selectedYear }}</strong>
            <span class="block-tag">Bloque {{ todayRoster.blockNumber }} (Día {{ todayRoster.dayInBlock }} de 4)</span>
          </div>
          <div class="current-shift-indicator" [class.day-time]="activeShift.shiftName === 'DIA'" [class.night-time]="activeShift.shiftName === 'NOCHE'">
            <span *ngIf="activeShift.shiftName === 'DIA'">☀️ TURNO EN CURSO: DÍA (07:00 – 19:00)</span>
            <span *ngIf="activeShift.shiftName === 'NOCHE'">🌙 TURNO EN CURSO: NOCHE (19:00 – 07:00)</span>
          </div>
        </div>

        <div class="today-guards-grid">
          <!-- Turno Día -->
          <div class="shift-box day-box" [class.highlight-now]="activeShift.shiftName === 'DIA'">
            <div class="shift-label-row">
              <span class="shift-icon">☀️</span>
              <span class="shift-title">TURNO DÍA (07:00 – 19:00)</span>
              <span class="now-badge" *ngIf="activeShift.shiftName === 'DIA'">EN PLANTA AHORA</span>
            </div>
            <div class="guard-pill" [style.border-left-color]="todayRoster.dayShiftGuard.colorHex">
              <img [src]="todayRoster.dayShiftGuard.avatarUrl" class="guard-avatar" />
              <div class="guard-details">
                <div class="guard-name-row">
                  <span class="guard-badge" [style.background-color]="todayRoster.dayShiftGuard.colorHex">
                    {{ todayRoster.dayShiftGuard.name }}
                  </span>
                  <span class="stage-badge">Día {{ todayRoster.guardStatus[todayRoster.dayShiftGuard.code].dayInStage }}/4</span>
                </div>
                <strong class="sup-fullname">{{ todayRoster.dayShiftGuard.supervisorName }}</strong>
                <span class="sup-sub">Supervisor a cargo • {{ getOperatorCount(todayRoster.dayShiftGuard.code) }} Operadores en planta</span>
              </div>
            </div>
          </div>

          <!-- Turno Noche -->
          <div class="shift-box night-box" [class.highlight-now]="activeShift.shiftName === 'NOCHE'">
            <div class="shift-label-row">
              <span class="shift-icon">🌙</span>
              <span class="shift-title">TURNO NOCHE (19:00 – 07:00)</span>
              <span class="now-badge" *ngIf="activeShift.shiftName === 'NOCHE'">EN PLANTA AHORA</span>
            </div>
            <div class="guard-pill" [style.border-left-color]="todayRoster.nightShiftGuard.colorHex">
              <img [src]="todayRoster.nightShiftGuard.avatarUrl" class="guard-avatar" />
              <div class="guard-details">
                <div class="guard-name-row">
                  <span class="guard-badge" [style.background-color]="todayRoster.nightShiftGuard.colorHex">
                    {{ todayRoster.nightShiftGuard.name }}
                  </span>
                  <span class="stage-badge">Noche {{ todayRoster.guardStatus[todayRoster.nightShiftGuard.code].dayInStage }}/4</span>
                </div>
                <strong class="sup-fullname">{{ todayRoster.nightShiftGuard.supervisorName }}</strong>
                <span class="sup-sub">Supervisor a cargo • {{ getOperatorCount(todayRoster.nightShiftGuard.code) }} Operadores en planta</span>
              </div>
            </div>
          </div>

          <!-- En Descanso / Bajada -->
          <div class="shift-box off-box">
            <div class="shift-label-row">
              <span class="shift-icon">🏖️</span>
              <span class="shift-title">EN DESCANSO / BAJADA (2 GUARDÍAS)</span>
            </div>
            <div class="off-guards-list">
              <div *ngFor="let og of todayRoster.offGuards" class="off-guard-item">
                <div class="off-head">
                  <span class="guard-badge-sm" [style.background-color]="og.colorHex">{{ og.name }}</span>
                  <span class="off-stage-text">Bajada {{ todayRoster.guardStatus[og.code].dayInStage }}/8</span>
                </div>
                <div class="off-sup-name">{{ og.supervisorName }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CALENDAR CONTROLS & FILTER BAR -->
      <div class="calendar-toolbar glass-panel">
        <!-- Month Navigation -->
        <div class="month-nav-controls">
          <button type="button" class="btn-nav-month" (click)="prevMonth()" title="Mes anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div class="current-month-display">
            <h3>{{ monthRoster.monthName }} {{ selectedYear }}</h3>
          </div>
          <button type="button" class="btn-nav-month" (click)="nextMonth()" title="Mes siguiente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button type="button" class="btn-today-quick" (click)="goToCurrentMonth()">
            Ir a Hoy
          </button>
        </div>

        <!-- Guard Filter Tabs -->
        <div class="guard-filter-tabs">
          <button 
            type="button" 
            class="filter-tab-btn" 
            [class.active]="selectedGuardFilter === 'ALL'" 
            (click)="selectedGuardFilter = 'ALL'"
          >
            🏢 Todas las Guardias
          </button>
          <button 
            type="button" 
            class="filter-tab-btn" 
            [class.active]="selectedGuardFilter === 'G1'" 
            (click)="selectedGuardFilter = 'G1'"
          >
            <span class="dot-indicator" [style.background-color]="guardsCatalog['G1'].colorHex"></span>
            G1 ({{ getShortSupervisorName('G1') }})
          </button>
          <button 
            type="button" 
            class="filter-tab-btn" 
            [class.active]="selectedGuardFilter === 'G2'" 
            (click)="selectedGuardFilter = 'G2'"
          >
            <span class="dot-indicator" [style.background-color]="guardsCatalog['G2'].colorHex"></span>
            G2 ({{ getShortSupervisorName('G2') }})
          </button>
          <button 
            type="button" 
            class="filter-tab-btn" 
            [class.active]="selectedGuardFilter === 'G3'" 
            (click)="selectedGuardFilter = 'G3'"
          >
            <span class="dot-indicator" [style.background-color]="guardsCatalog['G3'].colorHex"></span>
            G3 ({{ getShortSupervisorName('G3') }})
          </button>
          <button 
            type="button" 
            class="filter-tab-btn" 
            [class.active]="selectedGuardFilter === 'G4'" 
            (click)="selectedGuardFilter = 'G4'"
          >
            <span class="dot-indicator" [style.background-color]="guardsCatalog['G4'].colorHex"></span>
            G4 ({{ getShortSupervisorName('G4') }})
          </button>
        </div>
      </div>

      <!-- MONTH CALENDAR GRID (MATRIZ INTERACTIVA) -->
      <div class="calendar-grid-container glass-panel">
        <div class="weekdays-header">
          <div class="weekday-col">Lunes</div>
          <div class="weekday-col">Martes</div>
          <div class="weekday-col">Miércoles</div>
          <div class="weekday-col">Jueves</div>
          <div class="weekday-col">Viernes</div>
          <div class="weekday-col">Sábado</div>
          <div class="weekday-col">Domingo</div>
        </div>

        <div class="calendar-days-grid">
          <!-- Espaciadores para los días previos al día 1 del mes -->
          <div 
            *ngFor="let empty of emptyLeadingDays" 
            class="calendar-day-cell empty-cell"
          ></div>

          <!-- Celdas de cada día del mes -->
          <div 
            *ngFor="let day of monthRoster.days" 
            class="calendar-day-cell"
            [class.is-today]="day.isToday"
            [class.is-weekend]="day.dayOfWeek === 0 || day.dayOfWeek === 6"
          >
            <!-- Day Header -->
            <div class="cell-head">
              <span class="day-num" [class.today-badge]="day.isToday">{{ day.dayNumber }}</span>
              <span class="today-tag" *ngIf="day.isToday">HOY</span>
              <span class="block-mini-label">B{{ day.blockNumber }}</span>
            </div>

            <!-- MODO 1: VISTA GENERAL (TODAS LAS GUARDIAS) -->
            <div class="cell-content-all" *ngIf="selectedGuardFilter === 'ALL'">
              <!-- Turno Día -->
              <div 
                class="shift-tag-row tag-day" 
                [style.border-left-color]="day.dayShiftGuard.colorHex"
                title="Turno Día: {{ day.dayShiftGuard.name }} ({{ day.dayShiftGuard.supervisorName }})"
              >
                <span class="tag-icon">☀️</span>
                <span class="tag-guard-code" [style.color]="day.dayShiftGuard.colorHex">{{ day.dayShiftGuard.name }}</span>
                <span class="tag-count">D{{ day.guardStatus[day.dayShiftGuard.code].dayInStage }}/4</span>
              </div>

              <!-- Turno Noche -->
              <div 
                class="shift-tag-row tag-night" 
                [style.border-left-color]="day.nightShiftGuard.colorHex"
                title="Turno Noche: {{ day.nightShiftGuard.name }} ({{ day.nightShiftGuard.supervisorName }})"
              >
                <span class="tag-icon">🌙</span>
                <span class="tag-guard-code" [style.color]="day.nightShiftGuard.colorHex">{{ day.nightShiftGuard.name }}</span>
                <span class="tag-count">N{{ day.guardStatus[day.nightShiftGuard.code].dayInStage }}/4</span>
              </div>

              <!-- Descanso -->
              <div class="shift-tag-row tag-off" title="En Descanso: {{ day.offGuards[0].name }} y {{ day.offGuards[1].name }}">
                <span class="tag-icon">🏖️</span>
                <span class="tag-off-names">{{ day.offGuards[0].code }}, {{ day.offGuards[1].code }}</span>
              </div>
            </div>

            <!-- MODO 2: VISTA FILTRADA POR UNA GUARDIA ESPECÍFICA -->
            <div class="cell-content-focused" *ngIf="selectedGuardFilter !== 'ALL'">
              <ng-container *ngIf="day.guardStatus[selectedGuardFilter] as gs">
                <!-- Status Box Individual -->
                <div 
                  class="focused-status-box" 
                  [class.box-dia]="gs.shift === 'DIA'"
                  [class.box-noche]="gs.shift === 'NOCHE'"
                  [class.box-descanso]="gs.shift === 'DESCANSO'"
                >
                  <div class="status-top">
                    <span class="status-icon" *ngIf="gs.shift === 'DIA'">☀️</span>
                    <span class="status-icon" *ngIf="gs.shift === 'NOCHE'">🌙</span>
                    <span class="status-icon" *ngIf="gs.shift === 'DESCANSO'">🏖️</span>
                    <strong class="status-text">{{ gs.shift }}</strong>
                  </div>
                  <div class="status-sub">
                    <span *ngIf="gs.shift === 'DIA'">Día {{ gs.dayInStage }} de 4</span>
                    <span *ngIf="gs.shift === 'NOCHE'">Noche {{ gs.dayInStage }} de 4</span>
                    <span *ngIf="gs.shift === 'DESCANSO'">Bajada {{ gs.dayInStage }} de 8</span>
                  </div>
                </div>
              </ng-container>
            </div>
          </div>
        </div>
      </div>

      <!-- CYCLE GUIDE CARD (INFOGRAFÍA DEL CICLO 8x8) -->
      <div class="cycle-guide-card glass-panel">
        <div class="guide-header">
          <h4>💡 Guía Operacional del Ciclo Rotativo (16 Días = 4 Bloques de 4 Días)</h4>
        </div>
        <div class="blocks-explanation-grid">
          <div class="block-card" [class.active-block]="todayRoster?.blockNumber === 1">
            <div class="block-card-head">
              <strong>Bloque 1</strong>
              <span class="days-span">4 Días</span>
            </div>
            <div class="block-row">☀️ <strong>Día:</strong> Guardia 1 ({{ getShortSupervisorName('G1') }})</div>
            <div class="block-row">🌙 <strong>Noche:</strong> Guardia 3 ({{ getShortSupervisorName('G3') }})</div>
            <div class="block-row text-muted">🏖️ <strong>Descanso:</strong> G2, G4</div>
          </div>

          <div class="block-card" [class.active-block]="todayRoster?.blockNumber === 2">
            <div class="block-card-head">
              <strong>Bloque 2</strong>
              <span class="days-span">4 Días</span>
            </div>
            <div class="block-row">☀️ <strong>Día:</strong> Guardia 2 ({{ getShortSupervisorName('G2') }})</div>
            <div class="block-row">🌙 <strong>Noche:</strong> Guardia 1 ({{ getShortSupervisorName('G1') }})</div>
            <div class="block-row text-muted">🏖️ <strong>Descanso:</strong> G3, G4</div>
          </div>

          <div class="block-card" [class.active-block]="todayRoster?.blockNumber === 3">
            <div class="block-card-head">
              <strong>Bloque 3</strong>
              <span class="days-span">4 Días</span>
              <span class="anchor-flag" *ngIf="todayRoster?.blockNumber === 3">BLOQUE ACTUAL</span>
            </div>
            <div class="block-row">☀️ <strong>Día:</strong> Guardia 4 ({{ getShortSupervisorName('G4') }})</div>
            <div class="block-row">🌙 <strong>Noche:</strong> Guardia 2 ({{ getShortSupervisorName('G2') }})</div>
            <div class="block-row text-muted">🏖️ <strong>Descanso:</strong> G1, G3</div>
          </div>

          <div class="block-card" [class.active-block]="todayRoster?.blockNumber === 4">
            <div class="block-card-head">
              <strong>Bloque 4</strong>
              <span class="days-span">4 Días</span>
            </div>
            <div class="block-row">☀️ <strong>Día:</strong> Guardia 3 ({{ getShortSupervisorName('G3') }})</div>
            <div class="block-row">🌙 <strong>Noche:</strong> Guardia 4 ({{ getShortSupervisorName('G4') }})</div>
            <div class="block-row text-muted">🏖️ <strong>Descanso:</strong> G1, G2</div>
          </div>
        </div>
      </div>

      <!-- PRINTABLE A4 ROSTER (CONTENEDOR OCULTO PARA EXPORTACIÓN EN PDF) -->
      <div id="printable-roster-a4" class="printable-roster-hidden">
        <div class="print-header">
          <div class="print-brand-row">
            <div>
              <h1 class="print-company-title">BASETRACK APP • OPERACIONES DE PLANTA</h1>
              <p class="print-company-sub">SISTEMA INTEGRADO DE CONTROL OPERACIONAL Y RELAVES</p>
            </div>
            <div class="print-meta-box">
              <div><strong>DOCUMENTO:</strong> ROL OFICIAL DE GUARDIAS</div>
              <div><strong>RÉGIMEN:</strong> 8x8 CONTINUO (12 HORAS)</div>
              <div><strong>PERIODO:</strong> {{ monthRoster.monthName | uppercase }} {{ selectedYear }}</div>
            </div>
          </div>
        </div>

        <table class="print-calendar-table">
          <thead>
            <tr>
              <th style="width: 7%;">DÍA</th>
              <th style="width: 13%;">FECHA</th>
              <th style="width: 25%;">☀️ TURNO DÍA (07:00 - 19:00)</th>
              <th style="width: 25%;">🌙 TURNO NOCHE (19:00 - 07:00)</th>
              <th style="width: 30%;">🏖️ EN DESCANSO / BAJADA</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let day of monthRoster.days" [class.print-weekend]="day.dayOfWeek === 0 || day.dayOfWeek === 6">
              <td class="text-center font-bold">{{ day.dayNumber }}</td>
              <td>{{ day.dayName }}</td>
              <td>
                <span class="print-badge print-day">{{ day.dayShiftGuard.name }}</span>
                <span class="print-sup">{{ day.dayShiftGuard.supervisorName }}</span>
              </td>
              <td>
                <span class="print-badge print-night">{{ day.nightShiftGuard.name }}</span>
                <span class="print-sup">{{ day.nightShiftGuard.supervisorName }}</span>
              </td>
              <td>
                <span class="print-off-guard">{{ day.offGuards[0].name }} ({{ getShortSupervisorName(day.offGuards[0].code) }})</span> y 
                <span class="print-off-guard">{{ day.offGuards[1].name }} ({{ getShortSupervisorName(day.offGuards[1].code) }})</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="print-signatures-row">
          <div class="sig-block">
            <div class="sig-line"></div>
            <strong>JEFE DE GUARDIA / TURNO</strong>
            <span>Operaciones Planta Concentradora</span>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <strong>SUPERINTENDENTE DE PLANTA</strong>
            <span>Gerencia de Operaciones Mina</span>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <strong>RECURSOS HUMANOS / CONTROL</strong>
            <span>Acreditación y Transporte de Personal</span>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .roster-page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
      max-width: 1440px;
      margin: 0 auto;
      width: 100%;
      box-sizing: border-box;
    }

    .glass-panel {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
      padding: 20px 24px;
    }

    /* Hero Banner */
    .hero-banner {
      background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
      border-left: 5px solid #031795;
    }

    .hero-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .hero-title-group {
      display: flex;
      align-items: center;
      gap: 16px;

      .icon-chip {
        font-size: 2rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      h2 {
        margin: 4px 0;
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
      }

      .badge-regime {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 800;
        color: #1d4ed8;
        background: #dbeafe;
        padding: 3px 8px;
        border-radius: 6px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .hero-subtitle {
        margin: 0;
        font-size: 0.86rem;
        color: #64748b;
        line-height: 1.4;
      }
    }

    .btn-export-pdf {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background: #031795;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(3, 23, 149, 0.2);

      &:hover:not(:disabled) {
        background: #02106e;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(3, 23, 149, 0.28);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    /* Today Status Card */
    .today-status-card {
      border: 1px solid var(--border-subtle);
      background: var(--bg-card);
      box-shadow: var(--shadow-card);
    }

    .today-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .today-date-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.95rem;
      color: var(--text-primary);

      .live-pulse {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.25);
        animation: pulseAnimation 2s infinite;
      }

      .block-tag {
        font-size: 0.75rem;
        background: var(--bg-card-subtle);
        color: var(--text-secondary);
        border: 1px solid var(--border-subtle);
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
      }
    }

    @keyframes pulseAnimation {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
      70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .current-shift-indicator {
      font-size: 0.78rem;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 20px;
      letter-spacing: 0.03em;

      &.day-time {
        background: var(--warning-bg, #fef3c7);
        color: var(--warning, #92400e);
        border: 1px solid rgba(245, 158, 11, 0.35);
      }

      &.night-time {
        background: rgba(139, 92, 246, 0.16);
        color: #a78bfa;
        border: 1px solid rgba(139, 92, 246, 0.35);
      }
    }

    .today-guards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .shift-box {
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 14px 16px;
      background: var(--bg-card-subtle);
      transition: all 0.2s ease;

      &.highlight-now {
        border-color: var(--primary-purple);
        box-shadow: 0 0 0 3px var(--primary-glow);
      }
    }

    .shift-label-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;

      .shift-title {
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: var(--text-secondary);
      }

      .now-badge {
        margin-left: auto;
        font-size: 0.65rem;
        font-weight: 800;
        background: #10b981;
        color: #ffffff;
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .guard-pill {
      display: flex;
      align-items: center;
      gap: 12px;
      border-left: 4px solid var(--primary-purple);
      padding-left: 10px;
    }

    .guard-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid var(--border-subtle);
      object-fit: cover;
    }

    .guard-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .guard-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .guard-badge {
      font-size: 0.72rem;
      font-weight: 800;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .stage-badge {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--primary-lavender);
      background: var(--primary-bg-subtle);
      border: 1px solid var(--primary-border);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .sup-fullname {
      font-size: 0.86rem;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .sup-sub {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .off-guards-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .off-guard-item {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 8px 10px;
    }

    .off-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }

    .guard-badge-sm {
      font-size: 0.68rem;
      font-weight: 800;
      color: #ffffff;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .off-stage-text {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--warning, #b45309);
      background: var(--warning-bg, #fef3c7);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .off-sup-name {
      font-size: 0.76rem;
      color: var(--text-secondary);
      font-weight: 600;
    }

    /* Toolbar & Navigation */
    .calendar-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 14px 20px;
    }

    .month-nav-controls {
      display: flex;
      align-items: center;
      gap: 10px;

      h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary);
        min-width: 190px;
        text-align: center;
      }
    }

    .btn-nav-month {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }
    }

    .btn-today-quick {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--primary-purple);
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: var(--primary-bg-subtle);
        border-color: var(--primary-purple);
      }
    }

    .guard-filter-tabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .filter-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;

      .dot-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      &:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }

      &.active {
        background: var(--primary-purple);
        border-color: var(--primary-purple);
        color: #ffffff;
      }
    }

    /* Calendar Grid */
    .calendar-grid-container {
      padding: 16px;
    }

    .weekdays-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }

    .weekday-col {
      text-align: center;
      font-size: 0.78rem;
      font-weight: 800;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 8px 0;
    }

    .calendar-days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
    }

    .calendar-day-cell {
      min-height: 110px;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 8px;
      background: var(--bg-card);
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.15s ease;

      &.is-today {
        border: 2px solid var(--primary-purple);
        box-shadow: 0 0 0 3px var(--primary-glow);
        background: var(--primary-bg-subtle);
      }

      &.is-weekend {
        background: var(--bg-card-subtle);
      }

      &.empty-cell {
        background: transparent;
        border: 1px dashed var(--border-subtle);
      }
    }

    .cell-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .day-num {
      font-size: 0.88rem;
      font-weight: 800;
      color: var(--text-primary);

      &.today-badge {
        color: var(--primary-purple);
        font-size: 0.95rem;
      }
    }

    .today-tag {
      font-size: 0.62rem;
      font-weight: 800;
      color: #ffffff;
      background: var(--primary-purple);
      padding: 1px 5px;
      border-radius: 4px;
    }

    .block-mini-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    /* Shift Tag Rows */
    .cell-content-all {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .shift-tag-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 0.68rem;
      border-left: 3px solid transparent;

      &.tag-day {
        background: var(--primary-bg-subtle);
        color: var(--text-primary);
      }

      &.tag-night {
        background: rgba(139, 92, 246, 0.18);
        color: #c4b5fd;
      }

      &.tag-off {
        background: var(--bg-card-subtle);
        color: var(--text-muted);
      }

      .tag-guard-code {
        font-weight: 800;
      }

      .tag-count {
        font-size: 0.64rem;
        color: var(--text-muted);
        margin-left: auto;
      }

      .tag-off-names {
        font-size: 0.65rem;
        font-weight: 600;
      }
    }

    /* Focused Guard Status Box */
    .cell-content-focused {
      flex: 1;
      display: flex;
      align-items: stretch;
    }

    .focused-status-box {
      width: 100%;
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      gap: 4px;

      &.box-dia {
        background: var(--primary-bg-subtle);
        border: 1px solid var(--primary-border);
        color: var(--primary-lavender);
      }

      &.box-noche {
        background: rgba(139, 92, 246, 0.16);
        border: 1px solid rgba(139, 92, 246, 0.35);
        color: #c4b5fd;
      }

      &.box-descanso {
        background: var(--bg-card-subtle);
        border: 1px dashed var(--border-subtle);
        color: var(--text-muted);
      }

      .status-top {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8rem;
      }

      .status-sub {
        font-size: 0.68rem;
        font-weight: 700;
        opacity: 0.85;
      }
    }

    /* Cycle Guide */
    .cycle-guide-card {
      h4 {
        margin: 0 0 14px;
        font-size: 0.95rem;
        color: var(--text-primary);
      }
    }

    .blocks-explanation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .block-card {
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 12px 14px;
      background: var(--bg-card-subtle);

      &.active-block {
        border-color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        box-shadow: 0 2px 8px var(--primary-glow);
      }
    }

    .block-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      strong {
        font-size: 0.86rem;
        color: var(--text-primary);
      }

      .days-span {
        font-size: 0.7rem;
        background: var(--bg-card);
        color: var(--text-secondary);
        border: 1px solid var(--border-subtle);
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;
      }

      .anchor-flag {
        font-size: 0.62rem;
        font-weight: 800;
        color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        border: 1px solid var(--primary-border);
        padding: 1px 5px;
        border-radius: 4px;
      }
    }

    .block-row {
      font-size: 0.76rem;
      margin-bottom: 3px;
      color: var(--text-secondary);
    }

    /* PRINTABLE A4 STYLES (OCULTO EN PANTALLA) */
    .printable-roster-hidden {
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: 1000px;
      background: #ffffff;
      padding: 30px;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .print-header {
      border-bottom: 2px solid #031795;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .print-brand-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .print-company-title {
      font-size: 1.3rem;
      font-weight: 900;
      color: #031795;
      margin: 0;
    }

    .print-company-sub {
      font-size: 0.72rem;
      color: #475569;
      margin: 3px 0 0;
      font-weight: 700;
    }

    .print-meta-box {
      font-size: 0.75rem;
      text-align: right;
      color: #1e293b;
      line-height: 1.4;
    }

    .print-calendar-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 0.72rem;

      th {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        text-align: left;
        font-weight: 800;
        color: #0f172a;
      }

      td {
        border: 1px solid #e2e8f0;
        padding: 5px 8px;
        color: #1e293b;
      }

      .print-weekend {
        background: #fafafa;
      }
    }

    .print-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 3px;
      margin-right: 6px;

      &.print-day {
        background: #dbeafe;
        color: #1e40af;
      }

      &.print-night {
        background: #f3e8ff;
        color: #6b21a8;
      }
    }

    .print-sup {
      font-weight: 600;
      color: #0f172a;
    }

    .print-off-guard {
      font-weight: 600;
      color: #475569;
    }

    .print-signatures-row {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      margin-top: 40px;
      padding-top: 20px;

      .sig-block {
        flex: 1;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;

        .sig-line {
          width: 80%;
          border-top: 1px solid #475569;
          margin-bottom: 6px;
        }

        strong {
          font-size: 0.74rem;
          color: #0f172a;
        }

        span {
          font-size: 0.65rem;
          color: #64748b;
        }
      }
    }

    @media (max-width: 768px) {
      .roster-page-container {
        padding: 14px;
        gap: 14px;
      }

      .weekdays-header {
        display: none;
      }

      .calendar-days-grid {
        grid-template-columns: 1fr;
      }

      .calendar-day-cell {
        min-height: auto;
      }

      .empty-cell {
        display: none;
      }
    }
  `]
})
export class GuardRosterComponent implements OnInit {
  private pdfExportService = inject(PdfExportService);
  private crewService = inject(CrewService);
  authService = inject(AuthService);

  guardsCatalog = GUARDS_CATALOG;
  operatorCounts: Record<GuardCode, number> = { G1: 7, G2: 7, G3: 7, G4: 7 };

  // Selected date state
  selectedYear: number = 2026;
  selectedMonthIndex: number = 8; // 8 = Septiembre
  selectedGuardFilter: 'ALL' | GuardCode = 'ALL';

  monthRoster!: MonthRoster;
  todayRoster?: DayRoster;
  activeShift = getCurrentActiveShift();

  emptyLeadingDays: number[] = [];
  isExportingPdf = false;

  get currentMonthName(): string {
    return this.monthRoster ? this.monthRoster.monthName : 'Septiembre';
  }

  getOperatorCount(code: GuardCode): number {
    return this.operatorCounts[code] || 7;
  }

  getShortSupervisorName(code: GuardCode): string {
    const sup = this.guardsCatalog[code]?.supervisorName;
    if (!sup) return '';
    const parts = sup.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0];
    if (parts.length >= 3) {
      const firstName = parts[2];
      const lastName = parts[0];
      const capFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      const initialLast = lastName.charAt(0).toUpperCase();
      return `${capFirst} ${initialLast}.`;
    }
    const capFirst = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    return `${capFirst} ${parts[0].charAt(0).toUpperCase()}.`;
  }

  ngOnInit(): void {
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonthIndex = now.getMonth();
    this.loadRoster();
    this.refreshPersonnelFromService();
  }

  refreshPersonnelFromService(): void {
    this.crewService.loadCrew().subscribe({
      next: () => {
        const members = this.crewService.allMembers();
        if (members && members.length > 0) {
          const sups: Partial<Record<GuardCode, Partial<GuardInfo>>> = {};
          (['G1', 'G2', 'G3', 'G4'] as GuardCode[]).forEach(code => {
            const sup = members.find(m => m.shift_code === code && m.primary_role === 'SUPERVISOR');
            if (sup) {
              sups[code] = {
                supervisorName: sup.name,
                supervisorUser: sup.name,
                avatarUrl: sup.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${sup.name}`
              };
            }
            const count = members.filter(m => m.shift_code === code && m.primary_role !== 'SUPERVISOR').length;
            this.operatorCounts[code] = count > 0 ? count : 7;
          });
          if (Object.keys(sups).length > 0) {
            updateGuardsCatalog(sups);
          }
        }
        this.loadRoster();
      },
      error: () => {
        this.loadRoster();
      }
    });
  }

  loadRoster(): void {
    this.monthRoster = getMonthRoster(this.selectedYear, this.selectedMonthIndex);
    this.todayRoster = this.monthRoster.days.find(d => d.isToday) || getRosterForDate(new Date());
    this.activeShift = getCurrentActiveShift();

    // Calcular días vacíos para iniciar el calendario en el día correcto de la semana (Lunes = 0)
    if (this.monthRoster.days.length > 0) {
      const firstDayOfWeek = this.monthRoster.days[0].dayOfWeek; // 0=Dom, 1=Lun, ..., 6=Sáb
      // Convertir a base Lunes = 0, Domingo = 6
      const mondayBased = (firstDayOfWeek + 6) % 7;
      this.emptyLeadingDays = Array.from({ length: mondayBased }, (_, i) => i);
    } else {
      this.emptyLeadingDays = [];
    }
  }

  prevMonth(): void {
    if (this.selectedMonthIndex === 0) {
      this.selectedMonthIndex = 11;
      this.selectedYear--;
    } else {
      this.selectedMonthIndex--;
    }
    this.loadRoster();
  }

  nextMonth(): void {
    if (this.selectedMonthIndex === 11) {
      this.selectedMonthIndex = 0;
      this.selectedYear++;
    } else {
      this.selectedMonthIndex++;
    }
    this.loadRoster();
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonthIndex = now.getMonth();
    this.loadRoster();
  }

  async exportRosterPdf(): Promise<void> {
    if (this.isExportingPdf) return;
    this.isExportingPdf = true;

    try {
      const filename = `BASETRACK_Rol_Guardias_${this.monthRoster.monthName}_${this.selectedYear}.pdf`;
      await this.pdfExportService.exportToPdf('printable-roster-a4', filename);
    } catch (err) {
      console.error('[RosterComponent] Error exportando PDF:', err);
    } finally {
      this.isExportingPdf = false;
    }
  }
}
