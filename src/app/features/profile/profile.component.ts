import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ShiftCode } from '../../core/auth/auth.models';

@Component({
  selector: 'app-profile',
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
                    {{ authService.currentUser()?.role || 'OPERATOR' }}
                  </span>
                  <span class="badge badge-slate">{{ profileForm.shift }}</span>
                </div>
              </div>
            </div>

            <!-- Upload or URL inputs -->
            <div class="avatar-actions">
              <button type="button" class="btn btn-secondary w-full" (click)="fileInput.click()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Subir Foto desde PC / Móvil
              </button>

              <!-- Quick Plant Avatars Preset Gallery -->
              <div class="preset-gallery">
                <span class="preset-title">Avatares Operacionales Rápidos:</span>
                <div class="presets-row">
                  <button
                    type="button"
                    *ngFor="let p of presetAvatars"
                    class="preset-item"
                    [class.active]="profileForm.avatarUrl === p.url"
                    (click)="selectPresetAvatar(p.url)"
                    [title]="p.label"
                  >
                    <img [src]="p.url" [alt]="p.label" />
                  </button>
                </div>
              </div>

              <!-- Custom URL Input Option -->
              <div class="form-group custom-url-group">
                <label>O ingresar enlace directo a imagen (URL)</label>
                <input
                  type="url"
                  [(ngModel)]="profileForm.avatarUrl"
                  placeholder="https://ejemplo.com/mifoto.jpg"
                  (change)="onUrlChange()"
                />
              </div>
            </div>
          </div>

          <!-- Operational Summary Card (Ficha Rápida de Guardia) -->
          <div class="profile-card operational-badge-card glass-panel">
            <div class="card-head-compact">
              <span class="compact-icon">🪪</span>
              <div>
                <h4>Ficha Rápida de Guardia</h4>
                <p class="compact-sub">Datos clave en planta</p>
              </div>
            </div>

            <div class="quick-op-list">
              <div class="quick-op-item">
                <span class="op-label">DNI / Carnet:</span>
                <strong class="op-value font-mono">{{ profileForm.document_id || '71209033' }}</strong>
              </div>
              <div class="quick-op-item">
                <span class="op-label">Canal Radial:</span>
                <span class="channel-chip">📻 {{ profileForm.radio_channel || 'Canal 1 Operaciones' }}</span>
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
                  placeholder="Ej. VIZCARRA CORI MANLEY KLISMAN"
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
                    placeholder="klismanvizcarra@basetrack.com"
                    required
                  />
                </div>

                <div class="form-group">
                  <label>Guardia Asignada</label>
                  <select [(ngModel)]="profileForm.shift" name="shift">
                    <option value="GUARDIA_A">Guardia A (Turno Principal)</option>
                    <option value="GUARDIA_B">Guardia B (Turno Secundario)</option>
                    <option value="GUARDIA_C">Guardia C (Turno Especial)</option>
                  </select>
                </div>
              </div>

              <!-- Ficha Operacional de Planta & Cuadrilla Divider -->
              <div class="operational-sheet-divider">
                <div class="divider-title">
                  <span class="sheet-icon">🪪</span>
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
                    <span>DNI / Documento de Identidad Minero *</span>
                    <span class="field-tag">Oficial</span>
                  </label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">🪪</span>
                    <input
                      type="text"
                      [(ngModel)]="profileForm.document_id"
                      name="documentId"
                      placeholder="Ej. 71209033"
                      maxlength="12"
                      required
                    />
                  </div>
                  <span class="input-hint">Utilizado para tu credencial y asignación en relevos</span>
                </div>

                <div class="form-group">
                  <label>
                    <span>Canal Radial Walkie-Talkie Asignado *</span>
                    <span class="field-tag">Comunicaciones</span>
                  </label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">📻</span>
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
                    <span class="input-icon">📞</span>
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
                    <span class="input-icon">⚙️</span>
                    <select [(ngModel)]="profileForm.primary_role" name="primaryRole" class="select-with-icon">
                      <option value="OPERADOR_BOMBAS">Operador de Estación de Bombas</option>
                      <option value="OPERADOR_CICLONES">Operador de Baterías de Ciclones</option>
                      <option value="OPERADOR_DESCARGA">Operador de Descarga y Relaves</option>
                      <option value="OPERADOR_MISCELANEOS">Operador de Misceláneos / Reactivos</option>
                      <option value="OPERADOR_RELEVO">Operador de Relevo General</option>
                      <option value="SUPERVISOR">Supervisor de Guardia / Jefe de Turno</option>
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

          <!-- Password Security Card -->
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
                <p class="card-desc">Protege tu cuenta con una clave segura de al menos 6 caracteres</p>
              </div>
            </div>

            <form (ngSubmit)="changePassword()" class="profile-form">
              <div class="form-group">
                <label>Contraseña Actual (Opcional en modo demo)</label>
                <div class="password-wrap">
                  <input
                    [type]="showOldPass ? 'text' : 'password'"
                    [(ngModel)]="passwordForm.currentPassword"
                    name="currentPassword"
                    placeholder="••••••••"
                  />
                  <button type="button" class="btn-toggle-eye" (click)="showOldPass = !showOldPass">
                    {{ showOldPass ? 'Ocultar' : 'Ver' }}
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
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                    <button type="button" class="btn-toggle-eye" (click)="showNewPass = !showNewPass">
                      {{ showNewPass ? 'Ocultar' : 'Ver' }}
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
                    <button type="button" class="btn-toggle-eye" (click)="showConfirmPass = !showConfirmPass">
                      {{ showConfirmPass ? 'Ocultar' : 'Ver' }}
                    </button>
                  </div>
                </div>
              </div>

              <div *ngIf="passwordMismatch" class="field-error">
                Las contraseñas no coinciden. Por favor verifícalas.
              </div>

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn btn-secondary"
                  [disabled]="isSavingPassword || !passwordForm.newPassword || passwordMismatch"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  {{ isSavingPassword ? 'Actualizando...' : 'Actualizar Contraseña' }}
                </button>
              </div>
            </form>
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
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }

      &.alert-danger {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
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
      background: #ffffff;
      border: 3px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);

      .preview-img {
        width: 100%;
        height: 100%;
        border-radius: var(--radius-full);
        object-fit: cover;
        background: #f1f5f9;
      }

      .btn-camera {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-full);
        background: #059669;
        color: #ffffff;
        border: 2px solid #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.4);
        transition: transform 0.2s ease;

        &:hover {
          transform: scale(1.1);
          background: #047857;
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
      gap: 16px;
    }

    .w-full {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .preset-gallery {
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;

      .preset-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .presets-row {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .preset-item {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-full);
        border: 2px solid #e2e8f0;
        background: #f8fafc;
        padding: 2px;
        cursor: pointer;
        transition: var(--transition-smooth);

        img {
          width: 100%;
          height: 100%;
          border-radius: var(--radius-full);
          object-fit: cover;
        }

        &:hover {
          border-color: #059669;
          transform: translateY(-2px);
        }

        &.active {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.25);
        }
      }
    }

    .custom-url-group {
      text-align: left;
      margin-top: 4px;

      label {
        font-size: 0.72rem;
        color: var(--text-muted);
      }

      input {
        font-size: 0.78rem;
        padding: 7px 10px;
      }
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
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .security-icon {
        background: #f0fdf4;
        color: #059669;
        border-color: #a7f3d0;
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
        background: #f1f5f9;
        color: var(--text-muted);
        cursor: not-allowed;
        border-color: #e2e8f0;
      }
    }

    .password-wrap {
      position: relative;
      display: flex;
      align-items: center;

      input {
        width: 100%;
        padding-right: 64px;
      }

      .btn-toggle-eye {
        position: absolute;
        right: 8px;
        background: transparent;
        border: none;
        color: #059669;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: var(--radius-sm);

        &:hover {
          background: #ecfdf5;
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
        color: #047857;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
    }

    .field-tag {
      font-size: 0.68rem;
      background: #f1f5f9;
      color: #475569;
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
        color: #047857;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
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
      color: #059669;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;

      .sync-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        display: inline-block;
      }
    }
  `]
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);

  profileForm = {
    fullName: '',
    email: '',
    shift: 'GUARDIA_A' as ShiftCode,
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

  // Preset avatar photos for plant operators / engineers
  presetAvatars = [
    {
      label: 'Ingeniero Jefe de Operaciones',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
    },
    {
      label: 'Supervisor de Guardia',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
    },
    {
      label: 'Operador de Planta Concentradora',
      url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
    },
    {
      label: 'Supervisora Metalúrgica',
      url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'
    },
    {
      label: 'Especialista de Mantenimiento',
      url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80'
    }
  ];

  get passwordMismatch(): boolean {
    return !!(
      this.passwordForm.newPassword &&
      this.passwordForm.confirmPassword &&
      this.passwordForm.newPassword !== this.passwordForm.confirmPassword
    );
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.profileForm = {
        fullName: user.fullName || '',
        email: user.email || '',
        shift: user.shift || 'GUARDIA_A',
        avatarUrl: user.avatarUrl || this.presetAvatars[0].url,
        document_id: user.document_id || '71209033',
        radio_channel: user.radio_channel || 'Canal 1 Operaciones',
        phone_extension: user.phone_extension || 'Anexo 402',
        primary_role: user.primary_role || (user.role === 'ADMIN' || user.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'OPERADOR_BOMBAS')
      };
    }
  }

  formatPrimaryRole(role?: string): string {
    switch (role) {
      case 'OPERADOR_BOMBAS': return 'Op. Estación de Bombas';
      case 'OPERADOR_CICLONES': return 'Op. Baterías Ciclones';
      case 'OPERADOR_DESCARGA': return 'Op. Descarga y Relaves';
      case 'OPERADOR_MISCELANEOS': return 'Op. Misceláneos / Reactivos';
      case 'OPERADOR_RELEVO': return 'Op. Relevo General';
      case 'SUPERVISOR': return 'Supervisor de Guardia';
      default: return role || 'Operador de Planta';
    }
  }

  selectPresetAvatar(url: string): void {
    this.profileForm.avatarUrl = url;
    // Auto-save preset avatar in real time
    this.authService.updateProfile({ avatarUrl: url }).subscribe({
      next: () => this.showSuccess('Fotografía de perfil actualizada en tiempo real.')
    });
  }

  onUrlChange(): void {
    if (!this.profileForm.avatarUrl) {
      this.profileForm.avatarUrl = this.presetAvatars[0].url;
    }
  }

  onImageError(): void {
    this.profileForm.avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${this.authService.currentUser()?.username || 'user'}`;
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
          error: () => {
            this.showSuccess('Fotografía guardada localmente con éxito.');
          }
        });
      } catch (err) {
        console.warn('[Profile] Error al procesar imagen, usando carga directa:', err);
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          if (e.target?.result) {
            this.profileForm.avatarUrl = e.target.result as string;
            this.authService.updateProfile({ avatarUrl: this.profileForm.avatarUrl }).subscribe();
            this.showSuccess('Fotografía guardada exitosamente.');
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

    this.isSavingProfile = true;
    this.authService.updateProfile(this.profileForm).subscribe({
      next: (res) => {
        this.isSavingProfile = false;
        this.showSuccess('¡Perfil y datos personales actualizados exitosamente!');
      },
      error: (err) => {
        this.isSavingProfile = false;
        this.showError('Error al guardar perfil. Se ha respaldado localmente.');
      }
    });
  }

  changePassword(): void {
    if (this.passwordMismatch) {
      this.showError('Las contraseñas no coinciden.');
      return;
    }

    if (!this.passwordForm.newPassword || this.passwordForm.newPassword.length < 6) {
      this.showError('La nueva contraseña debe contener mínimo 6 caracteres.');
      return;
    }

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
      },
      error: () => {
        this.isSavingPassword = false;
        this.showError('No se pudo verificar la contraseña actual.');
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
