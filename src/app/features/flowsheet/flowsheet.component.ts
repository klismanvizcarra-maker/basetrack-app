import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef, 
  inject, 
  signal, 
  computed,
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  NgZone 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { AuthService } from '../../core/auth/auth.service';
import { PlantParametersService } from '../../core/services/plant-parameters.service';
import { getRealtimeData } from '../../core/storage/local-store.util';

export interface FlowsheetHotspot {
  id: string;
  tag: string;
  title: string;
  category: 'PUMPS' | 'CYCLONES' | 'DAM' | 'FEED' | 'VALVE';
  cota: string;
  xPercent: number; // 0 to 100% of image width
  yPercent: number; // 0 to 100% of image height
  description: string;
  specs: { label: string; value: string }[];
  routeLink: string;
  routeLabel: string;
}

export interface ZoneFocus {
  id: string;
  name: string;
  icon: string;
  cota: string;
  xPercent: number;
  yPercent: number;
  zoom: number;
}

export interface SearchableTagItem {
  tag: string;
  name: string;
  category: 'BOMBA' | 'CICLÓN' | 'CAJÓN' | 'POZA' | 'PRESA' | 'CANALETA' | 'VÁLVULA' | 'SENSOR' | 'DREN' | 'BALANCE';
  cota?: string;
  xPercent: number;
  yPercent: number;
  zoom?: number;
  description: string;
  targetLink?: string;
  sheetId?: string;
  sheetNumber?: number;
}

export interface FlowsheetSheet {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  badge: string;
  imageSrc: string;
  downloadFileName: string;
  baseWidth: number;
  baseHeight: number;
  nativeResolution: string;
  description: string;
  zones: ZoneFocus[];
  equipmentCatalog: SearchableTagItem[];
  hotspots: FlowsheetHotspot[];
}

