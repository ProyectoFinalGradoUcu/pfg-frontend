import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { CursosPage } from './cursos-page';
import { CursosService } from '../../../../core/services/cursos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CursoDefinicion,
  CursoFuncionarioItem,
  FuncionarioConCursos,
  ModuloCurso,
} from '../../../../core/models/cursos.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCurso(overrides: Partial<CursoDefinicion> = {}): CursoDefinicion {
  return {
    id: '1',
    nombre_curso: 'Curso Test',
    institucion: 'Inst Test',
    es_obligatorio: false,
    modulos: [],
    ...overrides,
  };
}

function makeModulo(overrides: Partial<ModuloCurso> = {}): ModuloCurso {
  return { id: 'm1', nombre: 'Módulo A', orden: 1, descripcion: null, ...overrides };
}

function makeCursoFuncionario(overrides: Partial<CursoFuncionarioItem> = {}): CursoFuncionarioItem {
  return {
    id: 'c1',
    designacionId: 'd1',
    nombre_curso: 'Curso Test',
    institucion: 'Inst Test',
    tipo: 'optativo',
    fechaInicio: '2025-01-01',
    fechaFin: '2025-06-01',
    aprobado: null,
    calificacion: null,
    observacion: null,
    ...overrides,
  };
}

function makeFuncionario(overrides: Partial<FuncionarioConCursos> = {}): FuncionarioConCursos {
  return { id: 'f1', cedula: '12345678', nombre: 'Juan Pérez', cursos: [], ...overrides };
}

function makePaginated<T>(items: T[], total = items.length) {
  return { items, total, page: 1, pageSize: 10 };
}

function makeHttpError(message: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { message }, status });
}

// ── Spec ───────────────────────────────────────────────────────────────────────

