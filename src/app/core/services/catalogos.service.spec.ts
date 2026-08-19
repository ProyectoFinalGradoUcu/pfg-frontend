import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CatalogosService, payloadEdicionUnidad } from './catalogos.service';
import { API_BASE_URL } from '../api.config';
import { Unidad } from '../models/destinos.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUnidad(overrides: Partial<Unidad> = {}): Unidad {
  return {
    id: '5',
    codigo: 'COA',
    denominacion: 'Comando Aéreo de Operaciones (C.O.A.)',
    tipo: 'Unidad',
    vigente: true,
    ...overrides,
  };
}

describe('CatalogosService', () => {
  let service: CatalogosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CatalogosService],
    });
    service = TestBed.inject(CatalogosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('crearUnidad', () => {
    it('pide POST /catalogos/unidades envolviendo el payload en service_request', () => {
      service.crearUnidad({ codigo: 'BAIII', denominacion: 'Base Aérea Nº 3 (B.A.III)', tipo: 'Unidad' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({
        service_request: { codigo: 'BAIII', denominacion: 'Base Aérea Nº 3 (B.A.III)', tipo: 'Unidad' },
      });
      req.flush(makeUnidad({ codigo: 'BAIII' }));
    });

    it('omite tipo si no se lo pasa', () => {
      service.crearUnidad({ codigo: 'BAIII', denominacion: 'Base Aérea Nº 3 (B.A.III)' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades`);
      expect(req.request.body).toEqual({
        service_request: { codigo: 'BAIII', denominacion: 'Base Aérea Nº 3 (B.A.III)' },
      });
      req.flush(makeUnidad());
    });

    it('devuelve la unidad creada con el id como string', () => {
      let result: Unidad | undefined;
      service.crearUnidad({ codigo: 'BAIII', denominacion: 'Base Aérea Nº 3' }).subscribe((r: Unidad) => (result = r));
      http.expectOne(`${API_BASE_URL}/catalogos/unidades`).flush(makeUnidad({ id: '9' }));
      expect(result!.id).toBe('9');
    });
  });

  describe('editarUnidad', () => {
    it('pide PATCH /catalogos/unidades/:id envolviendo el payload en service_request', () => {
      service.editarUnidad('5', { denominacion: 'Nueva denominación' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades/5`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({ service_request: { denominacion: 'Nueva denominación' } });
      req.flush(makeUnidad({ denominacion: 'Nueva denominación' }));
    });

    it('manda solo las claves que se le pasan, no el objeto completo', () => {
      service.editarUnidad('5', { vigente: false }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades/5`);
      expect(req.request.body).toEqual({ service_request: { vigente: false } });
      req.flush(makeUnidad({ vigente: false }));
    });

    it('deja pasar tipo en null, que es lo que lo limpia', () => {
      service.editarUnidad('5', { tipo: null }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades/5`);
      expect(req.request.body.service_request).toEqual({ tipo: null });
      expect('tipo' in req.request.body.service_request).toBe(true);
      req.flush(makeUnidad({ tipo: null }));
    });

    it('nunca manda codigo en el body del PATCH, ni aunque el llamador intente forzarlo', () => {
      // `forbidNonWhitelisted` del backend rechaza la request entera con 400 si aparece
      // `codigo` en un PATCH: es la clave con la que los seeds y las migraciones
      // referencian la unidad. El `as any` simula un llamador que se equivocó (o un
      // futuro cambio de tipos que lo deje pasar); el servicio tiene que blindarlo igual,
      // sin depender solo de que `EditarUnidadPayload` no declare el campo.
      service.editarUnidad('5', { denominacion: 'X', codigo: 'NUEVO' } as any).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades/5`);
      expect('codigo' in req.request.body.service_request).toBe(false);
      expect(req.request.body).toEqual({ service_request: { denominacion: 'X' } });
      req.flush(makeUnidad());
    });
  });

  describe('darDeBajaUnidad', () => {
    it('pide DELETE /catalogos/unidades/:id y devuelve la unidad con vigente en false', () => {
      let result: Unidad | undefined;
      service.darDeBajaUnidad('5').subscribe((r: Unidad) => (result = r));
      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades/5`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.withCredentials).toBe(true);
      req.flush(makeUnidad({ vigente: false }));
      expect(result!.vigente).toBe(false);
    });
  });

  describe('payloadEdicionUnidad', () => {
    const original = makeUnidad({ denominacion: 'Comando Aéreo de Operaciones (C.O.A.)', tipo: 'Unidad', vigente: true });

    const sinCambios = { denominacion: 'Comando Aéreo de Operaciones (C.O.A.)', tipo: 'Unidad', vigente: true };

    it('devuelve un objeto vacío cuando nada cambió', () => {
      expect(payloadEdicionUnidad(original, sinCambios)).toEqual({});
    });

    it('incluye solo la denominación cuando es lo único que cambió', () => {
      expect(payloadEdicionUnidad(original, { ...sinCambios, denominacion: 'Nuevo nombre' })).toEqual({
        denominacion: 'Nuevo nombre',
      });
    });

    it('nunca manda una denominación vacía (es requerida)', () => {
      expect(payloadEdicionUnidad(original, { ...sinCambios, denominacion: '' })).toEqual({});
    });

    it('manda tipo en null cuando se lo vacía', () => {
      expect(payloadEdicionUnidad(original, { ...sinCambios, tipo: '' })).toEqual({ tipo: null });
    });

    it('incluye vigente solo cuando cambia', () => {
      expect(payloadEdicionUnidad(original, { ...sinCambios, vigente: false })).toEqual({ vigente: false });
    });

    it('nunca incluye codigo en el diff, ni aunque el original lo tenga', () => {
      const payload = payloadEdicionUnidad(original, { ...sinCambios, denominacion: 'Otra' });
      expect('codigo' in payload).toBe(false);
    });

    it('recorta espacios antes de comparar la denominación', () => {
      expect(payloadEdicionUnidad(original, { ...sinCambios, denominacion: '  Comando Aéreo de Operaciones (C.O.A.)  ' })).toEqual({});
    });
  });
});
