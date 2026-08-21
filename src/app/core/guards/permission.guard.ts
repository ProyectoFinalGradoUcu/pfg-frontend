import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Expande cada permiso pedido a su variante de alcance de unidad.
 *
 * Una ruta declarada con `personas.ver` tiene que dejar entrar también a quien tenga
 * `personas.ver.unidad`: es la misma pantalla, solo que va a ver menos filas. Sin esto, todo
 * usuario con alcance acotado quedaría afuera de las secciones que sí puede usar.
 */
const conVariantesDeUnidad = (permisos: string[]): string[] =>
  permisos.flatMap((p) =>
    p.endsWith('.unidad') ? [p] : [p, `${p}.unidad`],
  );

/**
 * Acceso a una SECCIÓN: alcanza con tener alguno de los permisos (OR).
 *
 * Es intencional que sea OR y no AND. Las rutas de esta app listan todo lo que se puede hacer
 * en la sección (ej. `['personas.ver', 'personas.crear', 'personas.editar', ...]`) y la
 * intención es "puede entrar si puede hacer alguna de estas cosas". Con AND, un usuario de solo
 * lectura perdería el acceso a pantallas que sí puede usar.
 *
 * El `PermissionsGuard` del backend usa AND porque protege un ENDPOINT concreto, donde los
 * permisos listados sí son conjuntivos. Para replicar esa semántica en la UI (habilitar una
 * acción puntual) está `AuthService.hasAllPermisos`.
 */
export const permissionGuard = (permisos: string[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.initialized()) {
      await firstValueFrom(auth.loadCurrentUser());
    }

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    if (auth.hasAnyPermiso(conVariantesDeUnidad(permisos))) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
};

/**
 * Acceso que exige TODOS los permisos (AND), igual que el backend.
 * Usar cuando la ruta cubre una operación que el backend declara con varios permisos a la vez.
 */
export const permissionGuardAll = (permisos: string[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.initialized()) {
      await firstValueFrom(auth.loadCurrentUser());
    }

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    if (auth.hasAllPermisos(permisos)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
};
