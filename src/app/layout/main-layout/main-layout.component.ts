import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PwaService } from '../../core/pwa/pwa.service';
import { LayoutService } from '../../core/layout/layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent, ModalComponent],
  template: `
    <div class="layout-container">
      <app-sidebar></app-sidebar>
      <div class="content-wrapper">
        <app-header></app-header>
        <main class="page-body">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Mobile Bottom Navigation Bar (Linear / iOS & Android Native App Experience) -->
      <nav class="mobile-bottom-bar" aria-label="Navegación Móvil Rápida">
        <!-- 1. Dashboard -->
        <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="bottom-nav-item" (click)="layoutService.closeMobileHub()">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Dashboard</span>
        </a>

        <!-- 2. Bombas -->
        <a routerLink="/pumps" routerLinkActive="active" class="bottom-nav-item" (click)="layoutService.closeMobileHub()">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="m4.93 4.93 4.24 4.24"></path>
              <path d="m14.83 9.17 4.24-4.24"></path>
              <path d="m14.83 14.83 4.24 4.24"></path>
              <path d="m9.17 14.83-4.24 4.24"></path>
              <circle cx="12" cy="12" r="4"></circle>
            </svg>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Bombas</span>
        </a>

        <!-- 3. Relevo -->
        <a routerLink="/shift-handover" routerLinkActive="active" class="bottom-nav-item" (click)="layoutService.closeMobileHub()">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Relevo</span>
        </a>

        <!-- 4. Camionetas -->
        <a routerLink="/vehicle-checklist" routerLinkActive="active" class="bottom-nav-item" (click)="layoutService.closeMobileHub()">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="1" y="3" width="15" height="13" rx="2"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Camionetas</span>
        </a>

        <!-- 5. Hub de Módulos (Menu Bottom-Sheet) -->
        <button 
          type="button" 
          class="bottom-nav-item btn-hub-toggle" 
          [class.active]="layoutService.isMobileHubOpen()"
          (click)="layoutService.toggleMobileHub()"
          aria-label="Abrir Hub de Módulos"
        >
          <div class="bottom-nav-icon-wrap">
            <div class="hub-toggle-icon" [class.is-open]="layoutService.isMobileHubOpen()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
                <circle cx="5" cy="12" r="2"></circle>
                <circle cx="12" cy="5" r="2"></circle>
                <circle cx="12" cy="19" r="2"></circle>
              </svg>
            </div>
            <span class="hub-pulse-dot" *ngIf="!layoutService.isMobileHubOpen()"></span>
            <span class="active-indicator-dot" *ngIf="layoutService.isMobileHubOpen()"></span>
          </div>
          <span class="bottom-nav-label">Módulos</span>
        </button>
      </nav>

      <!-- Mobile Operations Quick Hub (Native Bottom Sheet) -->
      <div 
        *ngIf="layoutService.isMobileHubOpen()" 
        class="mobile-hub-backdrop animate-fade-in" 
        (click)="layoutService.closeMobileHub()"
      >
        <div class="mobile-hub-sheet animate-slide-up" (click)="$event.stopPropagation()">
          <!-- Drag Handle Pill -->
          <div class="hub-drag-pill" (click)="layoutService.closeMobileHub()"></div>

          <!-- Hub Header with Operator Info -->
          <div class="hub-header">
            <div class="hub-user-info">
              <div class="hub-avatar-wrap">
                <img [src]="authService.currentUser()?.avatarUrl || '/images/basetrack-icon-transparent.png'" alt="Avatar" class="hub-avatar" />
                <span class="hub-status-dot"></span>
              </div>
              <div class="hub-user-meta">
                <div class="hub-user-name">{{ authService.currentUser()?.fullName || 'Operador de Planta' }}</div>
                <div class="hub-user-sub">
                  <span class="hub-role-badge">{{ authService.currentUser()?.role || 'OPERADOR' }}</span>
                  <span class="hub-shift-badge">Guardia {{ authService.currentUser()?.shift || 'G1' }}</span>
                </div>
              </div>
            </div>
            <button type="button" class="hub-close-btn" (click)="layoutService.closeMobileHub()" title="Cerrar Hub">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- Quick Navigation Tiles Grid (12 Industrial Modules) -->
          <div class="hub-grid-container">
            <div class="hub-section-title">TODOS LOS MÓDULOS DE PLANTA</div>
            <div class="hub-tiles-grid">
              <!-- 1. Dashboard -->
              <a routerLink="/dashboard" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
                <div class="hub-tile-icon icon-dash">📊</div>
                <span class="hub-tile-title">Dashboard</span>
                <span class="hub-tile-sub">KPIs Planta</span>
              </a>

              <!-- 2. Bombas -->
              <a routerLink="/pumps" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-pumps">🌊</div>
                <span class="hub-tile-title">Bombas</span>
                <span class="hub-tile-sub">24 Unidades</span>
              </a>

              <!-- 3. Ciclones -->
              <a routerLink="/cyclones" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-ciclones">🌀</div>
                <span class="hub-tile-title">Ciclones</span>
                <span class="hub-tile-sub">Muestreo UF/OF</span>
              </a>

              <!-- 4. Relaves -->
              <a routerLink="/tailings" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-relaves">🏔️</div>
                <span class="hub-tile-title">Relaves</span>
                <span class="hub-tile-sub">Borde Libre</span>
              </a>

              <!-- 5. Relevo de Guardia -->
              <a routerLink="/shift-handover" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-shift">📋</div>
                <span class="hub-tile-title">Relevo</span>
                <span class="hub-tile-sub">Cambio Turno</span>
              </a>

              <!-- 6. Mantenimiento -->
              <a routerLink="/maintenance" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-maint">🛠️</div>
                <span class="hub-tile-title">Mantenimiento</span>
                <span class="hub-tile-sub">OTs & Averías</span>
              </a>

              <!-- 7. Camionetas -->
              <a routerLink="/vehicle-checklist" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-truck">🛻</div>
                <span class="hub-tile-title">Camionetas</span>
                <span class="hub-tile-sub">Checklist 4x4</span>
              </a>

              <!-- 8. Cuadrilla -->
              <a routerLink="/crew" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-crew">👥</div>
                <span class="hub-tile-title">Cuadrilla</span>
                <span class="hub-tile-sub">Dotación & EPP</span>
              </a>

              <!-- 9. Rol 8x8 -->
              <a routerLink="/roster" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-roster">📅</div>
                <span class="hub-tile-title">Rol 8x8</span>
                <span class="hub-tile-sub">Calendario</span>
              </a>

              <!-- 10. Calculadoras -->
              <a routerLink="/calculators" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-calc">🧮</div>
                <span class="hub-tile-title">Calculadoras</span>
                <span class="hub-tile-sub">Flujos & Densidad</span>
              </a>

              <!-- 11. Mi Perfil -->
              <a routerLink="/profile" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-profile">👤</div>
                <span class="hub-tile-title">Mi Perfil</span>
                <span class="hub-tile-sub">Ficha & Radio</span>
              </a>

              <!-- 12. Administración -->
              <a *ngIf="authService.isAdmin() || authService.isSupervisor()" routerLink="/admin" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-admin">⚙️</div>
                <span class="hub-tile-title">Admin</span>
                <span class="hub-tile-sub">Control & Backup</span>
              </a>
            </div>
          </div>

          <!-- Quick Actions Footer Bar -->
          <div class="hub-quick-actions">
            <!-- Dark/Light Theme -->
            <button type="button" class="hub-action-btn" (click)="themeService.toggleTheme()">
              <span class="action-icon">{{ themeService.isDarkMode() ? '☀️' : '🌙' }}</span>
              <span>{{ themeService.isDarkMode() ? 'Modo Claro' : 'Modo Oscuro' }}</span>
            </button>

            <!-- PWA Install -->
            <button *ngIf="!pwa.isInstalled()" type="button" class="hub-action-btn install-btn" (click)="layoutService.closeMobileHub(); pwa.promptInstall()">
              <span class="action-icon">📲</span>
              <span>Instalar</span>
            </button>

            <!-- Logout -->
            <button type="button" class="hub-action-btn logout-btn" (click)="logout()">
              <span class="action-icon">🚪</span>
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PWA Install Guide Modal -->
    <app-modal
      [isOpen]="pwa.showInstallModal()"
      [title]="'Instalar BASETRACK como App Móvil / Tablet'"
      (close)="pwa.closeInstallModal()"
    >
      <div class="pwa-guide-content">
        <div class="app-icon-hero">
          <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK App" class="hero-icon-img" />
          <div>
            <h4>BASETRACK Mobile & Tablet</h4>
            <p class="hero-desc">Monitoreo de planta sin barras de navegador, pantalla completa y acceso rápido offline.</p>
          </div>
        </div>

        <div class="install-steps-list">
          <div class="step-card">
            <div class="step-badge">Android / Chrome</div>
            <p>1. Pulsa en los tres puntos <strong>(⋮)</strong> arriba a la derecha en Chrome.</p>
            <p>2. Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</p>
          </div>

          <div class="step-card">
            <div class="step-badge apple">iPhone / iPad (Safari)</div>
            <p>1. Pulsa el botón <strong>Compartir</strong> <span class="share-icon">⎙</span> en la barra inferior.</p>
            <p>2. Desliza hacia abajo y pulsa <strong>"Agregar al inicio"</strong> <span class="add-icon">➕</span>.</p>
          </div>

          <div class="step-card">
            <div class="step-badge pc">PC / Laptop (Chrome / Edge)</div>
            <p>1. Pulsa el icono de pantalla con flecha <strong>[⬇]</strong> en la barra de direcciones.</p>
            <p>2. Haz clic en <strong>"Instalar"</strong> para abrirla en ventana nativa independiente.</p>
          </div>
        </div>

        <div footer class="modal-footer-btns">
          <button type="button" class="btn btn-secondary" (click)="pwa.closeInstallModal()">Cerrar</button>
          <button type="button" class="btn btn-primary" (click)="tryDirectPrompt()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
              <path d="M12 6v6m-3-3 3 3 3-3"></path>
            </svg>
            Instalar Ahora
          </button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .layout-container {
      display: flex;
      min-height: 100vh;
      background-color: var(--bg-canvas);
      position: relative;
    }

    .content-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-x: hidden;
    }

    .page-body {
      flex: 1;
      padding: 24px 32px 48px;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;

      @media (max-width: 768px) {
        padding: 12px 10px calc(76px + env(safe-area-inset-bottom, 12px));
      }
    }

    /* Mobile Bottom Navigation Bar */
    .mobile-bottom-bar {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--mobile-bottom-bar-height, 62px) + env(safe-area-inset-bottom, 0px));
      padding: 6px 6px max(8px, env(safe-area-inset-bottom, 8px));
      background: var(--bg-glass);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--border-subtle);
      box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.08);
      z-index: 900;
      justify-content: space-around;
      align-items: center;

      @media (max-width: 768px) {
        display: flex;
      }
    }

    .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      flex: 1;
      height: 100%;
      text-decoration: none;
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      position: relative;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      padding: 2px 0;
      -webkit-tap-highlight-color: transparent;

      &:active {
        transform: scale(0.92);
      }

      &.active {
        color: var(--primary-purple);

        .bottom-nav-icon-wrap svg {
          stroke: var(--primary-purple);
          filter: drop-shadow(0 1px 4px var(--primary-glow));
        }

        .bottom-nav-label {
          color: var(--primary-purple);
          font-weight: 800;
        }

        .active-indicator-dot {
          opacity: 1;
          transform: scale(1);
        }
      }
    }

    .bottom-nav-icon-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 24px;

      svg {
        transition: transform 0.2s ease;
      }
    }

    .bottom-nav-label {
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      line-height: 1;
      transition: color 0.2s ease;
    }

    .active-indicator-dot {
      position: absolute;
      bottom: -3px;
      left: 50%;
      transform: translateX(-50%) scale(0);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--primary-purple);
      opacity: 0;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .crew-badge-dot {
      position: absolute;
      top: -1px;
      right: 0px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #2563eb;
      box-shadow: 0 0 5px rgba(37, 99, 235, 0.6);
    }

    .btn-menu-toggle {
      font-family: inherit;
    }

    /* Hub Toggle Button in Bottom Nav */
    .btn-hub-toggle {
      font-family: inherit;

      .hub-toggle-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);

        &.is-open {
          transform: rotate(90deg) scale(1.1);
        }
      }

      .hub-pulse-dot {
        position: absolute;
        top: 0px;
        right: 0px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--primary-purple);
        box-shadow: 0 0 6px var(--primary-glow);
        animation: hubPulse 2s infinite;
      }
    }

    @keyframes hubPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }

    /* Mobile Quick Hub Backdrop & Bottom Sheet */
    .mobile-hub-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1200;
      align-items: flex-end;
      justify-content: center;

      @media (max-width: 768px) {
        display: flex;
      }
    }

    .mobile-hub-sheet {
      width: 100%;
      max-width: 540px;
      max-height: 86dvh;
      background: var(--bg-card);
      border-radius: 24px 24px 0 0;
      border: 1px solid var(--border-subtle);
      border-bottom: none;
      box-shadow: 0 -12px 36px rgba(15, 23, 42, 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
      animation: hubSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes hubSlideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .hub-drag-pill {
      width: 44px;
      height: 5px;
      background: #cbd5e1;
      border-radius: var(--radius-full);
      margin: 10px auto 4px;
      cursor: pointer;
    }

    .hub-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px 12px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .hub-user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .hub-avatar-wrap {
      position: relative;
      width: 42px;
      height: 42px;

      .hub-avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #e2e8f0;
      }

      .hub-status-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 10px;
        height: 10px;
        background: #10b981;
        border: 2px solid #ffffff;
        border-radius: 50%;
      }
    }

    .hub-user-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .hub-user-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .hub-user-sub {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
    }

    .hub-role-badge {
      font-weight: 800;
      color: var(--primary-purple);
      background: var(--primary-bg-subtle);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .hub-shift-badge {
      color: var(--text-muted);
      font-weight: 600;
    }

    .hub-close-btn {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      transition: var(--transition-smooth);

      &:active {
        transform: scale(0.92);
      }
    }

    .hub-grid-container {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 12px 14px 8px;
    }

    .hub-section-title {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 10px;
      padding-left: 4px;
    }

    .hub-tiles-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .hub-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px 6px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      text-decoration: none;
      color: var(--text-primary);
      text-align: center;
      min-height: 82px;
      touch-action: manipulation;
      transition: var(--transition-smooth);

      &:active {
        transform: scale(0.94);
        background: var(--bg-card-hover);
      }

      &.active {
        border-color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        box-shadow: 0 0 0 1px var(--primary-purple);

        .hub-tile-title {
          color: var(--primary-purple);
          font-weight: 800;
        }
      }
    }

    .hub-tile-icon {
      font-size: 1.45rem;
      margin-bottom: 4px;
      line-height: 1;
    }

    .hub-tile-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.15;
    }

    .hub-tile-sub {
      font-size: 0.65rem;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .hub-quick-actions {
      display: flex;
      gap: 8px;
      padding: 10px 14px 4px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-card);
    }

    .hub-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 10px;
      font-size: 0.76rem;
      font-weight: 700;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-card-subtle);
      color: var(--text-primary);
      cursor: pointer;
      touch-action: manipulation;
      min-height: 40px;
      transition: var(--transition-smooth);

      &:active {
        transform: scale(0.95);
      }

      &.logout-btn {
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.25);
        background: rgba(239, 68, 68, 0.06);
      }

      &.install-btn {
        color: var(--primary-purple);
        border-color: var(--primary-border);
        background: var(--primary-bg-subtle);
      }
    }

    /* PWA Guide Styles */
    .pwa-guide-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .app-icon-hero {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);

      .hero-icon-img {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-md);
        box-shadow: 0 4px 12px rgba(3, 23, 149, 0.3);
      }

      h4 {
        font-size: 1.05rem;
        font-weight: 800;
        color: #031795;
        margin-bottom: 2px;
      }

      .hero-desc {
        font-size: 0.8rem;
        color: #1e40af;
        line-height: 1.35;
      }
    }

    .install-steps-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .step-card {
      padding: 12px 14px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-card-subtle);
      font-size: 0.82rem;
      line-height: 1.45;
      color: var(--text-secondary);

      p {
        margin: 2px 0;
      }

      strong {
        color: var(--text-primary);
      }
    }

    .step-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: #d1fae5;
      color: #065f46;
      margin-bottom: 6px;

      &.apple {
        background: #f1f5f9;
        color: #334155;
      }

      &.pc {
        background: #e0e7ff;
        color: #3730a3;
      }
    }

    .modal-footer-btns {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      width: 100%;
      margin-top: 10px;
    }
  `]
})
export class MainLayoutComponent {
  pwa = inject(PwaService);
  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  tryDirectPrompt(): void {
    this.pwa.promptInstall().then(() => {
      this.pwa.closeInstallModal();
    });
  }

  logout(): void {
    this.layoutService.closeMobileHub();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

