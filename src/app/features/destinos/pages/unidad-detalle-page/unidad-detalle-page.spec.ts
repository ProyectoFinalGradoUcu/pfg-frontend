import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { UnidadDetallePage } from './unidad-detalle-page';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Destino, UnidadConDestinados } from '../../../../core/models/destinos.models';

function makeDestino(overrides: Partial<Destino> = {}): Destino {
  return {
    id: '200',
    persona: { id: '42', cedula: '50000001', primer_nombre: 'José', primer_apellido: 'Pérez' },
    unidad: { id: '5', codigo: 'EMGFA', denominacion: 'E.M.G.F.A.', tipo: 'Organismo' },
    fecha_inicio: '2024-04-30',
    fecha_fin: null,
    posicion_destino: 'Sub-Jefe',
    numero_orden: 'O.D. 11760',
    boletin: null,
    observaciones: null,
    activo: true,
    ...overrides,
  };
}

function makeUnidad(): UnidadConDestinados {
  return { id: '5', codigo: 'EMGFA', denominacion: 'E.M.G.F.A.', tipo: 'Organismo', vigente: true, total_destinados: 3 };
}

describe('UnidadDetallePage', () => {
  let component: UnidadDetallePage;
  let fixture: ComponentFixture<UnidadDetallePage>;
  let destinosService: {
    listarFuncionariosUnidad: ReturnType<typeof vi.fn>;
    listarUnidadesParaSelector: ReturnType<typeof vi.fn>;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    destinosService = {
      listarFuncionariosUnidad: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      listarUnidadesParaSelector: vi.fn().mockReturnValue(of([makeUnidad()])),
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [UnidadDetallePage],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: DestinosService, useValue: destinosService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadDetallePage);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  it('arranca mostrando solo la dotación actual', () => {
    fixture.detectChanges();
    expect(component.soloVigentes()).toBe(true);
    expect(destinosService.listarFuncionariosUnidad).toHaveBeenCalledWith('5', {
      page: 1,
      pageSize: 10,
      activo: true,
    });
  });

  it('al pedir el historial saca el filtro activo', () => {
    fixture.detectChanges();
    component.onToggleVigentes(false);
    expect(destinosService.listarFuncionariosUnidad).toHaveBeenLastCalledWith('5', { page: 1, pageSize: 10 });
  });

  it('resuelve los datos de la unidad para el header', () => {
    fixture.detectChanges();
    expect(component.unidad()!.denominacion).toBe('E.M.G.F.A.');
  });

  it('guarda los funcionarios y el total', () => {
    destinosService.listarFuncionariosUnidad.mockReturnValue(
      of({ items: [makeDestino()], total: 1, page: 1, pageSize: 10 }),
    );
    fixture.detectChanges();
    expect(component.funcionarios().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('vuelve al catálogo si la unidad no existe', () => {
    destinosService.listarFuncionariosUnidad.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No existe unidad con id 5' } })),
    );
    fixture.detectChanges();
    expect(toastService.error).toHaveBeenCalledWith('No existe unidad con id 5');
    expect(router.navigate).toHaveBeenCalledWith(['/destinos/unidades']);
  });

  it('debounce la búsqueda y vuelve a la página 1', () => {
    fixture.detectChanges();
    vi.useFakeTimers();
    component.page.set(2);
    component.onQueryInput('Pérez');
    expect(destinosService.listarFuncionariosUnidad).toHaveBeenCalledTimes(1); // solo la carga inicial
    vi.advanceTimersByTime(400);
    expect(component.page()).toBe(1);
    expect(destinosService.listarFuncionariosUnidad).toHaveBeenLastCalledWith('5', {
      page: 1,
      pageSize: 10,
      activo: true,
      query: 'Pérez',
    });
  });
});
