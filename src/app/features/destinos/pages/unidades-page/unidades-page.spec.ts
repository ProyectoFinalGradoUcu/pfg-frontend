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
    expect(destinosService.listarSubUnidades).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
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
    const fila: string = fixture.nativeElement.querySelectorAll('table')[1].querySelector('tbody tr').textContent;
    expect(fila).toContain('B.A.I.');
    expect(fila).toContain('Base Aérea I');
    expect(fila).toContain('C.A.O.');
    expect(fila).toContain('3');
  });

  it('sin catalogos.gestionar no ofrece alta, edición ni baja', () => {
    destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad()])));
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Nuevo comando');
    expect(texto).not.toContain('Nueva base');
    expect(texto).not.toContain('Dar de baja');
    expect(texto).toContain('compartido con liquidación');
  });

  describe('con catalogos.gestionar', () => {
    beforeEach(() => auth.hasPermiso.mockImplementation((p: string) => p === 'catalogos.gestionar'));

    it('ofrece crear comandos y bases, y acciones por fila', () => {
      destinosService.listarSubUnidades.mockReturnValue(of(makePagina([makeSubUnidad()])));
      fixture.detectChanges();
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Nuevo comando');
      expect(texto).toContain('Nueva base');
      expect(texto).toContain('Dar de baja');
      // C.G. está dado de baja en el mock
      expect(texto).toContain('Reactivar');
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
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, query: 'B.A.' });
  });

  it('filtra por comando con unidad_id numérico', () => {
    fixture.detectChanges();
    component.onComandoChange('4');
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, unidad_id: 4 });
    component.onComandoChange(null);
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('filtra por vigente en los dos sentidos', () => {
    fixture.detectChanges();
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
    expect(destinosService.listarSubUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('navega al detalle de la sub-unidad', () => {
    fixture.detectChanges();
    component.verDetalle(makeSubUnidad({ id: '12' }));
    expect(router.navigate).toHaveBeenCalledWith(['/destinos/unidades', '12']);
  });
});
