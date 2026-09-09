import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { RetirosService } from './retiros.service';
import { API_BASE_URL } from '../api.config';
import { PreviaRetiro, Retiro, RetiroDetalle } from '../models/retiros.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRetiro(overrides: Partial<Retiro> = {}): Retiro {
  return {
    id: '7',
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    grado: { id: '14', denominacion: 'Coronel' },
    unidad: { id: '5', denominacion: 'E.M.G.F.A.' },
    fecha_retiro: '2026-08-28',
    hora_retiro: null,
    motivo_baja: { codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
    motivo: 'Retiro voluntario',
    anulado: false,
    vigente: true,
    ...overrides,
  };
}

function makePrevia(overrides: Partial<PreviaRetiro> = {}): PreviaRetiro {
  return {
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    relacion_laboral: null,
    destino_vigente: null,
    inscripciones_activas: [],
    usuario: null,
    vivienda: null,
    bloqueos: [],
    ...overrides,
  };
}

describe('RetirosService', () => {
  let service: RetirosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RetirosService],
    });
    service = TestBed.inject(RetirosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('listar', () => {
    it('pide GET /retiros sin query params cuando no se pasa nada', () => {
      service.listar().subscribe();
      const req = http.expectOne(`${API_BASE_URL}/retiros`);
      expect(req.request.method).toBe('GET');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('serializa los filtros, incluido vigentes en false', () => {
      service
        .listar({ page: 2, pageSize: 25, query: 'Pereyra', unidad_id: 5, vigentes: false })
        .subscribe();
      const req = http.expectOne(
        (r) => r.url === `${API_BASE_URL}/retiros` && r.params.get('vigentes') === 'false',
      );
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('25');
      expect(req.request.params.get('query')).toBe('Pereyra');
      expect(req.request.params.get('unidad_id')).toBe('5');
      req.flush({ items: [], total: 0, page: 2, pageSize: 25 });
    });

    it('omite los params vacíos', () => {
      service.listar({ query: '', desde: undefined }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/retiros`);
      expect(req.request.params.keys()).toEqual([]);
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });
  });

  describe('previa', () => {
    it('pide GET /retiros/previa/:personaId con la fecha como query param', () => {
      service.previa('1', '2026-08-28').subscribe();
      const req = http.expectOne(
        (r) =>
          r.url === `${API_BASE_URL}/retiros/previa/1` &&
          r.params.get('fecha_retiro') === '2026-08-28',
      );
      expect(req.request.method).toBe('GET');
      req.flush(makePrevia());
    });
  });

  describe('detalle', () => {
    it('pide GET /retiros/:retiroId', () => {
      service.detalle('7').subscribe();
      const req = http.expectOne(`${API_BASE_URL}/retiros/7`);
      expect(req.request.method).toBe('GET');
      req.flush(makeRetiro() as RetiroDetalle);
    });
  });

  describe('registrar', () => {
    it('pide POST /retiros envolviendo el body en service_request', () => {
      service
        .registrar({
          persona_id: 1,
          fecha_retiro: '2026-08-28',
          motivo_baja_id: 5,
          cerrar: { destino: true, inscripciones: [301], usuario: false },
        })
        .subscribe();

      const req = http.expectOne(`${API_BASE_URL}/retiros`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        service_request: {
          persona_id: 1,
          fecha_retiro: '2026-08-28',
          motivo_baja_id: 5,
          cerrar: { destino: true, inscripciones: [301], usuario: false },
        },
      });
      req.flush({
        ...makeRetiro(),
        cerrado: { destino: '3', inscripciones: ['301'], usuario: null },
      });
    });
  });

  describe('corregir', () => {
    it('pide PATCH /retiros/:retiroId envolviendo el body', () => {
      service.corregir('7', { fecha_retiro: '2026-08-29' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/retiros/7`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ service_request: { fecha_retiro: '2026-08-29' } });
      req.flush(makeRetiro() as RetiroDetalle);
    });
  });

  describe('anular', () => {
    it('pide DELETE /retiros/:retiroId con el motivo en el body', () => {
      service.anular('7', { motivo_anulacion: 'Cargado sobre la persona equivocada' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/retiros/7`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({
        service_request: { motivo_anulacion: 'Cargado sobre la persona equivocada' },
      });
      req.flush({
        id: '7',
        revertido: {
          relacion_laboral: '3',
          movimiento_borrado: '8',
          destino: '3',
          inscripciones: [],
          usuario: '3',
        },
      });
    });
  });

});
