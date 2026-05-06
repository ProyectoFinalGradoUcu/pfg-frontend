import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const permissionGuard = (permisos: string[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.initialized()) {
      await firstValueFrom(auth.loadCurrentUser());
    }

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (auth.hasAnyPermiso(permisos)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
};
