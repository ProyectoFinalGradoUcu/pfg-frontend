import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { OrdenDetallePage } from './orden-detalle-page';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AscensoDeOrden, OrdenAscenso } from '../../../../core/models/ascensos.models';

function makeAscenso(overrides: Partial<AscensoDeOrden> = {}): AscensoDeOrden {
  return {
    id: '900',
    persona: { id: '100', cedula: '12345678', nombre_completo: 'José Pérez' },
    grado_anterior: { id: '3', codigo: 'CBO_2DA', denominacion: 'Cbo. 2ª' },
    grado_nuevo: { id: '4', codigo: 'CBO_1RA', denominacion: 'Cbo. 1ª' },
    fecha_ascenso: '2027-02-01',
    numero_orden: 'O.C.G.F.A. N.º 12.345',
    regla: { id: '40', nombre: 'Cbo. 2.ª → Cbo. 1.ª' },
    cumplia_requisitos: true,
    por_excepcion: false,
    motivo_excepcion: null,
    anulado: false,
    anulado_en: null,
    motivo_anulacion: null,
    registrado_por: { id: '8', username: 'admin@fau.mil.uy' },
    anulado_por: null,
    ...overrides,
  };
}

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
    cantidad_funcionarios: 1,
    cantidad_vigentes: 1,
    cantidad_por_excepcion: 0,
    ascensos: [makeAscenso()],
    ...overrides,
  };
}

describe('OrdenDetallePage', () => {
  let component: OrdenDetallePage;
  let fixture: ComponentFixture<OrdenDetallePage>;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    svc = {
      getOrden: vi.fn().mockReturnValue(of(makeOrden())),
      anularOrden: vi.fn().mockReturnValue(of(makeOrden({ anulada: true }))),
      anularAscenso: vi.fn().mockReturnValue(
        of(makeOrden({ ascensos: [makeAscenso({ anulado: true })] })),
      ),
    };
    auth = { hasPermiso: vi.fn().mockReturnValue(true) };
    toast = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [OrdenDetallePage],
      providers: [
        { provide: AscensosService, useValue: svc },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '70' } } } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdenDetallePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga la orden al entrar', () => {
    expect(svc['getOrden']).toHaveBeenCalledWith('70');
    expect(component.orden()?.numero_orden).toBe('O.C.G.F.A. N.º 12.345');
  });

  it('muestra el error del backend y deja reintentar', () => {
    svc['getOrden'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No existe' } })),
    );

    component.cargar();

    expect(component.error()).toBe('No existe');
  });

  describe('anulación', () => {
    it('exige un motivo con contenido antes de llamar al backend', () => {
      component.pedirAnularOrden();
      component.motivo.set('ok');

      component.confirmarAnulacion();

      expect(svc['anularOrden']).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('anula la orden completa con el motivo', () => {
      component.pedirAnularOrden();
      component.motivo.set('Se dejó sin efecto por resolución');

      component.confirmarAnulacion();

      expect(svc['anularOrden']).toHaveBeenCalledWith('70', 'Se dejó sin efecto por resolución');
      expect(component.orden()?.anulada).toBe(true);
      expect(component.modal()).toBeNull();
    });

    it('anula un ascenso puntual sin tocar el resto', () => {
      component.pedirAnularAscenso(makeAscenso());
      component.motivo.set('Se corrigió el grado');

      component.confirmarAnulacion();

      expect(svc['anularAscenso']).toHaveBeenCalledWith('900', 'Se corrigió el grado');
      expect(svc['anularOrden']).not.toHaveBeenCalled();
    });

    it('si el backend lo rechaza, avisa y deja el modal abierto', () => {
      svc['anularOrden'].mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: 'El ascenso ya fue liquidado' },
            }),
        ),
      );
      component.pedirAnularOrden();
      component.motivo.set('Se dejó sin efecto');

      component.confirmarAnulacion();

      expect(toast.error).toHaveBeenCalledWith('El ascenso ya fue liquidado');
      expect(component.modal()).toBe('anular-orden');
    });

    it('sin permiso de anulación no se ofrece la acción', () => {
      auth.hasPermiso.mockReturnValue(false);
      const otro = TestBed.createComponent(OrdenDetallePage);
      otro.detectChanges();

      expect(otro.componentInstance.puedeAnular()).toBe(false);
    });

    it('solo los ascensos vigentes se revierten', () => {
      svc['getOrden'].mockReturnValue(
        of(
          makeOrden({
            ascensos: [makeAscenso(), makeAscenso({ id: '901', anulado: true })],
          }),
        ),
      );
      component.cargar();

      expect(component.vigentes()).toHaveLength(1);
    });
  });

  it('despliega y esconde la foto de evaluación de un ascenso', () => {
    const a = makeAscenso();
    expect(component.estaExpandida(a.id)).toBe(false);

    component.alternarEvaluacion(a);
    expect(component.estaExpandida(a.id)).toBe(true);

    component.alternarEvaluacion(a);
    expect(component.estaExpandida(a.id)).toBe(false);
  });
});
