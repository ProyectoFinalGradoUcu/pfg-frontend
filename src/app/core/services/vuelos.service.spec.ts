import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { VuelosService } from './vuelos.service';
import { API_BASE_URL } from '../api.config';

const BASE = `${API_BASE_URL}/vuelos`;

describe('VuelosService', () => {
  let service: VuelosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VuelosService],
    });
    service = TestBed.inject(VuelosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los registros del período con los filtros y omite los vacíos', () => {
    service
      .listarRegistros('10', { page: 2, pageSize: 25, query: '', categoria: 'oficial', grado_id: 20, sin_unidad: true })
      .subscribe();
    const req = http.expectOne(`${BASE}/periodos/10/registros?page=2&pageSize=25&categoria=oficial&grado_id=20&sin_unidad=true`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('exporta el año entero, sin otros filtros, y descarga el Excel con el año', () => {
    const click = vi.fn();
    const crear = vi.spyOn(document, 'createElement').mockReturnValue({ click } as unknown as HTMLAnchorElement);
    const revoke = vi.fn();
    (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:x');
    (URL as any).revokeObjectURL = revoke;

    service.exportarAnio(2026).subscribe();
    const req = http.expectOne(`${BASE}/exportar?anio=2026`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));

    const a = crear.mock.results[0].value as HTMLAnchorElement;
    expect(a.download).toBe('horas_vuelo_2026.xlsx');
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    crear.mockRestore();
  });

  it('con categoría la manda y la pone en el nombre del archivo', () => {
    const click = vi.fn();
    const crear = vi.spyOn(document, 'createElement').mockReturnValue({ click } as unknown as HTMLAnchorElement);
    (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:x');
    (URL as any).revokeObjectURL = vi.fn();

    service.exportarAnio(2026, 'oficial').subscribe();
    http.expectOne(`${BASE}/exportar?anio=2026&categoria=oficial`).flush(new Blob(['x']));

    expect((crear.mock.results[0].value as HTMLAnchorElement).download).toBe('horas_vuelo_2026_oficiales.xlsx');
    crear.mockRestore();
  });

  it('crea un período con el body plano', () => {
    service.crearPeriodo({ anio: 2026, numero: 4 }).subscribe();
    const req = http.expectOne(`${BASE}/periodos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ anio: 2026, numero: 4 });
    req.flush({});
  });

  it('cierra y reabre con PATCH { cerrado }', () => {
    service.cambiarEstadoPeriodo('10', true).subscribe();
    const req = http.expectOne(`${BASE}/periodos/10`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ cerrado: true });
    req.flush({});
  });

  it('edita un registro mandando solo lo que cambió', () => {
    service.editarRegistro('500', { unidad_vuelo_id: null, hs_av_total: 1531 }).subscribe();
    const req = http.expectOne(`${BASE}/registros/500`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ unidad_vuelo_id: null, hs_av_total: 1531 });
    req.flush({});
  });

  it('pide el historial de una persona', () => {
    service.historialPersona('42').subscribe();
    http.expectOne(`${BASE}/personas/42/historial`).flush({});
  });
});
