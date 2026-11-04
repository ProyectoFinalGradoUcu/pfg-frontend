import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { parseError } from '../../shared/utils/parse-error';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo un 401 con sesión iniciada es una sesión que el backend dio por terminada (por
      // ejemplo, "Sesión expirada por cambio de permisos"), y el login muestra el motivo para
      // que no parezca una falla. Sin sesión no se redirige: las rutas protegidas ya mandan al
      // login desde authGuard, con returnUrl, y la 404 sin sesión tiene que poder mostrarse.
      // Si fallan varias requests juntas, la primera limpia la sesión y las demás no pisan su
      // navegación (ni su mensaje).
      if (error.status === 401 && !req.url.endsWith('/auth/sign-in') && auth.isAuthenticated()) {
        auth.clearLocalSession();
        router.navigate(['/auth/login'], { queryParams: { mensaje: parseError(error) } });
      }
      return throwError(() => error);
    }),
  );
};
