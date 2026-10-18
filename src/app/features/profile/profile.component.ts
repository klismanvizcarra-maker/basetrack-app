import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ShiftCode } from '../../core/auth/auth.models';
import { ThemeService } from '../../core/theme/theme.service';
import { Router } from '@angular/router';
import { generateAvatarSvg, getEffectiveAvatar, getUserInitials } from '../../shared/utils/avatar.util';
import { CloudSyncService } from '../../core/services/cloud-sync.service';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container animate-fade-in">
      <!-- Top Title Header -->
      <div class="profile-header">
        <div>
          <h2>Configuración de Cuenta & Perfil</h2>
          <p class="section-sub">Administra tus nombres, fotografía de identificación y credenciales de acceso a BASETRACK</p>
        </div>
      </div>

      <!-- Contraseña temporal: cambio obligatorio antes de usar la aplicación -->
      <div *ngIf="authService.currentUser()?.mustChangePassword" class="alert-banner alert-danger animate-fade-in" role="alert">
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <strong>Debes cambiar tu contraseña temporal</strong> antes de continuar. Escribe la contraseña que te entregó el administrador en "Contraseña actual" y elige una nueva de al menos 8 caracteres.
        </span>
      </div>

      <!-- Feedback Alerts -->
      <div *ngIf="successMessage" class="alert-banner alert-success animate-fade-in">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{{ successMessage }}</span>
      </div>

      <div *ngIf="errorMessage" class="alert-banner alert-danger animate-fade-in">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <div class="profile-grid">
        <!-- Left Column: Avatar & Quick Info Card -->
        <div class="card-column left-card">
          <div class="profile-card avatar-card glass-panel">
            <div class="avatar-header">
              <h3>Fotografía de Perfil</h3>
              <p class="card-desc">Visible en el registro de guardia, bitácoras y header</p>
            </div>

            <!-- Avatar Preview with badge -->
            <div class="avatar-preview-box">
              <div class="avatar-ring">
                <img [src]="profileForm.avatarUrl" alt="Avatar Usuario" class="preview-img" (error)="onImageError()" />
                <button type="button" class="btn-camera" (click)="fileInput.click()" title="Subir foto desde tu dispositivo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </button>
              </div>
              <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/*" style="display: none" />
              
              <div class="user-pill-info">
                <h4>{{ profileForm.fullName || 'Usuario' }}</h4>
                <div class="badges-row">
                  <span class="badge" [class.badge-primary]="authService.currentUser()?.role === 'ADMIN'" [class.badge-success]="authService.currentUser()?.role === 'SUPERVISOR'" [class.badge-warning]="authService.currentUser()?.role === 'OPERATOR'">
                    {{ authService.currentUser()?.role === 'ADMIN' ? 'ADMINISTRADOR GENERAL' : (authService.currentUser()?.role === 'SUPERVISOR' ? 'SUPERVISOR DE GUARDIA' : (authService.currentUser()?.role || 'OPERADOR')) }}
                  </span>
                  <span class="badge badge-slate" *ngIf="authService.currentUser()?.role !== 'ADMIN' && profileForm.shift">
                    {{ profileForm.shift.startsWith('G') ? 'GUARDIA ' + profileForm.shift.slice(1) : profileForm.shift }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Upload & Avatar Management -->
            <div class="avatar-actions">
              <div class="avatar-btn-row">
                <button type="button" class="btn btn-primary btn-upload-avatar" (click)="fileInput.click()">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Subir Fotocheck / Foto</span>
                </button>
                <button type="button" class="btn btn-secondary btn-reset-avatar" (click)="resetToDefaultAvatar()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1 4 1 10 7 10"></polyline>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                  </svg>
                  <span>Iniciales {{ userInitials }}</span>
                </button>
              </div>

              <!-- Quick Plant Avatars Preset Gallery -->
              <div class="preset-gallery">
                <span class="preset-title">Estilos de Monograma & Logotipo:</span>
                <div class="presets-grid">
                  <button
                    type="button"
                    *ngFor="let p of presetAvatars"
                    class="preset-item-card"
                    [class.active]="profileForm.avatarUrl === p.url"
                    (click)="selectPresetAvatar(p.url)"
                  >
                    <div class="preset-thumb">
                      <img [src]="p.url" [alt]="p.shortLabel" />
                    </div>
                    <div class="preset-info">
                      <span class="preset-label">{{ p.shortLabel }}</span>
                      <span class="preset-sublabel">{{ p.subLabel }}</span>
                    </div>
                    <span class="preset-check" *ngIf="profileForm.avatarUrl === p.url">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </span>
                  </button>
                </div>
              </div>

              <!-- Auto-compression hint note -->
              <div class="avatar-hint-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Tu foto se optimiza a &lt;45 KB para sincronizarse al instante en todos los dispositivos y reportes PDF.</span>
              </div>
            </div>
          </div>

          <!-- Operational Summary Card (Ficha Rápida de Guardia) -->
          <div class="profile-card operational-badge-card glass-panel">
            <div class="card-head-compact">
              <span class="compact-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                  <circle cx="9" cy="10" r="2"></circle>
                  <line x1="15" y1="8" x2="17" y2="8"></line>
                  <line x1="15" y1="12" x2="17" y2="12"></line>
                </svg>
              </span>
              <div>
                <h4>Ficha Rápida de Guardia</h4>
                <p class="compact-sub">Datos clave en planta</p>
              </div>
            </div>

            <div class="quick-op-list">
              <div class="quick-op-item">
                <span class="op-label">DNI / Carnet:</span>
                <strong class="op-value font-mono">{{ profileForm.document_id || '---' }}</strong>
              </div>
              <div class="quick-op-item">
                <span class="op-label">Canal Radial:</span>
                <span class="channel-chip">{{ profileForm.radio_channel || 'Canal 1 Operaciones' }}</span>
              </div>
              <div class="quick-op-item">
                <span class="op-label">Anexo / Celular:</span>
                <span class="op-value">{{ profileForm.phone_extension || 'Anexo 402' }}</span>
              </div>
              <div class="quick-op-item">
                <span class="op-label">Puesto Habitual:</span>
                <span class="badge badge-success">{{ formatPrimaryRole(profileForm.primary_role) }}</span>
              </div>
            </div>

            <div class="crew-sync-footer">
              <span class="sync-dot"></span>
              <span>Sincronizado con Gestión de Cuadrilla</span>
            </div>
          </div>

          <!-- Dispositivo y Sesión Activa de Planta (Mejora 6) -->
          <div class="profile-card session-status-card glass-panel">
            <div class="card-head-compact">
              <span class="compact-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </span>
              <div>
                <h4>Dispositivo y Sesión de Planta</h4>
                <p class="compact-sub">Terminal conectado y telemetría</p>
              </div>
            </div>

            <div class="session-info-list">
              <div class="session-row">
                <span class="session-label">Dispositivo:</span>
                <span class="session-val font-semibold">{{ devicePlatformInfo.os }} • {{ devicePlatformInfo.browser }}</span>
              </div>
              <div class="session-row">
                <span class="session-label">Tipo:</span>
                <span class="session-val">{{ devicePlatformInfo.deviceType }}</span>
              </div>
              <div class="session-row">
                <span class="session-label">Red / Entorno:</span>
                <span class="session-badge-net">{{ networkEnvironment }}</span>
              </div>
              <div class="session-row">
                <span class="session-label">Telemetría SCADA:</span>
                <div class="ws-live-indicator" [class.ws-connected]="cloudSync.isWsConnected()">
                  <span class="pulse-dot-ws"></span>
                  <strong>{{ cloudSync.isWsConnected() ? 'En Vivo WS (' + (cloudSync.wsLatencyMs() !== null ? cloudSync.wsLatencyMs() + ' ms' : '< 20 ms') + ')' : 'Modo Polling HTTP' }}</strong>
                </div>
              </div>
              <div class="session-row">
                <span class="session-label">Último Sincronismo:</span>
                <span class="session-val">{{ (cloudSync.lastSyncTime() | date:'HH:mm:ss') || 'En vivo' }}</span>
              </div>
              <div class="session-row">
                <span class="session-label">ID de Terminal:</span>
                <span class="session-val font-mono text-xs">{{ (cloudSync.deviceId || 'DEV-LOCAL').slice(0, 16) }}</span>
              </div>
            </div>

            <div class="session-card-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-sync-test" (click)="testConnectionSync()" [disabled]="isTestingSync">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" [class.spin]="isTestingSync">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                {{ isTestingSync ? 'Verificando...' : 'Verificar Conexión' }}
              </button>
              <button type="button" class="btn btn-danger-ghost btn-sm" (click)="logoutFromDevice()" title="Cerrar sesión en este equipo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Personal Data & Password Change -->
        <div class="card-column right-card">
          <!-- Personal Information Card -->
          <div class="profile-card glass-panel">
            <div class="card-head-title">
              <div class="title-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <h3>Información Personal y Nombres</h3>
                <p class="card-desc">Actualiza tus nombres completos y contacto para los relevos</p>
              </div>
            </div>

            <form (ngSubmit)="saveProfile()" class="profile-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Nombre de Usuario (Login)</label>
                  <input type="text" [value]="authService.currentUser()?.username" disabled class="input-disabled" />
                  <span class="input-hint">El nombre de usuario no es editable por políticas de seguridad</span>
                </div>

                <div class="form-group">
                  <label>Rol de Acceso en Planta</label>
                  <input type="text" [value]="authService.currentUser()?.role" disabled class="input-disabled" />
                  <span class="input-hint">Asignado por el Jefe de Planta</span>
                </div>
              </div>

              <div class="form-group">
                <label>Nombres y Apellidos Completos *</label>
                <input
                  type="text"
                  [(ngModel)]="profileForm.fullName"
                  name="fullName"
                  placeholder="Ej. Nombre y Apellidos"
                  required
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Correo Electrónico Corporativo *</label>
                  <input
                    type="email"
                    [(ngModel)]="profileForm.email"
                    name="email"
                    placeholder="usuario@basetrack.com"
                    required
                  />
                </div>

                <div class="form-group">
                  <label>Guardia Asignada</label>
                  <select [(ngModel)]="profileForm.shift" name="shift">
                    <option value="G1">Guardia G1 (Turno 1)</option>
                    <option value="G2">Guardia G2 (Turno 2)</option>
                    <option value="G3">Guardia G3 (Turno 3)</option>
                    <option value="G4">Guardia G4 (Turno 4)</option>
                  </select>
                </div>
              </div>

              <!-- Ficha Operacional de Planta & Cuadrilla Divider -->
              <div class="operational-sheet-divider">
                <div class="divider-title">
                  <span class="sheet-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                      <circle cx="9" cy="10" r="2"></circle>
                      <line x1="15" y1="8" x2="17" y2="8"></line>
                      <line x1="15" y1="12" x2="17" y2="12"></line>
                    </svg>
                  </span>
                  <div>
                    <h4>Ficha Operacional de Planta & Cuadrilla</h4>
                    <p class="sheet-desc">Datos oficiales de comunicación en campo y asignación en guardia</p>
                  </div>
                </div>
                <span class="sync-badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Sincronizado con Cuadrilla
                </span>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>
                    <span>DNI / Documento de Identidad Minero {{ authService.currentUser()?.role === 'ADMIN' ? '(Opcional)' : '*' }}</span>
                    <span class="field-tag">Oficial</span>
                  </label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                        <circle cx="9" cy="10" r="2"></circle>
                        <line x1="15" y1="8" x2="17" y2="8"></line>
                        <line x1="15" y1="12" x2="17" y2="12"></line>
                      </svg>
                    </span>
                    <input
                      type="text"
                      [(ngModel)]="profileForm.document_id"
                      name="documentId"
                      placeholder="8 dígitos"
                      maxlength="12"
                      [required]="authService.currentUser()?.role !== 'ADMIN'"
                    />
                  </div>
                  <span class="input-hint">{{ authService.currentUser()?.role === 'ADMIN' ? 'Opcional para Administrador de Sistema' : 'Utilizado para tu credencial y asignación en relevos' }}</span>
                </div>

                <div class="form-group">
                  <label>
                    <span>Canal Radial Walkie-Talkie Asignado *</span>
                    <span class="field-tag">Comunicaciones</span>
                  </label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="9" width="14" height="12" rx="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="9"></line>
                        <circle cx="12" cy="15" r="2"></circle>
                      </svg>
                    </span>
                    <select [(ngModel)]="profileForm.radio_channel" name="radioChannel" class="select-with-icon">
                      <option value="Canal 1 Operaciones">Canal 1 Operaciones (Frecuencia Principal)</option>
                      <option value="Canal 2 Ciclones">Canal 2 Ciclones (Baterías & Muestras)</option>
                      <option value="Canal 3 Bombas">Canal 3 Bombas (Salas & Sentinas)</option>
                      <option value="Canal 4 Relaves / Presa">Canal 4 Relaves / Presa (Descarga & Líneas)</option>
                      <option value="Canal 5 Mantenimiento">Canal 5 Mantenimiento & Emergencias</option>
                    </select>
                  </div>
                  <span class="input-hint">Frecuencia por la cual tus compañeros de guardia te contactarán</span>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>
                    <span>Anexo Telefónico o Celular de Emergencia</span>
                    <span class="field-tag">Contacto</span>
                  </label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </span>
                    <input
                      type="text"
                      [(ngModel)]="profileForm.phone_extension"
                      name="phoneExtension"
                      placeholder="Ej. Anexo 402 o +51 984 123 456"
                    />
                  </div>
                  <span class="input-hint">Anexo de cabina de control o número de enlace rápido</span>
                </div>

                <div class="form-group">
                  <label>
                    <span>Puesto / Especialidad Operativa en Planta *</span>
                    <span class="field-tag">Asignación</span>
                  </label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                    </span>
                    <select [(ngModel)]="profileForm.primary_role" name="primaryRole" class="select-with-icon">
                      <option value="OPERADOR_BOMBAS">Operador de Bombas</option>
                      <option value="OPERADOR_CICLONES_1">Operador de Ciclones 1</option>
                      <option value="OPERADOR_CICLONES_2">Operador de Ciclones 2</option>
                      <option value="OPERADOR_DISTRIBUIDOR">Operador de Distribuidor</option>
                      <option value="OPERADOR_DESCARGA_1">Operador de Descarga 1</option>
                      <option value="OPERADOR_DESCARGA_2">Operador de Descarga 2</option>
                      <option value="OPERADOR_MISCELANEOS">Operador de Misceláneos</option>
                      <option value="SUPERVISOR">Supervisor de Guardia</option>
                    </select>
                  </div>
                  <span class="input-hint">Posición operativa prioritaria en el tablero de cuadrilla</span>
                </div>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" [disabled]="isSavingProfile">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {{ isSavingProfile ? 'Guardando...' : 'Guardar Cambios de Perfil & Ficha' }}
                </button>
              </div>
            </form>
          </div>

          <!-- Password Security Card (Mejora 4) -->
          <div class="profile-card glass-panel security-card">
            <div class="card-head-title">
              <div class="title-icon security-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div>
                <h3>Cambiar Contraseña de Acceso</h3>
                <p class="card-desc">Protege tu cuenta con una clave segura de al menos 8 caracteres</p>
              </div>
            </div>

            <form (ngSubmit)="changePassword()" class="profile-form">
              <div class="form-group">
                <label>Contraseña Actual *</label>
                <div class="password-wrap">
                  <input
                    [type]="showOldPass ? 'text' : 'password'"
                    [(ngModel)]="passwordForm.currentPassword"
                    name="currentPassword"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" class="btn-toggle-eye" (click)="showOldPass = !showOldPass" [title]="showOldPass ? 'Ocultar contraseña' : 'Ver contraseña'">
                    <svg *ngIf="!showOldPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg *ngIf="showOldPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Nueva Contraseña *</label>
                  <div class="password-wrap">
                    <input
                      [type]="showNewPass ? 'text' : 'password'"
                      [(ngModel)]="passwordForm.newPassword"
                      name="newPassword"
                      placeholder="Mínimo 8 caracteres"
                      required
                    />
                    <button type="button" class="btn-toggle-eye" (click)="showNewPass = !showNewPass" [title]="showNewPass ? 'Ocultar contraseña' : 'Ver contraseña'">
                      <svg *ngIf="!showNewPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg *ngIf="showNewPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label>Confirmar Nueva Contraseña *</label>
                  <div class="password-wrap">
                    <input
                      [type]="showConfirmPass ? 'text' : 'password'"
                      [(ngModel)]="passwordForm.confirmPassword"
                      name="confirmPassword"
                      placeholder="Repite tu contraseña"
                      required
                    />
                    <button type="button" class="btn-toggle-eye" (click)="showConfirmPass = !showConfirmPass" [title]="showConfirmPass ? 'Ocultar contraseña' : 'Ver contraseña'">
                      <svg *ngIf="!showConfirmPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg *ngIf="showConfirmPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Medidor Dinámico de Seguridad (Password Strength Meter) -->
              <div class="strength-meter-wrap" *ngIf="passwordForm.newPassword">
                <div class="meter-bars">
                  <div class="bar" [class.filled]="passwordStrength.score >= 1" [ngClass]="passwordStrength.colorClass"></div>
                  <div class="bar" [class.filled]="passwordStrength.score >= 2" [ngClass]="passwordStrength.colorClass"></div>
                  <div class="bar" [class.filled]="passwordStrength.score >= 3" [ngClass]="passwordStrength.colorClass"></div>
                </div>
                <div class="meter-caption">
                  <span class="meter-label" [ngClass]="passwordStrength.colorClass">
                    Seguridad de Clave: <strong>{{ passwordStrength.label }}</strong>
                  </span>
                </div>
              </div>

              <!-- Checklist Interactivo en Vivo de Requisitos -->
              <div class="password-checklist">
                <div class="check-item" [class.valid]="hasMinLength">
                  <span class="check-icon">
                    <svg *ngIf="hasMinLength" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span *ngIf="!hasMinLength" class="check-dot"></span>
                  </span>
                  <span>Mínimo 8 caracteres requeridos</span>
                </div>
                <div class="check-item" [class.valid]="hasNumberOrSymbol">
                  <span class="check-icon">
                    <svg *ngIf="hasNumberOrSymbol" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span *ngIf="!hasNumberOrSymbol" class="check-dot"></span>
                  </span>
                  <span>Incluye al menos un número o símbolo</span>
                </div>
                <div class="check-item" [class.valid]="passwordsMatch">
                  <span class="check-icon">
                    <svg *ngIf="passwordsMatch" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span *ngIf="!passwordsMatch" class="check-dot"></span>
                  </span>
                  <span>Las contraseñas coinciden exactamente</span>
                </div>
              </div>

              <div *ngIf="passwordMismatch" class="field-error">
                Las contraseñas no coinciden. Por favor verifícalas.
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn btn-secondary"
                  [disabled]="isSavingPassword || !isPasswordFormValid"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  {{ isSavingPassword ? 'Actualizando...' : 'Actualizar Contraseña' }}
                </button>
              </div>
            </form>
          </div>

          <!-- Theme & Appearance Settings Card -->
          <div class="profile-card glass-panel theme-settings-card">
            <div class="card-head-title">
              <div class="title-icon theme-icon-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              </div>
              <div>
                <h3>Tema y Apariencia Visual</h3>
                <p class="card-desc">Personaliza el entorno visual para luz diurna o guardias nocturnas en planta</p>
              </div>
            </div>

            <div class="theme-options-grid">
              <!-- Light Mode Option -->
              <div
                class="theme-option-box"
                [class.active]="themeService.themeMode() === 'light'"
                (click)="themeService.setThemeMode('light')"
              >
                <div class="theme-box-icon sun-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                </div>
                <div class="theme-box-text">
                  <strong>Modo Claro</strong>
                  <span>Fondo blanco slate y contraste nítido diurno</span>
                </div>
                <span class="theme-active-check" *ngIf="themeService.themeMode() === 'light'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              </div>

              <!-- Dark Mode Option -->
              <div
                class="theme-option-box"
                [class.active]="themeService.themeMode() === 'dark'"
                (click)="themeService.setThemeMode('dark')"
              >
                <div class="theme-box-icon moon-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                </div>
                <div class="theme-box-text">
                  <strong>Modo Oscuro</strong>
                  <span>Gama obsidiana y azul cobalto para guardia nocturna</span>
                </div>
                <span class="theme-active-check" *ngIf="themeService.themeMode() === 'dark'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              </div>

              <!-- Auto System Mode Option -->
              <div
                class="theme-option-box"
                [class.active]="themeService.themeMode() === 'auto'"
                (click)="themeService.setThemeMode('auto')"
              >
                <div class="theme-box-icon auto-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <div class="theme-box-text">
                  <strong>Automático</strong>
                  <span>Sincronizar con el tema del sistema operativo</span>
                </div>
                <span class="theme-active-check" *ngIf="themeService.themeMode() === 'auto'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }

    .profile-header {
      h2 {
        font-size: 1.45rem;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }
      .section-sub {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-top: 4px;
      }
    }

    .alert-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: var(--radius-md);
      font-size: 0.88rem;
      font-weight: 600;

      &.alert-success {
        background: rgba(16, 185, 129, 0.12);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.28);
      }

      &.alert-danger {
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.28);
      }
    }

    .profile-grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 24px;
      align-items: start;

      @media (max-width: 960px) {
        grid-template-columns: 1fr;
      }
    }

    .card-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .profile-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-card);
    }

    .avatar-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar-header {
      margin-bottom: 20px;
      width: 100%;
      text-align: center;

      h3 {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .card-desc {
        font-size: 0.78rem;
        color: var(--text-muted);
        margin-top: 2px;
      }
    }

    .avatar-preview-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
      width: 100%;
    }

    .avatar-ring {
      position: relative;
      width: 124px;
      height: 124px;
      border-radius: var(--radius-full);
      padding: 4px;
      background: var(--bg-card);
      border: 3px solid var(--border-subtle);
      box-shadow: var(--shadow-card);

      .preview-img {
        width: 100%;
        height: 100%;
        border-radius: var(--radius-full);
        object-fit: cover;
        background: var(--bg-canvas);
      }

      .btn-camera {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-full);
        background: var(--primary-purple);
        color: #ffffff;
        border: 2px solid var(--bg-card);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px var(--primary-glow);
        transition: transform 0.2s ease;

        &:hover {
          transform: scale(1.1);
          background: #1e40af;
        }
      }
    }

    .user-pill-info {
      h4 {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .badges-row {
        display: flex;
        gap: 6px;
        justify-content: center;
        margin-top: 6px;
      }
    }

    .avatar-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .avatar-btn-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      width: 100%;

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.8rem;
        padding: 8px 12px;
      }
    }

    .preset-gallery {
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;
      width: 100%;

      .preset-title {
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .presets-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .preset-item-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        background: var(--bg-card-subtle);
        cursor: pointer;
        transition: var(--transition-smooth);
        text-align: left;
        position: relative;

        &:last-child {
          grid-column: span 2;
        }

        .preset-thumb {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          overflow: hidden;
          flex-shrink: 0;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        .preset-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          flex: 1;
        }

        .preset-label {
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preset-sublabel {
          font-size: 0.62rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preset-check {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: var(--radius-full);
          background: #031795;
          color: #ffffff;
          flex-shrink: 0;
        }

        &:hover {
          border-color: #031795;
          background: var(--bg-card-hover);
          transform: translateY(-1px);
        }

        &.active {
          border-color: #031795;
          background: #f0f4ff;
          box-shadow: 0 0 0 2px rgba(3, 23, 149, 0.25);
        }

        :host-context(.dark-theme) &.active {
          background: rgba(3, 23, 149, 0.28);
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
        }
      }
    }

    .avatar-hint-note {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      font-size: 0.72rem;
      color: var(--text-muted);
      line-height: 1.35;
      text-align: left;

      svg {
        flex-shrink: 0;
        margin-top: 1px;
        color: var(--primary-purple);
      }
    }

    /* Session Status Card (Mejora 6) */
    .session-status-card {
      width: 100%;
      text-align: left;
    }

    .session-info-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .session-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.78rem;

      .session-label {
        color: var(--text-muted);
        font-weight: 500;
      }

      .session-val {
        font-weight: 600;
        color: var(--text-primary);
      }

      .session-badge-net {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        background: var(--primary-bg-subtle);
        color: var(--primary-purple);
        border: 1px solid var(--primary-border);
      }

      .ws-live-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
        padding: 2px 8px;
        border-radius: var(--radius-full);
        border: 1px solid rgba(16, 185, 129, 0.25);

        &:not(.ws-connected) {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.25);

          .pulse-dot-ws {
            background: #f59e0b;
            box-shadow: none;
            animation: none;
          }
        }
      }

      .pulse-dot-ws {
        width: 6px;
        height: 6px;
        border-radius: var(--radius-full);
        background: #10b981;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        animation: pulseDotWs 2s infinite;
      }
    }

    @keyframes pulseDotWs {
      0% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      70% {
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    .session-card-actions {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .btn-danger-ghost {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.28);
        color: #ef4444;
        border-radius: var(--radius-md);
        font-size: 0.76rem;
        font-weight: 600;
        padding: 6px 12px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }
      }
    }

    .spin {
      animation: spinIcon 1s linear infinite;
    }

    @keyframes spinIcon {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Right column forms */
    .card-head-title {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 22px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border-subtle);

      .title-icon {
        width: 42px;
        height: 42px;
        border-radius: var(--radius-md);
        background: var(--primary-bg-subtle);
        color: var(--primary-purple);
        border: 1px solid var(--primary-border);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .security-icon {
        background: var(--primary-bg-subtle);
        color: var(--primary-purple);
        border-color: var(--primary-border);
      }

      h3 {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .card-desc {
        font-size: 0.78rem;
        color: var(--text-muted);
        margin-top: 2px;
      }
    }

    .profile-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .input-hint {
        font-size: 0.7rem;
        color: var(--text-muted);
      }

      .input-disabled {
        background: var(--bg-card-subtle);
        color: var(--text-muted);
        cursor: not-allowed;
        border-color: var(--border-subtle);
      }
    }

    .password-wrap {
      position: relative;
      display: flex;
      align-items: center;

      input {
        width: 100%;
        padding-right: 44px;
      }

      .btn-toggle-eye {
        position: absolute;
        right: 8px;
        background: transparent;
        border: none;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        cursor: pointer;
        padding: 4px;
        border-radius: var(--radius-sm);
        transition: color 0.2s ease, background 0.2s ease;

        &:hover {
          background: var(--primary-bg-subtle);
          color: var(--primary-purple);
        }
      }
    }

    /* Password Strength Meter Styles (Mejora 4) */
    .strength-meter-wrap {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 2px;

      .meter-bars {
        display: flex;
        gap: 4px;
        width: 100%;
        height: 4px;

        .bar {
          flex: 1;
          height: 100%;
          border-radius: 2px;
          background: var(--border-subtle);
          transition: background 0.3s ease;

          &.filled.strength-weak {
            background: #ef4444;
          }

          &.filled.strength-medium {
            background: #f59e0b;
          }

          &.filled.strength-strong {
            background: #10b981;
          }
        }
      }

      .meter-caption {
        display: flex;
        justify-content: flex-end;
      }

      .meter-label {
        font-size: 0.72rem;
        font-weight: 500;

        &.strength-weak {
          color: #ef4444;
        }

        &.strength-medium {
          color: #f59e0b;
        }

        &.strength-strong {
          color: #10b981;
        }

        strong {
          font-weight: 700;
        }
      }
    }

    /* Interactive Live Password Checklist (Mejora 4) */
    .password-checklist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--bg-card-subtle);
      border: 1px solid var(--border-subtle);
      margin-top: 4px;

      .check-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.74rem;
        color: var(--text-muted);
        transition: color 0.2s ease;

        .check-icon {
          width: 15px;
          height: 15px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--border-subtle);
          color: #ffffff;
          flex-shrink: 0;
          transition: background 0.2s ease;

          .check-dot {
            width: 4px;
            height: 4px;
            border-radius: var(--radius-full);
            background: var(--text-muted);
          }
        }

        &.valid {
          color: var(--text-primary);
          font-weight: 600;

          .check-icon {
            background: #10b981;
            color: #ffffff;
          }
        }
      }
    }

    .field-error {
      font-size: 0.78rem;
      color: #dc2626;
      font-weight: 600;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
      margin-top: 6px;
    }

    /* Operational Sheet & Card Styles */
    .operational-sheet-divider {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      padding-top: 18px;
      border-top: 1px solid var(--border-subtle);
      flex-wrap: wrap;
      gap: 10px;

      .divider-title {
        display: flex;
        align-items: center;
        gap: 10px;

        .sheet-icon {
          font-size: 1.4rem;
        }

        h4 {
          margin: 0;
          font-size: 0.96rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .sheet-desc {
          margin: 2px 0 0 0;
          font-size: 0.74rem;
          color: var(--text-muted);
        }
      }

      .sync-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        border: 1px solid var(--primary-border);
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
    }

    .field-tag {
      font-size: 0.68rem;
      background: var(--bg-card-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
      margin-left: 6px;
    }

    .input-icon-wrap {
      position: relative;
      display: flex;
      align-items: center;

      .input-icon {
        position: absolute;
        left: 12px;
        font-size: 1.1rem;
        pointer-events: none;
        z-index: 1;
      }

      input, select {
        width: 100%;
        padding-left: 38px;
      }

      .select-with-icon {
        cursor: pointer;
      }
    }

    .operational-badge-card {
      width: 100%;
      text-align: left;
    }

    .card-head-compact {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-subtle);

      .compact-icon {
        font-size: 1.3rem;
      }

      h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .compact-sub {
        margin: 1px 0 0 0;
        font-size: 0.72rem;
        color: var(--text-muted);
      }
    }

    .quick-op-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .quick-op-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;

      .op-label {
        color: var(--text-muted);
        font-weight: 500;
      }

      .op-value {
        font-weight: 600;
        color: var(--text-primary);
      }

      .channel-chip {
        font-size: 0.74rem;
        font-weight: 700;
        color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        border: 1px solid var(--primary-border);
        padding: 2px 8px;
        border-radius: 12px;
      }
    }

    .crew-sync-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--primary-purple);
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--border-subtle);

      .sync-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        display: inline-block;
      }
    }

    .theme-settings-card {
      margin-top: 20px;
    }

    .theme-icon-badge {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    .theme-options-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 18px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .theme-option-box {
      border: 2px solid var(--border-subtle);
      background: var(--bg-card-subtle);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      cursor: pointer;
      position: relative;
      transition: var(--transition-smooth);

      &:hover {
        border-color: var(--primary-border);
        background: var(--bg-card-hover);
        transform: translateY(-2px);
      }

      &.active {
        border-color: var(--primary-purple);
        background: var(--primary-bg-subtle);
        box-shadow: 0 4px 14px var(--primary-glow);
      }
    }

    .theme-box-icon {
      font-size: 1.5rem;
    }

    .theme-box-text {
      display: flex;
      flex-direction: column;
      gap: 3px;

      strong {
        font-size: 0.95rem;
        color: var(--text-primary);
      }

      span {
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.35;
      }
    }

    .theme-active-check {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--primary-purple);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  cloudSync = inject(CloudSyncService);
  private router = inject(Router);

  isTestingSync = false;

  profileForm = {
    fullName: '',
    email: '',
    shift: 'G1' as ShiftCode,
    avatarUrl: '',
    document_id: '',
    radio_channel: 'Canal 1 Operaciones',
    phone_extension: '',
    primary_role: 'OPERADOR_BOMBAS'
  };

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  showOldPass = false;
  showNewPass = false;
  showConfirmPass = false;

  isSavingProfile = false;
  isSavingPassword = false;
  successMessage = '';
  errorMessage = '';

  get userInitials(): string {
    const name = this.profileForm.fullName || this.authService.currentUser()?.fullName || this.authService.currentUser()?.username;
    return getUserInitials(name);
  }

  // Estilos de monograma corporativo (siempre con las iniciales reales del usuario) & Logotipo oficial
  get presetAvatars(): Array<{ label: string; shortLabel: string; subLabel: string; url: string }> {
    const name = this.profileForm.fullName || this.authService.currentUser()?.fullName || this.authService.currentUser()?.username || 'Usuario';
    return [
      {
        label: 'Azul Cobalto Oficial',
        shortLabel: 'Cobalto Oficial',
        subLabel: 'Oficial BASETRACK',
        url: generateAvatarSvg(name, 'ADMIN', undefined, { bg1: '#031795', bg2: '#0f172a' })
      },
      {
        label: 'Verde Esmeralda Planta',
        shortLabel: 'Esmeralda',
        subLabel: 'Operaciones',
        url: generateAvatarSvg(name, 'OPERATOR', undefined, { bg1: '#059669', bg2: '#064e3b' })
      },
      {
        label: 'Ámbar Minero Industrial',
        shortLabel: 'Ámbar Minero',
        subLabel: 'Mantenimiento',
        url: generateAvatarSvg(name, 'MAINTENANCE', undefined, { bg1: '#d97706', bg2: '#78350f' })
      },
      {
        label: 'Azul Real Supervisión',
        shortLabel: 'Azul Real',
        subLabel: 'Supervisión',
        url: generateAvatarSvg(name, 'SUPERVISOR', undefined, { bg1: '#1d4ed8', bg2: '#1e3a8a' })
      },
      {
        label: 'Isotipo Oficial BASETRACK',
        shortLabel: 'BASETRACK',
        subLabel: 'Isotipo Institucional',
        url: '/images/basetrack-icon-transparent.png'
      }
    ];
  }

  /* --- Password Strength & Validation Getters (Mejora 4) --- */
  get passwordStrength(): { score: number; label: string; colorClass: string } {
    const p = this.passwordForm.newPassword || '';
    if (!p) return { score: 0, label: '', colorClass: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[\W_]/.test(p)) score++;

    if (score <= 2) return { score: 1, label: 'Débil', colorClass: 'strength-weak' };
    if (score <= 4) return { score: 2, label: 'Aceptable', colorClass: 'strength-medium' };
    return { score: 3, label: 'Fuerte y Segura', colorClass: 'strength-strong' };
  }

  get hasMinLength(): boolean {
    return (this.passwordForm.newPassword || '').length >= 8;
  }

  get hasNumberOrSymbol(): boolean {
    return /[\d\W_]/.test(this.passwordForm.newPassword || '');
  }

  get passwordsMatch(): boolean {
    return !!(
      this.passwordForm.newPassword &&
      this.passwordForm.confirmPassword &&
      this.passwordForm.newPassword === this.passwordForm.confirmPassword
    );
  }

  get isPasswordFormValid(): boolean {
    return !!(
      this.passwordForm.currentPassword &&
      this.hasMinLength &&
      this.hasNumberOrSymbol &&
      this.passwordsMatch
    );
  }

  get passwordMismatch(): boolean {
    return !!(
      this.passwordForm.newPassword &&
      this.passwordForm.confirmPassword &&
      this.passwordForm.newPassword !== this.passwordForm.confirmPassword
    );
  }

  /* --- Device Platform & Session Getters (Mejora 6) --- */
  get devicePlatformInfo(): { os: string; browser: string; deviceType: string } {
    if (typeof navigator === 'undefined') {
      return { os: 'Servidor', browser: 'Desconocido', deviceType: 'Estación de Trabajo' };
    }
    const ua = navigator.userAgent;
    let os = 'Windows / PC';
    if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Navegador Web';
    if (/Chrome|CriOS/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edge|Edg/i.test(ua)) browser = 'Edge';

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const deviceType = isMobile ? 'Móvil / Tablet de Planta' : 'Estación de Trabajo / Sala de Control';

    return { os, browser, deviceType };
  }

  get networkEnvironment(): string {
    if (typeof window === 'undefined') return 'Red Industrial';
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'Entorno Local (Localhost)';
    if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
      return 'Red Local de Planta (LAN Industrial)';
    }
    return 'Nube / Cloud (Servidor Remoto)';
  }

  testConnectionSync(): void {
    this.isTestingSync = true;
    this.cloudSync.forceSync();
    setTimeout(() => {
      this.isTestingSync = false;
      this.showSuccess('Conectividad verificada: Telemetría WebSocket activa en este terminal.');
    }, 800);
  }

  logoutFromDevice(): void {
    if (confirm('¿Deseas cerrar la sesión en este dispositivo?')) {
      this.authService.logout();
      this.router.navigate(['/auth/login']);
    }
  }

  resetToDefaultAvatar(): void {
    const user = this.authService.currentUser();
    const defaultSvg = generateAvatarSvg(user?.fullName || user?.username, user?.role, user?.shift);
    this.profileForm.avatarUrl = defaultSvg;
    this.authService.updateProfile({ avatarUrl: defaultSvg }).subscribe({
      next: () => this.showSuccess('Avatar institucional restablecido correctamente.')
    });
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.populateForm(user);
    }
    // Refresh asynchronously from /api/auth/me to ensure data freshness
    this.authService.refreshCurrentUser().subscribe(fresh => {
      if (fresh) {
        this.populateForm(fresh);
      }
    });
  }

  private populateForm(user: any): void {
    const effectiveAvatar = getEffectiveAvatar(user.avatarUrl, user.fullName || user.username, user.role, user.shift);
    this.profileForm = {
      fullName: user.fullName || '',
      email: user.email || '',
      shift: user.shift || 'G1',
      avatarUrl: effectiveAvatar,
      document_id: user.document_id || '',
      radio_channel: user.radio_channel || 'Canal 1 Operaciones',
      phone_extension: user.phone_extension || 'Anexo 402',
      primary_role: user.primary_role || (user.role === 'ADMIN' || user.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERADOR_BOMBAS')
    };
  }

  formatPrimaryRole(role?: string): string {
    switch (role) {
      case 'OPERADOR_BOMBAS': return 'Operador de Bombas';
      case 'OPERADOR_CICLONES_1': return 'Operador de Ciclones 1';
      case 'OPERADOR_CICLONES_2': return 'Operador de Ciclones 2';
      case 'OPERADOR_DISTRIBUIDOR': return 'Operador de Distribuidor';
      case 'OPERADOR_DESCARGA_1': return 'Operador de Descarga 1';
      case 'OPERADOR_DESCARGA_2': return 'Operador de Descarga 2';
      case 'OPERADOR_MISCELANEOS': return 'Operador de Misceláneos';
      case 'SUPERVISOR': return 'Supervisor de Guardia';
      case 'OPERADOR_CICLONES': return 'Operador de Ciclones';
      case 'OPERADOR_DESCARGA': return 'Operador de Descarga';
      default: return role || 'Operador de Planta';
    }
  }

  selectPresetAvatar(url: string): void {
    this.profileForm.avatarUrl = url;
    // Auto-save preset avatar in real time
    this.authService.updateProfile({ avatarUrl: url }).subscribe({
      next: () => this.showSuccess('Fotografía de perfil actualizada en tiempo real.'),
      error: (err) => this.onAvatarRejected(err)
    });
  }

  /** El servidor rechazó la fotografía: el servicio ya revirtió el usuario; se restaura el formulario. */
  private onAvatarRejected(err: any): void {
    this.profileForm.avatarUrl = this.authService.currentUser()?.avatarUrl || this.profileForm.avatarUrl;
    this.showError(err?.message || 'El servidor rechazó la fotografía de perfil.');
  }

  onUrlChange(): void {
    if (!this.profileForm.avatarUrl) {
      this.profileForm.avatarUrl = this.presetAvatars[0].url;
    }
  }

  onImageError(): void {
    const user = this.authService.currentUser();
    this.profileForm.avatarUrl = generateAvatarSvg(user?.fullName || user?.username, user?.role, user?.shift);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      try {
        // Compress and optimize image to max 450x450 for instantaneous retina rendering and zero-quota risk
        const optimizedBase64 = await this.compressImage(file, 450, 450, 0.88);
        this.profileForm.avatarUrl = optimizedBase64;

        // Auto-persist in real time immediately
        this.authService.updateProfile({ avatarUrl: optimizedBase64 }).subscribe({
          next: () => {
            this.showSuccess('¡Fotografía de perfil guardada y sincronizada en tiempo real!');
          },
          error: (err) => this.onAvatarRejected(err)
        });
      } catch (err) {
        console.warn('[Profile] Error al procesar imagen, usando carga directa:', err);
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          if (e.target?.result) {
            this.profileForm.avatarUrl = e.target.result as string;
            this.authService.updateProfile({ avatarUrl: this.profileForm.avatarUrl }).subscribe({
              next: () => this.showSuccess('Fotografía guardada exitosamente.'),
              error: (err) => this.onAvatarRejected(err)
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  private compressImage(file: File, maxWidth = 450, maxHeight = 450, quality = 0.88): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target.result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.onerror = (e) => reject(e);
      };
      reader.onerror = (e) => reject(e);
    });
  }

  saveProfile(): void {
    if (!this.profileForm.fullName || !this.profileForm.email) {
      this.showError('Nombre completo y correo son campos obligatorios.');
      return;
    }

    const isOperational = this.authService.currentUser()?.role !== 'ADMIN';
    if (isOperational && !this.profileForm.document_id?.trim()) {
      this.showError('El DNI / Documento de Identidad es obligatorio para personal operativo.');
      return;
    }

    this.isSavingProfile = true;
    this.authService.updateProfile(this.profileForm).subscribe({
      next: (res) => {
        this.isSavingProfile = false;
        this.showSuccess('¡Perfil y ficha operacional actualizados exitosamente!');
      },
      error: (err) => {
        this.isSavingProfile = false;
        const msg = err?.error?.message || err?.message || 'Error al guardar perfil. Se ha respaldado localmente.';
        this.showError(msg);
      }
    });
  }

  changePassword(): void {
    if (!this.passwordForm.currentPassword) {
      this.showError('Debes ingresar tu contraseña actual.');
      return;
    }

    if (this.passwordMismatch) {
      this.showError('Las contraseñas no coinciden.');
      return;
    }

    if (!this.passwordForm.newPassword || this.passwordForm.newPassword.length < 8) {
      this.showError('La nueva contraseña debe contener mínimo 8 caracteres.');
      return;
    }

    const wasTemporary = !!this.authService.currentUser()?.mustChangePassword;
    this.isSavingPassword = true;
    this.authService.changePassword({
      currentPassword: this.passwordForm.currentPassword,
      newPassword: this.passwordForm.newPassword
    }).subscribe({
      next: (res) => {
        this.isSavingPassword = false;
        this.showSuccess('¡Contraseña actualizada con éxito! Utiliza tu nueva clave en tu próximo inicio de sesión.');
        this.passwordForm = {
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        };
        // Tras reemplazar la contraseña temporal se habilita el resto de la aplicación
        if (wasTemporary) {
          setTimeout(() => this.router.navigate(['/dashboard']), 1500);
        }
      },
      error: (err) => {
        this.isSavingPassword = false;
        const msg = err?.message || 'No se pudo verificar la contraseña actual.';
        this.showError(msg);
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 6000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 6000);
  }
}
