import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { MisionConvocatoriasPage } from './mision-convocatorias-page';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Convocatoria, MisionDefinicion } from '../../../../core/models/misiones.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMision(overrides: Partial<MisionDefinicion> = {}): MisionDefinicion {
  return { id: '1', nombre_mision: 'Congo', pais: 'RD Congo', total_convocatorias: 0, ...overrides };
}

function makeConvocatoria(overrides: Partial<Convocatoria> = {}): Convocatoria {
  return {
    id: 'c1',
    mision_id: '1',
    numero_orden: 'ORD-1',
    boletin: null,
    fecha_salida: '2026-01-01',
    fecha_llegada: null,
    observaciones: null,
    total_funcionarios: 0,
    finalizada: false,
    ...overrides,
  };
}

function makePaginated<T>(items: T[], total = items.length, page = 1) {
  return { items, total, page, pageSize: 10 };
}

function makeHttpError(message: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { message }, status });
}

// ── Spec ───────────────────────────────────────────────────────────────────────

describe('MisionConvocatoriasPage', () => {
  let component: MisionConvocatoriasPage;
  let fixture: ComponentFixture<MisionConvocatoriasPage>;
  let misionesService: ReturnType<typeof makeMisionesServiceSpy>;
  let personalService: { findAll: ReturnType<typeof vi.fn> };
  let authService: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function makeMisionesServiceSpy() {
    return {
      findDefinicionById: vi.fn().mockReturnValue(of(makeMision())),
      findConvocatorias: vi.fn().mockReturnValue(of(makePaginated([]))),
      crearConvocatoria: vi.fn().mockReturnValue(of(makeConvocatoria())),
      editarConvocatoria: vi.fn().mockReturnValue(of(makeConvocatoria())),
      eliminarConvocatoria: vi.fn().mockReturnValue(of(undefined)),
    };
  }

  async function setup(misionId = '1', hasPermiso = true) {
    misionesService = makeMisionesServiceSpy();
    personalService = { findAll: vi.fn().mockReturnValue(of([])) };
    authService = { hasPermiso: vi.fn().mockReturnValue(hasPermiso) };
    toastService = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    router = { navigate: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [MisionConvocatoriasPage],
      imports: [ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: MisionesService, useValue: misionesService },
        { provide: PersonalService, useValue: personalService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => misionId } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisionConvocatoriasPage);
    component = fixture.componentInstance;
    component.ngOnInit();
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // ── Inicialización ─────────────────────────────────────────────────────────

  describe('inicialización', () => {
    it('crea el componente', async () => {
      await setup();
      expect(component).toBeTruthy();
    });

    it('carga la misión, las convocatorias y el personal', async () => {
      await setup();
      expect(misionesService.findDefinicionById).toHaveBeenCalledWith('1');
      expect(misionesService.findConvocatorias).toHaveBeenCalled();
      expect(personalService.findAll).toHaveBeenCalled();
    });

    it('usa el misionId de la ruta', async () => {
      await setup('99');
      expect(misionesService.findDefinicionById).toHaveBeenCalledWith('99');
    });
  });

  describe('cargarMision', () => {
    beforeEach(() => setup());

    it('setea la misión al éxito', () => {
      const mision = makeMision({ nombre_mision: 'Haití' });
      misionesService.findDefinicionById.mockReturnValue(of(mision));
      component.cargarMision();
      expect(component.mision()).toEqual(mision);
      expect(component.loading()).toBe(false);
    });

    it('muestra toast y navega al catálogo si falla', () => {
      misionesService.findDefinicionById.mockReturnValue(throwError(() => makeHttpError('no encontrada', 404)));
      component.cargarMision();
      expect(toastService.error).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo']);
    });
  });

  describe('cargarConvocatorias', () => {
    beforeEach(() => setup());

    it('llama al service con misionId, page y pageSize', () => {
      component.cargarConvocatorias();
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 1, 10, undefined, undefined);
    });

    it('pasa finalizada=false cuando el filtro de estado es "activa"', () => {
      component.filtroEstado.set('activa');
      component.cargarConvocatorias();
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 1, 10, undefined, false);
    });

    it('pasa finalizada=true cuando el filtro de estado es "finalizada"', () => {
      component.filtroEstado.set('finalizada');
      component.cargarConvocatorias();
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 1, 10, undefined, true);
    });

    it('pasa el query de orden/boletín recortado', () => {
      component.filtroOrdenBoletin.set('  ORD-1  ');
      component.cargarConvocatorias();
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 1, 10, 'ORD-1', undefined);
    });

    it('setea convocatorias, total y página', () => {
      const c = makeConvocatoria({ id: '5' });
      misionesService.findConvocatorias.mockReturnValue(of(makePaginated([c], 1, 2)));
      component.cargarConvocatorias();
      expect(component.convocatorias()).toEqual([c]);
      expect(component.convTotal()).toBe(1);
      expect(component.convPage()).toBe(2);
    });

    it('muestra toast de error si el service falla', () => {
      misionesService.findConvocatorias.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.cargarConvocatorias();
      expect(toastService.error).toHaveBeenCalled();
      expect(component.loadingConvocatorias()).toBe(false);
    });
  });

  describe('filtros y paginación', () => {
    beforeEach(() => setup());

    it('onConvPageChange cambia la página y recarga', () => {
      misionesService.findConvocatorias.mockReturnValue(of(makePaginated([], 0, 3)));
      component.onConvPageChange(3);
      expect(component.convPage()).toBe(3);
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 3, 10, undefined, undefined);
    });

    it('onOrdenBoletinInput actualiza el filtro y recarga (con debounce) reseteando a página 1', () => {
      vi.useFakeTimers();
      component.convPage.set(5);
      component.onOrdenBoletinInput('ORD-9');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      expect(component.filtroOrdenBoletin()).toBe('ORD-9');
      expect(component.convPage()).toBe(1);
    });

    it('onEstadoFiltroChange actualiza el filtro y recarga (con debounce)', () => {
      vi.useFakeTimers();
      component.onEstadoFiltroChange('finalizada');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      expect(component.filtroEstado()).toBe('finalizada');
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 1, 10, undefined, true);
    });

    it('hayFiltrosConv es true si hay texto de orden/boletín', () => {
      component.filtroOrdenBoletin.set('X');
      expect(component.hayFiltrosConv()).toBe(true);
    });

    it('hayFiltrosConv es true si hay filtro de estado', () => {
      component.filtroEstado.set('activa');
      expect(component.hayFiltrosConv()).toBe(true);
    });

    it('hayFiltrosConv es false sin filtros', () => {
      expect(component.hayFiltrosConv()).toBe(false);
    });

    it('limpiarFiltrosConv resetea filtros, página y recarga', () => {
      component.filtroOrdenBoletin.set('X');
      component.filtroEstado.set('activa');
      component.convPage.set(3);
      component.limpiarFiltrosConv();
      expect(component.filtroOrdenBoletin()).toBe('');
      expect(component.filtroEstado()).toBe('');
      expect(component.convPage()).toBe(1);
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 1, 10, undefined, undefined);
    });
  });

  describe('navegación', () => {
    beforeEach(() => setup());

    it('volver navega al catálogo', () => {
      component.volver();
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo']);
    });

    it('verFuncionarios navega a la convocatoria y cierra el menú', () => {
      component.openMenuId.set('x');
      component.verFuncionarios(makeConvocatoria({ id: '77' }));
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo', '1', 'convocatorias', '77']);
      expect(component.openMenuId()).toBeNull();
    });
  });

  describe('menú de acciones (kebab)', () => {
    beforeEach(() => setup());

    it('toggleMenu abre el menú con el id correcto', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 1, right: 2 }) } } as unknown as MouseEvent;
      component.toggleMenu('c1', mockEvent);
      expect(component.openMenuId()).toBe('c1');
    });

    it('toggleMenu cierra si ya estaba abierto con el mismo id', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 1, right: 2 }) } } as unknown as MouseEvent;
      component.toggleMenu('c1', mockEvent);
      component.toggleMenu('c1', mockEvent);
      expect(component.openMenuId()).toBeNull();
    });

    it('cerrarMenu limpia openMenuId y menuPosition', () => {
      component.openMenuId.set('x');
      component.menuPosition.set({ top: 1, right: 2 });
      component.cerrarMenu();
      expect(component.openMenuId()).toBeNull();
      expect(component.menuPosition()).toBeNull();
    });
  });

  // ── Modales ────────────────────────────────────────────────────────────────

  describe('Modal Nueva/Editar Convocatoria', () => {
    beforeEach(() => setup());

    it('abrirNuevaConvocatoria limpia el formulario y abre el modal', () => {
      component.convocatoriaForm.patchValue({ numero_orden: 'X' });
      component.abrirNuevaConvocatoria();
      expect(component.convocatoriaForm.value.numero_orden).toBe('');
      expect(component.modal()).toBe('nuevaConvocatoria');
      expect(component.convocatoriaSeleccionada()).toBeNull();
    });

    it('abrirEditar precarga el formulario con los datos de la convocatoria', () => {
      const c = makeConvocatoria({ numero_orden: 'ORD-5', boletin: 'BOL-5', observaciones: 'nota' });
      component.abrirEditar(c);
      expect(component.convocatoriaForm.value).toMatchObject({ numero_orden: 'ORD-5', boletin: 'BOL-5', observaciones: 'nota' });
      expect(component.modal()).toBe('editarConvocatoria');
      expect(component.convocatoriaSeleccionada()).toEqual(c);
    });

    it('eliminarConvocatoria abre el modal de confirmación sin usar window.confirm', () => {
      const spy = vi.spyOn(window, 'confirm');
      component.eliminarConvocatoria(makeConvocatoria());
      expect(spy).not.toHaveBeenCalled();
      expect(component.modal()).toBe('confirmarEliminar');
    });

    it('cerrarModal limpia modal, error y selección', () => {
      component.modal.set('nuevaConvocatoria');
      component.modalError.set('err');
      component.convocatoriaSeleccionada.set(makeConvocatoria());
      component.cerrarModal();
      expect(component.modal()).toBeNull();
      expect(component.modalError()).toBeNull();
      expect(component.convocatoriaSeleccionada()).toBeNull();
    });

    it('guardarConvocatoria setea error si no hay orden ni boletín', () => {
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: '', boletin: '' });
      component.guardarConvocatoria();
      expect(component.modalError()).toContain('orden');
      expect(misionesService.crearConvocatoria).not.toHaveBeenCalled();
    });

    it('guardarConvocatoria (creación) se habilita con solo numero_orden', () => {
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-1', boletin: '' });
      component.guardarConvocatoria();
      expect(misionesService.crearConvocatoria).toHaveBeenCalled();
    });

    it('guardarConvocatoria (creación) se habilita con solo boletin', () => {
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: '', boletin: 'BOL-1' });
      component.guardarConvocatoria();
      expect(misionesService.crearConvocatoria).toHaveBeenCalled();
    });

    it('guardarConvocatoria (creación) convierte persona_ids a number[]', () => {
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-1', persona_ids: ['10', '20'] });
      component.guardarConvocatoria();
      const call = misionesService.crearConvocatoria.mock.calls[0];
      expect(call[1].persona_ids).toEqual([10, 20]);
    });

    it('guardarConvocatoria (creación) manda persona_ids undefined si no hay ninguna seleccionada', () => {
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-1', persona_ids: [] });
      component.guardarConvocatoria();
      const call = misionesService.crearConvocatoria.mock.calls[0];
      expect(call[1].persona_ids).toBeUndefined();
    });

    it('guardarConvocatoria (creación) cierra el modal, muestra toast, recarga convocatorias y misión', () => {
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-1' });
      component.guardarConvocatoria();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(misionesService.findConvocatorias).toHaveBeenCalled();
      expect(misionesService.findDefinicionById).toHaveBeenCalled();
    });

    it('guardarConvocatoria (creación) muestra error del backend sin cerrar el modal', () => {
      misionesService.crearConvocatoria.mockReturnValue(throwError(() => makeHttpError('error backend')));
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-1' });
      component.guardarConvocatoria();
      expect(component.modalError()).toContain('error backend');
      expect(component.modal()).toBe('nuevaConvocatoria');
    });

    it('guardarConvocatoria (edición) llama a editarConvocatoria con el id correcto', () => {
      const c = makeConvocatoria({ id: '9' });
      component.abrirEditar(c);
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-9' });
      component.guardarConvocatoria();
      expect(misionesService.editarConvocatoria).toHaveBeenCalledWith('1', '9', expect.objectContaining({ numero_orden: 'ORD-9' }));
    });

    it('guardarConvocatoria (edición) NO llama a crearConvocatoria', () => {
      component.abrirEditar(makeConvocatoria());
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-9' });
      component.guardarConvocatoria();
      expect(misionesService.crearConvocatoria).not.toHaveBeenCalled();
    });

    it('guardarConvocatoria (edición) cierra el modal y muestra toast', () => {
      component.abrirEditar(makeConvocatoria());
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-9' });
      component.guardarConvocatoria();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarConvocatoria (edición) muestra error del backend sin cerrar el modal', () => {
      misionesService.editarConvocatoria.mockReturnValue(throwError(() => makeHttpError('error')));
      component.abrirEditar(makeConvocatoria());
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-9' });
      component.guardarConvocatoria();
      expect(component.modalError()).toBeTruthy();
      expect(component.modal()).toBe('editarConvocatoria');
    });
  });

  describe('Confirmar eliminar convocatoria', () => {
    beforeEach(() => setup());

    it('confirmarEliminar llama al service con misionId y convocatoriaId', () => {
      component.convocatoriaSeleccionada.set(makeConvocatoria({ id: '5' }));
      component.confirmarEliminar();
      expect(misionesService.eliminarConvocatoria).toHaveBeenCalledWith('1', '5');
    });

    it('confirmarEliminar retrocede una página si era el último item de una página > 1', () => {
      component.convocatorias.set([makeConvocatoria()]);
      component.convocatoriaSeleccionada.set(makeConvocatoria());
      component.convPage.set(3);
      component.confirmarEliminar();
      expect(misionesService.findConvocatorias).toHaveBeenLastCalledWith('1', 2, 10, undefined, undefined);
    });

    it('confirmarEliminar recarga convocatorias y misión, cierra el modal y muestra toast', () => {
      component.convocatoriaSeleccionada.set(makeConvocatoria());
      component.modal.set('confirmarEliminar');
      component.confirmarEliminar();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(misionesService.findDefinicionById).toHaveBeenCalled();
    });

    it('confirmarEliminar muestra error en el modal si el service falla', () => {
      misionesService.eliminarConvocatoria.mockReturnValue(throwError(() => makeHttpError('tiene funcionarios')));
      component.convocatoriaSeleccionada.set(makeConvocatoria());
      component.confirmarEliminar();
      expect(component.modalError()).toContain('tiene funcionarios');
    });

    it('confirmarEliminar no hace nada sin convocatoria seleccionada', () => {
      component.convocatoriaSeleccionada.set(null);
      component.confirmarEliminar();
      expect(misionesService.eliminarConvocatoria).not.toHaveBeenCalled();
    });
  });

  // ── trackConvocatoria ──────────────────────────────────────────────────────

  it('trackConvocatoria devuelve el id', async () => {
    await setup();
    expect(component.trackConvocatoria(0, makeConvocatoria({ id: 'zz' }))).toBe('zz');
  });

  // ── parseError ─────────────────────────────────────────────────────────────

  describe('parseError (vía guardarConvocatoria)', () => {
    beforeEach(() => setup());

    const triggerError = (errBody: any, status: number) => {
      const err = new HttpErrorResponse({ error: errBody, status });
      misionesService.crearConvocatoria.mockReturnValue(throwError(() => err));
      component.abrirNuevaConvocatoria();
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-1' });
      component.guardarConvocatoria();
      return component.modalError();
    };

    it('extrae message string del cuerpo del error', () => {
      expect(triggerError({ message: 'error x' }, 400)).toBe('error x');
    });

    it('extrae el primer elemento si message es un array', () => {
      expect(triggerError({ message: ['a', 'b'] }, 400)).toBe('a');
    });

    it('usa el body como string si es un string directo', () => {
      expect(triggerError('error de servidor', 500)).toBe('error de servidor');
    });

    it('mensaje amigable para 404', () => {
      expect(triggerError(null, 404)).toBe('El recurso no fue encontrado.');
    });

    it('mensaje amigable para 403', () => {
      expect(triggerError(null, 403)).toBe('No tenés permiso para realizar esta acción.');
    });

    it('mensaje amigable para 0 (sin conexión)', () => {
      expect(triggerError(null, 0)).toBe('No se pudo conectar con el servidor.');
    });

    it('mensaje genérico para status no mapeado', () => {
      expect(triggerError(null, 503)).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
    });
  });

  // ── puedeGestionar ─────────────────────────────────────────────────────────

  describe('permiso misiones.gestionar', () => {
    it('es true si el service devuelve true', async () => {
      await setup('1', true);
      expect(component.puedeGestionar()).toBe(true);
    });

    it('es false si el service devuelve false', async () => {
      await setup('1', false);
      expect(component.puedeGestionar()).toBe(false);
    });
  });
});
