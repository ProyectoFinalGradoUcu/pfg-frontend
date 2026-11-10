import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { UsuariosYRolesPage } from './usuarios-y-roles-page';
import { Paginator } from '../../../../shared/components/paginator/paginator';
import { Select } from '../../../../shared/components/select/select';
import { SearchInput } from '../../../../shared/components/search-input/search-input';
import { ClearFiltersButton } from '../../../../shared/components/clear-filters-button/clear-filters-button';
import { AuthService } from '../../../../core/services/auth.service';
import { InvitacionesService } from '../../../../core/services/invitaciones.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { Invitacion, Rol } from '../../../../core/models/auth.models';
import { BaseOpcion } from '../../../../core/models/personal.models';

const invitacion = (id: number): Invitacion =>
  ({
    id: String(id),
    email: `p${id}@fau.mil.uy`,
    estado: 'pendiente',
    roles: [],
    creadoEn: '2026-01-01',
    expiraEn: '2026-01-03',
  }) as unknown as Invitacion;

const rol = (id: number): Rol =>
  ({ id: String(id), nombre: `Rol ${id}`, descripcion: null, permisos: [], cantidadUsuarios: 0 }) as unknown as Rol;

const bases: BaseOpcion[] = [
  { id: 12, codigo: 'BAI', denominacion: 'B.A.I.', unidad_id: 3, comando: { id: 3, codigo: 'CAO', denominacion: 'C.A.O.' }, etiqueta: 'B.A.I. (C.A.O.)' },
  { id: 13, codigo: 'BAII', denominacion: 'B.A.II', unidad_id: 3, comando: { id: 3, codigo: 'CAO', denominacion: 'C.A.O.' }, etiqueta: 'B.A.II (C.A.O.)' },
];

