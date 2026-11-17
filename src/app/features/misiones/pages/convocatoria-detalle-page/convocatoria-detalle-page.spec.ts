import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { ConvocatoriaDetallePage } from './convocatoria-detalle-page';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { By } from '@angular/platform-browser';
import { Select } from '../../../../shared/components/select/select';
import { PersonaListItem } from '../../../../core/models/personal.models';
import { DEBOUNCE_BUSQUEDA_MS } from '../../../../shared/utils/buscador-personas';
import { Convocatoria, FuncionarioConvocatoria, MisionDefinicion } from '../../../../core/models/misiones.models';
import { ESPERA_BUSQUEDA_MS } from '../../../../shared/utils/espera-busqueda';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMision(overrides: Partial<MisionDefinicion> = {}): MisionDefinicion {
  return { id: '1', nombre_mision: 'Congo', pais: 'RD Congo', fecha_orden: null, fecha_boletin: null, numero_resolucion: null, fecha_resolucion: null, resolucion_cje: null, total_convocatorias: 0, ...overrides };
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
    documentos: { orden: null, boletin: null },
    ...overrides,
  };
}

function makeFuncionario(overrides: Partial<FuncionarioConvocatoria> = {}): FuncionarioConvocatoria {
  return {
    id: 'a1',
    persona_id: '1001',
    cedula: '12345678',
    primer_nombre: 'Juan',
    primer_apellido: 'Pérez',
    numero_orden: null,
    boletin: 'BOL-1',
    observaciones: null,
    documentos: { orden: null, boletin: null },
    ...overrides,
  };
}

function makePaginated<T>(items: T[], total = items.length, page = 1) {
  return { items, total, page, pageSize: 5 };
}

function makeHttpError(message: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { message }, status });
}

// ── Spec ───────────────────────────────────────────────────────────────────────

