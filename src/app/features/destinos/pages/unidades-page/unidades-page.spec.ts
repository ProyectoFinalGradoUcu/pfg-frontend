import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { UnidadesPage } from './unidades-page';
import { DestinosService } from '../../../../core/services/destinos.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ComandoCatalogo, Paginado, SubUnidadConDestinados } from '../../../../core/models/destinos.models';
import { Select } from '../../../../shared/components/select/select';

function makeSubUnidad(overrides: Partial<SubUnidadConDestinados> = {}): SubUnidadConDestinados {
  return {
    id: '1',
    codigo: 'B.A.I.',
    denominacion: 'Base Aérea I',
    vigente: true,
    unidad: { id: '1', codigo: 'C.A.O.', denominacion: 'Comando Aéreo de Operaciones' },
    total_destinados: 3,
    ...overrides,
  };
}

function makeComando(overrides: Partial<ComandoCatalogo> = {}): ComandoCatalogo {
  return { id: '1', codigo: 'CAO', denominacion: 'C.A.O.', vigente: true, total_bases: 2, ...overrides };
}

function makePagina(items: SubUnidadConDestinados[] = []): Paginado<SubUnidadConDestinados> {
  return { items, total: items.length, page: 1, pageSize: 10 };
}

describe('UnidadesPage (sub-unidades)', () => {
  let component: UnidadesPage;
  let fixture: ComponentFixture<UnidadesPage>;
  let destinosService: { listarSubUnidades: ReturnType<typeof vi.fn> };
  let catalogosService: {
    listarComandos: ReturnType<typeof vi.fn>;
    editarComando: ReturnType<typeof vi.fn>;
    editarBase: ReturnType<typeof vi.fn>;
  };
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    destinosService = { listarSubUnidades: vi.fn().mockReturnValue(of(makePagina())) };
    catalogosService = {
      listarComandos: vi.fn().mockReturnValue(
        of([
          makeComando({ id: '1', codigo: 'C.A.O.', denominacion: 'Comando Aéreo de Operaciones' }),
          makeComando({ id: '4', codigo: 'C.G.', denominacion: 'Comando General', vigente: false, total_bases: 0 }),
        ]),
      ),
      editarComando: vi.fn().mockReturnValue(of({})),
      editarBase: vi.fn().mockReturnValue(of({})),
    };
    auth = { hasPermiso: vi.fn().mockReturnValue(false) };
    toastService = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      // `Select` (app-select) se declara acá porque los filtros de comando y vigencia lo
      // usan con [ngModel] fuera de cualquier modal: sin el componente real registrado,
      // NgModel no encuentra un ControlValueAccessor sobre el elemento y explota con
      // NG01203 en cuanto corre detectChanges().
      declarations: [UnidadesPage, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: DestinosService, useValue: destinosService },
        { provide: CatalogosService, useValue: catalogosService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesPage);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  it('pide la primera página y los comandos al iniciar', () => {
    fixture.detectChanges();
    expect(destinosService.listarSubUnidades).toHaveBeenCalledWith({ page: 1, pageSize: 10, vigente: true });
    expect(catalogosService.listarComandos).toHaveBeenCalled();
    expect(component.comandoOpciones().map((o) => o.value)).toEqual(['1', '4']);
  });

  it('guarda items y total', () => {
    destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad()])));
    fixture.detectChanges();
    expect(component.subUnidades().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('muestra cada sub-unidad con su comando y la dotación actual', () => {
    destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad()])));
    fixture.detectChanges();
    const fila: string = fixture.nativeElement.querySelector('[data-testid="tabla-bases"] tbody tr').textContent;
    expect(fila).toContain('B.A.I.');
    expect(fila).toContain('Base Aérea I');
    expect(fila).toContain('Comando Aéreo de Operaciones');
    expect(fila).toContain('3');
  });

  it('denominación y código van en la misma celda, sin columna Vigente', () => {
    destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad()])));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const encabezados = Array.from(el.querySelectorAll('[data-testid="tabla-bases"] th')).map((th) => th.textContent!.trim());
    expect(encabezados).toEqual(['Base', 'Comando', 'Destinados hoy']);
    const celda = el.querySelector('[data-testid="tabla-bases"] tbody td')!;
    expect(celda.querySelector('strong')!.textContent).toBe('Base Aérea I');
    expect(celda.querySelector('.unidades__codigo')!.textContent).toBe('B.A.I.');
  });

  it('marca solo las bases dadas de baja', () => {
    destinosService.listarSubUnidades.mockReturnValue(
      of(makePagina([makeSubUnidad({ id: '1' }), makeSubUnidad({ id: '2', vigente: false })])),
    );
    fixture.detectChanges();
    const filas = fixture.nativeElement.querySelectorAll('[data-testid="tabla-bases"] tbody tr');
    expect(filas[0].querySelector('.unidades__badge')).toBeNull();
    expect(filas[1].querySelector('.unidades__badge').textContent.trim()).toBe('Dada de baja');
    expect(filas[1].classList).toContain('unidades__row--baja');
  });

  it('sin catalogos.gestionar no ofrece alta, edición ni baja', () => {
    destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad()])));
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Nuevo comando');
    expect(texto).not.toContain('Nueva base');
    expect(texto).not.toContain('Dar de baja');
    expect(texto).not.toContain('Dar de baja no borra nada');
  });

  describe('con catalogos.gestionar', () => {
    beforeEach(() => auth.hasPermiso.mockImplementation((p: string) => p === 'catalogos.gestionar'));

    it('muestra la nota sobre dar de baja', () => {
      fixture.detectChanges();
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Dar de baja no borra nada');
      expect(texto).not.toContain('liquidación');
      expect(texto).not.toContain('lógica');
    });

    it('cada pestaña ofrece crear lo suyo', () => {
      fixture.detectChanges();
      let texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Nueva base');
      expect(texto).not.toContain('Nuevo comando');

      component.cambiarTab('comandos');
      fixture.detectChanges();
      texto = fixture.nativeElement.textContent;
      expect(texto).toContain('Nuevo comando');
      expect(texto).not.toContain('Nueva base');
    });

    it('las acciones de una base vigente salen del menú kebab', () => {
      destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad({ id: '7' })])));
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.unidades__dropdown')).toBeNull();

      (el.querySelector('[data-testid="tabla-bases"] .unidades__menu-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      const items = Array.from(el.querySelectorAll('.unidades__dropdown-item')).map((b) => b.textContent!.trim());
      expect(items).toEqual(['Ver detalle', 'Editar', 'Dar de baja']);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('un comando dado de baja ofrece reactivar y no ver detalle', () => {
      fixture.detectChanges();
      component.cambiarTab('comandos');
      component.onComandoVigenteChange('');
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const botones = el.querySelectorAll('[data-testid="tabla-comandos"] .unidades__menu-btn');
      (botones[1] as HTMLButtonElement).click(); // C.G. está dado de baja
      fixture.detectChanges();
      const items = Array.from(el.querySelectorAll('.unidades__dropdown-item')).map((b) => b.textContent!.trim());
      expect(items).toEqual(['Editar', 'Reactivar']);
    });

    it('el menú distingue un comando y una base con el mismo id', () => {
      fixture.detectChanges();
      const evento = { stopPropagation: vi.fn(), currentTarget: document.body } as unknown as MouseEvent;
      component.toggleMenu({ tipo: 'comando', item: makeComando({ id: '1' }) }, evento);
      expect(component.esMenuAbierto('comando', '1')).toBe(true);
      expect(component.esMenuAbierto('base', '1')).toBe(false);
      component.toggleMenu({ tipo: 'comando', item: makeComando({ id: '1' }) }, evento);
      expect(component.menu()).toBeNull();
    });

    it('cada acción del menú lo cierra y abre lo que corresponde', () => {
      fixture.detectChanges();
      const evento = { stopPropagation: vi.fn(), currentTarget: document.body } as unknown as MouseEvent;
      const base = { tipo: 'base' as const, item: makeSubUnidad({ id: '7' }) };

      component.toggleMenu(base, evento);
      component.accionEditar(base);
      expect(component.menu()).toBeNull();
      expect(component.modal()).toBe('form');
      expect(component.baseEnEdicion()?.id).toBe('7');

      component.cerrarModal();
      component.toggleMenu(base, evento);
      component.accionBaja(base);
      expect(component.menu()).toBeNull();
      expect(component.modal()).toBe('baja');

      component.cerrarModal();
      component.accionVerDetalle(base);
      expect(router.navigate).toHaveBeenCalledWith(['/destinos/unidades', '7']);
    });

    it('cambiar de pestaña cierra el menú abierto', () => {
      fixture.detectChanges();
      const evento = { stopPropagation: vi.fn(), currentTarget: document.body } as unknown as MouseEvent;
      component.toggleMenu({ tipo: 'base', item: makeSubUnidad() }, evento);
      component.cambiarTab('comandos');
      expect(component.menu()).toBeNull();
    });

    it('lista los comandos con sus bases y solo pasa los vigentes al formulario', () => {
      fixture.detectChanges();
      expect(component.comandos().map((c) => c.id)).toEqual(['1', '4']);
      expect(component.comandosVigentes().map((c) => c.id)).toEqual(['1']);
    });

    it('abre el formulario de base nueva sin selección', () => {
      fixture.detectChanges();
      component.abrirCrearBase();
      expect(component.modal()).toBe('form');
      expect(component.formTipo()).toBe('base');
      expect(component.baseEnEdicion()).toBeNull();
    });

    it('al guardar avisa y recarga bases y comandos', () => {
      fixture.detectChanges();
      component.abrirCrearComando();
      destinosService.listarSubUnidades.mockClear();
      catalogosService.listarComandos.mockClear();

      component.onGuardado();

      expect(toastService.success).toHaveBeenCalledWith('Comando creado');
      expect(component.modal()).toBeNull();
      expect(destinosService.listarSubUnidades).toHaveBeenCalled();
      expect(catalogosService.listarComandos).toHaveBeenCalled();
    });

    it('bloquea la baja de una base con destinados sin llamar al backend', () => {
      fixture.detectChanges();
      component.abrirBajaBase(makeSubUnidad({ total_destinados: 3 }));
      expect(component.motivoBloqueoBaja()).toContain('3 funcionarios');
      component.confirmarBaja();
      expect(catalogosService.editarBase).not.toHaveBeenCalled();
    });

    it('bloquea la baja de un comando con bases vigentes', () => {
      fixture.detectChanges();
      component.abrirBajaComando(makeComando({ total_bases: 2 }));
      expect(component.motivoBloqueoBaja()).toContain('2 bases vigentes');
    });

    it('da de baja una base vacía con vigente: false', () => {
      fixture.detectChanges();
      component.abrirBajaBase(makeSubUnidad({ id: '7', total_destinados: 0 }));
      component.confirmarBaja();
      expect(catalogosService.editarBase).toHaveBeenCalledWith('7', { vigente: false });
      expect(toastService.success).toHaveBeenCalledWith('Base dada de baja');
      expect(component.modal()).toBeNull();
    });

    it('reactiva un comando', () => {
      fixture.detectChanges();
      component.abrirReactivarComando(makeComando({ id: '4', vigente: false }));
      component.confirmarReactivar();
      expect(catalogosService.editarComando).toHaveBeenCalledWith('4', { vigente: true });
      expect(toastService.success).toHaveBeenCalledWith('Comando reactivado');
    });

    it('si el backend rechaza la baja, muestra el error en el modal', () => {
      catalogosService.editarComando.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'Hay relaciones laborales' }, status: 409 })),
      );
      fixture.detectChanges();
      component.abrirBajaComando(makeComando({ total_bases: 0 }));
      component.confirmarBaja();
      expect(component.modal()).toBe('baja');
      expect(component.modalError()).toBeTruthy();
    });
  });

  it('muestra un toast si falla', () => {
    destinosService.listarSubUnidades.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Falló' }, status: 500 })),
    );
    fixture.detectChanges();
    expect(toastService.error).toHaveBeenCalledWith('Falló');
    expect(component.loading()).toBe(false);
  });

  it('debounce la búsqueda por código o denominación', () => {
    fixture.detectChanges();
    vi.useFakeTimers();
    component.onQueryInput('B.A.');
    expect(destinosService.listarSubUnidades).toHaveBeenCalledTimes(1); // solo la carga inicial
    vi.advanceTimersByTime(400);
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, query: 'B.A.', vigente: true });
  });

  it('filtra por comando con unidad_id numérico', () => {
    fixture.detectChanges();
    component.onComandoChange('4');
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, unidad_id: 4, vigente: true });
    component.onComandoChange(null);
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, vigente: true });
  });

  it('filtra por vigente en los dos sentidos y "Todas" no manda el filtro', () => {
    fixture.detectChanges();
    expect(component.filtroVigente()).toBe('true');
    component.onVigenteChange('true');
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, vigente: true });
    component.onVigenteChange('false');
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, vigente: false });
    component.onVigenteChange('');
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('hayFiltros y limpiarFiltros', () => {
    fixture.detectChanges();
    expect(component.hayFiltros()).toBe(false);
    component.onComandoChange('1');
    expect(component.hayFiltros()).toBe(true);
    component.limpiarFiltros();
    expect(component.hayFiltros()).toBe(false);
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, vigente: true });
  });

  it('ver todas las vigencias cuenta como filtro y borrar vuelve a vigentes', () => {
    fixture.detectChanges();
    component.onVigenteChange('');
    expect(component.hayFiltros()).toBe(true);
    component.limpiarFiltros();
    expect(component.filtroVigente()).toBe('true');
  });

  it('las bases vigentes de un comando llevan a la pestaña Bases filtrada por él', () => {
    fixture.detectChanges();
    component.cambiarTab('comandos');
    component.onQueryInput('algo');
    component.onVigenteChange('false');
    component.page.set(3);

    component.verBasesDeComando(makeComando({ id: '4' }));

    expect(component.tab()).toBe('bases');
    expect(component.filtroComandoId()).toBe('4');
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, unidad_id: 4, vigente: true });
  });

  it('el número de bases vigentes es un botón que filtra', () => {
    fixture.detectChanges();
    component.cambiarTab('comandos');
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('[data-testid="tabla-comandos"] .unidades__count-link') as HTMLButtonElement;
    link.click();
    fixture.detectChanges();
    expect(component.tab()).toBe('bases');
    expect(component.filtroComandoId()).toBe('1');
  });

  it('arranca en la pestaña Bases y muestra una tabla por pestaña', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.tab()).toBe('bases');
    expect(el.querySelector('[data-testid="tabla-bases"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="tabla-comandos"]')).toBeNull();

    component.cambiarTab('comandos');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="tabla-bases"]')).toBeNull();
    expect(el.querySelector('[data-testid="tabla-comandos"]')).not.toBeNull();
    expect(el.querySelector('.unidades__tab--active')!.textContent!.trim()).toBe('Comandos');
  });

  describe('filtros de comandos', () => {
    beforeEach(() => {
      catalogosService.listarComandos.mockReturnValue(
        of([
          makeComando({ id: '1', codigo: 'C.A.O.', denominacion: 'Comando Aéreo de Operaciones' }),
          makeComando({ id: '2', codigo: 'C.G.', denominacion: 'Comando General', vigente: false }),
          makeComando({ id: '3', codigo: 'C.L.', denominacion: 'Comando Logístico' }),
        ]),
      );
      fixture.detectChanges();
    });

    it('arrancan mostrando solo los vigentes', () => {
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['1', '3']);
      expect(component.hayFiltrosComandos()).toBe(false);
    });

    it('filtran en el cliente sin volver a pedir los comandos', () => {
      catalogosService.listarComandos.mockClear();
      component.onComandoVigenteChange('');
      component.onComandoQueryInput('general');
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['2']);
      expect(catalogosService.listarComandos).not.toHaveBeenCalled();
    });

    it('la búsqueda ignora mayúsculas y tildes, por código o denominación', () => {
      component.onComandoQueryInput('AEREO');
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['1']);
      component.onComandoQueryInput('c.l.');
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['3']);
    });

    it('filtra por vigencia y se combina con el texto', () => {
      component.onComandoVigenteChange('true');
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['1', '3']);
      component.onComandoVigenteChange('false');
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['2']);
      component.onComandoQueryInput('logístico');
      expect(component.comandosFiltrados()).toEqual([]);
      component.onComandoVigenteChange('');
      expect(component.comandosFiltrados().map((c) => c.id)).toEqual(['3']);
    });

    it('hayFiltrosComandos y limpiarFiltrosComandos', () => {
      expect(component.hayFiltrosComandos()).toBe(false);
      component.onComandoQueryInput('x');
      expect(component.hayFiltrosComandos()).toBe(true);
      component.onComandoVigenteChange('');
      component.limpiarFiltrosComandos();
      expect(component.hayFiltrosComandos()).toBe(false);
      expect(component.filtroComandoVigente()).toBe('true');
      expect(component.comandosFiltrados().length).toBe(2);
    });

    it('no tocan los filtros de bases', () => {
      component.onComandoQueryInput('general');
      expect(component.hayFiltros()).toBe(false);
    });

    it('sin resultados lo dice en la tabla', () => {
      component.cambiarTab('comandos');
      component.onComandoQueryInput('zzz');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No hay comandos que coincidan con los filtros.');
    });
  });

  it('pagina los comandos en el cliente y vuelve a la primera al filtrar', () => {
    catalogosService.listarComandos.mockReturnValue(
      of(Array.from({ length: 12 }, (_, i) => makeComando({ id: String(i + 1), codigo: `C${i + 1}` }))),
    );
    fixture.detectChanges();
    expect(component.comandosDePagina().length).toBe(10);
    component.comandosPage.set(2);
    expect(component.comandosDePagina().map((c) => c.id)).toEqual(['11', '12']);
    component.onComandoQueryInput('C1');
    expect(component.comandosPageActual()).toBe(1);
  });

  it('navega al detalle de la sub-unidad', () => {
    fixture.detectChanges();
    component.verDetalle(makeSubUnidad({ id: '12' }));
    expect(router.navigate).toHaveBeenCalledWith(['/destinos/unidades', '12']);
  });
});
