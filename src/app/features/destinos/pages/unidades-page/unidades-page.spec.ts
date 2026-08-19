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
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Paginado, Unidad, UnidadConDestinados } from '../../../../core/models/destinos.models';
import { Select } from '../../../../shared/components/select/select';

function makeUnidad(overrides: Partial<UnidadConDestinados> = {}): UnidadConDestinados {
  return {
    id: '5',
    codigo: 'EMGFA',
    denominacion: 'E.M.G.F.A.',
    tipo: 'Organismo',
    vigente: true,
    total_destinados: 3,
    ...overrides,
  };
}

function makePagina(items: UnidadConDestinados[] = []): Paginado<UnidadConDestinados> {
  return { items, total: items.length, page: 1, pageSize: 10 };
}

function makeUnidadCatalogo(overrides: Partial<Unidad> = {}): Unidad {
  return {
    id: '5',
    codigo: 'EMGFA',
    denominacion: 'E.M.G.F.A.',
    tipo: 'Organismo',
    vigente: true,
    ...overrides,
  };
}

describe('UnidadesPage', () => {
  let component: UnidadesPage;
  let fixture: ComponentFixture<UnidadesPage>;
  let destinosService: { listarUnidades: ReturnType<typeof vi.fn> };
  let catalogosService: { darDeBajaUnidad: ReturnType<typeof vi.fn>; editarUnidad: ReturnType<typeof vi.fn> };
  let authService: { hasPermiso: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    destinosService = { listarUnidades: vi.fn().mockReturnValue(of(makePagina())) };
    catalogosService = {
      darDeBajaUnidad: vi.fn().mockReturnValue(of(makeUnidadCatalogo({ vigente: false }))),
      editarUnidad: vi.fn().mockReturnValue(of(makeUnidadCatalogo({ vigente: true }))),
    };
    authService = { hasPermiso: vi.fn().mockReturnValue(false) };
    toastService = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      // `Select` (app-select) se declara acá porque los filtros de tipo y vigencia lo
      // usan con [ngModel] fuera de cualquier modal: sin el componente real registrado,
      // NgModel no encuentra un ControlValueAccessor sobre el elemento y explota con
      // NG01203 en cuanto corre detectChanges().
      declarations: [UnidadesPage, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: DestinosService, useValue: destinosService },
        { provide: CatalogosService, useValue: catalogosService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesPage);
    component = fixture.componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  it('pide la primera página al iniciar', () => {
    fixture.detectChanges();
    expect(destinosService.listarUnidades).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('guarda items y total', () => {
    destinosService.listarUnidades.mockReturnValue(of(makePagina([makeUnidad()])));
    fixture.detectChanges();
    expect(component.unidades().length).toBe(1);
    expect(component.total()).toBe(1);
  });

  it('muestra un toast si falla', () => {
    destinosService.listarUnidades.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'Falló' }, status: 500 })),
    );
    fixture.detectChanges();
    expect(toastService.error).toHaveBeenCalledWith('Falló');
    expect(component.loading()).toBe(false);
  });

  it('debounce la búsqueda por denominación', () => {
    fixture.detectChanges();
    vi.useFakeTimers();
    component.onQueryInput('aérea');
    expect(destinosService.listarUnidades).toHaveBeenCalledTimes(1); // solo la carga inicial
    vi.advanceTimersByTime(400);
    expect(destinosService.listarUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, query: 'aérea' });
  });

  it('filtra por tipo', () => {
    fixture.detectChanges();
    component.onTipoChange('Organismo');
    expect(destinosService.listarUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, tipo: 'Organismo' });
  });

  it('filtra por vigente en los dos sentidos', () => {
    fixture.detectChanges();
    component.onVigenteChange('true');
    expect(destinosService.listarUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, vigente: true });
    component.onVigenteChange('false');
    expect(destinosService.listarUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, vigente: false });
    component.onVigenteChange('');
    expect(destinosService.listarUnidades).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it('navega al detalle de la unidad', () => {
    fixture.detectChanges();
    component.verDetalle(makeUnidad());
    expect(router.navigate).toHaveBeenCalledWith(['/destinos/unidades', '5']);
  });

  it('puedeGestionar depende de catalogos.gestionar', () => {
    authService.hasPermiso.mockReturnValue(true);
    fixture.detectChanges();
    expect(component.puedeGestionar()).toBe(true);
    expect(authService.hasPermiso).toHaveBeenCalledWith('catalogos.gestionar');
  });

  describe('modal de unidad', () => {
    beforeEach(() => fixture.detectChanges());

    it('abrirCrear abre el modal sin unidad en edición', () => {
      component.abrirCrear();
      expect(component.modal()).toBe('form');
      expect(component.unidadEnEdicion()).toBeNull();
    });

    it('abrirEditar cierra el menú y abre el modal con la unidad de la fila', () => {
      const u = makeUnidad();
      component.openMenuId.set(u.id);
      component.abrirEditar(u);
      expect(component.openMenuId()).toBeNull();
      expect(component.modal()).toBe('form');
      expect(component.unidadEnEdicion()).toBe(u);
    });

    it('onGuardado cierra el modal, avisa y recarga el listado', () => {
      component.abrirCrear();
      destinosService.listarUnidades.mockClear();
      component.onGuardado();
      expect(component.modal()).toBeNull();
      expect(toastService.success).toHaveBeenCalledWith('Unidad creada correctamente');
      expect(destinosService.listarUnidades).toHaveBeenCalled();
    });

    it('onGuardado avisa con el mensaje de edición cuando venía de abrirEditar', () => {
      component.abrirEditar(makeUnidad());
      component.onGuardado();
      expect(toastService.success).toHaveBeenCalledWith('Unidad actualizada correctamente');
    });

    it('cerrarModal limpia el estado sin recargar', () => {
      component.abrirEditar(makeUnidad());
      destinosService.listarUnidades.mockClear();
      component.cerrarModal();
      expect(component.modal()).toBeNull();
      expect(component.unidadEnEdicion()).toBeNull();
      expect(destinosService.listarUnidades).not.toHaveBeenCalled();
    });
  });

  describe('menú kebab', () => {
    beforeEach(() => fixture.detectChanges());

    it('se abre y se cierra', () => {
      const event = { stopPropagation: vi.fn(), currentTarget: { getBoundingClientRect: () => ({ bottom: 10, right: 20 }) } } as unknown as MouseEvent;
      component.toggleMenu('5', event);
      expect(component.openMenuId()).toBe('5');
      component.toggleMenu('5', event);
      expect(component.openMenuId()).toBeNull();
    });
  });

  describe('dar de baja / reactivar', () => {
    beforeEach(() => fixture.detectChanges());

    it('abrirBaja cierra el menú y abre el modal de confirmación', () => {
      const u = makeUnidad({ vigente: true });
      component.openMenuId.set(u.id);
      component.abrirBaja(u);
      expect(component.openMenuId()).toBeNull();
      expect(component.modal()).toBe('baja');
      expect(component.unidadSeleccionada()).toBe(u);
    });

    it('confirmarBaja llama a darDeBajaUnidad, avisa y recarga', () => {
      component.abrirBaja(makeUnidad({ total_destinados: 0 }));
      destinosService.listarUnidades.mockClear();
      component.confirmarBaja();
      expect(catalogosService.darDeBajaUnidad).toHaveBeenCalledWith('5');
      expect(toastService.success).toHaveBeenCalledWith('Unidad dada de baja correctamente');
      expect(destinosService.listarUnidades).toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });

    it('abrirReactivar cierra el menú y abre el modal de confirmación', () => {
      const u = makeUnidad({ vigente: false });
      component.openMenuId.set(u.id);
      component.abrirReactivar(u);
      expect(component.openMenuId()).toBeNull();
      expect(component.modal()).toBe('reactivar');
      expect(component.unidadSeleccionada()).toBe(u);
    });

    it('confirmarReactivar manda PATCH { vigente: true } y no toca otras claves', () => {
      component.abrirReactivar(makeUnidad({ vigente: false }));
      component.confirmarReactivar();
      expect(catalogosService.editarUnidad).toHaveBeenCalledWith('5', { vigente: true });
      expect(toastService.success).toHaveBeenCalledWith('Unidad reactivada correctamente');
    });

    it('si la baja falla, muestra el error del backend y el modal se queda abierto', () => {
      catalogosService.darDeBajaUnidad.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'No se pudo dar de baja' }, status: 500 })),
      );
      component.abrirBaja(makeUnidad({ total_destinados: 0 }));
      component.confirmarBaja();
      expect(component.modalError()).toBe('No se pudo dar de baja');
      expect(component.modal()).toBe('baja');
    });

    it('con funcionarios revistando marca la baja como bloqueada y no llama al backend', () => {
      component.abrirBaja(makeUnidad({ total_destinados: 3 }));
      expect(component.bajaBloqueada()).toBe(true);
      component.confirmarBaja();
      expect(catalogosService.darDeBajaUnidad).not.toHaveBeenCalled();
      expect(component.modal()).toBe('baja');
    });

    it('sin funcionarios revistando la baja no está bloqueada', () => {
      component.abrirBaja(makeUnidad({ total_destinados: 0 }));
      expect(component.bajaBloqueada()).toBe(false);
    });

    it('el 409 del backend igual se muestra: pueden asignar alguien con el modal abierto', () => {
      catalogosService.darDeBajaUnidad.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              error: {
                message:
                  'No se puede dar de baja la unidad "E.M.G.F.A.": tiene 3 funcionarios con destino vigente. Reasignalos antes de darla de baja.',
              },
              status: 409,
            }),
        ),
      );
      component.abrirBaja(makeUnidad({ total_destinados: 0 }));
      component.confirmarBaja();
      expect(component.modalError()).toContain('tiene 3 funcionarios con destino vigente');
      expect(component.modal()).toBe('baja');
    });

    it('la reactivación no se valida contra la dotación', () => {
      component.abrirReactivar(makeUnidad({ vigente: false, total_destinados: 3 }));
      component.confirmarReactivar();
      expect(catalogosService.editarUnidad).toHaveBeenCalledWith('5', { vigente: true });
    });
  });
});
