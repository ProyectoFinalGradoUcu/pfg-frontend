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
import { Destino, FuncionarioUnidad, SubUnidadConDestinados } from '../../../../core/models/destinos.models';

function makeDestino(overrides: Partial<Destino> = {}): Destino {
  return {
    id: '200',
    persona: { id: '42', cedula: '50000001', primer_nombre: 'José', primer_apellido: 'Pérez' },
    unidad: { id: '4', codigo: 'C.G.', denominacion: 'Comando General' },
    sub_unidad: { id: '5', codigo: 'E.M.A.', denominacion: 'Estado Mayor Aéreo' },
    fecha_inicio: '2024-04-30',
    fecha_fin: null,
    posicion_destino: 'Sub-Jefe',
    numero_orden: 'O.D. 11760',
    boletin: null,
    numero_destino: null,
    fecha_orden: null,
    fecha_boletin: null,
    numero_resolucion: null,
    fecha_resolucion: null,
    observaciones: null,
    activo: true,
    ...overrides,
  };
}

function makeFuncionario(overrides: Partial<FuncionarioUnidad> = {}): FuncionarioUnidad {
  return { ...makeDestino(), relacion_estado: 'activo', ...overrides };
}

function makeSubUnidad(): SubUnidadConDestinados {
  return {
    id: '5',
    codigo: 'E.M.A.',
    denominacion: 'Estado Mayor Aéreo',
    vigente: true,
    unidad: { id: '4', codigo: 'C.G.', denominacion: 'Comando General' },
    total_destinados: 3,
  };
}

describe('UnidadDetallePage', () => {
  let component: UnidadDetallePage;
  let fixture: ComponentFixture<UnidadDetallePage>;
  let destinosService: {
    listarFuncionariosSubUnidad: ReturnType<typeof vi.fn>;
    listarSubUnidadesParaSelector: ReturnType<typeof vi.fn>;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    destinosService = {
      listarFuncionariosSubUnidad: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      listarSubUnidadesParaSelector: vi.fn().mockReturnValue(of([makeSubUnidad()])),
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
    expect(destinosService.listarFuncionariosSubUnidad).toHaveBeenCalledWith('5', {
      page: 1,
      pageSize: 10,
      activo: true,
    });
  });

  it('al pedir el historial saca el filtro activo', () => {
    fixture.detectChanges();
    component.onToggleVigentes(false);
    expect(destinosService.listarFuncionariosSubUnidad).toHaveBeenLastCalledWith('5', { page: 1, pageSize: 10 });
  });

  it('resuelve los datos de la sub-unidad y su comando para el header', () => {
    fixture.detectChanges();
    expect(component.subUnidad()!.denominacion).toBe('Estado Mayor Aéreo');
    expect(component.subUnidad()!.unidad.codigo).toBe('C.G.');
    expect(fixture.nativeElement.textContent).toContain('Comando: C.G.');
  });

  it('guarda los funcionarios y el total', () => {
    destinosService.listarFuncionariosSubUnidad.mockReturnValue(
      of({ items: [makeDestino()], total: 1, page: 1, pageSize: 10 }),
    );
    fixture.detectChanges();
    expect(component.funcionarios().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('vuelve al catálogo si la unidad no existe', () => {
    destinosService.listarFuncionariosSubUnidad.mockReturnValue(
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
    expect(destinosService.listarFuncionariosSubUnidad).toHaveBeenCalledTimes(1); // solo la carga inicial
    vi.advanceTimersByTime(400);
    expect(component.page()).toBe(1);
    expect(destinosService.listarFuncionariosSubUnidad).toHaveBeenLastCalledWith('5', {
      page: 1,
      pageSize: 10,
      activo: true,
      query: 'Pérez',
    });
  });

  describe('retirado fantasma', () => {
    it('marca al que conserva la plaza con la relación inactiva', () => {
      destinosService.listarFuncionariosSubUnidad.mockReturnValue(
        of({
          items: [makeFuncionario({ activo: true, relacion_estado: 'inactivo' })],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      );
      fixture = TestBed.createComponent(UnidadDetallePage);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Retirado');
    });

    it('no lo marca cuando la relación está activa', () => {
      destinosService.listarFuncionariosSubUnidad.mockReturnValue(
        of({
          items: [makeFuncionario({ activo: true, relacion_estado: 'activo' })],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      );
      fixture = TestBed.createComponent(UnidadDetallePage);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Retirado');
    });

    it('el fantasma es la combinación: un destino ya cerrado no lo es', () => {
      const comp = fixture.componentInstance;
      expect(comp.esFantasma(makeFuncionario({ activo: false, relacion_estado: 'inactivo' }))).toBe(false);
      expect(comp.esFantasma(makeFuncionario({ activo: true, relacion_estado: 'inactivo' }))).toBe(true);
    });
  });
});
