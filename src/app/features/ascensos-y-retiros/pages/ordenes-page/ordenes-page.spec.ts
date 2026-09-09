import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterModule, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { OrdenesPage } from './ordenes-page';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OrdenAscenso, OrdenesPaginadas } from '../../../../core/models/ascensos.models';

function makeOrden(overrides: Partial<OrdenAscenso> = {}): OrdenAscenso {
  return {
    id: '70',
    numero_orden: 'O.C.G.F.A. N.º 12.345',
    fecha_orden: '2027-02-01',
    boletin: null,
    observaciones: null,
    anulada: false,
    anulada_en: null,
    motivo_anulacion: null,
    creada_en: '2027-02-02T10:00:00Z',
    creada_por: { id: '8', username: 'admin@fau.mil.uy' },
    anulada_por: null,
    cantidad_funcionarios: 2,
    cantidad_vigentes: 2,
    cantidad_por_excepcion: 1,
    ascensos: [],
    ...overrides,
  };
}

function makePagina(items: OrdenAscenso[] = [makeOrden()]): OrdenesPaginadas {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    stats: {
      ordenes: 1,
      ordenes_anuladas: 0,
      ascensos: 2,
      ascensos_anulados: 0,
      por_excepcion: 1,
    },
  };
}

describe('OrdenesPage', () => {
  let component: OrdenesPage;
  let fixture: ComponentFixture<OrdenesPage>;
  let svc: { listarOrdenes: ReturnType<typeof vi.fn> };
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    svc = { listarOrdenes: vi.fn().mockReturnValue(of(makePagina())) };
    auth = { hasPermiso: vi.fn().mockReturnValue(true) };

    await TestBed.configureTestingModule({
      declarations: [OrdenesPage],
      // El template enlaza [routerLink]: sin RouterModule el render falla.
      imports: [RouterModule],
      providers: [
        provideRouter([]),
        { provide: AscensosService, useValue: svc },
        { provide: AuthService, useValue: auth },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdenesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('arranca en el año en curso', () => {
    expect(svc.listarOrdenes).toHaveBeenCalledWith(
      expect.objectContaining({ anio: new Date().getFullYear(), page: 1 }),
    );
    expect(component.items()).toHaveLength(1);
    expect(component.stats()?.por_excepcion).toBe(1);
  });

  it('muestra el error del backend', () => {
    svc.listarOrdenes.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Se cayó' } })),
    );

    component.cargar();

    expect(component.error()).toBe('Se cayó');
  });

  it('cambiar de año vuelve a la primera página', () => {
    component.irAPagina(1);
    component.onAnio('2025');

    expect(component.anio()).toBe(2025);
    expect(component.page()).toBe(1);
    expect(svc.listarOrdenes).toHaveBeenLastCalledWith(
      expect.objectContaining({ anio: 2025 }),
    );
  });

  it('el filtro de estado se traduce a anuladas true/false o sin filtro', () => {
    component.onAnuladas('true');
    expect(svc.listarOrdenes).toHaveBeenLastCalledWith(
      expect.objectContaining({ anuladas: true }),
    );

    component.onAnuladas('');
    expect(svc.listarOrdenes).toHaveBeenLastCalledWith(
      expect.objectContaining({ anuladas: undefined }),
    );
  });

  it('despliega y esconde los funcionarios de una orden', () => {
    const o = makeOrden();
    expect(component.estaDesplegada(o.id)).toBe(false);

    component.alternarDespliegue(o);
    expect(component.estaDesplegada(o.id)).toBe(true);

    component.alternarDespliegue(o);
    expect(component.estaDesplegada(o.id)).toBe(false);
  });

  it('ofrece registrar orden solo con el permiso', () => {
    expect(component.puedeRegistrar()).toBe(true);

    auth.hasPermiso.mockReturnValue(false);
    const otro = TestBed.createComponent(OrdenesPage);
    otro.detectChanges();

    expect(otro.componentInstance.puedeRegistrar()).toBe(false);
  });
});