export interface MaintenanceTicketItem {
  id: string;
  equipment_tag: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

@Component({
  selector: 'app-flowsheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="flowsheet-page animate-fade-in" [class.is-fullscreen]="isFullscreen()">
      <!-- Top Title & Search Bar (Hidden in Fullscreen) -->
      <div class="page-top-bar no-print" *ngIf="!isFullscreen()">
        <div class="title-block">
          <div class="title-with-badge">
            <h2>Diagrama P&ID Presa Cortadera</h2>
            <span class="badge-official">SCADA Gemelo Digital</span>
          </div>
          <p class="section-sub">
            Telemetría en tiempo real, búsqueda de equipos, supervisión de bombeo y balances metalúrgicos
          </p>
        </div>

        <!-- Integrated TAG Search Box (Prioridad 2) -->
        <div class="search-tag-container">
          <div class="search-input-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              class="search-tag-input" 
              placeholder="Buscar TAG (ej. PU-021, CY-002, LN001, HV-031, Presa)..." 
              [(ngModel)]="searchQuery" 
              (input)="onSearchInput()"
              (focus)="isSearchFocused.set(true)"
              (keydown.escape)="clearSearch()"
            />
            <button *ngIf="searchQuery" type="button" class="search-clear-btn" (click)="clearSearch()">×</button>
          </div>

          <!-- Autocomplete Dropdown -->
          <div 
            class="search-dropdown animate-scale-up" 
            *ngIf="isSearchFocused() && filteredEquipment().length > 0"
            (mousedown)="$event.preventDefault()"
          >
            <div class="search-dropdown-header">
              <span>{{ filteredEquipment().length }} EQUIPOS ENCONTRADOS</span>
            </div>
            <div class="search-dropdown-list">
              <button 
                type="button" 
                *ngFor="let eq of filteredEquipment()" 
                class="search-result-item" 
                (click)="selectEquipment(eq)"
              >
                <div class="result-badge" [ngClass]="eq.category.toLowerCase()">{{ eq.category }}</div>
                <div class="result-info">
                  <div class="result-tag-row">
                    <span class="result-tag font-bold">{{ eq.tag }}</span>
                    <span class="result-cota" *ngIf="eq.cota">{{ eq.cota }}</span>
                  </div>
                  <span class="result-name">{{ eq.name }}</span>
                </div>
                <span class="result-sheet-chip">L{{ eq.sheetNumber || 1 }}</span>
                <span class="result-arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Top Right Actions -->
        <div class="top-actions">
          <button 
            type="button" 
            class="btn btn-secondary action-btn" 
            (click)="toggleRadarMiniMap()" 
            [class.active]="showRadarMap()"
            title="Activar / Ocultar Mini-Mapa Radar"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <rect x="7" y="7" width="3" height="9"></rect>
              <rect x="14" y="7" width="3" height="5"></rect>
            </svg>
            <span class="btn-text">Mini-Mapa</span>
          </button>

          <button 
            type="button" 
            class="btn btn-secondary action-btn" 
            (click)="toggleSpecDrawer()" 
            [class.active]="showSpecDrawer()"
            title="Ver parámetros de diseño, cotas y diámetros oficiales"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span class="btn-text">Ficha Técnica</span>
          </button>

          <button 
            type="button" 
            class="btn btn-secondary action-btn" 
            (click)="downloadImage()" 
            [title]="'Descargar lámina en resolución ultra-alta (' + selectedSheet().nativeResolution + ')'"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="btn-text">Descargar HD</span>
          </button>

          <button 
            type="button" 
            class="btn btn-primary action-btn-fullscreen" 
            (click)="toggleFullscreen()" 
            title="Modo Pantalla Completa (Sala de Control)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
            <span class="btn-text">Pantalla Completa</span>
          </button>
        </div>
      </div>

      <!-- Official Multi-Sheet P&ID Selector (Láminas 1 a 4) -->
      <div class="sheet-tabs-strip no-print" *ngIf="!isFullscreen()">
        <div class="sheet-tabs-list">
          <button 
            type="button" 
            *ngFor="let s of sheets" 
            class="sheet-tab" 
            [class.active]="selectedSheet().id === s.id" 
            (click)="selectSheet(s)"
          >
            <div class="sheet-tab-icon-wrap">
              <span class="sheet-tab-badge">L{{ s.number }}</span>
            </div>
            <div class="sheet-tab-text">
              <span class="sheet-tab-name">{{ s.shortTitle }}</span>
              <span class="sheet-tab-meta">{{ s.badge }} • {{ s.nativeResolution }}</span>
            </div>
            <span class="sheet-active-dot" *ngIf="selectedSheet().id === s.id"></span>
          </button>
        </div>
      </div>

      <!-- Live Telemetry KPI Bar & Quick Operational Zones (Prioridad 1) -->
      <div class="telemetry-zones-bar glass-panel no-print">
        <!-- Live SCADA Status Indicators -->
        <div class="live-telemetry-strip">
          <div class="live-pill live-pill-pumps" [class.warn]="sentinaStats().failures.length > 0" title="Estado en vivo de Sentina">
            <span class="pulse-dot" [class.red]="sentinaStats().failures.length > 0"></span>
            <span class="pill-title">Sentina:</span>
            <span class="pill-value font-bold">{{ sentinaStats().operating }}/8 Op.</span>
          </div>

          <div class="live-pill live-pill-pumps" [class.warn]="intermediaStats().failures.length > 0" title="Estado en vivo de Intermedia">
            <span class="pulse-dot" [class.red]="intermediaStats().failures.length > 0"></span>
            <span class="pill-title">Intermedia:</span>
            <span class="pill-value font-bold">{{ intermediaStats().operating }}/6 Op.</span>
          </div>

          <div class="live-pill live-pill-pumps" [class.warn]="torre5Stats().failures.length > 0" title="Estado en vivo de Torre 5">
            <span class="pulse-dot" [class.red]="torre5Stats().failures.length > 0"></span>
            <span class="pill-title">Torre 5:</span>
            <span class="pill-value font-bold">{{ torre5Stats().operating }}/10 Op.</span>
          </div>

          <div class="live-pill live-pill-tailings" title="Borde libre reglamentario">
            <span class="pulse-dot" [class.amber]="isFreeboardLow()"></span>
            <span class="pill-title">Borde Libre:</span>
            <span class="pill-value font-bold">{{ tailingsFreeboard() | number:'1.1-1' }}m</span>
          </div>

          <div class="live-pill live-pill-cyclones" title="Promedio de arenas 2da etapa">
            <span class="pulse-dot"></span>
            <span class="pill-title">Arenas UF:</span>
            <span class="pill-value font-bold">{{ cyclonesSolidsUf() | number:'1.1-1' }}% S</span>
          </div>

          <div class="live-pill live-pill-maint" *ngIf="activeOtCount() > 0" title="Órdenes de Trabajo Activas">
            <span class="pill-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </span>
            <span class="pill-title">Averías/OTs:</span>
            <span class="pill-value font-bold text-amber">{{ activeOtCount() }} Activas</span>
          </div>
        </div>

        <div class="zones-divider"></div>

        <!-- Quick Jump Zones -->
        <div class="zones-scroll">
          <button 
            type="button" 
            *ngFor="let z of currentZones()" 
            class="zone-pill" 
            [class.active]="selectedZoneId() === z.id" 
            (click)="jumpToZone(z)"
          >
            <span class="zone-icon">
              <svg *ngIf="z.id === 'ALL'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              <svg *ngIf="z.id === 'FEED' || z.id === 'ESP_3' || z.id === 'BAL_ALIM'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><rect x="3" y="15" width="18" height="6" rx="2"/></svg>
              <svg *ngIf="z.id === 'CYC1' || z.id === 'CYC2' || z.id === 'CYC1_3' || z.id === 'CYC2_3' || z.id === 'BAL_CYC1' || z.id === 'BAL_CYC2'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10"/></svg>
              <svg *ngIf="z.id === 'DAM' || z.id === 'DIQUE_ESC' || z.id === 'BAL_PRESA'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 22 22 22 12 2"/></svg>
              <svg *ngIf="z.id === 'SENTINA' || z.id === 'SENTINA_D'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M2 17h20M2 7h20"/></svg>
              <svg *ngIf="z.id === 'INTERMEDIA' || z.id === 'OBRA_D1' || z.id === 'OBRA_D2' || z.id === 'DROP_3'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <svg *ngIf="z.id === 'TORRE5' || z.id === 'BAL_TORRE5' || z.id === 'BAL_WASH'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </span>
            <span class="zone-name">{{ z.name }}</span>
            <span class="zone-cota" *ngIf="z.cota">{{ z.cota }}</span>
          </button>
        </div>
      </div>

      <!-- Main Interactive Viewport & Canvas -->
      <div 
        #viewportRef
        class="canvas-viewport" 
        [class.is-dragging]="isDragging"
        (mousedown)="onMouseDown($event)"
        (mousemove)="onMouseMove($event)"
        (mouseup)="onMouseUp()"
        (mouseleave)="onMouseUp()"
        (wheel)="onWheel($event)"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd()"
      >
        <!-- Floating HUD Controls Overlay -->
        <div class="hud-controls no-print" (mousedown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()">
          <!-- Sheet Selector in HUD (ideal for Fullscreen) -->
          <div class="hud-group hud-sheets-group">
            <span class="hud-sheet-label">Lámina:</span>
            <select class="hud-sheet-select" [ngModel]="selectedSheet().id" (ngModelChange)="onSheetIdChange($event)">
              <option *ngFor="let s of sheets" [value]="s.id">L{{ s.number }}: {{ s.shortTitle }}</option>
            </select>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-group">
            <button type="button" class="hud-btn" (click)="zoomIn()" title="Acercar (+)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <span class="hud-zoom-indicator">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
            <button type="button" class="hud-btn" (click)="zoomOut()" title="Alejar (-)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-group">
            <button type="button" class="hud-btn" (click)="fitToScreen()" title="Ajustar a la pantalla">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6"></path>
                <path d="M9 21H3v-6"></path>
                <path d="M21 3l-7 7"></path>
                <path d="M3 21l7-7"></path>
              </svg>
            </button>
            <button type="button" class="hud-btn" (click)="resetZoom()" title="Tamaño 100% (1:1)">
              <span class="btn-1x">1:1</span>
            </button>
            <button 
              type="button" 
              class="hud-btn" 
              [class.active]="showHotspots()" 
              (click)="showHotspots.set(!showHotspots())" 
              title="Mostrar/Ocultar Marcadores SCADA"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button type="button" class="hud-btn hud-btn-fs" (click)="toggleFullscreen()" title="Alternar Pantalla Completa">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" *ngIf="!isFullscreen()"></path>
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" *ngIf="isFullscreen()"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Help Gesture Hint (Mobile & Desktop) -->
        <div class="canvas-hint no-print" *ngIf="showHint()">
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Arrastra para mover • Rueda o pellizco para zoom • Usa el buscador para saltar a cualquier TAG
          </span>
          <button type="button" class="hint-close" (click)="showHint.set(false)">×</button>
        </div>

        <!-- Zoomable & Pannable Transform Container -->
        <div 
          class="canvas-transform-wrapper"
          [style.transform]="'translate3d(' + panX() + 'px, ' + panY() + 'px, 0px) scale(' + zoom() + ')'"
        >
          <!-- High Definition Flowsheet Image (Active Sheet) -->
          <div class="flowsheet-img-wrap">
            <img 
              [src]="selectedSheet().imageSrc" 
              [alt]="selectedSheet().title" 
              class="flowsheet-img"
              (load)="onImageLoaded()"
              draggable="false"
            />

            <!-- Interactive Hotspots Overlay -->
            <div class="hotspots-layer" *ngIf="showHotspots()">
              <div 
                *ngFor="let hp of currentHotspots()" 
                class="hotspot-marker" 
                [class.active]="activeHotspot()?.id === hp.id"
                [style.left.%]="hp.xPercent"
                [style.top.%]="hp.yPercent"
                (click)="onHotspotClick(hp, $event)"
              >
                <!-- Pulsing Radar Ring -->
                <div class="radar-pulse" [ngClass]="hp.category.toLowerCase()"></div>
                <div class="radar-core" [ngClass]="hp.category.toLowerCase()">
                  <span class="core-tag">{{ hp.tag }}</span>
                  <!-- Live Telemetry Mini-Badge on Marker (Prioridad 1) -->
                  <span class="core-live-status" *ngIf="getMarkerLiveStatus(hp) as st">{{ st }}</span>
                </div>

                <!-- Active Maintenance Ticket Warning Indicator (Prioridad 4) -->
                <div class="maint-warning-badge" *ngIf="hasActiveMaintenance(hp.tag)">
                  <span class="maint-icon">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  </span>
                </div>

                <!-- Floating Info Popover with Smart Boundary Awareness -->
                <div 
                  class="hotspot-popover animate-scale-up" 
                  [class.pos-top]="hp.yPercent > 45"
                  [class.pos-bottom]="hp.yPercent <= 45"
                  [class.align-left]="hp.xPercent < 25"
                  [class.align-right]="hp.xPercent > 75"
                  [class.align-center]="hp.xPercent >= 25 && hp.xPercent <= 75"
                  *ngIf="activeHotspot()?.id === hp.id"
                  (click)="$event.stopPropagation()"
                >
                  <div class="popover-header">
                    <div class="popover-badge" [ngClass]="hp.category.toLowerCase()">{{ hp.category }}</div>
                    <span class="popover-cota" *ngIf="hp.cota">{{ hp.cota }}</span>
                    <button type="button" class="popover-close" (click)="activeHotspot.set(null)" aria-label="Cerrar">×</button>
                  </div>
                  <h4 class="popover-title">{{ hp.title }}</h4>
                  <p class="popover-desc">{{ hp.description }}</p>

                  <!-- Live SCADA Data Card in Popover -->
                  <div class="popover-live-card" *ngIf="getPopoverLiveTelemetry(hp) as liveData">
                    <div class="live-card-header">
                      <span class="live-dot"></span>
                      <span class="live-label">TELEMETRÍA EN VIVO</span>
                    </div>
                    <div class="live-card-body">
                      <div class="live-row" *ngFor="let l of liveData">
                        <span class="l-lbl">{{ l.label }}:</span>
                        <span class="l-val font-bold" [ngClass]="l.color || ''">{{ l.value }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Design Specs Table -->
                  <div class="popover-specs">
                    <div class="spec-row" *ngFor="let s of hp.specs">
                      <span class="spec-lbl">{{ s.label }}:</span>
                      <span class="spec-val font-semibold">{{ s.value }}</span>
                    </div>
                  </div>

                  <!-- Actions Row: Primary Action + Report Maintenance Button -->
                  <div class="popover-actions-row">
                    <a [routerLink]="hp.routeLink" class="popover-action-btn">
                      <span>{{ hp.routeLabel }}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </a>
                    <a [routerLink]="['/maintenance']" [queryParams]="{ tag: hp.tag }" class="popover-maint-btn" title="Reportar Avería o Crear OT de Mantenimiento" style="display:inline-flex;align-items:center;gap:5px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                      <span>Reportar OT</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- Spotlight Beacon / Halo when user searches a TAG (Prioridad 2) -->
            <div 
              class="spotlight-beacon" 
              *ngIf="spotlightCoord() as sp"
              [style.left.%]="sp.x"
              [style.top.%]="sp.y"
            >
              <div class="beacon-ring ring-1"></div>
              <div class="beacon-ring ring-2"></div>
              <div class="beacon-target-label">{{ spotlightTag() }}</div>
            </div>
          </div>
        </div>

        <!-- Mini-Mapa Radar (Picture-in-Picture Navigator - Prioridad 3) -->
        <div 
          class="radar-minimap-card no-print" 
          *ngIf="showRadarMap()"
          (mousedown)="$event.stopPropagation()"
          (touchstart)="$event.stopPropagation()"
        >
          <div class="minimap-header">
            <span class="minimap-title" style="display:inline-flex;align-items:center;gap:5px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              RADAR CORTADERA
            </span>
            <button type="button" class="minimap-close" (click)="showRadarMap.set(false)">×</button>
          </div>
          <div 
            #miniMapRef
            class="minimap-viewport" 
            (click)="onMiniMapClick($event)"
          >
            <img 
              [src]="selectedSheet().imageSrc" 
              [alt]="'Radar ' + selectedSheet().shortTitle" 
              class="minimap-img" 
              draggable="false"
            />
            <!-- Viewport Rectangle Indicator -->
            <div 
              class="minimap-viewport-box"
              [style.left.px]="miniMapBox().x"
              [style.top.px]="miniMapBox().y"
              [style.width.px]="miniMapBox().w"
              [style.height.px]="miniMapBox().h"
            ></div>
          </div>
          <div class="minimap-footer">
            <button type="button" class="minimap-btn" (click)="fitToScreen()">Encajar</button>
            <button type="button" class="minimap-btn" (click)="resetZoom()">100%</button>
          </div>
        </div>
      </div>

      <!-- Slide-over Technical Specification Drawer -->
      <div 
        class="spec-drawer-backdrop animate-fade-in" 
        *ngIf="showSpecDrawer()" 
        (click)="showSpecDrawer.set(false)"
      >
        <div class="spec-drawer animate-slide-left" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-title-wrap">
              <span class="drawer-badge">DOCUMENTO TÉCNICO • LÁMINA {{ selectedSheet().number }}</span>
              <h3>{{ selectedSheet().title }}</h3>
              <p class="drawer-sub">Resolución: {{ selectedSheet().nativeResolution }} • Autor: Luis Cascasi</p>
            </div>
            <button type="button" class="drawer-close-btn" (click)="showSpecDrawer.set(false)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="drawer-content">
            <!-- 0. Ficha de la Lámina Seleccionada -->
            <div class="spec-section">
              <div class="spec-card" style="margin-bottom:0.75rem;">
                <span class="c-label">{{ selectedSheet().shortTitle }}</span>
                <span class="c-val text-primary">{{ selectedSheet().badge }}</span>
                <span class="c-sub">{{ selectedSheet().description }}</span>
              </div>
            </div>
            <!-- 1. Cotas de Diseño y Elevaciones -->
            <div class="spec-section">
              <h4 class="sec-title">
                <span class="sec-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3l-8.6-8.6a2 2 0 0 0-2.8 0L2.7 13.9a2 2 0 0 0 0 2.8l4.6 4.6a2 2 0 0 0 2.8 0l11.2-11.2a2 2 0 0 0 0-2.8z"/></svg>
                </span>
                Cotas Oficiales de Planta (m.s.n.m.)
              </h4>
              <div class="spec-grid-cards">
                <div class="spec-card">
                  <span class="c-label">Coronamiento Final Presa</span>
                  <span class="c-val text-primary">3,325.0 msnm</span>
                  <span class="c-sub">Elevación final de recrecimiento</span>
                </div>
                <div class="spec-card">
                  <span class="c-label">Poza Filtraciones (PO-001)</span>
                  <span class="c-val">3,379.0 msnm</span>
                  <span class="c-sub">Volumen útil 18,500 m³</span>
                </div>
                <div class="spec-card">
                  <span class="c-label">TK Estación Intermedia (TK-005)</span>
                  <span class="c-val">3,354.0 msnm</span>
                  <span class="c-sub">Volumen 1,920 m³ (15m x 12m)</span>
                </div>
                <div class="spec-card">
                  <span class="c-label">1ra Estación Ciclones</span>
                  <span class="c-val">3,292.0 msnm</span>
                  <span class="c-sub">CY-001 & CY-002 (Gmax 20)</span>
                </div>
                <div class="spec-card">
                  <span class="c-label">2da Estación Ciclones</span>
                  <span class="c-val">3,267.0 msnm</span>
                  <span class="c-sub">CY-003 & CY-004 (Gmax 26)</span>
                </div>
                <div class="spec-card">
                  <span class="c-label">Sentina de Drenes Basales</span>
                  <span class="c-val">2,872.0 msnm</span>
                  <span class="c-sub">Bombas PU001 @ PU008</span>
                </div>
                <div class="spec-card">
                  <span class="c-label">Torres Captación Agua Clara</span>
                  <span class="c-val">3,050.0 msnm</span>
                  <span class="c-sub">Bombas PU021 @ PU030</span>
                </div>
              </div>
            </div>

            <!-- 2. Balance Metalúrgico y Especificaciones de Arenas -->
            <div class="spec-section">
              <h4 class="sec-title">
                <span class="sec-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 9l9-6 9 6M6 14l-3-5h6l-3 5zm12 0l-3-5h6l-3 5z"/></svg>
                </span>
                Balance Metalúrgico de Arenas (Dique)
              </h4>
              <div class="table-card-spec">
                <table class="spec-table">
                  <thead>
                    <tr>
                      <th>Parámetro</th>
                      <th>1ra Estación</th>
                      <th>2da Estación (Final)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Alimentación (% Sólidos)</td>
                      <td class="font-semibold">48% - 50%</td>
                      <td>Traspaso DropBox</td>
                    </tr>
                    <tr>
                      <td>Flujo Total</td>
                      <td>5,639 t/h (7,751 m³/h)</td>
                      <td>1,265 t/h</td>
                    </tr>
                    <tr>
                      <td>Underflow (Arenas %S)</td>
                      <td>62.0%</td>
                      <td class="font-semibold text-emerald">70.0% Sólidos</td>
                    </tr>
                    <tr>
                      <td>Malla -200 (-200M)</td>
                      <td>33.1%</td>
                      <td class="font-semibold text-emerald">&le; 18.0% (GISTM)</td>
                    </tr>
                    <tr>
                      <td>Densidad de Diseño</td>
                      <td>1.45 t/m³</td>
                      <td class="font-semibold">1.6 a 1.7 t/m³</td>
                    </tr>
                    <tr>
                      <td>Compactación Requerida</td>
                      <td>N/A</td>
                      <td class="font-semibold">95% Proctor Estándar</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 3. Diámetros Oficiales de Tuberías y Líneas -->
            <div class="spec-section">
              <h4 class="sec-title">
                <span class="sec-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                </span>
                Conducciones Principales & Diámetros
              </h4>
              <ul class="spec-bullets">
                <li><strong>Canaleta 4110-LN001:</strong> 2.1 km, pendiente 1.20%, sección 1.20m x 1.30m.</li>
                <li><strong>Canaleta 4110-LN005:</strong> 7.5 km, pendiente 0.80%, sección 1.30m x 1.40m.</li>
                <li><strong>Túnel Salviani - Capillune:</strong> 1.05 km (1,096 metros).</li>
                <li><strong>Túnel Capillune - Cortadera:</strong> 0.50 km.</li>
                <li><strong>Línea de Conducción Principal Relave:</strong> Tubería de 48'' (1,200 mm) AT1U-48''-TL.</li>
                <li><strong>Línea de Descarga Torres Papujune:</strong> 14.6 km en tubería de acero 36'' / 28'' hacia TK-3720.</li>
                <li><strong>Línea de Dilución & Agua Cyclowash:</strong> 24'' y 20'' RW (310 m³/h Cyclowash).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .flowsheet-page {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 75px);
      min-height: 550px;
      position: relative;
      background: var(--bg-surface, #ffffff);
      overflow: hidden;
    }

    .flowsheet-page.is-fullscreen {
      height: 100vh;
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #0f172a;
    }

    /* Top Action Bar */
    .page-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      background: var(--bg-surface, #ffffff);
      flex-shrink: 0;
    }

    .title-block {
      flex-shrink: 0;
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .title-with-badge h2 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-main, #0f172a);
      letter-spacing: -0.01em;
    }

    .badge-official {
      display: inline-flex;
      align-items: center;
      padding: 0.18rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-radius: 999px;
      background: #ecfdf5;
      color: #059669;
      border: 1px solid rgba(5, 150, 105, 0.25);
    }

    .section-sub {
      margin: 0.15rem 0 0;
      font-size: 0.78rem;
      color: var(--text-muted, #64748b);
    }

    /* Official Multi-Sheet Tabs Bar */
    .sheet-tabs-strip {
      display: flex;
      align-items: center;
      background: var(--bg-surface, #ffffff);
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      padding: 0.4rem 1.25rem;
      gap: 0.5rem;
      overflow-x: auto;
      scrollbar-width: none;
      flex-shrink: 0;
    }

    .sheet-tabs-strip::-webkit-scrollbar {
      display: none;
    }

    .sheet-tabs-list {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .sheet-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.42rem 0.85rem;
      background: var(--bg-subtle, #f8fafc);
      border: 1px solid var(--border-color, #cbd5e1);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      text-align: left;
      white-space: nowrap;
      user-select: none;
      touch-action: manipulation;
    }

    .sheet-tab:hover {
      background: #f1f5f9;
      border-color: #031795;
      transform: translateY(-1px);
    }

    .sheet-tab.active {
      background: linear-gradient(135deg, #031795 0%, #1e3a8a 100%);
      color: #ffffff;
      border-color: #031795;
      box-shadow: 0 4px 12px rgba(3, 23, 149, 0.22);
    }

    .sheet-tab-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sheet-tab-badge {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
      background: rgba(3, 23, 149, 0.1);
      color: #031795;
      letter-spacing: 0.02em;
    }

    .sheet-tab.active .sheet-tab-badge {
      background: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }

    .sheet-tab-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .sheet-tab-name {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-main, #1e293b);
    }

    .sheet-tab.active .sheet-tab-name {
      color: #ffffff;
    }

    .sheet-tab-meta {
      font-size: 0.65rem;
      font-weight: 500;
      color: var(--text-muted, #64748b);
    }

    .sheet-tab.active .sheet-tab-meta {
      color: rgba(255, 255, 255, 0.8);
    }

    .sheet-active-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
      margin-left: 0.2rem;
    }

    /* TAG Search Input (Prioridad 2) */
    .search-tag-container {
      position: relative;
      flex: 1;
      max-width: 420px;
    }

    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      color: var(--text-muted, #94a3b8);
      pointer-events: none;
    }

    .search-tag-input {
      width: 100%;
      height: 36px;
      padding: 0 28px 0 34px;
      font-size: 0.8rem;
      color: var(--text-main, #0f172a);
      background: var(--bg-subtle, #f8fafc);
      border: 1px solid var(--border-color, #cbd5e1);
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .search-tag-input:focus {
      outline: none;
      border-color: #031795;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(3, 23, 149, 0.12);
    }

    .search-clear-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    .search-clear-btn:hover {
      color: #0f172a;
    }

    .search-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 10px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
      z-index: 2000;
      overflow: hidden;
    }

    .search-dropdown-header {
      padding: 0.4rem 0.75rem;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .search-dropdown-list {
      max-height: 280px;
      overflow-y: auto;
    }

    .search-result-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: transparent;
      border: none;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s ease;
    }

    .search-result-item:hover {
      background: #f1f5f9;
    }

    .result-badge {
      font-size: 0.62rem;
      font-weight: 800;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .result-badge.bomba { background: #dbeafe; color: #1e40af; }
    .result-badge.ciclón { background: #f3e8ff; color: #6b21a8; }
    .result-badge.cajón { background: #fef3c7; color: #92400e; }
    .result-badge.poza { background: #cffafe; color: #155e75; }
    .result-badge.presa { background: #ffedd5; color: #9a3412; }
    .result-badge.canaleta { background: #dcfce7; color: #166534; }
    .result-badge.válvula { background: #fee2e2; color: #991b1b; }
    .result-badge.sensor { background: #e0e7ff; color: #3730a3; }
    .result-badge.dren { background: #ccfbf1; color: #0f766e; }
    .result-badge.balance { background: #fef08a; color: #854d0e; }

    .result-sheet-chip {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0.12rem 0.38rem;
      border-radius: 4px;
      background: rgba(3, 23, 149, 0.08);
      color: #031795;
      margin-left: auto;
      border: 1px solid rgba(3, 23, 149, 0.15);
    }

    .result-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .result-tag-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .result-tag {
      font-size: 0.8rem;
      color: #0f172a;
    }

    .result-cota {
      font-size: 0.68rem;
      color: #64748b;
      background: #f1f5f9;
      padding: 0.05rem 0.3rem;
      border-radius: 3px;
    }

    .result-name {
      font-size: 0.7rem;
      color: #64748b;
      margin-top: 1px;
    }

    .result-arrow {
      color: #94a3b8;
      font-size: 0.9rem;
    }

    /* Top Actions */
    .top-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-shrink: 0;
      flex-wrap: wrap;
      max-width: 100%;
    }

    .action-btn, .action-btn-fullscreen {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-btn.active {
      background: #031795;
      color: #ffffff;
      border-color: #031795;
    }

    .action-btn-fullscreen {
      background: #031795;
      color: #ffffff;
      border: 1px solid #031795;
    }

    .action-btn-fullscreen:hover {
      background: #021275;
    }

    /* Telemetry & Zones Bar (Prioridad 1) */
    .telemetry-zones-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.45rem 1rem;
      background: var(--bg-subtle, #f8fafc);
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      flex-shrink: 0;
      overflow: hidden;
    }

    .live-telemetry-strip {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-shrink: 0;
    }

    .live-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.55rem;
      font-size: 0.72rem;
      border-radius: 6px;
      background: var(--bg-surface, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      white-space: nowrap;
    }

    .live-pill.warn {
      background: #fef2f2;
      border-color: #fca5a5;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
      animation: pulseDot 1.5s infinite;
    }

    .pulse-dot.red {
      background: #ef4444;
      box-shadow: 0 0 6px #ef4444;
    }

    .pulse-dot.amber {
      background: #f59e0b;
      box-shadow: 0 0 6px #f59e0b;
    }

    @keyframes pulseDot {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }

    .pill-title {
      color: var(--text-muted, #64748b);
      font-weight: 500;
    }

    .pill-value {
      color: var(--text-main, #0f172a);
    }

    .text-amber {
      color: #d97706;
    }

    .zones-divider {
      width: 1px;
      height: 22px;
      background: var(--border-color, #cbd5e1);
      margin: 0 0.15rem;
      flex-shrink: 0;
    }

    .zones-scroll {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding: 0.05rem 0;
    }

    .zones-scroll::-webkit-scrollbar {
      display: none;
    }

    .zone-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.3rem 0.6rem;
      font-size: 0.74rem;
      font-weight: 600;
      color: var(--text-main, #334155);
      background: var(--bg-surface, #ffffff);
      border: 1px solid var(--border-color, #cbd5e1);
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.18s ease;
      touch-action: manipulation;
    }

    .zone-pill:hover {
      border-color: #031795;
      color: #031795;
      background: #f1f5f9;
    }

    .zone-pill.active {
      background: #031795;
      color: #ffffff;
      border-color: #031795;
      box-shadow: 0 2px 6px rgba(3, 23, 149, 0.25);
    }

    .zone-pill.active .zone-cota {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .zone-icon {
      font-size: 0.82rem;
    }

    .zone-cota {
      font-size: 0.62rem;
      font-weight: 700;
      background: var(--bg-subtle, #f1f5f9);
      color: var(--text-muted, #64748b);
      padding: 0.08rem 0.3rem;
      border-radius: 4px;
    }

    /* Main Viewport */
    .canvas-viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
      user-select: none;
      background-color: #090e1a;
      background-image: 
        radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 24px 24px, 48px 48px, 48px 48px;
    }

    .canvas-viewport.is-dragging {
      cursor: grabbing;
    }

    /* HUD Controls */
    .hud-controls {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.5rem;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }

    .hud-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .hud-sheets-group {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .hud-sheet-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.02em;
    }

    .hud-sheet-select {
      background: rgba(30, 41, 59, 0.95);
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 0.22rem 0.45rem;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      transition: all 0.15s ease;
    }

    .hud-sheet-select:hover, .hud-sheet-select:focus {
      border-color: #38bdf8;
      background: #1e293b;
    }

    .hud-divider {
      width: 1px;
      height: 20px;
      background: rgba(255, 255, 255, 0.15);
      margin: 0 0.2rem;
    }

    .hud-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: transparent;
      border: none;
      color: #e2e8f0;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .hud-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .hud-btn.active {
      background: #031795;
      color: #ffffff;
    }

    .hud-zoom-indicator {
      font-size: 0.75rem;
      font-weight: 700;
      color: #cbd5e1;
      min-width: 44px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .btn-1x {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    /* Gesture Hint */
    .canvas-hint {
      position: absolute;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 90;
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.45rem 0.9rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: #f1f5f9;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 999px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
      pointer-events: auto;
      max-width: 90vw;
      white-space: nowrap;
    }

    .hint-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    .hint-close:hover {
      color: #ffffff;
    }

    /* Transform Wrapper & Flowsheet Image */
    .canvas-transform-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
      transition: transform 0.05s linear;
    }

    .flowsheet-img-wrap {
      position: relative;
      display: inline-block;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
      background: #ffffff;
      border-radius: 4px;
      overflow: hidden;
    }

    .flowsheet-img {
      display: block;
      width: 1200px;
      height: auto;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }

    /* Hotspots Layer */
    .hotspots-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .hotspot-marker {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: pointer;
      z-index: 50;
    }

    .hotspot-marker.active {
      z-index: 250;
    }

    .radar-pulse {
      position: absolute;
      inset: -12px;
      border-radius: 50%;
      opacity: 0.6;
      animation: pulseRadar 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
    }

    .radar-pulse.pumps { background: rgba(59, 130, 246, 0.4); border: 2px solid #3b82f6; }
    .radar-pulse.cyclones { background: rgba(168, 85, 247, 0.4); border: 2px solid #a855f7; }
    .radar-pulse.dam { background: rgba(234, 88, 12, 0.4); border: 2px solid #ea580c; }
    .radar-pulse.feed { background: rgba(16, 185, 129, 0.4); border: 2px solid #10b981; }

    .radar-core {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.22rem 0.55rem;
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 800;
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
      white-space: nowrap;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .hotspot-marker:hover .radar-core,
    .hotspot-marker.active .radar-core {
      transform: scale(1.15);
    }

    .radar-core.pumps { background: #2563eb; border: 1.5px solid #ffffff; }
    .radar-core.cyclones { background: #9333ea; border: 1.5px solid #ffffff; }
    .radar-core.dam { background: #ea580c; border: 1.5px solid #ffffff; }
    .radar-core.feed { background: #059669; border: 1.5px solid #ffffff; }

    .core-live-status {
      font-size: 0.6rem;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.25);
      padding: 0.05rem 0.3rem;
      border-radius: 999px;
    }

    /* Maintenance Warning Badge (Prioridad 4) */
    .maint-warning-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #f59e0b;
      border: 1.5px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      animation: pulseMaint 1.8s infinite;
    }

    .maint-icon {
      font-size: 0.65rem;
      line-height: 1;
    }

    @keyframes pulseMaint {
      0% { transform: scale(0.9); }
      50% { transform: scale(1.2); }
      100% { transform: scale(0.9); }
    }

    @keyframes pulseRadar {
      0% { transform: scale(0.6); opacity: 0.8; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* Spotlight Beacon (Prioridad 2) */
    .spotlight-beacon {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 180;
    }

    .beacon-ring {
      position: absolute;
      inset: -35px;
      border-radius: 50%;
      border: 3px solid #38bdf8;
      box-shadow: 0 0 25px #38bdf8;
      animation: beaconPulse 1.2s cubic-bezier(0.1, 0.8, 0.2, 1) infinite;
    }

    .beacon-ring.ring-2 {
      animation-delay: 0.4s;
    }

    .beacon-target-label {
      position: absolute;
      bottom: calc(100% + 15px);
      left: 50%;
      transform: translateX(-50%);
      background: #0284c7;
      color: #ffffff;
      font-size: 0.72rem;
      font-weight: 800;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      white-space: nowrap;
    }

    @keyframes beaconPulse {
      0% { transform: scale(0.3); opacity: 1; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    /* Hotspot Popover */
    .hotspot-popover {
      position: absolute;
      width: 295px;
      max-width: min(340px, calc(100vw - 30px));
      max-height: min(420px, 72vh);
      overflow-y: auto;
      overscroll-behavior: contain;
      background: #ffffff;
      color: #0f172a;
      border-radius: 12px;
      padding: 0.85rem;
      box-shadow: 0 18px 38px -5px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(0, 0, 0, 0.08);
      z-index: 210;
      cursor: default;
    }

    .hotspot-popover::-webkit-scrollbar {
      width: 5px;
    }
    .hotspot-popover::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 999px;
    }
    .hotspot-popover::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }
    .hotspot-popover::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* Position Top: opens ABOVE marker when marker is in lower half of flowsheet */
    .hotspot-popover.pos-top {
      bottom: calc(100% + 14px);
      top: auto;
    }

    /* Position Bottom: opens BELOW marker when marker is in upper half of flowsheet */
    .hotspot-popover.pos-bottom {
      top: calc(100% + 14px);
      bottom: auto;
    }

    /* Horizontal Alignment */
    .hotspot-popover.align-center {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
    }

    .hotspot-popover.align-left {
      left: -10px;
      right: auto;
      transform: none;
    }

    .hotspot-popover.align-right {
      right: -10px;
      left: auto;
      transform: none;
    }

    /* Tooltip Pointer Arrows */
    .hotspot-popover.pos-top::after {
      content: '';
      position: absolute;
      top: 100%;
      border-width: 8px 7px 0 7px;
      border-style: solid;
      border-color: #ffffff transparent transparent transparent;
    }
    .hotspot-popover.pos-top.align-center::after {
      left: 50%;
      transform: translateX(-50%);
    }
    .hotspot-popover.pos-top.align-left::after {
      left: 24px;
    }
    .hotspot-popover.pos-top.align-right::after {
      right: 24px;
    }

    .hotspot-popover.pos-bottom::after {
      content: '';
      position: absolute;
      bottom: 100%;
      border-width: 0 7px 8px 7px;
      border-style: solid;
      border-color: transparent transparent #ffffff transparent;
    }
    .hotspot-popover.pos-bottom.align-center::after {
      left: 50%;
      transform: translateX(-50%);
    }
    .hotspot-popover.pos-bottom.align-left::after {
      left: 24px;
    }
    .hotspot-popover.pos-bottom.align-right::after {
      right: 24px;
    }

    .popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }

    .popover-badge {
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .popover-badge.pumps { background: #dbeafe; color: #1e40af; }
    .popover-badge.cyclones { background: #f3e8ff; color: #6b21a8; }
    .popover-badge.dam { background: #ffedd5; color: #9a3412; }
    .popover-badge.feed { background: #d1fae5; color: #065f46; }

    .popover-cota {
      font-size: 0.68rem;
      font-weight: 700;
      color: #64748b;
    }

    .popover-close {
      background: none;
      border: none;
      font-size: 1rem;
      color: #94a3b8;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    .popover-close:hover {
      color: #0f172a;
    }

    .popover-title {
      margin: 0 0 0.25rem;
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
    }

    .popover-desc {
      margin: 0 0 0.6rem;
      font-size: 0.74rem;
      line-height: 1.35;
      color: #475569;
    }

    /* Popover Live SCADA Card */
    .popover-live-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 0.45rem 0.6rem;
      margin-bottom: 0.6rem;
    }

    .live-card-header {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-bottom: 0.3rem;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #16a34a;
    }

    .live-label {
      font-size: 0.62rem;
      font-weight: 800;
      color: #166534;
      letter-spacing: 0.05em;
    }

    .live-card-body {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .live-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
    }

    .l-lbl {
      color: #475569;
    }

    .l-val {
      color: #0f172a;
    }

    .popover-specs {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.45rem;
      margin-bottom: 0.75rem;
    }

    .spec-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      padding: 0.15rem 0;
    }

    .spec-lbl {
      color: #64748b;
    }

    .spec-val {
      color: #0f172a;
    }

    .popover-actions-row {
      display: flex;
      gap: 0.4rem;
    }

    .popover-action-btn {
      flex: 1.4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.45rem 0.65rem;
      background: #031795;
      color: #ffffff;
      font-size: 0.74rem;
      font-weight: 600;
      border-radius: 6px;
      text-decoration: none;
      transition: background 0.18s ease;
    }

    .popover-action-btn:hover {
      background: #021275;
    }

    .popover-maint-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.45rem 0.5rem;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      font-size: 0.72rem;
      font-weight: 700;
      border-radius: 6px;
      text-decoration: none;
      transition: all 0.18s ease;
    }

    .popover-maint-btn:hover {
      background: #fde68a;
    }

    /* Mini-Mapa Radar (Prioridad 3) */
    .radar-minimap-card {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      z-index: 100;
      width: 140px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 0.4rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }

    .minimap-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.35rem;
    }

    .minimap-title {
      font-size: 0.62rem;
      font-weight: 800;
      color: #94a3b8;
      letter-spacing: 0.05em;
    }

    .minimap-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 0.85rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    .minimap-viewport {
      position: relative;
      width: 100%;
      height: 170px;
      background: #000000;
      border-radius: 4px;
      overflow: hidden;
      cursor: crosshair;
    }

    .minimap-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }

    .minimap-viewport-box {
      position: absolute;
      border: 2px solid #38bdf8;
      background: rgba(56, 189, 248, 0.2);
      pointer-events: none;
      border-radius: 2px;
      transition: all 0.05s ease;
    }

    .minimap-footer {
      display: flex;
      gap: 0.25rem;
      margin-top: 0.35rem;
    }

    .minimap-btn {
      flex: 1;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 4px;
      padding: 0.2rem;
      color: #cbd5e1;
      font-size: 0.65rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .minimap-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    /* Slide-over Specification Drawer */
    .spec-drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: flex-end;
    }

    .spec-drawer {
      width: 480px;
      max-width: 90vw;
      height: 100%;
      background: var(--bg-surface, #ffffff);
      box-shadow: -15px 0 35px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
    }

    .drawer-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #031795;
      background: #eef2ff;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      margin-bottom: 0.35rem;
    }

    .drawer-title-wrap h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main, #0f172a);
    }

    .drawer-sub {
      margin: 0.2rem 0 0;
      font-size: 0.78rem;
      color: var(--text-muted, #64748b);
    }

    .drawer-close-btn {
      background: none;
      border: none;
      color: var(--text-muted, #64748b);
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 6px;
    }

    .drawer-close-btn:hover {
      color: var(--text-main, #0f172a);
      background: var(--bg-subtle, #f1f5f9);
    }

    .drawer-content {
      flex: 1;
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .sec-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0 0 0.75rem;
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-main, #0f172a);
    }

    .sec-icon {
      font-size: 1rem;
    }

    .spec-grid-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.6rem;
    }

    .spec-card {
      background: var(--bg-subtle, #f8fafc);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .c-label {
      font-size: 0.7rem;
      color: var(--text-muted, #64748b);
    }

    .c-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main, #0f172a);
    }

    .c-sub {
      font-size: 0.68rem;
      color: var(--text-muted, #94a3b8);
    }

    .table-card-spec {
      background: var(--bg-subtle, #f8fafc);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      overflow: hidden;
    }

    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.74rem;
    }

    .spec-table th, .spec-table td {
      padding: 0.5rem 0.65rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
    }

    .spec-table th {
      background: var(--bg-surface, #ffffff);
      color: var(--text-muted, #64748b);
      font-weight: 700;
    }

    .spec-bullets {
      margin: 0;
      padding-left: 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 0.76rem;
      color: var(--text-main, #334155);
      line-height: 1.4;
    }

    .text-emerald {
      color: #059669;
    }

    .text-primary {
      color: #031795;
    }

    /* Dark Theme Adaptations */
    :host-context([data-theme="dark"]),
    :host-context(.dark-theme) {
      .flowsheet-page {
        background: #0f172a;
      }
      .page-top-bar, .telemetry-zones-bar {
        background: #1e293b;
        border-color: #334155;
      }
      .title-with-badge h2 {
        color: #f8fafc;
      }
      .search-tag-input {
        background: #0f172a;
        color: #f8fafc;
        border-color: #334155;

        &:focus {
          background: #0f172a;
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
        }
      }
      .search-dropdown {
        background: #1e293b;
        border-color: #334155;
      }
      .search-dropdown-header {
        background: #0f172a;
        border-color: #334155;
      }
      .search-result-item:hover {
        background: #334155;
      }
      .result-tag {
        color: #f8fafc;
      }
      .live-pill {
        background: #0f172a;
        border-color: #334155;
      }
      .pill-value {
        color: #f8fafc;
      }
      .zone-pill {
        background: #0f172a;
        color: #cbd5e1;
        border-color: #334155;
      }
      .zone-pill:hover {
        background: #1e293b;
        color: #ffffff;
      }
      .spec-drawer {
        background: #1e293b;
      }
      .drawer-header {
        border-color: #334155;
      }
      .drawer-title-wrap h3, .sec-title, .c-val, .spec-table th {
        color: #f8fafc;
      }
      .spec-card, .table-card-spec {
        background: #0f172a;
        border-color: #334155;
      }
      .spec-table th, .spec-table td {
        border-color: #334155;
      }
      .spec-bullets {
        color: #cbd5e1;
      }
      .sheet-tabs-strip {
        background: #1e293b;
        border-color: #334155;
      }
      .sheet-tab {
        background: #0f172a;
        border-color: #334155;
      }
      .sheet-tab:hover {
        background: #1e293b;
        border-color: #38bdf8;
      }
      .sheet-tab-name {
        color: #f8fafc;
      }
      .sheet-tab-meta {
        color: #94a3b8;
      }
      .sheet-tab.active {
        background: linear-gradient(135deg, #031795 0%, #1e3a8a 100%);
      }

      .hotspot-popover {
        background: #131d35;
        color: #f8fafc;
        box-shadow: 0 18px 38px -5px rgba(0, 0, 0, 0.75), 0 0 0 1px #1e293b;
      }
      .hotspot-popover.pos-top::after {
        border-color: #131d35 transparent transparent transparent;
      }
      .hotspot-popover.pos-bottom::after {
        border-color: transparent transparent #131d35 transparent;
      }
      .hotspot-popover::-webkit-scrollbar-track {
        background: #0d1527;
      }
      .hotspot-popover::-webkit-scrollbar-thumb {
        background: #1e293b;
      }
      .popover-title {
        color: #f8fafc;
      }
      .popover-desc {
        color: #cbd5e1;
      }
      .popover-cota {
        color: #94a3b8;
      }
      .popover-close:hover {
        color: #f8fafc;
      }
      .popover-specs {
        background: #0d1527;
        border-color: #1e293b;
      }
      .spec-lbl {
        color: #94a3b8;
      }
      .spec-val {
        color: #f8fafc;
      }
      .popover-live-card {
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.28);
      }
      .live-label {
        color: #34d399;
      }
      .l-lbl {
        color: #94a3b8;
      }
      .l-val {
        color: #f8fafc;
      }
      .popover-maint-btn {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border-color: rgba(245, 158, 11, 0.3);
      }
      .popover-maint-btn:hover {
        background: rgba(245, 158, 11, 0.25);
      }
      .radar-minimap-card {
        background: rgba(19, 29, 53, 0.95);
        border-color: #1e293b;
      }
      .hud-controls {
        background: rgba(19, 29, 53, 0.95);
        border-color: #1e293b;
      }
      .hud-btn {
        background: #0d1527;
        border-color: #1e293b;
        color: #cbd5e1;
      }
      .hud-btn:hover {
        background: #1e293b;
        color: #f8fafc;
      }
      .hud-zoom-indicator {
        color: #94a3b8;
      }
    }

    /* Mobile Responsive */
    @media (max-width: 900px) {
      .search-tag-container {
        display: none;
      }
      .live-telemetry-strip {
        overflow-x: auto;
        scrollbar-width: none;
      }
    }

    @media (max-width: 768px) {
      .flowsheet-page {
        height: calc(100vh - 120px);
      }
      .page-top-bar {
        padding: 0.5rem 0.75rem;
      }
      .btn-text {
        display: none;
      }
      .title-with-badge h2 {
        font-size: 1.05rem;
      }
      .badge-official {
        display: none;
      }
      .section-sub {
        display: none;
      }
      .sheet-tabs-strip {
        padding: 0.3rem 0.6rem;
      }
      .sheet-tab {
        padding: 0.32rem 0.55rem;
      }
      .sheet-tab-meta {
        display: none;
      }
      .hud-sheet-label {
        display: none;
      }
      .telemetry-zones-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.4rem;
        padding: 0.4rem 0.6rem;
      }
      .zones-divider {
        display: none;
      }
      .radar-minimap-card {
        display: none;
      }
      .hud-controls {
        top: 0.5rem;
        right: 0.5rem;
        padding: 0.25rem 0.4rem;
      }
      .hud-btn {
        width: 28px;
        height: 28px;
      }
      .hud-zoom-indicator {
        min-width: 36px;
        font-size: 0.7rem;
      }
    }
  `]
})
export class FlowsheetComponent implements OnInit, OnDestroy {
  @ViewChild('viewportRef') viewportRef!: ElementRef<HTMLDivElement>;
  @ViewChild('miniMapRef') miniMapRef!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  public plantParamsService = inject(PlantParametersService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // State Signals
  zoom = signal<number>(1.0);
  panX = signal<number>(0);
  panY = signal<number>(0);
  isFullscreen = signal<number | boolean>(false);
  showSpecDrawer = signal<boolean>(false);
  showHotspots = signal<boolean>(true);
  showHint = signal<boolean>(true);
  showRadarMap = signal<boolean>(true);
  selectedZoneId = signal<string>('ALL');
  activeHotspot = signal<FlowsheetHotspot | null>(null);

  // Search State (Prioridad 2)
  searchQuery = '';
  isSearchFocused = signal<boolean>(false);
  filteredEquipment = signal<SearchableTagItem[]>([]);
  spotlightCoord = signal<{ x: number; y: number } | null>(null);
  spotlightTag = signal<string>('');
  private spotlightTimer: any = null;

  // Real-Time Telemetry Signals (Prioridad 1)
  sentinaStats = signal<{ operating: number; total: number; failures: string[] }>({ operating: 8, total: 8, failures: [] });
  intermediaStats = signal<{ operating: number; total: number; failures: string[] }>({ operating: 6, total: 6, failures: [] });
  torre5Stats = signal<{ operating: number; total: number; failures: string[] }>({ operating: 10, total: 10, failures: [] });
  tailingsFreeboard = signal<number>(3.8);
  tailingsDamLevel = signal<number>(3321.2);
  cyclonesSolidsUf = signal<number>(70.0);
  cyclonesMesh200 = signal<number>(16.8);

  // Active Maintenance Tickets (Prioridad 4)
  activeMaintenanceTags = signal<Set<string>>(new Set<string>());
  activeOtCount = computed(() => this.activeMaintenanceTags().size);

  isFreeboardLow = computed(() => {
    return this.tailingsFreeboard() < this.plantParamsService.minFreeboard();
  });

  // Mouse & Touch Drag State
  isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialTouchDistance = 0;
  private initialTouchZoom = 1.0;

  // Official Multi-Sheet P&ID Catalog (4 Sheets extracted from FlowSheet001_D.pdf)
  readonly sheets: FlowsheetSheet[] = [
    {
      id: 'FLOWSHEET_1',
      number: 1,
      title: 'Diagrama P&ID Presa Cortadera - Flowsheet 1.0 General',
      shortTitle: 'Flowsheet 1.0 General',
      badge: 'Oficial Planta',
      imageSrc: '/images/flowsheet-cortadera-hd.jpg',
      downloadFileName: 'FlowSheet001_D_L1_General.jpg',
      baseWidth: 1200,
      baseHeight: 1660,
      nativeResolution: '3259 × 4510 px',
      description: 'Diagrama general de procesos de relaves, bombeo de pulpa, clasificación en ciclones 1ra y 2da etapa, recrecimiento de presa Cortadera y recuperación de agua en Torre 5.',
      zones: [
        { id: 'ALL', name: 'Vista General', icon: '', cota: '', xPercent: 50, yPercent: 50, zoom: 0.95 },
        { id: 'FEED', name: 'Alimentación & Espesador', icon: '', cota: '3317m', xPercent: 30, yPercent: 18, zoom: 2.2 },
        { id: 'CYC1', name: '1ra Estación Ciclones', icon: '', cota: '3292m', xPercent: 47, yPercent: 37, zoom: 2.6 },
        { id: 'CYC2', name: '2da Estación Ciclones', icon: '', cota: '3267m', xPercent: 46, yPercent: 53, zoom: 2.6 },
        { id: 'DAM', name: 'Presa Cortadera', icon: '', cota: '3325m', xPercent: 56, yPercent: 85, zoom: 2.2 },
        { id: 'SENTINA', name: 'Sentina Drenes (PU001-08)', icon: '', cota: '2872m', xPercent: 14, yPercent: 92, zoom: 2.8 },
        { id: 'INTERMEDIA', name: 'Intermedia (PU011-16)', icon: '', cota: '3354m', xPercent: 83, yPercent: 28, zoom: 2.6 },
        { id: 'TORRE5', name: 'Torres Captación (PU021-30)', icon: '', cota: '3050m', xPercent: 82, yPercent: 82, zoom: 2.6 }
      ],
      hotspots: [
        {
          id: 'hp-sentina',
          tag: 'PU-001@008',
          title: 'Sentina de Drenes Basales',
          category: 'PUMPS',
          cota: '2,872 msnm',
          xPercent: 14.5,
          yPercent: 92.5,
          description: 'Estación de 8 bombas para recirculación de drenes basales y filtraciones de presa.',
          specs: [
            { label: 'Bombas', value: '8 unidades (PU001 a PU008)' },
            { label: 'Capacidad', value: '255 m³/h • 550 kW' },
            { label: 'Poza Drenes', value: '4240-PO-001 (18,500 m³)' }
          ],
          routeLink: '/pumps',
          routeLabel: 'Monitorear Bombas Sentina'
        },
        {
          id: 'hp-intermedia',
          tag: 'PU-011@016',
          title: 'Estación de Rebombeo Intermedia',
          category: 'PUMPS',
          cota: '3,354 msnm',
          xPercent: 83.2,
          yPercent: 27.5,
          description: 'Impulsión de agua de drenajes y filtraciones hacia procesos de planta.',
          specs: [
            { label: 'Bombas', value: '6 unidades (PU011 a PU016)' },
            { label: 'Capacidad', value: '850 m³/h • 750 kW' },
            { label: 'Tanque', value: '4330-TK-005 (1,920 m³)' }
          ],
          routeLink: '/pumps',
          routeLabel: 'Monitorear Estación Intermedia'
        },
        {
          id: 'hp-torre5',
          tag: 'PU-021@030',
          title: 'Torres de Captación de Agua Clara',
          category: 'PUMPS',
          cota: '3,050 msnm',
          xPercent: 81.5,
          yPercent: 82.0,
          description: 'Recuperación de agua clarificada en embalse a través de 3 torres de captación hacia Papujune.',
          specs: [
            { label: 'Bombas', value: '10 unidades (PU021 a PU030)' },
            { label: 'Torres', value: '4320-TW-30 / 31 / 32' },
            { label: 'Conducción', value: '14.6 km en 36\'\' hacia TK-3720' }
          ],
          routeLink: '/pumps',
          routeLabel: 'Monitorear Torres de Captación'
        },
        {
          id: 'hp-cyc1',
          tag: 'CY-001/002',
          title: '1ra Estación de Ciclones',
          category: 'CYCLONES',
          cota: '3,292 msnm',
          xPercent: 47.0,
          yPercent: 37.2,
          description: 'Primera etapa de clasificación de relave con 2 nidos de 18 ciclones Gmax 20 y Cyclowash.',
          specs: [
            { label: 'Configuración', value: '18 Ciclones (13 Oper / 5 Res)' },
            { label: 'Presión Oper.', value: '20 - 23 PSI' },
            { label: 'Underflow', value: '62% Sólidos (M-200: 33.1%)' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver Planilla 1ra Estación'
        },
        {
          id: 'hp-cyc2',
          tag: 'CY-003/004',
          title: '2da Estación de Ciclones',
          category: 'CYCLONES',
          cota: '3,267 msnm',
          xPercent: 46.0,
          yPercent: 53.5,
          description: 'Etapa final de deslamado para obtención de arenas mecánicamente estables para el muro.',
          specs: [
            { label: 'Configuración', value: '6 Ciclones Gmax 26 (4 Oper / 2 Res)' },
            { label: 'Calidad Arenas', value: '70% Sólidos • 868.5 t/h' },
            { label: 'Proctor Estándar', value: '95% de Compactación' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver Planilla 2da Estación'
        },
        {
          id: 'hp-dam',
          tag: 'PRESA 3325m',
          title: 'Presa de Relaves Cortadera',
          category: 'DAM',
          cota: '3,325 msnm',
          xPercent: 56.0,
          yPercent: 85.0,
          description: 'Muro de recrecimiento por aguas abajo con arenas clasificadas (Estribos Izquierdo y Derecho).',
          specs: [
            { label: 'Cota de Cresta', value: '3,325.0 msnm final' },
            { label: 'Borde Libre', value: 'Reglamentario D.S. 024-2016-EM' },
            { label: 'Drenaje', value: 'Zanja Cortafugas WBS 4220' }
          ],
          routeLink: '/tailings',
          routeLabel: 'Ver Reporte de Descarga'
        },
        {
          id: 'hp-feed',
          tag: 'ESPESADOR 3710',
          title: 'Espesamiento & Canaleta 4110-LN001',
          category: 'FEED',
          cota: '3,317 msnm',
          xPercent: 28.5,
          yPercent: 18.0,
          description: 'Llegada de pulpa desde Espesador 3710-TH-001/002 y conducción por gravedad en canaleta 2.1 km.',
          specs: [
            { label: 'Flujo Total', value: '5,639 t/h (7,751 m³/h)' },
            { label: 'Pendiente', value: '1.20% (Sección 1.20m x 1.30m)' },
            { label: 'Piscinas Emerg.', value: 'PO-004 @ PO-007 (1500-7500 m³)' }
          ],
          routeLink: '/calculators',
          routeLabel: 'Abrir Calculadora de Pulpas'
        }
      ],
      equipmentCatalog: [
        { tag: 'PU-001@008', name: 'Sentina de Drenes (8 Bombas)', category: 'BOMBA', cota: '2872 msnm', xPercent: 14.5, yPercent: 92.5, zoom: 3.0, description: 'Bombas de impulsión drenes basales 255 m³/h • 550 kW', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU001', name: 'Bomba Sentina Drenes #1', category: 'BOMBA', cota: '2872 msnm', xPercent: 13.0, yPercent: 92.0, zoom: 3.2, description: 'Bomba vertical recirculación drenes', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU002', name: 'Bomba Sentina Drenes #2', category: 'BOMBA', cota: '2872 msnm', xPercent: 13.8, yPercent: 92.0, zoom: 3.2, description: 'Bomba vertical recirculación drenes', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU003', name: 'Bomba Sentina Drenes #3', category: 'BOMBA', cota: '2872 msnm', xPercent: 14.6, yPercent: 92.0, zoom: 3.2, description: 'Bomba vertical recirculación drenes', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU004', name: 'Bomba Sentina Drenes #4', category: 'BOMBA', cota: '2872 msnm', xPercent: 15.4, yPercent: 92.0, zoom: 3.2, description: 'Bomba vertical recirculación drenes', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU-011@016', name: 'Estación Rebombeo Intermedia (6 Bombas)', category: 'BOMBA', cota: '3354 msnm', xPercent: 83.2, yPercent: 27.5, zoom: 2.8, description: 'Bombas 4330-PU-011 a 016 (850 m³/h • 750 kW)', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU011', name: 'Bomba Intermedia #11', category: 'BOMBA', cota: '3354 msnm', xPercent: 82.0, yPercent: 27.0, zoom: 3.2, description: 'Impulsión hacia Tanque 3720-TK-002', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU012', name: 'Bomba Intermedia #12', category: 'BOMBA', cota: '3354 msnm', xPercent: 82.8, yPercent: 27.0, zoom: 3.2, description: 'Impulsión hacia Tanque 3720-TK-002', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU-021@030', name: 'Torres Captación Agua Clara (10 Bombas)', category: 'BOMBA', cota: '3050 msnm', xPercent: 81.5, yPercent: 82.0, zoom: 2.8, description: 'Bombas 4320-PU-021 a 030 (720 m³/h • 932 kW)', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU021', name: 'Bomba Torre de Captación #21', category: 'BOMBA', cota: '3050 msnm', xPercent: 80.5, yPercent: 81.5, zoom: 3.2, description: 'Captación agua sobrenadante de embalse', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PU032', name: 'Bomba Impulsión Relave Residual', category: 'BOMBA', cota: '3050 msnm', xPercent: 78.0, yPercent: 80.0, zoom: 3.2, description: '30 kW • 85 m³/h relave residual de fondo', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'CY-001', name: 'Nido Ciclones 1ra Etapa A', category: 'CICLÓN', cota: '3292 msnm', xPercent: 44.5, yPercent: 37.0, zoom: 3.0, description: '18 Ciclones Gmax 20 (13 Oper / 5 Res) • 20-23 PSI', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'CY-002', name: 'Nido Ciclones 1ra Etapa B', category: 'CICLÓN', cota: '3292 msnm', xPercent: 48.5, yPercent: 37.0, zoom: 3.0, description: '18 Ciclones Gmax 20 (13 Oper / 5 Res) • Cyclowash 310 m³/h', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'CY-003', name: 'Nido Ciclones 2da Etapa A', category: 'CICLÓN', cota: '3267 msnm', xPercent: 44.0, yPercent: 53.5, zoom: 3.0, description: '6 Ciclones Gmax 26 (4 Oper / 2 Res)', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'CY-004', name: 'Nido Ciclones 2da Etapa B', category: 'CICLÓN', cota: '3267 msnm', xPercent: 48.0, yPercent: 53.5, zoom: 3.0, description: '6 Ciclones Gmax 26 (4 Oper / 2 Res) • 70% Sólidos UF', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'CYCLOWASH', name: 'Sistema de Lavado Cyclowash', category: 'CICLÓN', cota: '3292 msnm', xPercent: 46.5, yPercent: 35.0, zoom: 3.0, description: 'Agua de lavado 310 m³/h para remoción de ultrafinos', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-001', name: 'Cajón Descarga Espesador', category: 'CAJÓN', cota: '3317 msnm', xPercent: 28.0, yPercent: 16.5, zoom: 2.8, description: '3710-BX-001 recepción de pulpa espesada', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-004', name: 'Cajón Traspaso Hacia Zona Norte', category: 'CAJÓN', cota: '3317 msnm', xPercent: 38.0, yPercent: 22.0, zoom: 2.8, description: 'Volumen 206.5 m³ distribución norte', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-005', name: 'Cajón de Lamas 1ra Etapa', category: 'CAJÓN', cota: '3292 msnm', xPercent: 51.5, yPercent: 43.0, zoom: 3.0, description: '4120-BX-005 • Volumen 122 m³ hacia embalse', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-006', name: 'Cajón de Arenas 1ra Etapa', category: 'CAJÓN', cota: '3292 msnm', xPercent: 44.0, yPercent: 43.0, zoom: 3.0, description: '4120-BX-006 • Volumen 44.1 m³ descarga arenas', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-009', name: 'Cajón de Desvío #1', category: 'CAJÓN', cota: '3310 msnm', xPercent: 52.0, yPercent: 23.5, zoom: 2.8, description: '4110-BX-009 • Vol 184.2 m³ con compuerta hidráulica', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-010', name: 'Cajón de Desvío #2', category: 'CAJÓN', cota: '3305 msnm', xPercent: 62.0, yPercent: 24.5, zoom: 2.8, description: '4110-BX-010 • Vol 182 m³ desvío a piscinas emergencia', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-011', name: 'Cajón de Desvío #3', category: 'CAJÓN', cota: '3300 msnm', xPercent: 71.0, yPercent: 25.5, zoom: 2.8, description: '4110-BX-011 • Vol 182 m³', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-012', name: 'Cajón de Lamas 2da Etapa', category: 'CAJÓN', cota: '3267 msnm', xPercent: 54.0, yPercent: 63.5, zoom: 3.0, description: '4120-BX-012 • Volumen 122 m³', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-013', name: 'Cajón de Arenas 2da Etapa', category: 'CAJÓN', cota: '3267 msnm', xPercent: 44.0, yPercent: 63.5, zoom: 3.0, description: '4120-BX-013 • Volumen 60.9 m³ arenas a muro', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-016', name: 'DropBox de Alimentación 2da Etapa A', category: 'CAJÓN', cota: '3267 msnm', xPercent: 43.0, yPercent: 51.0, zoom: 3.2, description: 'Disipador DropBox 4120-BX016', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'BX-018', name: 'DropPipe Conducción Arenas', category: 'CAJÓN', cota: '3260 msnm', xPercent: 49.0, yPercent: 66.0, zoom: 3.2, description: 'Tubería vertical disipadora de arenas', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PO-001', name: 'Poza de Recepción de Filtraciones', category: 'POZA', cota: '3379 msnm', xPercent: 18.0, yPercent: 91.0, zoom: 2.8, description: '4240-PO-001 • 18,500 m³ (111m x 37m x 8.5m)', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PO-003', name: 'Poza de Filtraciones Intermedia', category: 'POZA', cota: '3354 msnm', xPercent: 76.0, yPercent: 27.5, zoom: 2.8, description: '4360-PO-003 • 1,500 m³ (21m x 13.9m x 2.8m)', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PO-004', name: 'Piscina de Emergencia #4', category: 'POZA', cota: '3310 msnm', xPercent: 52.0, yPercent: 28.0, zoom: 2.8, description: '4140-PO-004 • 7,500 m³', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PO-005', name: 'Piscina de Emergencia #5', category: 'POZA', cota: '3305 msnm', xPercent: 61.5, yPercent: 28.5, zoom: 2.8, description: '4140-PO-005 • 2,100 m³', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PO-006', name: 'Piscina de Emergencia #6', category: 'POZA', cota: '3300 msnm', xPercent: 71.0, yPercent: 29.5, zoom: 2.8, description: '4140-PO-006 • 7,500 m³', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'PRESA', name: 'Presa de Relaves Cortadera', category: 'PRESA', cota: '3325 msnm', xPercent: 56.0, yPercent: 85.0, zoom: 2.2, description: 'Muro principal de arenas clasificadas y dique de contención', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'ESTRIBO-IZQ', name: 'Zona Sur (Estribo Izquierdo)', category: 'PRESA', cota: '3200-3325 msnm', xPercent: 50.0, yPercent: 85.5, zoom: 2.6, description: 'Disposición de arenas sector sur', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'ESTRIBO-DER', name: 'Zona Norte (Estribo Derecho)', category: 'PRESA', cota: '3200-3325 msnm', xPercent: 62.0, yPercent: 84.5, zoom: 2.6, description: 'Disposición de arenas sector norte', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'LN-001', name: 'Canaleta de Relaves 4110-LN001', category: 'CANALETA', cota: '3317 msnm', xPercent: 33.0, yPercent: 20.0, zoom: 2.6, description: '2.1 km • Pendiente 1.20% • Sección 1.20m x 1.30m', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'LN-005', name: 'Canaleta de Relaves 4110-LN005', category: 'CANALETA', cota: '3300 msnm', xPercent: 65.0, yPercent: 26.0, zoom: 2.6, description: '7.5 km • Pendiente 0.80% • Sección 1.30m x 1.40m', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'TUNEL-SALVIANI', name: 'Túnel Salviani - Capillune', category: 'CANALETA', cota: '3300 msnm', xPercent: 58.0, yPercent: 25.0, zoom: 2.8, description: 'Longitud 1.05 km (1,096 metros)', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'TUNEL-CORTADERA', name: 'Túnel Capillune - Cortadera', category: 'CANALETA', cota: '3295 msnm', xPercent: 68.0, yPercent: 26.5, zoom: 2.8, description: 'Longitud 0.50 km', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'HV-031@039', name: 'Válvulas Motorizadas Batería Ciclones', category: 'VÁLVULA', cota: '3292 msnm', xPercent: 44.5, yPercent: 40.0, zoom: 3.2, description: 'Válvulas de cuchilla automáticas entrada ciclones', sheetId: 'FLOWSHEET_1', sheetNumber: 1 },
        { tag: 'FIT-4120021', name: 'Transmisor de Flujo Alimentación Ciclones', category: 'SENSOR', cota: '3292 msnm', xPercent: 45.8, yPercent: 38.5, zoom: 3.4, description: 'Caudalímetro electromagnético de pulpa', sheetId: 'FLOWSHEET_1', sheetNumber: 1 }
      ]
    },
    {
      id: 'DRENES',
      number: 2,
      title: 'Plano P&ID Sistema de Drenes Basales y Subdrenaje de Presa Cortadera',
      shortTitle: 'Drenes de Presa',
      badge: 'Subdrenaje & Sentina',
      imageSrc: '/images/flowsheet-drenes-hd.jpg',
      downloadFileName: 'FlowSheet001_D_L2_Drenes.jpg',
      baseWidth: 1800,
      baseHeight: 511,
      nativeResolution: '4065 × 1154 px',
      description: 'Sistema de subdrenaje basal del muro de presa, zanja cortafugas WBS 4220, colectores 16" AA1F-RW, dique de escorrentía 16,500 m³, poza 4240-PO-001 y estación de sentina de bombas PU001 a PU008.',
      zones: [
        { id: 'ALL', name: 'Vista Panorámica Drenes', icon: '', cota: '', xPercent: 50, yPercent: 50, zoom: 0.95 },
        { id: 'SENTINA_D', name: 'Sentina de Drenes (PU001-08)', icon: '', cota: '2872m', xPercent: 10.3, yPercent: 43.0, zoom: 2.6 },
        { id: 'POZA_D', name: 'Poza Drenes 4240-PO-001', icon: '', cota: '3379m', xPercent: 19.2, yPercent: 78.6, zoom: 2.6 },
        { id: 'OBRA_D1', name: 'Término Dren Principal 16"', icon: '', cota: '2872m', xPercent: 32.6, yPercent: 51.8, zoom: 2.4 },
        { id: 'DIQUE_ESC', name: 'Dique Escorrentía (16,500 m³)', icon: '', cota: '2870m', xPercent: 36.6, yPercent: 60.2, zoom: 2.4 },
        { id: 'OBRA_D2', name: 'Término Dren Secundario', icon: '', cota: '2872m', xPercent: 48.0, yPercent: 53.6, zoom: 2.4 },
        { id: 'ZANJA_C', name: 'Zanja Cortafugas WBS 4220', icon: '', cota: 'Pie Presa', xPercent: 54.7, yPercent: 72.6, zoom: 2.4 }
      ],
      hotspots: [
        {
          id: 'hp-d-sentina',
          tag: 'PU-001@008',
          title: 'Estación Sentina de Drenes',
          category: 'PUMPS',
          cota: '2,872 msnm',
          xPercent: 10.3,
          yPercent: 43.0,
          description: 'Cámara de aspiración y rebombeo de filtraciones del pie de presa mediante 8 bombas sumergibles.',
          specs: [
            { label: 'Equipos', value: '8 Bombas PU001 a PU008' },
            { label: 'Potencia', value: '550 kW c/u' },
            { label: 'Caudal Nominal', value: '255 m³/h' }
          ],
          routeLink: '/pumps',
          routeLabel: 'Ver Estado de Bombas'
        },
        {
          id: 'hp-d-poza',
          tag: '4240-PO-001',
          title: 'Poza de Filtraciones y Drenes',
          category: 'DAM',
          cota: '3,379 msnm',
          xPercent: 19.2,
          yPercent: 78.6,
          description: 'Recepción y almacenamiento de aguas de subdrenaje del dique previo a recirculación.',
          specs: [
            { label: 'Volumen Útil', value: '18,500 m³' },
            { label: 'Dimensiones', value: '111m x 37m x 8.5m' },
            { label: 'Línea Alimentación', value: '16" AA1F-RW' }
          ],
          routeLink: '/tailings',
          routeLabel: 'Ver Nivel de Poza'
        },
        {
          id: 'hp-d-dique',
          tag: 'DIQUE ESCORRENTÍA',
          title: 'Dique de Almacenamiento de Escorrentía',
          category: 'DAM',
          cota: '2,870 msnm',
          xPercent: 36.6,
          yPercent: 60.2,
          description: 'Dique de contención para amortiguamiento de crecidas y escorrentías pluviales en cuenca.',
          specs: [
            { label: 'Capacidad', value: '16,500 m³' },
            { label: 'Drenaje Basal', value: 'Tuberías ranuradas 16"' }
          ],
          routeLink: '/tailings',
          routeLabel: 'Ver Reporte de Presa'
        },
        {
          id: 'hp-d-zanja',
          tag: 'WBS 4220',
          title: 'Zanja Cortafugas Basal Presa Cortadera',
          category: 'DAM',
          cota: 'Pie de Presa',
          xPercent: 54.7,
          yPercent: 72.6,
          description: 'Trinchera impermeable con geomembrana y material filtrante para captación de flujo freático.',
          specs: [
            { label: 'WBS Código', value: '4220' },
            { label: 'Monitoreo', value: 'Piezómetros de Cuerda Vibrante' }
          ],
          routeLink: '/tailings',
          routeLabel: 'Ver Piezómetros'
        }
      ],
      equipmentCatalog: [
        { tag: 'PU-001@008', name: 'Sentina de Drenes Basales (8 Bombas)', category: 'BOMBA', cota: '2872 msnm', xPercent: 10.3, yPercent: 43.0, zoom: 2.8, description: 'Estación de bombas verticales para recirculación de drenes', sheetId: 'DRENES', sheetNumber: 2 },
        { tag: '4240-PO-001', name: 'Poza de Recepción de Drenes', category: 'POZA', cota: '3379 msnm', xPercent: 19.2, yPercent: 78.6, zoom: 2.8, description: 'Capacidad 18,500 m³ (111m x 37m x 8.5m)', sheetId: 'DRENES', sheetNumber: 2 },
        { tag: '4210-0501', name: 'Línea Colectora Dren Principal 16" AA1F-RW', category: 'DREN', cota: '2872 msnm', xPercent: 34.3, yPercent: 51.8, zoom: 2.8, description: 'Tubería de acero al carbono revestida para drenes basales', sheetId: 'DRENES', sheetNumber: 2 },
        { tag: '4210-0502', name: 'Línea Colectora Subdrenaje Central 16" AA1F-RW', category: 'DREN', cota: '2872 msnm', xPercent: 48.9, yPercent: 55.7, zoom: 2.8, description: 'Conducción de filtraciones del núcleo del muro', sheetId: 'DRENES', sheetNumber: 2 },
        { tag: '4210-0503', name: 'Línea Colectora Subdrenaje Este 16" AA1F-RW', category: 'DREN', cota: '2872 msnm', xPercent: 21.9, yPercent: 78.6, zoom: 2.8, description: 'Captación de escorrentía y filtraciones estribo este', sheetId: 'DRENES', sheetNumber: 2 },
        { tag: 'DIQUE-ESC', name: 'Dique Almacenamiento Agua Escorrentía', category: 'PRESA', cota: '2870 msnm', xPercent: 36.6, yPercent: 60.2, zoom: 2.6, description: 'Embalse regulador de 16,500 m³ para control de crecidas', sheetId: 'DRENES', sheetNumber: 2 },
        { tag: 'WBS-4220', name: 'Zanja Cortafugas Basal Presa Cortadera', category: 'DREN', cota: 'Pie de Presa', xPercent: 54.7, yPercent: 72.6, zoom: 2.8, description: 'Barrera impermeable geotécnica para corte de filtraciones', sheetId: 'DRENES', sheetNumber: 2 }
      ]
    },
    {
      id: 'FLOWSHEET_2',
      number: 3,
      title: 'Diagrama P&ID Flowsheet 2.0 - Ampliación de Ciclones y Conducción',
      shortTitle: 'Flowsheet 2.0',
      badge: 'Ciclones & Conducción',
      imageSrc: '/images/flowsheet-2-0-hd.jpg',
      downloadFileName: 'FlowSheet001_D_L3_Flowsheet2.jpg',
      baseWidth: 1600,
      baseHeight: 1335,
      nativeResolution: '4065 × 3391 px',
      description: 'Ampliación y detalle de la clasificación de relaves: Espesadores 3710-TH-001/002, Puente Capillune, Línea troncal 48" AT1U-TL, Válvulas HV-4120233/234/235, Baterías CY-001 a 004, DropBoxes 4120-BX-016/017 y tuberías Cyclowash.',
      zones: [
        { id: 'ALL', name: 'Vista General Circuito', icon: '', cota: '', xPercent: 50, yPercent: 50, zoom: 0.95 },
        { id: 'ESP_3', name: 'Espesador 3710-TH & BX-001', icon: '', cota: '3317m', xPercent: 97.3, yPercent: 12.8, zoom: 2.4 },
        { id: 'PUENTE_3', name: 'Puente Capillune & 48" Troncal', icon: '', cota: '3300m', xPercent: 82.0, yPercent: 16.1, zoom: 2.4 },
        { id: 'CYC1_3', name: '1ra Etapa Ciclones CY-001/002', icon: '', cota: '3292m', xPercent: 26.7, yPercent: 33.8, zoom: 2.6 },
        { id: 'DROP_3', name: 'DropBox 4120-BX-016/017', icon: '', cota: '3267m', xPercent: 29.6, yPercent: 47.7, zoom: 2.6 },
        { id: 'CYC2_3', name: '2da Etapa Ciclones CY-003/004', icon: '', cota: '3267m', xPercent: 30.6, yPercent: 50.7, zoom: 2.6 },
        { id: 'POZA_3', name: 'Poza Drenes & Conducción', icon: '', cota: '2872m', xPercent: 24.4, yPercent: 84.5, zoom: 2.4 }
      ],
      hotspots: [
        {
          id: 'hp-f2-esp',
          tag: '3710-TH-001/002',
          title: 'Espesadores de Relaves & BX-001',
          category: 'FEED',
          cota: '3,317 msnm',
          xPercent: 97.3,
          yPercent: 12.8,
          description: 'Descarga de pulpa espesada hacia cajón 3710-BX-001 y alimentación a canaleta por gravedad.',
          specs: [
            { label: 'Espesadores', value: '2 unidades 3710-TH-001/002' },
            { label: 'Densidad Salida', value: '1.45 t/m³ (48-50% S)' }
          ],
          routeLink: '/calculators',
          routeLabel: 'Calculadora de Sólidos'
        },
        {
          id: 'hp-f2-puente',
          tag: '4120-BX-004',
          title: 'Puente Capillune & Troncal 48"',
          category: 'FEED',
          cota: '3,300 msnm',
          xPercent: 82.0,
          yPercent: 16.1,
          description: 'Cajón de carga y puente de cruce para tubería de conducción de relaves 48" AT1U-TL.',
          specs: [
            { label: 'Tubería', value: '48" AT1U-TL (1,200 mm)' },
            { label: 'Capacidad', value: '7,751 m³/h' }
          ],
          routeLink: '/tailings',
          routeLabel: 'Ver Conducción'
        },
        {
          id: 'hp-f2-cyc1',
          tag: 'CY-001/002',
          title: 'Batería 1ra Etapa Ciclones',
          category: 'CYCLONES',
          cota: '3,292 msnm',
          xPercent: 26.7,
          yPercent: 33.8,
          description: '18 Ciclones Gmax 20 por nido con válvulas cuchilla motorizadas HV-4120233.',
          specs: [
            { label: 'Caudal', value: '5,639 t/h' },
            { label: 'Cyclowash', value: '310 m³/h agua lavado' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver Baterías Ciclones'
        },
        {
          id: 'hp-f2-drop',
          tag: '4120-BX-016',
          title: 'DropBox Alimentación 2da Etapa',
          category: 'CYCLONES',
          cota: '3,267 msnm',
          xPercent: 29.6,
          yPercent: 47.7,
          description: 'Disipador de presión y distribuidor DropBox hacia nidos de 2da etapa.',
          specs: [
            { label: 'DropBoxes', value: 'BX-016 y BX-017' },
            { label: 'Alimentación', value: 'Underflow 1ra etapa' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver DropBox'
        },
        {
          id: 'hp-f2-cyc2',
          tag: 'CY-003/004',
          title: 'Batería 2da Etapa Ciclones',
          category: 'CYCLONES',
          cota: '3,267 msnm',
          xPercent: 30.6,
          yPercent: 50.7,
          description: '6 Ciclones Gmax 26 para separación fina y producción de arenas UF 70% sólidos.',
          specs: [
            { label: 'Arenas UF', value: '70% Sólidos (M-200 <= 18%)' },
            { label: 'Producción', value: '868.5 t/h arenas muro' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver Arenas Muro'
        }
      ],
      equipmentCatalog: [
        { tag: '3710-TH-001', name: 'Espesador de Relaves #1', category: 'CAJÓN', cota: '3317 msnm', xPercent: 97.3, yPercent: 12.8, zoom: 2.6, description: 'Espesador de alta densidad para separación sólido-líquido', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '3710-TH-002', name: 'Espesador de Relaves #2', category: 'CAJÓN', cota: '3317 msnm', xPercent: 97.3, yPercent: 14.0, zoom: 2.6, description: 'Espesador de alta densidad para separación sólido-líquido', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '3710-BX-001', name: 'Cajón Descarga Espesador', category: 'CAJÓN', cota: '3317 msnm', xPercent: 95.0, yPercent: 14.5, zoom: 2.8, description: 'Recepción de pulpa espesada 48-50% sólidos', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '4120-BX-004', name: 'Cajón Carga Puente Capillune', category: 'CAJÓN', cota: '3300 msnm', xPercent: 82.0, yPercent: 16.1, zoom: 2.8, description: 'Distribución y carga de pulpa hacia túnel', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: 'AT1U-48', name: 'Tubería Troncal Relaves 48" AT1U-TL', category: 'CANALETA', cota: '3300 msnm', xPercent: 75.0, yPercent: 20.0, zoom: 2.6, description: 'Conducción principal de pulpa slurry de 1,200 mm', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '4120-CY-001', name: 'Nido Ciclones 1ra Etapa A', category: 'CICLÓN', cota: '3292 msnm', xPercent: 26.7, yPercent: 33.8, zoom: 2.8, description: '18 Ciclones Gmax 20 (13 Oper / 5 Res) • 20-23 PSI', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '4120-CY-002', name: 'Nido Ciclones 1ra Etapa B', category: 'CICLÓN', cota: '3292 msnm', xPercent: 29.5, yPercent: 33.8, zoom: 2.8, description: '18 Ciclones Gmax 20 con sistema Cyclowash 310 m³/h', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '4120-BX-016', name: 'DropBox Alimentación 2da Etapa A', category: 'CAJÓN', cota: '3267 msnm', xPercent: 29.6, yPercent: 47.7, zoom: 2.8, description: 'DropBox disipador de energía para segunda etapa', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '4120-CY-003', name: 'Nido Ciclones 2da Etapa A', category: 'CICLÓN', cota: '3267 msnm', xPercent: 30.6, yPercent: 50.7, zoom: 2.8, description: '6 Ciclones Gmax 26 para deslamado final', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: '4120-CY-004', name: 'Nido Ciclones 2da Etapa B', category: 'CICLÓN', cota: '3267 msnm', xPercent: 33.0, yPercent: 50.7, zoom: 2.8, description: 'Underflow 70% sólidos para muro de presa', sheetId: 'FLOWSHEET_2', sheetNumber: 3 },
        { tag: 'HV-4120233', name: 'Válvula Cuchilla Motorizada HV-233', category: 'VÁLVULA', cota: '3292 msnm', xPercent: 36.0, yPercent: 35.0, zoom: 3.0, description: 'Aislamiento y control motorizado de nido de ciclones', sheetId: 'FLOWSHEET_2', sheetNumber: 3 }
      ]
    },
    {
      id: 'BALANCES',
      number: 4,
      title: 'Diagrama P&ID Balances Metalúrgicos de Masa, Pulpa y Agua de Proceso',
      shortTitle: 'Balances de Masa',
      badge: 'Balance Metalúrgico',
      imageSrc: '/images/flowsheet-balances-hd.jpg',
      downloadFileName: 'FlowSheet001_D_L4_Balances.jpg',
      baseWidth: 1600,
      baseHeight: 1335,
      nativeResolution: '4065 × 3391 px',
      description: 'Balances metalúrgicos de materia: caudales másicos y volumétricos (t/h y m³/h), porcentaje de sólidos, densidades de pulpa, balances de agua recuperada de Torre 5 y dilución Cyclowash.',
      zones: [
        { id: 'ALL', name: 'Vista General Balances', icon: '', cota: '', xPercent: 50, yPercent: 50, zoom: 0.95 },
        { id: 'BAL_ALIM', name: 'Alimentación Espesador (5,639 t/h)', icon: '', cota: '48% Sólidos', xPercent: 85.0, yPercent: 15.0, zoom: 2.4 },
        { id: 'BAL_CYC1', name: 'Balance 1ra Etapa Ciclones', icon: '', cota: '62% Sólidos UF', xPercent: 28.0, yPercent: 35.0, zoom: 2.5 },
        { id: 'BAL_WASH', name: 'Dilución Cyclowash (310 m³/h)', icon: '', cota: 'Agua Lavado', xPercent: 29.0, yPercent: 31.0, zoom: 2.8 },
        { id: 'BAL_CYC2', name: 'Balance 2da Etapa Arenas Muro', icon: '', cota: '70% Sólidos UF', xPercent: 31.0, yPercent: 52.0, zoom: 2.5 },
        { id: 'BAL_TORRE5', name: 'Retorno Agua Clara Torre 5', icon: '', cota: 'Recirculación', xPercent: 75.0, yPercent: 75.0, zoom: 2.4 }
      ],
      hotspots: [
        {
          id: 'hp-b-alim',
          tag: '5,639 t/h',
          title: 'Balance de Alimentación Espesada',
          category: 'FEED',
          cota: '3,317 msnm',
          xPercent: 85.0,
          yPercent: 15.0,
          description: 'Caudal másico de relave concentrador hacia Presa Cortadera.',
          specs: [
            { label: 'Caudal Másico', value: '5,639 t/h sólidos' },
            { label: 'Caudal Volumétrico', value: '7,751 m³/h pulpa' },
            { label: 'Concentración', value: '48.0% - 50.0% Sólidos' },
            { label: 'Densidad', value: '1.45 t/m³' }
          ],
          routeLink: '/calculators',
          routeLabel: 'Calculadora de Masa'
        },
        {
          id: 'hp-b-cyc1',
          tag: 'UF 62% S',
          title: 'Balance 1ra Etapa Ciclones',
          category: 'CYCLONES',
          cota: '3,292 msnm',
          xPercent: 28.0,
          yPercent: 35.0,
          description: 'Distribución de arenas (underflow) y lamas hacia cubeta de decantación.',
          specs: [
            { label: 'Underflow', value: '62.0% Sólidos' },
            { label: 'Finura UF', value: '33.1% Malla -200' },
            { label: 'Overflow', value: 'Lamas finas hacia embalse' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver Ensayos Metalúrgicos'
        },
        {
          id: 'hp-b-wash',
          tag: '310 m³/h',
          title: 'Agua de Dilución Cyclowash',
          category: 'CYCLONES',
          cota: '3,292 msnm',
          xPercent: 29.0,
          yPercent: 31.0,
          description: 'Inyección de agua a presión para lavado de ultrafinos en underflow de ciclones.',
          specs: [
            { label: 'Caudal Inyección', value: '310 m³/h' },
            { label: 'Presión Línea', value: '3.5 a 4.0 bar' },
            { label: 'Efecto', value: 'Reducción de lamas en muro' }
          ],
          routeLink: '/cyclones',
          routeLabel: 'Ver Parámetros Cyclowash'
        },
        {
          id: 'hp-b-cyc2',
          tag: 'UF 70% S',
          title: 'Balance Arenas Muro (UF 2da Etapa)',
          category: 'DAM',
          cota: '3,267 msnm',
          xPercent: 31.0,
          yPercent: 52.0,
          description: 'Arenas hidrociclonadas de alta densidad para compactación mecánica del dique.',
          specs: [
            { label: 'Concentración UF', value: '70.0% Sólidos (GISTM)' },
            { label: 'Control Finos', value: '<= 18.0% Malla -200' },
            { label: 'Tasa Deposición', value: '868.5 t/h en muro' },
            { label: 'Compactación', value: '95% Proctor Estándar' }
          ],
          routeLink: '/tailings',
          routeLabel: 'Ver Balance de Presa'
        },
        {
          id: 'hp-b-ret',
          tag: 'TORRE 5 RET',
          title: 'Balance Recirculación Agua Clara',
          category: 'PUMPS',
          cota: '3,050 msnm',
          xPercent: 75.0,
          yPercent: 75.0,
          description: 'Recuperación de agua clarificada en laguna de decantación hacia planta concentradora.',
          specs: [
            { label: 'Caudal Bombeo', value: '720 m³/h por bomba' },
            { label: 'Bombas en Línea', value: 'PU021 a PU030' },
            { label: 'Distancia Conducción', value: '14.6 km en 36" hacia TK-3720' }
          ],
          routeLink: '/pumps',
          routeLabel: 'Ver Bombas Torre 5'
        }
      ],
      equipmentCatalog: [
        { tag: 'BAL-ALIM', name: 'Flujo Alimentación General Planta', category: 'BALANCE', cota: '3317 msnm', xPercent: 85.0, yPercent: 15.0, zoom: 2.6, description: '5,639 t/h (7,751 m³/h) • 48% a 50% Sólidos • Densidad 1.45 t/m³', sheetId: 'BALANCES', sheetNumber: 4 },
        { tag: 'BAL-UF1', name: 'Balance Underflow 1ra Etapa Ciclones', category: 'BALANCE', cota: '3292 msnm', xPercent: 28.0, yPercent: 35.0, zoom: 2.8, description: '62% Sólidos • 33.1% Malla -200 • Conducción hacia 2da etapa', sheetId: 'BALANCES', sheetNumber: 4 },
        { tag: 'BAL-OF1', name: 'Balance Overflow Lamas 1ra Etapa', category: 'BALANCE', cota: '3292 msnm', xPercent: 34.0, yPercent: 35.0, zoom: 2.8, description: 'Lamas finas descargadas hacia cubeta del embalse', sheetId: 'BALANCES', sheetNumber: 4 },
        { tag: 'BAL-WASH', name: 'Agua de Dilución Cyclowash', category: 'BALANCE', cota: '3292 msnm', xPercent: 29.0, yPercent: 31.0, zoom: 2.8, description: 'Caudal de 310 m³/h para deslamado forzado de arenas', sheetId: 'BALANCES', sheetNumber: 4 },
        { tag: 'BAL-UF2', name: 'Balance Arenas Muro de Presa (UF 2da)', category: 'BALANCE', cota: '3267 msnm', xPercent: 31.0, yPercent: 52.0, zoom: 2.8, description: '70% Sólidos • <= 18% Malla -200 • 868.5 t/h para muro', sheetId: 'BALANCES', sheetNumber: 4 },
        { tag: 'BAL-REC', name: 'Recirculación Agua Clara Torre 5', category: 'BALANCE', cota: '3050 msnm', xPercent: 75.0, yPercent: 75.0, zoom: 2.6, description: '720 m³/h por bomba hacia tanque TK-3720 (14.6 km en 36")', sheetId: 'BALANCES', sheetNumber: 4 }
      ]
    }
  ];

  // Active Sheet & Reactive State Signals
  selectedSheet = signal<FlowsheetSheet>(this.sheets[0]);
  currentZones = computed(() => this.selectedSheet().zones);
  currentHotspots = computed(() => this.selectedSheet().hotspots);
  imageBaseWidth = computed(() => this.selectedSheet().baseWidth);
  imageBaseHeight = computed(() => this.selectedSheet().baseHeight);

  // Combined searchable catalog across all sheets
  allEquipmentCatalog = computed<SearchableTagItem[]>(() => {
    const list: SearchableTagItem[] = [];
    for (const sheet of this.sheets) {
      list.push(...sheet.equipmentCatalog);
    }
    return list;
  });

  // Sheet Selection Actions
  selectSheet(sheet: FlowsheetSheet): void {
    if (this.selectedSheet().id === sheet.id) return;
    this.selectedSheet.set(sheet);
    this.activeHotspot.set(null);
    this.spotlightCoord.set(null);
    this.selectedZoneId.set('ALL');
    setTimeout(() => {
      this.fitToScreen();
      this.cdr.markForCheck();
    }, 40);
  }

  onSheetIdChange(sheetId: string): void {
    const s = this.sheets.find(item => item.id === sheetId);
    if (s) {
      this.selectSheet(s);
    }
  }

  ngOnInit(): void {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    window.addEventListener('basetrack_cloud_sync', this.onCloudSync);

    // Initial Telemetry & Maintenance Load
    this.loadLiveTelemetry();
    this.loadMaintenanceTickets();
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    window.removeEventListener('basetrack_cloud_sync', this.onCloudSync);
    if (this.spotlightTimer) {
      clearTimeout(this.spotlightTimer);
    }
  }

  private onCloudSync = (e: any): void => {
    // Avoid local recursive loops
    if (e.detail?.source === 'local') return;

    this.ngZone.run(() => {
      this.loadLiveTelemetry();
      this.loadMaintenanceTickets();
      this.cdr.markForCheck();
    });
  };

  // Telemetry Data Loader (Prioridad 1)
  private loadLiveTelemetry(): void {
    // 1. Pumps Status from cache or local store
    const latestPumpSheet = getRealtimeData<any>('basetrack_pump_sheet_latest', null);
    if (latestPumpSheet) {
      this.parsePumpsSheet(latestPumpSheet);
    } else {
      // Fetch from API
      this.http.get<any>(`${getApiBaseUrl()}/api/pumps/operational-sheet`).subscribe({
        next: (res) => {
          if (res?.data) this.parsePumpsSheet(res.data);
        },
        error: () => {}
      });
    }

    // 2. Tailings Status
    const tailingsReports = getRealtimeData<any[]>('basetrack_tailings_reports', []);
    if (tailingsReports && tailingsReports.length > 0) {
      const latest = tailingsReports[0];
      if (latest.freeboard_meters) this.tailingsFreeboard.set(latest.freeboard_meters);
      if (latest.dam_level_meters) this.tailingsDamLevel.set(latest.dam_level_meters);
    }

    // 3. Cyclones Averages
    const cycloneSamples = getRealtimeData<any[]>('basetrack_cyclones_samples', []);
    if (cycloneSamples && cycloneSamples.length > 0) {
      const validUf = cycloneSamples.filter(s => s.solids_uf > 0);
      if (validUf.length > 0) {
        const avg = validUf.reduce((acc, s) => acc + s.solids_uf, 0) / validUf.length;
        this.cyclonesSolidsUf.set(+avg.toFixed(1));
      }
    }
  }

  private parsePumpsSheet(sheet: any): void {
    if (sheet.sentina_pumps && Array.isArray(sheet.sentina_pumps)) {
      const op = sheet.sentina_pumps.filter((p: any) => p.status === 'Operativo').length;
      const fails = sheet.sentina_pumps.filter((p: any) => p.status === 'Falla').map((p: any) => p.tag);
      this.sentinaStats.set({ operating: op, total: 8, failures: fails });
    }
    if (sheet.intermedia_pumps && Array.isArray(sheet.intermedia_pumps)) {
      const op = sheet.intermedia_pumps.filter((p: any) => p.status === 'Operativo').length;
      const fails = sheet.intermedia_pumps.filter((p: any) => p.status === 'Falla').map((p: any) => p.tag);
      this.intermediaStats.set({ operating: op, total: 6, failures: fails });
    }
    if (sheet.torre5_pumps && Array.isArray(sheet.torre5_pumps)) {
      const op = sheet.torre5_pumps.filter((p: any) => p.status === 'Operativo').length;
      const fails = sheet.torre5_pumps.filter((p: any) => p.status === 'Falla').map((p: any) => p.tag);
      this.torre5Stats.set({ operating: op, total: 10, failures: fails });
    }
  }

  // Maintenance Tickets Loader (Prioridad 4)
  private loadMaintenanceTickets(): void {
    const localTickets = getRealtimeData<MaintenanceTicketItem[]>('maintenance_tickets', []);
    const activeTags = new Set<string>();

    localTickets.forEach(t => {
      if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') {
        activeTags.add(t.equipment_tag.toUpperCase());
      }
    });

    this.activeMaintenanceTags.set(activeTags);

    // Also fetch from backend
    this.http.get<any>(`${getApiBaseUrl()}/api/maintenance`).subscribe({
      next: (res) => {
        if (res?.data && Array.isArray(res.data)) {
          const remoteTags = new Set<string>();
          res.data.forEach((t: any) => {
            if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') {
              remoteTags.add(t.equipment_tag.toUpperCase());
            }
          });
          this.activeMaintenanceTags.set(remoteTags);
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });
  }

  hasActiveMaintenance(tag: string): boolean {
    const cleanTag = tag.toUpperCase();
    for (const t of this.activeMaintenanceTags()) {
      if (t.includes(cleanTag) || cleanTag.includes(t)) return true;
    }
    return false;
  }

  // Telemetry labels for Markers and Popovers
  getMarkerLiveStatus(hp: FlowsheetHotspot): string | null {
    if (hp.id === 'hp-sentina') return `${this.sentinaStats().operating}/8 Op.`;
    if (hp.id === 'hp-intermedia') return `${this.intermediaStats().operating}/6 Op.`;
    if (hp.id === 'hp-torre5') return `${this.torre5Stats().operating}/10 Op.`;
    if (hp.id === 'hp-dam') return `${this.tailingsFreeboard()}m BL`;
    if (hp.id === 'hp-cyc2') return `${this.cyclonesSolidsUf()}% S`;
    return null;
  }

  getPopoverLiveTelemetry(hp: FlowsheetHotspot): { label: string; value: string; color?: string }[] | null {
    if (hp.id === 'hp-sentina') {
      const stats = this.sentinaStats();
      return [
        { label: 'Bombas en Operación', value: `${stats.operating} de 8 unidades`, color: stats.operating >= 6 ? 'text-emerald' : 'text-amber' },
        { label: 'Unidades en Falla', value: stats.failures.length > 0 ? stats.failures.join(', ') : 'Ninguna (0)', color: stats.failures.length > 0 ? 'text-red' : '' },
        { label: 'Disponibilidad de Estación', value: `${((stats.operating / 8) * 100).toFixed(0)}%` }
      ];
    }
    if (hp.id === 'hp-intermedia') {
      const stats = this.intermediaStats();
      return [
        { label: 'Bombas en Operación', value: `${stats.operating} de 6 unidades`, color: stats.operating >= 5 ? 'text-emerald' : 'text-amber' },
        { label: 'Unidades en Falla', value: stats.failures.length > 0 ? stats.failures.join(', ') : 'Ninguna (0)' },
        { label: 'Disponibilidad de Estación', value: `${((stats.operating / 6) * 100).toFixed(0)}%` }
      ];
    }
    if (hp.id === 'hp-torre5') {
      const stats = this.torre5Stats();
      return [
        { label: 'Bombas en Operación', value: `${stats.operating} de 10 unidades`, color: stats.operating >= 8 ? 'text-emerald' : 'text-amber' },
        { label: 'Unidades en Falla', value: stats.failures.length > 0 ? stats.failures.join(', ') : 'Ninguna (0)' },
        { label: 'Disponibilidad de Estación', value: `${((stats.operating / 10) * 100).toFixed(0)}%` }
      ];
    }
    if (hp.id === 'hp-dam') {
      return [
        { label: 'Borde Libre Actual', value: `${this.tailingsFreeboard()} m`, color: this.isFreeboardLow() ? 'text-amber' : 'text-emerald' },
        { label: 'Cota de Espejo de Agua', value: `${this.tailingsDamLevel()} msnm` },
        { label: 'Margen Mínimo Reglamentario', value: `≥ ${this.plantParamsService.minFreeboard()} m (D.S. 024-2016-EM)` }
      ];
    }
    if (hp.id === 'hp-cyc2') {
      return [
        { label: '% Sólidos Underflow Actual', value: `${this.cyclonesSolidsUf()}% Sólidos`, color: 'text-emerald' },
        { label: 'Meta Operacional de Ciclones', value: '70.0% Sólidos' },
        { label: 'Control Malla -200M', value: `${this.cyclonesMesh200}% (Norma ≤ 18%)` }
      ];
    }
    return null;
  }

  // Search Logic (Prioridad 2: Multi-Lámina)
  onSearchInput(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredEquipment.set([]);
      return;
    }

    const matches = this.allEquipmentCatalog().filter(eq => 
      eq.tag.toLowerCase().includes(q) ||
      eq.name.toLowerCase().includes(q) ||
      eq.category.toLowerCase().includes(q) ||
      eq.description.toLowerCase().includes(q) ||
      (eq.cota && eq.cota.toLowerCase().includes(q))
    );

    this.filteredEquipment.set(matches.slice(0, 10));
  }

  selectEquipment(eq: SearchableTagItem): void {
    this.searchQuery = `${eq.tag} - ${eq.name}`;
    this.isSearchFocused.set(false);

    // If item belongs to another sheet, switch sheet first
    if (eq.sheetId && eq.sheetId !== this.selectedSheet().id) {
      const targetSheet = this.sheets.find(s => s.id === eq.sheetId);
      if (targetSheet) {
        this.selectedSheet.set(targetSheet);
        this.selectedZoneId.set('ALL');
      }
    }

    // Smooth Fly-to camera
    this.flyToCoordinate(eq.xPercent, eq.yPercent, eq.zoom || 2.8);

    // Trigger Beacon Spotlight
    this.spotlightCoord.set({ x: eq.xPercent, y: eq.yPercent });
    this.spotlightTag.set(`${eq.tag} • ${eq.name}`);

    if (this.spotlightTimer) clearTimeout(this.spotlightTimer);
    this.spotlightTimer = setTimeout(() => {
      this.spotlightCoord.set(null);
      this.cdr.markForCheck();
    }, 4500);

    // If an associated hotspot exists in the active sheet, open its card
    const curHp = this.selectedSheet().hotspots;
    const matchedHp = curHp.find(h => h.tag.includes(eq.tag) || eq.tag.includes(h.tag));
    if (matchedHp) {
      this.activeHotspot.set(matchedHp);
    } else {
      this.activeHotspot.set(null);
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filteredEquipment.set([]);
    this.isSearchFocused.set(false);
  }

  private flyToCoordinate(xPercent: number, yPercent: number, targetZoom: number): void {
    if (!this.viewportRef?.nativeElement) return;
    const vp = this.viewportRef.nativeElement;
    const vpWidth = vp.clientWidth || window.innerWidth;
    const vpHeight = vp.clientHeight || (window.innerHeight - 150);

    this.zoom.set(targetZoom);

    const targetX = (xPercent / 100) * this.imageBaseWidth() * targetZoom;
    const targetY = (yPercent / 100) * this.imageBaseHeight() * targetZoom;

    const newPanX = Math.floor(vpWidth / 2 - targetX);
    const newPanY = Math.floor(vpHeight / 2 - targetY);

    this.panX.set(newPanX);
    this.panY.set(newPanY);
  }

  // Mini-Mapa Navigation (Prioridad 3)
  toggleRadarMiniMap(): void {
    this.showRadarMap.update(v => !v);
  }

  // Computes the viewport indicator box in the mini-map
  miniMapBox = computed(() => {
    const vp = this.viewportRef?.nativeElement;
    const vpWidth = vp ? vp.clientWidth : 800;
    const vpHeight = vp ? vp.clientHeight : 600;

    const miniMapWidth = 140;
    const miniMapHeight = 170;

    const curZoom = this.zoom();
    const curPanX = this.panX();
    const curPanY = this.panY();

    const scaledImgW = this.imageBaseWidth() * curZoom;
    const scaledImgH = this.imageBaseHeight() * curZoom;

    // Viewport box in terms of mini-map pixels
    const boxW = Math.max(15, Math.min(miniMapWidth, (vpWidth / scaledImgW) * miniMapWidth));
    const boxH = Math.max(15, Math.min(miniMapHeight, (vpHeight / scaledImgH) * miniMapHeight));

    const boxX = Math.max(0, Math.min(miniMapWidth - boxW, (-curPanX / scaledImgW) * miniMapWidth));
    const boxY = Math.max(0, Math.min(miniMapHeight - boxH, (-curPanY / scaledImgH) * miniMapHeight));

    return { x: boxX, y: boxY, w: boxW, h: boxH };
  });

  onMiniMapClick(e: MouseEvent): void {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPct = (clickX / rect.width) * 100;
    const yPct = (clickY / rect.height) * 100;

    this.flyToCoordinate(xPct, yPct, Math.max(1.5, this.zoom()));
  }

  onImageLoaded(): void {
    this.fitToScreen();
  }

  // Zoom Controls
  zoomIn(): void {
    this.zoom.update(z => Math.min(5.0, +(z * 1.25).toFixed(2)));
  }

  zoomOut(): void {
    this.zoom.update(z => Math.max(0.4, +(z / 1.25).toFixed(2)));
  }

  resetZoom(): void {
    this.zoom.set(1.0);
    this.panX.set(0);
    this.panY.set(0);
    this.selectedZoneId.set('ALL');
  }

  fitToScreen(): void {
    if (!this.viewportRef?.nativeElement) return;
    const vp = this.viewportRef.nativeElement;
    const vpWidth = vp.clientWidth || window.innerWidth;
    const vpHeight = vp.clientHeight || (window.innerHeight - 150);

    const scaleX = (vpWidth - 40) / this.imageBaseWidth();
    const scaleY = (vpHeight - 40) / this.imageBaseHeight();
    const fitScale = Math.min(scaleX, scaleY, 1.2);

    this.zoom.set(Math.max(0.2, +fitScale.toFixed(2)));

    const scaledWidth = this.imageBaseWidth() * this.zoom();
    const scaledHeight = this.imageBaseHeight() * this.zoom();
    this.panX.set(Math.max(10, Math.floor((vpWidth - scaledWidth) / 2)));
    this.panY.set(Math.max(10, Math.floor((vpHeight - scaledHeight) / 2)));
    this.selectedZoneId.set('ALL');
  }

  // Quick Zone Jump
  jumpToZone(zone: ZoneFocus): void {
    this.selectedZoneId.set(zone.id);
    this.activeHotspot.set(null);

    if (zone.id === 'ALL') {
      this.fitToScreen();
      return;
    }

    this.flyToCoordinate(zone.xPercent, zone.yPercent, zone.zoom);
  }

  // Mouse Pan & Wheel Handling
  onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.startX = e.clientX - this.panX();
    this.startY = e.clientY - this.panY();
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.panX.set(e.clientX - this.startX);
    this.panY.set(e.clientY - this.startY);
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const vp = this.viewportRef?.nativeElement;
    if (!vp) return;

    const rect = vp.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY < 0 ? 1.15 : 0.87;
    const currentZoom = this.zoom();
    const newZoom = Math.min(5.0, Math.max(0.4, +(currentZoom * delta).toFixed(2)));

    if (newZoom === currentZoom) return;

    const currentPanX = this.panX();
    const currentPanY = this.panY();

    const newPanX = mouseX - (mouseX - currentPanX) * (newZoom / currentZoom);
    const newPanY = mouseY - (mouseY - currentPanY) * (newZoom / currentZoom);

    this.zoom.set(newZoom);
    this.panX.set(Math.floor(newPanX));
    this.panY.set(Math.floor(newPanY));
  }

  // Touch Drag & Pinch-to-Zoom
  onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.startX = e.touches[0].clientX - this.panX();
      this.startY = e.touches[0].clientY - this.panY();
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      this.initialTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      this.initialTouchZoom = this.zoom();
    }
  }

  onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1 && this.isDragging) {
      this.panX.set(e.touches[0].clientX - this.startX);
      this.panY.set(e.touches[0].clientY - this.startY);
    } else if (e.touches.length === 2) {
      const dist = this.getTouchDistance(e.touches[0], e.touches[1]);
      if (this.initialTouchDistance > 0) {
        const factor = dist / this.initialTouchDistance;
        const newZoom = Math.min(5.0, Math.max(0.4, +(this.initialTouchZoom * factor).toFixed(2)));
        this.zoom.set(newZoom);
      }
    }
  }

  onTouchEnd(): void {
    this.isDragging = false;
    this.initialTouchDistance = 0;
  }

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Hotspots Interaction
  onHotspotClick(hotspot: FlowsheetHotspot, e: MouseEvent): void {
    e.stopPropagation();
    if (this.activeHotspot()?.id === hotspot.id) {
      this.activeHotspot.set(null);
    } else {
      this.activeHotspot.set(hotspot);
      this.ensureHotspotInView(hotspot);
    }
  }

  ensureHotspotInView(hotspot: FlowsheetHotspot): void {
    if (!this.viewportRef?.nativeElement) return;
    const vp = this.viewportRef.nativeElement;
    const vpWidth = vp.clientWidth || window.innerWidth;
    const vpHeight = vp.clientHeight || (window.innerHeight - 150);

    const curZoom = this.zoom();
    const curPanX = this.panX();
    const curPanY = this.panY();

    const hpScreenX = (hotspot.xPercent / 100) * this.imageBaseWidth() * curZoom + curPanX;
    const hpScreenY = (hotspot.yPercent / 100) * this.imageBaseHeight() * curZoom + curPanY;

    const popoverWidth = 300;
    const popoverHeight = 350;

    let deltaX = 0;
    let deltaY = 0;

    if (hotspot.yPercent > 45) {
      // Popover is ABOVE marker
      const popoverTop = hpScreenY - popoverHeight - 20;
      if (popoverTop < 40) {
        deltaY = 40 - popoverTop;
      }
      if (hpScreenY > vpHeight - 35) {
        deltaY = (vpHeight - 35) - hpScreenY;
      }
    } else {
      // Popover is BELOW marker
      const popoverBottom = hpScreenY + popoverHeight + 20;
      if (popoverBottom > vpHeight - 40) {
        deltaY = (vpHeight - 40) - popoverBottom;
      }
      if (hpScreenY < 35) {
        deltaY = 35 - hpScreenY;
      }
    }

    const halfWidth = popoverWidth / 2;
    if (hotspot.xPercent >= 25 && hotspot.xPercent <= 75) {
      if (hpScreenX - halfWidth < 20) {
        deltaX = 20 - (hpScreenX - halfWidth);
      } else if (hpScreenX + halfWidth > vpWidth - 20) {
        deltaX = (vpWidth - 20) - (hpScreenX + halfWidth);
      }
    } else if (hotspot.xPercent < 25) {
      if (hpScreenX + popoverWidth > vpWidth - 20) {
        deltaX = (vpWidth - 20) - (hpScreenX + popoverWidth);
      }
    } else {
      if (hpScreenX - popoverWidth < 20) {
        deltaX = 20 - (hpScreenX - popoverWidth);
      }
    }

    if (deltaX !== 0 || deltaY !== 0) {
      this.panX.update(px => Math.round(px + deltaX));
      this.panY.update(py => Math.round(py + deltaY));
      this.cdr.markForCheck();
    }
  }

  toggleSpecDrawer(): void {
    this.showSpecDrawer.update(v => !v);
  }

  // Fullscreen Management
  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
          this.isFullscreen.update(v => !v);
        });
      } else {
        this.isFullscreen.update(v => !v);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      this.isFullscreen.set(false);
    }
  }

  private onFullscreenChange = (): void => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  // Download Action
  downloadImage(): void {
    const s = this.selectedSheet();
    const link = document.createElement('a');
    link.href = s.imageSrc;
    link.download = s.downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
