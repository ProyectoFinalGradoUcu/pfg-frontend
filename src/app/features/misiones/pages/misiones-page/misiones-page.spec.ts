import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { MisionesPage } from './misiones-page';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PaisesService } from '../../../../core/services/paises.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  FuncionarioConMisiones,
  FuncionarioMisionItem,
  MisionDefinicion,
} from '../../../../core/models/misiones.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMision(overrides: Partial<MisionDefinicion> = {}): MisionDefinicion {
  return { id: '1', nombre_mision: 'Congo', pais: 'RD Congo', total_convocatorias: 0, ...overrides };
}

function makeMisionItem(overrides: Partial<FuncionarioMisionItem> = {}): FuncionarioMisionItem {
  return {
    id: '1',
    convocatoriaId: 'c1',
    nombre_mision: 'Congo',
    pais: 'RD Congo',
    numero_orden: 'ORD-1',
    boletin: null,
    observaciones: null,
    fecha_salida: '2026-01-01',
    fecha_llegada: null,
    finalizada: false,
    ...overrides,
  };
}

function makeFuncionario(overrides: Partial<FuncionarioConMisiones> = {}): FuncionarioConMisiones {
  return { id: 'f1', cedula: '12345678', nombre: 'Juan Pérez', misiones: [], ...overrides };
}

function makeCatalogo(items: MisionDefinicion[] = [], total = items.length) {
  return {
    items,
    total,
    page: 1,
    pageSize: 10,
    stats: { total_misiones: total, convocatorias_activas: 0, personal_desplegado: 0 },
  };
}

function makeHttpError(message: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { message }, status });
}

// ── Spec ───────────────────────────────────────────────────────────────────────

