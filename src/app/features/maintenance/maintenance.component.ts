import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { getApiBaseUrl } from '../../core/constants/api.config';
import { ModalComponent } from '../../shared/ui/modal.component';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { getRealtimeData, saveRealtimeData } from '../../core/storage/local-store.util';

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
  created_at: string;
}

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <div class="maintenance-page animate-fade-in">
      <div class="page-top-bar">
        <div>
          <h2>Solicitudes de Mantenimiento & Evidencias</h2>
          <p class="section-sub">Órdenes de trabajo preventivo/correctivo con captura fotográfica en planta</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nueva Solicitud con Foto
        </button>
      </div>

      <!-- Tickets Grid -->
      <div class="tickets-grid">
        <div *ngFor="let t of tickets" class="ticket-card glass-panel" [class.emergency]="t.priority === 'EMERGENCY'" [class.high]="t.priority === 'HIGH'">
          <div class="ticket-header">
            <div class="ticket-number-tag">
              <span class="ot-num">{{ t.ticket_number }}</span>
              <span class="eq-tag">{{ t.equipment_tag }}</span>
            </div>
            <div class="badges-group">
              <span class="badge" [ngClass]="getPriorityBadge(t.priority)">
                {{ t.priority }}
              </span>
              <span class="badge" [ngClass]="getStatusBadge(t.status)">
                {{ t.status }}
              </span>
            </div>
          </div>

          <!-- Photo Evidence Thumbnail -->
          <div class="photo-container" (click)="openPhotoPreview(t)">
            <img [src]="t.photo_url" [alt]="t.title" class="evidence-img" />
            <div class="photo-overlay">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              <span>Ver Evidencia</span>
            </div>
          </div>

          <h4 class="ticket-title">{{ t.title }}</h4>
          <p class="ticket-desc">{{ t.description }}</p>

          <div class="ticket-footer">
            <div class="meta-row">
              <span class="meta-label">Solicitado por:</span>
              <span class="meta-val">{{ t.requester_name }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Asignado a:</span>
              <span class="meta-val highlight-purple">{{ t.assigned_to || 'Sin asignar' }}</span>
            </div>

            <div class="status-action-row">
              <button *ngIf="t.status === 'PENDING'" class="btn btn-secondary btn-sm" (click)="updateStatus(t, 'IN_PROGRESS')">
                Iniciar Trabajo
              </button>
              <button *ngIf="t.status === 'IN_PROGRESS'" class="btn btn-success btn-sm" (click)="updateStatus(t, 'RESOLVED')">
                Resolver OT
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Ticket Modal -->
      <app-modal [isOpen]="isCreateModalOpen" [title]="'Crear Nueva Solicitud de Trabajo con Foto'" (close)="isCreateModalOpen = false">
        <form (ngSubmit)="saveTicket()" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Tag del Equipo (Ej: PP-101, TL-202)</label>
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
            <input type="text" [(ngModel)]="newTicket.title" name="title" placeholder="Ej: Fuga de pulpa en rodete o alta vibración..." required />
          </div>

          <div class="form-group">
            <label>Descripción Detallada del Hallazgo</label>
            <textarea rows="3" [(ngModel)]="newTicket.description" name="desc" placeholder="Condición observada, ruidos, temperatura anormal..." required></textarea>
          </div>

          <!-- Photo upload preview -->
          <div class="form-group">
            <label>Evidencia Fotográfica (Adjuntar Imagen o Foto de Celular)</label>
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
    </div>
  `,
  styles: [`
    .maintenance-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h2 {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--text-primary);
      }

      .section-sub {
        font-size: 0.8rem;
        color: var(--text-muted);
      }
    }

    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;

      @media (max-width: 1200px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .ticket-card {
      padding: 22px;
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: var(--transition-smooth);

      &:hover {
        transform: translateY(-2px);
        border-color: var(--primary-border);
      }

      &.emergency {
        border-left: 4px solid var(--danger);
      }

      &.high {
        border-left: 4px solid var(--warning);
      }
    }

    .ticket-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .ticket-number-tag {
      display: flex;
      flex-direction: column;
    }

    .ot-num {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--primary-lavender);
    }

    .eq-tag {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .badges-group {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .photo-container {
      width: 100%;
      height: 160px;
      border-radius: var(--radius-md);
      overflow: hidden;
      position: relative;
      cursor: pointer;
      border: 1px solid var(--border-subtle);

      &:hover .photo-overlay {
        opacity: 1;
      }
    }

    .evidence-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }

    .photo-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(19, 17, 33, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.25s ease;
    }

    .ticket-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.3;
    }

    .ticket-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .ticket-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
      margin-top: auto;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }

    .meta-label {
      color: var(--text-muted);
    }

    .meta-val {
      color: var(--text-primary);
      font-weight: 500;

      &.highlight-purple {
        color: var(--primary-lavender);
      }
    }

    .status-action-row {
      display: flex;
      justify-content: flex-end;
      padding-top: 6px;
    }

    /* Modals */
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
      h4 { font-size: 1rem; color: var(--text-primary); }
      p { font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; }
    }
  `]
})
export class MaintenanceComponent implements OnInit {
  private http = inject(HttpClient);
  offlineSync = inject(OfflineSyncService);

  tickets: MaintenanceRequest[] = [];
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

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    const cached = getRealtimeData<MaintenanceRequest[]>('maintenance_tickets', []);
    if (cached && cached.length > 0) {
      this.tickets = cached;
    }

    this.http.get<any>(`${getApiBaseUrl()}/maintenance`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.tickets = res.data;
          saveRealtimeData('maintenance_tickets', this.tickets);
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
    this.tickets = [
      {
        id: 'm-1', ticket_number: 'OT-2026-0041', equipment_tag: 'PP-102',
        title: 'Vibración anormal en rodamiento lado acople',
        description: 'Durante la inspección de rutina se detectó vibración de 4.8 mm/s en rodamiento DE. Requiere análisis espectral y re-engrase.',
        priority: 'HIGH', status: 'IN_PROGRESS', requester_name: 'VIZCARRA CORI MANLEY KLISMAN',
        assigned_to: 'Ing. Mantenimiento Mecánico',
        photo_url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80',
        estimated_hours: 4.5, created_at: new Date().toISOString()
      },
      {
        id: 'm-2', ticket_number: 'OT-2026-0042', equipment_tag: 'CYCLOPAC-02',
        title: 'Reemplazo de Liner de Vortex Finder ciclón 04',
        description: 'Desgaste severo por abrasión de pulpa en vortex. Pérdida de eficiencia en corte de finos.',
        priority: 'MEDIUM', status: 'PENDING', requester_name: 'PILCO APAZA CARLOS EDUARDO',
        assigned_to: 'Equipo Mantenimiento Planta',
        photo_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
        estimated_hours: 3.0, created_at: new Date().toISOString()
      },
      {
        id: 'm-3', ticket_number: 'OT-2026-0039', equipment_tag: 'TL-201',
        title: 'Fuga en empaquetadura de prensaestopas',
        description: 'Goteo de pulpa de relaves sobre canaleta de drenaje. Ajuste de empaquetadura completado satisfactoriamente.',
        priority: 'LOW', status: 'RESOLVED', requester_name: 'VILCAMIZA PEVE JORGE RICARDO',
        assigned_to: 'Técnico Lubricador',
        photo_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
        estimated_hours: 1.5, created_at: new Date().toISOString()
      }
    ];
    saveRealtimeData('maintenance_tickets', this.tickets);
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

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.previewPhoto = reader.result as string;
        this.newTicket.photo_url = this.previewPhoto;
      };
      reader.readAsDataURL(file);
    }
  }

  saveTicket(): void {
    if (!this.newTicket.photo_url) {
      this.newTicket.photo_url = 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80';
    }

    const created: MaintenanceRequest = {
      id: 'm-' + Date.now(),
      ticket_number: `OT-2026-00${Math.floor(40 + Math.random() * 50)}`,
      equipment_tag: this.newTicket.equipment_tag,
      title: this.newTicket.title,
      description: this.newTicket.description,
      priority: this.newTicket.priority as any,
      status: 'PENDING',
      requester_name: 'VIZCARRA CORI MANLEY KLISMAN',
      assigned_to: 'Equipo Mantenimiento Planta',
      photo_url: this.newTicket.photo_url,
      estimated_hours: this.newTicket.estimated_hours,
      created_at: new Date().toISOString()
    };

    // Optimistic real-time storage
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

  openPhotoPreview(t: MaintenanceRequest): void {
    this.selectedTicket = t;
    this.isPhotoZoomOpen = true;
  }
}
