import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PersonalService } from './personal.service';
import { API_BASE_URL } from '../api.config';
import { DestinoDePersona } from '../models/destinos.models';
import { BaseOpcion } from '../models/personal.models';

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
          unidad_id: '4',
          unidad: 'Comando General',
          codigo_unidad: 'C.G.',
          sub_unidad_id: '12',
          sub_unidad: 'Estado Mayor Aéreo',
          codigo_sub_unidad: 'E.M.A.',
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
      expect(result![0].sub_unidad).toBe('Estado Mayor Aéreo');
      expect(result![0].unidad).toBe('Comando General');
      expect(result![0].activo).toBe(true);
    });
  });

  describe('agregarFamiliar', () => {
    it('pide POST /personas/:id/familiares con el body', () => {
      service.agregarFamiliar(31, { cedula: '60000016', tipo_relacion: 'Madre' }).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/personas/31/familiares`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ cedula: '60000016', tipo_relacion: 'Madre' });
      req.flush({ id: 16, cedula: '60000016', nombre_completo: 'Laura Acosta', tipo_relacion: 'Madre', grado: null, unidad: null });
    });
  });

  describe('findPaginado e incluir_inactivos', () => {
    it('manda incluir_inactivos cuando se pide: sin esto los retirados no aparecen', () => {
      service.findPaginado({ incluir_inactivos: true }).subscribe();
      const req = http.expectOne((r) => r.url.includes('/personas'));
      expect(req.request.params.get('incluir_inactivos')).toBe('true');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('no lo manda cuando está en false: el default del backend ya es ese', () => {
      service.findPaginado({ incluir_inactivos: false }).subscribe();
      const req = http.expectOne((r) => r.url.includes('/personas'));
      expect(req.request.params.has('incluir_inactivos')).toBe(false);
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });
  });

  describe('findPaginado con filtros de lista', () => {
    it('manda destino, estado, grado y escalafón separados por coma', () => {
      service
        .findPaginado({ destino: [3, 4], estado: [2, 5], filtroDerecha: { gradoId: [14, 15], escalafonId: [1] } })
        .subscribe();
      const req = http.expectOne((r) => r.url === `${API_BASE_URL}/personas`);
      expect(req.request.params.get('destino')).toBe('3,4');
      expect(req.request.params.get('estado')).toBe('2,5');
      expect(req.request.params.get('gradoId')).toBe('14,15');
      expect(req.request.params.get('escalafonId')).toBe('1');
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });

    it('las listas vacías no se mandan', () => {
      service.findPaginado({ destino: [], estado: [], filtroDerecha: { gradoId: [], escalafonId: [] } }).subscribe();
      const req = http.expectOne((r) => r.url === `${API_BASE_URL}/personas`);
      for (const p of ['destino', 'estado', 'gradoId', 'escalafonId']) expect(req.request.params.has(p)).toBe(false);
      req.flush({ items: [], total: 0, page: 1, pageSize: 10 });
    });
  });

  describe('getBases', () => {
    it('pide el catálogo de sub-unidades y arma la etiqueta con el comando', () => {
      let bases: BaseOpcion[] | undefined;
      service.getBases().subscribe((r) => (bases = r));

      const req = http.expectOne(`${API_BASE_URL}/catalogos/sub-unidades`);
      expect(req.request.method).toBe('GET');
      req.flush([
        { id: 12, codigo: 'BAI', denominacion: 'B.A.I.', unidad_id: 3, comando: { id: 3, codigo: 'CAO', denominacion: 'C.A.O.' } },
      ]);

      expect(bases![0].etiqueta).toBe('B.A.I. (C.A.O.)');
      expect(bases![0].unidad_id).toBe(3);
    });
  });

  describe('quitarFamiliar', () => {
    it('pide DELETE /personas/:id/familiares/:familiarId', () => {
      service.quitarFamiliar(31, 16).subscribe();
      const req = http.expectOne(`${API_BASE_URL}/personas/31/familiares/16`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