describe('MisionesPage', () => {
  let component: MisionesPage;
  let fixture: ComponentFixture<MisionesPage>;
  let misionesService: ReturnType<typeof makeMisionesServiceSpy>;
  let paisesService: { getPaises: ReturnType<typeof vi.fn> };
  let authService: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function makeMisionesServiceSpy() {
    return {
      findAllDefiniciones: vi.fn().mockReturnValue(of(makeCatalogo())),
      findMisionesOpciones: vi.fn().mockReturnValue(of([])),
      findFuncionariosConMisiones: vi.fn().mockReturnValue(of([])),
      createDefinicion: vi.fn().mockReturnValue(of(makeMision())),
      editarDefinicion: vi.fn().mockReturnValue(of(makeMision())),
      deleteDefinicion: vi.fn().mockReturnValue(of(undefined)),
      deleteFuncionario: vi.fn().mockReturnValue(of(undefined)),
      updateFuncionario: vi.fn().mockReturnValue(of(undefined)),
    };
  }

  async function setup(routeSection: 'catalogo' | 'personal-en-mision' = 'catalogo', hasPermiso = true) {
    misionesService = makeMisionesServiceSpy();
    paisesService = { getPaises: vi.fn().mockReturnValue(of([{ label: 'Uruguay', value: 'Uruguay' }])) };
    authService = { hasPermiso: vi.fn().mockReturnValue(hasPermiso) };
    toastService = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    router = { navigate: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [MisionesPage],
      imports: [ReactiveFormsModule, FormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: MisionesService, useValue: misionesService },
        { provide: PaisesService, useValue: paisesService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: routeSection } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisionesPage);
    component = fixture.componentInstance;
    // Se llama ngOnInit() directamente (sin fixture.detectChanges()) para no
    // renderizar el template: el filtro de misión usa <app-select> con
    // [ngModel] fuera de cualquier modal, y ese componente no está declarado
    // en este TestBed liviano. Ningún test de este archivo inspecciona el DOM.
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

    it('setea el tab según el dato de la ruta', async () => {
      await setup('personal-en-mision');
      expect(component.tab()).toBe('personal-en-mision');
    });

    it('carga los países', async () => {
      await setup();
      expect(paisesService.getPaises).toHaveBeenCalled();
      expect(component.paises()).toEqual([{ label: 'Uruguay', value: 'Uruguay' }]);
    });

    it('en tab catálogo, carga las definiciones (no el personal)', async () => {
      await setup('catalogo');
      expect(misionesService.findAllDefiniciones).toHaveBeenCalled();
      expect(misionesService.findFuncionariosConMisiones).not.toHaveBeenCalled();
    });

    it('en tab personal-en-mision, carga el personal y las opciones de misión (no el catálogo)', async () => {
      await setup('personal-en-mision');
      expect(misionesService.findFuncionariosConMisiones).toHaveBeenCalled();
      expect(misionesService.findMisionesOpciones).toHaveBeenCalled();
      expect(misionesService.findAllDefiniciones).not.toHaveBeenCalled();
    });
  });

  // ── Catálogo ───────────────────────────────────────────────────────────────

  describe('Catálogo', () => {
    beforeEach(() => setup('catalogo'));

    it('cargarDefiniciones llama al service con page/pageSize/nombre/pais', () => {
      component.cargarDefiniciones();
      expect(misionesService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, undefined, undefined);
    });

    it('cargarDefiniciones setea definiciones, total y stats', () => {
      const mision = makeMision({ id: '9' });
      misionesService.findAllDefiniciones.mockReturnValue(
        of({ items: [mision], total: 1, page: 1, pageSize: 10, stats: { total_misiones: 1, convocatorias_activas: 2, personal_desplegado: 3 } }),
      );
      component.cargarDefiniciones();
      expect(component.definiciones()).toEqual([mision]);
      expect(component.defTotal()).toBe(1);
      expect(component.stats()).toEqual({ total_misiones: 1, convocatorias_activas: 2, personal_desplegado: 3 });
    });

    it('cargarDefiniciones muestra toast de error si el service falla', () => {
      misionesService.findAllDefiniciones.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.cargarDefiniciones();
      expect(toastService.error).toHaveBeenCalled();
      expect(component.loadingDef()).toBe(false);
    });

    it('onNombreInput actualiza el filtro y recarga tras el debounce', () => {
      vi.useFakeTimers();
      component.onNombreInput('Congo');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      expect(component.filtroNombre()).toBe('Congo');
      expect(misionesService.findAllDefiniciones).toHaveBeenLastCalledWith(1, 10, 'Congo', undefined);
    });

    it('onPaisInput actualiza el filtro y recarga tras el debounce', () => {
      vi.useFakeTimers();
      component.onPaisInput('Chipre');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      expect(misionesService.findAllDefiniciones).toHaveBeenLastCalledWith(1, 10, undefined, 'Chipre');
    });

    it('hayFiltrosDef es true cuando hay nombre o país cargado', () => {
      component.filtroNombre.set('X');
      expect(component.hayFiltrosDef()).toBe(true);
    });

    it('hayFiltrosDef es false sin filtros', () => {
      component.filtroNombre.set('');
      component.filtroPais.set('');
      expect(component.hayFiltrosDef()).toBe(false);
    });

    it('limpiarFiltrosDef resetea filtros, página y recarga', () => {
      component.filtroNombre.set('X');
      component.filtroPais.set('Y');
      component.defPage.set(3);
      component.limpiarFiltrosDef();
      expect(component.filtroNombre()).toBe('');
      expect(component.filtroPais()).toBe('');
      expect(component.defPage()).toBe(1);
      expect(misionesService.findAllDefiniciones).toHaveBeenLastCalledWith(1, 10, undefined, undefined);
    });

    it('onDefPageChange cambia la página y recarga', () => {
      component.onDefPageChange(4);
      expect(component.defPage()).toBe(4);
      expect(misionesService.findAllDefiniciones).toHaveBeenLastCalledWith(4, 10, undefined, undefined);
    });

    it('verConvocatorias navega a /misiones/catalogo/:id y cierra el menú', () => {
      component.openMenuId.set('x');
      component.verConvocatorias(makeMision({ id: '77' }));
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo', '77']);
      expect(component.openMenuId()).toBeNull();
    });

    it('toggleMenu abre el menú con el id correcto', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 10, right: 20 }) } } as unknown as MouseEvent;
      component.toggleMenu('m1', mockEvent);
      expect(component.openMenuId()).toBe('m1');
    });

    it('toggleMenu cierra el menú si ya estaba abierto con el mismo id', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 10, right: 20 }) } } as unknown as MouseEvent;
      component.toggleMenu('m1', mockEvent);
      component.toggleMenu('m1', mockEvent);
      expect(component.openMenuId()).toBeNull();
    });

    it('trackDefinicion devuelve el id', () => {
      expect(component.trackDefinicion(0, makeMision({ id: 'zz' }))).toBe('zz');
    });
  });

  // ── Modal Nueva/Editar Misión ────────────────────────────────────────────────

  describe('Modal Nueva/Editar Misión', () => {
    beforeEach(() => setup('catalogo'));

    it('abrirNuevaMision limpia el formulario y abre el modal', () => {
      component.misionForm.patchValue({ nombre_mision: 'X', pais: 'Y' });
      component.abrirNuevaMision();
      expect(component.misionForm.value).toEqual({ nombre_mision: '', pais: '' });
      expect(component.modal()).toBe('nuevaMision');
      expect(component.misionSeleccionada()).toBeNull();
    });

    it('abrirEditar precarga el formulario con los datos de la misión', () => {
      const mision = makeMision({ nombre_mision: 'Haití', pais: 'Haití' });
      component.abrirEditar(mision);
      expect(component.misionForm.value).toEqual({ nombre_mision: 'Haití', pais: 'Haití' });
      expect(component.modal()).toBe('editarMision');
      expect(component.misionSeleccionada()).toEqual(mision);
    });

    it('misionForm es inválido sin nombre_mision', () => {
      component.misionForm.patchValue({ nombre_mision: '', pais: 'X' });
      expect(component.misionForm.invalid).toBe(true);
    });

    it('misionForm es inválido sin pais', () => {
      component.misionForm.patchValue({ nombre_mision: 'X', pais: '' });
      expect(component.misionForm.invalid).toBe(true);
    });

    it('guardarMision setea error si el formulario es inválido y no llama al service', () => {
      component.misionForm.patchValue({ nombre_mision: '', pais: '' });
      component.guardarMision();
      expect(component.modalError()).toBeTruthy();
      expect(misionesService.createDefinicion).not.toHaveBeenCalled();
    });

    it('guardarMision (creación) llama a createDefinicion con el payload correcto', () => {
      component.abrirNuevaMision();
      component.misionForm.patchValue({ nombre_mision: 'Líbano', pais: 'Líbano' });
      component.guardarMision();
      expect(misionesService.createDefinicion).toHaveBeenCalledWith({ nombre_mision: 'Líbano', pais: 'Líbano' });
    });

    it('guardarMision (creación) cierra el modal y muestra toast tras éxito', () => {
      component.abrirNuevaMision();
      component.misionForm.patchValue({ nombre_mision: 'X', pais: 'Y' });
      component.guardarMision();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarMision (creación) muestra error del backend sin cerrar el modal', () => {
      misionesService.createDefinicion.mockReturnValue(throwError(() => makeHttpError('nombre duplicado', 409)));
      component.abrirNuevaMision();
      component.misionForm.patchValue({ nombre_mision: 'X', pais: 'Y' });
      component.guardarMision();
      expect(component.modalError()).toContain('nombre duplicado');
      expect(component.modal()).toBe('nuevaMision');
    });

    it('guardarMision (edición) llama a editarDefinicion con el id correcto', () => {
      const mision = makeMision({ id: '42' });
      component.abrirEditar(mision);
      component.misionForm.patchValue({ nombre_mision: 'Nuevo', pais: 'Y' });
      component.guardarMision();
      expect(misionesService.editarDefinicion).toHaveBeenCalledWith('42', { nombre_mision: 'Nuevo', pais: 'Y' });
    });

    it('guardarMision (edición) cierra el modal, muestra toast y recarga', () => {
      component.abrirEditar(makeMision());
      component.misionForm.patchValue({ nombre_mision: 'X', pais: 'Y' });
      component.guardarMision();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(misionesService.findAllDefiniciones).toHaveBeenCalled();
    });

    it('guardarMision (edición) muestra error del backend sin cerrar el modal', () => {
      misionesService.editarDefinicion.mockReturnValue(throwError(() => makeHttpError('error')));
      component.abrirEditar(makeMision());
      component.misionForm.patchValue({ nombre_mision: 'X', pais: 'Y' });
      component.guardarMision();
      expect(component.modalError()).toBeTruthy();
      expect(component.modal()).toBe('editarMision');
    });

    it('cerrarModal limpia modal, error y selección', () => {
      component.modal.set('nuevaMision');
      component.modalError.set('err');
      component.misionSeleccionada.set(makeMision());
      component.cerrarModal();
      expect(component.modal()).toBeNull();
      expect(component.modalError()).toBeNull();
      expect(component.misionSeleccionada()).toBeNull();
    });
  });

  // ── Confirmar eliminar misión ──────────────────────────────────────────────

  describe('Confirmar eliminar misión', () => {
    beforeEach(() => setup('catalogo'));

    it('eliminarMision abre el modal de confirmación sin usar window.confirm', () => {
      const spy = vi.spyOn(window, 'confirm');
      component.eliminarMision(makeMision());
      expect(spy).not.toHaveBeenCalled();
      expect(component.modal()).toBe('confirmarEliminar');
    });

    it('confirmarEliminar llama al service con el id de la misión seleccionada', () => {
      component.misionSeleccionada.set(makeMision({ id: '5' }));
      component.confirmarEliminar();
      expect(misionesService.deleteDefinicion).toHaveBeenCalledWith('5');
    });

    it('confirmarEliminar cierra el modal y muestra toast tras éxito', () => {
      component.misionSeleccionada.set(makeMision({ nombre_mision: 'ABC' }));
      component.modal.set('confirmarEliminar');
      component.confirmarEliminar();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalledWith(expect.stringContaining('ABC'));
    });

    it('confirmarEliminar retrocede una página si era el último item de una página > 1', () => {
      component.definiciones.set([makeMision()]);
      component.misionSeleccionada.set(makeMision());
      component.defPage.set(2);
      component.confirmarEliminar();
      expect(misionesService.findAllDefiniciones).toHaveBeenLastCalledWith(1, 10, undefined, undefined);
    });

    it('confirmarEliminar muestra error en el modal si el service falla', () => {
      misionesService.deleteDefinicion.mockReturnValue(throwError(() => makeHttpError('tiene convocatorias')));
      component.misionSeleccionada.set(makeMision());
      component.modal.set('confirmarEliminar');
      component.confirmarEliminar();
      expect(component.modalError()).toContain('tiene convocatorias');
      expect(component.modal()).toBe('confirmarEliminar');
    });
  });

  // ── Personal en Misión: filtros ────────────────────────────────────────────

  describe('Personal en Misión — filtros', () => {
    beforeEach(async () => {
      await setup('personal-en-mision');
      const juan = makeFuncionario({
        id: 'f1',
        cedula: '11111111',
        nombre: 'Juan Pérez',
        misiones: [
          makeMisionItem({ id: 'm1', convocatoriaId: 'c1', nombre_mision: 'Congo', numero_orden: 'ORD-100', boletin: null, finalizada: false }),
          makeMisionItem({ id: 'm2', convocatoriaId: 'c2', nombre_mision: 'Chipre', numero_orden: null, boletin: 'BOL-9', finalizada: true }),
        ],
      });
      const ana = makeFuncionario({
        id: 'f2',
        cedula: '22222222',
        nombre: 'Ana García',
        misiones: [makeMisionItem({ id: 'm1', convocatoriaId: 'c3', nombre_mision: 'Congo', numero_orden: 'ORD-200', finalizada: false })],
      });
      component.funcionarios.set([juan, ana]);
    });

    it('sin filtros, filasFlat incluye todas las filas (una por misión de cada persona)', () => {
      expect(component.filasFlat()).toHaveLength(3);
    });

    it('filtra por búsqueda de cédula', () => {
      component.busquedaPersonal.set('1111');
      expect(component.filasFlat()).toHaveLength(2);
      expect(component.filasFlat().every((f) => f.cedula === '11111111')).toBe(true);
    });

    it('filtra por búsqueda de nombre (case-insensitive)', () => {
      component.busquedaPersonal.set('ana');
      expect(component.filasFlat()).toHaveLength(1);
      expect(component.filasFlat()[0].nombre).toBe('Ana García');
    });

    it('filtra por misión seleccionada (multiselect)', () => {
      component.misionesFiltroIds.set(['m2']);
      expect(component.filasFlat()).toHaveLength(1);
      expect(component.filasFlat()[0].mision.nombre_mision).toBe('Chipre');
    });

    it('filtra por varias misiones a la vez', () => {
      component.misionesFiltroIds.set(['m1', 'm2']);
      expect(component.filasFlat()).toHaveLength(3);
    });

    it('filtra por número de orden', () => {
      component.ordenBoletinFiltroPersonal.set('ORD-100');
      expect(component.filasFlat()).toHaveLength(1);
    });

    it('filtra por boletín', () => {
      component.ordenBoletinFiltroPersonal.set('bol-9');
      expect(component.filasFlat()).toHaveLength(1);
      expect(component.filasFlat()[0].mision.boletin).toBe('BOL-9');
    });

    it('filtra por estado activa', () => {
      component.estadoFiltroPersonal.set('activa');
      expect(component.filasFlat().every((f) => !f.mision.finalizada)).toBe(true);
      expect(component.filasFlat()).toHaveLength(2);
    });

    it('filtra por estado finalizada', () => {
      component.estadoFiltroPersonal.set('finalizada');
      expect(component.filasFlat()).toHaveLength(1);
      expect(component.filasFlat()[0].mision.finalizada).toBe(true);
    });

    it('combina varios filtros a la vez', () => {
      component.busquedaPersonal.set('juan');
      component.estadoFiltroPersonal.set('activa');
      expect(component.filasFlat()).toHaveLength(1);
      expect(component.filasFlat()[0].mision.nombre_mision).toBe('Congo');
    });

    it('hayFiltrosPersonal es true si hay algún filtro activo', () => {
      component.busquedaPersonal.set('x');
      expect(component.hayFiltrosPersonal()).toBe(true);
    });

    it('hayFiltrosPersonal es false sin filtros', () => {
      expect(component.hayFiltrosPersonal()).toBe(false);
    });

    it('limpiarFiltrosPersonal resetea todos los filtros y la página', () => {
      component.busquedaPersonal.set('x');
      component.misionesFiltroIds.set(['m1']);
      component.ordenBoletinFiltroPersonal.set('y');
      component.estadoFiltroPersonal.set('activa');
      component.personalPage.set(3);
      component.limpiarFiltrosPersonal();
      expect(component.busquedaPersonal()).toBe('');
      expect(component.misionesFiltroIds()).toEqual([]);
      expect(component.ordenBoletinFiltroPersonal()).toBe('');
      expect(component.estadoFiltroPersonal()).toBe('');
      expect(component.personalPage()).toBe(1);
    });

    it('onMisionFiltroChange acepta null y lo trata como array vacío', () => {
      component.onMisionFiltroChange(null);
      expect(component.misionesFiltroIds()).toEqual([]);
    });

    it('filasPaginadas respeta el tamaño de página', () => {
      component.personalPage.set(1);
      expect(component.filasPaginadas().length).toBeLessThanOrEqual(component.personalPageSize);
    });
  });

  // ── Personal en Misión: acciones (quitar/editar) ──────────────────────────

  describe('Personal en Misión — quitar', () => {
    beforeEach(() => setup('personal-en-mision'));

    const fila = () => ({
      funcionarioId: 'f1',
      cedula: '1',
      nombre: 'Juan',
      mision: makeMisionItem({ id: 'm1', convocatoriaId: 'c1' }),
    });

    it('abrirConfirmQuitarPersonal abre el modal sin usar window.confirm', () => {
      const spy = vi.spyOn(window, 'confirm');
      component.abrirConfirmQuitarPersonal(fila());
      expect(spy).not.toHaveBeenCalled();
      expect(component.modal()).toBe('confirmarQuitarPersonal');
      expect(component.filaAQuitar()).toEqual(fila());
    });

    it('confirmarQuitarPersonal llama a deleteFuncionario con misionId/convocatoriaId/personaId', () => {
      component.filaAQuitar.set(fila());
      component.confirmarQuitarPersonal();
      expect(misionesService.deleteFuncionario).toHaveBeenCalledWith('m1', 'c1', 'f1');
    });

    it('confirmarQuitarPersonal cierra el modal, muestra toast y recarga', () => {
      component.filaAQuitar.set(fila());
      component.modal.set('confirmarQuitarPersonal');
      component.confirmarQuitarPersonal();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(misionesService.findFuncionariosConMisiones).toHaveBeenCalled();
    });

    it('confirmarQuitarPersonal muestra toast de error si falla', () => {
      misionesService.deleteFuncionario.mockReturnValue(throwError(() => makeHttpError('error')));
      component.filaAQuitar.set(fila());
      component.confirmarQuitarPersonal();
      expect(toastService.error).toHaveBeenCalled();
      expect(component.quitando()).toBe(false);
    });

    it('confirmarQuitarPersonal no hace nada si no hay fila seleccionada', () => {
      component.filaAQuitar.set(null);
      component.confirmarQuitarPersonal();
      expect(misionesService.deleteFuncionario).not.toHaveBeenCalled();
    });
  });

  describe('Personal en Misión — editar', () => {
    beforeEach(() => setup('personal-en-mision'));

    const fila = () => ({
      funcionarioId: 'f1',
      cedula: '1',
      nombre: 'Juan',
      mision: makeMisionItem({ id: 'm1', convocatoriaId: 'c1', numero_orden: 'ORD-5', boletin: 'BOL-5', observaciones: 'nota' }),
    });

    it('abrirEditarFuncionarioPersonal precarga el formulario con los datos de la fila', () => {
      component.abrirEditarFuncionarioPersonal(fila());
      expect(component.editarFuncionarioForm.value).toEqual({ numero_orden: 'ORD-5', boletin: 'BOL-5', observaciones: 'nota' });
      expect(component.modal()).toBe('editarFuncionarioPersonal');
      expect(component.filaEditando()).toEqual(fila());
    });

    it('guardarEdicionFuncionarioPersonal setea error si faltan orden y boletín', () => {
      component.abrirEditarFuncionarioPersonal(fila());
      component.editarFuncionarioForm.patchValue({ numero_orden: '', boletin: '' });
      component.guardarEdicionFuncionarioPersonal();
      expect(component.modalError()).toBeTruthy();
      expect(misionesService.updateFuncionario).not.toHaveBeenCalled();
    });

    it('guardarEdicionFuncionarioPersonal llama a updateFuncionario con el payload correcto', () => {
      component.abrirEditarFuncionarioPersonal(fila());
      component.editarFuncionarioForm.patchValue({ numero_orden: 'ORD-9', boletin: '', observaciones: 'x' });
      component.guardarEdicionFuncionarioPersonal();
      expect(misionesService.updateFuncionario).toHaveBeenCalledWith('m1', 'c1', 'f1', {
        numero_orden: 'ORD-9',
        boletin: undefined,
        observaciones: 'x',
      });
    });

    it('guardarEdicionFuncionarioPersonal cierra el modal, muestra toast y recarga', () => {
      component.abrirEditarFuncionarioPersonal(fila());
      component.guardarEdicionFuncionarioPersonal();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(misionesService.findFuncionariosConMisiones).toHaveBeenCalled();
    });

    it('guardarEdicionFuncionarioPersonal muestra error si el backend falla', () => {
      misionesService.updateFuncionario.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.abrirEditarFuncionarioPersonal(fila());
      component.guardarEdicionFuncionarioPersonal();
      expect(component.modalError()).toBeTruthy();
      expect(component.guardandoFuncionarioPersonal()).toBe(false);
    });

    it('guardarEdicionFuncionarioPersonal no hace nada sin fila seleccionada', () => {
      component.filaEditando.set(null);
      component.guardarEdicionFuncionarioPersonal();
      expect(misionesService.updateFuncionario).not.toHaveBeenCalled();
    });

    it('filaKey arma la clave compuesta funcionarioId-convocatoriaId', () => {
      expect(component.filaKey(fila())).toBe('f1-c1');
    });

    it('trackFila arma la misma clave compuesta', () => {
      expect(component.trackFila(0, fila())).toBe('f1-c1');
    });
  });

  // ── parseError ─────────────────────────────────────────────────────────────

  describe('parseError (vía guardarMision)', () => {
    beforeEach(() => setup('catalogo'));

    const triggerError = (errBody: any, status: number) => {
      const err = new HttpErrorResponse({ error: errBody, status });
      misionesService.createDefinicion.mockReturnValue(throwError(() => err));
      component.abrirNuevaMision();
      component.misionForm.patchValue({ nombre_mision: 'X', pais: 'Y' });
      component.guardarMision();
      return component.modalError();
    };

    it('extrae message string del cuerpo del error', () => {
      expect(triggerError({ message: 'nombre duplicado' }, 400)).toBe('nombre duplicado');
    });

    it('extrae el primer elemento si message es un array', () => {
      expect(triggerError({ message: ['campo requerido', 'otro'] }, 400)).toBe('campo requerido');
    });

    it('usa el body como string si es un string directo', () => {
      expect(triggerError('error de servidor', 500)).toBe('error de servidor');
    });

    it('mensaje amigable para 409 sin message', () => {
      expect(triggerError(null, 409)).toBe('Ya existe una misión con ese nombre.');
    });

    it('mensaje amigable para 404 sin message', () => {
      expect(triggerError(null, 404)).toBe('El recurso no fue encontrado.');
    });

    it('mensaje amigable para 403 sin message', () => {
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
      await setup('catalogo', true);
      expect(component.puedeGestionar()).toBe(true);
    });

    it('es false si el service devuelve false', async () => {
      await setup('catalogo', false);
      expect(component.puedeGestionar()).toBe(false);
    });

    it('llama a hasPermiso con "misiones.gestionar"', async () => {
      await setup();
      component.puedeGestionar();
      expect(authService.hasPermiso).toHaveBeenCalledWith('misiones.gestionar');
    });
  });
});
