import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await firstValueFrom(auth.loadCurrentUser());
  }

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
