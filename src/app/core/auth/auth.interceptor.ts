import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { getRealtimeData, removeRealtimeData } from '../storage/local-store.util';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Read token directly from local storage/cache to prevent circular DI with HttpClient
  const token = getRealtimeData<string>('token', '') || 
    (typeof localStorage !== 'undefined' ? localStorage.getItem('basetrack_token') : null);

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  const router = inject(Router);

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 or token expired 403 on protected resource, clear active session smoothly
      const isAuthError = error.status === 401 || 
        (error.status === 403 && (error.error?.message?.includes('Token') || error.error?.message?.includes('expirado')));

      if (isAuthError && !req.url.includes('/api/auth/login')) {
        console.warn('[AuthInterceptor] Sesión no autorizada o token expirado, limpiando sesión y redirigiendo al login...');
        removeRealtimeData('token');
        removeRealtimeData('user');
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('basetrack_token');
          localStorage.removeItem('basetrack_user');
        }
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
