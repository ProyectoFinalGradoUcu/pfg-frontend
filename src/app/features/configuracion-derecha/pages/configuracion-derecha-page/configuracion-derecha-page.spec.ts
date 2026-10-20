import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ConfiguracionDerechaPage } from './configuracion-derecha-page';
import { DerechaService } from '../../../../core/services/derecha.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Select } from '../../../../shared/components/select/select';
import {
  Afectado,
  EscalaDerechaResumen,
  GradoDerechaResumen,
  Impacto,
  PersonalDerecha,
} from '../../../../core/models/derecha.models';

// ── Helpers ────────────────────────────────────────────────────────────────────

const GRAL = '15';
const BRIG = '14';
const SOM = '6';
const SGTO = '4';

function makePersona(overrides: Partial<PersonalDerecha> = {}): PersonalDerecha {
  return {
    persona_id: '1',
    nombre: 'Funcionario',
    cedula: '60000001',
    escala: 'OFICIALES',
    grado_id: BRIG,
    grado: 'Brig. Gral.',
    escalafon_id: '1',
    escalafon: 'AV',
    derecha: 1,
    numor: 1,
    ...overrides,
  };
}

/**
 * Oficiales: Gral p1 · Brig p2 (AV, d2), p3 (NAV, d3), p4 (AV, d4).
 * Subalternos: S.O.M. p7 · Sgto p8, p9.
 */
function makePadron(): PersonalDerecha[] {
  const of_ = (id: string, grado: string, nombreGrado: string, esc: [string, string], derecha: number, numor: number, nombre: string, cedula: string) =>
    makePersona({ persona_id: id, grado_id: grado, grado: nombreGrado, escalafon_id: esc[0], escalafon: esc[1], derecha, numor, nombre, cedula });
  const sub = (id: string, grado: string, nombreGrado: string, derecha: number, numor: number, nombre: string) =>
    makePersona({ persona_id: id, escala: 'SUBALTERNOS', grado_id: grado, grado: nombreGrado, escalafon_id: '13', escalafon: 'ST', derecha, numor, nombre, cedula: `6000000${id}` });
  return [
    of_('1', GRAL, 'Gral.', ['1', 'AV'], 1, 1, 'Sofía Guerrico', '12345678'),
    of_('2', BRIG, 'Brig. Gral.', ['1', 'AV'], 2, 1, 'Andrés Ramírez', '60000002'),
    of_('3', BRIG, 'Brig. Gral.', ['2', 'NAV'], 3, 1, 'Mariana Díaz', '60000003'),
    of_('4', BRIG, 'Brig. Gral.', ['1', 'AV'], 4, 2, 'Carlos Pérez', '60000004'),
    sub('7', SOM, 'S.O.M.', 1, 1, 'Jorge Silva'),
    sub('8', SGTO, 'Sgto.', 2, 1, 'Valentina Cruz'),
    sub('9', SGTO, 'Sgto.', 3, 2, 'Cecilia Torres'),
  ];
}

function makeGrado(id: string, denominacion: string, escala: 'OFICIALES' | 'SUBALTERNOS', cantidad: number): GradoDerechaResumen {
  return { id, codigo: id, denominacion, escala, cantidad, derecha_desde: null, derecha_hasta: null, tope: null, excede_tope: false };
}

function makeEscalas(): EscalaDerechaResumen[] {
  return [
    {
      escala: 'OFICIALES',
      nombre: 'Oficiales',
      grados: [makeGrado(GRAL, 'Gral.', 'OFICIALES', 1), makeGrado(BRIG, 'Brig. Gral.', 'OFICIALES', 3)],
    },
    {
      escala: 'SUBALTERNOS',
      nombre: 'Personal Subalterno',
      grados: [makeGrado(SOM, 'S.O.M.', 'SUBALTERNOS', 1), makeGrado(SGTO, 'Sgto.', 'SUBALTERNOS', 2)],
    },
  ];
}

