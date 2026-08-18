import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { DestinosService, payloadEdicion } from './destinos.service';
import { API_BASE_URL } from '../api.config';
import { Destino, ListaDestinos, Paginado, UnidadConDestinados } from '../models/destinos.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDestino(overrides: Partial<Destino> = {}): Destino {
  return {
    id: '200',
    persona: { id: '42', cedula: '50000001', primer_nombre: 'José', primer_apellido: 'Pérez' },
    unidad: { id: '5', codigo: 'EMGFA', denominacion: 'E.M.G.F.A.', tipo: 'Organismo' },
    fecha_inicio: '2024-04-30',
    fecha_fin: null,
    posicion_destino: 'Sub-Jefe de Personal A-1',
    numero_orden: 'O.D. 11760',
    boletin: null,
    observaciones: null,
    activo: true,
    ...overrides,
  };
}

function makeLista(items: Destino[] = []): ListaDestinos {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    stats: { total_destinos: items.length, destinos_activos: 0, unidades_con_personal: 0 },
  };
}

function makeUnidades(items: UnidadConDestinados[] = []): Paginado<UnidadConDestinados> {
  return { items, total: items.length, page: 1, pageSize: 200 };
}

describe('DestinosService', () => {
  let service: DestinosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DestinosService],
    });
    service = TestBed.inject(DestinosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('listar', () => {
    it('pide GET /destinos sin query params cuando no se le pasa nada', () => {
      service.listar().subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos`);
      expect(req.request.method).toBe('GET');
      req.flush(makeLista());
    });

    it('manda page, pageSize, query, unidad_id y activo', () => {
      service.listar({ page: 2, pageSize: 25, query: 'Pérez', unidad_id: 5, activo: true }).subscribe();
      const req = http.expectOne((r) => r.url.startsWith(`${API_BASE_URL}/destinos?`));
      expect(req.request.url).toContain('page=2');
      expect(req.request.url).toContain('pageSize=25');
      expect(req.request.url).toContain('unidad_id=5');
      expect(req.request.url).toContain('activo=true');
      expect(decodeURIComponent(req.request.url)).toContain('query=Pérez');
      req.flush(makeLista());
    });

    it('serializa activo=false en vez de omitirlo', () => {
      service.listar({ activo: false }).subscribe();
      const req = http.expectOne((r) => r.url.startsWith(`${API_BASE_URL}/destinos?`));
      expect(req.request.url).toContain('activo=false');
      req.flush(makeLista());
    });

    it('omite los params vacíos, nulos e indefinidos', () => {
      service.listar({ query: '', unidad_id: undefined, activo: undefined }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos`);
      expect(req.request.url).not.toContain('?');
      req.flush(makeLista());
    });

    it('devuelve items y stats tal cual, con los ids como string', () => {
      let result: ListaDestinos | undefined;
      service.listar().subscribe((r) => (result = r));
      http.expectOne(`${API_BASE_URL}/destinos`).flush(makeLista([makeDestino()]));
      expect(result!.items[0].id).toBe('200');
      expect(result!.items[0].persona!.id).toBe('42');
      expect(result!.stats.total_destinos).toBe(1);
    });
  });

  describe('obtener', () => {
    it('pide GET /destinos/:id', () => {
      service.obtener('200').subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos/200`);
      expect(req.request.method).toBe('GET');
      req.flush(makeDestino());
    });
  });

  describe('crear', () => {
    it('envuelve el payload en service_request', () => {
      service.crear({ persona_id: 42, unidad_id: 5, fecha_inicio: '2026-09-01', numero_orden: 'O.D. 12455' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        service_request: { persona_id: 42, unidad_id: 5, fecha_inicio: '2026-09-01', numero_orden: 'O.D. 12455' },
      });
      req.flush(makeDestino());
    });

    it('manda fecha_fin_anterior cuando se la pasa', () => {
      service
        .crear({ persona_id: 42, unidad_id: 5, fecha_inicio: '2026-09-01', boletin: 'B-1', fecha_fin_anterior: '2026-08-15' })
        .subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos`);
      expect(req.request.body.service_request.fecha_fin_anterior).toBe('2026-08-15');
      req.flush(makeDestino());
    });
  });

  describe('editar', () => {
    it('envuelve el payload en service_request y usa PATCH', () => {
      service.editar('200', { posicion_destino: 'Jefe de Estado Mayor' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos/200`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ service_request: { posicion_destino: 'Jefe de Estado Mayor' } });
      req.flush(makeDestino());
    });

    it('deja pasar fecha_fin en null, que es lo que reabre el destino', () => {
      service.editar('200', { fecha_fin: null }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/destinos/200`);
      expect(req.request.body.service_request).toEqual({ fecha_fin: null });
      expect('fecha_fin' in req.request.body.service_request).toBe(true);
      req.flush(makeDestino());
    });
  });

  describe('eliminar', () => {
    it('pide DELETE /destinos/:id', () => {
      let result: { id: string; eliminado: true } | undefined;
      service.eliminar('200').subscribe((r) => (result = r));
      const req = http.expectOne(`${API_BASE_URL}/destinos/200`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ id: '200', eliminado: true });
      expect(result).toEqual({ id: '200', eliminado: true });
    });
  });

  describe('listarUnidades', () => {
    it('pide GET /destinos/unidades con tipo y vigente', () => {
      service.listarUnidades({ query: 'aérea', tipo: 'Unidad', vigente: true }).subscribe();
      const req = http.expectOne((r) => r.url.startsWith(`${API_BASE_URL}/destinos/unidades?`));
      expect(req.request.url).toContain('tipo=Unidad');
      expect(req.request.url).toContain('vigente=true');
      req.flush(makeUnidades());
    });
  });

  describe('listarUnidadesParaSelector', () => {
    it('pide el máximo pageSize del backend y devuelve solo los items', () => {
      let result: UnidadConDestinados[] | undefined;
      service.listarUnidadesParaSelector().subscribe((r) => (result = r));
      const req = http.expectOne((r) => r.url.startsWith(`${API_BASE_URL}/destinos/unidades?`));
      expect(req.request.url).toContain('pageSize=200');
      req.flush(
        makeUnidades([
          { id: '5', codigo: 'EMGFA', denominacion: 'E.M.G.F.A.', tipo: 'Organismo', vigente: true, total_destinados: 3 },
        ]),
      );
      expect(result!.length).toBe(1);
      expect(result![0].denominacion).toBe('E.M.G.F.A.');
    });
  });

  describe('listarFuncionariosUnidad', () => {
    it('pide GET /destinos/unidades/:id/funcionarios con activo', () => {
      service.listarFuncionariosUnidad('5', { activo: true, page: 1, pageSize: 10 }).subscribe();
      const req = http.expectOne((r) => r.url.startsWith(`${API_BASE_URL}/destinos/unidades/5/funcionarios?`));
      expect(req.request.url).toContain('activo=true');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });
  });

  describe('payloadEdicion', () => {
    const original = makeDestino({
      fecha_inicio: '2024-04-30',
      fecha_fin: null,
      posicion_destino: 'Sub-Jefe',
      numero_orden: 'O.D. 11760',
      boletin: null,
      observaciones: null,
    });

    const sinCambios = {
      fecha_inicio: '2024-04-30',
      fecha_fin: '',
      posicion_destino: 'Sub-Jefe',
      numero_orden: 'O.D. 11760',
      boletin: '',
      observaciones: '',
    };

    it('devuelve un objeto vacío cuando nada cambió', () => {
      expect(payloadEdicion(original, sinCambios)).toEqual({});
    });

    it('incluye solo las claves que cambiaron', () => {
      expect(payloadEdicion(original, { ...sinCambios, posicion_destino: 'Jefe de Estado Mayor' })).toEqual({
        posicion_destino: 'Jefe de Estado Mayor',
      });
    });

    it('manda null cuando un texto se vacía', () => {
      expect(payloadEdicion(original, { ...sinCambios, posicion_destino: '' })).toEqual({ posicion_destino: null });
    });

    it('manda fecha_fin como fecha cuando se cierra el destino', () => {
      expect(payloadEdicion(original, { ...sinCambios, fecha_fin: '2026-12-31' })).toEqual({ fecha_fin: '2026-12-31' });
    });

    it('manda fecha_fin en null cuando se vacía un destino cerrado (reabrir)', () => {
      const cerrado = makeDestino({ ...original, fecha_fin: '2026-12-31', activo: false });
      const payload = payloadEdicion(cerrado, { ...sinCambios, fecha_fin: '' });
      expect(payload).toEqual({ fecha_fin: null });
      expect('fecha_fin' in payload).toBe(true);
    });

    it('nunca manda fecha_inicio vacía', () => {
      expect(payloadEdicion(original, { ...sinCambios, fecha_inicio: '' })).toEqual({});
    });

    it('recorta los espacios de los textos antes de comparar', () => {
      expect(payloadEdicion(original, { ...sinCambios, posicion_destino: '  Sub-Jefe  ' })).toEqual({});
    });
  });
});
