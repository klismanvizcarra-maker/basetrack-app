import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PwaService } from '../../core/pwa/pwa.service';

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
        padding: 14px 12px 32px;
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
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: var(--radius-md);

      .hero-icon-img {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-md);
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
      }

      h4 {
        font-size: 1.05rem;
        font-weight: 800;
        color: #047857;
        margin-bottom: 2px;
      }

      .hero-desc {
        font-size: 0.8rem;
        color: #065f46;
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

  tryDirectPrompt(): void {
    this.pwa.promptInstall().then(() => {
      this.pwa.closeInstallModal();
    });
  }
}

