import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { conVariantesDeUnidad } from './permission.guard';

// Mismo orden que el menú. Rutas finales: /ascensos-y-retiros redirige a pasibles, que pide ascensos.ver.
export const DESTINOS_INICIO: { ruta: string; permisos: string[] }[] = [
  {
    ruta: '/personal',
    permisos: ['personas.ver', 'personas.crear', 'personas.editar', 'personas.eliminar', 'relaciones_laborales.ver', 'relaciones_laborales.gestionar'],
  },
  { ruta: '/personal/configuracion-derecha', permisos: ['derecha.gestionar'] },
  { ruta: '/ascensos-y-retiros/pasibles', permisos: ['ascensos.ver'] },
  { ruta: '/ascensos-y-retiros/reglas', permisos: ['reglas_ascenso.ver', 'reglas_ascenso.gestionar'] },
  { ruta: '/retiros', permisos: ['retiros.ver', 'retiros.registrar'] },
  { ruta: '/cursos', permisos: ['cursos.ver', 'cursos.gestionar'] },
  { ruta: '/misiones', permisos: ['misiones.ver', 'misiones.gestionar'] },
  { ruta: '/destinos', permisos: ['destinos.ver', 'destinos.gestionar'] },
  { ruta: '/vuelos', permisos: ['vuelos.ver', 'vuelos.gestionar'] },
  { ruta: '/comisiones', permisos: ['comisiones.ver'] },
  { ruta: '/reportes', permisos: ['reportes.ejecutar'] },
  { ruta: '/auditoria', permisos: ['auditoria.ver'] },
  { ruta: '/usuarios-y-roles', permisos: ['usuarios.ver', 'roles.ver', 'unidades.ver'] },
];

// null si no tiene ninguna sección.
export function destinoInicial(auth: AuthService): string | null {
  const destino = DESTINOS_INICIO.find((d) => auth.hasAnyPermiso(conVariantesDeUnidad(d.permisos)));
  return destino?.ruta ?? null;
}

export const inicioGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await firstValueFrom(auth.loadCurrentUser());
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  return router.createUrlTree([destinoInicial(auth) ?? '/sin-acceso']);
};

// Si tiene alguna sección lo manda ahí.
export const sinAccesoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await firstValueFrom(auth.loadCurrentUser());
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  const destino = destinoInicial(auth);
  return destino ? router.createUrlTree([destino]) : true;
};
