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
        </div>

        <!-- Error alert -->
        <div *ngIf="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <!-- Form -->
        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="username">Usuario o Correo Electrónico</label>
            <input
              id="username"
              type="text"
              name="username"
              [(ngModel)]="username"
              placeholder="Ej: admin o supervisor_a"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              name="password"
              [(ngModel)]="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary submit-btn" [disabled]="loading">
            <span *ngIf="!loading">Ingresar al Sistema</span>
            <span *ngIf="loading">Autenticando...</span>
          </button>
        </form>

        <!-- Fast access demo shortcuts -->
        <div class="quick-access">
          <span class="quick-title">Accesos Rápidos Directos:</span>
          <div class="quick-buttons">
            <button type="button" class="quick-btn" (click)="fillCredentials('KlismanV', '71209033')">
              Jefe de Planta (KlismanV)
            </button>
            <button type="button" class="quick-btn" (click)="fillCredentials('operador_bombas', '71209033')">
              Operador de Bombas
            </button>
          </div>
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
      background: radial-gradient(circle at 50% 20%, #ecfdf5 0%, #f8fafc 70%);
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 40px;
      background: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xl);
      box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 0 1px rgba(0, 0, 0, 0.08);
    }

    .login-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 30px;
    }

    .brand-logo {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(5, 150, 105, 0.35);
      margin-bottom: 16px;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: 0.05em;
    }

    .subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .error-banner {
      background: var(--danger-bg);
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: var(--danger);
      padding: 10px 14px;
      border-radius: var(--radius-md);
      font-size: 0.82rem;
      margin-bottom: 20px;
      text-align: center;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;

      label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
    }

    .submit-btn {
      width: 100%;
      padding: 12px;
      font-size: 0.95rem;
      margin-top: 10px;
    }

    .quick-access {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: center;
    }

    .quick-title {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .quick-buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    .quick-btn {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: var(--text-secondary);
      font-size: 0.75rem;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition-smooth);

      &:hover {
        background: #eef2ff;
        color: #4f46e5;
        border-color: #c7d2fe;
      }
    }

    @media (max-width: 480px) {
      .login-wrapper {
        padding: 16px;
      }

      .login-card {
        padding: 26px 18px;
        border-radius: var(--radius-lg);
      }

      .quick-buttons {
        flex-direction: column;
        gap: 8px;

        .quick-btn {
          width: 100%;
          padding: 8px;
        }
      }
    }
  `]
})
export class LoginComponent {
  authService = inject(AuthService);
  router = inject(Router);

  username = 'KlismanV';
  password = '71209033';
  loading = false;
  errorMessage = '';

  fillCredentials(u: string, p: string): void {
    this.username = u;
    this.password = p;
  }

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Por favor complete todos los campos';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Error al iniciar sesión. Verifique sus credenciales.';
      }
    });
  }
}