describe('CursosPage', () => {
  let component: CursosPage;
  let fixture: ComponentFixture<CursosPage>;
  let cursosService: ReturnType<typeof makeCursosServiceSpy>;
  let personalService: { findAll: ReturnType<typeof vi.fn> };
  let authService: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  function makeCursosServiceSpy() {
    return {
      findFuncionariosConCursos: vi.fn().mockReturnValue(of([])),
      findAllDefiniciones: vi.fn().mockReturnValue(of(makePaginated([]))),
      createHistorial: vi.fn().mockReturnValue(of({})),
      createDefinicion: vi.fn().mockReturnValue(of(makeCurso())),
      editarCurso: vi.fn().mockReturnValue(of(makeCurso())),
      deleteDefinicion: vi.fn().mockReturnValue(of(undefined)),
      createModulo: vi.fn().mockReturnValue(of(makeModulo())),
      deleteModulo: vi.fn().mockReturnValue(of(undefined)),
      crearDesignacion: vi.fn().mockReturnValue(of({ personas_designadas: 1 })),
      registrarCalificacion: vi.fn().mockReturnValue(of({ id: 'x', curso_id: 'c1', persona_id: 'f1', aprobado: true, calificacion: 8, observacion: null })),
    };
  }

  async function setup(routeSection: 'catalogo' | 'inscripciones' = 'catalogo', hasPermiso = true) {
    cursosService = makeCursosServiceSpy();
    personalService = { findAll: vi.fn().mockReturnValue(of([])) };
    authService = { hasPermiso: vi.fn().mockReturnValue(hasPermiso) };
    toastService = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [CursosPage],
      imports: [ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: CursosService, useValue: cursosService },
        { provide: PersonalService, useValue: personalService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: routeSection } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CursosPage);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  describe('inicialización', () => {
    it('crea el componente', async () => {
      await setup();
      expect(component).toBeTruthy();
    });

    it('setea el tab según el dato de la ruta', async () => {
      await setup('inscripciones');
      expect(component.tab()).toBe('inscripciones');
    });

    it('llama a findFuncionariosConCursos y findAllDefiniciones en ngOnInit', async () => {
      await setup();
      expect(cursosService.findFuncionariosConCursos).toHaveBeenCalled();
      expect(cursosService.findAllDefiniciones).toHaveBeenCalled();
    });

    it('llama a findAll de PersonalService en ngOnInit', async () => {
      await setup();
      expect(personalService.findAll).toHaveBeenCalled();
    });
  });

  // ── CursosListComponent (Catálogo) ─────────────────────────────────────────

  describe('Catálogo — lista de definiciones', () => {
    beforeEach(() => setup());

    it('carga las definiciones al iniciar', () => {
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, undefined, undefined, undefined);
    });

    it('definiciones() está vacío si el service devuelve lista vacía', () => {
      expect(component.definiciones()).toHaveLength(0);
    });

    it('definiciones() contiene los items devueltos por el service', async () => {
      const curso = makeCurso();
      cursosService.findAllDefiniciones.mockReturnValue(of(makePaginated([curso])));
      component.cargarDefiniciones();
      expect(component.definiciones()).toEqual([curso]);
    });

    it('filtra por nombre: llama al service con el nombre correcto', () => {
      vi.useFakeTimers();
      component.onNombreInput('javascript');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, 'javascript', undefined, undefined);
    });

    it('filtra por institución: llama al service con la institución correcta', () => {
      vi.useFakeTimers();
      component.onInstitucionInput('UCU');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, undefined, 'UCU', undefined);
    });

    it('filtra por tipo obligatorio', () => {
      component.onTipoFilterChange('true');
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, undefined, undefined, true);
    });

    it('filtra por tipo optativo', () => {
      component.onTipoFilterChange('false');
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, undefined, undefined, false);
    });

    it('filtra combinando nombre, institución y tipo', () => {
      vi.useFakeTimers();
      component.filtroNombre.set('cursoX');
      component.filtroInstitucion.set('UCU');
      component.onTipoFilterChange('true');
      vi.advanceTimersByTime(400);
      vi.useRealTimers();
      const calls = cursosService.findAllDefiniciones.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toBe('cursoX');
      expect(lastCall[3]).toBe('UCU');
      expect(lastCall[4]).toBe(true);
    });

    it('limpiarFiltrosDef resetea los filtros y recarga', () => {
      component.filtroNombre.set('algo');
      component.filtroInstitucion.set('UCU');
      component.filtroTipo.set('true');
      component.limpiarFiltrosDef();
      expect(component.filtroNombre()).toBe('');
      expect(component.filtroInstitucion()).toBe('');
      expect(component.filtroTipo()).toBe('');
      expect(component.defPage()).toBe(1);
    });

    it('hayFiltrosDef es true cuando hay algún filtro activo', () => {
      component.filtroNombre.set('X');
      expect(component.hayFiltrosDef()).toBe(true);
    });

    it('hayFiltrosDef es false cuando todos los filtros están vacíos', () => {
      component.filtroNombre.set('');
      component.filtroInstitucion.set('');
      component.filtroTipo.set('');
      expect(component.hayFiltrosDef()).toBe(false);
    });

    it('onDefPageChange cambia la página y recarga definiciones', () => {
      component.onDefPageChange(3);
      expect(component.defPage()).toBe(3);
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(3, 10, undefined, undefined, undefined);
    });

    it('abrirNuevoCurso setea modal a "nuevoCurso" y limpia errores', () => {
      component.modalError.set('error previo');
      component.abrirNuevoCurso();
      expect(component.modal()).toBe('nuevoCurso');
      expect(component.modalError()).toBeNull();
    });

    it('abrirNuevoCurso resetea el formulario con toggle en false', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'X', es_obligatorio: true });
      component.abrirNuevoCurso();
      expect(component.nuevoCursoForm.value.nombre_curso).toBe('');
      expect(component.nuevoCursoForm.value.es_obligatorio).toBe(false);
    });

    it('toggleMenu abre el menú con el id correcto', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 100, right: 200 }) } } as unknown as MouseEvent;
      component.toggleMenu('curso-1', mockEvent);
      expect(component.openMenuId()).toBe('curso-1');
    });

    it('toggleMenu cierra el menú si el mismo id está abierto', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 100, right: 200 }) } } as unknown as MouseEvent;
      component.toggleMenu('curso-1', mockEvent);
      component.toggleMenu('curso-1', mockEvent);
      expect(component.openMenuId()).toBeNull();
    });

    it('cerrarMenu limpia openMenuId y menuPosition', () => {
      component.openMenuId.set('x');
      component.menuPosition.set({ top: 10, right: 20 });
      component.cerrarMenu();
      expect(component.openMenuId()).toBeNull();
      expect(component.menuPosition()).toBeNull();
    });

    it('abrirModulos setea el curso seleccionado y abre el modal', () => {
      const curso = makeCurso({ id: '5' });
      component.abrirModulos(curso);
      expect(component.cursoSeleccionado()).toEqual(curso);
      expect(component.modal()).toBe('modulos');
    });

    it('abrirDesignar setea el curso seleccionado y abre el modal', () => {
      const curso = makeCurso({ id: '7' });
      component.abrirDesignar(curso);
      expect(component.cursoSeleccionado()).toEqual(curso);
      expect(component.modal()).toBe('designar');
    });

    it('abrirEditar precarga nombre, institución y toggle en el formulario', () => {
      const curso = makeCurso({ nombre_curso: 'Mi Curso', institucion: 'Mi Inst', es_obligatorio: true });
      component.abrirEditar(curso);
      expect(component.editarForm.value.nombre_curso).toBe('Mi Curso');
      expect(component.editarForm.value.institucion).toBe('Mi Inst');
      expect(component.editarForm.value.es_obligatorio).toBe(true);
    });

    it('eliminarCurso abre el modal confirmarEliminar sin usar window.confirm', () => {
      const spy = vi.spyOn(window, 'confirm');
      component.eliminarCurso(makeCurso());
      expect(spy).not.toHaveBeenCalled();
      expect(component.modal()).toBe('confirmarEliminar');
    });

    it('eliminarCurso setea el curso seleccionado en el modal', () => {
      const curso = makeCurso({ id: '99', nombre_curso: 'ABC' });
      component.eliminarCurso(curso);
      expect(component.cursoSeleccionado()).toEqual(curso);
    });

    it('eliminarCurso NO llama al service directamente', () => {
      component.eliminarCurso(makeCurso());
      expect(cursosService.deleteDefinicion).not.toHaveBeenCalled();
    });

    it('cerrarModal limpia modal, error y cursoSeleccionado', () => {
      component.modal.set('nuevoCurso');
      component.modalError.set('err');
      component.cursoSeleccionado.set(makeCurso());
      component.cerrarModal();
      expect(component.modal()).toBeNull();
      expect(component.modalError()).toBeNull();
      expect(component.cursoSeleccionado()).toBeNull();
    });
  });

  // ── NuevoCurso / EditarCurso Modal ─────────────────────────────────────────

  describe('NuevoCurso modal', () => {
    beforeEach(() => setup());

    it('el formulario es inválido si falta nombre_curso', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: '', institucion: 'UCU' });
      expect(component.nuevoCursoForm.invalid).toBe(true);
    });

    it('el formulario es inválido si falta institución', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Curso', institucion: '' });
      expect(component.nuevoCursoForm.invalid).toBe(true);
    });

    it('el formulario es válido con nombre e institución', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Curso', institucion: 'UCU' });
      expect(component.nuevoCursoForm.valid).toBe(true);
    });

    it('togglear es_obligatorio cambia el valor del form', () => {
      expect(component.nuevoCursoForm.value.es_obligatorio).toBe(false);
      component.nuevoCursoForm.patchValue({ es_obligatorio: true });
      expect(component.nuevoCursoForm.value.es_obligatorio).toBe(true);
    });

    it('guardarNuevoCurso setea modalError si el formulario es inválido', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: '', institucion: '' });
      component.guardarNuevoCurso();
      expect(component.modalError()).toBeTruthy();
      expect(cursosService.createDefinicion).not.toHaveBeenCalled();
    });

    it('guardarNuevoCurso llama a createDefinicion con el payload correcto', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Mi Curso', institucion: 'UCU', es_obligatorio: true });
      component.guardarNuevoCurso();
      expect(cursosService.createDefinicion).toHaveBeenCalledWith({
        nombre_curso: 'Mi Curso',
        institucion: 'UCU',
        es_obligatorio: true,
      });
    });

    it('guardarNuevoCurso cierra el modal y emite toast tras éxito', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Mi Curso', institucion: 'UCU' });
      component.guardarNuevoCurso();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarNuevoCurso muestra error del backend sin cerrar el modal', () => {
      cursosService.createDefinicion.mockReturnValue(throwError(() => makeHttpError('nombre duplicado')));
      component.abrirNuevoCurso();
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Mi Curso', institucion: 'UCU' });
      component.guardarNuevoCurso();
      expect(component.modalError()).toContain('nombre duplicado');
      expect(component.modal()).toBe('nuevoCurso');
    });

    it('guardarNuevoCurso con designar_ahora y sin personas setea error', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'X', institucion: 'Y', designar_ahora: true, persona_ids: [] });
      component.guardarNuevoCurso();
      expect(component.modalError()).toContain('Seleccioná al menos una persona');
      expect(cursosService.createDefinicion).not.toHaveBeenCalled();
    });

    it('guardarNuevoCurso con designar_ahora y sin fechas setea error', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'X', institucion: 'Y', designar_ahora: true, persona_ids: ['1'], fecha_inicio: '', fecha_fin: '' });
      component.guardarNuevoCurso();
      expect(component.modalError()).toBeTruthy();
      expect(cursosService.createDefinicion).not.toHaveBeenCalled();
    });

    it('cerrarModal sin guardar no llama al service', () => {
      component.modal.set('nuevoCurso');
      component.cerrarModal();
      expect(cursosService.createDefinicion).not.toHaveBeenCalled();
    });
  });

  describe('EditarCurso modal', () => {
    beforeEach(() => setup());

    it('al editar, el formulario arranca con los datos del curso', () => {
      const curso = makeCurso({ nombre_curso: 'Nombre orig', institucion: 'Inst orig', es_obligatorio: true });
      component.abrirEditar(curso);
      expect(component.editarForm.value).toMatchObject({ nombre_curso: 'Nombre orig', institucion: 'Inst orig', es_obligatorio: true });
    });

    it('el formulario de editar es inválido si falta nombre', () => {
      component.abrirEditar(makeCurso());
      component.editarForm.patchValue({ nombre_curso: '' });
      expect(component.editarForm.invalid).toBe(true);
    });

    it('guardarEditar llama a editarCurso con el payload correcto', () => {
      const curso = makeCurso({ id: '42' });
      component.abrirEditar(curso);
      component.editarForm.patchValue({ nombre_curso: 'Nuevo Nombre', institucion: 'Nueva Inst', es_obligatorio: true });
      component.guardarEditar();
      expect(cursosService.editarCurso).toHaveBeenCalledWith('42', { nombre_curso: 'Nuevo Nombre', institucion: 'Nueva Inst', es_obligatorio: true });
    });

    it('guardarEditar cierra el modal y muestra toast', () => {
      component.abrirEditar(makeCurso());
      component.editarForm.patchValue({ nombre_curso: 'X', institucion: 'Y' });
      component.guardarEditar();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarEditar muestra error del backend sin cerrar el modal', () => {
      cursosService.editarCurso.mockReturnValue(throwError(() => makeHttpError('nombre duplicado')));
      component.abrirEditar(makeCurso());
      component.editarForm.patchValue({ nombre_curso: 'X', institucion: 'Y' });
      component.guardarEditar();
      expect(component.modalError()).toContain('nombre duplicado');
      expect(component.modal()).toBe('editar');
    });

    it('guardarEditar actualiza la definición en la lista local', () => {
      const curso = makeCurso({ id: 'u1', nombre_curso: 'Viejo' });
      const actualizado = makeCurso({ id: 'u1', nombre_curso: 'Nuevo' });
      component.definiciones.set([curso]);
      cursosService.editarCurso.mockReturnValue(of(actualizado));
      component.abrirEditar(curso);
      component.editarForm.patchValue({ nombre_curso: 'Nuevo', institucion: 'Inst Test' });
      component.guardarEditar();
      expect(component.definiciones()[0].nombre_curso).toBe('Nuevo');
    });

    it('guardarEditar setea error backend en el control nombre_curso', () => {
      cursosService.editarCurso.mockReturnValue(throwError(() => makeHttpError('nombre duplicado')));
      component.abrirEditar(makeCurso());
      component.editarForm.patchValue({ nombre_curso: 'X', institucion: 'Y' });
      component.guardarEditar();
      expect(component.editarForm.controls.nombre_curso.errors?.['backend']).toContain('nombre duplicado');
    });
  });

  // ── ConfirmarEliminar Modal ────────────────────────────────────────────────

  describe('ConfirmarEliminar modal', () => {
    beforeEach(() => setup());

    it('confirmarEliminar llama al service con el id del curso', () => {
      component.cursoSeleccionado.set(makeCurso({ id: '99' }));
      component.confirmarEliminar();
      expect(cursosService.deleteDefinicion).toHaveBeenCalledWith('99');
    });

    it('confirmarEliminar cierra el modal y muestra toast tras éxito', () => {
      component.cursoSeleccionado.set(makeCurso({ nombre_curso: 'ABC' }));
      component.modal.set('confirmarEliminar');
      component.confirmarEliminar();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalledWith(expect.stringContaining('ABC'));
    });

    it('confirmarEliminar recarga las definiciones tras éxito', () => {
      component.cursoSeleccionado.set(makeCurso());
      component.confirmarEliminar();
      expect(cursosService.findAllDefiniciones).toHaveBeenCalled();
    });

    it('confirmarEliminar muestra error en el modal si el service falla', () => {
      cursosService.deleteDefinicion.mockReturnValue(throwError(() => makeHttpError('tiene designaciones activas')));
      component.cursoSeleccionado.set(makeCurso());
      component.modal.set('confirmarEliminar');
      component.confirmarEliminar();
      expect(component.modalError()).toContain('tiene designaciones activas');
      expect(component.modal()).toBe('confirmarEliminar');
    });

    it('cursoTieneDesignados es true si hay funcionarios con ese curso', () => {
      const curso = makeCurso({ id: 'c1' });
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario({ id: 'c1' })] })]);
      component.cursoSeleccionado.set(curso);
      expect(component.cursoTieneDesignados()).toBe(true);
    });

    it('cursoTieneDesignados es false si no hay funcionarios con ese curso', () => {
      const curso = makeCurso({ id: 'c99' });
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario({ id: 'c1' })] })]);
      component.cursoSeleccionado.set(curso);
      expect(component.cursoTieneDesignados()).toBe(false);
    });

    it('cursoTieneDesignados es false si no hay ningún funcionario', () => {
      component.funcionarios.set([]);
      component.cursoSeleccionado.set(makeCurso());
      expect(component.cursoTieneDesignados()).toBe(false);
    });

    it('cancelar cierra sin llamar al service', () => {
      component.cursoSeleccionado.set(makeCurso());
      component.modal.set('confirmarEliminar');
      component.cerrarModal();
      expect(cursosService.deleteDefinicion).not.toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });
  });

  // ── Error backend en campo nombre_curso ────────────────────────────────────

  describe('error backend en campo nombre_curso', () => {
    beforeEach(() => setup());

    it('guardarNuevoCurso setea error backend en el control nombre_curso', () => {
      cursosService.createDefinicion.mockReturnValue(throwError(() => makeHttpError('nombre duplicado')));
      component.abrirNuevoCurso();
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Existente', institucion: 'UCU' });
      component.guardarNuevoCurso();
      expect(component.nuevoCursoForm.controls.nombre_curso.errors?.['backend']).toContain('nombre duplicado');
    });

    it('el error backend en nombre_curso se limpia al abrir el modal de nuevo', () => {
      component.nuevoCursoForm.controls.nombre_curso.setErrors({ backend: 'nombre duplicado' });
      component.abrirNuevoCurso();
      expect(component.nuevoCursoForm.controls.nombre_curso.errors?.['backend']).toBeUndefined();
    });
  });

  // ── Modulos Modal ──────────────────────────────────────────────────────────

  describe('ModulosModal', () => {
    beforeEach(() => setup());

    it('muestra lista vacía cuando el curso no tiene módulos', () => {
      const curso = makeCurso({ modulos: [] });
      component.abrirModulos(curso);
      expect(component.cursoSeleccionado()?.modulos).toHaveLength(0);
    });

    it('lista los módulos del curso seleccionado', () => {
      const modulo = makeModulo();
      const curso = makeCurso({ modulos: [modulo] });
      component.abrirModulos(curso);
      expect(component.cursoSeleccionado()?.modulos).toContain(modulo);
    });

    it('moduloForm es inválido si nombre está vacío', () => {
      component.moduloForm.patchValue({ nombre: '' });
      expect(component.moduloForm.invalid).toBe(true);
    });

    it('moduloForm es válido con nombre; descripción puede estar vacía', () => {
      component.moduloForm.patchValue({ nombre: 'Módulo 1', descripcion: '' });
      expect(component.moduloForm.valid).toBe(true);
    });

    it('agregarModulo sin nombre setea modalError', () => {
      component.abrirModulos(makeCurso());
      component.moduloForm.patchValue({ nombre: '' });
      component.agregarModulo();
      expect(component.modalError()).toBeTruthy();
      expect(cursosService.createModulo).not.toHaveBeenCalled();
    });

    it('agregarModulo llama al service con el payload correcto', () => {
      const curso = makeCurso({ id: 'c9', modulos: [] });
      component.abrirModulos(curso);
      component.moduloForm.patchValue({ nombre: 'Módulo 1', descripcion: 'Desc' });
      component.agregarModulo();
      expect(cursosService.createModulo).toHaveBeenCalledWith('c9', {
        nombre_modulo: 'Módulo 1',
        orden_modulo: 1,
        descripcion: 'Desc',
      });
    });

    it('agregarModulo agrega el módulo a la lista sin cerrar el modal', () => {
      const curso = makeCurso({ id: 'c9', modulos: [] });
      const nuevoModulo = makeModulo({ id: 'm99', nombre: 'Nuevo' });
      cursosService.createModulo.mockReturnValue(of(nuevoModulo));
      component.abrirModulos(curso);
      component.modal.set('modulos');
      component.moduloForm.patchValue({ nombre: 'Nuevo', descripcion: '' });
      component.agregarModulo();
      expect(component.cursoSeleccionado()?.modulos).toContain(nuevoModulo);
      expect(component.modal()).toBe('modulos');
    });

    it('agregarModulo limpia el formulario tras éxito', () => {
      const curso = makeCurso({ modulos: [] });
      cursosService.createModulo.mockReturnValue(of(makeModulo()));
      component.abrirModulos(curso);
      component.moduloForm.patchValue({ nombre: 'M', descripcion: 'D' });
      component.agregarModulo();
      expect(component.moduloForm.value.nombre).toBe('');
    });

    it('agregarModulo muestra error del backend', () => {
      const curso = makeCurso({ modulos: [] });
      cursosService.createModulo.mockReturnValue(throwError(() => makeHttpError('error backend')));
      component.abrirModulos(curso);
      component.moduloForm.patchValue({ nombre: 'M' });
      component.agregarModulo();
      expect(component.modalError()).toContain('error backend');
    });
  });

  // ── Designar / Dictar Modal ────────────────────────────────────────────────

  describe('DesignarDictarModal', () => {
    beforeEach(() => setup());

    const openDesignar = () => {
      const curso = makeCurso({ id: 'cd1', modulos: [makeModulo({ id: 'mod1' })] });
      component.abrirDesignar(curso);
      return curso;
    };

    it('guardarDesignar setea error si faltan ambas fechas', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', boletin: '', persona_ids: ['1'], fecha_inicio: '', fecha_fin: '' });
      component.guardarDesignar();
      expect(component.modalError()).toContain('fecha');
      expect(cursosService.crearDesignacion).not.toHaveBeenCalled();
    });

    it('guardarDesignar setea error si faltan N° Orden y Boletín', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: '', boletin: '', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(component.modalError()).toContain('orden');
      expect(cursosService.crearDesignacion).not.toHaveBeenCalled();
    });

    it('guardarDesignar se habilita si solo hay N° Orden (sin Boletín)', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', boletin: '', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(cursosService.crearDesignacion).toHaveBeenCalled();
    });

    it('guardarDesignar se habilita si solo hay Boletín (sin N° Orden)', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: '', boletin: 'B1', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(cursosService.crearDesignacion).toHaveBeenCalled();
    });

    it('guardarDesignar setea error si no hay personas seleccionadas', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', boletin: '', persona_ids: [], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(component.modalError()).toContain('persona');
      expect(cursosService.crearDesignacion).not.toHaveBeenCalled();
    });

    it('el multi-select permite varias personas', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', persona_ids: ['1', '2', '3'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      const call = cursosService.crearDesignacion.mock.calls[0];
      expect(call[1].persona_ids).toEqual([1, 2, 3]);
    });

    it('guardarDesignar envía el payload correcto', () => {
      openDesignar();
      component.designarForm.patchValue({
        numero_orden: 'N1', boletin: 'B1',
        fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01',
        persona_ids: ['10'],
      });
      component.guardarDesignar();
      expect(cursosService.crearDesignacion).toHaveBeenCalledWith('cd1', expect.objectContaining({
        persona_ids: [10],
        numero_orden: 'N1',
        boletin: 'B1',
        fecha_inicio: '2025-01-01',
        fecha_fin: '2025-06-01',
      }));
    });

    it('guardarDesignar cierra el modal y muestra toast tras éxito', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarDesignar muestra error si el backend rechaza la designación', () => {
      cursosService.crearDesignacion.mockReturnValue(throwError(() => makeHttpError('ya designado')));
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(component.modalError()).toContain('ya designado');
      expect(component.modal()).toBe('designar');
    });

    it('toggleModuloDesignar agrega y quita módulos correctamente', () => {
      openDesignar();
      component.toggleModuloDesignar('mod1');
      expect(component.designarForm.value.modulo_ids).toContain('mod1');
      component.toggleModuloDesignar('mod1');
      expect(component.designarForm.value.modulo_ids).not.toContain('mod1');
    });

    it('moduloSeleccionado devuelve true cuando el módulo está seleccionado', () => {
      openDesignar();
      component.designarForm.patchValue({ modulo_ids: ['mod1'] });
      expect(component.moduloSeleccionado('mod1')).toBe(true);
    });
  });

  // ── Inscripciones ──────────────────────────────────────────────────────────

  describe('InscripcionesListComponent', () => {
    beforeEach(() => setup('inscripciones'));

    it('carga los funcionarios y los contadores al iniciar', () => {
      expect(cursosService.findFuncionariosConCursos).toHaveBeenCalled();
    });

    it('completados cuenta filas con resultado cargado', () => {
      component.funcionarios.set([
        makeFuncionario({ cursos: [makeCursoFuncionario({ aprobado: true, calificacion: 8 }), makeCursoFuncionario({ id: 'c2', designacionId: 'd2', aprobado: null })] }),
      ]);
      expect(component.completados()).toBe(1);
    });

    it('enCurso cuenta filas sin resultado', () => {
      component.funcionarios.set([
        makeFuncionario({ cursos: [makeCursoFuncionario({ aprobado: null }), makeCursoFuncionario({ id: 'c2', designacionId: 'd2', aprobado: false, calificacion: 3 })] }),
      ]);
      expect(component.enCurso()).toBe(1);
    });

    it('obligatorios cuenta filas con tipo === "obligatorio"', () => {
      component.funcionarios.set([
        makeFuncionario({ cursos: [makeCursoFuncionario({ tipo: 'obligatorio' }), makeCursoFuncionario({ id: 'c2', designacionId: 'd2', tipo: 'optativo' })] }),
      ]);
      expect(component.obligatorios()).toBe(1);
    });

    it('filtroCedula: onCedulaInput actualiza el signal', () => {
      component.onCedulaInput('123');
      expect(component.cedulaFiltro()).toBe('123');
    });

    it('limpiarCedula resetea el filtro de cédula', () => {
      component.cedulaFiltro.set('99');
      component.limpiarCedula();
      expect(component.cedulaFiltro()).toBe('');
    });

    it('filasPaginadas devuelve los primeros N items', () => {
      const cursos = Array.from({ length: 15 }, (_, i) =>
        makeCursoFuncionario({ id: `c${i}`, designacionId: `d${i}` })
      );
      component.funcionarios.set([makeFuncionario({ cursos })]);
      component.historialPage.set(1);
      expect(component.filasPaginadas()).toHaveLength(10);
    });

    it('filasPaginadas devuelve el resto en la segunda página', () => {
      const cursos = Array.from({ length: 15 }, (_, i) =>
        makeCursoFuncionario({ id: `c${i}`, designacionId: `d${i}` })
      );
      component.funcionarios.set([makeFuncionario({ cursos })]);
      component.historialPage.set(2);
      expect(component.filasPaginadas()).toHaveLength(5);
    });

    it('cursoTerminado es true si fechaFin es anterior a hoy', () => {
      const curso = makeCursoFuncionario({ fechaFin: '2020-01-01' });
      expect(component.cursoTerminado(curso)).toBe(true);
    });

    it('cursoTerminado es false si fechaFin es futura', () => {
      const curso = makeCursoFuncionario({ fechaFin: '2099-12-31' });
      expect(component.cursoTerminado(curso)).toBe(false);
    });

    it('cursoTerminado es false si no hay fechaFin', () => {
      const curso = makeCursoFuncionario({ fechaFin: '' });
      expect(component.cursoTerminado(curso)).toBe(false);
    });

    it('iniciarCalificacion abre el modal sin resultado ni nota precargados', () => {
      const fila = { funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() };
      component.iniciarCalificacion(fila);
      expect(component.modal()).toBe('calificar');
      expect(component.filaCalificando()).toEqual(fila);
      expect(component.aprobadoValor()).toBeNull();
      expect(component.calificacionValor()).toBeNull();
      expect(component.observacionValor()).toBe('');
    });

    it('cerrarModal limpia la fila que se estaba calificando', () => {
      const fila = { funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() };
      component.iniciarCalificacion(fila);
      component.cerrarModal();
      expect(component.modal()).toBeNull();
      expect(component.filaCalificando()).toBeNull();
    });

    it('guardarCalificacion envía el resultado con la nota y actualiza la celda', () => {
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario()] })]);
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(true);
      component.calificacionValor.set(8);
      component.guardarCalificacion();
      expect(cursosService.registrarCalificacion).toHaveBeenCalledWith('c1', 'd1', { aprobado: true, calificacion: 8 });
      expect(component.funcionarios()[0].cursos[0].aprobado).toBe(true);
    });

    it('guardarCalificacion envía el resultado sin nota — la calificación es opcional', () => {
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario()] })]);
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(false);
      component.guardarCalificacion();
      expect(cursosService.registrarCalificacion).toHaveBeenCalledWith('c1', 'd1', { aprobado: false });
    });

    it('guardarCalificacion incluye la observación cuando se cargó', () => {
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario()] })]);
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(false);
      component.observacionValor.set('No alcanzó la asistencia');
      component.guardarCalificacion();
      expect(cursosService.registrarCalificacion).toHaveBeenCalledWith('c1', 'd1', {
        aprobado: false,
        observacion: 'No alcanzó la asistencia',
      });
    });

    it('guardarCalificacion sin resultado no llama al service y muestra el error en el modal', () => {
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.calificacionValor.set(8);
      component.guardarCalificacion();
      expect(cursosService.registrarCalificacion).not.toHaveBeenCalled();
      expect(component.modalError()).toBeTruthy();
      expect(component.modal()).toBe('calificar');
    });

    it('guardarCalificacion con nota 0 no llama al service', () => {
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(true);
      component.calificacionValor.set(0);
      component.guardarCalificacion();
      expect(cursosService.registrarCalificacion).not.toHaveBeenCalled();
      expect(component.modalError()).toBeTruthy();
    });

    it('guardarCalificacion con nota 11 no llama al service', () => {
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(true);
      component.calificacionValor.set(11);
      component.guardarCalificacion();
      expect(cursosService.registrarCalificacion).not.toHaveBeenCalled();
    });

    it('guardarCalificacion cierra el modal tras éxito', () => {
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario()] })]);
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(true);
      component.calificacionValor.set(9);
      component.guardarCalificacion();
      expect(component.modal()).toBeNull();
      expect(component.filaCalificando()).toBeNull();
    });

    it('guardarCalificacion deja el modal abierto con el error si el backend falla', () => {
      cursosService.registrarCalificacion.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario()] })]);
      component.iniciarCalificacion({ funcionarioId: 'f1', cedula: '123', nombre: 'Juan', curso: makeCursoFuncionario() });
      component.aprobadoValor.set(true);
      component.guardarCalificacion();
      expect(component.modal()).toBe('calificar');
      expect(component.modalError()).toBeTruthy();
    });
  });

  // ── CalificacionMasivaModal ────────────────────────────────────────────────

  describe('CalificacionMasivaModal', () => {
    beforeEach(async () => {
      await setup();
      // Cargar funcionarios con cursos terminados y sin resultado
      const hoy = new Date();
      const pasado = new Date(hoy.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
      const cursoTerminado = makeCursoFuncionario({ id: 'ct1', designacionId: 'dt1', fechaFin: pasado, aprobado: null });
      component.funcionarios.set([makeFuncionario({ cursos: [cursoTerminado] })]);
      component.abrirCalificacionMasiva();
    });

    it('abrirCalificacionMasiva abre el modal y resetea el estado', () => {
      expect(component.modal()).toBe('calificacionMasiva');
      expect(component.cursoMasivoId()).toBeNull();
      expect(component.calificacionesMasivas()).toEqual({});
    });

    it('cursosAptos lista solo cursos terminados sin resultado', () => {
      expect(component.cursosAptos().length).toBeGreaterThanOrEqual(1);
      expect(component.cursosAptos()[0].id).toBe('ct1');
    });

    it('onCursoMasivoChange carga la tabla de alumnos del curso', () => {
      component.onCursoMasivoChange('ct1');
      expect(component.cursoMasivoId()).toBe('ct1');
      expect(component.filasCursoMasivo()).toHaveLength(1);
    });

    it('onCursoMasivoChange inicializa cada fila sin resultado ni nota', () => {
      component.onCursoMasivoChange('ct1');
      expect(component.calificacionesMasivas()['dt1']).toEqual({ aprobado: null, calificacion: null });
    });

    it('setAprobadoMasivo actualiza el resultado de una designación específica', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', false);
      expect(component.calificacionesMasivas()['dt1'].aprobado).toBe(false);
    });

    it('setAprobadoMasivoTodos aplica el mismo resultado a todas las filas', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivoTodos(true);
      expect(component.filasMasivasConResultado()).toHaveLength(1);
    });

    it('setCalificacionMasiva actualiza la nota de una designación específica', () => {
      component.onCursoMasivoChange('ct1');
      component.setCalificacionMasiva('dt1', '7');
      expect(component.calificacionesMasivas()['dt1'].calificacion).toBe(7);
    });

    it('setCalificacionMasiva con string vacío deja la nota en null', () => {
      component.onCursoMasivoChange('ct1');
      component.setCalificacionMasiva('dt1', '');
      expect(component.calificacionesMasivas()['dt1'].calificacion).toBeNull();
    });

    it('guardarCalificacionMasiva no llama al service si ninguna fila tiene resultado', () => {
      component.onCursoMasivoChange('ct1');
      component.setCalificacionMasiva('dt1', '8');
      component.guardarCalificacionMasiva();
      expect(cursosService.registrarCalificacion).not.toHaveBeenCalled();
    });

    it('guardarCalificacionMasiva setea error si una nota está fuera del rango', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '0');
      component.guardarCalificacionMasiva();
      expect(component.modalError()).toBeTruthy();
      expect(cursosService.registrarCalificacion).not.toHaveBeenCalled();
    });

    it('guardarCalificacionMasiva llama al service con el resultado y la nota', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '8');
      component.guardarCalificacionMasiva();
      expect(cursosService.registrarCalificacion).toHaveBeenCalledWith('ct1', 'dt1', { aprobado: true, calificacion: 8 });
    });

    it('guardarCalificacionMasiva omite la nota cuando no se cargó', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', false);
      component.guardarCalificacionMasiva();
      expect(cursosService.registrarCalificacion).toHaveBeenCalledWith('ct1', 'dt1', { aprobado: false });
    });

    it('guardarCalificacionMasiva cierra el modal tras éxito', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '9');
      component.guardarCalificacionMasiva();
      expect(component.modal()).toBeNull();
    });

    it('guardarCalificacionMasiva muestra error si el backend falla', () => {
      cursosService.registrarCalificacion.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '9');
      component.guardarCalificacionMasiva();
      expect(component.modalError()).toBeTruthy();
      expect(component.modal()).toBe('calificacionMasiva');
    });

    it('cancelar (cerrarModal) cierra sin guardar', () => {
      component.onCursoMasivoChange('ct1');
      component.cerrarModal();
      expect(cursosService.registrarCalificacion).not.toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });
  });

  // ── Computed: cursosAptos ──────────────────────────────────────────────────

  describe('cursosAptos computed', () => {
    beforeEach(() => setup());

    it('excluye cursos con fechaFin futura', () => {
      component.funcionarios.set([
        makeFuncionario({ cursos: [makeCursoFuncionario({ fechaFin: '2099-01-01', aprobado: null })] }),
      ]);
      expect(component.cursosAptos()).toHaveLength(0);
    });

    it('excluye cursos que ya tienen calificación', () => {
      component.funcionarios.set([
        makeFuncionario({ cursos: [makeCursoFuncionario({ fechaFin: '2020-01-01', aprobado: true, calificacion: 8 })] }),
      ]);
      expect(component.cursosAptos()).toHaveLength(0);
    });

    it('deduplica el mismo curso entre varios funcionarios', () => {
      component.funcionarios.set([
        makeFuncionario({ id: 'f1', cursos: [makeCursoFuncionario({ fechaFin: '2020-01-01', aprobado: null })] }),
        makeFuncionario({ id: 'f2', cedula: '99', nombre: 'Ana', cursos: [makeCursoFuncionario({ fechaFin: '2020-01-01', aprobado: null })] }),
      ]);
      expect(component.cursosAptos()).toHaveLength(1);
    });
  });

  // ── Track functions ────────────────────────────────────────────────────────

  describe('funciones trackBy', () => {
    beforeEach(() => setup());

    it('trackFila devuelve clave compuesta', () => {
      const fila = { funcionarioId: 'f1', cedula: '1', nombre: 'A', curso: makeCursoFuncionario() };
      expect(component.trackFila(0, fila)).toBe('f1-c1');
    });

    it('trackDefinicion devuelve el id', () => {
      expect(component.trackDefinicion(0, makeCurso({ id: 'zz' }))).toBe('zz');
    });

    it('trackModulo devuelve el id', () => {
      expect(component.trackModulo(0, makeModulo({ id: 'mm' }))).toBe('mm');
    });
  });

  // ── parseError ────────────────────────────────────────────────────────────

  describe('parseError (via guardarNuevoCurso)', () => {
    beforeEach(() => setup());

    const triggerError = (errBody: any, status: number) => {
      const err = new HttpErrorResponse({ error: errBody, status });
      cursosService.createDefinicion.mockReturnValue(throwError(() => err));
      component.abrirNuevoCurso();
      component.nuevoCursoForm.patchValue({ nombre_curso: 'X', institucion: 'Y' });
      component.guardarNuevoCurso();
      return component.modalError();
    };

    it('extrae message string del cuerpo del error', () => {
      expect(triggerError({ message: 'nombre duplicado' }, 400)).toBe('nombre duplicado');
    });

    it('extrae el primer elemento si message es un array', () => {
      expect(triggerError({ message: ['campo requerido', 'otro error'] }, 400)).toBe('campo requerido');
    });

    it('usa el body como string si es un string directo', () => {
      expect(triggerError('error de servidor', 500)).toBe('error de servidor');
    });

    it('devuelve mensaje amigable para 409 si el cuerpo no tiene message', () => {
      expect(triggerError({ error: 'Conflict' }, 409)).toBe('Ya existe un curso con ese nombre.');
    });

    it('devuelve mensaje amigable para 0 (sin conexión)', () => {
      expect(triggerError(null, 0)).toBe('No se pudo conectar con el servidor.');
    });

    it('devuelve mensaje genérico para errores no mapeados', () => {
      expect(triggerError(null, 503)).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
    });
  });

  // ── puedeGestionar ─────────────────────────────────────────────────────────

  describe('permiso cursos.gestionar', () => {
    it('puedeGestionar es true si el service devuelve true', async () => {
      await setup('catalogo', true);
      expect(component.puedeGestionar()).toBe(true);
    });

    it('puedeGestionar es false si el service devuelve false', async () => {
      await setup('catalogo', false);
      expect(component.puedeGestionar()).toBe(false);
    });

    it('puedeGestionar llama a hasPermiso con "cursos.gestionar"', async () => {
      await setup();
      component.puedeGestionar();
      expect(authService.hasPermiso).toHaveBeenCalledWith('cursos.gestionar');
    });

    function celdaResultado(): HTMLElement {
      return fixture.nativeElement.querySelector('.cursos__cal-cell');
    }

    async function conCursoTerminadoSinResultado(hasPermiso: boolean) {
      await setup('inscripciones', hasPermiso);
      component.funcionarios.set([
        makeFuncionario({
          cursos: [makeCursoFuncionario({ fechaFin: '2020-01-01', aprobado: null })],
        }),
      ]);
      fixture.detectChanges();
    }

    it('con permiso muestra el botón de cargar resultado', async () => {
      await conCursoTerminadoSinResultado(true);
      expect(celdaResultado().textContent).toContain('Cargar resultado');
    });

    it('sin permiso no muestra el botón de cargar resultado', async () => {
      await conCursoTerminadoSinResultado(false);
      expect(celdaResultado().textContent).not.toContain('Cargar resultado');
    });

    it('sin permiso la celda muestra el guion y no queda vacía', async () => {
      await conCursoTerminadoSinResultado(false);
      expect(celdaResultado().querySelector('.cursos__sin-nota')).not.toBeNull();
    });

    it('sin permiso el resultado ya cargado se sigue viendo', async () => {
      await setup('inscripciones', false);
      component.funcionarios.set([
        makeFuncionario({
          cursos: [makeCursoFuncionario({ fechaFin: '2020-01-01', aprobado: true, calificacion: 8 })],
        }),
      ]);
      fixture.detectChanges();
      expect(celdaResultado().textContent).toContain('Aprobado');
    });
  });
});
