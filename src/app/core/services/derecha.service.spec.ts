import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { DerechaService } from './derecha.service';
import { API_BASE_URL } from '../api.config';
import { PersonalDerecha, ResultadoCambio } from '../models/derecha.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE = `${API_BASE_URL}/configuracion-derecha`;

function makePersonal(overrides: Partial<PersonalDerecha> = {}): PersonalDerecha {
  return {
    persona_id: '4',
    nombre: 'Ana Pereyra',
    cedula: '60000004',
    escala: 'OFICIALES',
    grado_id: '14',
    grado: 'Brig. Gral.',
    escalafon_id: '1',
    escalafon: 'AV',
    derecha: 4,
    numor: 2,
    ...overrides,
  };
}

function makeResultado(overrides: Partial<ResultadoCambio> = {}): ResultadoCambio {
  return { afectados: 3, derecha: [], numor: [], avisos: [], lote_id: 'l1', ...overrides };
}

describe('DerechaService', () => {
  let service: DerechaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DerechaService],
    });
    service = TestBed.inject(DerechaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('listarPersonal', () => {
    it('pide GET /configuracion-derecha/personal con credenciales y devuelve las filas', () => {
      let respuesta: PersonalDerecha[] | undefined;
      service.listarPersonal().subscribe((r) => (respuesta = r));

      const req = http.expectOne(`${BASE}/personal`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush([makePersonal()]);

      expect(respuesta).toEqual([makePersonal()]);
    });
  });

  describe('aplicarCambios', () => {
    it('manda PATCH /configuracion-derecha/cambios con el lote completo y el motivo', () => {
      const payload = {
        cambios: [
          { persona_id: 4, derecha: 2 },
          { grado_id: 14, orden: [3, 4, 2] },
        ],
        motivo: 'Boletín 12/2026',
      };
      let respuesta: ResultadoCambio | undefined;
      service.aplicarCambios(payload).subscribe((r) => (respuesta = r));

      const req = http.expectOne(`${BASE}/cambios`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual(payload);
      req.flush(makeResultado());

      expect(respuesta?.afectados).toBe(3);
    });
  });

  describe('previsualizar', () => {
    it('manda el lote de cambios en el body de POST /previsualizar', () => {
      const payload = { operacion: 'REORDEN' as const, cambios: [{ persona_id: 4, numor: 1 }] };
      service.previsualizar(payload).subscribe();

      const req = http.expectOne(`${BASE}/previsualizar`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(makeResultado({ lote_id: null }));
    });
  });
});
