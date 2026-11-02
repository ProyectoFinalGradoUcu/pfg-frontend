import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await firstValueFrom(auth.loadCurrentUser());
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Como authGuard, pero sin redirigir: si no hay sesión la ruta no matchea y el
 * router sigue buscando. Lo usa la 404 para mostrarse dentro del layout solo con
 * sesión; sin sesión cae en la 404 suelta en lugar de mandar al login.
 */
export const sesionActivaMatch: CanMatchFn = async () => {
  const auth = inject(AuthService);

  if (!auth.initialized()) {
    await firstValueFrom(auth.loadCurrentUser());
  }

  return auth.isAuthenticated();
};