function makeAfectado(persona_id: string, antes: number, despues: number): Afectado {
  return { persona_id, nombre: `P${persona_id}`, grado: 'Brig. Gral.', escalafon: 'AV', antes, despues };
}

function makeImpacto(overrides: Partial<Impacto> = {}): Impacto {
  return { afectados: 0, derecha: [], numor: [], avisos: [], ...overrides };
}

/** p4 pasa a derecha 2 y corre a p2 y p3. */
const IMPACTO_P4_A_2 = makeImpacto({
  afectados: 3,
  derecha: [makeAfectado('4', 4, 2), makeAfectado('2', 2, 3), makeAfectado('3', 3, 4)],
});

function makeHttpError(message: string, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: { message }, status });
}

// ── Spec ───────────────────────────────────────────────────────────────────────

describe('ConfiguracionDerechaPage', () => {
  let component: ConfiguracionDerechaPage;
  let fixture: ComponentFixture<ConfiguracionDerechaPage>;
  let derechaService: ReturnType<typeof makeDerechaServiceSpy>;
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function makeDerechaServiceSpy(padron: PersonalDerecha[]) {
    return {
      listarEscalas: vi.fn().mockReturnValue(of(makeEscalas())),
      listarPersonal: vi.fn().mockReturnValue(of(padron)),
      previsualizar: vi.fn().mockReturnValue(of(IMPACTO_P4_A_2)),
      aplicarCambios: vi.fn().mockReturnValue(of({ ...IMPACTO_P4_A_2, lote_id: 'l1' })),
      sugerirOrden: vi.fn(),
    };
  }

  async function setup(padron: PersonalDerecha[] = makePadron()) {
    vi.useFakeTimers();
    derechaService = makeDerechaServiceSpy(padron);
    toastService = { success: vi.fn(), error: vi.fn() };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [ConfiguracionDerechaPage, Select],
      imports: [FormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: DerechaService, useValue: derechaService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguracionDerechaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const fila = (personaId: string) => component.filas().find((f) => f.persona_id === personaId)!;
  const ids = () => component.filtrados().map((p) => p.persona_id);

  /** Simula escribir un número en la columna y salir del campo. */
  function escribir(personaId: string, campo: 'derecha' | 'numor', valor: string): HTMLInputElement {
    const input = document.createElement('input');
    input.value = valor;
    component.onValor(fila(personaId), campo, { target: input } as unknown as Event);
    return input;
  }

  /** Deja pasar el debounce de la previsualización. */
  function esperarPreview(): void {
    vi.advanceTimersByTime(300);
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // ── Carga ──────────────────────────────────────────────────────────────────

  describe('carga', () => {
    it('trae las escalas y todo el personal al iniciar', async () => {
      await setup();
      expect(derechaService.listarEscalas).toHaveBeenCalled();
      expect(derechaService.listarPersonal).toHaveBeenCalled();
      expect(component.filtrados()).toHaveLength(7);
      expect(component.cargando()).toBe(false);
    });

    it('si falla la carga avisa con un toast', async () => {
      await setup();
      derechaService.listarPersonal.mockReturnValue(throwError(() => makeHttpError('Sin conexión')));
      (component as any).cargar();
      expect(toastService.error).toHaveBeenCalledWith('Sin conexión');
      expect(component.cargando()).toBe(false);
    });
  });

  // ── Paginación ─────────────────────────────────────────────────────────────

  describe('paginación', () => {
    const muchos = () =>
      Array.from({ length: 25 }, (_, i) =>
        makePersona({ persona_id: String(i + 1), derecha: i + 1, nombre: `Funcionario ${i + 1}` }),
      );

    it('muestra como máximo 10 por página', async () => {
      await setup(muchos());
      expect(component.tamanioPagina).toBe(10);
      expect(component.filas()).toHaveLength(10);
      expect(component.filas()[0].persona_id).toBe('1');
    });

    it('la última página trae el resto', async () => {
      await setup(muchos());
      component.pagina.set(3);
      expect(component.filas().map((f) => f.persona_id)).toEqual(['21', '22', '23', '24', '25']);
    });

    it('cambiar un filtro vuelve a la primera página', async () => {
      await setup(muchos());
      component.pagina.set(3);
      component.onTexto({ target: { value: 'Funcionario 1' } } as unknown as Event);
      expect(component.pagina()).toBe(1);
    });
  });

  // ── Filtros ────────────────────────────────────────────────────────────────

  describe('filtros', () => {
    it('sin filtros muestra a todos, Oficiales primero', async () => {
      await setup();
      expect(ids()).toEqual(['1', '2', '3', '4', '7', '8', '9']);
      expect(component.hayFiltros()).toBe(false);
    });

    it('filtra por varias escalas, grados y escalafones combinados', async () => {
      await setup();
      component.onEscalas(['OFICIALES']);
      expect(ids()).toEqual(['1', '2', '3', '4']);

      component.onGrados([BRIG]);
      expect(ids()).toEqual(['2', '3', '4']);

      component.onEscalafones(['1']);
      expect(ids()).toEqual(['2', '4']);
      expect(component.hayFiltros()).toBe(true);
    });

    it('acepta varios grados de escalas distintas', async () => {
      await setup();
      component.onGrados([GRAL, SGTO]);
      expect(ids()).toEqual(['1', '8', '9']);
    });

    it('los grados que se ofrecen dependen de las escalas elegidas', async () => {
      await setup();
      expect(component.opcionesGrado().map((g) => g.id)).toEqual([GRAL, BRIG, SOM, SGTO]);
      component.onEscalas(['SUBALTERNOS']);
      expect(component.opcionesGrado().map((g) => g.id)).toEqual([SOM, SGTO]);
    });

    it('al cambiar de escala suelta los grados y escalafones que quedaron afuera', async () => {
      await setup();
      component.onGrados([BRIG, SGTO]);
      component.onEscalafones(['2', '13']);
      component.onEscalas(['SUBALTERNOS']);

      expect(component.filtroGrados()).toEqual([SGTO]);
      expect(component.filtroEscalafones()).toEqual(['13']);
    });

    it('los escalafones que se ofrecen son los del personal de los grados elegidos', async () => {
      await setup();
      component.onGrados([GRAL]);
      expect(component.opcionesEscalafon()).toEqual([{ id: '1', codigo: 'AV' }]);
    });

    it('busca por nombre sin importar tildes ni mayúsculas', async () => {
      await setup();
      component.onTexto({ target: { value: 'PEREZ' } } as unknown as Event);
      expect(ids()).toEqual(['4']);
    });

    it('busca por cédula', async () => {
      await setup();
      component.onTexto({ target: { value: '1234' } } as unknown as Event);
      expect(ids()).toEqual(['1']);
    });

    it('limpiar deja todos los filtros vacíos', async () => {
      await setup();
      component.onEscalas(['OFICIALES']);
      component.onGrados([BRIG]);
      component.onTexto({ target: { value: 'x' } } as unknown as Event);
      component.limpiarFiltros();

      expect(component.hayFiltros()).toBe(false);
      expect(component.filtrados()).toHaveLength(7);
    });

    it('"Sugerir orden" se ofrece solo con un único grado elegido', async () => {
      await setup();
      expect(component.gradoFiltrado()).toBeNull();
      component.onGrados([BRIG]);
      expect(component.gradoFiltrado()?.id).toBe(BRIG);
      component.onGrados([BRIG, GRAL]);
      expect(component.gradoFiltrado()).toBeNull();
    });
  });

  // ── Edición ────────────────────────────────────────────────────────────────

  describe('edición', () => {
    it('rechaza una derecha fuera del bloque del grado y restaura el valor', async () => {
      await setup();
      const input = escribir('4', 'derecha', '5');

      expect(component.errorValor()).toEqual({
        persona_id: '4',
        campo: 'derecha',
        mensaje: 'La derecha de Brig. Gral. va de 2 a 4.',
      });
      expect(input.value).toBe('4');
      expect(component.cambios()).toEqual([]);
    });

    it('rechaza un numor fuera de su grupo (grado y escalafón)', async () => {
      await setup();
      escribir('4', 'numor', '3');
      expect(component.errorValor()?.mensaje).toBe('El numor de Brig. Gral. AV va de 1 a 2.');
      expect(component.cambios()).toEqual([]);
    });

    it('rechaza un valor vacío o con decimales', async () => {
      await setup();
      escribir('4', 'derecha', '');
      escribir('4', 'derecha', '2.5');
      expect(component.cambios()).toEqual([]);
    });

    it('escribir el mismo valor no agrega un cambio', async () => {
      await setup();
      escribir('4', 'derecha', '4');
      expect(component.cambios()).toEqual([]);
    });

    it('un valor válido queda pendiente y se ve en la fila antes de la previsualización', async () => {
      await setup();
      escribir('4', 'derecha', '2');

      expect(component.cambios()).toEqual([{ persona_id: 4, derecha: 2 }]);
      expect(component.hayCambios()).toBe(true);
      expect(fila('4').derechaNueva).toBe(2);
      expect(fila('4').cambiaDerecha).toBe(true);
      expect(component.calculando()).toBe(true);
    });

    it('previsualiza el lote y muestra en la tabla a los que se corren', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      esperarPreview();

      expect(derechaService.previsualizar).toHaveBeenCalledWith({
        operacion: 'REORDEN',
        cambios: [{ persona_id: 4, derecha: 2 }],
      });
      expect(component.calculando()).toBe(false);
      expect([fila('2').derechaNueva, fila('3').derechaNueva, fila('4').derechaNueva]).toEqual([3, 4, 2]);
      expect(fila('2').cambiaDerecha).toBe(true);
      expect(fila('2').cambiaNumor).toBe(false);
    });

    it('junta varios cambios, de grados distintos, en un mismo lote', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      escribir('9', 'numor', '1');
      escribir('3', 'derecha', '4');
      esperarPreview();

      expect(component.cambios()).toEqual([
        { persona_id: 4, derecha: 2 },
        { persona_id: 9, numor: 1 },
        { persona_id: 3, derecha: 4 },
      ]);
      expect(derechaService.previsualizar).toHaveBeenLastCalledWith({
        operacion: 'REORDEN',
        cambios: component.cambios(),
      });
    });

    it('si el último cambio no se puede aplicar lo descarta y previsualiza lo anterior', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      esperarPreview();

      derechaService.previsualizar.mockReturnValueOnce(throwError(() => makeHttpError('No se puede')));
      escribir('9', 'numor', '1');
      esperarPreview();

      expect(toastService.error).toHaveBeenCalledWith('No se puede');
      expect(component.cambios()).toEqual([{ persona_id: 4, derecha: 2 }]);
      esperarPreview();
      expect(derechaService.previsualizar).toHaveBeenLastCalledWith({
        operacion: 'REORDEN',
        cambios: [{ persona_id: 4, derecha: 2 }],
      });
    });

    it('si los cambios dejan todo como estaba, no queda nada pendiente', async () => {
      await setup();
      derechaService.previsualizar.mockReturnValue(of(makeImpacto({ afectados: 0 })));
      escribir('4', 'derecha', '2');
      esperarPreview();

      expect(component.cambios()).toEqual([]);
      expect(component.hayCambios()).toBe(false);
      expect(component.impacto()).toBeNull();
    });

    it('cambiar los filtros no descarta los cambios pendientes', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      component.onEscalas(['SUBALTERNOS']);
      expect(component.cambios()).toHaveLength(1);
    });

    it('descartar borra todos los cambios y la previsualización', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      esperarPreview();
      component.descartar();

      expect(component.cambios()).toEqual([]);
      expect(component.impacto()).toBeNull();
      expect(fila('4').derechaNueva).toBe(4);
      expect(fila('4').cambiaDerecha).toBe(false);
    });
  });

  // ── Sugerir orden ──────────────────────────────────────────────────────────

  describe('sugerir orden', () => {
    it('agrega el orden sugerido del grado como un cambio más', async () => {
      await setup();
      derechaService.sugerirOrden.mockReturnValue(
        of({ grado_id: BRIG, criterio: 'ANTIGUEDAD', orden: ['3', '4', '2'], items: [], sin_datos: [] }),
      );
      escribir('9', 'numor', '1');
      component.onGrados([BRIG]);

      const select = document.createElement('select');
      select.innerHTML = '<option value=""></option><option value="ANTIGUEDAD"></option>';
      select.value = 'ANTIGUEDAD';
      component.onSugerir({ target: select } as unknown as Event);

      expect(derechaService.sugerirOrden).toHaveBeenCalledWith(BRIG, 'ANTIGUEDAD');
      expect(component.cambios()).toEqual([
        { persona_id: 9, numor: 1 },
        { grado_id: 14, orden: [3, 4, 2] },
      ]);
      expect(select.value).toBe('');
      expect(toastService.success).toHaveBeenCalled();
    });
  });

  // ── Confirmar ──────────────────────────────────────────────────────────────

  describe('confirmar', () => {
    it('guarda todos los cambios juntos con el motivo y recarga', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      escribir('9', 'numor', '1');
      esperarPreview();
      derechaService.listarPersonal.mockClear();

      component.confirmar('Boletín 12/2026');

      expect(derechaService.aplicarCambios).toHaveBeenCalledWith({
        cambios: [
          { persona_id: 4, derecha: 2 },
          { persona_id: 9, numor: 1 },
        ],
        motivo: 'Boletín 12/2026',
      });
      expect(toastService.success).toHaveBeenCalledWith('Cambios guardados: 3 funcionarios.');
      expect(component.cambios()).toEqual([]);
      expect(component.confirmando()).toBe(false);
      expect(derechaService.listarPersonal).toHaveBeenCalled();
    });

    it('sin motivo no lo manda', async () => {
      await setup();
      escribir('4', 'derecha', '2');
      component.confirmar('');
      expect(derechaService.aplicarCambios).toHaveBeenCalledWith({
        cambios: [{ persona_id: 4, derecha: 2 }],
        motivo: undefined,
      });
    });

    it('sin cambios no hace nada', async () => {
      await setup();
      component.confirmar('x');
      expect(derechaService.aplicarCambios).not.toHaveBeenCalled();
    });

    it('si falla, avisa y conserva los cambios para reintentar', async () => {
      await setup();
      derechaService.aplicarCambios.mockReturnValue(throwError(() => makeHttpError('Conflicto', 409)));
      escribir('4', 'derecha', '2');
      component.confirmar('');

      expect(toastService.error).toHaveBeenCalledWith('Conflicto');
      expect(component.cambios()).toHaveLength(1);
      expect(component.confirmando()).toBe(false);
    });
  });

  // ── Template ───────────────────────────────────────────────────────────────

  describe('template', () => {
    it('el título dice "Configuración de derecha y numor"', async () => {
      await setup();
      const header = fixture.nativeElement.querySelector('app-page-header');
      expect(header.getAttribute('title')).toBe('Configuración de derecha y numor');
    });

    it('el panel de cambios va debajo de la tabla y solo con cambios pendientes', async () => {
      await setup();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.cdp__panel')).toBeNull();

      escribir('4', 'derecha', '2');
      fixture.detectChanges();
      const panel = el.querySelector('.cdp__panel')!;
      expect(panel.textContent).toContain('1 cambio pendiente');
      // Hermano posterior de la tabla, no una columna al costado.
      expect(panel.previousElementSibling?.classList.contains('cdp__cuerpo')).toBe(true);
    });

    it('el botón de limpiar filtros está deshabilitado sin filtros', async () => {
      await setup();
      const el: HTMLElement = fixture.nativeElement;
      const limpiar = el.querySelector<HTMLButtonElement>('.btn--clear')!;
      expect(limpiar.disabled).toBe(true);

      component.onTexto({ target: { value: 'ana' } } as unknown as Event);
      fixture.detectChanges();
      expect(limpiar.disabled).toBe(false);
    });
  });
});
