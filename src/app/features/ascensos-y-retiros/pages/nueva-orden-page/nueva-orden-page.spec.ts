import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { NuevaOrdenPage } from './nueva-orden-page';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Elegibilidad } from '../../../../core/models/ascensos.models';

function makeElegibilidad(overrides: Partial<Elegibilidad> = {}): Elegibilidad {
  return {
    persona: {
      id: '100',
      cedula: '12345678',
      nombre_completo: 'José Pérez',
      apellido: 'Pérez',
      unidad: null,
      escalafon: null,
      situacion: null,
    },
    grado_actual: { id: '3', codigo: 'CBO_2DA', denominacion: 'Cbo. 2ª', orden: 2 },
    grado_destino: { id: '4', codigo: 'CBO_1RA', denominacion: 'Cbo. 1ª', orden: 3 },
    regla: { id: '40', nombre: 'Cbo. 2.ª → Cbo. 1.ª' },
    estado: 'PASIBLE',
    fecha_cumpliria: null,
    motivo: null,
    antiguedad_dias: 900,
    edad: 36,
    requisitos: [],
    ...overrides,
  };
}

describe('NuevaOrdenPage', () => {
  let component: NuevaOrdenPage;
  let fixture: ComponentFixture<NuevaOrdenPage>;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let queryParams: Map<string, string>;

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [NuevaOrdenPage],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: AscensosService, useValue: svc },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (k: string) => queryParams.get(k) ?? null } },
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NuevaOrdenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    queryParams = new Map();
    svc = {
      listarPasibles: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 20 })),
      getElegibilidad: vi.fn().mockReturnValue(of(makeElegibilidad())),
      crearOrden: vi.fn().mockReturnValue(
        of({ id: '70', numero_orden: 'O.C.G.F.A. N.º 1', cantidad_funcionarios: 1 }),
      ),
    };
    auth = { hasPermiso: vi.fn().mockReturnValue(true) };
    toast = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };
  });

  afterEach(() => TestBed.resetTestingModule());

  it('arranca en el paso de la orden', async () => {
    await montar();
    expect(component.paso()).toBe(1);
  });

  it('no avanza sin número y fecha de orden', async () => {
    await montar();

    component.irAFuncionarios();

    expect(component.paso()).toBe(1);
  });

  it('avanza al paso de funcionarios con la orden completa', async () => {
    await montar();
    component.ordenForm.patchValue({
      numero_orden: 'O.C.G.F.A. N.º 1',
      fecha_orden: '2027-02-01',
    });

    component.irAFuncionarios();

    expect(component.paso()).toBe(2);
  });

  it('no avanza con la fecha pero sin orden ni boletín', async () => {
    await montar();
    component.ordenForm.patchValue({ fecha_orden: '2027-02-01' });

    component.irAFuncionarios();

    expect(component.paso()).toBe(1);
    expect(component.ordenForm.hasError('sinOrdenNiBoletin')).toBe(true);
  });

  it('alcanza con el boletín para avanzar', async () => {
    await montar();
    component.ordenForm.patchValue({
      boletin: 'BOL-2027-02',
      fecha_orden: '2027-02-01',
    });

    component.irAFuncionarios();

    expect(component.paso()).toBe(2);
  });

  it('avisa que falta la orden o el boletín recién cuando se tocó un campo', async () => {
    await montar();
    component.ordenForm.patchValue({ fecha_orden: '2027-02-01' });
    expect(component.faltaOrdenYBoletin()).toBe(false);

    component.ordenForm.get('numero_orden')!.markAsTouched();

    expect(component.faltaOrdenYBoletin()).toBe(true);
  });

  it('precarga al funcionario que viene del perfil', async () => {
    queryParams.set('persona', '100');
    await montar();

    expect(svc['getElegibilidad']).toHaveBeenCalledWith('100', undefined);
    expect(component.filas()).toHaveLength(1);
  });

  it('precarga a los seleccionados que vienen del listado de pasibles', async () => {
    queryParams.set('personas', '100,101');
    svc['getElegibilidad'].mockImplementation((id: string) =>
      of(makeElegibilidad({ persona: { ...makeElegibilidad().persona, id } })),
    );
    await montar();

    expect(component.filas()).toHaveLength(2);
  });

  it('no agrega dos veces al mismo funcionario', async () => {
    await montar();
    const e = makeElegibilidad();

    component.agregar(e);
    component.agregar(e);

    expect(component.filas()).toHaveLength(1);
  });

  it('propone el grado destino de la regla y la fecha de la orden', async () => {
    await montar();
    component.ordenForm.patchValue({
      numero_orden: 'O.C.G.F.A. N.º 1',
      fecha_orden: '2027-02-01',
    });

    component.agregar(makeElegibilidad());

    expect(component.filas()[0].grado_destino_id).toBe('4');
    expect(component.filas()[0].fecha_ascenso).toBe('2027-02-01');
  });

  describe('excepciones', () => {
    it('quien no cumple queda marcado como excepción', async () => {
      await montar();
      component.agregar(makeElegibilidad({ estado: 'BLOQUEADO', motivo: 'Le falta el curso' }));

      expect(component.esExcepcion(component.filas()[0])).toBe(true);
      expect(component.porExcepcion()).toBe(1);
    });

    it('quien no tiene regla evaluable no cuenta como excepción', async () => {
      await montar();
      component.agregar(makeElegibilidad({ estado: 'SIN_REGLA', regla: null }));

      expect(component.esExcepcion(component.filas()[0])).toBe(false);
    });

    it('no se puede confirmar con una excepción sin motivo', async () => {
      await montar();
      component.ordenForm.patchValue({
        numero_orden: 'O.C.G.F.A. N.º 1',
        fecha_orden: '2027-02-01',
      });
      component.agregar(makeElegibilidad({ estado: 'BLOQUEADO', motivo: 'Le falta el curso' }));

      expect(component.puedeConfirmar()).toBe(false);

      component.onMotivo('100', 'Vacante urgente');

      expect(component.puedeConfirmar()).toBe(true);
    });

    it('sin el permiso de excepción no se puede confirmar aunque haya motivo', async () => {
      auth.hasPermiso.mockReturnValue(false);
      await montar();
      component.agregar(makeElegibilidad({ estado: 'BLOQUEADO', motivo: 'x' }));
      component.onMotivo('100', 'Vacante urgente');

      expect(component.puedeConfirmar()).toBe(false);
    });
  });

  describe('confirmar', () => {
    async function prepararOrdenLista(): Promise<void> {
      await montar();
      component.ordenForm.patchValue({
        numero_orden: 'O.C.G.F.A. N.º 1',
        fecha_orden: '2027-02-01',
      });
      component.agregar(makeElegibilidad());
      component.irAConfirmar();
    }

    it('manda la orden con sus funcionarios y redirige al detalle', async () => {
      await prepararOrdenLista();

      component.confirmar();

      const payload = svc['crearOrden'].mock.calls[0][0];
      expect(payload.numero_orden).toBe('O.C.G.F.A. N.º 1');
      expect(payload.funcionarios).toEqual([
        { persona_id: 100, grado_destino_id: 4, fecha_ascenso: '2027-02-01', motivo_excepcion: undefined },
      ]);
      expect(router.navigate).toHaveBeenCalledWith(['/ascensos-y-retiros/ordenes', '70']);
    });

    it('si el backend rechaza, vuelve al paso de funcionarios con el aviso', async () => {
      await prepararOrdenLista();
      svc['crearOrden'].mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 400, error: { message: 'No cumple los requisitos' } }),
        ),
      );

      component.confirmar();

      expect(toast.error).toHaveBeenCalledWith('No cumple los requisitos');
      expect(component.paso()).toBe(2);
    });

    it('una orden vacía no se puede confirmar', async () => {
      await montar();
      expect(component.puedeConfirmar()).toBe(false);
    });
  });

  it('quitar saca al funcionario de la orden', async () => {
    await montar();
    component.agregar(makeElegibilidad());

    component.quitar('100');

    expect(component.filas()).toHaveLength(0);
  });
});
