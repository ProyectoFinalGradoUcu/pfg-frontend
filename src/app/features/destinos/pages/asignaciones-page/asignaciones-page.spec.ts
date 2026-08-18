import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { AsignacionesPage } from './asignaciones-page';
import { DestinosService } from '../../../../core/services/destinos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Destino, ListaDestinos } from '../../../../core/models/destinos.models';
import { Select } from '../../../../shared/components/select/select';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function makeLista(items: Destino[] = [], overrides: Partial<ListaDestinos> = {}): ListaDestinos {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    stats: { total_destinos: items.length, destinos_activos: 31, unidades_con_personal: 6 },
    ...overrides,
  };
}

describe('AsignacionesPage', () => {
  let component: AsignacionesPage;
  let fixture: ComponentFixture<AsignacionesPage>;
  let destinosService: {
    listar: ReturnType<typeof vi.fn>;
    listarUnidadesParaSelector: ReturnType<typeof vi.fn>;
    editar: ReturnType<typeof vi.fn>;
    eliminar: ReturnType<typeof vi.fn>;
  };
  let authService: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    destinosService = {
      listar: vi.fn().mockReturnValue(of(makeLista())),
      listarUnidadesParaSelector: vi.fn().mockReturnValue(of([])),
      editar: vi.fn().mockReturnValue(of(makeDestino())),
      eliminar: vi.fn().mockReturnValue(of({ id: '200', eliminado: true as const })),
    };
    authService = { hasPermiso: vi.fn().mockReturnValue(true) };
    toastService = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      // `Select` (app-select) se declara acá porque los filtros de unidad y estado lo
      // usan con [ngModel] fuera de cualquier modal: sin el componente real registrado,
      // NgModel no encuentra un ControlValueAccessor sobre el elemento y explota con
      // NG01203 en cuanto corre detectChanges(). `Paginator` no necesita este tratamiento
      // porque no usa ngModel/formControlName.
      declarations: [AsignacionesPage, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: DestinosService, useValue: destinosService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AsignacionesPage);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  describe('carga inicial', () => {
    it('pide la primera página y el catálogo de unidades', () => {
      fixture.detectChanges();
      expect(destinosService.listar).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
      expect(destinosService.listarUnidadesParaSelector).toHaveBeenCalled();
    });

    it('guarda items, total y stats', () => {
      destinosService.listar.mockReturnValue(of(makeLista([makeDestino()], { total: 47 })));
      fixture.detectChanges();
      expect(component.destinos().length).toBe(1);
      expect(component.total()).toBe(47);
      expect(component.stats().destinos_activos).toBe(31);
      expect(component.loading()).toBe(false);
    });

    it('muestra un toast y corta el loading si el listado falla', () => {
      destinosService.listar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'Falló' }, status: 500 })),
      );
      fixture.detectChanges();
      expect(toastService.error).toHaveBeenCalledWith('Falló');
      expect(component.loading()).toBe(false);
    });
  });

  describe('filtros', () => {
    beforeEach(() => fixture.detectChanges());

    it('debounce la búsqueda y vuelve a la página 1', () => {
      vi.useFakeTimers();
      component.page.set(3);
      component.onQueryInput('Pérez');
      expect(destinosService.listar).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(400);
      expect(component.page()).toBe(1);
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, query: 'Pérez' });
    });

    it('filtra por unidad', () => {
      component.onUnidadChange('5');
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, unidad_id: 5 });
    });

    it('traduce el estado vigentes a activo=true', () => {
      component.onEstadoChange('vigentes');
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, activo: true });
    });

    it('traduce el estado historial a activo=false', () => {
      component.onEstadoChange('historial');
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, activo: false });
    });

    it('con estado en Todos no manda el param activo', () => {
      component.onEstadoChange('vigentes');
      component.onEstadoChange('');
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    });

    it('hayFiltros refleja si hay alguno aplicado', () => {
      expect(component.hayFiltros()).toBe(false);
      component.onUnidadChange('5');
      expect(component.hayFiltros()).toBe(true);
      component.limpiarFiltros();
      expect(component.hayFiltros()).toBe(false);
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    });
  });

  describe('paginación', () => {
    it('pide la página nueva sin resetear los filtros', () => {
      fixture.detectChanges();
      component.onUnidadChange('5');
      component.onPageChange(3);
      expect(destinosService.listar).toHaveBeenLastCalledWith({ page: 3, pageSize: 10, unidad_id: 5 });
    });
  });

  describe('presentación', () => {
    beforeEach(() => fixture.detectChanges());

    it('arma el nombre del funcionario', () => {
      expect(component.nombreFuncionario(makeDestino())).toBe('José Pérez');
    });

    it('cae a un guion cuando la fila no tiene persona', () => {
      expect(component.nombreFuncionario(makeDestino({ persona: null }))).toBe('—');
    });
  });

  describe('permisos', () => {
    it('puedeGestionar es true con destinos.gestionar', () => {
      fixture.detectChanges();
      expect(component.puedeGestionar()).toBe(true);
      expect(authService.hasPermiso).toHaveBeenCalledWith('destinos.gestionar');
    });

    it('puedeGestionar es false sin el permiso', () => {
      authService.hasPermiso.mockReturnValue(false);
      fixture.detectChanges();
      expect(component.puedeGestionar()).toBe(false);
    });
  });

  describe('modal de destino', () => {
    beforeEach(() => fixture.detectChanges());

    it('abrirCrear abre el modal sin destino en edición', () => {
      component.abrirCrear();
      expect(component.modal()).toBe('form');
      expect(component.destinoEnEdicion()).toBeNull();
    });

    it('abrirEditar abre el modal con el destino de la fila', () => {
      const d = makeDestino();
      component.abrirEditar(d);
      expect(component.modal()).toBe('form');
      expect(component.destinoEnEdicion()).toBe(d);
    });

    it('onGuardado cierra el modal, avisa y recarga el listado', () => {
      component.abrirCrear();
      destinosService.listar.mockClear();
      component.onGuardado();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalledWith('Destino registrado correctamente');
      expect(destinosService.listar).toHaveBeenCalled();
    });

    it('onGuardado avisa con el mensaje de edición cuando venía de abrirEditar', () => {
      component.abrirEditar(makeDestino());
      component.onGuardado();
      expect(toastService.success).toHaveBeenCalledWith('Destino actualizado correctamente');
    });

    it('cerrarModal limpia el estado sin recargar', () => {
      component.abrirEditar(makeDestino());
      destinosService.listar.mockClear();
      component.cerrarModal();
      expect(component.modal()).toBeNull();
      expect(component.destinoEnEdicion()).toBeNull();
      expect(destinosService.listar).not.toHaveBeenCalled();
    });
  });

  describe('acciones de fila', () => {
    beforeEach(() => fixture.detectChanges());

    it('cerrar un destino manda solo fecha_fin', () => {
      component.abrirCerrar(makeDestino());
      component.fechaFinForm.setValue('2026-12-31');
      component.confirmarCerrar();
      expect(destinosService.editar).toHaveBeenCalledWith('200', { fecha_fin: '2026-12-31' });
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('no cierra sin fecha', () => {
      component.abrirCerrar(makeDestino());
      component.fechaFinForm.setValue('');
      component.confirmarCerrar();
      expect(destinosService.editar).not.toHaveBeenCalled();
      expect(component.modalError()).toBe('Ingresá la fecha de fin.');
    });

    it('reabrir manda fecha_fin en null', () => {
      component.abrirReabrir(makeDestino({ fecha_fin: '2026-12-31', activo: false }));
      component.confirmarReabrir();
      expect(destinosService.editar).toHaveBeenCalledWith('200', { fecha_fin: null });
    });

    it('muestra el mensaje del backend si reabrir choca con otro destino activo', () => {
      destinosService.editar.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                service_response: {
                  service_status: { http_status: '409', http_message: 'El funcionario ya tiene otro destino activo; cerralo antes de reabrir este' },
                  service_data: null,
                },
              },
            }),
        ),
      );
      component.abrirReabrir(makeDestino({ activo: false }));
      component.confirmarReabrir();
      expect(component.modalError()).toBe('El funcionario ya tiene otro destino activo; cerralo antes de reabrir este');
      expect(component.modal()).toBe('reabrir');
    });

    it('eliminar borra la fila y recarga', () => {
      component.abrirEliminar(makeDestino());
      destinosService.listar.mockClear();
      component.confirmarEliminar();
      expect(destinosService.eliminar).toHaveBeenCalledWith('200');
      expect(destinosService.listar).toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });

    it('al borrar el último item de una página vuelve a la anterior', () => {
      // El estado se fija a mano: un segundo detectChanges() no vuelve a correr ngOnInit,
      // así que recargar el mock no cambiaría lo que ya quedó en la señal.
      component.destinos.set([makeDestino()]);
      component.page.set(2);
      component.abrirEliminar(makeDestino());
      component.confirmarEliminar();
      expect(component.page()).toBe(1);
    });

    it('el menú kebab se abre y se cierra', () => {
      const event = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 10, right: 20 }) } } as unknown as MouseEvent;
      component.toggleMenu('200', event);
      expect(component.openMenuId()).toBe('200');
      component.toggleMenu('200', event);
      expect(component.openMenuId()).toBeNull();
    });
  });
});
