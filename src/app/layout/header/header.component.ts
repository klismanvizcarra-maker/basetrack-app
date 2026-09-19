import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LayoutService } from '../../core/layout/layout.service';
import { PwaService } from '../../core/pwa/pwa.service';
import { OfflineSyncService } from '../../core/offline/offline-sync.service';
import { CloudSyncService } from '../../core/services/cloud-sync.service';

@Component({
  selector: 'app-header',
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
          <span class="shift-name">{{ authService.currentUser()?.shift || 'GUARDIA_A' }}</span>
        </div>
      </div>

      <!-- Action items on right side (CRAVEAT style) -->
      <div class="header-right">
        <!-- Cloud Realtime Sync & Multi-Device Status Pill -->
        <button
          type="button"
          class="btn-sync-header"
          [class.offline-pill]="!cloudSync.isOnline() && !offlineSync.isOnline()"
          [class.pending-pill]="cloudSync.pendingCount() > 0 || offlineSync.pendingCount() > 0"
          [class.syncing-pill]="cloudSync.isSyncing() || offlineSync.isSyncing()"
          (click)="offlineSync.openSyncDrawer()"
          title="Sincronización en la Nube Multi-Dispositivo"
        >
          <span class="status-pulse-dot" [class.dot-green]="(cloudSync.isOnline() || offlineSync.isOnline()) && cloudSync.pendingCount() === 0 && offlineSync.pendingCount() === 0" [class.dot-orange]="(!cloudSync.isOnline() && !offlineSync.isOnline()) || cloudSync.pendingCount() > 0 || offlineSync.pendingCount() > 0"></span>
          <span *ngIf="cloudSync.isSyncing() || offlineSync.isSyncing()">Sincronizando...</span>
          <span *ngIf="!cloudSync.isSyncing() && !offlineSync.isSyncing() && (cloudSync.isOnline() || offlineSync.isOnline()) && cloudSync.pendingCount() === 0 && offlineSync.pendingCount() === 0">
            Nube Activa ({{ cloudSync.activeDevicesCount() }})
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

    <!-- MODAL DE GESTIÓN OFFLINE E INDEXEDDB -->
    <div class="sync-modal-backdrop" *ngIf="offlineSync.showSyncModal()" (click)="offlineSync.closeSyncDrawer()">
      <div class="sync-modal-card animate-scale-in" (click)="$event.stopPropagation()">
        <div class="sync-modal-head">
          <div class="head-left">
            <span class="status-indicator-dot" [class.dot-green]="offlineSync.isOnline()" [class.dot-orange]="!offlineSync.isOnline()"></span>
            <h4>Estado de Conectividad & Persistencia Local</h4>
          </div>
          <button class="close-x-btn" (click)="offlineSync.closeSyncDrawer()">✕</button>
        </div>

        <div class="sync-modal-body">
          <div class="conn-status-banner" [class.banner-offline]="!offlineSync.isOnline()">
            <div class="banner-icon">
              {{ offlineSync.isOnline() ? '📶' : '🔌' }}
            </div>
            <div class="banner-text">
              <strong>{{ offlineSync.isOnline() ? 'Conectado a la Red de Planta' : 'Modo Offline Activo (Sin Conexión)' }}</strong>
              <p>Almacenamiento de alta capacidad: <strong>IndexedDB (basetrack_db)</strong> activo para registrar operaciones en terreno.</p>
            </div>
          </div>

          <!-- Multi-Device Cloud Realtime Card -->
          <div class="cloud-devices-card">
            <div class="cloud-card-header">
              <span class="cloud-icon">☁️</span>
              <div class="cloud-info">
                <strong>Sincronización en la Nube Multi-Dispositivo</strong>
                <p>Terminal activa: <span class="badge-terminal">{{ cloudSync.deviceName }}</span></p>
              </div>
              <span class="badge-devices">{{ cloudSync.activeDevicesCount() }} terminal{{ cloudSync.activeDevicesCount() > 1 ? 'es' : '' }} en red</span>
            </div>
            <div class="cloud-stats-row">
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
            <span class="check-icon">✓</span>
            <p>Todos los reportes, planillas y bitácoras operacionales están sincronizados entre dispositivos.</p>
          </div>
        </div>

        <div class="sync-modal-foot">
          <button class="btn btn-secondary" (click)="offlineSync.closeSyncDrawer()">Cerrar</button>
          <button
            class="btn btn-primary"
            (click)="syncAll()"
            [disabled]="cloudSync.isSyncing() || offlineSync.isSyncing()"
          >
            {{ (cloudSync.isSyncing() || offlineSync.isSyncing()) ? 'Sincronizando...' : '🔄 Sincronizar en la Nube' }}
          </button>
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
      transition: height 0.2s ease, padding 0.2s ease;

      @media (max-width: 768px) {
        height: 58px;
        padding: 0 12px;
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
        font-size: 1.05rem;
        max-width: 140px;
      }

      @media (max-width: 380px) {
        max-width: 100px;
        font-size: 0.95rem;
      }
    }

    .shift-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #eef2ff;
      padding: 4px 12px;
      border-radius: var(--radius-full);
      border: 1px solid #c7d2fe;
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
      color: #1e40af;
      font-weight: 500;
    }

    .shift-name {
      color: #031795;
      font-weight: 800;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;

      @media (max-width: 768px) {
        gap: 6px;
      }
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

      @media (max-width: 640px) {
        width: 36px;
        height: 36px;
      }

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
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #031795;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #e0e7ff;
        border-color: #031795;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(3, 23, 149, 0.2);
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
      top: 9px;
      right: 9px;
      width: 8px;
      height: 8px;
      background: #031795;
      border-radius: var(--radius-full);
      box-shadow: 0 0 6px rgba(3, 23, 149, 0.45);
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

      @media (max-width: 640px) {
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
      border: 1px solid #a7f3d0;
      background: #ecfdf5;
      color: #047857;
      transition: all 0.2s ease;

      &:hover {
        background: #d1fae5;
        border-color: #6ee7b7;
      }

      &.offline-pill, &.pending-pill {
        background: #fffbeb;
        border-color: #fde68a;
        color: #b45309;
        &:hover {
          background: #fef3c7;
        }
      }

      &.syncing-pill {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
      }
    }

    .status-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;

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
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1300;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .sync-modal-card {
      background: #ffffff;
      width: 100%;
      max-width: 520px;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .sync-modal-head {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;

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
          color: #0f172a;
        }
      }

      .close-x-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #64748b;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 6px;
        &:hover { background: #e2e8f0; color: #0f172a; }
      }
    }

    .sync-modal-body {
      padding: 1.5rem;
    }

    .conn-status-banner {
      display: flex;
      gap: 1rem;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
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
          color: #065f46;
          margin-bottom: 0.2rem;
        }
        p {
          margin: 0;
          font-size: 0.78rem;
          color: #047857;
          line-height: 1.4;
        }
      }

      &.banner-offline {
        background: #fffbeb;
        border-color: #fde68a;
        .banner-text strong { color: #92400e; }
        .banner-text p { color: #78350f; }
      }
    }

    .cloud-devices-card {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
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
            color: #0f766e;
          }

          p {
            margin: 2px 0 0;
            font-size: 0.74rem;
            color: #115e59;
          }

          .badge-terminal {
            font-weight: 700;
            background: #ccfbf1;
            padding: 1px 6px;
            border-radius: 4px;
            color: #0f766e;
          }
        }

        .badge-devices {
          font-size: 0.72rem;
          font-weight: 600;
          background: #0d9488;
          color: #ffffff;
          padding: 3px 8px;
          border-radius: 9999px;
        }
      }

      .cloud-stats-row {
        display: flex;
        justify-content: space-between;
        margin-top: 0.6rem;
        padding-top: 0.6rem;
        border-top: 1px dashed #99f6e4;
        font-size: 0.72rem;

        .stat-col {
          display: flex;
          gap: 4px;
          .s-label { color: #115e59; font-weight: 600; }
          .s-val { color: #042f2e; font-weight: 500; }
        }
      }
    }

    .sync-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;

      .meta-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.75rem;
        text-align: center;

        .m-lbl {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .m-count {
          display: block;
          font-size: 1.3rem;
          font-weight: 800;
          color: #0f172a;
          margin-top: 0.15rem;

          &.count-orange { color: #d97706; }
          &.text-sm { font-size: 0.85rem; font-weight: 700; }
        }
      }
    }

    .pending-list-wrapper {
      h5 {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        color: #475569;
        font-weight: 700;
      }

      .pending-items {
        max-height: 140px;
        overflow-y: auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }

      .pending-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.75rem;
        &:last-child { border-bottom: none; }

        .method-tag {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 800;
          font-size: 0.65rem;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
        }

        .item-name {
          font-weight: 600;
          color: #1e293b;
          flex: 1;
          margin: 0 0.5rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-time {
          color: #94a3b8;
          font-size: 0.7rem;
        }
      }
    }

    .empty-queue-msg {
      text-align: center;
      padding: 1rem;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;

      .check-icon {
        display: inline-block;
        width: 28px;
        height: 28px;
        line-height: 28px;
        border-radius: 50%;
        background: #ecfdf5;
        color: #059669;
        font-weight: 800;
        margin-bottom: 0.4rem;
      }

      p {
        margin: 0;
        font-size: 0.8rem;
        color: #475569;
      }
    }

    .sync-modal-foot {
      padding: 1rem 1.5rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;

      .btn {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
      }

      .btn-secondary {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #334155;
        &:hover { background: #f1f5f9; }
      }

      .btn-primary {
        background: #059669;
        color: #ffffff;
        &:hover:not(:disabled) { background: #047857; }
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
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
  offlineSync = inject(OfflineSyncService);
  cloudSync = inject(CloudSyncService);
  private router = inject(Router);
  showNotifications = false;

  getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('shift-handover')) return 'Cambio de Guardia';
    if (url.includes('pumps')) return 'Reporte de bombas';
    if (url.includes('cyclones')) return 'Reporte de ciclones';
    if (url.includes('tailings')) return 'Reporte de descarga';
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

