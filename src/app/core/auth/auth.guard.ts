import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const requiredRoles = route.data?.['roles'] as string[] | undefined;
    if (requiredRoles && requiredRoles.length > 0) {
      const userRole = authService.currentUser()?.role;
      if (!userRole || !requiredRoles.includes(userRole)) {
        return router.createUrlTree(['/dashboard']);
      }
    }
    return true;
  }

  // If not authenticated, return UrlTree to login
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