const lista = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('UsuariosYRolesPage: paginación', () => {
  let fixture: ComponentFixture<UsuariosYRolesPage>;
  let component: UsuariosYRolesPage;
  let invitaciones: { findPaginado: ReturnType<typeof vi.fn>; findAll: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; create?: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirmModal: { confirmar: ReturnType<typeof vi.fn> };
  let usuariosFindAll: ReturnType<typeof vi.fn>;

  async function setup(roles: Rol[] = []) {
    invitaciones = {
      findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      findAll: vi.fn().mockReturnValue(of([])),
      remove: vi.fn().mockReturnValue(of({ ok: true })),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirmModal = { confirmar: vi.fn().mockResolvedValue(true) };
    usuariosFindAll = vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 }));

    await TestBed.configureTestingModule({
      declarations: [UsuariosYRolesPage, Paginator, Select, SearchInput, ClearFiltersButton],
      imports: [FormsModule, ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: { hasPermiso: () => true, currentUser: () => ({ id: '1' }) } },
        { provide: InvitacionesService, useValue: invitaciones },
        { provide: RolesService, useValue: { findAll: vi.fn().mockReturnValue(of(roles)) } },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmModalService, useValue: confirmModal },
        { provide: ErrorModalService, useValue: { show: vi.fn() } },
        { provide: UsuariosService, useValue: { findAll: usuariosFindAll } },
        { provide: PersonalService, useValue: { getBases: vi.fn().mockReturnValue(of(bases)) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosYRolesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const filas = () => el().querySelectorAll('.ur__table tbody tr');
  const cabeceras = () => el().querySelectorAll('.ur__table thead th');
  const paginador = () => el().querySelector('app-paginator nav');
  const responderInvitaciones = (ids: number[], total: number) =>
    invitaciones.findPaginado.mockReturnValue(of({ items: ids.map(invitacion), total, page: 1, pageSize: 10 }));

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('invitaciones', () => {
    it('pide la primera página de 10 y muestra el paginador', async () => {
      await setup();
      responderInvitaciones(lista(10), 25);
      component.cambiarTab('invitaciones');
      fixture.detectChanges();

      expect(invitaciones.findPaginado).toHaveBeenLastCalledWith({ estado: 'pendiente', page: 1, pageSize: 10 });
      expect(filas().length).toBe(10);
      expect(paginador()?.textContent).toContain('25');
    });

    it('al cambiar de página pide esa página', async () => {
      await setup();
      responderInvitaciones(lista(10), 25);
      component.cambiarTab('invitaciones');
      component.onInvitacionesPageChange(2);

      expect(invitaciones.findPaginado).toHaveBeenLastCalledWith({ estado: 'pendiente', page: 2, pageSize: 10 });
    });

    it('sin registros muestra encabezados y mensaje, sin paginador', async () => {
      await setup();
      component.cambiarTab('invitaciones');
      fixture.detectChanges();

      expect(cabeceras().length).toBeGreaterThan(0);
      expect(el().querySelector('.ur__empty')?.textContent).toContain('No hay invitaciones');
      expect(paginador()).toBeNull();
    });

    it('cambiar el estado vuelve a la primera página', async () => {
      await setup();
      responderInvitaciones(lista(10), 25);
      component.cambiarTab('invitaciones');
      component.onInvitacionesPageChange(3);

      component.onEstadoFiltroChange({ target: { value: 'aceptada' } } as unknown as Event);

      expect(invitaciones.findPaginado).toHaveBeenLastCalledWith({ estado: 'aceptada', page: 1, pageSize: 10 });
    });

    it('si falla un cambio de página avisa y conserva la página y los datos cargados', async () => {
      await setup();
      responderInvitaciones(lista(10), 25);
      component.cambiarTab('invitaciones');

      invitaciones.findPaginado.mockReturnValue(throwError(() => ({ status: 500, error: {} })));
      component.onInvitacionesPageChange(2);

      expect(toast.error).toHaveBeenCalled();
      expect(component.invitacionesPage()).toBe(1);
      expect(component.invitaciones().length).toBe(10);
      expect(component.invitacionesLoading()).toBe(false);
    });

    it('al revocar la única invitación de la última página vuelve a la anterior', async () => {
      await setup();
      responderInvitaciones([21], 21);
      component.cambiarTab('invitaciones');
      component.onInvitacionesPageChange(3);

      invitaciones.findPaginado.mockImplementation(({ page }: { page: number }) =>
        of({ items: page === 2 ? lista(10).map(invitacion) : [], total: 20, page, pageSize: 10 }),
      );
      await component.revocarInvitacion(invitacion(21));

      expect(component.invitacionesPage()).toBe(2);
      expect(component.invitaciones().length).toBe(10);
    });

    it('revocar pide confirmación con el modal de la app y no con el del navegador', async () => {
      await setup();
      const nativo = vi.spyOn(window, 'confirm');

      await component.revocarInvitacion(invitacion(1));

      expect(nativo).not.toHaveBeenCalled();
      expect(confirmModal.confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Revocar invitación', mensaje: expect.stringContaining('p1@fau.mil.uy') }),
      );
      expect(invitaciones.remove).toHaveBeenCalledWith('1');
    });

    it('si se cancela el modal no revoca la invitación', async () => {
      await setup();
      confirmModal.confirmar.mockResolvedValue(false);

      await component.revocarInvitacion(invitacion(1));

      expect(invitaciones.remove).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('una respuesta vieja no pisa a la de la última página pedida', async () => {
      await setup();
      const vieja = new Subject<unknown>();
      const nueva = new Subject<unknown>();
      invitaciones.findPaginado.mockReturnValueOnce(vieja).mockReturnValueOnce(nueva);
      component.onInvitacionesPageChange(2);
      component.onInvitacionesPageChange(3);

      nueva.next({ items: [invitacion(3)], total: 30, page: 3, pageSize: 10 });
      vieja.next({ items: [invitacion(2)], total: 30, page: 2, pageSize: 10 });

      expect(component.invitaciones().map((i) => i.id)).toEqual(['3']);
    });

    it('al volver a la pestaña el desplegable sigue mostrando el estado filtrado', async () => {
      await setup();
      component.cambiarTab('invitaciones');
      fixture.detectChanges();
      component.onEstadoFiltroChange({ target: { value: 'aceptada' } } as unknown as Event);

      component.cambiarTab('usuarios');
      fixture.detectChanges();
      component.cambiarTab('invitaciones');
      fixture.detectChanges();

      expect(el().querySelector<HTMLSelectElement>('.ur__filter select')?.value).toBe('aceptada');
      expect(invitaciones.findPaginado).toHaveBeenLastCalledWith(expect.objectContaining({ estado: 'aceptada' }));
    });

    it('después de invitar, Invitaciones pide la primera página de pendientes', async () => {
      await setup();
      invitaciones.create = vi.fn().mockReturnValue(of({ id: '9' }));
      component.onEstadoFiltroChange({ target: { value: 'aceptada' } } as unknown as Event);
      component.onInvitacionesPageChange(3);
      component.abrirNuevoUsuario();
      component.nuevoUsuarioForm.setValue({ username: 'nuevo@fau.mil.uy', roles: ['Consulta'] });

      component.crearUsuario();
      component.cambiarTab('invitaciones');

      expect(invitaciones.findPaginado).toHaveBeenLastCalledWith({ estado: 'pendiente', page: 1, pageSize: 10 });
    });

    it('el alta sigue detectando pendientes de cualquier página con la lista completa', async () => {
      await setup();
      component.abrirNuevoUsuario();
      expect(invitaciones.findAll).toHaveBeenCalledWith();
    });
  });

  describe('filtros de usuarios', () => {
    const usuario = (id: number) => ({ id: String(id), username: `u${id}@fau.mil.uy`, roles: [], unidades: [], estado: 'activo', persona: null });
    const responder = (ids: number[], total = ids.length) =>
      usuariosFindAll.mockReturnValue(of({ items: ids.map(usuario), total, page: 1, pageSize: 10 }));
    const ultimoPedido = () => usuariosFindAll.mock.calls.at(-1)![0];
    const vacio = () => el().querySelector('.ur__empty')?.textContent?.trim();
    const fallar = () => usuariosFindAll.mockReturnValue(throwError(() => ({ status: 500, error: {} })));

    it('arranca sin filtros, con todos los usuarios y limpiar deshabilitado', async () => {
      await setup();
      expect(ultimoPedido()).toEqual({ page: 1, pageSize: 10, search: '', rolId: null, estado: null });
      expect(component.hayFiltrosUsuarios()).toBe(false);
      expect(el().querySelector('.ur__filtros app-search-input')).not.toBeNull();
      expect(el().querySelectorAll('.ur__filtros app-select').length).toBe(2);
      expect(el().querySelector('.ur__filtros app-clear-filters-button')).not.toBeNull();
    });

    it('la búsqueda espera el debounce y solo pide lo último que se tipeó', async () => {
      await setup();
      vi.useFakeTimers();
      usuariosFindAll.mockClear();

      component.onUsuariosBusqueda('je');
      vi.advanceTimersByTime(399);
      component.onUsuariosBusqueda('jefe');
      vi.advanceTimersByTime(399);
      expect(usuariosFindAll).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(usuariosFindAll).toHaveBeenCalledTimes(1);
      expect(ultimoPedido()).toEqual(expect.objectContaining({ search: 'jefe', page: 1 }));
    });

    it('rol y estado se aplican enseguida y se combinan con la búsqueda', async () => {
      await setup();
      vi.useFakeTimers();
      component.onUsuariosBusqueda('jefe');
      vi.advanceTimersByTime(400);

      component.onUsuariosRolChange('2');
      component.onUsuariosEstadoChange('activo');

      expect(ultimoPedido()).toEqual(expect.objectContaining({ search: 'jefe', rolId: '2', estado: 'activo', page: 1 }));
    });

    it('cambiar un filtro vuelve a la primera página', async () => {
      await setup();
      responder([1], 25);
      component.onUsuariosPageChange(3);

      component.onUsuariosEstadoChange('bloqueado');

      expect(ultimoPedido()).toEqual(expect.objectContaining({ page: 1, estado: 'bloqueado' }));
    });

    it('paginar conserva los filtros aplicados', async () => {
      await setup();
      responder([1], 25);
      component.onUsuariosRolChange('2');

      component.onUsuariosPageChange(2);

      expect(ultimoPedido()).toEqual(expect.objectContaining({ page: 2, rolId: '2' }));
    });

    it('limpiar vacía todo y lista todos los usuarios, sin pedido duplicado por el debounce', async () => {
      await setup();
      vi.useFakeTimers();
      component.onUsuariosRolChange('2');
      component.onUsuariosBusqueda('jefe');
      usuariosFindAll.mockClear();

      component.limpiarFiltrosUsuarios();
      vi.advanceTimersByTime(400);

      expect(usuariosFindAll).toHaveBeenCalledTimes(1);
      expect(ultimoPedido()).toEqual({ page: 1, pageSize: 10, search: '', rolId: null, estado: null });
      expect(component.usuariosBusqueda()).toBe('');
      expect(component.hayFiltrosUsuarios()).toBe(false);
    });

    it('sin coincidencias muestra encabezados y el mensaje de la historia', async () => {
      await setup();
      component.onUsuariosEstadoChange('bloqueado');
      fixture.detectChanges();

      expect(cabeceras().length).toBeGreaterThan(0);
      expect(vacio()).toBe('No hay usuarios que coincidan con los filtros.');
    });

    it('sin filtros mantiene el mensaje de listado vacío', async () => {
      await setup();
      expect(vacio()).toBe('No hay usuarios registrados');
    });

    it('si falla un filtro avisa y no deja filas que no lo cumplen', async () => {
      await setup();
      responder([1, 2]);
      component.onUsuariosRolChange('2');
      fallar();

      component.onUsuariosEstadoChange('bloqueado');
      fixture.detectChanges();

      expect(toast.error).toHaveBeenCalled();
      expect(component.usuarios()).toEqual([]);
      expect(vacio()).toContain('No se pudieron cargar');
    });

    it('si falla un cambio de página conserva la página y las filas cargadas', async () => {
      await setup();
      responder([1, 2], 25);
      component.onUsuariosRolChange('2');
      fallar();

      component.onUsuariosPageChange(2);

      expect(component.usuariosPage()).toBe(1);
      expect(component.usuarios().length).toBe(2);
      expect(component.usuariosError()).toBe(false);
    });

    it('recargar tras editar mantiene los filtros y saca al usuario que ya no cumple', async () => {
      await setup();
      responder([1, 2]);
      component.onUsuariosEstadoChange('activo');
      responder([2]);

      component.cargar();

      expect(ultimoPedido()).toEqual(expect.objectContaining({ estado: 'activo' }));
      expect(component.usuarios().map((u) => u.id)).toEqual(['2']);
    });

    it('si editar deja vacía la última página filtrada vuelve a la anterior', async () => {
      await setup();
      responder([21], 21);
      component.onUsuariosPageChange(3);
      usuariosFindAll.mockImplementation(({ page }: { page: number }) =>
        of({ items: page === 2 ? [usuario(20)] : [], total: 20, page, pageSize: 10 }),
      );

      component.cargar();

      expect(component.usuariosPage()).toBe(2);
      expect(component.usuarios().length).toBe(1);
    });
  });

  describe('roles', () => {
    const abrirRoles = () => {
      component.cambiarTab('roles');
      fixture.detectChanges();
    };

    it('muestra 10 por página y la segunda trae el resto', async () => {
      await setup(lista(12).map(rol));
      abrirRoles();
      expect(filas().length).toBe(10);

      component.rolesPage.set(2);
      fixture.detectChanges();
      expect(filas().length).toBe(2);
      expect(filas()[0].textContent).toContain('Rol 11');
    });

    it('con 10 o menos no muestra el paginador', async () => {
      await setup(lista(10).map(rol));
      abrirRoles();

      expect(filas().length).toBe(10);
      expect(el().querySelector('[aria-label="Página siguiente"]')).toBeNull();
    });

    it('la lista completa sigue disponible para los modales', async () => {
      await setup(lista(12).map(rol));
      abrirRoles();
      expect(component.roles().length).toBe(12);
    });

    it('si la última página se queda sin roles muestra la anterior', async () => {
      await setup(lista(11).map(rol));
      component.rolesPage.set(2);

      component.roles.set(lista(10).map(rol));

      expect(component.rolesPageActual()).toBe(1);
      expect(component.rolesDePagina().length).toBe(10);
    });

    it('roles e invitaciones paginan por separado', async () => {
      await setup(lista(12).map(rol));
      responderInvitaciones(lista(10), 25);
      component.cambiarTab('invitaciones');
      component.onInvitacionesPageChange(3);

      expect(component.rolesPage()).toBe(1);
      component.rolesPage.set(2);
      expect(component.invitacionesPage()).toBe(3);
    });
  });
});

describe('UsuariosYRolesPage: pestañas según permisos', () => {
  let fixture: ComponentFixture<UsuariosYRolesPage>;
  let rolesFindAll: ReturnType<typeof vi.fn>;
  let usuariosFindAll: ReturnType<typeof vi.fn>;

  async function setup(permisos: string[]) {
    rolesFindAll = vi.fn().mockReturnValue(of([rol(1)]));
    usuariosFindAll = vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 }));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [UsuariosYRolesPage, Paginator, Select, SearchInput, ClearFiltersButton],
      imports: [FormsModule, ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: { hasPermiso: (p: string) => permisos.includes(p), currentUser: () => ({ id: '1' }) } },
        { provide: InvitacionesService, useValue: { findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })) } },
        { provide: RolesService, useValue: { findAll: rolesFindAll } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmModalService, useValue: { confirmar: vi.fn() } },
        { provide: ErrorModalService, useValue: { show: vi.fn() } },
        { provide: UsuariosService, useValue: { findAll: usuariosFindAll } },
        { provide: PersonalService, useValue: { getBases: vi.fn().mockReturnValue(of(bases)) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosYRolesPage);
    fixture.detectChanges();
  }

  const pestanas = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.ur__tab')).map((b) => b.textContent?.trim());

  it('con solo usuarios.ver carga los usuarios sin pedir /roles y no muestra Invitaciones', async () => {
    await setup(['usuarios.ver']);

    expect(rolesFindAll).not.toHaveBeenCalled();
    expect(usuariosFindAll).toHaveBeenCalled();
    expect(pestanas()).toEqual(['Usuarios']);
  });

  it('con usuarios.gestionar aparece la pestaña Invitaciones', async () => {
    await setup(['usuarios.ver', 'usuarios.gestionar', 'roles.ver']);

    expect(rolesFindAll).toHaveBeenCalled();
    expect(usuariosFindAll).toHaveBeenCalled();
    expect(pestanas()).toEqual(['Usuarios', 'Invitaciones', 'Roles y Permisos']);
  });

  it('con solo roles.ver arranca en Roles y no pide usuarios', async () => {
    await setup(['roles.ver']);

    expect(usuariosFindAll).not.toHaveBeenCalled();
    expect(pestanas()).toEqual(['Roles y Permisos']);
    expect(fixture.componentInstance.tab()).toBe('roles');
  });
});

