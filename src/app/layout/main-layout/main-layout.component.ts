import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PwaService } from '../../core/pwa/pwa.service';
import { LayoutService } from '../../core/layout/layout.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { getEffectiveAvatar } from '../../shared/utils/avatar.util';

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
                <img [src]="getUserAvatar()" alt="Avatar" class="hub-avatar" />
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
                <div class="hub-tile-icon icon-dash">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="9" rx="1"></rect>
                    <rect x="14" y="3" width="7" height="5" rx="1"></rect>
                    <rect x="14" y="12" width="7" height="9" rx="1"></rect>
                    <rect x="3" y="16" width="7" height="5" rx="1"></rect>
                  </svg>
                </div>
                <span class="hub-tile-title">Dashboard</span>
                <span class="hub-tile-sub">KPIs Planta</span>
              </a>

              <!-- 2. Bombas -->
              <a routerLink="/pumps" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-pumps">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m4.93 4.93 4.24 4.24"></path>
                    <path d="m14.83 9.17 4.24-4.24"></path>
                    <path d="m14.83 14.83 4.24 4.24"></path>
                    <path d="m9.17 14.83-4.24 4.24"></path>
                    <circle cx="12" cy="12" r="4"></circle>
                  </svg>
                </div>
                <span class="hub-tile-title">Bombas</span>
                <span class="hub-tile-sub">24 Unidades</span>
              </a>

              <!-- 3. Ciclones -->
              <a routerLink="/cyclones" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-ciclones">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Ciclones</span>
                <span class="hub-tile-sub">Muestreo UF/OF</span>
              </a>

              <!-- 4. Relaves -->
              <a routerLink="/tailings" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-relaves">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 20h20"></path>
                    <path d="m5 20 5-13 4 8 5-11 3 16"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Relaves</span>
                <span class="hub-tile-sub">Borde Libre</span>
              </a>

              <!-- Flowsheet / P&ID -->
              <a routerLink="/flowsheet" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-flowsheet">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="6" cy="6" r="2.5"></circle>
                    <circle cx="18" cy="18" r="2.5"></circle>
                    <circle cx="18" cy="6" r="2.5"></circle>
                    <path d="M6 8.5v7a2.5 2.5 0 0 0 2.5 2.5H15.5"></path>
                    <path d="M8.5 6H15.5"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Flowsheet</span>
                <span class="hub-tile-sub">P&ID Cortadera</span>
              </a>

              <!-- 5. Relevo de Guardia -->
              <a routerLink="/shift-handover" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-shift">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    <path d="m9 14 2 2 4-4"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Relevo</span>
                <span class="hub-tile-sub">Cambio Turno</span>
              </a>

              <!-- 6. Mantenimiento -->
              <a routerLink="/maintenance" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-maint">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Mantenimiento</span>
                <span class="hub-tile-sub">OTs & Averías</span>
              </a>

              <!-- 7. Camionetas -->
              <a routerLink="/vehicle-checklist" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-truck">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 17h4"></path>
                    <path d="M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                    <path d="M19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                    <path d="M14 5h4l3 5v4h-3"></path>
                    <path d="M7 17H3V6a1 1 0 0 1 1-1h10v12"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Camionetas</span>
                <span class="hub-tile-sub">Checklist 4x4</span>
              </a>

              <!-- 8. Cuadrilla -->
              <a routerLink="/crew" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-crew">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Cuadrilla</span>
                <span class="hub-tile-sub">Dotación & EPP</span>
              </a>

              <!-- 9. Rol 8x8 -->
              <a routerLink="/roster" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-roster">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
                <span class="hub-tile-title">Rol 8x8</span>
                <span class="hub-tile-sub">Calendario</span>
              </a>

              <!-- 10. Calculadoras -->
              <a routerLink="/calculators" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-calc">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <line x1="8" y1="6" x2="16" y2="6"></line>
                    <line x1="16" y1="14" x2="16" y2="18"></line>
                    <path d="M16 10h.01"></path>
                    <path d="M12 10h.01"></path>
                    <path d="M8 10h.01"></path>
                    <path d="M12 14h.01"></path>
                    <path d="M8 14h.01"></path>
                    <path d="M12 18h.01"></path>
                  </svg>
                </div>
                <span class="hub-tile-title">Calculadoras</span>
                <span class="hub-tile-sub">Flujos & Densidad</span>
              </a>

              <!-- 11. Mi Perfil -->
              <a routerLink="/profile" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-profile">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <span class="hub-tile-title">Mi Perfil</span>
                <span class="hub-tile-sub">Ficha & Radio</span>
              </a>

              <!-- 12. Administración -->
              <a *ngIf="authService.isAdmin() || authService.isSupervisor()" routerLink="/admin" (click)="layoutService.closeMobileHub()" class="hub-tile" routerLinkActive="active">
                <div class="hub-tile-icon icon-admin">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </div>
                <span class="hub-tile-title">Admin</span>
                <span class="hub-tile-sub">Control & Backup</span>
              </a>
            </div>
          </div>

          <!-- Quick Actions Footer Bar -->
          <div class="hub-quick-actions">
            <!-- Dark/Light Theme -->
            <button type="button" class="hub-action-btn" (click)="themeService.toggleTheme($event)">
              <span class="action-icon">
                <svg *ngIf="themeService.isDarkMode()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <svg *ngIf="!themeService.isDarkMode()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              </span>
              <span>{{ themeService.isDarkMode() ? 'Modo Claro' : 'Modo Oscuro' }}</span>
            </button>

            <!-- PWA Install -->
            <button *ngIf="!pwa.isInstalled()" type="button" class="hub-action-btn install-btn" (click)="layoutService.closeMobileHub(); pwa.promptInstall()">
              <span class="action-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="3"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  <path d="M12 6v6m-3-3 3 3 3-3"></path>
                </svg>
              </span>
              <span>Instalar</span>
            </button>

            <!-- Logout -->
            <button type="button" class="hub-action-btn logout-btn" (click)="logout()">
              <span class="action-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </span>
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PWA Install Guide Modal (Renovado con Detección Inteligente & Pestañas) -->
    <app-modal
      [isOpen]="pwa.showInstallModal()"
      [title]="'Instalar Aplicación Oficial BASETRACK'"
      (close)="pwa.closeInstallModal()"
    >
      <div class="pwa-guide-content">
        <div class="app-icon-hero">
          <img src="/images/basetrack-icon-transparent.png" alt="BASETRACK App" class="hero-icon-img" />
          <div class="hero-text-block">
            <h4>BASETRACK Planta Concentradora</h4>
            <p class="hero-desc">Monitoreo de planta sin barras de navegador, pantalla completa e inicio instantáneo sin conexión.</p>
          </div>
        </div>

        <!-- Pestañas por Plataforma con Detección Automática -->
        <div class="pwa-platform-tabs">
          <button 
            type="button" 
            class="pwa-tab-btn" 
            [class.active]="selectedInstallTab === 'mac'"
            (click)="selectedInstallTab = 'mac'"
          >
            <span class="tab-icon-wrap">
              <svg class="tab-svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2.03.62-2.67 1.37-.56.65-1.06 1.71-.93 2.72 1.02.08 2.07-.49 2.68-1.24z"/>
              </svg>
            </span>
            <span class="tab-label">Mac (macOS)</span>
            <span class="detected-chip" *ngIf="pwa.platform() === 'mac'">Tu Equipo</span>
          </button>
          <button 
            type="button" 
            class="pwa-tab-btn" 
            [class.active]="selectedInstallTab === 'ios'"
            (click)="selectedInstallTab = 'ios'"
          >
            <span class="tab-icon-wrap">
              <svg class="tab-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="2" width="12" height="20" rx="2.5"></rect>
                <line x1="11" y1="18" x2="13" y2="18"></line>
              </svg>
            </span>
            <span class="tab-label">iPhone / iPad</span>
            <span class="detected-chip" *ngIf="pwa.platform() === 'ios'">Tu Equipo</span>
          </button>
          <button 
            type="button" 
            class="pwa-tab-btn" 
            [class.active]="selectedInstallTab === 'android'"
            (click)="selectedInstallTab = 'android'"
          >
            <span class="tab-icon-wrap">
              <svg class="tab-svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.341c-.551 0-.999-.448-.999-.999s.448-.999.999-.999c.551 0 .999.448.999.999s-.448.999-.999.999m-11.046 0c-.551 0-.999-.448-.999-.999s.448-.999.999-.999.999.448.999.999-.448.999-.999.999m11.405-6.02l1.996-3.457a.557.557 0 0 0-.206-.77.56.56 0 0 0-.77.206l-2.022 3.502C15.35 8.17 13.723 7.8 12 7.8s-3.35.37-4.881 1.003L5.097 5.3a.56.56 0 0 0-.77-.206.557.557 0 0 0-.206.77l1.996 3.457C2.656 11.196.344 14.734 0 19.043h24c-.344-4.309-2.656-7.846-6.118-9.722"/>
              </svg>
            </span>
            <span class="tab-label">Android</span>
            <span class="detected-chip" *ngIf="pwa.platform() === 'android'">Tu Equipo</span>
          </button>
          <button 
            type="button" 
            class="pwa-tab-btn" 
            [class.active]="selectedInstallTab === 'windows'"
            (click)="selectedInstallTab = 'windows'"
          >
            <span class="tab-icon-wrap">
              <svg class="tab-svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.902-1.8"/>
              </svg>
            </span>
            <span class="tab-label">Windows / PC</span>
            <span class="detected-chip" *ngIf="pwa.platform() === 'windows' || pwa.platform() === 'pc'">Tu Equipo</span>
          </button>
        </div>

        <!-- Cuerpo de Instrucciones Específicas -->
        <div class="platform-guide-body">
          <!-- MAC (macOS) -->
          <div *ngIf="selectedInstallTab === 'mac'" class="platform-step-card animate-fade-in">
            <div class="step-card-header">
              <span class="step-platform-badge apple">Apple macOS</span>
              <span class="step-hint">Safari & Google Chrome</span>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">1</span>
              <div class="step-instruction-text">
                <strong>En Safari (Recomendado en Mac):</strong> En la barra de menús superior de tu Mac, ve a <strong>Archivo</strong> &rarr; haz clic en <strong>"Agregar al Dock..."</strong>.
                <div class="step-sub-note">También puedes pulsar el botón <em>Compartir</em>
                  <span class="inline-svg-icon" title="Compartir">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                      <polyline points="16 6 12 2 8 6"></polyline>
                      <line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                  </span>
                  en Safari y seleccionar <strong>"Agregar al Dock"</strong>.
                </div>
              </div>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">2</span>
              <div class="step-instruction-text">
                <strong>En Chrome / Edge:</strong> Haz clic en el icono 
                <span class="inline-svg-icon" title="Instalar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </span>
                en la barra de direcciones superior y confirma.
              </div>
            </div>
            <div class="step-benefit-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" class="benefit-check-icon">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <strong>Resultado:</strong> BASETRACK se anclará a tu Dock como app nativa independiente sin marcos de navegador.
            </div>
          </div>

          <!-- IPHONE / IPAD -->
          <div *ngIf="selectedInstallTab === 'ios'" class="platform-step-card animate-fade-in">
            <div class="step-card-header">
              <span class="step-platform-badge apple">Apple iOS & iPadOS</span>
              <span class="step-hint">Navegador Safari</span>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">1</span>
              <div class="step-instruction-text">
                Abre esta página en <strong>Safari</strong> y pulsa el botón <strong>Compartir</strong>
                <span class="inline-svg-icon" title="Compartir">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                  </svg>
                </span>
                (rectángulo con flecha hacia arriba).
              </div>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">2</span>
              <div class="step-instruction-text">
                Desliza hacia abajo en el menú de opciones y pulsa <strong>"Agregar a pantalla de inicio"</strong>
                <span class="inline-svg-icon" title="Agregar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>.
              </div>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">3</span>
              <div class="step-instruction-text">
                Pulsa <strong>"Agregar"</strong> en la esquina superior derecha. ¡Listo! Ya tienes el icono oficial de BASETRACK en tu inicio.
              </div>
            </div>
          </div>

          <!-- ANDROID -->
          <div *ngIf="selectedInstallTab === 'android'" class="platform-step-card animate-fade-in">
            <div class="step-card-header">
              <span class="step-platform-badge android">Google Android</span>
              <span class="step-hint">Chrome & Samsung Internet</span>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">1</span>
              <div class="step-instruction-text">
                Pulsa el botón <strong>"Instalar Ahora"</strong> abajo para abrir el diálogo nativo de descarga inmediata.
              </div>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">2</span>
              <div class="step-instruction-text">
                Si tu navegador no emite el aviso automático, pulsa los <strong>tres puntos (⋮)</strong> arriba a la derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
              </div>
            </div>
          </div>

          <!-- WINDOWS / PC -->
          <div *ngIf="selectedInstallTab === 'windows'" class="platform-step-card animate-fade-in">
            <div class="step-card-header">
              <span class="step-platform-badge pc">Windows / Laptop</span>
              <span class="step-hint">Google Chrome & Microsoft Edge</span>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">1</span>
              <div class="step-instruction-text">
                En la barra superior de direcciones (URL), busca el icono de descarga
                <span class="inline-svg-icon" title="Instalar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </span>
                o el símbolo de instalación
                <span class="inline-svg-icon" title="Agregar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>.
              </div>
            </div>
            <div class="step-instruction-row">
              <span class="step-number-pill">2</span>
              <div class="step-instruction-text">
                Haz clic en <strong>"Instalar"</strong>. La app se abrirá en su propia ventana y podrás anclarla a la Barra de Tareas.
              </div>
            </div>
          </div>
        </div>

        <div footer class="modal-footer-btns">
          <button type="button" class="btn btn-secondary" (click)="pwa.closeInstallModal()">Entendido</button>
          <button 
            type="button" 
            class="btn btn-primary btn-install-direct" 
            (click)="tryDirectPrompt()"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
              <path d="M12 6v6m-3-3 3 3 3-3"></path>
            </svg>
            Instalar en este Dispositivo
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
      color: var(--text-muted);
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
      background: var(--tint-neutral-strong, #cbd5e1);
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
        border: 2px solid var(--border-color);
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
          color: var(--brand-text);
          font-weight: 800;
        }

        .hub-tile-icon {
          background: var(--primary-purple);
          color: #ffffff;
        }
      }
    }

    .hub-tile-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
      background: rgba(3, 23, 149, 0.06);
      color: var(--brand-text);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      svg {
        display: block;
        width: 19px;
        height: 19px;
      }
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

      .action-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

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
        width: 54px;
        height: 54px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(3, 23, 149, 0.25);
        object-fit: contain;
      }

      .hero-text-block {
        flex: 1;
      }

      h4 {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--text-primary);
        margin: 0 0 3px 0;
      }

      .hero-desc {
        font-size: 0.8rem;
        color: var(--text-secondary);
        line-height: 1.35;
        margin: 0;
      }
    }

    .pwa-platform-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: var(--bg-card-subtle);
      padding: 4px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);

      @media (max-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .pwa-tab-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 6px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      gap: 6px;

      .tab-icon-wrap {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(100, 116, 139, 0.08);
        color: var(--text-secondary);
        transition: all 0.18s ease;

        .tab-svg {
          display: block;
        }
      }

      .tab-label {
        font-size: 0.75rem;
        white-space: nowrap;
        font-weight: 600;
      }

      .detected-chip {
        font-size: 0.62rem;
        font-weight: 800;
        background: #059669;
        color: #ffffff;
        padding: 1px 6px;
        border-radius: 10px;
        letter-spacing: 0.2px;
      }

      &:hover {
        background: var(--bg-surface);
        color: var(--text-primary);

        .tab-icon-wrap {
          background: rgba(3, 23, 149, 0.08);
          color: var(--brand-text);
        }
      }

      &.active {
        background: var(--bg-surface);
        color: var(--brand-text);
        border-color: var(--primary-purple);
        box-shadow: 0 2px 8px rgba(3, 23, 149, 0.12);
        font-weight: 700;

        .tab-icon-wrap {
          background: rgba(3, 23, 149, 0.12);
          color: var(--brand-text);
        }

        .tab-label {
          color: var(--brand-text);
        }
      }
    }

    .inline-svg-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: -2px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      padding: 2px 4px;
      color: var(--text-primary);
      margin: 0 2px;
      line-height: 1;

      svg {
        display: block;
      }
    }

    .benefit-check-icon {
      display: inline-block;
      vertical-align: -2px;
      margin-right: 4px;
    }

    .platform-guide-body {
      min-height: 140px;
    }

    .platform-step-card {
      padding: 14px 16px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-card-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .step-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px dashed var(--border-subtle);
      padding-bottom: 8px;

      .step-platform-badge {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 6px;
        letter-spacing: 0.4px;

        &.apple {
          background: var(--bg-card-hover);
          color: var(--tint-text-strong, #334155);
        }
        &.android {
          background: var(--tint-success-bg, #dcfce7);
          color: var(--tint-success-text, #166534);
        }
        &.pc {
          background: var(--tint-info-bg, #e0e7ff);
          color: var(--tint-info-text, #3730a3);
        }
      }

      .step-hint {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: 500;
      }
    }

    .step-instruction-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;

      .step-number-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--primary-purple);
        color: #ffffff;
        font-size: 0.72rem;
        font-weight: 800;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .step-instruction-text {
        font-size: 0.82rem;
        line-height: 1.45;
        color: var(--text-secondary);

        strong {
          color: var(--text-primary);
        }

        .step-sub-note {
          font-size: 0.76rem;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .badge-icon {
          display: inline-block;
          font-weight: 800;
          color: var(--brand-text);
        }
      }
    }

    .step-benefit-box {
      font-size: 0.78rem;
      background: var(--tint-info-bg, #eff6ff);
      border: 1px solid var(--tint-info-border, #bfdbfe);
      color: var(--primary-lavender);
      padding: 8px 12px;
      border-radius: 8px;
      line-height: 1.4;

      strong {
        color: var(--tint-info-text, #1d4ed8);
      }
    }

    .modal-footer-btns {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      width: 100%;
      margin-top: 6px;

      .btn-install-direct {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        background: var(--primary-purple);
        color: #ffffff;
        border: none;
        padding: 9px 18px;
        font-weight: 700;
        font-size: 0.85rem;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(3, 23, 149, 0.25);
        transition: transform 0.15s ease, background 0.15s ease;

        &:hover {
          background: #021278;
          transform: translateY(-1px);
        }
      }
    }

    :host-context(.dark-theme) {
      .hub-tile-icon {
        background: rgba(59, 130, 246, 0.12);
        color: #60a5fa;
      }

      .hub-tile.active {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
        box-shadow: 0 0 0 1px #3b82f6;

        .hub-tile-icon {
          background: #2563eb;
          color: #ffffff;
        }

        .hub-tile-title {
          color: #60a5fa;
        }
      }

      .pwa-tab-btn {
        .tab-icon-wrap {
          background: rgba(255, 255, 255, 0.06);
          color: #94a3b8;
        }

        &:hover {
          .tab-icon-wrap {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
          }
        }

        &.active {
          color: #60a5fa;
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);

          .tab-icon-wrap {
            background: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
          }

          .tab-label {
            color: #60a5fa;
          }
        }
      }

      .step-benefit-box {
        background: rgba(30, 58, 138, 0.2);
        border-color: rgba(59, 130, 246, 0.3);
        color: #93c5fd;

        strong {
          color: #bfdbfe;
        }
      }

      .modal-footer-btns .btn-install-direct {
        background: #2563eb;
        &:hover {
          background: #1d4ed8;
        }
      }
    }
  `]
})
export class MainLayoutComponent implements OnInit {
  pwa = inject(PwaService);
  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  selectedInstallTab: 'ios' | 'android' | 'mac' | 'windows' | 'pc' = 'mac';

  ngOnInit(): void {
    const detected = this.pwa.platform();
    this.selectedInstallTab = detected === 'pc' ? 'windows' : detected;
  }

  tryDirectPrompt(): void {
    this.pwa.promptInstall().then(() => {
      this.pwa.closeInstallModal();
    });
  }

  getUserAvatar(): string {
    const user = this.authService.currentUser();
    return getEffectiveAvatar(user?.avatarUrl, user?.fullName || user?.username, user?.role, user?.shift);
  }

  logout(): void {
    this.layoutService.closeMobileHub();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