describe('ConvocatoriaDetallePage', () => {
  let component: ConvocatoriaDetallePage;
  let fixture: ComponentFixture<ConvocatoriaDetallePage>;
  let misionesService: ReturnType<typeof makeMisionesServiceSpy>;
  let personalService: { findAll: ReturnType<typeof vi.fn>; findPaginado: ReturnType<typeof vi.fn> };
  let authService: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const subir = vi.fn();

  function makeMisionesServiceSpy() {
    return {
      findDefinicionById: vi.fn().mockReturnValue(of(makeMision())),
      findConvocatoriaById: vi.fn().mockReturnValue(of(makeConvocatoria())),
      findFuncionariosByConvocatoria: vi.fn().mockReturnValue(of(makePaginated([]))),
      editarConvocatoria: vi.fn().mockReturnValue(of(makeConvocatoria())),
      addFuncionarios: vi.fn().mockReturnValue(of({ asignaciones: [{ id: 'a55', persona_id: '5' }] })),
      documentosConvocatoria: vi.fn().mockReturnValue({ subir: vi.fn(), quitar: vi.fn(), inspeccionar: vi.fn(), url: vi.fn() }),
      documentosAsignacion: vi.fn().mockReturnValue({ subir }),
      updateFuncionario: vi.fn().mockReturnValue(of(undefined)),
      deleteFuncionario: vi.fn().mockReturnValue(of(undefined)),
      deleteAllFuncionarios: vi.fn().mockReturnValue(of(undefined)),
    };
  }

  async function setup(misionId = '1', convocatoriaId = 'c1', hasPermiso = true) {
    misionesService = makeMisionesServiceSpy();
    personalService = {
      findAll: vi.fn().mockReturnValue(of([])),
      findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 20 })),
    };
    authService = { hasPermiso: vi.fn().mockReturnValue(hasPermiso) };
    toastService = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    router = { navigate: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [ConvocatoriaDetallePage, Select],
      imports: [FormsModule, ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: MisionesService, useValue: misionesService },
        { provide: PersonalService, useValue: personalService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'misionId' ? misionId : convocatoriaId),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConvocatoriaDetallePage);
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

    it('carga la misión y la convocatoria sin traer una lista de 100 personas', async () => {
      await setup();
      expect(misionesService.findDefinicionById).toHaveBeenCalledWith('1');
      expect(misionesService.findConvocatoriaById).toHaveBeenCalledWith('1', 'c1');
      expect(personalService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('Asignar Funcionario: selector con búsqueda en el servidor', () => {
    const DAGALIPEGA: PersonaListItem = {
      id: '2400', nombre: 'Juan Dagalipega', cedula: '41234567', rango: 'Cabo', destino: null, estado: null, relacion_estado: 'activo',
    };
    const PEREYRA: PersonaListItem = {
      id: '1', nombre: 'Ana Pereyra', cedula: '60000001', rango: 'Teniente', destino: null, estado: null, relacion_estado: 'activo',
    };

    function responder(items: PersonaListItem[]): void {
      personalService.findPaginado.mockReturnValue(of({ items, total: items.length, page: 1, pageSize: 20 }));
    }

    function selector(): Select {
      fixture.detectChanges();
      return fixture.debugElement.query(By.css('app-select[formControlName="persona_id"]')).componentInstance as Select;
    }

    async function buscar(select: Select, texto: string): Promise<void> {
      select.searchChange.emit(texto);
      await new Promise((r) => setTimeout(r, DEBOUNCE_BUSQUEDA_MS + 60));
      fixture.detectChanges();
    }

    it('encuentra por apellido a quien no está entre los primeros 100', async () => {
      await setup();
      component.abrirModalAsignar();
      const select = selector();
      expect(select.remoteSearch).toBe(true);

      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');

      expect(personalService.findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: 'DAGALIPEGA' }));
      expect(select.items).toEqual([expect.objectContaining({ id: '2400' })]);
    });

    it('busca por cédula y deja elegir al resultado', async () => {
      await setup();
      component.abrirModalAsignar();
      const select = selector();

      responder([DAGALIPEGA]);
      await buscar(select, '41234567');
      select.pick(select.items[0]);

      expect(personalService.findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: '41234567' }));
      expect(component.asignarForm.controls.persona_id.value).toBe('2400');
    });

    it('el elegido se sigue viendo después de otra búsqueda', async () => {
      await setup();
      component.abrirModalAsignar();
      const select = selector();
      responder([DAGALIPEGA]);
      await buscar(select, 'DAGALIPEGA');
      select.pick(select.items[0]);

      responder([PEREYRA]);
      await buscar(select, 'PEREYRA');

      expect(select.selectedLabel()).toContain('Juan Dagalipega');
    });

    it('carga los funcionarios de la convocatoria tras el éxito', async () => {
      await setup();
      expect(misionesService.findFuncionariosByConvocatoria).toHaveBeenCalledWith('1', 'c1', 1, 5, undefined, undefined);
    });
  });

  describe('cargar', () => {
    beforeEach(() => setup());

    it('setea mision y convocatoria al éxito', () => {
      const mision = makeMision({ nombre_mision: 'Haití' });
      const convocatoria = makeConvocatoria({ id: 'c9' });
      misionesService.findDefinicionById.mockReturnValue(of(mision));
      misionesService.findConvocatoriaById.mockReturnValue(of(convocatoria));
      component.cargar('c9');
      expect(component.mision()).toEqual(mision);
      expect(component.convocatoria()).toEqual(convocatoria);
      expect(component.loading()).toBe(false);
    });

    it('muestra toast y navega a la lista de convocatorias si falla', () => {
      misionesService.findDefinicionById.mockReturnValue(throwError(() => makeHttpError('no encontrada')));
      component.cargar('c9');
      expect(toastService.error).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo', '1']);
    });
  });

  describe('cargarFuncionarios', () => {
    beforeEach(() => setup());

    it('pasa la búsqueda recortada como query', () => {
      component.busquedaFuncionario.set('  Pérez  ');
      component.cargarFuncionarios('c1');
      expect(misionesService.findFuncionariosByConvocatoria).toHaveBeenLastCalledWith('1', 'c1', 1, 5, 'Pérez', undefined);
    });

    it('setea funcionarios, total y página', () => {
      const f = makeFuncionario();
      misionesService.findFuncionariosByConvocatoria.mockReturnValue(of(makePaginated([f], 1, 2)));
      component.cargarFuncionarios('c1');
      expect(component.funcionarios()).toEqual([f]);
      expect(component.funcionariosTotal()).toBe(1);
      expect(component.funcionariosPage()).toBe(2);
    });

    it('muestra toast de error si el service falla', () => {
      misionesService.findFuncionariosByConvocatoria.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.cargarFuncionarios('c1');
      expect(toastService.error).toHaveBeenCalled();
      expect(component.loadingFuncionarios()).toBe(false);
    });

    it('cargarFuncionariosPage delega con el id de la convocatoria actual', () => {
      component.cargarFuncionariosPage(3);
      expect(misionesService.findFuncionariosByConvocatoria).toHaveBeenLastCalledWith('1', 'c1', 3, 5, undefined, undefined);
    });

    it('cargarFuncionariosPage no hace nada sin convocatoria cargada', () => {
      component.convocatoria.set(null);
      misionesService.findFuncionariosByConvocatoria.mockClear();
      component.cargarFuncionariosPage(3);
      expect(misionesService.findFuncionariosByConvocatoria).not.toHaveBeenCalled();
    });

    it('onBusquedaFuncionarioInput actualiza el filtro y recarga tras el debounce', () => {
      vi.useFakeTimers();
      component.onBusquedaFuncionarioInput('García');
      vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS);
      vi.useRealTimers();
      expect(component.busquedaFuncionario()).toBe('García');
      expect(misionesService.findFuncionariosByConvocatoria).toHaveBeenLastCalledWith('1', 'c1', 1, 5, 'García', undefined);
    });

    it('onCategoriaFuncionarioChange filtra por categoría y vuelve a la primera página', () => {
      component.onCategoriaFuncionarioChange('oficial');
      expect(component.categoriaFuncionario()).toBe('oficial');
      expect(misionesService.findFuncionariosByConvocatoria).toHaveBeenLastCalledWith('1', 'c1', 1, 5, undefined, 'oficial');
    });

    it('onCategoriaFuncionarioChange con "todos" no manda el parámetro', () => {
      component.onCategoriaFuncionarioChange('subalterno');
      component.onCategoriaFuncionarioChange('todos');
      expect(misionesService.findFuncionariosByConvocatoria).toHaveBeenLastCalledWith('1', 'c1', 1, 5, undefined, undefined);
    });

    it('limpiarBusquedaFuncionario limpia el filtro', () => {
      component.busquedaFuncionario.set('x');
      component.limpiarBusquedaFuncionario();
      expect(component.busquedaFuncionario()).toBe('');
    });
  });

  describe('navegación', () => {
    beforeEach(() => setup());

    it('volver navega a las convocatorias de la misión', () => {
      component.volver();
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo', '1']);
    });

    it('irAlCatalogo navega al catálogo raíz', () => {
      component.irAlCatalogo();
      expect(router.navigate).toHaveBeenCalledWith(['/misiones/catalogo']);
    });
  });

  // ── Editar convocatoria ────────────────────────────────────────────────────

  describe('Editar convocatoria', () => {
    beforeEach(() => setup());

    it('abrirEditarConvocatoria precarga el formulario y abre el modal', () => {
      component.convocatoria.set(makeConvocatoria({ numero_orden: 'ORD-9', boletin: 'BOL-9' }));
      component.abrirEditarConvocatoria();
      expect(component.convocatoriaForm.value).toMatchObject({ numero_orden: 'ORD-9', boletin: 'BOL-9' });
      expect(component.modalEditarConvocatoria()).toBe(true);
    });

    it('abrirEditarConvocatoria no hace nada sin convocatoria cargada', () => {
      component.convocatoria.set(null);
      component.abrirEditarConvocatoria();
      expect(component.modalEditarConvocatoria()).toBe(false);
    });

    it('cerrarModalConvocatoria cierra el modal y limpia el error', () => {
      component.modalEditarConvocatoria.set(true);
      component.modalErrorConvocatoria.set('err');
      component.cerrarModalConvocatoria();
      expect(component.modalEditarConvocatoria()).toBe(false);
      expect(component.modalErrorConvocatoria()).toBeNull();
    });

    it('guardarConvocatoria no hace nada sin convocatoria cargada', () => {
      component.convocatoria.set(null);
      component.guardarConvocatoria();
      expect(misionesService.editarConvocatoria).not.toHaveBeenCalled();
    });

    it('guardarConvocatoria llama a editarConvocatoria con el payload correcto', () => {
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.convocatoriaForm.patchValue({ numero_orden: 'ORD-NEW', boletin: '', observaciones: 'nota' });
      component.guardarConvocatoria();
      expect(misionesService.editarConvocatoria).toHaveBeenCalledWith('1', 'c9', {
        numero_orden: 'ORD-NEW',
        boletin: null,
        fecha_salida: null,
        fecha_llegada: null,
        observaciones: 'nota',
      });
    });

    it('guardarConvocatoria actualiza sin recargar, conserva documentos, cierra el modal y muestra toast', () => {
      const actual = makeConvocatoria();
      const actualizado = makeConvocatoria({ observaciones: 'actualizada' });
      misionesService.editarConvocatoria.mockReturnValue(of({ ...actualizado, documentos: undefined as never }));
      misionesService.findConvocatoriaById.mockClear();
      component.convocatoria.set(actual);
      component.guardarConvocatoria();
      expect(misionesService.findConvocatoriaById).not.toHaveBeenCalled();
      expect(component.convocatoria()).toEqual({ ...actualizado, documentos: actual.documentos });
      expect(component.modalEditarConvocatoria()).toBe(false);
      expect(toastService.success).toHaveBeenCalled();
    });

    it('guardarConvocatoria muestra error del backend sin cerrar el modal', () => {
      misionesService.editarConvocatoria.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.convocatoria.set(makeConvocatoria());
      component.modalEditarConvocatoria.set(true);
      component.guardarConvocatoria();
      expect(component.modalErrorConvocatoria()).toBeTruthy();
      expect(component.modalEditarConvocatoria()).toBe(true);
    });
  });

  // ── Asignar funcionario ────────────────────────────────────────────────────

  describe('Asignar funcionario', () => {
    beforeEach(() => {
      return setup();
    });

    it('abrirModalAsignar limpia el formulario y abre el modal', () => {
      component.asignarForm.patchValue({ persona_id: '9' });
      component.abrirModalAsignar();
      expect(component.asignarForm.value.persona_id).toBe('');
      expect(component.modalAsignar()).toBe(true);
    });

    it('cerrarModalAsignar cierra el modal y limpia el error', () => {
      component.modalAsignar.set(true);
      component.modalErrorAsignar.set('err');
      component.cerrarModalAsignar();
      expect(component.modalAsignar()).toBe(false);
      expect(component.modalErrorAsignar()).toBeNull();
    });

    it('asignarFuncionario no llama al service si el formulario es inválido (falta persona)', () => {
      component.convocatoria.set(makeConvocatoria());
      component.asignarForm.patchValue({ persona_id: '' });
      component.asignarFuncionario();
      expect(misionesService.addFuncionarios).not.toHaveBeenCalled();
    });

    it('asignarFuncionario setea error si falta orden y boletín', () => {
      component.convocatoria.set(makeConvocatoria());
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: '', boletin: '' });
      component.asignarFuncionario();
      expect(component.modalErrorAsignar()).toContain('orden');
      expect(misionesService.addFuncionarios).not.toHaveBeenCalled();
    });

    it('asignarFuncionario llama a addFuncionarios con el payload correcto', () => {
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: 'ORD-5', boletin: '', observaciones: 'nota' });
      component.asignarFuncionario();
      expect(misionesService.addFuncionarios).toHaveBeenCalledWith('1', 'c9', [
        { persona_id: '5', numero_orden: 'ORD-5', boletin: undefined, observaciones: 'nota' },
      ]);
    });

    it('asignarFuncionario actualiza convocatoria/funcionarios, cierra el modal y muestra toast', () => {
      const detalle = makeConvocatoria({ total_funcionarios: 2 });
      const f = makeFuncionario();
      misionesService.findConvocatoriaById.mockReturnValue(of(detalle));
      misionesService.findFuncionariosByConvocatoria.mockReturnValue(of(makePaginated([f])));
      component.convocatoria.set(makeConvocatoria());
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: 'ORD-5' });
      component.asignarFuncionario();
      expect(component.convocatoria()).toEqual(detalle);
      expect(component.funcionarios()).toEqual([f]);
      expect(component.modalAsignar()).toBe(false);
      expect(toastService.success).toHaveBeenCalled();
      expect(component.asignando()).toBe(false);
    });

    it('asignarFuncionario muestra error del backend sin cerrar el modal', () => {
      misionesService.addFuncionarios.mockReturnValue(throwError(() => makeHttpError('ya asignado', 409)));
      component.convocatoria.set(makeConvocatoria());
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: 'ORD-5' });
      component.asignarFuncionario();
      expect(component.modalErrorAsignar()).toContain('ya asignado');
      expect(component.modalAsignar()).toBe(false);
      expect(component.asignando()).toBe(false);
    });
  });

  // ── Menú de acciones (kebab) ───────────────────────────────────────────────

  describe('documentos', () => {
    const orden = { nombre_original: 'orden.pdf', content_type: 'application/pdf', tamanio_bytes: '10', subido_en: '2026-01-01' };
    const pdf = (nombre: string) => new File(['x'], nombre, { type: 'application/pdf' });

    beforeEach(() => {
      subir.mockReset();
      subir.mockReturnValue(of({}));
    });

    it('la sección Respaldo documental muestra los documentos de la convocatoria', async () => {
      await setup();
      misionesService.findConvocatoriaById.mockReturnValue(
        of(makeConvocatoria({ numero_orden: 'ORD-1', boletin: 'BOL-1', documentos: { orden, boletin: null } })),
      );
      component.cargar('c1');
      const slots = component.slotsConvocatoria();
      expect(slots.map((s) => [s.slot, s.numero, s.documento, s.editable])).toEqual([
        ['orden', 'ORD-1', orden, true],
        ['boletin', 'BOL-1', null, true],
      ]);
      expect(misionesService.documentosConvocatoria).toHaveBeenCalledWith('c1');
    });

    it('sin misiones.gestionar la sección es de solo lectura', async () => {
      await setup();
      authService.hasPermiso.mockImplementation((p: string) => p === 'misiones.ver');
      component.convocatoria.set(makeConvocatoria());
      expect(component.slotsConvocatoria().every((s) => !s.editable)).toBe(true);
      expect(component.mostrarAcciones()).toBe(true);
    });

    it('Documentos en la fila del funcionario abre el modal', async () => {
      await setup();
      const f = makeFuncionario({ id: 'a9', numero_orden: 'O-1', documentos: { orden, boletin: null } });
      component.abrirDocumentosFuncionario(f);
      const slots = component.slotsFuncionario();
      expect(slots.map((s) => [s.slot, s.numero, s.documento])).toEqual([
        ['orden', 'O-1', orden],
        ['boletin', 'BOL-1', null],
      ]);
      expect(misionesService.documentosAsignacion).toHaveBeenCalledWith('a9');
      expect(component.tituloDocumentosFuncionario()).toContain('Juan');
    });

    it('cambio recarga la convocatoria y refresca la fila abierta', async () => {
      await setup();
      component.convocatoria.set(makeConvocatoria());
      component.abrirDocumentosFuncionario(makeFuncionario({ id: 'a9' }));
      misionesService.findConvocatoriaById.mockClear();
      misionesService.findFuncionariosByConvocatoria.mockReturnValue(
        of(makePaginated([makeFuncionario({ id: 'a9', documentos: { orden, boletin: null } })])),
      );

      component.recargarDocumentos();

      expect(misionesService.findConvocatoriaById).toHaveBeenCalledTimes(1);
      expect(component.funcionarioDocumentos()!.documentos.orden).toEqual(orden);
    });

    it('asignar funcionario con archivo: sube a la asignación creada', async () => {
      await setup();
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.abrirModalAsignar();
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: 'ORD-5' });
      const archivo = pdf('orden.pdf');
      component.pendientes.elegir('orden', archivo);

      component.asignarFuncionario();

      expect(misionesService.documentosAsignacion).toHaveBeenCalledWith('a55');
      expect(subir).toHaveBeenCalledWith('orden', archivo);
      expect(component.modalAsignar()).toBe(false);
      expect(toastService.success).toHaveBeenCalled();
    });

    it('asignar: si la subida falla avisa y deja al funcionario asignado', async () => {
      await setup();
      subir.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.abrirModalAsignar();
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: 'ORD-5' });
      component.pendientes.elegir('orden', pdf('orden.pdf'));

      component.asignarFuncionario();

      const [msg, ms] = toastService.error.mock.calls[0];
      expect(msg).toContain('El funcionario se asignó, pero no se pudo subir «orden.pdf»');
      expect(msg).toContain('Podés adjuntarlo desde la tabla de funcionarios.');
      expect(ms).toBe(8000);
      expect(toastService.success).toHaveBeenCalled();
    });

    it('asignar sin archivos no sube nada', async () => {
      await setup();
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.asignarForm.patchValue({ persona_id: '5', numero_orden: 'ORD-5' });
      component.asignarFuncionario();
      expect(subir).not.toHaveBeenCalled();
    });

    it('no se puede cerrar el modal de asignar mientras guarda', async () => {
      await setup();
      component.modalAsignar.set(true);
      component.asignando.set(true);
      component.cerrarModalAsignar();
      expect(component.modalAsignar()).toBe(true);
    });

    it('editar la convocatoria no recarga y conserva los documentos', async () => {
      await setup();
      const orden = { nombre_original: 'o.pdf', content_type: 'application/pdf', tamanio_bytes: 1, subido_por: null, subido_en: '2026-01-01T00:00:00Z' };
      component.convocatoria.set(makeConvocatoria({ documentos: { orden, boletin: null } } as never));
      misionesService.findConvocatoriaById.mockClear();
      component.guardarConvocatoria();
      expect(misionesService.findConvocatoriaById).not.toHaveBeenCalled();
      expect(component.convocatoria()!.documentos.orden).toEqual(orden);
    });
  });

  describe('menú de acciones', () => {
    beforeEach(() => setup());

    it('toggleMenu abre el menú con el id correcto', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 1, right: 2 }) } } as unknown as MouseEvent;
      component.toggleMenu('p1', mockEvent);
      expect(component.menuAbierto()).toBe('p1');
    });

    it('toggleMenu cierra si ya estaba abierto', () => {
      const mockEvent = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 1, right: 2 }) } } as unknown as MouseEvent;
      component.toggleMenu('p1', mockEvent);
      component.toggleMenu('p1', mockEvent);
      expect(component.menuAbierto()).toBeNull();
    });

    it('cerrarMenu limpia estado', () => {
      component.menuAbierto.set('x');
      component.menuPosition.set({ top: 1, right: 2 });
      component.cerrarMenu();
      expect(component.menuAbierto()).toBeNull();
      expect(component.menuPosition()).toBeNull();
    });
  });

  // ── Quitar funcionario ─────────────────────────────────────────────────────

  describe('Quitar funcionario', () => {
    beforeEach(() => setup());

    it('abrirConfirmQuitar setea el funcionario y cierra el menú', () => {
      component.menuAbierto.set('x');
      const f = makeFuncionario();
      component.abrirConfirmQuitar(f);
      expect(component.funcionarioAQuitar()).toEqual(f);
      expect(component.menuAbierto()).toBeNull();
    });

    it('cerrarConfirmQuitar limpia la selección', () => {
      component.funcionarioAQuitar.set(makeFuncionario());
      component.cerrarConfirmQuitar();
      expect(component.funcionarioAQuitar()).toBeNull();
    });

    it('confirmarQuitarFuncionario no hace nada sin convocatoria o funcionario', () => {
      component.convocatoria.set(null);
      component.funcionarioAQuitar.set(makeFuncionario());
      component.confirmarQuitarFuncionario();
      expect(misionesService.deleteFuncionario).not.toHaveBeenCalled();
    });

    it('confirmarQuitarFuncionario llama a deleteFuncionario con los ids correctos', () => {
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.funcionarioAQuitar.set(makeFuncionario({ persona_id: '77' }));
      component.confirmarQuitarFuncionario();
      expect(misionesService.deleteFuncionario).toHaveBeenCalledWith('1', 'c9', '77');
    });

    it('confirmarQuitarFuncionario cierra el modal, recarga y muestra toast tras éxito', () => {
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.funcionarioAQuitar.set(makeFuncionario());
      component.confirmarQuitarFuncionario();
      expect(component.funcionarioAQuitar()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(misionesService.findConvocatoriaById).toHaveBeenCalledWith('1', 'c9');
    });

    it('confirmarQuitarFuncionario muestra toast de error si falla', () => {
      misionesService.deleteFuncionario.mockReturnValue(throwError(() => makeHttpError('error')));
      component.convocatoria.set(makeConvocatoria());
      component.funcionarioAQuitar.set(makeFuncionario());
      component.confirmarQuitarFuncionario();
      expect(toastService.error).toHaveBeenCalled();
      expect(component.quitando()).toBe(false);
    });
  });

  // ── Eliminar todos los funcionarios ────────────────────────────────────────

  describe('Eliminar todos los funcionarios', () => {
    beforeEach(() => setup());

    it('abrirConfirmEliminarTodos / cerrarConfirmEliminarTodos alternan el modal', () => {
      component.abrirConfirmEliminarTodos();
      expect(component.modalConfirmEliminarTodos()).toBe(true);
      component.cerrarConfirmEliminarTodos();
      expect(component.modalConfirmEliminarTodos()).toBe(false);
    });

    it('eliminarTodosFuncionarios no hace nada sin convocatoria', () => {
      component.convocatoria.set(null);
      component.eliminarTodosFuncionarios();
      expect(misionesService.deleteAllFuncionarios).not.toHaveBeenCalled();
    });

    it('eliminarTodosFuncionarios llama al service con misionId/convocatoriaId', () => {
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.eliminarTodosFuncionarios();
      expect(misionesService.deleteAllFuncionarios).toHaveBeenCalledWith('1', 'c9');
    });

    it('eliminarTodosFuncionarios actualiza estado, cierra modal y muestra toast tras éxito', () => {
      component.convocatoria.set(makeConvocatoria());
      component.modalConfirmEliminarTodos.set(true);
      component.eliminarTodosFuncionarios();
      expect(component.modalConfirmEliminarTodos()).toBe(false);
      expect(component.borrandoTodos()).toBe(false);
      expect(toastService.success).toHaveBeenCalled();
    });

    it('eliminarTodosFuncionarios muestra toast de error si falla', () => {
      misionesService.deleteAllFuncionarios.mockReturnValue(throwError(() => makeHttpError('error')));
      component.convocatoria.set(makeConvocatoria());
      component.eliminarTodosFuncionarios();
      expect(toastService.error).toHaveBeenCalled();
      expect(component.borrandoTodos()).toBe(false);
    });
  });

  // ── Editar funcionario ─────────────────────────────────────────────────────

  describe('Editar funcionario', () => {
    beforeEach(() => setup());

    it('abrirEditarFuncionario precarga el formulario y cierra el menú', () => {
      component.menuAbierto.set('x');
      const f = makeFuncionario({ numero_orden: 'ORD-2', boletin: 'BOL-2', observaciones: 'nota' });
      component.abrirEditarFuncionario(f);
      expect(component.editarFuncionarioForm.value).toEqual({ numero_orden: 'ORD-2', boletin: 'BOL-2', observaciones: 'nota' });
      expect(component.funcionarioEditando()).toEqual(f);
      expect(component.menuAbierto()).toBeNull();
    });

    it('cerrarEditarFuncionario limpia selección, error y formulario', () => {
      component.funcionarioEditando.set(makeFuncionario());
      component.modalErrorEditarFuncionario.set('err');
      component.editarFuncionarioForm.patchValue({ numero_orden: 'X' });
      component.cerrarEditarFuncionario();
      expect(component.funcionarioEditando()).toBeNull();
      expect(component.modalErrorEditarFuncionario()).toBeNull();
      expect(component.editarFuncionarioForm.value.numero_orden).toBe('');
    });

    it('guardarEdicionFuncionario no hace nada sin convocatoria/funcionario', () => {
      component.convocatoria.set(null);
      component.funcionarioEditando.set(makeFuncionario());
      component.guardarEdicionFuncionario();
      expect(misionesService.updateFuncionario).not.toHaveBeenCalled();
    });

    it('guardarEdicionFuncionario setea error si falta orden y boletín', () => {
      component.convocatoria.set(makeConvocatoria());
      component.funcionarioEditando.set(makeFuncionario());
      component.editarFuncionarioForm.patchValue({ numero_orden: '', boletin: '' });
      component.guardarEdicionFuncionario();
      expect(component.modalErrorEditarFuncionario()).toContain('orden');
      expect(misionesService.updateFuncionario).not.toHaveBeenCalled();
    });

    it('guardarEdicionFuncionario llama a updateFuncionario con el payload correcto', () => {
      component.convocatoria.set(makeConvocatoria({ id: 'c9' }));
      component.funcionarioEditando.set(makeFuncionario({ persona_id: '77' }));
      component.editarFuncionarioForm.patchValue({ numero_orden: 'ORD-9', boletin: '', observaciones: 'x' });
      component.guardarEdicionFuncionario();
      expect(misionesService.updateFuncionario).toHaveBeenCalledWith('1', 'c9', '77', {
        numero_orden: 'ORD-9',
        boletin: null,
        observaciones: 'x',
      });
    });

    it('guardarEdicionFuncionario actualiza estado, cierra el modal y muestra toast tras éxito', () => {
      component.convocatoria.set(makeConvocatoria());
      component.funcionarioEditando.set(makeFuncionario());
      component.editarFuncionarioForm.patchValue({ numero_orden: 'ORD-1' });
      component.guardarEdicionFuncionario();
      expect(component.funcionarioEditando()).toBeNull();
      expect(toastService.success).toHaveBeenCalled();
      expect(component.editando()).toBe(false);
    });

    it('guardarEdicionFuncionario muestra error del backend sin cerrar el modal', () => {
      misionesService.updateFuncionario.mockReturnValue(throwError(() => makeHttpError('fallo')));
      component.convocatoria.set(makeConvocatoria());
      component.funcionarioEditando.set(makeFuncionario());
      component.editarFuncionarioForm.patchValue({ numero_orden: 'ORD-1' });
      component.guardarEdicionFuncionario();
      expect(misionesService.updateFuncionario).toHaveBeenCalled();
      expect(component.modalErrorEditarFuncionario()).toBeTruthy();
      expect(component.editando()).toBe(false);
    });
  });

  // ── trackFuncionario ───────────────────────────────────────────────────────

  it('trackFuncionario devuelve el persona_id', async () => {
    await setup();
    expect(component.trackFuncionario(0, makeFuncionario({ persona_id: 'zz' }))).toBe('zz');
  });

  // ── parseError ─────────────────────────────────────────────────────────────

  describe('parseError (vía guardarConvocatoria)', () => {
    beforeEach(() => setup());

    it('usa service_response.service_status.http_message si está presente', () => {
      const err = new HttpErrorResponse({
        error: { service_response: { service_status: { http_message: 'mensaje del backend' } } },
        status: 400,
      });
      misionesService.editarConvocatoria.mockReturnValue(throwError(() => err));
      component.convocatoria.set(makeConvocatoria());
      component.guardarConvocatoria();
      expect(component.modalErrorConvocatoria()).toBe('mensaje del backend');
    });

    it('usa error.message si no hay service_response', () => {
      const err = new HttpErrorResponse({ error: { message: 'mensaje simple' }, status: 400 });
      misionesService.editarConvocatoria.mockReturnValue(throwError(() => err));
      component.convocatoria.set(makeConvocatoria());
      component.guardarConvocatoria();
      expect(component.modalErrorConvocatoria()).toBe('mensaje simple');
    });

    it('usa "Error inesperado" si no hay nada más', () => {
      const err = new HttpErrorResponse({ status: 500 });
      misionesService.editarConvocatoria.mockReturnValue(throwError(() => err));
      component.convocatoria.set(makeConvocatoria());
      component.guardarConvocatoria();
      expect(component.modalErrorConvocatoria()).toBeTruthy();
    });
  });

  // ── puedeGestionar ─────────────────────────────────────────────────────────

  describe('permiso misiones.gestionar', () => {
    it('es true si el service devuelve true', async () => {
      await setup('1', 'c1', true);
      expect(component.puedeGestionar()).toBe(true);
    });

    it('es false si el service devuelve false', async () => {
      await setup('1', 'c1', false);
      expect(component.puedeGestionar()).toBe(false);
    });

    it('llama a hasPermiso con "misiones.gestionar"', async () => {
      await setup();
      component.puedeGestionar();
      expect(authService.hasPermiso).toHaveBeenCalledWith('misiones.gestionar');
    });
  });
});
