import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PersonalService } from './personal.service';
import { API_BASE_URL } from '../api.config';
import { DestinoDePersona } from '../models/destinos.models';

describe('PersonalService', () => {
  let service: PersonalService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PersonalService],
    });
    service = TestBed.inject(PersonalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getDestinos', () => {
    it('pide GET /personas/:id/destinos', () => {
      service.getDestinos(42).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/personas/42/destinos`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('devuelve el array plano tal cual, sin paginar', () => {
      let result: DestinoDePersona[] | undefined;
      service.getDestinos(42).subscribe((r) => (result = r));
      http.expectOne(`${API_BASE_URL}/personas/42/destinos`).flush([
        {
          id: '200',
          unidad_id: '5',
          unidad: 'E.M.G.F.A.',
          codigo_unidad: 'EMGFA',
          tipo_unidad: 'Organismo',
          posicion_destino: 'Sub-Jefe de Personal A-1',
          fecha_inicio: '2024-04-30',
          fecha_fin: null,
          numero_orden: 'O.D. 11760',
          boletin: null,
          observaciones: null,
          activo: true,
        },
      ]);
      expect(result!.length).toBe(1);
      expect(result![0].unidad).toBe('E.M.G.F.A.');
      expect(result![0].activo).toBe(true);
    });
  });
});
