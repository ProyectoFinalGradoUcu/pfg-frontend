import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { EditarPermisosRolPage } from './editar-permisos-rol-page';
import { Paginator } from '../../../../shared/components/paginator/paginator';
import { AuthService } from '../../../../core/services/auth.service';
import { PermisosService } from '../../../../core/services/permisos.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { Permiso, Rol } from '../../../../core/models/auth.models';

const permiso = (id: number): Permiso =>
  ({ id: String(id), nombre: `permiso.${id}`, descripcion: `Permiso ${id}` }) as unknown as Permiso;

const pagina = (page: number) => ({
  items: Array.from({ length: 10 }, (_, i) => permiso((page - 1) * 10 + i + 1)),
  total: 25,
  page,
  pageSize: 10,
});

const rolCon = (nombre: string, permisos: Permiso[]): Rol => ({ id: '1', nombre, permisos }) as unknown as Rol;

describe('EditarPermisosRolPage: paginación', () => {
  let fixture: ComponentFixture<EditarPermisosRolPage>;
  let component: EditarPermisosRolPage;
  let permisos: { findAll: ReturnType<typeof vi.fn> };
  let roles: { findOne: ReturnType<typeof vi.fn>; activarPermiso: ReturnType<typeof vi.fn>; desactivarPermiso: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function setup(nombreRol = 'Consulta') {
    permisos = { findAll: vi.fn(({ page }: { page: number }) => of(pagina(page))) };
    roles = {
      findOne: vi.fn().mockReturnValue(of(rolCon(nombreRol, []))),
      activarPermiso: vi.fn(),
      desactivarPermiso: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [EditarPermisosRolPage, Paginator],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: RolesService, useValue: roles },
        { provide: PermisosService, useValue: permisos },
        { provide: AuthService, useValue: { hasPermiso: () => true } },
        { provide: ToastService, useValue: toast },
        { provide: ErrorModalService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditarPermisosRolPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const checks = () => [...el().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('muestra 10 permisos y el paginador', async () => {
    await setup();
    expect(checks().length).toBe(10);
    expect(el().querySelector('app-paginator nav')).not.toBeNull();
  });

  it('guardar un permiso en otra página no cambia de página ni recarga la tabla', async () => {
    await setup();
    component.onPageChange(2);
    fixture.detectChanges();
    permisos.findAll.mockClear();
    roles.activarPermiso.mockReturnValue(of(rolCon('Consulta', [permiso(11)])));

    component.togglePermiso(permiso(11), true);
    fixture.detectChanges();

    expect(component.page()).toBe(2);
    expect(permisos.findAll).not.toHaveBeenCalled();
    expect(checks()[0].checked).toBe(true);
  });

  it('al volver a la página, el checkbox refleja lo guardado', async () => {
    await setup();
    component.onPageChange(2);
    roles.activarPermiso.mockReturnValue(of(rolCon('Consulta', [permiso(11)])));
    component.togglePermiso(permiso(11), true);

    component.onPageChange(1);
    fixture.detectChanges();
    component.onPageChange(2);
    fixture.detectChanges();

    expect(checks()[0].checked).toBe(true);
    expect(checks()[1].checked).toBe(false);
  });

  it('si falla un cambio de página avisa y conserva la página y los datos cargados', async () => {
    await setup();
    const cargados = component.permisos();
    permisos.findAll.mockReturnValue(throwError(() => ({ status: 500, error: {} })));

    component.onPageChange(2);
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
    expect(component.page()).toBe(1);
    expect(component.permisos()).toBe(cargados);
    expect(el().querySelector('.paginator__btn--active')?.textContent?.trim()).toBe('1');
  });

  it('el rol administrador no se puede modificar en ninguna página', async () => {
    await setup('Administrador del sistema');
    expect(checks().every((c) => c.disabled)).toBe(true);

    component.onPageChange(2);
    fixture.detectChanges();
    expect(checks().length).toBe(10);
    expect(checks().every((c) => c.disabled)).toBe(true);
  });
});