describe('UsuariosYRolesPage: guardar la edición de un usuario', () => {
  let fixture: ComponentFixture<UsuariosYRolesPage>;
  let component: UsuariosYRolesPage;
  let usuariosSvc: Record<string, ReturnType<typeof vi.fn>>;

  const usuario = {
    id: '5',
    username: 'admin2@fau.mil.uy',
    estado: 'activo',
    bloqueadoHasta: null,
    unidades: [],
    persona: null,
    roles: [{ id: '1', nombre: 'Administrador del sistema' }],
  } as any;

  beforeEach(async () => {
    usuariosSvc = {
      findAll: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      asignarRol: vi.fn().mockReturnValue(of(usuario)),
      quitarRol: vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'No podés quitarle el rol' } })),
      ),
      update: vi.fn().mockReturnValue(of(usuario)),
      findOne: vi.fn().mockReturnValue(of(usuario)),
    };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [UsuariosYRolesPage, Paginator, Select, SearchInput, ClearFiltersButton],
      imports: [FormsModule, ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuthService, useValue: { hasPermiso: () => true, currentUser: () => ({ id: '2' }) } },
        { provide: InvitacionesService, useValue: { findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })) } },
        { provide: RolesService, useValue: { findAll: vi.fn().mockReturnValue(of([rol(1), rol(7)])) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmModalService, useValue: { confirmar: vi.fn() } },
        { provide: ErrorModalService, useValue: { show: vi.fn() } },
        { provide: UsuariosService, useValue: usuariosSvc },
        { provide: PersonalService, useValue: { getBases: vi.fn().mockReturnValue(of(bases)) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UsuariosYRolesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('el selector de bases muestra cada base con su comando y usa el id como string', () => {
    component.abrirEditar(usuario);
    fixture.detectChanges();

    const selector = fixture.debugElement
      .queryAll(By.directive(Select))
      .find((d) => d.attributes['formControlName'] === 'unidadIds');
    expect(selector).toBeDefined();
    expect((selector!.componentInstance as Select).items).toEqual([
      { id: '12', etiqueta: 'B.A.I. (C.A.O.)' },
      { id: '13', etiqueta: 'B.A.II (C.A.O.)' },
    ]);
    expect(TestBed.inject(PersonalService).getBases).toHaveBeenCalled();
  });

  it('si un cambio falla, frena ahí y dice qué se guardó y qué no', () => {
    component.abrirEditar(usuario);
    // Agrega "Rol 7" y quita "Administrador del sistema"; quitarlo da 403.
    component.editForm.patchValue({ roles: ['Rol 7'] });

    component.guardarEdicion();

    expect(usuariosSvc['asignarRol']).toHaveBeenCalledWith('5', '7');
    expect(usuariosSvc['quitarRol']).toHaveBeenCalledWith('5', '1');
    const error = component.modalError()!;
    expect(error).toContain('Se guardó: asignar el rol Rol 7');
    expect(error).toContain('No se guardó: quitar el rol Administrador del sistema');
  });

  it('los cambios se mandan de a uno: si el primero falla, no se manda el resto', () => {
    usuariosSvc['asignarRol'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'No podés asignar' } })),
    );
    component.abrirEditar(usuario);
    component.editForm.patchValue({ roles: ['Rol 7'], estado: 'bloqueado' });

    component.guardarEdicion();

    expect(usuariosSvc['quitarRol']).not.toHaveBeenCalled();
    expect(usuariosSvc['update']).not.toHaveBeenCalled();
    expect(component.modalError()).not.toContain('Se guardó');
  });
});
