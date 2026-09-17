import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LayoutService } from '../../core/layout/layout.service';
import { PwaService } from '../../core/pwa/pwa.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <!-- Title area -->
      <div class="header-left">
        <!-- Mobile hamburger toggle button -->
        <button
          type="button"
          class="mobile-menu-btn"
          (click)="layoutService.toggleSidebar()"
          title="Abrir Menú"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div class="title-with-icon">
          <span class="icon-grid">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </span>
          <h1 class="page-title">{{ getPageTitle() }}</h1>
        </div>

        <div class="shift-indicator">
          <span class="shift-tag">Turno:</span>
          <span class="shift-name">{{ authService.currentUser()?.shift || 'GUARDIA_A' }}</span>
        </div>
      </div>

      <!-- Action items on right side (CRAVEAT style) -->
      <div class="header-right">
        <!-- PWA Install Action Button (Desktop & Mobile) -->
        <button
          *ngIf="!pwa.isInstalled()"
          type="button"
          class="btn-install-header"
          (click)="pwa.promptInstall()"
          title="Instalar BASETRACK en este dispositivo"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
            <path d="M12 6v6m-3-3 3 3 3-3"></path>
          </svg>
          <span>Instalar App</span>
        </button>

        <!-- Notification Bell -->
        <button type="button" class="header-action-btn" title="Notificaciones de Planta" (click)="toggleNotifications()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span class="notification-indicator"></span>
        </button>

        <!-- Messages / Chat -->
        <button type="button" class="header-action-btn" title="Canal Radial de Guardia">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <!-- Settings / Profile -->
        <button type="button" class="header-action-btn" title="Configuración de Cuenta & Perfil" (click)="goToProfile()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>

        <!-- User Profile Avatar with Online Status Dot -->
        <div class="user-profile-badge" (click)="goToProfile()" style="cursor: pointer" title="Configurar mi cuenta y perfil">
          <div class="avatar-wrapper">
            <img
              [src]="authService.currentUser()?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'"
              alt="Avatar"
              class="user-avatar"
            />
            <span class="user-status-dot"></span>
          </div>
          <div class="user-meta">
            <span class="user-name">{{ authService.currentUser()?.fullName || 'Ing. Supervisor' }}</span>
            <span class="user-role">{{ authService.currentUser()?.role || 'SUPERVISOR' }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Notification Dropdown Panel -->
    <div *ngIf="showNotifications" class="notification-dropdown glass-panel animate-fade-in">
      <div class="notif-header">
        <h4>Alertas Recientes del SCADA</h4>
        <span class="badge badge-emerald">3 Nuevas</span>
      </div>
      <div class="notif-list">
        <div class="notif-item">
          <span class="notif-bullet warning"></span>
          <div class="notif-text">
            <strong>Bomba PP-102:</strong> Vibración en 4.8 mm/s excede umbral de advertencia.
            <span class="notif-time">Hace 12 min</span>
          </div>
        </div>
        <div class="notif-item">
          <span class="notif-bullet success"></span>
          <div class="notif-text">
            <strong>Ciclopac 01:</strong> Presión de alimentación normalizada a 18.5 PSI.
            <span class="notif-time">Hace 35 min</span>
          </div>
        </div>
        <div class="notif-item">
          <span class="notif-bullet info"></span>
          <div class="notif-text">
            <strong>Presa de Relaves:</strong> Nivel de espejo de agua reportado estable.
            <span class="notif-time">Hace 1 hora</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-header {
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      background: rgba(255, 255, 255, 0.88);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(8px);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon-grid {
      color: var(--text-secondary);
      display: flex;
      align-items: center;
    }

    .page-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .shift-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #ecfdf5;
      padding: 4px 12px;
      border-radius: var(--radius-full);
      border: 1px solid #a7f3d0;
      font-size: 0.75rem;
    }

    .shift-tag {
      color: #065f46;
      font-weight: 500;
    }

    .shift-name {
      color: #047857;
      font-weight: 800;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-action-btn {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: var(--transition-smooth);

      &:hover {
        background: #f1f5f9;
        color: var(--text-primary);
        border-color: #cbd5e1;
      }
    }

    .btn-install-header {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: var(--radius-full);
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #047857;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #d1fae5;
        border-color: #059669;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
      }

      @media (max-width: 640px) {
        span {
          display: none;
        }
        padding: 8px;
      }
    }

    .notification-indicator {
      position: absolute;
      top: 9px;
      right: 9px;
      width: 8px;
      height: 8px;
      background: #059669;
      border-radius: var(--radius-full);
      box-shadow: 0 0 6px rgba(5, 150, 105, 0.45);
    }

    .user-profile-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 8px;
      padding: 4px 8px;
      border-radius: var(--radius-full);
      transition: var(--transition-smooth);
    }

    .avatar-wrapper {
      position: relative;
      width: 40px;
      height: 40px;
    }

    .user-avatar {
      width: 100%;
      height: 100%;
      border-radius: var(--radius-full);
      object-fit: cover;
      border: 2px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }

    .user-status-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 11px;
      height: 11px;
      background: var(--success);
      border: 2px solid #ffffff;
      border-radius: var(--radius-full);
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .user-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .user-role {
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    /* Notification Dropdown */
    .notification-dropdown {
      position: absolute;
      top: 80px;
      right: 32px;
      width: 360px;
      background: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 16px;
      box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
      z-index: 1000;
    }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 12px;

      h4 {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--text-primary);
      }
    }

    .notif-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .notif-item {
      display: flex;
      gap: 10px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      padding: 8px;
      border-radius: var(--radius-sm);
      background: var(--bg-card-subtle);
    }

    .notif-bullet {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      margin-top: 5px;
      flex-shrink: 0;

      &.warning { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
      &.success { background: var(--success); box-shadow: 0 0 6px var(--success); }
      &.info { background: var(--info); box-shadow: 0 0 6px var(--info); }
    }

    .notif-time {
      display: block;
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .mobile-menu-btn {
      display: none;
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: var(--transition-smooth);
      flex-shrink: 0;

      @media (max-width: 900px) {
        display: flex;
      }

      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--primary-border);
        color: var(--primary-lavender);
      }
    }

    @media (max-width: 768px) {
      .app-header {
        padding: 0 16px;
        height: 64px;
      }

      .header-left {
        gap: 12px;
      }

      .page-title {
        font-size: 1.1rem;
      }

      .icon-grid {
        display: none;
      }

      .shift-indicator {
        display: none;
      }

      .header-right {
        gap: 8px;
      }

      .header-action-btn:nth-child(2),
      .header-action-btn:nth-child(3) {
        display: none;
      }

      .user-details {
        display: none;
      }
    }
  `]
})
export class HeaderComponent {
  authService = inject(AuthService);
  layoutService = inject(LayoutService);
  pwa = inject(PwaService);
  private router = inject(Router);
  showNotifications = false;

  getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('shift-handover')) return 'Cambio de Guardia';
    if (url.includes('pumps')) return 'Reporte de Bombas Slurry';
    if (url.includes('cyclones')) return 'Batería de Ciclones';
    if (url.includes('tailings')) return 'Descarga y Relaves';
    if (url.includes('maintenance')) return 'Mantenimiento & Evidencias';
    if (url.includes('admin')) return 'Administración de Planta';
    if (url.includes('profile')) return 'Mi Cuenta & Perfil';
    return 'Dashboard';
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}

