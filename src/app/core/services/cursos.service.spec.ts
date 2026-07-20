import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CursosService } from './cursos.service';
import { API_BASE_URL } from '../api.config';
import {
  CreateCursoDefinicionPayload,
  CreateDesignacionPayload,
  CreateHistorialCursoPayload,
  CreateModuloPayload,
  UpdateCursoPayload,
} from '../models/cursos.models';

describe('CursosService', () => {
  let service: CursosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CursosService],
    });
    service = TestBed.inject(CursosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  // ── findAllDefiniciones ────────────────────────────────────────────────────

  // Helper: the service builds URLs with URLSearchParams embedded in the string,
  // so req.url includes query params and req.params is empty.
  const matchCursos = (r: { url: string }) => r.url.startsWith(`${API_BASE_URL}/cursos?`);

  describe('findAllDefiniciones', () => {
    it('construye la URL base con page y pageSize', () => {
      service.findAllDefiniciones(1, 10).subscribe();
      const req = http.expectOne(matchCursos);
      expect(req.request.url).toContain('page=1');
      expect(req.request.url).toContain('pageSize=10');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('añade query param nombre si se pasa', () => {
      service.findAllDefiniciones(1, 10, 'Angular').subscribe();
      const req = http.expectOne(matchCursos);
      expect(req.request.url).toContain('nombre=Angular');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('añade query param institucion si se pasa', () => {
      service.findAllDefiniciones(1, 10, undefined, 'UCU').subscribe();
      const req = http.expectOne(matchCursos);
      expect(req.request.url).toContain('institucion=UCU');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('añade es_obligatorio=true cuando se pasa true', () => {
      service.findAllDefiniciones(1, 10, undefined, undefined, true).subscribe();
      const req = http.expectOne(matchCursos);
      expect(req.request.url).toContain('es_obligatorio=true');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('mapea la respuesta a CursoDefinicion correctamente', () => {
      const rawItem = { id: '1', nombre_curso: 'X', institucion: 'Y', es_obligatorio: true, modulos_curso: [] };
      let result: any;
      service.findAllDefiniciones().subscribe((r) => (result = r));
      http.expectOne(matchCursos).flush({ items: [rawItem], total: 1, page: 1, pageSize: 10 });
      expect(result.items[0]).toMatchObject({ id: '1', nombre_curso: 'X', institucion: 'Y', es_obligatorio: true });
    });

    it('propaga error HTTP 500', () => {
      let err: any;
      service.findAllDefiniciones().subscribe({ error: (e) => (err = e) });
      http.expectOne(matchCursos).flush('server error', { status: 500, statusText: 'Server Error' });
      expect(err.status).toBe(500);
    });
  });

  // ── createDefinicion ───────────────────────────────────────────────────────

  describe('createDefinicion', () => {
    it('hace POST a /cursos con el payload correcto', () => {
      const payload: CreateCursoDefinicionPayload = { nombre_curso: 'Angular', institucion: 'UCU', es_obligatorio: false };
      service.createDefinicion(payload).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ id: '1', ...payload });
    });

    it('mapea la respuesta correctamente', () => {
      const payload: CreateCursoDefinicionPayload = { nombre_curso: 'X', institucion: 'Y' };
      let result: any;
      service.createDefinicion(payload).subscribe((r) => (result = r));
      http.expectOne(`${API_BASE_URL}/cursos`).flush({ id: 'n1', nombre_curso: 'X', institucion: 'Y', es_obligatorio: false, modulos: [] });
      expect(result.id).toBe('n1');
      expect(result.nombre_curso).toBe('X');
    });

    it('propaga error HTTP 400', () => {
      let err: any;
      service.createDefinicion({ nombre_curso: 'X', institucion: 'Y' }).subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/cursos`).flush({ message: 'nombre duplicado' }, { status: 400, statusText: 'Bad Request' });
      expect(err.status).toBe(400);
    });
  });

  // ── editarCurso ────────────────────────────────────────────────────────────

  describe('editarCurso', () => {
    it('hace PATCH a /cursos/:id con el payload correcto', () => {
      const payload: UpdateCursoPayload = { nombre_curso: 'Nuevo', es_obligatorio: true };
      service.editarCurso('42', payload).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos/42`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(payload);
      req.flush({ id: '42', nombre_curso: 'Nuevo', institucion: 'Y', es_obligatorio: true });
    });

    it('mapea la respuesta a CursoDefinicion', () => {
      let result: any;
      service.editarCurso('42', { nombre_curso: 'Nuevo' }).subscribe((r) => (result = r));
      http.expectOne(`${API_BASE_URL}/cursos/42`).flush({ id: '42', nombre_curso: 'Nuevo', institucion: 'Y', es_obligatorio: true });
      expect(result.nombre_curso).toBe('Nuevo');
    });

    it('propaga error HTTP 404', () => {
      let err: any;
      service.editarCurso('999', {}).subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/cursos/999`).flush(null, { status: 404, statusText: 'Not Found' });
      expect(err.status).toBe(404);
    });
  });

  // ── deleteDefinicion ───────────────────────────────────────────────────────

  describe('deleteDefinicion', () => {
    it('hace DELETE a /cursos/:id', () => {
      service.deleteDefinicion('5').subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos/5`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('propaga error HTTP 400', () => {
      let err: any;
      service.deleteDefinicion('5').subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/cursos/5`).flush({ message: 'tiene inscripciones' }, { status: 400, statusText: 'Bad Request' });
      expect(err.status).toBe(400);
    });
  });

  // ── createModulo ──────────────────────────────────────────────────────────

  describe('createModulo', () => {
    it('hace POST a /cursos/:id/modulos con el payload correcto', () => {
      const payload: CreateModuloPayload = { nombre_modulo: 'Módulo A', orden_modulo: 1, descripcion: 'Desc' };
      service.createModulo('c1', payload).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos/c1/modulos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ id: 'm1', nombre_modulo: 'Módulo A', orden_modulo: 1 });
    });

    it('mapea la respuesta a ModuloCurso (nombre_modulo → nombre)', () => {
      let result: any;
      service.createModulo('c1', { nombre_modulo: 'M', orden_modulo: 1 }).subscribe((r) => (result = r));
      http.expectOne(`${API_BASE_URL}/cursos/c1/modulos`).flush({ id: 'm1', nombre_modulo: 'M', orden_modulo: 1 });
      expect(result.nombre).toBe('M');
      expect(result.orden).toBe(1);
    });

    it('propaga error HTTP 400', () => {
      let err: any;
      service.createModulo('c1', { nombre_modulo: 'M', orden_modulo: 1 }).subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/cursos/c1/modulos`).flush({}, { status: 400, statusText: 'Bad Request' });
      expect(err.status).toBe(400);
    });
  });

  // ── deleteModulo ──────────────────────────────────────────────────────────

  describe('deleteModulo', () => {
    it('hace DELETE a /cursos/:cursoId/modulos/:moduloId', () => {
      service.deleteModulo('c1', 'm1').subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos/c1/modulos/m1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  // ── crearDesignacion ──────────────────────────────────────────────────────

  describe('crearDesignacion', () => {
    it('hace POST a /cursos/:id/designaciones con el payload', () => {
      const payload: CreateDesignacionPayload = { persona_ids: [1, 2], numero_orden: 'N1', fecha_inicio: '2025-01-01', fecha_fin: '2025-12-31' };
      service.crearDesignacion('c1', payload).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos/c1/designaciones`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ personas_designadas: 2 });
    });

    it('propaga error HTTP 400', () => {
      let err: any;
      service.crearDesignacion('c1', { persona_ids: [1] }).subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/cursos/c1/designaciones`).flush({}, { status: 400, statusText: 'Bad Request' });
      expect(err.status).toBe(400);
    });
  });

  // ── registrarCalificacion ─────────────────────────────────────────────────

  describe('registrarCalificacion', () => {
    it('hace PATCH a /cursos/:cursoId/designaciones/:designacionId con la calificacion', () => {
      service.registrarCalificacion('c1', 'd1', 9).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/cursos/c1/designaciones/d1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ calificacion: 9 });
      req.flush({ id: 'x', curso_id: 'c1', persona_id: 'p1', calificacion: 9, estado: 'completado' });
    });

    it('mapea la respuesta correctamente', () => {
      let result: any;
      service.registrarCalificacion('c1', 'd1', 7).subscribe((r) => (result = r));
      http.expectOne(`${API_BASE_URL}/cursos/c1/designaciones/d1`).flush({ id: 'r1', curso_id: 'c1', persona_id: 'p1', calificacion: 7, estado: 'completado' });
      expect(result.calificacion).toBe(7);
    });

    it('propaga error HTTP 400', () => {
      let err: any;
      service.registrarCalificacion('c1', 'd1', 11).subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/cursos/c1/designaciones/d1`).flush({}, { status: 400, statusText: 'Bad Request' });
      expect(err.status).toBe(400);
    });
  });

  // ── createHistorial ───────────────────────────────────────────────────────

  describe('createHistorial', () => {
    const payload: CreateHistorialCursoPayload = {
      personaId: 'p1', nombre: 'Curso X', institucion: 'UCU',
      tipo: 'obligatorio', fechaInicio: '2025-01-01', fechaFin: '2025-06-01', estado: 'completado',
    };

    it('hace POST a /historial-cursos con JSON si no hay documento', () => {
      service.createHistorial(payload).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/historial-cursos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('hace POST con FormData si se pasa documento', () => {
      const file = new File(['content'], 'cert.pdf', { type: 'application/pdf' });
      service.createHistorial(payload, file).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/historial-cursos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      req.flush({});
    });

    it('propaga error HTTP 400', () => {
      let err: any;
      service.createHistorial(payload).subscribe({ error: (e) => (err = e) });
      http.expectOne(`${API_BASE_URL}/historial-cursos`).flush({}, { status: 400, statusText: 'Bad Request' });
      expect(err.status).toBe(400);
    });
  });

  // ── findFuncionariosConCursos ─────────────────────────────────────────────

  const matchFuncionarios = (r: { url: string }) => r.url.startsWith(`${API_BASE_URL}/cursos/funcionarios`);

  describe('findFuncionariosConCursos', () => {
    it('construye la URL con page y pageSize por defecto', () => {
      service.findFuncionariosConCursos().subscribe();
      const req = http.expectOne(matchFuncionarios);
      expect(req.request.url).toContain('page=1');
      expect(req.request.url).toContain('pageSize=100');
      req.flush({ items: [], total: 0 });
    });

    it('añade param cedula si se pasa', () => {
      service.findFuncionariosConCursos('12345').subscribe();
      const req = http.expectOne(matchFuncionarios);
      expect(req.request.url).toContain('cedula=12345');
      req.flush({ items: [], total: 0 });
    });

    it('agrupa filas planas por persona y mapea los cursos', () => {
      let result: any;
      service.findFuncionariosConCursos().subscribe((r) => (result = r));
      const rawItems = [
        {
          id: 'des1',
          persona: { id: 1, primer_nombre: 'Juan', primer_apellido: 'Pérez', cedula: '111' },
          curso: { id: 'c1', nombre_curso: 'Angular', institucion: 'UCU', es_obligatorio: false },
          fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01', calificacion: null,
        },
        {
          id: 'des2',
          persona: { id: 1, primer_nombre: 'Juan', primer_apellido: 'Pérez', cedula: '111' },
          curso: { id: 'c2', nombre_curso: 'React', institucion: 'UCU', es_obligatorio: true },
          fecha_inicio: '2025-02-01', fecha_fin: '2025-07-01', calificacion: 8,
        },
      ];
      http.expectOne(matchFuncionarios).flush({ items: rawItems, total: 2 });
      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe('Juan Pérez');
      expect(result[0].cursos).toHaveLength(2);
    });

    it('mapea es_obligatorio a tipo "obligatorio" / "optativo"', () => {
      let result: any;
      service.findFuncionariosConCursos().subscribe((r) => (result = r));
      const rawItems = [
        {
          id: 'des1',
          persona: { id: 1, primer_nombre: 'Ana', primer_apellido: 'García', cedula: '222' },
          curso: { id: 'c1', nombre_curso: 'X', institucion: 'Y', es_obligatorio: true },
          fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01', calificacion: null,
        },
      ];
      http.expectOne(matchFuncionarios).flush({ items: rawItems, total: 1 });
      expect(result[0].cursos[0].tipo).toBe('obligatorio');
    });
  });
});
