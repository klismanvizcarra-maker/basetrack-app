import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { ModalComponent } from '../../shared/ui/modal.component';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';
import { AuthService } from '../../core/auth/auth.service';

export interface MaintenanceRequest {
  id: string;
  ticket_number: string;
  equipment_tag: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  requester_name: string;
  assigned_to?: string;
  photo_url: string;
  estimated_hours: number;
  source_module?: string;
  operational_pass_by?: string;
  operational_pass_at?: string;
  resolution_notes?: string;
  created_at: string;
}

@Component({
  selector: 'app-maintenance',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="maintenance-page animate-fade-in">
      <!-- Top Action Bar -->
      <div class="page-top-bar">
        <div class="title-section">
          <div class="title-with-pill">
            <h2>Gestión de Mantenimiento & Órdenes de Trabajo</h2>
            <span class="module-chip">CMMS v2.6</span>
          </div>
          <p class="section-sub">Control de órdenes de trabajo de campo, telemetría de fallas y restitución operativa</p>
        </div>
        <button class="btn btn-primary btn-new-ticket" (click)="openCreateModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nueva Solicitud con Foto
        </button>
      </div>

      <!-- KPI Executive Summary Cards -->
      <div class="kpi-stats-grid">
        <div class="kpi-card" (click)="setStatusFilter('ALL')" [class.active]="selectedStatusFilter === 'ALL'">
          <div class="kpi-icon-wrap total">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div class="kpi-info">
            <span class="kpi-val">{{ tickets.length }}</span>
            <span class="kpi-lbl">Total Órdenes</span>
          </div>
        </div>

        <div class="kpi-card" (click)="setStatusFilter('PENDING')" [class.active]="selectedStatusFilter === 'PENDING'">
          <div class="kpi-icon-wrap pending">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="kpi-info">
            <span class="kpi-val text-warning">{{ getCountByStatus('PENDING') }}</span>
            <span class="kpi-lbl">Pendientes</span>
          </div>
        </div>

        <div class="kpi-card" (click)="setStatusFilter('IN_PROGRESS')" [class.active]="selectedStatusFilter === 'IN_PROGRESS'">
          <div class="kpi-icon-wrap progress">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div class="kpi-info">
            <span class="kpi-val text-primary-accent">{{ getCountByStatus('IN_PROGRESS') }}</span>
            <span class="kpi-lbl">En Intervención</span>
          </div>
        </div>

        <div class="kpi-card" (click)="setStatusFilter('RESOLVED')" [class.active]="selectedStatusFilter === 'RESOLVED'">
          <div class="kpi-icon-wrap resolved">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div class="kpi-info">
            <span class="kpi-val text-success">{{ getCountByStatus('RESOLVED') }}</span>
            <span class="kpi-lbl">Con Pase Operativo</span>
          </div>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="toolbar-bar">
        <div class="search-input-wrap">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            placeholder="Filtrar por equipo (ej: PU025), N° OT o responsable..." 
            class="search-input"
          />
          <button *ngIf="searchQuery" (click)="searchQuery = ''" class="clear-search-btn" title="Limpiar filtro">×</button>
        </div>

        <div class="filter-pills-row">
          <button class="pill-filter" [class.active]="selectedStatusFilter === 'ALL'" (click)="setStatusFilter('ALL')">
            Todas ({{ tickets.length }})
          </button>
          <button class="pill-filter" [class.active]="selectedStatusFilter === 'PENDING'" (click)="setStatusFilter('PENDING')">
            <span class="status-dot dot-warning"></span>
            Pendientes ({{ getCountByStatus('PENDING') }})
          </button>
          <button class="pill-filter" [class.active]="selectedStatusFilter === 'IN_PROGRESS'" (click)="setStatusFilter('IN_PROGRESS')">
            <span class="status-dot dot-info"></span>
            En Proceso ({{ getCountByStatus('IN_PROGRESS') }})
          </button>
          <button class="pill-filter" [class.active]="selectedStatusFilter === 'RESOLVED'" (click)="setStatusFilter('RESOLVED')">
            <span class="status-dot dot-success"></span>
            Resueltas ({{ getCountByStatus('RESOLVED') }})
          </button>
        </div>
      </div>

      <!-- Discipline / Specialty Filter Toolbar -->
      <div class="discipline-toolbar">
        <span class="discipline-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          Especialidad:
        </span>
        <div class="discipline-pills-row">
          <button class="pill-discipline" [class.active]="selectedDiscipline === 'ALL'" (click)="setDisciplineFilter('ALL')">
            Todas
          </button>
          <button class="pill-discipline" [class.active]="selectedDiscipline === 'MECANICA'" (click)="setDisciplineFilter('MECANICA')">
            🔧 Mecánica ({{ getDisciplineCount('MECANICA') }})
          </button>
          <button class="pill-discipline" [class.active]="selectedDiscipline === 'ELECTRICIDAD'" (click)="setDisciplineFilter('ELECTRICIDAD')">
            ⚡ Electricidad ({{ getDisciplineCount('ELECTRICIDAD') }})
          </button>
          <button class="pill-discipline" [class.active]="selectedDiscipline === 'INSTRUMENTACION'" (click)="setDisciplineFilter('INSTRUMENTACION')">
            📡 Instrumentación & Control ({{ getDisciplineCount('INSTRUMENTACION') }})
          </button>
          <button class="pill-discipline" [class.active]="selectedDiscipline === 'LUBRICACION'" (click)="setDisciplineFilter('LUBRICACION')">
            🛢️ Lubricación ({{ getDisciplineCount('LUBRICACION') }})
          </button>
        </div>
      </div>

      <!-- Tickets Grid -->
      <div class="tickets-grid" *ngIf="filteredTickets.length > 0; else emptyState">
        <div *ngFor="let t of filteredTickets" class="ticket-card" [ngClass]="getCardStatusClass(t)">
          
          <!-- Top Accent Status Bar -->
          <div class="card-accent-bar" [ngClass]="getAccentBarClass(t)"></div>

          <div class="card-inner">
            <!-- Ticket Header -->
            <div class="ticket-header">
              <div class="header-left">
                <div class="eq-badge-wrap">
                  <span class="eq-icon-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </span>
                  <span class="eq-tag-text">{{ t.equipment_tag }}</span>
                </div>
                <span class="ot-num-badge">{{ t.ticket_number }}</span>
              </div>

              <div class="header-badges">
                <span class="custom-badge discipline-badge" *ngIf="getTicketDiscipline(t) as disc">
                  {{ disc.icon }} {{ disc.label }}
                </span>
                <span class="custom-badge priority-badge" [ngClass]="getPriorityBadgeClass(t.priority)">
                  <span class="priority-dot"></span>
                  {{ formatPriorityText(t.priority) }}
                </span>
                <span class="custom-badge status-badge" [ngClass]="getStatusBadgeClass(t.status)">
                  {{ formatStatusText(t.status) }}
                </span>
              </div>
            </div>

            <!-- Origin Tag -->
            <div class="origin-tag" *ngIf="t.source_module === 'PUMPS_STATION' || t.equipment_tag?.startsWith('PU')">
              <span class="origin-icon">⚡</span>
              <span class="origin-label">ORIGEN: PLANILLA DE BOMBAS</span>
            </div>

            <!-- Evidence Box: Photo or Technical Blueprint Fallback -->
            <div class="evidence-box">
              <!-- Real Photo -->
              <div *ngIf="hasValidPhoto(t); else blueprintTpl" class="photo-wrapper" (click)="openPhotoPreview(t)">
                <img 
                  [src]="t.photo_url" 
                  (error)="onPhotoError(t)" 
                  alt="Evidencia fotográfica" 
                  class="evidence-img" 
                />
                <div class="photo-overlay">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                  <span>Ampliar Evidencia</span>
                </div>
                <div class="photo-pill-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  <span>Foto de Planta</span>
                </div>
              </div>

              <!-- Blueprint Fallback -->
              <ng-template #blueprintTpl>
                <div class="blueprint-view">
                  <div class="blueprint-bg-grid"></div>
                  
                  <div class="blueprint-center">
                    <div class="blueprint-gear-box">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="spin-slow">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                    </div>
                    <div class="blueprint-meta">
                      <span class="blueprint-tag">BOMBA {{ t.equipment_tag }}</span>
                      <span class="blueprint-sub">Esquema Técnico de Operación</span>
                    </div>
                  </div>

                  <div class="blueprint-bottom-bar">
                    <span class="blueprint-indicator">
                      <span class="pulse-indicator"></span>
                      Alerta Operativa Activa
                    </span>
                    <label class="btn-attach-photo" (click)="$event.stopPropagation()">
                      <input type="file" (change)="attachPhotoToTicket(t, $event)" accept="image/*" style="display: none;" />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      <span>Adjuntar Foto</span>
                    </label>
                  </div>
                </div>
              </ng-template>
            </div>

            <!-- Title & Description -->
            <div class="ticket-body">
              <h4 class="ticket-title">{{ t.title }}</h4>
              <div class="ticket-description-box">
                <svg class="quote-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p class="ticket-desc">{{ t.description }}</p>
              </div>
            </div>

            <!-- Metadata Grid -->
            <div class="metadata-grid">
              <div class="meta-cell">
                <div class="meta-icon-circ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div class="meta-content">
                  <span class="meta-key">Solicitado por</span>
                  <span class="meta-val highlight-user">{{ t.requester_name }}</span>
                </div>
              </div>

              <div class="meta-cell">
                <div class="meta-icon-circ assigned">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                </div>
                <div class="meta-content">
                  <span class="meta-key">Asignado a</span>
                  <span class="meta-val highlight-assigned">{{ t.assigned_to || 'Equipo Mantenimiento Planta' }}</span>
                </div>
              </div>

              <div class="meta-cell" *ngIf="t.estimated_hours">
                <div class="meta-icon-circ time">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div class="meta-content">
                  <span class="meta-key">Tiempo Estimado</span>
                  <span class="meta-val">{{ t.estimated_hours }} hrs</span>
                </div>
              </div>

              <div class="meta-cell" *ngIf="t.created_at">
                <div class="meta-icon-circ date">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
                <div class="meta-content">
                  <span class="meta-key">Registrado</span>
                  <span class="meta-val">{{ formatTicketDate(t.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Operational Pass Result -->
            <div *ngIf="t.operational_pass_by" class="operational-pass-card">
              <div class="pass-card-header">
                <span class="pass-check-badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="pass-header-title">Pase Operativo Emitido</span>
              </div>
              <div class="pass-card-content">
                <span class="pass-signer-text">Autorizado por: <strong>{{ t.operational_pass_by }}</strong></span>
                <p class="pass-notes-text" *ngIf="t.resolution_notes">"{{ t.resolution_notes }}"</p>
              </div>
            </div>

            <!-- Bottom Action Button -->
            <div class="ticket-actions-bar">
              <button *ngIf="t.status === 'PENDING'" class="btn-action-primary btn-attend" (click)="attendTicket(t)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
                <span>Atender (Poner en Mantenimiento)</span>
              </button>

              <button *ngIf="t.status === 'IN_PROGRESS'" class="btn-action-primary btn-resolve" (click)="openPassModal(t)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Dar Pase Operativo & Resolver OT</span>
              </button>

              <div *ngIf="t.status === 'RESOLVED' || t.status === 'CLOSED'" class="resolved-badge-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>Orden Concluida & Liberada a Operación</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Empty State -->
      <ng-template #emptyState>
        <div class="empty-state-panel">
          <div class="empty-icon-wrap">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </div>
          <h3>No se encontraron órdenes de trabajo</h3>
          <p>No existen solicitudes que coincidan con el término de búsqueda o el filtro de estado seleccionado.</p>
          <button class="btn btn-secondary" (click)="clearFilters()">
            Restablecer Filtros
          </button>
        </div>
      </ng-template>

      <!-- Create Ticket Modal -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Crear Nueva Solicitud de Trabajo con Foto'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="saveTicket()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Tag del Equipo (Ej: PU025, TL-202)</label>
              <input type="text" [(ngModel)]="newTicket.equipment_tag" name="tag" required />
            </div>
            <div class="form-group">
              <label>Nivel de Prioridad / Criticidad</label>
              <select [(ngModel)]="newTicket.priority" name="priority">
                <option value="LOW">Baja (LOW)</option>
                <option value="MEDIUM">Media (MEDIUM)</option>
                <option value="HIGH">Alta (HIGH)</option>
                <option value="EMERGENCY">Emergencia (EMERGENCY)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Título de la Solicitud</label>
            <input type="text" [(ngModel)]="newTicket.title" name="title" placeholder="Ej: Fuga de pulpa en sello mecánico o vibración..." required />
          </div>

          <div class="form-group">
            <label>Descripción Detallada del Hallazgo</label>
            <textarea rows="3" [(ngModel)]="newTicket.description" name="desc" placeholder="Condición observada, ruidos, temperatura anormal..." required></textarea>
          </div>

          <!-- Photo upload preview -->
          <div class="form-group">
            <label>Evidencia Fotográfica (Adjuntar Imagen de Cámara)</label>
            <input type="file" (change)="onFileSelected($event)" accept="image/*" class="file-input" />
            <div *ngIf="previewPhoto" class="image-preview-box">
              <img [src]="previewPhoto" alt="Vista previa" class="preview-thumb" />
              <span class="preview-name">Evidencia lista para sincronizar</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Técnico / Taller Asignado</label>
              <input type="text" [(ngModel)]="newTicket.assigned_to" name="assigned" />
            </div>
            <div class="form-group">
              <label>Horas Estimadas</label>
              <input type="number" step="0.5" [(ngModel)]="newTicket.estimated_hours" name="hours" />
            </div>
          </div>

          <div footer class="modal-buttons">
            <button type="button" class="btn btn-secondary" (click)="isCreateModalOpen = false">Cancelar</button>
            <button type="submit" class="btn btn-primary">Crear Orden de Trabajo</button>
          </div>
        </form>
      </app-modal>

      <!-- Photo Zoom Modal -->
      <app-modal [isOpen]="isPhotoZoomOpen" [title]="selectedTicket?.ticket_number + ' - Evidencia Fotográfica'" (close)="isPhotoZoomOpen = false">
        <div class="zoom-modal-body" *ngIf="selectedTicket">
          <img [src]="selectedTicket.photo_url" [alt]="selectedTicket.title" class="full-zoom-img" />
          <div class="zoom-meta">
            <h4>{{ selectedTicket.equipment_tag }}: {{ selectedTicket.title }}</h4>
            <p>{{ selectedTicket.description }}</p>
          </div>
        </div>
      </app-modal>

      <!-- Modal: Dar Pase Operativo -->
      <app-modal [isOpen]="isPassModalOpen" [title]="'✅ Dar Pase Operativo: Bomba ' + selectedPassTicket?.equipment_tag" (close)="isPassModalOpen = false">
        <div class="pass-modal-body" *ngIf="selectedPassTicket">
          <div class="pass-info-banner">
            <span class="banner-icon">ℹ️</span>
            <div>
              <strong>Liberación de Custodia y Restitución Operativa</strong>
              <p>Al otorgar el pase, la bomba <strong>{{ selectedPassTicket.equipment_tag }}</strong> retornará inmediatamente al estado <strong>OPERATIVO</strong> en la Planilla de Bombas y Telemetría.</p>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 14px;">
            <label style="font-weight: 600; font-size: 0.88rem; display: block; margin-bottom: 6px;">Técnico / Responsable que emite el pase:</label>
            <input type="text" [(ngModel)]="passSignerName" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-input); color: var(--text-primary);" placeholder="Nombre completo" />
          </div>
          <div class="form-group" style="margin-bottom: 20px;">
            <label style="font-weight: 600; font-size: 0.88rem; display: block; margin-bottom: 6px;">Detalle del trabajo ejecutado / Observaciones técnicas:</label>
            <textarea [(ngModel)]="passResolutionNotes" rows="3" style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-input); color: var(--text-primary);" placeholder="Ej: Cambio de sello mecánico, alineamiento láser y prueba en vacío conforme."></textarea>
          </div>
          <div class="modal-footer-actions" style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn btn-secondary" (click)="isPassModalOpen = false">Cancelar</button>
            <button type="button" class="btn btn-success" (click)="confirmOperationalPass()">Firmar y Emitir Pase Operativo</button>
          </div>
        </div>
      </app-modal>
    </div>
  `,
  styles: [`
    .maintenance-page {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Top Bar */
    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .title-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .title-with-pill {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        h2 {
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: -0.3px;
          color: var(--text-primary);
          margin: 0;
        }

        .module-chip {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: rgba(3, 23, 149, 0.1);
          color: var(--primary-lavender);
          border: 1px solid rgba(3, 23, 149, 0.25);
        }
      }

      .section-sub {
        font-size: 0.82rem;
        color: var(--text-muted);
        margin: 0;
      }

      .btn-new-ticket {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        padding: 9px 18px;
      }
    }

    /* KPI Stats Grid */
    .kpi-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 560px) {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      box-shadow: var(--shadow-card);
      transition: all 0.22s ease;

      &:hover {
        transform: translateY(-2px);
        border-color: var(--primary-border);
        box-shadow: 0 6px 16px -2px rgba(15, 23, 42, 0.08);
      }

      &.active {
        border-color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        box-shadow: 0 4px 14px var(--primary-glow);
      }
    }

    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.total {
        background: #eef2ff;
        color: #3730a3;
      }
      &.pending {
        background: #fef3c7;
        color: #b45309;
      }
      &.progress {
        background: #dbeafe;
        color: #1d4ed8;
      }
      &.resolved {
        background: #d1fae5;
        color: #065f46;
      }
    }

    .kpi-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .kpi-val {
        font-size: 1.45rem;
        font-weight: 800;
        line-height: 1.1;
        color: var(--text-primary);

        &.text-warning { color: #d97706; }
        &.text-primary-accent { color: #2563eb; }
        &.text-success { color: #059669; }
      }

      .kpi-lbl {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
      }
    }

    /* Toolbar: Search and Filter Pills */
    .toolbar-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }

    .search-input-wrap {
      position: relative;
      flex: 1;
      min-width: 260px;

      svg {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        padding: 9px 36px 9px 38px;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        font-size: 0.84rem;
        color: var(--text-primary);
        transition: var(--transition-smooth);

        &:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(3, 23, 149, 0.12);
        }
      }

      .clear-search-btn {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 1.2rem;
        cursor: pointer;
        line-height: 1;
        padding: 2px;
      }
    }

    .filter-pills-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .pill-filter {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-subtle);
        background: var(--bg-card);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: var(--primary-border);
          color: var(--text-primary);
        }

        &.active {
          background: var(--primary-purple);
          color: #ffffff;
          border-color: var(--primary-purple);
          box-shadow: 0 2px 10px rgba(3, 23, 149, 0.3);

          .status-dot {
            background: #ffffff !important;
          }
        }
      }

      .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;

        &.dot-warning { background: #f59e0b; }
        &.dot-info { background: #3b82f6; }
        &.dot-success { background: #10b981; }
      }
    }

    /* Discipline / Specialty Toolbar */
    .discipline-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 9px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      margin-top: -6px;

      .discipline-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.74rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted);
      }

      .discipline-pills-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pill-discipline {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-subtle);
        background: var(--bg-surface, rgba(0, 0, 0, 0.02));
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: var(--primary-border);
          color: var(--text-primary);
        }

        &.active {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
        }
      }
    }

    .discipline-badge {
      background: rgba(2, 132, 199, 0.1);
      color: #0284c7;
      border: 1px solid rgba(2, 132, 199, 0.25);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-full);
    }

    /* Tickets Grid */
    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 22px;

      @media (max-width: 1260px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 780px) {
        grid-template-columns: 1fr;
      }
    }

    /* Ticket Card */
    .ticket-card {
      position: relative;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 3px 14px -2px rgba(15, 23, 42, 0.05), 0 1px 4px -1px rgba(15, 23, 42, 0.03);
      transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 14px 28px -4px rgba(15, 23, 42, 0.1), 0 4px 10px -2px rgba(15, 23, 42, 0.05);
        border-color: rgba(3, 23, 149, 0.26);
      }
    }

    .card-accent-bar {
      height: 4px;
      width: 100%;

      &.bar-emergency {
        background: linear-gradient(90deg, #dc2626 0%, #f43f5e 100%);
      }
      &.bar-high {
        background: linear-gradient(90deg, #d97706 0%, #f59e0b 100%);
      }
      &.bar-progress {
        background: linear-gradient(90deg, #2563eb 0%, #38bdf8 100%);
      }
      &.bar-resolved {
        background: linear-gradient(90deg, #059669 0%, #10b981 100%);
      }
      &.bar-default {
        background: linear-gradient(90deg, #031795 0%, #3b82f6 100%);
      }
    }

    .card-inner {
      padding: 18px 20px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 13px;
      flex: 1;
    }

    /* Header */
    .ticket-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .eq-badge-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      color: #1e40af;
      padding: 3px 10px;
      border-radius: 8px;
      border: 1px solid #bfdbfe;

      .eq-icon-box {
        color: #2563eb;
        display: flex;
        align-items: center;
      }

      .eq-tag-text {
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.5px;
      }
    }

    .ot-num-badge {
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .header-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .custom-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: var(--radius-full);
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    .priority-badge {
      &.priority-emergency {
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
        .priority-dot { background: #ef4444; }
      }
      &.priority-high {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
        .priority-dot { background: #f59e0b; }
      }
      &.priority-medium {
        background: #eef2ff;
        color: #4338ca;
        border: 1px solid #c7d2fe;
        .priority-dot { background: #6366f1; }
      }
      &.priority-low {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
        .priority-dot { background: #10b981; }
      }
    }

    .priority-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .status-badge {
      &.status-pending {
        background: #fffbeb;
        color: #b45309;
        border: 1px solid #fde68a;
      }
      &.status-progress {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }
      &.status-resolved {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
      }
    }

    /* Origin Tag */
    .origin-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.6px;
      padding: 3px 9px;
      border-radius: 6px;
      background: rgba(3, 23, 149, 0.08);
      color: #1e40af;
      border: 1px solid rgba(59, 130, 246, 0.25);
      width: fit-content;

      .origin-icon {
        color: #f59e0b;
      }
    }

    /* Evidence Box */
    .evidence-box {
      width: 100%;
      height: 165px;
      border-radius: 14px;
      overflow: hidden;
      position: relative;
      border: 1px solid var(--border-subtle);
      background: var(--bg-card-subtle);
    }

    .photo-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      cursor: pointer;

      &:hover .photo-overlay {
        opacity: 1;
      }

      &:hover .evidence-img {
        transform: scale(1.04);
      }
    }

    .evidence-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.35s ease;
    }

    .photo-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.72);
      backdrop-filter: blur(4px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .photo-pill-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(6px);
      color: #ffffff;
      padding: 3px 8px;
      border-radius: var(--radius-full);
      font-size: 0.68rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    /* Technical Blueprint Fallback (Theme Harmonized - Light by Default) */
    .blueprint-view {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #f8fafc 0%, #edf4fe 100%);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 14px 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
    }

    .blueprint-bg-grid {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(37, 99, 235, 0.18) 1.2px, transparent 1.2px);
      background-size: 14px 14px;
      opacity: 0.7;
      pointer-events: none;
    }

    .blueprint-center {
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
      z-index: 1;
      margin: auto 0;
    }

    .blueprint-gear-box {
      width: 50px;
      height: 50px;
      border-radius: 14px;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      color: #031795;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 12px rgba(3, 23, 149, 0.08);
      flex-shrink: 0;
    }

    .spin-slow {
      animation: spin 20s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .blueprint-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;

      .blueprint-tag {
        font-size: 0.95rem;
        font-weight: 800;
        letter-spacing: 0.5px;
        color: #0f172a;
      }

      .blueprint-sub {
        font-size: 0.74rem;
        color: #64748b;
        font-weight: 500;
      }
    }

    .blueprint-bottom-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      z-index: 1;
      padding-top: 8px;
      border-top: 1px solid rgba(226, 232, 240, 0.9);

      .blueprint-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #1e40af;
      }

      .pulse-indicator {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #2563eb;
        box-shadow: 0 0 6px rgba(37, 99, 235, 0.5);
        animation: pulseDot 2s infinite;
      }
    }

    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    .btn-attach-photo {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.74rem;
      font-weight: 700;
      color: #1e40af;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 5px 12px;
      border-radius: var(--radius-full);
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: all 0.2s ease;

      &:hover {
        background: #f8fafc;
        border-color: #94a3b8;
        color: #031795;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }
    }

    /* Dark Theme Adaptive Rules */
    :host-context([data-theme="dark"]),
    :host-context(.dark-theme) {
      .eq-badge-wrap {
        background: #0f172a;
        color: #ffffff;
        border-color: #1e293b;
        .eq-icon-box { color: #38bdf8; }
      }

      .ot-num-badge {
        color: var(--primary-lavender);
        background: rgba(59, 130, 246, 0.1);
        border-color: rgba(59, 130, 246, 0.2);
      }

      .evidence-box {
        background: #090e1a;
      }

      .blueprint-view {
        background: linear-gradient(135deg, #090e1a 0%, #131d35 100%);
        border-color: rgba(59, 130, 246, 0.25);
      }

      .blueprint-bg-grid {
        background-image: radial-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px);
        opacity: 0.7;
      }

      .blueprint-gear-box {
        background: rgba(30, 58, 138, 0.35);
        border-color: rgba(59, 130, 246, 0.35);
        color: #38bdf8;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      }

      .blueprint-meta {
        .blueprint-tag { color: #f8fafc; }
        .blueprint-sub { color: #94a3b8; }
      }

      .blueprint-bottom-bar {
        border-top-color: rgba(255, 255, 255, 0.08);

        .blueprint-indicator {
          color: #38bdf8;
        }

        .pulse-indicator {
          background: #38bdf8;
          box-shadow: 0 0 8px #38bdf8;
        }
      }

      .btn-attach-photo {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.2);
        box-shadow: none;

        &:hover {
          background: rgba(255, 255, 255, 0.22);
          border-color: rgba(255, 255, 255, 0.3);
          color: #ffffff;
        }
      }

      .discipline-toolbar {
        background: #0b1329;
        border-color: #1e293b;
      }

      .pill-discipline {
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border-color: #1e293b;

        &:hover {
          border-color: #38bdf8;
          color: #f8fafc;
        }

        &.active {
          background: #0284c7;
          color: #ffffff;
          border-color: #0284c7;
        }
      }
    }

    /* Ticket Body */
    .ticket-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ticket-title {
      font-size: 1.02rem;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1.35;
      margin: 0;
    }

    .ticket-description-box {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: var(--bg-card-subtle);
      border-left: 3px solid #6366f1;
      border-radius: 4px;
      padding: 8px 12px;

      .quote-icon {
        color: #6366f1;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .ticket-desc {
        font-size: 0.79rem;
        color: var(--text-secondary);
        line-height: 1.42;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }

    /* Metadata Grid */
    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: var(--bg-card-subtle);
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
    }

    .meta-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .meta-icon-circ {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(3, 23, 149, 0.08);
      color: var(--primary-lavender);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.assigned {
        background: rgba(147, 51, 234, 0.1);
        color: #7e22ce;
      }
      &.time {
        background: rgba(245, 158, 11, 0.1);
        color: #b45309;
      }
      &.date {
        background: rgba(16, 185, 129, 0.1);
        color: #047857;
      }
    }

    .meta-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;

      .meta-key {
        font-size: 0.67rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--text-muted);
      }

      .meta-val {
        font-size: 0.77rem;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        &.highlight-assigned {
          color: #7e22ce;
        }
      }
    }

    /* Operational Pass Result Card */
    .operational-pass-card {
      background: rgba(16, 185, 129, 0.09);
      border: 1px solid rgba(16, 185, 129, 0.32);
      border-radius: 10px;
      padding: 9px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .pass-card-header {
      display: flex;
      align-items: center;
      gap: 6px;

      .pass-check-badge {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #10b981;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pass-header-title {
        font-size: 0.78rem;
        font-weight: 800;
        color: #047857;
        letter-spacing: 0.3px;
      }
    }

    .pass-card-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 24px;

      .pass-signer-text {
        font-size: 0.76rem;
        color: var(--text-primary);
        strong { color: #047857; }
      }

      .pass-notes-text {
        font-size: 0.73rem;
        color: var(--text-secondary);
        font-style: italic;
        margin: 0;
      }
    }

    /* Bottom Actions */
    .ticket-actions-bar {
      margin-top: auto;
      padding-top: 6px;
    }

    .btn-action-primary {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 0.84rem;
      font-weight: 800;
      border: none;
      cursor: pointer;
      transition: all 0.22s ease;

      &.btn-attend {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        color: #ffffff;
        box-shadow: 0 3px 12px rgba(217, 119, 6, 0.26);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(217, 119, 6, 0.38);
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
      }

      &.btn-resolve {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: #ffffff;
        box-shadow: 0 3px 12px rgba(5, 150, 105, 0.26);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(5, 150, 105, 0.38);
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
      }
    }

    .resolved-badge-bar {
      width: 100%;
      background: rgba(5, 150, 105, 0.08);
      border: 1px dashed rgba(5, 150, 105, 0.35);
      color: #059669;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 8px 12px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    /* Empty State */
    .empty-state-panel {
      grid-column: 1 / -1;
      background: var(--bg-card);
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      .empty-icon-wrap {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: var(--bg-card-subtle);
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      h3 {
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0;
      }

      p {
        font-size: 0.84rem;
        color: var(--text-muted);
        max-width: 420px;
        margin: 0;
      }
    }

    /* Modal Form */
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
    }

    .image-preview-box {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
      padding: 8px;
      background: var(--bg-card-subtle);
      border-radius: var(--radius-sm);
    }

    .preview-thumb {
      width: 50px;
      height: 50px;
      border-radius: var(--radius-sm);
      object-fit: cover;
    }

    .preview-name {
      font-size: 0.78rem;
      color: var(--success);
    }

    .modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      width: 100%;
    }

    .zoom-modal-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-zoom-img {
      width: 100%;
      max-height: 380px;
      object-fit: cover;
      border-radius: var(--radius-md);
    }

    .zoom-meta {
      h4 { font-size: 1rem; color: var(--text-primary); margin: 0; }
      p { font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; }
    }

    .pass-modal-body {
      padding: 4px 0;
      .pass-info-banner {
        display: flex;
        gap: 12px;
        align-items: center;
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.35);
        border-radius: var(--radius-md);
        padding: 12px 16px;
        margin-bottom: 18px;
        .banner-icon { font-size: 1.6rem; }
        strong { color: #10b981; font-size: 0.95rem; display: block; margin-bottom: 2px; }
        p { margin: 0; color: var(--text-secondary); font-size: 0.85rem; }
      }
    }
  `]
})
export class MaintenanceComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  tickets: MaintenanceRequest[] = [];
  failedPhotos: Record<string, boolean> = {};
  searchQuery: string = '';
  selectedStatusFilter: 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' = 'ALL';
  selectedDiscipline: 'ALL' | 'MECANICA' | 'ELECTRICIDAD' | 'INSTRUMENTACION' | 'LUBRICACION' = 'ALL';

  isCreateModalOpen = false;
  isPhotoZoomOpen = false;
  selectedTicket: MaintenanceRequest | null = null;
  previewPhoto: string | null = null;

  newTicket = {
    equipment_tag: 'PP-102',
    title: '',
    description: '',
    priority: 'HIGH' as const,
    assigned_to: 'Equipo Mantenimiento Mecánico',
    photo_url: '',
    estimated_hours: 2.5
  };

  isPassModalOpen = false;
  selectedPassTicket: MaintenanceRequest | null = null;
  passSignerName = '';
  passResolutionNotes = '';

  private syncListener = (e: any) => {
    if (e.detail?.source === 'local') return;
    const ent = (e.detail?.entity || '').toLowerCase();
    const key = (e.detail?.key || '').toLowerCase();
    if (
      ent.includes('maintenance') || 
      ent.includes('mantenimiento') || 
      ent.includes('pump') || 
      ent.includes('bomba') ||
      key.includes('maintenance') ||
      key.includes('pump')
    ) {
      this.ngZone.run(() => {
        this.loadTickets();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  };

  ngOnInit(): void {
    this.loadTickets();
    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  loadTickets(): void {
    const cached = getRealtimeData<MaintenanceRequest[]>('maintenance_tickets', []);
    if (cached && cached.length > 0) {
      this.tickets = cached;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }

    this.http.get<any>(`${getApiBaseUrl()}/maintenance`).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          const serverTickets = res.data;
          const merged = [...serverTickets];
          if (cached && cached.length > 0) {
            for (const c of cached) {
              if (c && c.id && !merged.some(m => m.id === c.id || (m.equipment_tag === c.equipment_tag && m.status === c.status))) {
                merged.unshift(c);
              }
            }
          }
          this.tickets = merged;
          saveRealtimeData('maintenance_tickets', this.tickets, { skipBroadcast: true });
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        } else if (!cached || cached.length === 0) {
          this.loadDefaultTickets();
        }
      },
      error: () => {
        if (!cached || cached.length === 0) {
          this.loadDefaultTickets();
        }
      }
    });
  }

  private loadDefaultTickets(): void {
    this.tickets = [];
    saveRealtimeData('maintenance_tickets', []);
  }

  get filteredTickets(): MaintenanceRequest[] {
    return this.tickets.filter(t => {
      // Filter by Status
      if (this.selectedStatusFilter !== 'ALL') {
        if (this.selectedStatusFilter === 'RESOLVED') {
          if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') return false;
        } else if (t.status !== this.selectedStatusFilter) {
          return false;
        }
      }

      // Filter by Discipline / Specialty
      if (this.selectedDiscipline !== 'ALL') {
        if (!this.matchesDiscipline(t, this.selectedDiscipline)) return false;
      }

      // Filter by Search query
      if (this.searchQuery && this.searchQuery.trim() !== '') {
        const q = this.searchQuery.toLowerCase().trim();
        const tag = (t.equipment_tag || '').toLowerCase();
        const ot = (t.ticket_number || '').toLowerCase();
        const title = (t.title || '').toLowerCase();
        const reqName = (t.requester_name || '').toLowerCase();
        const assigned = (t.assigned_to || '').toLowerCase();

        return tag.includes(q) || ot.includes(q) || title.includes(q) || reqName.includes(q) || assigned.includes(q);
      }

      return true;
    });
  }

  setStatusFilter(filter: 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'): void {
    this.selectedStatusFilter = filter;
    this.cdr.markForCheck();
  }

  setDisciplineFilter(discipline: 'ALL' | 'MECANICA' | 'ELECTRICIDAD' | 'INSTRUMENTACION' | 'LUBRICACION'): void {
    this.selectedDiscipline = discipline;
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatusFilter = 'ALL';
    this.selectedDiscipline = 'ALL';
    this.cdr.markForCheck();
  }

  matchesDiscipline(t: MaintenanceRequest, discipline: 'MECANICA' | 'ELECTRICIDAD' | 'INSTRUMENTACION' | 'LUBRICACION'): boolean {
    const text = `${t.equipment_tag || ''} ${t.title || ''} ${t.description || ''} ${t.assigned_to || ''} ${t.source_module || ''}`.toLowerCase();
    switch (discipline) {
      case 'MECANICA':
        return /mec[aá]nic|bomba|sello|rodamiento|reductor|pp-|pu|v[aá]lvula|rotor|impulsor|faja|chute|alineaci|acople/.test(text);
      case 'ELECTRICIDAD':
        return /el[eé]ctric|motor|transformador|tablero|breaker|ccm|tensi[oó]n|volt|amper|aislamiento|bobinado/.test(text);
      case 'INSTRUMENTACION':
        return /instrument|sensor|fluj[oó]metro|presi[oó]n|transmisor|plc|scada|vfd|se[nñ]al|pt100|vibraci[oó]n|nivel/.test(text);
      case 'LUBRICACION':
        return /lubric|grasa|aceite|engrase|viscosidad|filtro|fuga/.test(text);
      default:
        return true;
    }
  }

  getDisciplineCount(discipline: 'MECANICA' | 'ELECTRICIDAD' | 'INSTRUMENTACION' | 'LUBRICACION'): number {
    return this.tickets.filter(t => this.matchesDiscipline(t, discipline)).length;
  }

  getTicketDiscipline(t: MaintenanceRequest): { label: string; icon: string } | null {
    if (this.matchesDiscipline(t, 'MECANICA')) return { label: 'Mecánica', icon: '🔧' };
    if (this.matchesDiscipline(t, 'ELECTRICIDAD')) return { label: 'Electricidad', icon: '⚡' };
    if (this.matchesDiscipline(t, 'INSTRUMENTACION')) return { label: 'Instrumentación', icon: '📡' };
    if (this.matchesDiscipline(t, 'LUBRICACION')) return { label: 'Lubricación', icon: '🛢️' };
    return null;
  }

  getCountByStatus(status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'): number {
    if (status === 'RESOLVED') {
      return this.tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    }
    return this.tickets.filter(t => t.status === status).length;
  }

  hasValidPhoto(t: MaintenanceRequest): boolean {
    const key = t.id || t.ticket_number;
    if (this.failedPhotos[key]) return false;
    if (!t.photo_url || typeof t.photo_url !== 'string') return false;
    const clean = t.photo_url.trim();
    if (clean === '' || clean === 'undefined' || clean === 'null') return false;
    if (clean.includes('unsplash.com/photo-1581092335397')) return false;
    return true;
  }

  onPhotoError(t: MaintenanceRequest): void {
    const key = t.id || t.ticket_number;
    this.failedPhotos[key] = true;
    this.cdr.markForCheck();
  }

  async attachPhotoToTicket(t: MaintenanceRequest, event: any): Promise<void> {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await this.compressImage(file, 1280, 1280, 0.78);
        t.photo_url = compressedBase64;
        const key = t.id || t.ticket_number;
        delete this.failedPhotos[key];
        saveRealtimeData('maintenance_tickets', this.tickets);
        this.cdr.markForCheck();
        this.cdr.detectChanges();

        const endpoint = `${getApiBaseUrl()}/maintenance/${t.id}/status`;
        this.http.patch<any>(endpoint, { photo_url: compressedBase64 }).subscribe({
          next: () => this.loadTickets(),
          error: () => this.offlineSync.queueAction(endpoint, 'PATCH' as any, { photo_url: compressedBase64 }, `Foto OT ${t.ticket_number}`)
        });
      } catch (err) {
        console.warn('[Maintenance] Error adjuntando foto:', err);
      }
    }
  }

  formatTicketDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  }

  formatPriorityText(priority: string): string {
    switch (priority) {
      case 'EMERGENCY': return 'EMERGENCIA';
      case 'HIGH': return 'ALTA CRITICIDAD';
      case 'MEDIUM': return 'MEDIA';
      case 'LOW': return 'BAJA';
      default: return priority;
    }
  }

  formatStatusText(status: string): string {
    switch (status) {
      case 'PENDING': return 'PENDIENTE';
      case 'IN_PROGRESS': return 'EN INTERVENCIÓN';
      case 'RESOLVED': return 'CON PASE';
      case 'CLOSED': return 'CERRADA';
      default: return status;
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'EMERGENCY': return 'priority-emergency';
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      default: return 'priority-low';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'status-pending';
      case 'IN_PROGRESS': return 'status-progress';
      case 'RESOLVED':
      case 'CLOSED': return 'status-resolved';
      default: return 'status-pending';
    }
  }

  getCardStatusClass(t: MaintenanceRequest): string {
    if (t.priority === 'EMERGENCY') return 'emergency';
    if (t.status === 'IN_PROGRESS') return 'in-progress';
    if (t.status === 'RESOLVED') return 'resolved';
    return '';
  }

  getAccentBarClass(t: MaintenanceRequest): string {
    if (t.priority === 'EMERGENCY') return 'bar-emergency';
    if (t.status === 'RESOLVED') return 'bar-resolved';
    if (t.status === 'IN_PROGRESS') return 'bar-progress';
    if (t.priority === 'HIGH') return 'bar-high';
    return 'bar-default';
  }

  getPriorityBadge(priority: string): string {
    switch (priority) {
      case 'EMERGENCY': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-purple';
      default: return 'badge-success';
    }
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED': return 'badge-success';
      case 'IN_PROGRESS': return 'badge-warning';
      default: return 'badge-purple';
    }
  }

  openCreateModal(): void {
    this.previewPhoto = null;
    this.newTicket.photo_url = '';
    this.isCreateModalOpen = true;
  }

  async onFileSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (file) {
      try {
        const compressedBase64 = await this.compressImage(file, 1280, 1280, 0.78);
        this.previewPhoto = compressedBase64;
        this.newTicket.photo_url = compressedBase64;
      } catch (err) {
        console.warn('[Maintenance] Error al comprimir imagen, usando fallback directo:', err);
        const reader = new FileReader();
        reader.onload = () => {
          this.previewPhoto = reader.result as string;
          this.newTicket.photo_url = this.previewPhoto;
        };
        reader.readAsDataURL(file);
      }
    }
  }

  saveTicket(): void {
    const created: MaintenanceRequest = {
      id: 'm-' + Date.now(),
      ticket_number: `OT-2026-00${Math.floor(40 + Math.random() * 50)}`,
      equipment_tag: this.newTicket.equipment_tag,
      title: this.newTicket.title,
      description: this.newTicket.description,
      priority: this.newTicket.priority as any,
      status: 'PENDING',
      requester_name: this.authService.currentUser()?.fullName || 'Operador de Turno',
      assigned_to: this.newTicket.assigned_to || 'Equipo Mantenimiento Planta',
      photo_url: this.newTicket.photo_url || '',
      estimated_hours: this.newTicket.estimated_hours || 2,
      created_at: new Date().toISOString()
    };

    this.tickets.unshift(created);
    saveRealtimeData('maintenance_tickets', this.tickets);
    this.isCreateModalOpen = false;

    const endpoint = `${getApiBaseUrl()}/maintenance`;
    if (this.offlineSync.isOnline()) {
      this.http.post<any>(endpoint, this.newTicket).subscribe({
        next: () => {
          this.loadTickets();
        },
        error: () => {
          this.offlineSync.queueAction(endpoint, 'POST', this.newTicket, 'OT ' + this.newTicket.equipment_tag);
        }
      });
    } else {
      this.offlineSync.queueAction(endpoint, 'POST', this.newTicket, 'OT ' + this.newTicket.equipment_tag);
    }
  }

  updateStatus(t: MaintenanceRequest, newStatus: any): void {
    t.status = newStatus;
    saveRealtimeData('maintenance_tickets', this.tickets);
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    const endpoint = `${getApiBaseUrl()}/maintenance/${t.id}/status`;
    this.http.patch<any>(endpoint, { status: newStatus }).subscribe({
      next: () => {
        this.loadTickets();
      },
      error: () => {
        this.offlineSync.queueAction(endpoint, 'PATCH' as any, { status: newStatus }, `Estado OT ${t.ticket_number}`);
      }
    });
  }

  attendTicket(t: MaintenanceRequest): void {
    this.updateStatus(t, 'IN_PROGRESS');
    this.syncLocalPumpStatus(t.equipment_tag, 'Mantenimiento');
  }

  openPassModal(t: MaintenanceRequest): void {
    this.selectedPassTicket = t;
    this.passSignerName = this.authService.currentUser()?.fullName || 'Supervisor Mantenimiento';
    this.passResolutionNotes = '';
    this.isPassModalOpen = true;
  }

  confirmOperationalPass(): void {
    if (!this.selectedPassTicket) return;
    const t = this.selectedPassTicket;
    const signer = this.passSignerName.trim() || this.authService.currentUser()?.fullName || 'Supervisor Mantenimiento';
    const notes = this.passResolutionNotes.trim() || 'Mantenimiento correctivo concluido conforme';

    t.status = 'RESOLVED';
    t.operational_pass_by = signer;
    t.operational_pass_at = new Date().toISOString();
    t.resolution_notes = notes;

    saveRealtimeData('maintenance_tickets', this.tickets);
    this.syncLocalPumpStatus(t.equipment_tag, 'Operativo');
    this.isPassModalOpen = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    const endpoint = `${getApiBaseUrl()}/maintenance/${t.id}/status`;
    this.http.patch<any>(endpoint, {
      status: 'RESOLVED',
      operational_pass_by: signer,
      resolution_notes: notes
    }).subscribe({
      next: () => {
        this.loadTickets();
      },
      error: () => {
        this.offlineSync.queueAction(endpoint, 'PATCH' as any, {
          status: 'RESOLVED',
          operational_pass_by: signer,
          resolution_notes: notes
        }, `Pase Operativo OT ${t.ticket_number}`);
      }
    });
  }

  private syncLocalPumpStatus(tag: string, newStatus: 'Mantenimiento' | 'Operativo'): void {
    try {
      const keys = ['pump_sheet_latest'];
      const todayDate = new Date().toISOString().slice(0, 10);
      keys.push('pump_sheet_' + todayDate);
      keys.push('pump_sheet_' + new Date().toLocaleDateString('es-PE'));

      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const lk = localStorage.key(i);
          if (lk && lk.startsWith('basetrack_pump_sheet_')) {
            keys.push(lk.replace('basetrack_', ''));
          }
        }
      }

      const uniqueKeys = Array.from(new Set(keys));
      for (const k of uniqueKeys) {
        const sheet = getRealtimeData<any>(k, null);
        if (sheet) {
          let updated = false;
          ['sentina_pumps', 'intermedia_pumps', 'torre5_pumps'].forEach(arrKey => {
            if (Array.isArray(sheet[arrKey])) {
              sheet[arrKey].forEach((p: any) => {
                if (p && p.tag === tag) {
                  p.status = newStatus;
                  updated = true;
                }
              });
            }
          });
          if (updated) {
            saveRealtimeData(k, sheet, { skipBroadcast: false });
          }
        }
      }
    } catch (e) {
      console.warn('[Maintenance] Error updating local pump sheet cache:', e);
    }
  }

  openPhotoPreview(t: MaintenanceRequest): void {
    this.selectedTicket = t;
    this.isPhotoZoomOpen = true;
  }

  private compressImage(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.78): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target.result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  }
}
