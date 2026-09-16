import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="app-sidebar">
      <!-- Logo brand (CRAVEAT style) -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18" />
            <path d="M3 12h18" />
          </svg>
        </div>
        <span class="brand-title">BASETRACK</span>
      </div>

      <!-- Navigation list -->
      <nav class="sidebar-nav">
        <div class="nav-section-title">OPERACIONES</div>
        <ul class="nav-list">
          <li class="nav-item">
            <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">
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
            <a routerLink="/shift-handover" routerLinkActive="active" class="nav-link">
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
            <a routerLink="/pumps" routerLinkActive="active" class="nav-link">
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
              <span class="nav-label">Bombas Slurry</span>
              <span class="nav-badge">6</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/cyclones" routerLinkActive="active" class="nav-link">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </span>
              <span class="nav-label">Batería Ciclones</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/tailings" routerLinkActive="active" class="nav-link">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </span>
              <span class="nav-label">Descarga & Relaves</span>
            </a>
          </li>

          <li class="nav-item">
            <a routerLink="/maintenance" routerLinkActive="active" class="nav-link">
              <span class="nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </span>
              <span class="nav-label">Mantenimiento</span>
              <span class="nav-badge">3</span>
            </a>
          </li>
        </ul>

        <div class="nav-section-title" style="margin-top: 24px;">SISTEMA</div>
        <ul class="nav-list">
          <li class="nav-item" *ngIf="authService.isSupervisor()">
            <a routerLink="/admin" routerLinkActive="active" class="nav-link">
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

      <!-- Offline / Online Connection Indicator -->
      <div class="sidebar-footer">
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
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 10px 24px;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 20px;
    }

    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, #a855f7 0%, #6b21a8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 0 16px rgba(168, 85, 247, 0.4);
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
        background: rgba(168, 85, 247, 0.1);
        color: var(--text-primary);
      }

      &.active {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
      }
    }

    .nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-badge {
      margin-left: auto;
      background: rgba(244, 114, 182, 0.25);
      color: var(--accent-pink);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-full);
    }

    .logout-btn:hover {
      background: rgba(248, 113, 113, 0.12);
      color: var(--danger);
    }

    .sidebar-footer {
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.03);

      &.online {
        color: var(--success);
        .status-pulse { background: var(--success); box-shadow: 0 0 8px var(--success); }
      }

      &.offline {
        color: var(--warning);
        .status-pulse { background: var(--warning); box-shadow: 0 0 8px var(--warning); }
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
  `]
})
export class SidebarComponent {
  authService = inject(AuthService);
  offlineSync = inject(OfflineSyncService);
}
