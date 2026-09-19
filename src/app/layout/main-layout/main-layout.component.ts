import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PwaService } from '../../core/pwa/pwa.service';
import { LayoutService } from '../../core/layout/layout.service';

@Component({
  selector: 'app-main-layout',
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

      <!-- Mobile Bottom Navigation Bar (Linear / iOS Native App Experience) -->
      <nav class="mobile-bottom-bar" aria-label="Navegación Móvil Rápida">
        <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="bottom-nav-item">
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

        <a routerLink="/cyclones" routerLinkActive="active" class="bottom-nav-item">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"></path>
            </svg>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Ciclones</span>
        </a>

        <a routerLink="/pumps" routerLinkActive="active" class="bottom-nav-item">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="m14 10-4 4m0-4 4 4"></path>
            </svg>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Bombas</span>
        </a>

        <a routerLink="/crew" routerLinkActive="active" class="bottom-nav-item">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="crew-badge-dot"></span>
            <span class="active-indicator-dot"></span>
          </div>
          <span class="bottom-nav-label">Cuadrilla</span>
        </a>

        <button type="button" class="bottom-nav-item btn-menu-toggle" (click)="layoutService.toggleSidebar()">
          <div class="bottom-nav-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="4" y1="7" x2="20" y2="7"></line>
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="17" x2="20" y2="17"></line>
            </svg>
          </div>
          <span class="bottom-nav-label">Menú</span>
        </button>
      </nav>
    </div>

    <!-- PWA Install Guide Modal -->
    <app-modal
      [isOpen]="pwa.showInstallModal()"
      [title]="'Instalar BASETRACK como App Móvil / Tablet'"
      (close)="pwa.closeInstallModal()"
    >
      <div class="pwa-guide-content">
        <div class="app-icon-hero">
          <img src="/icons/icon.svg" alt="BASETRACK App" class="hero-icon-img" />
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
      height: var(--mobile-bottom-bar-height, 62px);
      padding: 4px 6px max(6px, env(safe-area-inset-bottom, 6px));
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid rgba(226, 232, 240, 0.9);
      box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.05);
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
        color: #031795;

        .bottom-nav-icon-wrap svg {
          stroke: #031795;
          filter: drop-shadow(0 1px 4px rgba(3, 23, 149, 0.35));
        }

        .bottom-nav-label {
          color: #031795;
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
      background: #031795;
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
      background: #eef2ff;
      border: 1px solid #c7d2fe;
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
      background: #f8fafc;
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

  tryDirectPrompt(): void {
    this.pwa.promptInstall().then(() => {
      this.pwa.closeInstallModal();
    });
  }
}

