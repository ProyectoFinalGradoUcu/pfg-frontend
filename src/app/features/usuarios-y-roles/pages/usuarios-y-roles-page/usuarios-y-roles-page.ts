import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, Subscription, concatMap, debounceTime, from, last, tap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { InvitacionesService } from '../../../../core/services/invitaciones.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { Invitacion, PermisoEfectivo, Rol, Usuario } from '../../../../core/models/auth.models';
import { parseError } from '../../../../shared/utils/parse-error';

type Tab = 'usuarios' | 'invitaciones' | 'roles' | 'unidades';
type ModalKind =
  | 'nuevoUsuario'
  | 'editarUsuario'
  | 'nuevoRol'
  | 'editarRol'
  | null;

@Component({
  selector: 'app-usuarios-y-roles-page',
  standalone: false,
  templateUrl: './usuarios-y-roles-page.html',
  styleUrl: './usuarios-y-roles-page.scss',
})
export class UsuariosYRolesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly personalService = inject(PersonalService);
  private readonly rolesService = inject(RolesService);
  private readonly invitacionesService = inject(InvitacionesService);
  private readonly toast = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly router = inject(Router);

  // ── Tab ──────────────────────────────────────────────────────────────────
  readonly tab = signal<Tab>('usuarios');

  // ── Usuarios ──────────────────────────────────────────────────────────────
  readonly usuarios = signal<Usuario[]>([]);
  readonly usuariosTotal = signal(0);
  readonly usuariosLoading = signal(false);
  readonly usuariosPage = signal(1);
  readonly usuariosPageSize = 10;
  readonly usuariosBusqueda = signal('');
  readonly usuariosRol = signal<string | null>(null);
  readonly usuariosEstado = signal<string | null>(null);
  /** El listado filtrado no se pudo cargar: la tabla queda vacía y lo avisa. */
  readonly usuariosError = signal(false);
  readonly hayFiltrosUsuarios = computed(
    () => !!this.usuariosBusqueda().trim() || !!this.usuariosRol() || !!this.usuariosEstado(),
  );

  private readonly usuariosBusqueda$ = new Subject<void>();
  /** Texto del último pedido: paginar mientras se tipea no adelanta la búsqueda en curso. */
  private usuariosBusquedaAplicada = '';
  /** Última página cargada: si falla un cambio de página, la tabla y el paginador vuelven acá. */
  private usuariosPageCargada = 1;
  private usuariosSub?: Subscription;

  // ── Roles ─────────────────────────────────────────────────────────────────
  readonly roles = signal<Rol[]>([]);
  readonly loading = signal(false);
  readonly rolesPage = signal(1);
  readonly rolesPageSize = 10;

  /** Paginado en el cliente: los modales necesitan la lista completa de roles. */
  readonly rolesPageActual = computed(() => {
    // Al eliminar el único rol de la última página no se queda en una página inexistente.
    const ultima = Math.max(1, Math.ceil(this.roles().length / this.rolesPageSize));
    return Math.min(this.rolesPage(), ultima);
  });
  readonly rolesDePagina = computed(() => {
    const inicio = (this.rolesPageActual() - 1) * this.rolesPageSize;
    return this.roles().slice(inicio, inicio + this.rolesPageSize);
  });

  // Menú kebab de la tabla de roles
  readonly menuAbierto = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  // ── Invitaciones ─────────────────────────────────────────────────────────
  readonly invitaciones = signal<Invitacion[]>([]);
  readonly invitacionesTodas = signal<Invitacion[]>([]);
  readonly invitacionesLoading = signal(false);
  readonly invitacionesTotal = signal(0);
  readonly invitacionesPage = signal(1);
  readonly invitacionesPageSize = 10;
  /** Última página cargada: si falla un cambio de página, la tabla y el paginador vuelven acá. */
  private invitacionesPageCargada = 1;
  private invitacionesSub?: Subscription;
  readonly estadoFiltro = signal<string>('pendiente');

  readonly estadosFiltro = [
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'aceptada', label: 'Aceptadas' },
    { value: 'expirada', label: 'Expiradas' },
  ];

  // ── Modal ─────────────────────────────────────────────────────────────────
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);
  readonly editTarget = signal<Usuario | null>(null);
  readonly editRolTarget = signal<Rol | null>(null);
  readonly revocandoId = signal<string | null>(null);
  readonly permisosDelTarget = signal<PermisoEfectivo[]>([]);
  readonly cargandoPermisos = signal(false);

  readonly permisosGlobales = computed(() =>
    this.permisosDelTarget().filter((p) => p.alcance === 'global'),
  );
  readonly permisosUnidad = computed(() =>
    this.permisosDelTarget().filter((p) => p.alcance === 'unidad'),
  );

  // ── Computed permisos ─────────────────────────────────────────────────────
  readonly puedeGestionarUsuarios = computed(() =>
    this.auth.hasPermiso('usuarios.gestionar'),
  );
  readonly puedeGestionarRoles = computed(() =>
    this.auth.hasPermiso('roles.gestionar'),
  );
  readonly puedeVerUnidades = computed(() =>
    this.auth.hasPermiso('unidades.ver'),
  );
  readonly puedeVerUsuarios = computed(() =>
    this.auth.hasPermiso('usuarios.ver'),
  );
  readonly puedeVerRoles = computed(() =>
    this.auth.hasPermiso('roles.ver'),
  );

  /** Pestañas en el orden en que se muestran, solo las que el usuario puede abrir. */
  private tabsVisibles(): Tab[] {
    const tabs: Tab[] = [];
    if (this.puedeVerUsuarios()) tabs.push('usuarios');
    // GET /invitaciones exige usuarios.gestionar.
    if (this.puedeGestionarUsuarios()) tabs.push('invitaciones');
    if (this.puedeVerRoles()) tabs.push('roles');
    if (this.puedeVerUnidades()) tabs.push('unidades');
    return tabs;
  }
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  readonly estadosOpciones = [
    { value: 'activo', label: 'Activo' },
    { value: 'bloqueado', label: 'Bloqueado' },
  ];

  // ── Forms ─────────────────────────────────────────────────────────────────
  readonly nuevoUsuarioForm = this.fb.group({
    username: ['', [Validators.required, Validators.email, Validators.maxLength(60)]],
    roles: [[] as string[], Validators.required],
  });

  readonly editForm = this.fb.group({
    roles: [[] as string[]],
    estado: ['activo' as 'activo' | 'bloqueado'],
    // Unidades de la cuenta. [] = sin unidades (alcance general).
    unidadIds: [[] as string[]],
    nuevaPassword: [''],
  });

  /** Bases vigentes para el selector del detalle de usuario; el id va como string. */
  readonly unidadesCatalogo = signal<{ id: string; etiqueta: string }[]>([]);

  readonly rolForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    descripcion: ['', Validators.maxLength(200)],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.usuariosBusqueda$
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Limpiar o elegir un filtro durante la espera ya aplicó este mismo texto.
        if (this.usuariosBusqueda().trim() !== this.usuariosBusquedaAplicada) this.aplicarFiltrosUsuarios();
      });

    this.cargar();

    // El selector de bases del detalle de usuario usa el catálogo de solo lectura,
    // que no requiere el permiso `unidades.ver`.
    this.personalService.getBases().subscribe({
      next: (bases) =>
        this.unidadesCatalogo.set(bases.map((b) => ({ id: String(b.id), etiqueta: b.etiqueta }))),
    });
  }

  cargar(): void {
    // La página se abre con usuarios.ver, roles.ver o unidades.ver: arrancar en la
    // primera pestaña permitida.
    const visibles = this.tabsVisibles();
    if (!visibles.includes(this.tab()) && visibles.length) this.tab.set(visibles[0]);

    // GET /roles exige roles.ver. Sin ese permiso los usuarios se cargan igual; solo
    // queda vacío el filtro por rol.
    if (!this.puedeVerRoles()) {
      this.roles.set([]);
      if (this.puedeVerUsuarios()) this.cargarUsuarios();
      return;
    }

    this.loading.set(true);
    this.rolesService.findAll().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
        if (this.puedeVerUsuarios()) this.cargarUsuarios();
      },
      error: (err: HttpErrorResponse) => {
        this.reportarError(err);
        this.loading.set(false);
      },
    });
  }

  // ── Usuarios ──────────────────────────────────────────────────────────────
  onUsuariosPageChange(page: number): void {
    this.usuariosPage.set(page);
    this.cargarUsuarios();
  }

  onUsuariosBusqueda(texto: string): void {
    this.usuariosBusqueda.set(texto);
    this.usuariosBusqueda$.next();
  }

  onUsuariosRolChange(rolId: string | null): void {
    this.usuariosRol.set(rolId);
    this.aplicarFiltrosUsuarios();
  }

  onUsuariosEstadoChange(estado: string | null): void {
    this.usuariosEstado.set(estado);
    this.aplicarFiltrosUsuarios();
  }

  limpiarFiltrosUsuarios(): void {
    this.usuariosBusqueda.set('');
    this.usuariosRol.set(null);
    this.usuariosEstado.set(null);
    this.aplicarFiltrosUsuarios();
  }

  private aplicarFiltrosUsuarios(): void {
    this.usuariosBusquedaAplicada = this.usuariosBusqueda().trim();
    this.usuariosPage.set(1);
    this.cargarUsuarios({ vaciarSiFalla: true });
  }

  /**
   * `vaciarSiFalla`: al cambiar un filtro, las filas ya cargadas no cumplen lo pedido y no pueden
   * quedar a la vista. Al paginar o refrescar siguen siendo válidas y solo se vuelve de página.
   */
  private cargarUsuarios({ vaciarSiFalla = false } = {}): void {
    // Con filtros o clics seguidos, una respuesta vieja no debe pisar a la última.
    this.usuariosSub?.unsubscribe();
    this.usuariosLoading.set(true);
    this.usuariosSub = this.usuariosService
      .findAll({
        page: this.usuariosPage(),
        pageSize: this.usuariosPageSize,
        search: this.usuariosBusquedaAplicada,
        rolId: this.usuariosRol(),
        estado: this.usuariosEstado(),
      })
      .subscribe({
        next: ({ items, total }) => {
          // Si editar deja la última página sin resultados del filtro, esa página ya no existe.
          const ultima = Math.max(1, Math.ceil(total / this.usuariosPageSize));
          if (this.usuariosPage() > ultima) {
            this.usuariosPage.set(ultima);
            this.cargarUsuarios({ vaciarSiFalla });
            return;
          }
          this.usuarios.set(items);
          this.usuariosTotal.set(total);
          this.usuariosPageCargada = this.usuariosPage();
          this.usuariosError.set(false);
          this.usuariosLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.reportarError(err);
          if (vaciarSiFalla) {
            this.usuarios.set([]);
            this.usuariosTotal.set(0);
            this.usuariosPageCargada = 1;
            this.usuariosError.set(true);
          } else {
            this.usuariosPage.set(this.usuariosPageCargada);
          }
          this.usuariosLoading.set(false);
        },
      });
  }

  abrirNuevoUsuario(): void {
    this.nuevoUsuarioForm.reset({ username: '', roles: [] });
    this.modalError.set(null);
    this.invitacionesService.findAll().subscribe({
      next: (items) => this.invitacionesTodas.set(items),
    });
    this.modal.set('nuevoUsuario');
  }

  abrirEditar(usuario: Usuario): void {
    this.editForm.reset({
      roles: usuario.roles.map((r) => r.nombre),
      estado: usuario.estado,
      unidadIds: usuario.unidades.map((u) => u.id),
      nuevaPassword: '',
    });
    this.modalError.set(null);
    this.editTarget.set(usuario);
    this.modal.set('editarUsuario');

    // Cargar permisos efectivos via findOne (el listado no los trae)
    this.permisosDelTarget.set([]);
    this.cargandoPermisos.set(true);
    this.usuariosService.findOne(usuario.id).subscribe({
      next: (detalle) => {
        this.permisosDelTarget.set(detalle.permisosEfectivos ?? []);
        this.cargandoPermisos.set(false);
      },
      error: () => this.cargandoPermisos.set(false),
    });
  }

  crearUsuario(): void {
    if (this.nuevoUsuarioForm.invalid) {
      this.nuevoUsuarioForm.markAllAsTouched();
      // Mensaje según el campo inválido.
      const email = this.nuevoUsuarioForm.controls.username.errors;
      this.modalError.set(
        email?.['maxlength']
          ? 'El email no puede tener más de 60 caracteres'
          : email?.['email']
            ? 'El email no es válido'
            : this.nuevoUsuarioForm.controls.roles.invalid && !email
              ? 'Elegí al menos un rol'
              : 'Completá todos los campos requeridos',
      );
      return;
    }
    const { username, roles } = this.nuevoUsuarioForm.getRawValue();
    const emailNorm = username!.trim().toLowerCase();

    const usuarioExistente = this.usuarios().some(
      (u) => u.username.toLowerCase() === emailNorm,
    );
    if (usuarioExistente) {
      this.modalError.set('Ya existe un usuario registrado con ese correo electrónico.');
      return;
    }

    const invExistente = this.invitacionesTodas().some(
      (i) => i.email.toLowerCase() === emailNorm && i.estado === 'pendiente',
    );
    if (invExistente) {
      this.modalError.set('Ya existe una invitación pendiente para ese correo electrónico.');
      return;
    }

    this.modalError.set(null);
    this.invitacionesService
      .create({ email: username!, roles: roles && roles.length ? roles : undefined })
      .subscribe({
        next: () => {
          this.cerrarModal();
          // La nueva queda primera entre las pendientes: es lo que se verá al ir a Invitaciones.
          this.estadoFiltro.set('pendiente');
          this.invitacionesPage.set(1);
          this.toast.success(
            `Se realizó una nueva invitación a ${username}. Esto queda visible en la sección de invitaciones.`,
          );
        },
        error: (err) => this.modalError.set(parseError(err)),
      });
  }

  guardarEdicion(): void {
    const target = this.editTarget();
    if (!target) return;

    const { roles, estado, unidadIds, nuevaPassword } = this.editForm.getRawValue();

    if (nuevaPassword && nuevaPassword.length > 0 && nuevaPassword.length < 8) {
      this.modalError.set('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.modalError.set(null);
    // Cada cambio con una descripción, para poder decir cuáles quedaron guardados si uno falla.
    const tasks: { descripcion: string; request: () => Observable<unknown> }[] = [];

    const rolesNuevos = (roles ?? []) as string[];
    const rolesActuales = target.roles.map((r) => r.nombre);

    const aAgregar = rolesNuevos.filter((n) => !rolesActuales.includes(n));
    const aQuitar = target.roles.filter((r) => !rolesNuevos.includes(r.nombre));

    for (const nombre of aAgregar) {
      const rol = this.roles().find((r) => r.nombre === nombre);
      if (rol) {
        tasks.push({
          descripcion: `asignar el rol ${rol.nombre}`,
          request: () => this.usuariosService.asignarRol(target.id, rol.id),
        });
      }
    }
    for (const r of aQuitar) {
      tasks.push({
        descripcion: `quitar el rol ${r.nombre}`,
        request: () => this.usuariosService.quitarRol(target.id, r.id),
      });
    }

    if (estado && estado !== target.estado) {
      tasks.push({
        descripcion: `cambiar el estado a ${estado}`,
        request: () => this.usuariosService.update(target.id, { estado }),
      });
    }

    // Cambiar las unidades modifica los permisos efectivos del usuario y le cierra la sesión.
    const unidadesActuales = target.unidades.map((u) => u.id).sort().join(',');
    const unidadesNuevas = (unidadIds ?? []).sort().join(',');
    if (unidadesNuevas !== unidadesActuales) {
      tasks.push({
        descripcion: 'cambiar las unidades',
        request: () => this.usuariosService.asignarUnidades(target.id, unidadIds ?? []),
      });
    }

    if (nuevaPassword && nuevaPassword.length >= 8) {
      tasks.push({
        descripcion: 'cambiar la contraseña',
        request: () => this.usuariosService.resetPassword(target.id, { password: nuevaPassword }),
      });
    }

    if (tasks.length === 0) {
      this.cerrarModal();
      return;
    }

    // Se mandan de a uno y se corta en el primer error, para saber qué se guardó.
    const hechos: string[] = [];
    from(tasks)
      .pipe(
        concatMap((t) => t.request().pipe(tap(() => hechos.push(t.descripcion)))),
        last(),
      )
      .subscribe({
        next: () => {
          const nombre = target.persona?.nombre ?? target.username;
          this.cerrarModal();
          this.toast.success(`Cambios guardados para ${nombre}`);
          this.cargar();
        },
        error: (err) => {
          const pendientes = tasks.map((t) => t.descripcion).filter((d) => !hechos.includes(d));
          this.modalError.set(
            hechos.length
              ? `${parseError(err)}. Se guardó: ${hechos.join(', ')}. No se guardó: ${pendientes.join(', ')}.`
              : parseError(err),
          );
          // La lista tiene que mostrar lo que realmente quedó en el servidor.
          if (hechos.length) this.cargar();
        },
      });
  }

  // ── Deshabilitar / Reactivar usuario ──────────────────────────────────────

  // Modal de la app: confirm() no funciona en algunos navegadores embebidos.
  async deshabilitarUsuario(usuario: Usuario): Promise<void> {
    const nombre = usuario.persona?.nombre ?? usuario.username;
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Deshabilitar usuario',
      mensaje: `¿Deshabilitar a ${nombre}? Ya no podrá acceder a la plataforma.`,
      textoConfirmar: 'Deshabilitar',
    });
    if (!confirmado) return;

    this.usuariosService.remove(usuario.id).subscribe({
      next: () => {
        this.cerrarModal();
        this.toast.success(`${nombre} deshabilitado`);
        this.cargarUsuarios();
      },
      error: (err: HttpErrorResponse) => this.reportarError(err),
    });
  }

  async reactivarUsuario(usuario: Usuario): Promise<void> {
    const nombre = usuario.persona?.nombre ?? usuario.username;
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Reactivar usuario',
      mensaje: `¿Reactivar a ${nombre}? Volverá a poder acceder a la plataforma.`,
      textoConfirmar: 'Reactivar',
    });
    if (!confirmado) return;

    this.usuariosService.update(usuario.id, { estado: 'activo' }).subscribe({
      next: () => {
        this.cerrarModal();
        this.toast.success(`${nombre} reactivado`);
        this.cargarUsuarios();
      },
      error: (err: HttpErrorResponse) => this.reportarError(err),
    });
  }

  // ── Roles ─────────────────────────────────────────────────────────────────
  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuAbierto() === id) {
      this.cerrarMenu();
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.menuPosition.set({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      this.menuAbierto.set(id);
    }
  }

  cerrarMenu(): void {
    this.menuAbierto.set(null);
    this.menuPosition.set(null);
  }

  abrirNuevoRol(): void {
    this.rolForm.reset({ nombre: '', descripcion: '' });
    this.editRolTarget.set(null);
    this.modalError.set(null);
    this.modal.set('nuevoRol');
  }

  abrirEditarRol(rol: Rol): void {
    this.cerrarMenu();
    this.rolForm.reset({ nombre: rol.nombre, descripcion: rol.descripcion ?? '' });
    this.editRolTarget.set(rol);
    this.modalError.set(null);
    this.modal.set('editarRol');
  }

  guardarRol(): void {
    if (this.rolForm.invalid) {
      this.rolForm.markAllAsTouched();
      this.modalError.set('Completá el nombre del rol');
      return;
    }
    const { nombre, descripcion } = this.rolForm.getRawValue();
    this.modalError.set(null);

    const payload = {
      nombre: nombre!,
      descripcion: descripcion ? descripcion : undefined,
    };

    const target = this.editRolTarget();
    const op = target
      ? this.rolesService.update(target.id, payload)
      : this.rolesService.create(payload);

    op.subscribe({
      next: () => {
        this.cerrarModal();
        this.toast.success(
          target ? 'Rol actualizado correctamente' : `Rol ${nombre} creado correctamente`,
        );
        this.cargar();
      },
      error: (err) => this.modalError.set(parseError(err)),
    });
  }

  async eliminarRol(rol: Rol): Promise<void> {
    this.cerrarMenu();
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Eliminar rol',
      mensaje: `¿Eliminar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
    });
    if (!confirmado) return;
    this.rolesService.remove(rol.id).subscribe({
      next: () => {
        this.toast.success('Rol eliminado');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.reportarError(err),
    });
  }

  irAEditarPermisos(rol: Rol): void {
    this.cerrarMenu();
    this.router.navigate(['/usuarios-y-roles/roles', rol.id, 'permisos']);
  }

  // ── Invitaciones ─────────────────────────────────────────────────────────
  cargarInvitaciones(): void {
    // Con clics seguidos en el paginador, una respuesta vieja no debe pisar a la última.
    this.invitacionesSub?.unsubscribe();
    this.invitacionesLoading.set(true);
    this.invitacionesSub = this.invitacionesService
      .findPaginado({
        estado: this.estadoFiltro(),
        page: this.invitacionesPage(),
        pageSize: this.invitacionesPageSize,
      })
      .subscribe({
        next: ({ items, total }) => {
          // Al revocar la única invitación de la última página, esa página deja de existir.
          const ultima = Math.max(1, Math.ceil(total / this.invitacionesPageSize));
          if (this.invitacionesPage() > ultima) {
            this.invitacionesPage.set(ultima);
            this.cargarInvitaciones();
            return;
          }
          this.invitaciones.set(items);
          this.invitacionesTotal.set(total);
          this.invitacionesPageCargada = this.invitacionesPage();
          this.invitacionesLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.reportarError(err);
          this.invitacionesPage.set(this.invitacionesPageCargada);
          this.invitacionesLoading.set(false);
        },
      });
  }

  onInvitacionesPageChange(page: number): void {
    this.invitacionesPage.set(page);
    this.cargarInvitaciones();
  }

  onEstadoFiltroChange(event: Event): void {
    this.estadoFiltro.set((event.target as HTMLSelectElement).value);
    this.invitacionesPage.set(1);
    this.cargarInvitaciones();
  }

  cambiarTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'invitaciones') {
      this.cargarInvitaciones();
    }
  }

  async revocarInvitacion(inv: Invitacion): Promise<void> {
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Revocar invitación',
      mensaje: `¿Revocar la invitación enviada a ${inv.email}? El enlace del mail dejará de funcionar.`,
      textoConfirmar: 'Revocar',
    });
    if (!confirmado) return;

    this.revocandoId.set(inv.id);
    this.invitacionesService.remove(inv.id).subscribe({
      next: () => {
        this.revocandoId.set(null);
        this.toast.success(`Invitación a ${inv.email} revocada`);
        this.cargarInvitaciones();
      },
      error: (err) => {
        this.revocandoId.set(null);
        this.reportarError(err);
      },
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.editTarget.set(null);
    this.editRolTarget.set(null);
  }

  // ── Track ─────────────────────────────────────────────────────────────────
  trackUsuario = (_: number, u: Usuario) => u.id;
  trackRol = (_: number, r: Rol) => r.id;
  trackInvitacion = (_: number, i: Invitacion) => i.id;

  /** 403 es bloqueante: se muestra en el modal informativo en vez de un toast que desaparece solo. */
  private reportarError(err: HttpErrorResponse): void {
    const msg = parseError(err);
    if (err.status === 403) this.errorModal.show(msg);
    else this.toast.error(msg);
  }
}
