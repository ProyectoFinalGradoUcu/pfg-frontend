import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { CursosPage } from './cursos-page';
import { CursosService } from '../../../../core/services/cursos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { By } from '@angular/platform-browser';
import { Select } from '../../../../shared/components/select/select';
import { PersonaListItem } from '../../../../core/models/personal.models';
import { DEBOUNCE_BUSQUEDA_MS } from '../../../../shared/utils/buscador-personas';
import {
  CursoDefinicion,
  CursoFuncionarioItem,
  FuncionarioConCursos,
  ModuloCurso,
} from '../../../../core/models/cursos.models';
import { ESPERA_BUSQUEDA_MS } from '../../../../shared/utils/espera-busqueda';
import { DateInput } from '../../../../shared/components/date-input/date-input';

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
  let personalService: {
    findAll: ReturnType<typeof vi.fn>;
    findPaginado: ReturnType<typeof vi.fn>;
    getBases: ReturnType<typeof vi.fn>;
    getGrados: ReturnType<typeof vi.fn>;
    getEscalafones: ReturnType<typeof vi.fn>;
  };
  let authService: {
    hasPermiso: ReturnType<typeof vi.fn>;
    puedeConAlcance: ReturnType<typeof vi.fn>;
    alcanceDe: ReturnType<typeof vi.fn>;
    currentUser: () => { unidades: { id: string; denominacion: string; comando: { id: string; denominacion: string } }[] };
  };

  const BAI = { id: '7', denominacion: 'B.A.I.', comando: { id: '1', denominacion: 'C.A.O.' } };
  const ETA = { id: '9', denominacion: 'E.T.A.', comando: { id: '2', denominacion: 'C.A.P.' } };
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
      subirDocumentoDesignaciones: vi.fn().mockReturnValue(of({ adjuntados: 2 })),
      documentosDesignacion: vi.fn().mockReturnValue({
        subir: vi.fn(), quitar: vi.fn(), inspeccionar: vi.fn(), url: vi.fn(),
      }),
      registrarCalificacion: vi.fn().mockReturnValue(of({ id: 'x', curso_id: 'c1', persona_id: 'f1', aprobado: true, calificacion: 8, observacion: null })),
      registrarCalificacionesMasivas: vi.fn().mockReturnValue(of([])),
      editarInscripcion: vi.fn().mockReturnValue(of({})),
    };
  }

  /** `hasPermiso` = gestión con alcance global; `basesPropias` = gestión solo con `.unidad` sobre esas bases. */
  async function setup(
    routeSection: 'catalogo' | 'inscripciones' = 'catalogo',
    hasPermiso = true,
    basesPropias: (typeof BAI)[] | null = null,
    permisos?: Record<string, 'global' | 'unidad'>,
    queryParams: Record<string, string> = {},
  ) {
    cursosService = makeCursosServiceSpy();
    personalService = {
      findAll: vi.fn().mockReturnValue(of([])),
      getGrados: vi.fn().mockReturnValue(of([])),
      getEscalafones: vi.fn().mockReturnValue(of([])),
      findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 20 })),
      getBases: vi.fn().mockReturnValue(
        of([BAI, ETA].map((b) => ({ ...b, unidad_id: Number(b.comando.id), etiqueta: `${b.denominacion} (${b.comando.denominacion})` }))),
      ),
    };
    const alcance = basesPropias ? 'unidad' : hasPermiso ? 'global' : null;
    authService = {
      hasPermiso: vi.fn().mockReturnValue(hasPermiso),
      puedeConAlcance: vi.fn().mockReturnValue(alcance !== null),
      alcanceDe: vi.fn().mockReturnValue(alcance),
      currentUser: () => ({ unidades: basesPropias ?? [] }),
    };
    if (permisos) {
      authService.alcanceDe.mockImplementation((p: string) => permisos[p] ?? null);
      authService.puedeConAlcance.mockImplementation((p: string) => !!permisos[p]);
    }
    toastService = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [CursosPage, Select, DateInput],
      imports: [FormsModule, ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: CursosService, useValue: cursosService },
        { provide: PersonalService, useValue: personalService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { section: routeSection }, queryParamMap: convertToParamMap(queryParams) } } },
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

  describe('nuevo curso con alcance por base', () => {
    it('con una sola base la propone y no deja crear cursos generales', async () => {
      await setup('catalogo', false, [BAI]);
      component.abrirNuevoCurso();
      expect(component.nuevoCursoForm.controls.sub_unidad_id.value).toBe(7);
      expect(personalService.getBases).not.toHaveBeenCalled();
    });

    it('con varias bases ofrece solo las propias y exige elegir una', async () => {
      await setup('catalogo', false, [BAI, ETA]);
      component.abrirNuevoCurso();
      expect(component.basesCurso().map((b) => b.id)).toEqual([7, 9]);
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Mi Curso', institucion: 'UCU' });
      component.guardarNuevoCurso();
      expect(cursosService.createDefinicion).not.toHaveBeenCalled();
    });
  });

  describe('etiquetaBaseCurso', () => {
    it('muestra la base con su comando, o General', async () => {
      await setup();
      expect(component.etiquetaBaseCurso({ id: '1', nombre_curso: 'X', institucion: 'Y', base: { id: '7', denominacion: 'B.A.I.', comando: 'C.A.O.' } })).toBe('B.A.I. (C.A.O.)');
      expect(component.etiquetaBaseCurso({ id: '1', nombre_curso: 'X', institucion: 'Y', base: null })).toBe('General');
    });
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

    it('desde el perfil llega filtrado por la cédula', async () => {
      await setup('inscripciones', true, null, undefined, { cedula: '60000001' });
      expect(component.cedulaFiltro()).toBe('60000001');
      expect(cursosService.findFuncionariosConCursos.mock.calls[0][0]).toBe('60000001');
    });

    it('no carga 100 personas al iniciar: los selectores buscan en el servidor', async () => {
      await setup();
      expect(personalService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('selectores de personal con búsqueda en el servidor', () => {
    const DAGALIPEGA: PersonaListItem = {
      id: '2400', nombre: 'Juan Dagalipega', cedula: '41234567', rango: 'Cabo', destino: null, estado: null, relacion_estado: 'activo',
    };
    const PEREYRA: PersonaListItem = {
      id: '1', nombre: 'Ana Pereyra', cedula: '60000001', rango: 'Teniente', destino: null, estado: null, relacion_estado: 'activo',
    };

    function responder(items: PersonaListItem[]): void {
      personalService.findPaginado.mockReturnValue(of({ items, total: items.length, page: 1, pageSize: 20 }));
    }

    function selector(control: string): Select {
      fixture.detectChanges();
      const el = fixture.debugElement.query(By.css(`app-select[formControlName="${control}"]`));
      return el.componentInstance as Select;
    }

    async function buscar(select: Select, texto: string): Promise<void> {
      select.searchChange.emit(texto);
      await new Promise((r) => setTimeout(r, DEBOUNCE_BUSQUEDA_MS + 60));
      fixture.detectChanges();
    }

    it('Registrar Curso encuentra por apellido a quien no está entre los primeros 100', async () => {
      await setup('inscripciones');
      component.abrirRegistrar();
      const select = selector('personaId');
      expect(select.remoteSearch).toBe(true);

      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');

      expect(personalService.findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: 'DAGALIPEGA' }));
      expect(select.items).toEqual([expect.objectContaining({ id: '2400' })]);
    });

    it('Registrar Curso busca por cédula', async () => {
      await setup('inscripciones');
      component.abrirRegistrar();
      const select = selector('personaId');

      responder([DAGALIPEGA]);
      await buscar(select, '41234567');

      expect(personalService.findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: '41234567' }));
      select.pick(select.items[0]);
      expect(component.registrarForm.controls.personaId.value).toBe('2400');
    });

    it('Registrar Curso sigue mostrando al elegido después de otra búsqueda', async () => {
      await setup('inscripciones');
      component.abrirRegistrar();
      const select = selector('personaId');
      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');
      select.pick(select.items[0]);

      responder([PEREYRA]);
      await buscar(select, 'PEREYRA');

      expect(select.selectedLabel()).toContain('Juan Dagalipega');
    });

    it('Nuevo Curso con "Designar ahora" busca en el servidor y conserva a los elegidos', async () => {
      await setup();
      component.abrirNuevoCurso();
      component.nuevoCursoForm.patchValue({ designar_ahora: true });
      const select = selector('persona_ids');
      expect(select.remoteSearch).toBe(true);

      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');
      select.pick(select.items[0]);
      responder([PEREYRA]);
      await buscar(select, 'PEREYRA');
      select.pick(select.items.find((p) => (p as PersonaListItem).id === '1'));

      expect(component.nuevoCursoForm.controls.persona_ids.value).toEqual(['2400', '1']);
      expect(select.multipleLabel()).toContain('Juan Dagalipega');
      expect(select.multipleLabel()).toContain('Ana Pereyra');
    });

    it('Designar / Dictar busca en el servidor y conserva a los elegidos', async () => {
      await setup();
      component.abrirDesignar(makeCurso({ id: '7' }));
      const select = selector('persona_ids');
      expect(select.remoteSearch).toBe(true);

      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');
      select.pick(select.items[0]);
      responder([PEREYRA]);
      await buscar(select, 'PEREYRA');

      expect(component.designarForm.controls.persona_ids.value).toEqual(['2400']);
      expect(select.multipleLabel()).toContain('Juan Dagalipega');
    });

    it('al reabrir un modal no quedan elegidos de la vez anterior', async () => {
      await setup();
      component.abrirDesignar(makeCurso({ id: '7' }));
      let select = selector('persona_ids');
      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');
      select.pick(select.items[0]);

      component.cerrarModal();
      component.abrirDesignar(makeCurso({ id: '7' }));
      select = selector('persona_ids');
      responder([PEREYRA]);
      await buscar(select, '');

      expect(select.items.map((p) => (p as PersonaListItem).id)).toEqual(['1']);
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

    it('una respuesta vieja no pisa a la nueva', () => {
      const vieja = new Subject<ReturnType<typeof makePaginated<CursoDefinicion>>>();
      const nuevo = makeCurso({ id: '2' });
      cursosService.findAllDefiniciones.mockReturnValueOnce(vieja).mockReturnValueOnce(of(makePaginated([nuevo])));
      component.cargarDefiniciones();
      component.cargarDefiniciones();
      vieja.next(makePaginated([makeCurso({ id: '1' })]));
      expect(component.definiciones()).toEqual([nuevo]);
    });

    it('filtra por nombre: llama al service con el nombre correcto', () => {
      vi.useFakeTimers();
      component.onNombreInput('javascript');
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS);
      vi.useRealTimers();
      expect(cursosService.findAllDefiniciones).toHaveBeenCalledWith(1, 10, 'javascript', undefined, undefined);
    });

    it('filtra por institución: llama al service con la institución correcta', () => {
      vi.useFakeTimers();
      component.onInstitucionInput('UCU');
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS);
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
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS);
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

    it('con alcance global la base es opcional (curso general) y ofrece todas', () => {
      component.abrirNuevoCurso();
      expect(component.nuevoCursoForm.controls.sub_unidad_id.valid).toBe(true);
      expect(component.basesCurso().map((b) => b.etiqueta)).toEqual(['B.A.I. (C.A.O.)', 'E.T.A. (C.A.P.)']);
    });

    it('guardarNuevoCurso manda la base elegida', () => {
      component.abrirNuevoCurso();
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Mi Curso', institucion: 'UCU', sub_unidad_id: 9 });
      component.guardarNuevoCurso();
      expect(cursosService.createDefinicion).toHaveBeenCalledWith(
        expect.objectContaining({ sub_unidad_id: 9 }),
      );
    });

    it('guardarNuevoCurso cierra el modal y emite toast tras éxito', () => {
      component.nuevoCursoForm.patchValue({ nombre_curso: 'Mi Curso', institucion: 'UCU' });
      component.guardarNuevoCurso();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    describe('con "Designar ahora"', () => {
      const conDesignacion = (o: Record<string, unknown> = {}) => {
        component.abrirNuevoCurso();
        component.nuevoCursoForm.patchValue({
          nombre_curso: 'Mi Curso', institucion: 'UCU', designar_ahora: true, persona_ids: ['5'],
          fecha_inicio: '2026-03-01', fecha_fin: '2026-04-01', numero_orden: 'O.D. 1', ...o,
        });
      };

      it('no crea el curso si la fecha de fin es anterior a la de inicio', () => {
        conDesignacion({ fecha_inicio: '2026-04-01', fecha_fin: '2026-03-01' });
        component.guardarNuevoCurso();
        expect(component.modalError()).toContain('fecha de fin');
        expect(cursosService.createDefinicion).not.toHaveBeenCalled();
      });

      it('si falla la designación borra el curso y deja el modal abierto con el error', () => {
        cursosService.crearDesignacion.mockReturnValue(throwError(() => makeHttpError('persona inexistente')));
        conDesignacion();
        component.guardarNuevoCurso();
        expect(cursosService.deleteDefinicion).toHaveBeenCalledWith(makeCurso().id);
        expect(component.modalError()).toContain('persona inexistente');
        expect(component.modal()).toBe('nuevoCurso');
        expect(component.definiciones().some((d) => d.id === makeCurso().id)).toBe(false);
      });
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

    it('guardarDesignar setea error si faltan N° Orden y Resolución', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: '', boletin: '', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(component.modalError()).toContain('orden');
      expect(cursosService.crearDesignacion).not.toHaveBeenCalled();
    });

    it('guardarDesignar se habilita si solo hay N° Orden (sin Resolución)', () => {
      openDesignar();
      component.designarForm.patchValue({ numero_orden: 'N1', boletin: '', persona_ids: ['1'], fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01' });
      component.guardarDesignar();
      expect(cursosService.crearDesignacion).toHaveBeenCalled();
    });

    it('guardarDesignar se habilita si solo hay Resolución (sin N° Orden)', () => {
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
    it('el historial permite seleccionar una base cuando el usuario tiene varias', async () => {
      await setup('catalogo', false, [BAI, ETA]);
      component.abrirRegistrar();
      expect(component.basesCurso().map(b => b.id)).toEqual([7, 9]);
      expect(component.registrarForm.controls.sub_unidad_id.invalid).toBe(true);
      component.registrarForm.controls.sub_unidad_id.setValue(8);
      expect(component.registrarForm.controls.sub_unidad_id.valid).toBe(true);
    });
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

    it('guardarCalificacionMasiva no llama al service si ninguna fila tiene resultado ni nota', () => {
      component.onCursoMasivoChange('ct1');
      component.guardarCalificacionMasiva();
      expect(cursosService.registrarCalificacionesMasivas).not.toHaveBeenCalled();
    });

    it('filasMasivasIncompletas detecta las filas con nota pero sin resultado', () => {
      component.onCursoMasivoChange('ct1');
      component.setCalificacionMasiva('dt1', '8');
      expect(component.filasMasivasIncompletas().map((f) => f.curso.designacionId)).toEqual(['dt1']);
    });

    it('guardarCalificacionMasiva bloquea y nombra las filas con nota pero sin resultado', () => {
      component.onCursoMasivoChange('ct1');
      component.setCalificacionMasiva('dt1', '8');
      component.guardarCalificacionMasiva();
      expect(component.modalError()).toContain('Juan Pérez');
      expect(cursosService.registrarCalificacionesMasivas).not.toHaveBeenCalled();
    });

    it('guardarCalificacionMasiva setea error si una nota está fuera del rango', () => {
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '0');
      component.guardarCalificacionMasiva();
      expect(component.modalError()).toBeTruthy();
      expect(cursosService.registrarCalificacionesMasivas).not.toHaveBeenCalled();
    });

    it('guardarCalificacionMasiva envía todas las filas en un solo request', () => {
      const hoy = new Date();
      const pasado = new Date(hoy.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
      component.funcionarios.set([
        makeFuncionario({ cursos: [makeCursoFuncionario({ id: 'ct1', designacionId: '11', fechaFin: pasado })] }),
        makeFuncionario({ id: 'f2', nombre: 'Ana Gómez', cursos: [makeCursoFuncionario({ id: 'ct1', designacionId: '12', fechaFin: pasado })] }),
      ]);
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('11', true);
      component.setCalificacionMasiva('11', '8');
      component.setAprobadoMasivo('12', false);
      component.guardarCalificacionMasiva();
      expect(cursosService.registrarCalificacionesMasivas).toHaveBeenCalledTimes(1);
      expect(cursosService.registrarCalificacionesMasivas).toHaveBeenCalledWith('ct1', [
        { designacionId: 11, aprobado: true, calificacion: 8 },
        { designacionId: 12, aprobado: false },
      ]);
    });

    it('guardarCalificacionMasiva aplica los resultados devueltos y cierra el modal', () => {
      cursosService.registrarCalificacionesMasivas.mockReturnValue(
        of([{ id: 'dt1', curso_id: 'ct1', persona_id: 'f1', aprobado: true, calificacion: 9, observacion: null }]),
      );
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '9');
      component.guardarCalificacionMasiva();
      expect(component.funcionarios()[0].cursos[0]).toMatchObject({ aprobado: true, calificacion: 9 });
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarCalificacionMasiva avisa que no se guardó nada si el backend falla', () => {
      cursosService.registrarCalificacionesMasivas.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.onCursoMasivoChange('ct1');
      component.setAprobadoMasivo('dt1', true);
      component.setCalificacionMasiva('dt1', '9');
      component.guardarCalificacionMasiva();
      expect(component.modalError()).toContain('No se guardó ningún resultado');
      expect(component.modal()).toBe('calificacionMasiva');
      expect(component.funcionarios()[0].cursos[0].aprobado).toBeNull();
      expect(component.calificacionesMasivas()['dt1']).toEqual({ aprobado: true, calificacion: 9 });
    });

    it('cancelar (cerrarModal) cierra sin guardar', () => {
      component.onCursoMasivoChange('ct1');
      component.cerrarModal();
      expect(cursosService.registrarCalificacionesMasivas).not.toHaveBeenCalled();
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

  describe('documentos de la designación', () => {
    const pdf = (name: string) => new File(['x'], name, { type: 'application/pdf' });
    const respuesta = { personas_designadas: 2, designaciones: [{ id: '12', persona_id: '1' }, { id: '13', persona_id: '2' }] };

    function designarConArchivos() {
      component.abrirDesignar(makeCurso({ id: 'cd1' }));
      component.designarForm.patchValue({
        numero_orden: 'N1', boletin: 'B1', fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01', persona_ids: ['1', '2'],
      });
      component.pendientes.elegir('orden', pdf('orden.pdf'));
      component.pendientes.elegir('boletin', pdf('boletin.pdf'));
    }

    it('designar con archivo: una sola subida por slot con todos los ids', async () => {
      await setup();
      cursosService.crearDesignacion.mockReturnValue(of(respuesta));
      designarConArchivos();
      component.guardarDesignar();
      expect(cursosService.subirDocumentoDesignaciones).toHaveBeenCalledTimes(2);
      expect(cursosService.subirDocumentoDesignaciones).toHaveBeenCalledWith('cd1', 'orden', expect.any(File), ['12', '13']);
      expect(cursosService.subirDocumentoDesignaciones).toHaveBeenCalledWith('cd1', 'boletin', expect.any(File), ['12', '13']);
      expect(component.modal()).toBeNull();
    });

    it('Designar ahora con archivo: igual', async () => {
      await setup();
      cursosService.crearDesignacion.mockReturnValue(of(respuesta));
      component.abrirNuevoCurso();
      component.nuevoCursoForm.patchValue({
        nombre_curso: 'Mi Curso', institucion: 'UCU', designar_ahora: true, persona_ids: ['1', '2'],
        fecha_inicio: '2026-03-01', fecha_fin: '2026-04-01', numero_orden: 'O1',
      });
      component.pendientes.elegir('orden', pdf('orden.pdf'));
      component.guardarNuevoCurso();
      expect(cursosService.subirDocumentoDesignaciones).toHaveBeenCalledTimes(1);
      expect(cursosService.subirDocumentoDesignaciones).toHaveBeenCalledWith(makeCurso().id, 'orden', expect.any(File), ['12', '13']);
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('si la subida falla, avisa y cierra igual', async () => {
      await setup();
      cursosService.crearDesignacion.mockReturnValue(of(respuesta));
      cursosService.subirDocumentoDesignaciones.mockReturnValue(throwError(() => makeHttpError('formato inválido')));
      designarConArchivos();
      component.guardarDesignar();
      expect(toastService.error).toHaveBeenCalledWith(
        expect.stringContaining('La designación se registró, pero no se pudo subir «orden.pdf»'),
        8000,
      );
      expect(toastService.error.mock.calls[0][0]).toContain('Podés adjuntarlo desde la tabla de designados.');
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
    });

    it('sin archivos no sube nada', async () => {
      await setup();
      component.abrirDesignar(makeCurso({ id: 'cd1' }));
      component.designarForm.patchValue({ numero_orden: 'N1', fecha_inicio: '2025-01-01', fecha_fin: '2025-06-01', persona_ids: ['1'] });
      component.guardarDesignar();
      expect(cursosService.subirDocumentoDesignaciones).not.toHaveBeenCalled();
    });

    it('Documentos abre el modal de la designación', async () => {
      await setup('inscripciones');
      const doc = { nombre_original: 'a.pdf', content_type: 'application/pdf', tamanio_bytes: '1', subido_en: '2026-01-01' };
      component.funcionarios.set([
        makeFuncionario({
          cursos: [makeCursoFuncionario({
            id: 'c9', designacionId: '55', numero_orden: 'O-7', boletin: null,
            documentos: { orden: doc, boletin: null },
          })],
        }),
      ]);
      fixture.detectChanges();
      component.abrirDocumentos(component.filasFlat()[0]);
      fixture.detectChanges();
      expect(cursosService.documentosDesignacion).toHaveBeenCalledWith('c9', '55');
      const slots = component.slotsDocumentos();
      expect(slots.map((x) => x.slot)).toEqual(['orden', 'boletin']);
      expect(slots[0]).toMatchObject({ numero: 'O-7', documento: doc, editable: true });
      expect(fixture.nativeElement.querySelector('app-documentos-registro-modal')).not.toBeNull();
    });

    it('designación por módulo: el número del slot sale de los módulos', async () => {
      await setup('inscripciones');
      component.funcionarios.set([
        makeFuncionario({
          cursos: [makeCursoFuncionario({
            numero_orden: null, boletin: null,
            modulos: [
              { numero_orden: 'O-1', boletin: 'B-1' },
              { numero_orden: 'O-1', boletin: 'B-2' },
            ],
          })],
        }),
      ]);
      component.abrirDocumentos(component.filasFlat()[0]);
      const [orden, boletin] = component.slotsDocumentos();
      expect(orden.numero).toBe('O-1');
      expect(boletin.numero).toBeNull();
    });

    async function abrirDocumentosDeFila() {
      component.funcionarios.set([makeFuncionario({ cursos: [makeCursoFuncionario({ numero_orden: 'O-1' })] })]);
      component.abrirDocumentos(component.filasFlat()[0]);
    }

    it('sin gestionar, los documentos se ven pero no se editan', async () => {
      await setup('inscripciones', true, null, { 'cursos.ver': 'global' });
      await abrirDocumentosDeFila();
      expect(component.puedeVerDocumentos()).toBe(true);
      expect(component.slotsDocumentos().every((x) => x.editable === false)).toBe(true);
    });

    it('solo con gestionar (sin cursos.ver) no se pueden ver documentos', async () => {
      await setup('inscripciones', true, null, { 'cursos.gestionar': 'unidad' });
      expect(component.puedeVerDocumentos()).toBe(false);
    });

    it('con cursos.gestionar.unidad los slots son editables', async () => {
      await setup('inscripciones', false, null, { 'cursos.gestionar': 'unidad' });
      await abrirDocumentosDeFila();
      expect(component.slotsDocumentos().every((x) => x.editable === true)).toBe(true);
    });

    it('si la respuesta no trae designaciones, no sube nada', async () => {
      await setup();
      cursosService.crearDesignacion.mockReturnValue(of({ personas_designadas: 1 }));
      designarConArchivos();
      component.guardarDesignar();
      expect(cursosService.subirDocumentoDesignaciones).not.toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });

    it('no deja cerrar el modal mientras designa', async () => {
      await setup();
      component.abrirDesignar(makeCurso());
      component.designando.set(true);
      component.cerrarModal();
      expect(component.modal()).toBe('designar');
    });

    it('el botón no deja cerrar el modal mientras sube', async () => {
      await setup();
      component.abrirDesignar(makeCurso());
      component.subiendoDocumentos.set(true);
      component.cerrarModal();
      expect(component.modal()).toBe('designar');
    });
  });

  describe('permiso cursos.gestionar', () => {
    it('puedeGestionar es true si el service devuelve true', async () => {
      await setup('catalogo', true);
      expect(component.puedeGestionar()).toBe(true);
    });

    it('puedeGestionar es false si el service devuelve false', async () => {
      await setup('catalogo', false);
      expect(component.puedeGestionar()).toBe(false);
    });

    it('puedeGestionar acepta "cursos.gestionar" global o por base', async () => {
      await setup();
      component.puedeGestionar();
      expect(authService.puedeConAlcance).toHaveBeenCalledWith('cursos.gestionar');
    });

    it('con alcance por base también puede gestionar', async () => {
      await setup('catalogo', false, [BAI]);
      expect(component.puedeGestionar()).toBe(true);
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

  // ─── Editar inscripción ─────────────────────────────────────────────────────

  describe('editar inscripción', () => {
    const fila = () => ({
      funcionarioId: 'f1',
      cedula: '12345678',
      nombre: 'Ana Pérez',
      curso: {
        id: 'c1',
        designacionId: 'd1',
        nombre_curso: 'Curso X',
        institucion: 'ETA',
        tipo: 'obligatorio',
        fechaInicio: '2026-03-01T00:00:00.000Z',
        fechaFin: '2026-06-30T00:00:00.000Z',
        aprobado: true,
        calificacion: 8,
        observacion: null,
        numero_orden: 'ORD-1',
        boletin: null,
      },
    }) as any;

    beforeEach(async () => {
      await setup('inscripciones');
    });

    it('precarga los datos actuales', () => {
      component.abrirEditarInscripcion(fila());
      expect(component.modal()).toBe('editarInscripcion');
      expect(component.editarInscripcionForm.getRawValue()).toEqual({
        numero_orden: 'ORD-1', boletin: '', fecha_inicio: '2026-03-01', fecha_fin: '2026-06-30',
      });
      expect(component.editAprobado()).toBe(true);
      expect(component.editCalificacion()).toBe(8);
    });

    it('manda solo lo que cambió', () => {
      component.abrirEditarInscripcion(fila());
      component.editarInscripcionForm.patchValue({ boletin: 'RES-9', fecha_fin: '2026-07-31' });
      component.editCalificacion.set(9);
      component.guardarEdicionInscripcion();
      expect(cursosService.editarInscripcion).toHaveBeenCalledWith('c1', 'd1', {
        boletin: 'RES-9', fecha_fin: '2026-07-31', calificacion: 9,
      });
    });

    it('quitar el resultado manda aprobado en null', () => {
      component.abrirEditarInscripcion(fila());
      component.editAprobado.set(null);
      component.guardarEdicionInscripcion();
      expect(cursosService.editarInscripcion).toHaveBeenCalledWith('c1', 'd1', { aprobado: null });
    });

    it('no deja fechas invertidas ni quitar orden y resolución', () => {
      component.abrirEditarInscripcion(fila());
      component.editarInscripcionForm.patchValue({ fecha_fin: '2026-02-01' });
      component.guardarEdicionInscripcion();
      expect(component.modalError()).toContain('fecha de fin');

      component.editarInscripcionForm.patchValue({ fecha_fin: '2026-06-30', numero_orden: '' });
      component.guardarEdicionInscripcion();
      expect(component.modalError()).toContain('orden o la resolución');
      expect(cursosService.editarInscripcion).not.toHaveBeenCalled();
    });

    it('no deja cargar resultado si el curso no terminó', () => {
      const f = fila();
      f.curso.aprobado = null;
      f.curso.calificacion = null;
      f.curso.fechaFin = '2999-12-31T00:00:00.000Z';
      component.abrirEditarInscripcion(f);
      expect(component.edicionTerminada()).toBe(false);
      component.editAprobado.set(true);
      component.guardarEdicionInscripcion();
      expect(component.modalError()).toContain('todavía no terminó');
      expect(cursosService.editarInscripcion).not.toHaveBeenCalled();
    });

    it('con el curso en marcha igual se puede corregir la orden', () => {
      const f = fila();
      f.curso.aprobado = null;
      f.curso.calificacion = null;
      f.curso.fechaFin = '2999-12-31T00:00:00.000Z';
      component.abrirEditarInscripcion(f);
      component.editarInscripcionForm.patchValue({ numero_orden: 'ORD-9' });
      component.guardarEdicionInscripcion();
      expect(cursosService.editarInscripcion).toHaveBeenCalledWith('c1', 'd1', { numero_orden: 'ORD-9' });
    });

    it('sin cambios cierra sin llamar al backend', () => {
      component.abrirEditarInscripcion(fila());
      component.guardarEdicionInscripcion();
      expect(cursosService.editarInscripcion).not.toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });
  });
});
