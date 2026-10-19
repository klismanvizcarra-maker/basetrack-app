import { Component, inject, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LayoutService } from '../../core/layout/layout.service';
import { PwaService } from '../../core/pwa/pwa.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { CloudSyncService } from '../../core/services/cloud-sync.service';
import { ThemeService } from '../../core/theme/theme.service';
import { NotificationService, NotificationItem } from '../../core/services/notification.service';
import { getCurrentActiveShift } from '../../shared/utils/roster.util';
import { getEffectiveAvatar } from '../../shared/utils/avatar.util';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header no-print">
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
          <span class="shift-name">{{ displayShift }}</span>
        </div>
      </div>

      <!-- Action items on right side (CRAVEAT style) -->
      <div class="header-right">
        <!-- Cloud Realtime Sync & Multi-Device Status Pill -->
        <button
          type="button"
          class="btn-sync-header"
          [class.ws-live-pill]="cloudSync.isWsConnected()"
          [class.offline-pill]="!cloudSync.isOnline() && !offlineSync.isOnline()"
          [class.pending-pill]="cloudSync.pendingCount() > 0 || offlineSync.pendingCount() > 0"
          [class.syncing-pill]="cloudSync.isSyncing() || offlineSync.isSyncing()"
          (click)="offlineSync.openSyncDrawer()"
          title="Sincronización en la Nube Multi-Dispositivo"
        >
          <span class="status-pulse-dot"
            [class.dot-ws]="cloudSync.isWsConnected()"
            [class.dot-green]="!cloudSync.isWsConnected() && (cloudSync.isOnline() || offlineSync.isOnline()) && cloudSync.pendingCount() === 0 && offlineSync.pendingCount() === 0"
            [class.dot-orange]="(!cloudSync.isOnline() && !offlineSync.isOnline()) || cloudSync.pendingCount() > 0 || offlineSync.pendingCount() > 0"></span>
          <span *ngIf="cloudSync.isSyncing() || offlineSync.isSyncing()">
            <span class="sync-full-text">Sincronizando...</span>
            <span class="sync-mobile-text">Sync...</span>
          </span>
          <span *ngIf="!cloudSync.isSyncing() && !offlineSync.isSyncing() && cloudSync.isWsConnected()">
            <span class="sync-full-text">En Vivo <span class="ws-indicator-tag">WS</span> ({{ cloudSync.activeDevicesCount() }})</span>
            <span class="sync-mobile-text">WS ({{ cloudSync.activeDevicesCount() }})</span>
          </span>
          <span *ngIf="!cloudSync.isSyncing() && !offlineSync.isSyncing() && !cloudSync.isWsConnected() && (cloudSync.isOnline() || offlineSync.isOnline()) && cloudSync.pendingCount() === 0 && offlineSync.pendingCount() === 0">
            <span class="sync-full-text">Nube Activa ({{ cloudSync.activeDevicesCount() }})</span>
            <span class="sync-mobile-text">Online</span>
          </span>
          <span *ngIf="!cloudSync.isSyncing() && !offlineSync.isSyncing() && (!cloudSync.isOnline() || cloudSync.pendingCount() > 0 || offlineSync.pendingCount() > 0)">
            {{ (cloudSync.isOnline() || offlineSync.isOnline()) ? (cloudSync.pendingCount() + offlineSync.pendingCount()) + ' pend.' : 'Modo Mina' }}
          </span>
        </button>

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
        <button 
          type="button" 
          class="header-action-btn notif-bell-btn" 
          [title]="notifService.unreadCount() > 0 ? (notifService.unreadCount() + ' alertas no leídas del SCADA') : 'Alertas de Planta & SCADA'" 
          (click)="toggleNotifications()"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span class="notification-indicator" *ngIf="notifService.unreadCount() > 0">
            <span class="notif-count-text">{{ notifService.unreadCount() }}</span>
          </span>
        </button>

        <!-- Messages / Chat -->
        <button type="button" class="header-action-btn btn-chat-header" title="Canal Radial de Guardia">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <!-- Settings / Profile -->
        <button type="button" class="header-action-btn btn-settings-header" title="Configuración de Cuenta & Perfil" (click)="goToProfile()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>

        <!-- Theme Toggle (Dark / Light) -->
        <button
          type="button"
          class="header-action-btn theme-toggle-btn"
          (click)="themeService.toggleTheme($event)"
          [title]="themeService.isDarkMode() ? 'Modo Oscuro Activo - Cambiar a Modo Claro' : 'Modo Claro Activo - Cambiar a Modo Oscuro'"
          aria-label="Cambiar tema de la interfaz"
        >
          <!-- Sun Icon (shown when dark to switch to light) -->
          <svg *ngIf="themeService.isDarkMode()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="sun-icon">
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
          <!-- Moon Icon (shown when light to switch to dark) -->
          <svg *ngIf="!themeService.isDarkMode()" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="moon-icon">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>

        <!-- User Profile Avatar with Online Status Dot -->
        <div class="user-profile-badge" (click)="goToProfile()" style="cursor: pointer" title="Configurar mi cuenta y perfil">
          <div class="avatar-wrapper">
            <img
              [src]="getUserAvatar()"
              alt="Avatar"
              class="user-avatar"
            />
            <span class="user-status-dot"></span>
          </div>
          <div class="user-meta">
            <span class="user-name">{{ authService.currentUser()?.fullName || 'Usuario' }}</span>
            <span class="user-role">{{ authService.currentUser()?.role || 'OPERADOR' }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Notification Backdrop to close on click outside -->
    <div *ngIf="showNotifications" class="notif-backdrop" (click)="showNotifications = false"></div>

    <!-- Notification Dropdown Panel (Centro de Alertas SCADA Vivas) -->
    <div *ngIf="showNotifications" class="notification-dropdown glass-panel animate-scale-in" (click)="$event.stopPropagation()">
      <div class="notif-header">
        <div class="notif-header-title">
          <div class="notif-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div>
            <h4>Alertas SCADA & Telemetría</h4>
            <span class="notif-subtitle">Eventos operacionales en tiempo real</span>
          </div>
        </div>
        <div class="notif-header-actions">
          <span class="notif-badge" [class.badge-has-unread]="notifService.unreadCount() > 0">
            {{ notifService.unreadCount() }} nueva{{ notifService.unreadCount() === 1 ? '' : 's' }}
          </span>
          <button 
            type="button" 
            class="btn-mark-all" 
            *ngIf="notifService.unreadCount() > 0"
            (click)="notifService.markAllAsRead()"
            title="Marcar todas las alertas como leídas"
          >
            Leídas
          </button>
          <button type="button" class="btn-close-notif" (click)="showNotifications = false" title="Cerrar panel" aria-label="Cerrar panel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="notif-tabs">
        <button 
          type="button" 
          class="notif-tab-btn" 
          [class.active]="notifService.activeTab() === 'ALL'"
          (click)="notifService.setTab('ALL')"
        >
          Todas ({{ notifService.notifications().length }})
        </button>
        <button 
          type="button" 
          class="notif-tab-btn tab-crit" 
          [class.active]="notifService.activeTab() === 'CRITICAL'"
          (click)="notifService.setTab('CRITICAL')"
        >
          Críticas / Averías
        </button>
        <button 
          type="button" 
          class="notif-tab-btn tab-ops" 
          [class.active]="notifService.activeTab() === 'OPERATION'"
          (click)="notifService.setTab('OPERATION')"
        >
          Operación
        </button>
      </div>

      <!-- Notification List -->
      <div class="notif-list">
        <div 
          *ngFor="let item of notifService.filteredNotifications()" 
          class="notif-item" 
          [class.unread]="!item.isRead"
          [class.item-critical]="item.severity === 'critical'"
          [class.item-warning]="item.severity === 'warning'"
          [class.item-success]="item.severity === 'success'"
          [class.item-info]="item.severity === 'info'"
          (click)="handleNotificationClick(item)"
        >
          <div class="notif-content-block">
            <div class="notif-top-row">
              <span class="notif-badge-pill" [class]="item.severity">
                <svg *ngIf="item.severity === 'critical'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <svg *ngIf="item.severity === 'warning'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <svg *ngIf="item.severity === 'success'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg *ngIf="item.severity === 'info'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                {{ item.severity === 'critical' ? 'CRÍTICA' : (item.severity === 'warning' ? 'ATENCIÓN' : (item.severity === 'success' ? 'NORMAL' : 'INFO')) }}
              </span>
              <span class="notif-tag" *ngIf="item.equipmentTag">{{ item.equipmentTag }}</span>
              <span class="notif-time">{{ item.timeAgo }}</span>
            </div>
            <strong class="notif-title">{{ item.title }}</strong>
            <p class="notif-desc">{{ item.description }}</p>
            <div class="notif-action-row" *ngIf="item.route">
              <span class="notif-nav-hint">Ver en módulo &rarr;</span>
            </div>
          </div>
          <button 
            type="button" 
            class="notif-dismiss-btn" 
            (click)="notifService.dismissNotification(item.id, $event)"
            title="Descartar esta alerta"
            aria-label="Descartar esta alerta"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Empty State -->
        <div *ngIf="notifService.filteredNotifications().length === 0" class="notif-empty-state">
          <div class="empty-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <strong>Sin alertas en este filtro</strong>
          <p>Todos los subsistemas de planta operan dentro de parámetros reglamentarios.</p>
        </div>
      </div>
    </div>

    <!-- MODAL DE GESTIÓN OFFLINE E INDEXEDDB -->
    <div class="sync-modal-backdrop" *ngIf="offlineSync.showSyncModal()" (click)="offlineSync.closeSyncDrawer()">
      <div class="sync-modal-card animate-scale-in" (click)="$event.stopPropagation()">
        <div class="sync-modal-head">
          <div class="head-left">
            <span class="status-indicator-dot" [class.dot-green]="offlineSync.isOnline()" [class.dot-orange]="!offlineSync.isOnline()"></span>
            <h4>Estado de Conectividad & Persistencia Local</h4>
          </div>
          <button class="close-x-btn" (click)="offlineSync.closeSyncDrawer()" aria-label="Cerrar modal">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="sync-modal-body">
          <div class="conn-status-banner" [class.banner-offline]="!offlineSync.isOnline()">
            <div class="banner-icon">
              <svg *ngIf="offlineSync.isOnline()" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
              <svg *ngIf="!offlineSync.isOnline()" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
            </div>
            <div class="banner-text">
              <strong>{{ offlineSync.isOnline() ? 'Conectado a la Red de Planta' : 'Modo Offline Activo (Sin Conexión)' }}</strong>
              <p>Almacenamiento de alta capacidad: <strong>IndexedDB (basetrack_db)</strong> activo para registrar operaciones en terreno.</p>
            </div>
          </div>

          <!-- Multi-Device Cloud Realtime Card -->
          <div class="cloud-devices-card">
            <div class="cloud-card-header">
              <span class="cloud-icon">
                <svg *ngIf="cloudSync.isWsConnected()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <svg *ngIf="!cloudSync.isWsConnected()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                </svg>
              </span>
              <div class="cloud-info">
                <strong>Sincronización Multi-Dispositivo {{ cloudSync.isWsConnected() ? 'en Tiempo Real (WebSocket)' : 'en la Nube (HTTP)' }}</strong>
                <p>Terminal: <span class="badge-terminal">{{ cloudSync.deviceName }}</span> • Latencia: <span class="badge-terminal">{{ cloudSync.wsLatencyMs() !== null ? cloudSync.wsLatencyMs() + ' ms' : '< 20 ms' }}</span></p>
              </div>
              <span class="badge-devices" [class.badge-ws]="cloudSync.isWsConnected()">
                {{ cloudSync.activeDevicesCount() }} terminal{{ cloudSync.activeDevicesCount() > 1 ? 'es' : '' }} en red
              </span>
            </div>
            <div class="cloud-stats-row">
              <div class="stat-col">
                <span class="s-label">Canal de Datos:</span>
                <span class="s-val">{{ cloudSync.isWsConnected() ? 'WebSocket Bi-direccional' : 'HTTP Polling (6s)' }}</span>
              </div>
              <div class="stat-col">
                <span class="s-label">Último Evento:</span>
                <span class="s-val">{{ cloudSync.lastSyncedEntity() }}</span>
              </div>
              <div class="stat-col">
                <span class="s-label">Hora Réplica:</span>
                <span class="s-val">{{ (cloudSync.lastSyncTime() | date:'HH:mm:ss') || 'En vivo' }}</span>
              </div>
            </div>
          </div>

          <div class="sync-meta-grid">
            <div class="meta-box">
              <span class="m-lbl">Registros en Cola</span>
              <span class="m-count" [class.count-orange]="cloudSync.pendingCount() > 0 || offlineSync.pendingCount() > 0">
                {{ cloudSync.pendingCount() + offlineSync.pendingCount() }}
              </span>
            </div>
            <div class="meta-box">
              <span class="m-lbl">Última Sincronización</span>
              <span class="m-count text-sm">{{ (cloudSync.lastSyncTime() | date:'HH:mm:ss') || offlineSync.lastSyncTime() || 'Al iniciar sesión' }}</span>
            </div>
          </div>

          <div class="pending-list-wrapper" *ngIf="offlineSync.queueItems().length > 0">
            <h5>Acciones pendientes de subir al servidor:</h5>
            <div class="pending-items">
              <div class="pending-row" *ngFor="let item of offlineSync.queueItems()">
                <span class="method-tag">{{ item.method }}</span>
                <span class="item-name">{{ item.entityName }}</span>
                <span class="item-time">{{ item.timestamp | date:'HH:mm:ss' }}</span>
              </div>
            </div>
          </div>

          <div class="empty-queue-msg" *ngIf="offlineSync.queueItems().length === 0 && cloudSync.pendingCount() === 0">
            <span class="check-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <p>Todos los reportes, planillas y bitácoras operacionales están sincronizados entre dispositivos.</p>
          </div>
        </div>

        <div class="sync-modal-foot">
          <button class="btn btn-backup-export" (click)="offlineSync.exportEmergencyBackupJson()" title="Descargar copia de seguridad en JSON de los datos en este equipo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar Respaldo Local (JSON)
          </button>
          <div class="foot-main-actions">
            <button *ngIf="offlineSync.queueItems().length > 0" class="btn btn-secondary btn-sm" (click)="offlineSync.clearQueue()" title="Limpiar cola pendiente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Purgar Cola
            </button>
            <button class="btn btn-secondary" (click)="offlineSync.closeSyncDrawer()">Cerrar</button>
            <button
              class="btn btn-primary"
              (click)="syncAll()"
              [disabled]="cloudSync.isSyncing() || offlineSync.isSyncing()"
            >
              <span *ngIf="cloudSync.isSyncing() || offlineSync.isSyncing()">Sincronizando...</span>
              <span *ngIf="!cloudSync.isSyncing() && !offlineSync.isSyncing()" style="display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 4v6h-6"></path>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Sincronizar en la Nube
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Connectivity Toast Banner -->
    <div *ngIf="connectivityToastMessage" class="connectivity-toast-banner animate-fade-in" [class.toast-offline]="!isOnlineToast" [class.toast-online]="isOnlineToast">
      <span class="toast-dot"></span>
      <span class="toast-text">{{ connectivityToastMessage }}</span>
      <button class="toast-close" (click)="connectivityToastMessage = null" aria-label="Cerrar notificación">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `,
  styles: [`
    .app-header {
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      background: var(--bg-glass);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: height 0.2s ease, padding 0.2s ease;

      @media (max-width: 768px) {
        height: auto;
        min-height: calc(56px + env(safe-area-inset-top, 0px));
        padding: max(8px, calc(env(safe-area-inset-top, 0px) + 4px)) 12px 8px 12px;
      }
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;

      @media (max-width: 768px) {
        gap: 8px;
        min-width: 0;
      }
    }

    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 10px;

      @media (max-width: 768px) {
        gap: 6px;
        min-width: 0;
      }
    }

    .icon-grid {
      color: var(--text-secondary);
      display: flex;
      align-items: center;

      @media (max-width: 500px) {
        display: none;
      }
    }

    .page-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      @media (max-width: 768px) {
        font-size: clamp(0.92rem, 3.2vw, 1.12rem);
        max-width: 160px;
      }

      @media (max-width: 400px) {
        max-width: 110px;
        font-size: 0.92rem;
      }
    }

    .shift-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--primary-bg-subtle);
      padding: 4px 12px;
      border-radius: var(--radius-full);
      border: 1px solid var(--tint-info-border, #c7d2fe);
      font-size: 0.75rem;
      flex-shrink: 0;

      @media (max-width: 640px) {
        padding: 3px 8px;
        font-size: 0.7rem;

        .shift-tag {
          display: none;
        }
      }
    }

    .shift-tag {
      color: var(--primary-lavender);
      font-weight: 500;
    }

    .shift-name {
      color: var(--brand-text);
      font-weight: 800;
    }

    .sync-mobile-text {
      display: none;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;

      @media (max-width: 768px) {
        gap: 6px;
      }

      @media (max-width: 600px) {
        gap: 5px;

        .btn-chat-header,
        .btn-settings-header,
        .btn-install-header {
          display: none !important;
        }

        .sync-full-text {
          display: none;
        }

        .sync-mobile-text {
          display: inline;
          font-weight: 700;
        }

        .btn-sync-header {
          padding: 5px 8px;
          font-size: 0.72rem;
        }

        .header-action-btn {
          width: 36px;
          height: 36px;
        }
      }

      @media (max-width: 380px) {
        gap: 3px;

        .header-action-btn {
          width: 32px;
          height: 32px;
        }

        .btn-sync-header {
          padding: 4px 6px;
          font-size: 0.68rem;
        }
      }
    }

    .header-action-btn {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--bg-card-hover);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: var(--transition-smooth);

      @media (max-width: 640px) {
        width: 36px;
        height: 36px;
      }

      &:hover {
        background: var(--bg-input);
        color: var(--text-primary);
        border-color: var(--primary-border);
      }
    }

    .theme-toggle-btn {
      position: relative;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease;

      .sun-icon {
        color: #f59e0b;
        filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.65));
        animation: theme-icon-sun 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      .moon-icon {
        color: #2563eb;
        filter: drop-shadow(0 0 5px rgba(37, 99, 235, 0.45));
        animation: theme-icon-moon 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      &:hover {
        transform: rotate(12deg) scale(1.06);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    @keyframes theme-icon-sun {
      from {
        transform: rotate(-70deg) scale(0.4);
        opacity: 0;
      }
      to {
        transform: rotate(0deg) scale(1);
        opacity: 1;
      }
    }

    @keyframes theme-icon-moon {
      from {
        transform: rotate(70deg) scale(0.4);
        opacity: 0;
      }
      to {
        transform: rotate(0deg) scale(1);
        opacity: 1;
      }
    }

    .btn-install-header {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: var(--radius-full);
      background: var(--primary-bg-subtle, #eef2ff);
      border: 1px solid var(--primary-border, #c7d2fe);
      color: var(--primary-purple, #031795);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--primary-purple);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px var(--primary-glow);
      }

      @media (max-width: 640px) {
        span {
          display: none;
        }
        padding: 8px;
        width: 36px;
        height: 36px;
        justify-content: center;
      }
    }

    .notification-indicator {
      position: absolute;
      top: 5px;
      right: 5px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      background: #dc2626;
      color: #ffffff;
      font-size: 0.64rem;
      font-weight: 800;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--bg-card);
      box-shadow: 0 2px 6px rgba(220, 38, 38, 0.45);
    }

    .user-profile-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 8px;
      padding: 4px 8px;
      border-radius: var(--radius-full);
      transition: var(--transition-smooth);

      @media (max-width: 640px) {
        margin-left: 0;
        padding: 0;
      }
    }

    .avatar-wrapper {
      position: relative;
      width: 40px;
      height: 40px;

      @media (max-width: 640px) {
        width: 34px;
        height: 34px;
      }
    }

    .user-avatar {
      width: 100%;
      height: 100%;
      border-radius: var(--radius-full);
      object-fit: cover;
      border: 2px solid var(--border-color);
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

      @media (max-width: 640px) {
        display: none;
      }
    }

    /* Tablet / laptop angosto con la barra lateral visible: la cabecera no debe desbordar
       el área de contenido (empujaba toda la página a un scroll horizontal) */
    @media (min-width: 769px) and (max-width: 1279px) {
      .app-header {
        padding: 0 16px;
        gap: 12px;
      }

      .header-left,
      .title-with-icon {
        min-width: 0;
      }

      .header-right {
        gap: 8px;
      }

      .user-meta,
      .btn-install-header {
        display: none;
      }
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

    /* Notification Backdrop */
    .notif-backdrop {
      position: fixed;
      inset: 0;
      z-index: 998;
      background: transparent;
    }

    /* Notification Dropdown Panel */
    .notification-dropdown {
      position: absolute;
      top: 76px;
      right: 32px;
      width: 410px;
      max-height: 540px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 16px;
      box-shadow: 0 12px 36px -4px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 12px;

      @media (max-width: 600px) {
        top: calc(58px + env(safe-area-inset-top, 0px));
        right: 10px;
        left: 10px;
        width: auto;
        max-width: calc(100vw - 20px);
        max-height: 80vh;
      }
    }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);

      .notif-header-title {
        display: flex;
        align-items: center;
        gap: 10px;

        .notif-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--primary-bg-subtle);
          color: var(--brand-text);
        }

        h4 {
          font-size: 0.92rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.2;
        }

        .notif-subtitle {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
      }

      .notif-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .notif-badge {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--bg-card-subtle);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);

          &.badge-has-unread {
            background: var(--danger-bg);
            color: var(--danger);
            border-color: var(--tint-danger-border, #fecaca);
          }
        }

        .btn-mark-all {
          background: transparent;
          border: 1px solid var(--tint-info-border, #bfdbfe);
          color: var(--primary-lavender);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            background: var(--tint-info-bg, #eff6ff);
            color: var(--brand-text);
          }
        }

        .btn-close-notif {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.9rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          line-height: 1;

          &:hover {
            background: var(--bg-card-subtle);
            color: var(--text-primary);
          }
        }
      }
    }

    .notif-tabs {
      display: flex;
      gap: 6px;
      background: var(--bg-card-subtle);
      padding: 3px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);

      .notif-tab-btn {
        flex: 1;
        padding: 5px 8px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--text-secondary);
        transition: all 0.15s ease;
        text-align: center;
        white-space: nowrap;

        &:hover {
          color: var(--text-primary);
        }

        &.active {
          background: var(--bg-card);
          color: var(--brand-text);
          font-weight: 700;
          border-color: var(--border-subtle);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

          &.tab-crit {
            color: var(--danger);
          }
          &.tab-ops {
            color: var(--success);
          }
        }
      }
    }

    .notif-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      max-height: 380px;
      padding-right: 4px;
    }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease;

      &:hover {
        background: var(--bg-card);
        border-color: var(--tint-neutral-strong, #cbd5e1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      }

      &.unread {
        border-left-width: 4px;

        &.item-critical {
          border-left-color: #dc2626;
          background: var(--tint-danger-bg, #fff5f5);
        }
        &.item-warning {
          border-left-color: #d97706;
          background: var(--warning-bg);
        }
        &.item-success {
          border-left-color: #059669;
          background: var(--tint-success-bg, #f0fdf4);
        }
        &.item-info {
          border-left-color: var(--primary-purple);
          background: var(--tint-info-bg, #f5f7ff);
        }
      }

      .notif-content-block {
        flex: 1;
        min-width: 0;

        .notif-top-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;

          .notif-badge-pill {
            font-size: 0.65rem;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: 0.2px;

            &.critical { background: var(--tint-danger-bg, #fee2e2); color: var(--tint-danger-text, #991b1b); }
            &.warning { background: var(--tint-warning-bg, #fef3c7); color: var(--tint-warning-text, #92400e); }
            &.success { background: var(--tint-success-bg, #dcfce7); color: var(--tint-success-text, #166534); }
            &.info { background: var(--tint-info-bg, #e0e7ff); color: var(--tint-info-text, #3730a3); }
          }

          .notif-tag {
            font-size: 0.68rem;
            font-weight: 800;
            background: #0f172a;
            color: #ffffff;
            padding: 1px 5px;
            border-radius: 4px;
          }

          .notif-time {
            font-size: 0.68rem;
            color: var(--text-secondary);
            margin-left: auto;
          }
        }

        .notif-title {
          display: block;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
          margin-bottom: 2px;
        }

        .notif-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.35;
          margin: 0;
        }

        .notif-action-row {
          margin-top: 5px;

          .notif-nav-hint {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--brand-text);
            display: inline-flex;
            align-items: center;
            gap: 4px;

            &:hover {
              text-decoration: underline;
            }
          }
        }
      }

      .notif-dismiss-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 0.75rem;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        opacity: 0.6;
        transition: opacity 0.15s ease;

        &:hover {
          opacity: 1;
          color: var(--text-primary);
        }
      }
    }

    .notif-empty-state {
      padding: 24px 16px;
      text-align: center;
      color: var(--text-secondary);

      .empty-icon-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: var(--success-bg);
        color: var(--success);
        font-size: 1.2rem;
        font-weight: 800;
        margin-bottom: 8px;
      }

      strong {
        display: block;
        font-size: 0.86rem;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      p {
        font-size: 0.75rem;
        line-height: 1.4;
        margin: 0;
      }
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

    /* SYNC STATUS PILL */
    .btn-sync-header {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0.4rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid var(--primary-border, #c7d2fe);
      background: var(--primary-bg-subtle, #eef2ff);
      color: var(--primary-purple, #031795);
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--primary-purple);
      }

      @media (max-width: 580px) {
        padding: 4px 8px;
        font-size: 0.68rem;
        gap: 4px;
        max-width: 130px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      // Zona táctil de 44 px de alto en pantallas táctiles sin cambiar el tamaño visible
      @media (pointer: coarse) {
        position: relative;
        overflow: visible;

        // El recorte con "…" pasa al texto, ya que el botón no puede ocultar su zona táctil
        > span:not(.status-pulse-dot) {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        &::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 44px;
          transform: translateY(-50%);
        }
      }

      &.ws-live-pill {
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.45);
        color: var(--success);

        &:hover {
          background: rgba(16, 185, 129, 0.22);
          border-color: #10b981;
        }
      }

      .ws-indicator-tag {
        background: #059669;
        color: #ffffff;
        font-size: 0.6rem;
        padding: 1px 4px;
        border-radius: 4px;
        font-weight: 800;
        margin: 0 1px;
      }

      &.offline-pill, &.pending-pill {
        background: var(--warning-bg, #fffbeb);
        border-color: rgba(245, 158, 11, 0.35);
        color: var(--warning, #b45309);
        &:hover {
          background: rgba(245, 158, 11, 0.2);
        }
      }

      &.syncing-pill {
        background: var(--primary-bg-subtle, #eff6ff);
        border-color: var(--primary-border, #bfdbfe);
        color: var(--primary-purple, #1d4ed8);
      }
    }

    .status-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;

      &.dot-ws {
        background: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
        animation: pulse 1.8s infinite ease-in-out;
      }

      &.dot-green {
        background: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
      }

      &.dot-orange {
        background: #f59e0b;
        box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        animation: pulse 1.5s infinite;
      }
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }

    /* MODAL DE SINCRONIZACIÓN */
    .sync-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(9, 14, 26, 0.75);
      backdrop-filter: blur(6px);
      z-index: 1300;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .sync-modal-card {
      background: var(--bg-card);
      width: 100%;
      max-width: 520px;
      border-radius: 16px;
      box-shadow: var(--shadow-card);
      border: 1px solid var(--border-subtle);
      overflow: hidden;

      @media (max-width: 600px) {
        max-height: calc(92dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
        border-radius: 20px 20px 0 0;
        margin-top: auto;
        margin-bottom: 0;
      }
    }

    .sync-modal-head {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card-subtle);

      .head-left {
        display: flex;
        align-items: center;
        gap: 0.6rem;

        .status-indicator-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          &.dot-green { background: #10b981; }
          &.dot-orange { background: #f59e0b; }
        }

        h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
        }
      }

      .close-x-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: var(--text-muted);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 6px;
        transition: var(--transition-smooth);
        &:hover { background: var(--bg-card-hover); color: var(--text-primary); }
      }
    }

    .sync-modal-body {
      padding: 1.5rem;
      background: var(--bg-card);
    }

    .conn-status-banner {
      display: flex;
      gap: 1rem;
      background: var(--primary-bg-subtle, #eef2ff);
      border: 1px solid var(--primary-border, #c7d2fe);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.25rem;

      .banner-icon {
        font-size: 1.8rem;
      }

      .banner-text {
        strong {
          display: block;
          font-size: 0.9rem;
          color: var(--primary-purple);
          margin-bottom: 0.2rem;
        }
        p {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
      }

      &.banner-offline {
        background: var(--warning-bg, #fffbeb);
        border-color: rgba(245, 158, 11, 0.4);
        .banner-text strong { color: var(--warning, #92400e); }
        .banner-text p { color: var(--text-secondary); }
      }
    }

    .cloud-devices-card {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.25rem;

      .cloud-card-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .cloud-icon {
          font-size: 1.4rem;
        }

        .cloud-info {
          flex: 1;

          strong {
            display: block;
            font-size: 0.84rem;
            color: var(--text-primary);
          }

          p {
            margin: 2px 0 0;
            font-size: 0.74rem;
            color: var(--text-muted);
          }

          .badge-terminal {
            font-weight: 700;
            background: rgba(16, 185, 129, 0.18);
            padding: 1px 6px;
            border-radius: 4px;
            color: #10b981;
          }
        }

        .badge-devices {
          font-size: 0.72rem;
          font-weight: 600;
          background: #0d9488;
          color: #ffffff;
          padding: 3px 8px;
          border-radius: 9999px;

          &.badge-ws {
            background: #059669;
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
          }
        }
      }

      .cloud-stats-row {
        display: flex;
        justify-content: space-between;
        margin-top: 0.6rem;
        padding-top: 0.6rem;
        border-top: 1px dashed var(--border-subtle);
        font-size: 0.72rem;

        .stat-col {
          display: flex;
          gap: 4px;
          .s-label { color: var(--text-muted); font-weight: 600; }
          .s-val { color: var(--text-primary); font-weight: 500; }
        }
      }
    }

    .sync-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;

      .meta-box {
        background: var(--bg-card-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 0.75rem;
        text-align: center;

        .m-lbl {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .m-count {
          display: block;
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-top: 0.15rem;

          &.count-orange { color: #f59e0b; }
          &.text-sm { font-size: 0.85rem; font-weight: 700; }
        }
      }
    }

    .pending-list-wrapper {
      h5 {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
        font-weight: 700;
      }

      .pending-items {
        max-height: 140px;
        overflow-y: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        background: var(--bg-input);
      }

      .pending-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        &:last-child { border-bottom: none; }

        .method-tag {
          background: rgba(59, 130, 246, 0.18);
          color: var(--primary-lavender);
          font-weight: 800;
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
        }

        .item-name {
          font-weight: 600;
          color: var(--text-primary);
          flex: 1;
          margin: 0 0.5rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-time {
          color: var(--text-muted);
          font-size: 0.7rem;
        }
      }
    }

    .empty-queue-msg {
      text-align: center;
      padding: 1rem;
      background: var(--bg-card-subtle);
      border: 1px dashed var(--border-subtle);
      border-radius: 8px;

      .check-icon {
        display: inline-block;
        width: 28px;
        height: 28px;
        line-height: 28px;
        border-radius: 50%;
        background: var(--primary-bg-subtle);
        color: var(--primary-purple);
        font-weight: 800;
        margin-bottom: 0.4rem;
      }

      p {
        margin: 0;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
    }

    .sync-modal-foot {
      padding: 1rem 1.5rem;
      background: var(--bg-card-subtle);
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;

      .foot-main-actions {
        display: flex;
        gap: 0.75rem;
      }

      .btn {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: var(--transition-smooth);
      }

      .btn-backup-export {
        background: var(--warning-bg, #fffbeb);
        color: var(--warning, #b45309);
        border-color: rgba(245, 158, 11, 0.4);
        &:hover {
          background: rgba(245, 158, 11, 0.22);
          border-color: var(--warning);
        }
      }

      .btn-secondary {
        background: var(--bg-card);
        border-color: var(--border-subtle);
        color: var(--text-primary);
        &:hover { background: var(--bg-card-hover); }
      }

      .btn-primary {
        background: var(--primary-purple);
        color: #ffffff;
        &:hover:not(:disabled) {
          background: var(--primary-violet);
          filter: brightness(1.1);
        }
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    /* Floating Connectivity Toast Banner */
    .connectivity-toast-banner {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);

      &.toast-online {
        background: #064e3b;
        color: #ecfdf5;
        border-color: #10b981;
        .toast-dot { background: #34d399; box-shadow: 0 0 10px #34d399; }
      }

      &.toast-offline {
        background: #7f1d1d;
        color: #fef2f2;
        border-color: #ef4444;
        .toast-dot { background: #f87171; box-shadow: 0 0 10px #f87171; }
      }

      .toast-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .toast-text {
        flex: 1;
      }

      .toast-close {
        background: transparent;
        border: none;
        color: currentColor;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 4px;
        opacity: 0.8;
        &:hover { opacity: 1; }
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

    :host-context([data-theme="dark"]),
    :host-context(.dark-theme) {
      .user-avatar {
        border-color: #1e293b;
      }
      .user-status-dot {
        border-color: var(--bg-card);
      }
      .notif-item {
        &.unread {
          &.item-critical {
            background: rgba(220, 38, 38, 0.15);
            border-left-color: #ef4444;
          }
          &.item-warning {
            background: rgba(217, 119, 6, 0.15);
            border-left-color: #f59e0b;
          }
          &.item-success {
            background: rgba(5, 150, 105, 0.15);
            border-left-color: #10b981;
          }
          &.item-info {
            background: rgba(59, 130, 246, 0.15);
            border-left-color: #3b82f6;
          }
        }
        .notif-top-row {
          .notif-badge-pill {
            &.critical { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
            &.warning { background: rgba(245, 158, 11, 0.2); color: #fde68a; }
            &.success { background: rgba(16, 185, 129, 0.2); color: #a7f3d0; }
            &.info { background: rgba(99, 102, 241, 0.2); color: #c7d2fe; }
          }
          .notif-tag {
            background: #1e293b;
            color: #94a3b8;
          }
        }
        .notif-action-row .notif-nav-hint {
          color: #60a5fa;
        }
      }
      .notif-filter-tab {
        &.active {
          color: #60a5fa;
          background: var(--bg-card);
        }
      }
      .conn-status-banner {
        background: rgba(59, 130, 246, 0.12);
        border-color: rgba(59, 130, 246, 0.3);
        .banner-text strong {
          color: #60a5fa;
        }
        &.banner-offline {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.35);
          .banner-text strong {
            color: #fbbf24;
          }
        }
      }
      .btn-sync-header {
        &.offline-pill, &.pending-pill {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.4);
        }
        &.syncing-pill {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.4);
        }
      }
    }
  `]
})
export class HeaderComponent implements OnDestroy {
  authService = inject(AuthService);
  layoutService = inject(LayoutService);
  pwa = inject(PwaService);
  offlineSync = inject(OfflineSyncService);
  cloudSync = inject(CloudSyncService);
  themeService = inject(ThemeService);
  notifService = inject(NotificationService);
  private router = inject(Router);
  showNotifications = false;

  getUserAvatar(): string {
    const user = this.authService.currentUser();
    return getEffectiveAvatar(user?.avatarUrl, user?.fullName || user?.username, user?.role, user?.shift);
  }

  handleNotificationClick(item: NotificationItem): void {
    this.showNotifications = false;
    this.notifService.onNotificationClick(item);
  }

  get displayShift(): string {
    const user = this.authService.currentUser();
    if (user?.role !== 'ADMIN' && user?.shift && user.shift !== 'ADMIN') {
      return user.shift;
    }
    return getCurrentActiveShift().activeGuard.code;
  }

  connectivityToastMessage: string | null = null;
  isOnlineToast = true;
  private onlineListener?: () => void;
  private offlineListener?: () => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.onlineListener = () => {
        this.isOnlineToast = true;
        this.connectivityToastMessage = 'Conexión Restablecida — Sincronizando con el servidor...';
        setTimeout(() => {
          this.connectivityToastMessage = null;
        }, 4500);
      };

      this.offlineListener = () => {
        this.isOnlineToast = false;
        this.connectivityToastMessage = 'Modo Offline Activo — Datos guardados localmente con seguridad';
        setTimeout(() => {
          this.connectivityToastMessage = null;
        }, 5000);
      };

      window.addEventListener('online', this.onlineListener);
      window.addEventListener('offline', this.offlineListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineListener) window.removeEventListener('online', this.onlineListener);
      if (this.offlineListener) window.removeEventListener('offline', this.offlineListener);
    }
  }

  getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('shift-handover')) return 'Cambio de Guardia';
    if (url.includes('crew')) return 'Gestión de Cuadrilla';
    if (url.includes('roster')) return 'Rol de Guardias (8x8)';
    if (url.includes('pumps')) return 'Reporte de Bombas';
    if (url.includes('cyclones')) return 'Reporte de Ciclones';
    if (url.includes('tailings')) return 'Presa de Relaves & Descarga';
    if (url.includes('calculators')) return 'Calculadora Planta';
    if (url.includes('flowsheet')) return 'Diagrama P&ID';
    if (url.includes('vehicle-checklist')) return 'Checklist Camionetas';
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

  syncAll(): void {
    this.cloudSync.forceSync();
    this.offlineSync.forceSyncNow();
  }
}

