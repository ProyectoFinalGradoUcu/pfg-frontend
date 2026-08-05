import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { MisionesService, misionesServiceConfig } from './misiones.service';
import { PersonalService } from './personal.service';
import { API_BASE_URL } from '../api.config';
import {
  CreateConvocatoriaPayload,
  CreateMisionDefinicionPayload,
  FuncionarioConvocatoriaPayload,
} from '../models/misiones.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Suscribe a un observable "mock" (usa delay() internamente) con fake timers,
 *  avanza el reloj virtual y devuelve el valor emitido o el error capturado. */
function runMock<T>(obs$: Observable<T>): { value?: T; error?: any } {
  vi.useFakeTimers();
  const result: { value?: T; error?: any } = {};
  obs$.subscribe({ next: (v) => (result.value = v), error: (e) => (result.error = e) });
  vi.advanceTimersByTime(2000);
  vi.useRealTimers();
  return result;
}

describe('MisionesService', () => {
  let service: MisionesService;
  let http: HttpTestingController;
  let personalService: { findAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    misionesServiceConfig.useMockData = false;
    personalService = { findAll: vi.fn().mockReturnValue(of([])) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MisionesService, { provide: PersonalService, useValue: personalService }],
    });
    service = TestBed.inject(MisionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    misionesServiceConfig.useMockData = false;
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO HTTP REAL (useMockData = false) — el código que corre en producción
  // ═══════════════════════════════════════════════════════════════════════════

  describe('con backend real (useMockData = false)', () => {
    const matchMisiones = (r: { url: string }) => r.url.startsWith(`${API_BASE_URL}/misiones?`);

    describe('findAllDefiniciones', () => {
      it('construye la URL con page y pageSize', () => {
        service.findAllDefiniciones(2, 15).subscribe();
        const req = http.expectOne(matchMisiones);
        expect(req.request.method).toBe('GET');
        expect(req.request.url).toContain('page=2');
        expect(req.request.url).toContain('pageSize=15');
        req.flush({ items: [], total: 0, page: 2, pageSize: 15, stats: { total_misiones: 0, convocatorias_activas: 0, personal_desplegado: 0 } });
      });

      it('añade query param nombre si se pasa', () => {
        service.findAllDefiniciones(1, 10, 'Congo').subscribe();
        const req = http.expectOne(matchMisiones);
        expect(req.request.url).toContain('nombre=Congo');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10, stats: { total_misiones: 0, convocatorias_activas: 0, personal_desplegado: 0 } });
      });

      it('añade query param pais si se pasa', () => {
        service.findAllDefiniciones(1, 10, undefined, 'Chipre').subscribe();
        const req = http.expectOne(matchMisiones);
        expect(req.request.url).toContain('pais=Chipre');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10, stats: { total_misiones: 0, convocatorias_activas: 0, personal_desplegado: 0 } });
      });

      it('devuelve items y stats tal cual los manda el backend', () => {
        let result: any;
        service.findAllDefiniciones().subscribe((r) => (result = r));
        http.expectOne(matchMisiones).flush({
          items: [{ id: '1', nombre_mision: 'Congo', pais: 'RD Congo', total_convocatorias: 3 }],
          total: 1,
          page: 1,
          pageSize: 10,
          stats: { total_misiones: 1, convocatorias_activas: 2, personal_desplegado: 14 },
        });
        expect(result.items).toHaveLength(1);
        expect(result.stats.personal_desplegado).toBe(14);
      });

      it('propaga error HTTP 500', () => {
        let err: any;
        service.findAllDefiniciones().subscribe({ error: (e) => (err = e) });
        http.expectOne(matchMisiones).flush('server error', { status: 500, statusText: 'Server Error' });
        expect(err.status).toBe(500);
      });
    });

    describe('findMisionesOpciones', () => {
      it('pide GET /misiones?page=1&pageSize=200', () => {
        service.findMisionesOpciones().subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones?page=1&pageSize=200`);
        expect(req.request.method).toBe('GET');
        req.flush({ items: [], total: 0, page: 1, pageSize: 200, stats: { total_misiones: 0, convocatorias_activas: 0, personal_desplegado: 0 } });
      });

      it('mapea items a {id, nombre_mision}, descartando el resto', () => {
        let result: any;
        service.findMisionesOpciones().subscribe((r) => (result = r));
        http.expectOne(`${API_BASE_URL}/misiones?page=1&pageSize=200`).flush({
          items: [{ id: '1', nombre_mision: 'Congo', pais: 'RD Congo', total_convocatorias: 3 }],
          total: 1,
          page: 1,
          pageSize: 200,
          stats: { total_misiones: 1, convocatorias_activas: 0, personal_desplegado: 0 },
        });
        expect(result).toEqual([{ id: '1', nombre_mision: 'Congo' }]);
      });
    });

    describe('findDefinicionById', () => {
      it('hace GET a /misiones/:id', () => {
        service.findDefinicionById('7').subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/7`);
        expect(req.request.method).toBe('GET');
        req.flush({ id: '7', nombre_mision: 'X', pais: 'Y', total_convocatorias: 0 });
      });

      it('propaga error HTTP 404', () => {
        let err: any;
        service.findDefinicionById('999').subscribe({ error: (e) => (err = e) });
        http.expectOne(`${API_BASE_URL}/misiones/999`).flush(null, { status: 404, statusText: 'Not Found' });
        expect(err.status).toBe(404);
      });
    });

    describe('createDefinicion', () => {
      it('hace POST a /misiones envolviendo el payload en service_request', () => {
        const payload: CreateMisionDefinicionPayload = { nombre_mision: 'Haití', pais: 'Haití' };
        service.createDefinicion(payload).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ service_request: payload });
        req.flush({ id: '9', ...payload, total_convocatorias: 0 });
      });

      it('propaga error HTTP 409 (nombre duplicado)', () => {
        let err: any;
        service.createDefinicion({ nombre_mision: 'X', pais: 'Y' }).subscribe({ error: (e) => (err = e) });
        http.expectOne(`${API_BASE_URL}/misiones`).flush({ message: 'Ya existe' }, { status: 409, statusText: 'Conflict' });
        expect(err.status).toBe(409);
      });
    });

    describe('editarDefinicion', () => {
      it('hace PATCH a /misiones/:id envolviendo el payload', () => {
        service.editarDefinicion('3', { pais: 'Nuevo país' }).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/3`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ service_request: { pais: 'Nuevo país' } });
        req.flush({ id: '3', nombre_mision: 'X', pais: 'Nuevo país', total_convocatorias: 0 });
      });
    });

    describe('deleteDefinicion', () => {
      it('hace DELETE a /misiones/:id', () => {
        service.deleteDefinicion('4').subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/4`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
      });
    });

    describe('findConvocatorias', () => {
      const matchConv = (r: { url: string }) => r.url.startsWith(`${API_BASE_URL}/misiones/1/convocatorias?`);

      it('construye la URL base con page y pageSize', () => {
        service.findConvocatorias('1', 1, 10).subscribe();
        const req = http.expectOne(matchConv);
        expect(req.request.url).toContain('page=1');
        expect(req.request.url).toContain('pageSize=10');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
      });

      it('añade query param query si se pasa', () => {
        service.findConvocatorias('1', 1, 10, 'ORD-1').subscribe();
        const req = http.expectOne(matchConv);
        expect(req.request.url).toContain('query=ORD-1');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
      });

      it('añade finalizada=true cuando se pasa true', () => {
        service.findConvocatorias('1', 1, 10, undefined, true).subscribe();
        const req = http.expectOne(matchConv);
        expect(req.request.url).toContain('finalizada=true');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
      });

      it('añade finalizada=false cuando se pasa false explícitamente', () => {
        service.findConvocatorias('1', 1, 10, undefined, false).subscribe();
        const req = http.expectOne(matchConv);
        expect(req.request.url).toContain('finalizada=false');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
      });

      it('no añade finalizada si no se pasa', () => {
        service.findConvocatorias('1', 1, 10).subscribe();
        const req = http.expectOne(matchConv);
        expect(req.request.url).not.toContain('finalizada');
        req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
      });
    });

    describe('findConvocatoriaById', () => {
      it('hace GET a /misiones/:misionId/convocatorias/:convocatoriaId', () => {
        service.findConvocatoriaById('1', '5').subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5`);
        expect(req.request.method).toBe('GET');
        req.flush({ id: '5', mision_id: '1', numero_orden: 'O', boletin: null, fecha_salida: null, fecha_llegada: null, observaciones: null, total_funcionarios: 0, finalizada: false });
      });
    });

    describe('crearConvocatoria', () => {
      it('hace POST envolviendo el payload completo (incl. persona_ids) en service_request', () => {
        const payload: CreateConvocatoriaPayload = {
          numero_orden: 'ORD-1',
          fecha_salida: '2026-01-01',
          fecha_llegada: null as any,
          observaciones: 'obs',
          persona_ids: [42, 87],
        };
        service.crearConvocatoria('1', payload).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ service_request: payload });
        req.flush({ id: '5', mision_id: '1', ...payload, total_funcionarios: 2, finalizada: false });
      });

      it('propaga error HTTP 400 (sin orden ni boletín)', () => {
        let err: any;
        service.crearConvocatoria('1', {}).subscribe({ error: (e) => (err = e) });
        http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias`).flush({ message: 'requerido' }, { status: 400, statusText: 'Bad Request' });
        expect(err.status).toBe(400);
      });
    });

    describe('editarConvocatoria', () => {
      it('hace PATCH a /misiones/:misionId/convocatorias/:convocatoriaId', () => {
        service.editarConvocatoria('1', '5', { boletin: 'BOL-9' }).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ service_request: { boletin: 'BOL-9' } });
        req.flush({ id: '5', mision_id: '1', numero_orden: null, boletin: 'BOL-9', fecha_salida: null, fecha_llegada: null, observaciones: null, total_funcionarios: 0, finalizada: false });
      });
    });

    describe('eliminarConvocatoria', () => {
      it('hace DELETE a /misiones/:misionId/convocatorias/:convocatoriaId', () => {
        service.eliminarConvocatoria('1', '5').subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
      });
    });

    describe('findFuncionariosByConvocatoria', () => {
      const matchFunc = (r: { url: string }) => r.url.startsWith(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios?`);

      it('construye la URL con page y pageSize (limit)', () => {
        service.findFuncionariosByConvocatoria('1', '5', 2, 20).subscribe();
        const req = http.expectOne(matchFunc);
        expect(req.request.url).toContain('page=2');
        expect(req.request.url).toContain('pageSize=20');
        req.flush({ items: [], total: 0, page: 2, pageSize: 20 });
      });

      it('añade query param query si se pasa', () => {
        service.findFuncionariosByConvocatoria('1', '5', 1, 5, 'García').subscribe();
        const req = http.expectOne(matchFunc);
        expect(req.request.url).toContain('query=Garc');
        req.flush({ items: [], total: 0, page: 1, pageSize: 5 });
      });
    });

    describe('addFuncionarios', () => {
      it('hace POST envolviendo { funcionarios } en service_request', () => {
        const payload: FuncionarioConvocatoriaPayload[] = [{ persona_id: '42', boletin: 'BOL-1' }];
        service.addFuncionarios('1', '5', payload).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ service_request: { funcionarios: [{ persona_id: 42, boletin: 'BOL-1' }] } });
        req.flush(null);
      });

      it('convierte persona_id de string a number (el backend exige integer)', () => {
        service.addFuncionarios('1', '5', [{ persona_id: '123' }, { persona_id: '456', boletin: 'B' }]).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios`);
        const enviados = req.request.body.service_request.funcionarios;
        expect(enviados[0].persona_id).toBe(123);
        expect(typeof enviados[0].persona_id).toBe('number');
        expect(enviados[1].persona_id).toBe(456);
        req.flush(null);
      });

      it('propaga error HTTP 409 (persona ya asignada)', () => {
        let err: any;
        service.addFuncionarios('1', '5', [{ persona_id: '1' }]).subscribe({ error: (e) => (err = e) });
        http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios`).flush({}, { status: 409, statusText: 'Conflict' });
        expect(err.status).toBe(409);
      });
    });

    describe('updateFuncionario', () => {
      it('hace PATCH a /misiones/:misionId/convocatorias/:convocatoriaId/funcionarios/:personaId', () => {
        service.updateFuncionario('1', '5', '42', { boletin: 'BOL-2' }).subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios/42`);
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ service_request: { boletin: 'BOL-2' } });
        req.flush(null);
      });
    });

    describe('deleteFuncionario', () => {
      it('hace DELETE a .../funcionarios/:personaId', () => {
        service.deleteFuncionario('1', '5', '42').subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios/42`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
      });
    });

    describe('deleteAllFuncionarios', () => {
      it('hace DELETE a .../funcionarios (sin personaId)', () => {
        service.deleteAllFuncionarios('1', '5').subscribe();
        const req = http.expectOne(`${API_BASE_URL}/misiones/1/convocatorias/5/funcionarios`);
        expect(req.request.method).toBe('DELETE');
        req.flush(null);
      });
    });

    describe('findFuncionariosConMisiones', () => {
      const matchAll = (r: { url: string }) => r.url.startsWith(`${API_BASE_URL}/misiones/funcionarios?`);

      it('construye la URL con page=1 y pageSize=200 por defecto', () => {
        service.findFuncionariosConMisiones().subscribe();
        const req = http.expectOne(matchAll);
        expect(req.request.url).toContain('page=1');
        expect(req.request.url).toContain('pageSize=200');
        req.flush({ items: [], total: 0 });
      });

      it('agrupa filas planas por persona', () => {
        let result: any;
        service.findFuncionariosConMisiones().subscribe((r) => (result = r));
        const rawItems = [
          {
            id: '12',
            persona: { id: '42', cedula: '111', primer_nombre: 'Juan', primer_apellido: 'García' },
            mision: { id: '1', nombre_mision: 'Congo', pais: 'RD Congo' },
            convocatoria_id: '5',
            numero_orden: 'ORD-1', boletin: null, fecha_salida: '2026-01-01', fecha_llegada: null, finalizada: false,
          },
          {
            id: '13',
            persona: { id: '42', cedula: '111', primer_nombre: 'Juan', primer_apellido: 'García' },
            mision: { id: '2', nombre_mision: 'Chipre', pais: 'Chipre' },
            convocatoria_id: '9',
            numero_orden: null, boletin: 'BOL-9', fecha_salida: '2025-01-01', fecha_llegada: '2025-06-01', finalizada: true,
          },
        ];
        http.expectOne(matchAll).flush({ items: rawItems, total: 2 });
        expect(result).toHaveLength(1);
        expect(result[0].nombre).toBe('Juan García');
        expect(result[0].misiones).toHaveLength(2);
      });

      it('usa convocatoria_id (no id) como convocatoriaId — el id de la fila es la asignación, no la convocatoria', () => {
        let result: any;
        service.findFuncionariosConMisiones().subscribe((r) => (result = r));
        const rawItems = [
          {
            id: '999', // id de la fila de asignación — NO debe usarse como convocatoriaId
            persona: { id: '1', cedula: '1', primer_nombre: 'A', primer_apellido: 'B' },
            mision: { id: '1', nombre_mision: 'Congo', pais: 'RD Congo' },
            convocatoria_id: '5', // este es el que debe quedar en convocatoriaId
            numero_orden: 'ORD-1', boletin: null, fecha_salida: null, fecha_llegada: null, finalizada: false,
          },
        ];
        http.expectOne(matchAll).flush({ items: rawItems, total: 1 });
        expect(result[0].misiones[0].convocatoriaId).toBe('5');
      });

      it('si no viene convocatoria_id, usa id como fallback', () => {
        let result: any;
        service.findFuncionariosConMisiones().subscribe((r) => (result = r));
        const rawItems = [
          {
            id: '77',
            persona: { id: '1', cedula: '1', primer_nombre: 'A', primer_apellido: 'B' },
            mision: { id: '1', nombre_mision: 'Congo', pais: 'RD Congo' },
            numero_orden: null, boletin: null, fecha_salida: null, fecha_llegada: null, finalizada: false,
          },
        ];
        http.expectOne(matchAll).flush({ items: rawItems, total: 1 });
        expect(result[0].misiones[0].convocatoriaId).toBe('77');
      });

      it('descarta filas sin persona.id', () => {
        let result: any;
        service.findFuncionariosConMisiones().subscribe((r) => (result = r));
        const rawItems = [
          { id: '1', persona: {}, mision: { id: '1', nombre_mision: 'X', pais: 'Y' }, convocatoria_id: '5' },
        ];
        http.expectOne(matchAll).flush({ items: rawItems, total: 1 });
        expect(result).toHaveLength(0);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO MOCK (useMockData = true) — lógica hardcodeada en memoria
  // ═══════════════════════════════════════════════════════════════════════════

  describe('en modo mock (useMockData = true)', () => {
    beforeEach(() => {
      misionesServiceConfig.useMockData = true;
    });

    describe('findAllDefiniciones', () => {
      it('devuelve las 3 misiones semilla con sus stats', () => {
        const { value } = runMock(service.findAllDefiniciones());
        expect(value!.items).toHaveLength(3);
        expect(value!.stats.total_misiones).toBe(3);
      });

      it('filtra por nombre (case-insensitive, parcial)', () => {
        const { value } = runMock(service.findAllDefiniciones(1, 10, 'congo'));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].nombre_mision).toContain('Congo');
      });

      it('filtra por país (case-insensitive, parcial)', () => {
        const { value } = runMock(service.findAllDefiniciones(1, 10, undefined, 'chipre'));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].pais).toBe('Chipre');
      });

      it('pagina correctamente', () => {
        const { value } = runMock(service.findAllDefiniciones(2, 2));
        expect(value!.items).toHaveLength(1);
        expect(value!.total).toBe(3);
      });

      it('convocatorias_activas cuenta solo las no finalizadas (2 de 3 en la semilla)', () => {
        const { value } = runMock(service.findAllDefiniciones());
        expect(value!.stats.convocatorias_activas).toBe(2);
      });

      it('personal_desplegado cuenta personas únicas en convocatorias activas', () => {
        const { value } = runMock(service.findAllDefiniciones());
        // convocatoria 101 (activa): persona_id 1001, 1002. convocatoria 201 (activa): 1001.
        // 102 está finalizada y no debe contarse aunque tenga a 1003.
        expect(value!.stats.personal_desplegado).toBe(2);
      });

      it('total_convocatorias de cada misión refleja las convocatorias asociadas', () => {
        const { value } = runMock(service.findAllDefiniciones());
        const congo = value!.items.find((m) => m.id === '1')!;
        expect(congo.total_convocatorias).toBe(2);
      });
    });

    describe('findMisionesOpciones', () => {
      it('devuelve {id, nombre_mision} de las 3 misiones semilla', () => {
        const { value } = runMock(service.findMisionesOpciones());
        expect(value).toHaveLength(3);
        expect(value![0]).toEqual({ id: '1', nombre_mision: 'Congo (MONUSCO)' });
      });
    });

    describe('findDefinicionById', () => {
      it('devuelve la misión si existe', () => {
        const { value } = runMock(service.findDefinicionById('2'));
        expect(value!.nombre_mision).toBe('Chipre (UNFICYP)');
      });

      it('devuelve error 404 si no existe', () => {
        const { error } = runMock(service.findDefinicionById('no-existe'));
        expect(error).toBeInstanceOf(HttpErrorResponse);
        expect(error.status).toBe(404);
      });
    });

    describe('createDefinicion', () => {
      it('crea una misión nueva con id autogenerado', () => {
        const { value } = runMock(service.createDefinicion({ nombre_mision: 'Líbano', pais: 'Líbano' }));
        expect(value!.nombre_mision).toBe('Líbano');
        expect(value!.total_convocatorias).toBe(0);
        expect(value!.id).toBeTruthy();
      });

      it('la misión creada queda disponible en findAllDefiniciones', () => {
        runMock(service.createDefinicion({ nombre_mision: 'Líbano', pais: 'Líbano' }));
        const { value } = runMock(service.findAllDefiniciones(1, 100));
        expect(value!.items.some((m) => m.nombre_mision === 'Líbano')).toBe(true);
      });

      it('rechaza con 409 si el nombre ya existe (case-insensitive)', () => {
        const { error } = runMock(service.createDefinicion({ nombre_mision: 'CONGO (monusco)', pais: 'X' }));
        expect(error.status).toBe(409);
      });
    });

    describe('editarDefinicion', () => {
      it('actualiza los campos de la misión', () => {
        const { value } = runMock(service.editarDefinicion('1', { pais: 'Nuevo país' }));
        expect(value!.pais).toBe('Nuevo país');
        expect(value!.nombre_mision).toBe('Congo (MONUSCO)');
      });

      it('devuelve 404 si la misión no existe', () => {
        const { error } = runMock(service.editarDefinicion('no-existe', { pais: 'X' }));
        expect(error.status).toBe(404);
      });
    });

    describe('deleteDefinicion', () => {
      it('elimina la misión de la lista', () => {
        runMock(service.deleteDefinicion('1'));
        const { value } = runMock(service.findAllDefiniciones(1, 100));
        expect(value!.items.some((m) => m.id === '1')).toBe(false);
      });

      it('elimina en cascada las convocatorias asociadas', () => {
        runMock(service.deleteDefinicion('1'));
        const { value } = runMock(service.findConvocatorias('1'));
        expect(value!.items).toHaveLength(0);
      });

      it('elimina en cascada los funcionarios de esas convocatorias', () => {
        runMock(service.deleteDefinicion('1'));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        expect(value!.items).toHaveLength(0);
      });
    });

    describe('findConvocatorias', () => {
      it('devuelve solo las convocatorias de la misión pedida', () => {
        const { value } = runMock(service.findConvocatorias('1'));
        expect(value!.items).toHaveLength(2);
        expect(value!.items.every((c) => c.mision_id === '1')).toBe(true);
      });

      it('filtra por query (numero_orden)', () => {
        const { value } = runMock(service.findConvocatorias('1', 1, 10, '1542'));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].numero_orden).toBe('ORD-1542');
      });

      it('filtra por query (boletin) cuando no matchea numero_orden', () => {
        const { value } = runMock(service.findConvocatorias('2', 1, 10, 'bol-2025'));
        expect(value!.items).toHaveLength(1);
      });

      it('filtra por finalizada=false', () => {
        const { value } = runMock(service.findConvocatorias('1', 1, 10, undefined, false));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].id).toBe('101');
      });

      it('filtra por finalizada=true', () => {
        const { value } = runMock(service.findConvocatorias('1', 1, 10, undefined, true));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].id).toBe('102');
      });

      it('total_funcionarios se recalcula dinámicamente', () => {
        const { value } = runMock(service.findConvocatorias('1'));
        const c101 = value!.items.find((c) => c.id === '101')!;
        expect(c101.total_funcionarios).toBe(2);
      });
    });

    describe('findConvocatoriaById', () => {
      it('devuelve la convocatoria si pertenece a la misión indicada', () => {
        const { value } = runMock(service.findConvocatoriaById('1', '101'));
        expect(value!.numero_orden).toBe('ORD-1542');
      });

      it('devuelve 404 si la convocatoria no pertenece a esa misión', () => {
        const { error } = runMock(service.findConvocatoriaById('2', '101'));
        expect(error.status).toBe(404);
      });

      it('devuelve 404 si el id no existe', () => {
        const { error } = runMock(service.findConvocatoriaById('1', 'no-existe'));
        expect(error.status).toBe(404);
      });
    });

    describe('crearConvocatoria', () => {
      it('rechaza con 400 si no hay numero_orden ni boletin', () => {
        const { error } = runMock(service.crearConvocatoria('1', {}));
        expect(error.status).toBe(400);
      });

      it('crea la convocatoria con solo numero_orden', () => {
        const { value } = runMock(service.crearConvocatoria('1', { numero_orden: 'ORD-NEW' }));
        expect(value!.numero_orden).toBe('ORD-NEW');
        expect(value!.mision_id).toBe('1');
        expect(value!.finalizada).toBe(false);
      });

      it('crea la convocatoria con solo boletin', () => {
        const { value } = runMock(service.crearConvocatoria('1', { boletin: 'BOL-NEW' }));
        expect(value!.boletin).toBe('BOL-NEW');
      });

      it('sin persona_ids, total_funcionarios queda en 0', () => {
        const { value } = runMock(service.crearConvocatoria('1', { boletin: 'B' }));
        expect(value!.total_funcionarios).toBe(0);
      });

      it('con persona_ids, crea las asignaciones usando datos de PersonalService', () => {
        personalService.findAll.mockReturnValue(
          of([{ id: '42', nombre: 'Juan García', cedula: '111', rango: 'R', destino: 'D', estado: 'activo' }]),
        );
        const { value } = runMock(service.crearConvocatoria('1', { boletin: 'B', persona_ids: [42] }));
        expect(value!.total_funcionarios).toBe(1);
        expect(personalService.findAll).toHaveBeenCalled();
      });

      it('la convocatoria creada aparece luego en findConvocatorias', () => {
        runMock(service.crearConvocatoria('3', { numero_orden: 'ORD-X' }));
        const { value } = runMock(service.findConvocatorias('3'));
        expect(value!.items.some((c) => c.numero_orden === 'ORD-X')).toBe(true);
      });
    });

    describe('editarConvocatoria', () => {
      it('actualiza los campos de la convocatoria', () => {
        const { value } = runMock(service.editarConvocatoria('1', '101', { observaciones: 'Nueva obs' }));
        expect(value!.observaciones).toBe('Nueva obs');
      });

      it('devuelve 404 si la convocatoria no existe para esa misión', () => {
        const { error } = runMock(service.editarConvocatoria('2', '101', {}));
        expect(error.status).toBe(404);
      });
    });

    describe('eliminarConvocatoria', () => {
      it('elimina la convocatoria', () => {
        runMock(service.eliminarConvocatoria('1', '101'));
        const { value } = runMock(service.findConvocatorias('1'));
        expect(value!.items.some((c) => c.id === '101')).toBe(false);
      });

      it('elimina en cascada los funcionarios de esa convocatoria', () => {
        runMock(service.eliminarConvocatoria('1', '101'));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        expect(value!.items).toHaveLength(0);
      });
    });

    describe('findFuncionariosByConvocatoria', () => {
      it('devuelve los funcionarios de la convocatoria', () => {
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        expect(value!.items).toHaveLength(2);
      });

      it('filtra por cédula', () => {
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101', 1, 5, '1.234'));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].cedula).toContain('1.234');
      });

      it('filtra por nombre/apellido', () => {
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101', 1, 5, 'gómez'));
        expect(value!.items).toHaveLength(1);
        expect(value!.items[0].primer_apellido).toBe('Gómez');
      });

      it('devuelve lista vacía si la convocatoria no tiene funcionarios cargados', () => {
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', 'no-existe'));
        expect(value!.items).toHaveLength(0);
      });

      it('pagina correctamente', () => {
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101', 1, 1));
        expect(value!.items).toHaveLength(1);
        expect(value!.total).toBe(2);
      });
    });

    describe('addFuncionarios', () => {
      beforeEach(() => {
        personalService.findAll.mockReturnValue(
          of([{ id: '999', nombre: 'Nueva Persona', cedula: '5.555.555-5', rango: 'R', destino: 'D', estado: 'activo' }]),
        );
      });

      it('rechaza con 400 si algún funcionario no tiene orden ni boletín', () => {
        const { error } = runMock(service.addFuncionarios('1', '101', [{ persona_id: '999' }]));
        expect(error.status).toBe(400);
      });

      it('agrega el funcionario con los datos de PersonalService', () => {
        runMock(service.addFuncionarios('1', '101', [{ persona_id: '999', boletin: 'B1' }]));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        const nuevo = value!.items.find((f) => f.persona_id === '999');
        expect(nuevo).toBeTruthy();
        expect(nuevo!.primer_nombre).toBe('Nueva');
        expect(nuevo!.primer_apellido).toBe('Persona');
        expect(nuevo!.cedula).toBe('5.555.555-5');
      });

      it('rechaza con 409 si la persona ya está asignada a esa convocatoria', () => {
        const { error } = runMock(service.addFuncionarios('1', '101', [{ persona_id: '1001', boletin: 'B' }]));
        expect(error.status).toBe(409);
      });

      it('total_funcionarios de la convocatoria aumenta tras asignar', () => {
        runMock(service.addFuncionarios('1', '101', [{ persona_id: '999', numero_orden: 'O' }]));
        const { value } = runMock(service.findConvocatoriaById('1', '101'));
        expect(value!.total_funcionarios).toBe(3);
      });

      it('cuando la persona no está en PersonalService, guarda nombre/cédula null', () => {
        personalService.findAll.mockReturnValue(of([]));
        runMock(service.addFuncionarios('1', '101', [{ persona_id: '999', boletin: 'B' }]));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        const nuevo = value!.items.find((f) => f.persona_id === '999');
        expect(nuevo!.cedula).toBeNull();
        expect(nuevo!.primer_nombre).toBeNull();
      });
    });

    describe('updateFuncionario', () => {
      it('actualiza boletín y observaciones', () => {
        runMock(service.updateFuncionario('1', '101', '1001', { boletin: 'BOL-NUEVO', observaciones: 'nota' }));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        const f = value!.items.find((x) => x.persona_id === '1001')!;
        expect(f.boletin).toBe('BOL-NUEVO');
        expect(f.observaciones).toBe('nota');
      });

      it('devuelve 404 si el funcionario no está en la convocatoria', () => {
        const { error } = runMock(service.updateFuncionario('1', '101', 'no-existe', { boletin: 'X' }));
        expect(error.status).toBe(404);
      });

      it('rechaza con 400 si el resultado final se queda sin orden ni boletín', () => {
        // persona_id 1001 en convocatoria 101 solo tiene boletin (sin numero_orden);
        // intentar vaciar el boletín sin poner un numero_orden debe fallar.
        const { error } = runMock(service.updateFuncionario('1', '101', '1001', { boletin: '' }));
        expect(error.status).toBe(400);
      });

      it('permite actualizar solo observaciones sin tocar orden/boletín', () => {
        const { value: before } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        const boletinPrevio = before!.items.find((f) => f.persona_id === '1001')!.boletin;
        runMock(service.updateFuncionario('1', '101', '1001', { observaciones: 'solo esto' }));
        const { value: after } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        const f = after!.items.find((x) => x.persona_id === '1001')!;
        expect(f.boletin).toBe(boletinPrevio);
        expect(f.observaciones).toBe('solo esto');
      });
    });

    describe('deleteFuncionario', () => {
      it('quita al funcionario de la convocatoria', () => {
        runMock(service.deleteFuncionario('1', '101', '1001'));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        expect(value!.items.some((f) => f.persona_id === '1001')).toBe(false);
        expect(value!.items).toHaveLength(1);
      });
    });

    describe('deleteAllFuncionarios', () => {
      it('vacía todos los funcionarios de la convocatoria', () => {
        runMock(service.deleteAllFuncionarios('1', '101'));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '101'));
        expect(value!.items).toHaveLength(0);
      });

      it('no afecta a otras convocatorias', () => {
        runMock(service.deleteAllFuncionarios('1', '101'));
        const { value } = runMock(service.findFuncionariosByConvocatoria('1', '102'));
        expect(value!.items).toHaveLength(1);
      });
    });

    describe('findFuncionariosConMisiones', () => {
      it('agrupa por persona a través de todas las convocatorias', () => {
        const { value } = runMock(service.findFuncionariosConMisiones());
        // persona 1001 está en convocatorias 101 y 201 (misiones distintas)
        const juan = value!.find((f) => f.id === '1001')!;
        expect(juan.misiones).toHaveLength(2);
      });

      it('usa el numero_orden propio del funcionario si existe, si no el de la convocatoria', () => {
        const { value } = runMock(service.findFuncionariosConMisiones());
        const maria = value!.find((f) => f.id === '1002')!;
        // maria tiene numero_orden propio 'ORD-1542-A' en la convocatoria 101
        expect(maria.misiones[0].numero_orden).toBe('ORD-1542-A');

        const juan = value!.find((f) => f.id === '1001')!;
        const filaConvocatoria101 = juan.misiones.find((m) => m.convocatoriaId === '101')!;
        // juan no tiene numero_orden propio en esa convocatoria → hereda el de la convocatoria ('ORD-1542' en la semilla)
        expect(filaConvocatoria101.numero_orden).toBe('ORD-1542');
      });

      it('nombre se arma concatenando primer_nombre y primer_apellido', () => {
        const { value } = runMock(service.findFuncionariosConMisiones());
        const carlos = value!.find((f) => f.id === '1003')!;
        expect(carlos.nombre).toBe('Carlos Rodríguez');
      });
    });
  });
});
