import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { UnidadesService } from './unidades.service';
import { API_BASE_URL } from '../api.config';
import { UnidadDetalle, PaginatedUnidadesResponse } from '../models/unidades.models';

const detalle: UnidadDetalle = {
  id: '1',
  codigo: 'CG',
  denominacion: 'Cuartel General',
  vigente: true,
  roles: [
    {
      id: '3',
      nombre: 'Control de cursos',
      descripcion: null,
      permisos: [{ id: '9', nombre: 'cursos.gestionar.unidad' }],
    },
  ],
  cantidadUsuarios: 14,
  cantidadFuncionarios: 14,
};

describe('UnidadesService', () => {
  let service: UnidadesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UnidadesService],
    });
    service = TestBed.inject(UnidadesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('pide el listado sin parámetros cuando no se pasa query', () => {
      let recibido: PaginatedUnidadesResponse | undefined;
      service.findAll().subscribe((res) => (recibido = res));

      const req = http.expectOne((r) => r.url === `${API_BASE_URL}/unidades`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);

      req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
      expect(recibido?.total).toBe(0);
    });

    it('manda paginación y búsqueda como query params', () => {
      service.findAll({ page: 2, pageSize: 20, search: 'Cuartel' }).subscribe();

      const req = http.expectOne((r) => r.url === `${API_BASE_URL}/unidades`);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('20');
      expect(req.request.params.get('search')).toBe('Cuartel');

      req.flush({ items: [], total: 0, page: 2, pageSize: 20 });
    });

    it('manda vigente=false sin descartarlo por ser falsy', () => {
      service.findAll({ vigente: false }).subscribe();

      const req = http.expectOne((r) => r.url === `${API_BASE_URL}/unidades`);
      expect(req.request.params.get('vigente')).toBe('false');

      req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('devuelve la unidad con sus roles y los permisos que aportan', () => {
      let recibido: UnidadDetalle | undefined;
      service.findOne('1').subscribe((res) => (recibido = res));

      const req = http.expectOne(`${API_BASE_URL}/unidades/1`);
      expect(req.request.method).toBe('GET');
      req.flush(detalle);

      expect(recibido?.roles[0].permisos[0].nombre).toBe('cursos.gestionar.unidad');
      expect(recibido?.cantidadUsuarios).toBe(14);
    });

    it('propaga el error si la unidad no existe', () => {
      let status: number | undefined;
      service.findOne('99').subscribe({ error: (e) => (status = e.status) });

      http
        .expectOne(`${API_BASE_URL}/unidades/99`)
        .flush({ message: 'Unidad no encontrada' }, { status: 404, statusText: 'Not Found' });

      expect(status).toBe(404);
    });
  });

  // ── asignarRol ──────────────────────────────────────────────────────────────

  describe('asignarRol', () => {
    it('postea el rolId en el body', () => {
      service.asignarRol('1', '3').subscribe();

      const req = http.expectOne(`${API_BASE_URL}/unidades/1/roles`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rolId: '3' });

      req.flush(detalle);
    });

    it('propaga el 409 si el rol ya estaba asignado', () => {
      let status: number | undefined;
      service.asignarRol('1', '3').subscribe({ error: (e) => (status = e.status) });

      http
        .expectOne(`${API_BASE_URL}/unidades/1/roles`)
        .flush({ message: 'ya asignado' }, { status: 409, statusText: 'Conflict' });

      expect(status).toBe(409);
    });
  });

  // ── quitarRol ───────────────────────────────────────────────────────────────

  describe('quitarRol', () => {
    it('llama al endpoint de baja con el rol en la ruta', () => {
      service.quitarRol('1', '3').subscribe();

      const req = http.expectOne(`${API_BASE_URL}/unidades/1/roles/3`);
      expect(req.request.method).toBe('DELETE');

      req.flush(detalle);
    });
  });
});
