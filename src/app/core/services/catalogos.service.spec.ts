import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CatalogosService } from './catalogos.service';
import { API_BASE_URL } from '../api.config';
import { Comando } from '../models/destinos.models';
import { MotivoBajaCatalogo } from '../models/retiros.models';

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

  describe('getComandos', () => {
    it('pide GET /catalogos/unidades y pasa los ids a string', () => {
      let recibido: Comando[] | null = null;
      service.getComandos().subscribe((r) => (recibido = r));

      const req = http.expectOne(`${API_BASE_URL}/catalogos/unidades`);
      expect(req.request.method).toBe('GET');
      req.flush([
        { id: 1, codigo: 'C.A.O.', denominacion: 'Comando Aéreo de Operaciones' },
        { id: 4, codigo: 'C.G.', denominacion: 'Comando General' },
      ]);

      expect(recibido).toEqual([
        { id: '1', codigo: 'C.A.O.', denominacion: 'Comando Aéreo de Operaciones' },
        { id: '4', codigo: 'C.G.', denominacion: 'Comando General' },
      ]);
    });
  });

  describe('getMotivosBaja', () => {
    it('pide GET /catalogos/motivos-baja y devuelve el catálogo', () => {
      const motivos: MotivoBajaCatalogo[] = [
        { id: 2, codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
        { id: 5, codigo: 'RETIRO_OBL', denominacion: 'Baja por retiro obligatorio.' },
      ];

      let recibido: MotivoBajaCatalogo[] | null = null;
      service.getMotivosBaja().subscribe((r) => (recibido = r));

      const req = http.expectOne(`${API_BASE_URL}/catalogos/motivos-baja`);
      expect(req.request.method).toBe('GET');
      req.flush(motivos);

      expect(recibido).toEqual(motivos);
    });
  });
});
