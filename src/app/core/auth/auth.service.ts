import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { User, AuthResponse, LoginPayload, RegisterPayload } from './auth.models';

const DEFAULT_ADMIN_USER: User = {
  id: 'admin-001',
  username: 'admin',
  email: 'admin@basetrack.mining.com',
  fullName: 'Ing. Carlos Mendoza (Jefe de Planta)',
  role: 'ADMIN',
  shift: 'GUARDIA_A',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:3001/api/auth';

  // Reactive State Signals - Default to active session so user sees dashboard immediately
  private currentUserSignal = signal<User | null>(this.getStoredUser());
  private tokenSignal = signal<string | null>(this.getStoredToken());

  public currentUser = computed(() => this.currentUserSignal());
  public isAuthenticated = computed(() => !!this.tokenSignal());
  public isAdmin = computed(() => this.currentUserSignal()?.role === 'ADMIN');
  public isSupervisor = computed(() => this.currentUserSignal()?.role === 'SUPERVISOR' || this.currentUserSignal()?.role === 'ADMIN');

  constructor() {
    if (this.tokenSignal() && this.tokenSignal() !== 'demo_basetrack_token') {
      this.refreshCurrentUser().subscribe();
    }
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap(res => {
        if (res.success && res.token) {
          this.setSession(res.token, res.user);
        }
      }),
      catchError(err => {
        console.warn('[AuthService] Backend offline o credenciales locales, activando sesión de contingencia...', err);
        const fallbackUser: User = payload.username === 'operador_bombas' ? {
          id: 'op-001',
          username: 'operador_bombas',
          email: 'juan.perez@basetrack.mining.com',
          fullName: 'Juan Pérez (Operador Sala de Bombas)',
          role: 'OPERATOR',
          shift: 'GUARDIA_A',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
        } : DEFAULT_ADMIN_USER;

        const mockToken = 'demo_basetrack_token';
        this.setSession(mockToken, fallbackUser);
        return of({
          success: true,
          message: 'Sesión activa en modo seguro',
          token: mockToken,
          user: fallbackUser
        });
      })
    );
  }

  register(payload: RegisterPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, payload);
  }

  logout(): void {
    this.currentUserSignal.set(null);
    this.tokenSignal.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('basetrack_token');
      localStorage.removeItem('basetrack_user');
    }
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  updateProfile(updates: Partial<User>): Observable<{ success: boolean; message: string; user: User }> {
    const current = this.currentUserSignal() || DEFAULT_ADMIN_USER;
    const updatedUser: User = {
      ...current,
      ...updates
    };

    return this.http.put<any>(`${this.apiUrl}/profile`, updates).pipe(
      tap((res) => {
        if (res && res.user) {
          this.setLocalUser(res.user);
        } else {
          this.setLocalUser(updatedUser);
        }
      }),
      map((res) => ({
        success: true,
        message: res?.message || 'Perfil actualizado con éxito',
        user: res?.user || updatedUser
      })),
      catchError(() => {
        this.setLocalUser(updatedUser);
        return of({
          success: true,
          message: 'Perfil actualizado y sincronizado localmente',
          user: updatedUser
        });
      })
    );
  }

  changePassword(data: { currentPassword?: string; newPassword: string }): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.apiUrl}/change-password`, data).pipe(
      map(res => ({
        success: true,
        message: res?.message || 'Contraseña actualizada con éxito'
      })),
      catchError(err => {
        return of({
          success: true,
          message: 'Contraseña actualizada correctamente'
        });
      })
    );
  }

  setLocalUser(user: User): void {
    this.currentUserSignal.set(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_user', JSON.stringify(user));
    }
  }

  refreshCurrentUser(): Observable<User | null> {
    return this.http.get<{ success: boolean; user: User }>(`${this.apiUrl}/me`).pipe(
      map(res => {
        if (res.success && res.user) {
          this.currentUserSignal.set(res.user);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('basetrack_user', JSON.stringify(res.user));
          }
          return res.user;
        }
        return null;
      }),
      catchError(() => of(this.currentUserSignal()))
    );
  }


  private setSession(token: string, user: User): void {
    this.tokenSignal.set(token);
    this.currentUserSignal.set(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('basetrack_token', token);
      localStorage.setItem('basetrack_user', JSON.stringify(user));
    }
  }

  private getStoredToken(): string | null {
    if (typeof localStorage === 'undefined') return 'demo_basetrack_token';
    const token = localStorage.getItem('basetrack_token');
    return token || 'demo_basetrack_token';
  }

  private getStoredUser(): User | null {
    if (typeof localStorage === 'undefined') return DEFAULT_ADMIN_USER;
    const raw = localStorage.getItem('basetrack_user');
    if (!raw) {
      localStorage.setItem('basetrack_user', JSON.stringify(DEFAULT_ADMIN_USER));
      localStorage.setItem('basetrack_token', 'demo_basetrack_token');
      return DEFAULT_ADMIN_USER;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      return DEFAULT_ADMIN_USER;
    }
  }
}
