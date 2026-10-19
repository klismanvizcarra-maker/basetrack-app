import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PermissionsService, PermissionKey } from './permissions.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const permissionsService = inject(PermissionsService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const token = authService.getToken();
    if (token && authService.isTokenExpired(token)) {
      authService.logout();
      return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url, expired: '1' } });
    }

    // Con contraseña temporal solo se permite el perfil, donde debe cambiarla
    if (authService.currentUser()?.mustChangePassword && !state.url.startsWith('/profile')) {
      return router.createUrlTree(['/profile'], { queryParams: { changePassword: '1' } });
    }

    // Super Admin (Marckv / admin) has unconditional access to all administration routes
    if (authService.isAdmin()) {
      return true;
    }

    const requiredRoles = route.data?.['roles'] as string[] | undefined;
    if (requiredRoles && requiredRoles.length > 0) {
      const userRole = authService.currentUser()?.role;
      if (!userRole || !requiredRoles.includes(userRole)) {
        return router.createUrlTree([userRole === 'MAINTENANCE' ? '/maintenance' : '/dashboard']);
      }
    }

    const requiredPermission = route.data?.['permission'] as PermissionKey | undefined;
    if (requiredPermission && !permissionsService.hasPermission(requiredPermission)) {
      const userRole = authService.currentUser()?.role;
      return router.createUrlTree([userRole === 'MAINTENANCE' ? '/maintenance' : '/dashboard']);
    }

    return true;
  }

  // If not authenticated, return UrlTree to login
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
