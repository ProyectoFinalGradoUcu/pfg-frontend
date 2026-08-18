import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { API_BASE_URL } from '../api.config';
import { AuthenticatedUser } from '../models/auth.models';

const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: '1',
  username: 'jperez',
  roles: [],
  permisos: [],
  unidades: [],
  ...overrides,
});

/**
 * Cobertura de la resolución de alcance en el cliente (spec 002 §4).
 * La sesión se carga vía `loadCurrentUser` porque los signals de AuthService son privados.
 */
describe('AuthService — alcance por unidad', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const cargarSesion = (user: AuthenticatedUser) => {
    service.loadCurrentUser().subscribe();
    http.expectOne(`${API_BASE_URL}/auth/me`).flush(user);
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  // ── hasAllPermisos ──────────────────────────────────────────────────────────

  describe('hasAllPermisos', () => {
    it('exige todos los permisos, igual que el guard del backend', () => {
      cargarSesion(makeUser({ permisos: ['cursos.ver'] }));

      expect(service.hasAllPermisos(['cursos.ver'])).toBe(true);
      expect(service.hasAllPermisos(['cursos.ver', 'cursos.gestionar'])).toBe(false);
    });

    it('devuelve false si no hay sesión', () => {
      expect(service.hasAllPermisos(['cursos.ver'])).toBe(false);
    });
  });

  // ── hasAnyPermiso ───────────────────────────────────────────────────────────

  describe('hasAnyPermiso', () => {
    it('alcanza con tener uno de los permisos de la lista', () => {
      cargarSesion(makeUser({ permisos: ['cursos.ver'] }));

      expect(service.hasAnyPermiso(['cursos.ver', 'cursos.gestionar'])).toBe(true);
    });
  });

  // ── alcanceDe ───────────────────────────────────────────────────────────────

  describe('alcanceDe', () => {
    it('resuelve global si el usuario tiene el permiso base', () => {
      cargarSesion(makeUser({ permisos: ['personas.ver'] }));

      expect(service.alcanceDe('personas.ver')).toBe('global');
    });

    it('resuelve unidad si solo tiene la variante .unidad', () => {
      cargarSesion(
        makeUser({
          permisos: ['personas.ver.unidad'],
          unidades: [{ id: '7', denominacion: 'Escuela de Formación' }],
        }),
      );

      expect(service.alcanceDe('personas.ver')).toBe('unidad');
    });

    it('el permiso global gana si tiene los dos', () => {
      cargarSesion(
        makeUser({
          permisos: ['personas.ver', 'personas.ver.unidad'],
          unidades: [{ id: '7', denominacion: 'Escuela de Formación' }],
        }),
      );

      expect(service.alcanceDe('personas.ver')).toBe('global');
    });

    it('devuelve null si no tiene ninguna de las dos variantes', () => {
      cargarSesion(makeUser({ permisos: ['cursos.ver'] }));

      expect(service.alcanceDe('personas.ver')).toBeNull();
      expect(service.puedeConAlcance('personas.ver')).toBe(false);
    });
  });

  // ── unidadDeAlcance ─────────────────────────────────────────────────────────

  describe('unidadDeAlcance', () => {
    it('devuelve la unidad si el usuario tiene algún permiso acotado', () => {
      cargarSesion(
        makeUser({
          permisos: ['personas.ver.unidad'],
          unidades: [{ id: '7', denominacion: 'Escuela de Formación' }],
        }),
      );

      expect(service.unidadDeAlcance()).toBe('Escuela de Formación');
    });

    it('devuelve null si todos sus permisos son globales, aunque tenga unidad', () => {
      cargarSesion(
        makeUser({
          permisos: ['personas.ver'],
          unidades: [{ id: '7', denominacion: 'Escuela de Formación' }],
        }),
      );

      // Pertenece a una unidad, pero ve todo: no corresponde mostrar el indicador.
      expect(service.unidadDeAlcance()).toBeNull();
    });

    it('devuelve null si no hay sesión', () => {
      expect(service.unidadDeAlcance()).toBeNull();
    });
  });
});
