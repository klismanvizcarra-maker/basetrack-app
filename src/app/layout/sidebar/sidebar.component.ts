import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { LayoutService } from '../../core/layout/layout.service';
import { PwaService } from '../../core/pwa/pwa.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Mobile Backdrop -->
    <div
      *ngIf="layoutService.isSidebarOpen()"
      class="sidebar-backdrop"
      (click)="layoutService.closeSidebar()"
    ></div>

    <aside class="app-sidebar no-print" [class.mobile-open]="layoutService.isSidebarOpen()">
      <!-- Logo brand & Mobile close button -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK Logo" class="brand-icon-img" />
        </div>
        <span class="brand-title">BASETRACK</span>
        <button
          type="button"
          class="sidebar-close-btn"
          (click)="layoutService.closeSidebar()"
          title="Cerrar Menú"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Navigation list -->
      <nav class="sidebar-nav">
        <div class="nav-section-title">OPERACIONES</div>
        <ul class="nav-list">
          <li class="nav-item">
            <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </span>
              <span class="nav-label">Dashboard</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/shift-handover" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </span>
              <span class="nav-label">Cambio Guardia</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/crew" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </span>
              <span class="nav-label">Gestión de Cuadrilla</span>
              <span class="nav-badge-crew">5/5</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/pumps" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="m4.93 4.93 4.24 4.24"></path>
                  <path d="m14.83 9.17 4.24-4.24"></path>
                  <path d="m14.83 14.83 4.24 4.24"></path>
                  <path d="m9.17 14.83-4.24 4.24"></path>
                  <circle cx="12" cy="12" r="4"></circle>
                </svg>
              </span>
              <span class="nav-label">Reporte de bombas</span>
              <span class="nav-badge">6</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/cyclones" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
                </svg>
              </span>
              <span class="nav-label">Reporte de ciclones</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/tailings" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 20h20"></path>
                  <path d="m5 20 5-13 4 8 5-11 3 16"></path>
                </svg>
              </span>
              <span class="nav-label">Reporte de descarga</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/maintenance" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </span>
              <span class="nav-label">Mantenimiento</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/calculators" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                  <line x1="8" y1="6" x2="16" y2="6"></line>
                  <line x1="16" y1="14" x2="16" y2="18"></line>
                  <path d="M16 10h.01"></path>
                  <path d="M12 10h.01"></path>
                  <path d="M8 10h.01"></path>
                  <path d="M12 14h.01"></path>
                  <path d="M8 14h.01"></path>
                  <path d="M12 18h.01"></path>
                  <path d="M8 18h.01"></path>
                </svg>
              </span>
              <span class="nav-label">Calculadora Planta</span>
            </a>
          </li>

          <div class="nav-section-title" *ngIf="authService.isAdmin()">GESTIÓN</div>

          <li class="nav-item" *ngIf="authService.isAdmin()">
            <a routerLink="/admin" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </span>
              <span class="nav-label">Administración</span>
            </a>
          </li>
          <li class="nav-item">
            <a routerLink="/profile" routerLinkActive="active" class="nav-link" (click)="onNavClick()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <span class="nav-label">Mi Perfil / Cuenta</span>
            </a>
          </li>

          <li class="nav-item">
            <button type="button" class="nav-link logout-btn" (click)="authService.logout()">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </span>
              <span class="nav-label">Cerrar Sesión</span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Offline / Online Connection Indicator & PWA Install Box -->
      <div class="sidebar-footer">
        <!-- PWA Action Box -->
        <div class="pwa-action-box">
          <button
            *ngIf="!pwa.isInstalled()"
            type="button"
            class="pwa-install-btn"
            (click)="pwa.promptInstall()"
            title="Instalar BASETRACK en este dispositivo móvil o PC"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
              <path d="M12 6v6m-3-3 3 3 3-3"></path>
            </svg>
            <span>Instalar App en Dispositivo</span>
          </button>

          <div *ngIf="pwa.isInstalled()" class="pwa-active-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#031795" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Modo App Nativa PWA</span>
          </div>
        </div>

        <!-- Theme Mode Switch in Sidebar -->
        <div class="sidebar-theme-row" (click)="themeService.toggleTheme()" [title]="themeService.isDarkMode() ? 'Modo Oscuro Activo - Clic para cambiar a Modo Claro' : 'Modo Claro Activo - Clic para cambiar a Modo Oscuro'">
          <div class="theme-row-label">
            <span class="theme-row-icon">{{ themeService.isDarkMode() ? '🌙' : '☀️' }}</span>
            <span class="theme-row-text">{{ themeService.isDarkMode() ? 'Modo Oscuro' : 'Modo Claro' }}</span>
          </div>
          <div class="theme-switch-pill" [class.dark-active]="themeService.isDarkMode()">
            <span class="switch-thumb"></span>
          </div>
        </div>

        <div class="connection-status" [class.online]="offlineSync.isOnline()" [class.offline]="!offlineSync.isOnline()">
          <span class="status-pulse"></span>
          <span class="status-text">
            {{ offlineSync.isOnline() ? 'Sistema Conectado' : 'Modo Offline PWA' }}
          </span>
        </div>
        <span *ngIf="offlineSync.pendingCount() > 0" class="pending-sync-badge">
          {{ offlineSync.pendingCount() }} sincronizaciones
        </span>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(8, 6, 16, 0.75);
      backdrop-filter: blur(4px);
      z-index: 1050;
      animation: fadeIn 0.2s ease-out;

      @media (max-width: 900px) {
        display: block;
      }
    }

    .app-sidebar {
      width: 250px;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-subtle);
      height: 100vh;
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      z-index: 100;
      flex-shrink: 0;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      @media (max-width: 900px) {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        width: 270px;
        transform: translateX(-100%);
        z-index: 1100;
        box-shadow: none;

        &.mobile-open {
          transform: translateX(0);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
        }
      }
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 10px 24px;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 20px;
      position: relative;
    }

    .sidebar-close-btn {
      display: none;
      margin-left: auto;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: var(--radius-sm);
      transition: var(--transition-smooth);

      @media (max-width: 900px) {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &:hover {
        color: var(--text-primary);
        background: var(--bg-card-hover);
      }
    }

    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(3, 23, 149, 0.18), 0 0 0 1px rgba(3, 23, 149, 0.12);
      padding: 3px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .brand-icon-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .brand-title {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--text-primary);
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding-right: 4px;
    }

    .nav-section-title {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 0.08em;
      padding: 0 12px;
      margin-bottom: 8px;
    }

    .nav-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 11px 16px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 500;
      transition: var(--transition-smooth);
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: #f1f5f9;
        color: var(--text-primary);
      }

      &.active {
        background: linear-gradient(135deg, #031795 0%, #02106b 100%);
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 3px 12px rgba(3, 23, 149, 0.3);
      }
    }

    .nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-badge {
      margin-left: auto;
      background: #fce7f3;
      color: #be185d;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-full);
    }

    .nav-badge-crew {
      margin-left: auto;
      background: #eef2ff;
      color: #031795;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      border: 1px solid #c7d2fe;
    }

    .logout-btn:hover {
      background: #fee2e2;
      color: var(--danger);
    }

    .sidebar-footer {
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .pwa-action-box {
      margin-bottom: 6px;
    }

    .pwa-install-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, #031795 0%, #02106b 100%);
      color: #ffffff;
      border: none;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 3px 10px rgba(3, 23, 149, 0.28);
      transition: var(--transition-smooth);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 5px 14px rgba(3, 23, 149, 0.42);
        background: linear-gradient(135deg, #1e40af 0%, #031795 100%);
      }
    }

    .pwa-active-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #031795;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      background: #f8fafc;
      border: 1px solid var(--border-subtle);

      &.online {
        color: var(--success);
        .status-pulse { background: var(--success); box-shadow: 0 0 6px var(--success); }
      }

      &.offline {
        color: var(--warning);
        .status-pulse { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
      }
    }

    .status-pulse {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
    }

    .pending-sync-badge {
      font-size: 0.7rem;
      color: var(--accent-pink);
      padding: 2px 10px;
    }

    .sidebar-theme-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      cursor: pointer;
      user-select: none;
      transition: var(--transition-smooth);

      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--primary-border);
      }
    }

    .theme-row-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .theme-row-icon {
      font-size: 0.95rem;
    }

    .theme-switch-pill {
      width: 36px;
      height: 20px;
      background: #cbd5e1;
      border-radius: var(--radius-full);
      padding: 2px;
      display: flex;
      align-items: center;
      transition: all 0.25s ease;

      .switch-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      &.dark-active {
        background: #3b82f6;

        .switch-thumb {
          transform: translateX(16px);
          background: #ffffff;
        }
      }
    }
  `]
})
export class SidebarComponent {
  authService = inject(AuthService);
  offlineSync = inject(OfflineSyncService);
  layoutService = inject(LayoutService);
  pwa = inject(PwaService);
  themeService = inject(ThemeService);

  onNavClick(): void {
    if (window.innerWidth <= 900) {
      this.layoutService.closeSidebar();
    }
  }
}
