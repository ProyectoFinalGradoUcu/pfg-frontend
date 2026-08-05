import { TestBed } from '@angular/core/testing';

import { PaisesService } from './paises.service';

describe('PaisesService', () => {
  let service: PaisesService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PaisesService] });
    service = TestBed.inject(PaisesService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('getPaises devuelve un observable con una lista no vacía', () => {
    let result: any;
    service.getPaises().subscribe((r) => (result = r));
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(100);
  });

  it('cada item tiene label y value iguales entre sí (nombre del país)', () => {
    let result: any;
    service.getPaises().subscribe((r) => (result = r));
    for (const item of result) {
      expect(item.label).toBe(item.value);
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('incluye a Uruguay', () => {
    let result: any;
    service.getPaises().subscribe((r) => (result = r));
    expect(result.some((p: any) => p.label === 'Uruguay')).toBe(true);
  });

  it('incluye países relevantes para misiones de paz de la ONU (Congo, Chipre, Haití, Líbano)', () => {
    let result: any;
    service.getPaises().subscribe((r) => (result = r));
    const labels = result.map((p: any) => p.label);
    expect(labels).toContain('República Democrática del Congo');
    expect(labels).toContain('Chipre');
    expect(labels).toContain('Haití');
    expect(labels).toContain('Líbano');
  });

  it('no tiene países duplicados', () => {
    let result: any;
    service.getPaises().subscribe((r) => (result = r));
    const labels = result.map((p: any) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('devuelve la lista ordenada alfabéticamente (es)', () => {
    let result: any;
    service.getPaises().subscribe((r) => (result = r));
    const labels = result.map((p: any) => p.label);
    const ordenado = [...labels].sort((a, b) => a.localeCompare(b, 'es'));
    expect(labels).toEqual(ordenado);
  });

  it('devuelve la misma lista (referencia estable) en llamadas sucesivas', () => {
    let first: any;
    let second: any;
    service.getPaises().subscribe((r) => (first = r));
    service.getPaises().subscribe((r) => (second = r));
    expect(first).toBe(second);
  });

  it('se resuelve de forma síncrona (no depende de HTTP)', () => {
    let resolved = false;
    service.getPaises().subscribe(() => (resolved = true));
    expect(resolved).toBe(true);
  });
});
