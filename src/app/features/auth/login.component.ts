import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card glass-panel animate-fade-in">
        <!-- Logo & Header -->
        <div class="login-brand">
          <div class="brand-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18" />
              <path d="M3 12h18" />
            </svg>
          </div>
          <h2>BASETRACK APP</h2>
          <p class="subtitle">Monitoreo Operacional y Bitácora de Planta</p>
          <div class="security-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Acceso Seguro • Personal Autorizado</span>
          </div>
        </div>

        <!-- Error alert -->
        <div *ngIf="errorMessage" class="error-banner animate-slide-up">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Form -->
        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="username">Usuario o Correo Electrónico</label>
            <div class="input-container">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="username"
                type="text"
                name="username"
                [(ngModel)]="username"
                placeholder="Ej: KlismanV o su DNI"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <div class="input-container">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password"
                [type]="showPassword ? 'text' : 'password'"
                name="password"
                [(ngModel)]="password"
                placeholder="DNI o contraseña asignada"
                autocomplete="current-password"
                required
              />
              <button 
                type="button" 
                class="toggle-pass-btn" 
                (click)="showPassword = !showPassword"
                [title]="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
              >
                <svg *ngIf="!showPassword" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg *ngIf="showPassword" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary submit-btn" [disabled]="loading">
            <span *ngIf="!loading">Ingresar al Sistema</span>
            <span *ngIf="loading" class="spinner-text">
              <span class="btn-spinner"></span>
              Autenticando...
            </span>
          </button>
        </form>

        <div class="login-footer">
          <p class="plant-notice">
            Planta Concentradora • Basetrack 2026<br/>
            Las actividades quedan registradas en la bitácora de auditoría.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #ecfdf5 0%, #0f172a 120%), #020617;
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 38px 32px;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
    }

    .login-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 24px;
    }

    .brand-logo {
      width: 54px;
      height: 54px;
      border-radius: 14px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 8px 20px rgba(5, 150, 105, 0.35);
      margin-bottom: 14px;
    }

    h2 {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.03em;
      margin: 0;
    }

    .subtitle {
      font-size: 0.83rem;
      color: #64748b;
      margin: 5px 0 12px;
    }

    .security-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 500;
      margin-bottom: 20px;
      text-align: left;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;
      }
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;

      .input-icon {
        position: absolute;
        left: 14px;
        color: #94a3b8;
        pointer-events: none;
      }

      input {
        width: 100%;
        padding: 12px 42px 12px 42px;
        font-size: 0.92rem;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        background: #f8fafc;
        color: #0f172a;
        transition: all 0.2s ease;

        &:focus {
          outline: none;
          background: #ffffff;
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
        }

        &::placeholder {
          color: #94a3b8;
          font-size: 0.85rem;
        }
      }

      .toggle-pass-btn {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;

        &:hover {
          color: #0f172a;
        }
      }
    }

    .submit-btn {
      width: 100%;
      padding: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      margin-top: 6px;
      border-radius: 10px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    }

    .spinner-text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-footer {
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #f1f5f9;
      text-align: center;
    }

    .plant-notice {
      font-size: 0.72rem;
      color: #64748b;
      line-height: 1.5;
      margin: 0;
    }

    @media (max-width: 480px) {
      .login-wrapper {
        padding: 16px;
      }

      .login-card {
        padding: 28px 20px;
        border-radius: 16px;
      }

      h2 {
        font-size: 1.3rem;
      }
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);
  router = inject(Router);

  // Credentials start completely blank for security
  username = '';
  password = '';
  showPassword = false;
  loading = false;
  errorMessage = '';

  onSubmit(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Por favor complete todos los campos de acceso';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({ 
      username: this.username.trim(), 
      password: this.password.trim() 
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.message || 'Error al iniciar sesión. Verifique sus credenciales.';
      }
    });
  }
}
