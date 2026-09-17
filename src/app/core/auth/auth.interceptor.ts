import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 from protected resource (not login attempt itself), clear session
      if (error.status === 401 && !req.url.includes('/api/auth/login')) {
        console.warn('[AuthInterceptor] Sesión no autorizada o expirada (401), redirigiendo al login...');
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
