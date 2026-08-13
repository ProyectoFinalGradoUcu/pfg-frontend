import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { InvitacionesService } from '../../../../core/services/invitaciones.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { Invitacion, Rol, Usuario } from '../../../../core/models/auth.models';
import { OpcionSelect } from '../../../../core/models/personal.models';

type Tab = 'usuarios' | 'invitaciones' | 'roles';
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
  private readonly auth = inject(AuthService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly personalService = inject(PersonalService);
  private readonly rolesService = inject(RolesService);
  private readonly invitacionesService = inject(InvitacionesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  // ── Tab ──────────────────────────────────────────────────────────────────
  readonly tab = signal<Tab>('usuarios');

  // ── Usuarios ──────────────────────────────────────────────────────────────
  readonly usuarios = signal<Usuario[]>([]);
  readonly usuariosTotal = signal(0);
  readonly usuariosLoading = signal(false);
  readonly usuariosPage = signal(1);
  readonly usuariosPageSize = 10;

  // ── Roles ─────────────────────────────────────────────────────────────────
  readonly roles = signal<Rol[]>([]);
  readonly loading = signal(false);

  // Menú kebab de la tabla de roles
  readonly menuAbierto = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  // ── Invitaciones ─────────────────────────────────────────────────────────
  readonly invitaciones = signal<Invitacion[]>([]);
  readonly invitacionesTodas = signal<Invitacion[]>([]);
  readonly invitacionesLoading = signal(false);
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

  // ── Computed permisos ─────────────────────────────────────────────────────
  readonly puedeGestionarUsuarios = computed(() =>
    this.auth.hasPermiso('usuarios.gestionar'),
  );
  readonly puedeGestionarRoles = computed(() =>
    this.auth.hasPermiso('roles.gestionar'),
  );
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
    // Unidad de la cuenta. '' = sin unidad (alcance general).
    unidadId: [''],
    nuevaPassword: [''],
  });

  /** Catálogo de unidades vigentes para el selector del detalle de usuario. */
  readonly unidadesCatalogo = signal<OpcionSelect[]>([]);

  readonly rolForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    descripcion: ['', Validators.maxLength(200)],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargar();

    // El selector de unidad del detalle de usuario usa el catálogo de solo lectura,
    // que no requiere el permiso `unidades.ver`.
    this.personalService.getUnidades().subscribe({
      next: (unidades) => this.unidadesCatalogo.set(unidades),
    });
  }

  cargar(): void {
    this.loading.set(true);
    this.rolesService.findAll().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
        this.cargarUsuarios();
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
      },
    });
  }

  // ── Usuarios ──────────────────────────────────────────────────────────────
  onUsuariosPageChange(page: number): void {
    this.usuariosPage.set(page);
    this.cargarUsuarios();
  }

  private cargarUsuarios(): void {
    this.usuariosLoading.set(true);
    this.usuariosService
      .findAll({ page: this.usuariosPage(), pageSize: this.usuariosPageSize })
      .subscribe({
        next: ({ items, total }) => {
          this.usuarios.set(items);
          this.usuariosTotal.set(total);
          this.usuariosLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
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
      unidadId: usuario.unidad?.id ?? '',
      nuevaPassword: '',
    });
    this.modalError.set(null);
    this.editTarget.set(usuario);
    this.modal.set('editarUsuario');
  }

  crearUsuario(): void {
    if (this.nuevoUsuarioForm.invalid) {
      this.nuevoUsuarioForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
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
          this.toast.success(
            `Se realizó una nueva invitación a ${username}. Esto queda visible en la sección de invitaciones.`,
          );
        },
        error: (err) => this.modalError.set(this.parseError(err)),
      });
  }

  guardarEdicion(): void {
    const target = this.editTarget();
    if (!target) return;

    const { roles, estado, unidadId, nuevaPassword } = this.editForm.getRawValue();

    if (nuevaPassword && nuevaPassword.length > 0 && nuevaPassword.length < 8) {
      this.modalError.set('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.modalError.set(null);
    const tasks: Observable<unknown>[] = [];

    const rolesNuevos = (roles ?? []) as string[];
    const rolesActuales = target.roles.map((r) => r.nombre);

    const aAgregar = rolesNuevos.filter((n) => !rolesActuales.includes(n));
    const aQuitar = target.roles.filter((r) => !rolesNuevos.includes(r.nombre));

    for (const nombre of aAgregar) {
      const rol = this.roles().find((r) => r.nombre === nombre);
      if (rol) tasks.push(this.usuariosService.asignarRol(target.id, rol.id));
    }
    for (const r of aQuitar) {
      tasks.push(this.usuariosService.quitarRol(target.id, r.id));
    }

    if (estado && estado !== target.estado) {
      tasks.push(this.usuariosService.update(target.id, { estado }));
    }

    // Cambiar la unidad modifica los permisos efectivos del usuario y le cierra la sesión.
    const unidadActual = target.unidad?.id ?? '';
    if ((unidadId ?? '') !== unidadActual) {
      const nueva = unidadId ? unidadId : null;
      tasks.push(this.usuariosService.asignarUnidad(target.id, nueva));
    }

    if (nuevaPassword && nuevaPassword.length >= 8) {
      tasks.push(
        this.usuariosService.resetPassword(target.id, { password: nuevaPassword }),
      );
    }

    if (tasks.length === 0) {
      this.cerrarModal();
      return;
    }

    forkJoin(tasks).subscribe({
      next: () => {
        const nombre = target.persona?.nombre ?? target.username;
        this.cerrarModal();
        this.toast.success(`Cambios guardados para ${nombre}`);
        this.cargar();
      },
      error: (err) => this.modalError.set(this.parseError(err)),
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
      error: (err) => this.modalError.set(this.parseError(err)),
    });
  }

  eliminarRol(rol: Rol): void {
    this.cerrarMenu();
    if (
      !confirm(
        `¿Eliminar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.rolesService.remove(rol.id).subscribe({
      next: () => {
        this.toast.success('Rol eliminado');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.toast.error(this.parseError(err)),
    });
  }

  irAEditarPermisos(rol: Rol): void {
    this.cerrarMenu();
    this.router.navigate(['/usuarios-y-roles/roles', rol.id, 'permisos']);
  }

  // ── Invitaciones ─────────────────────────────────────────────────────────
  cargarInvitaciones(): void {
    this.invitacionesLoading.set(true);
    this.invitacionesService.findAll({ estado: this.estadoFiltro() }).subscribe({
      next: (items) => {
        this.invitaciones.set(items);
        this.invitacionesLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.invitacionesLoading.set(false);
      },
    });
  }

  onEstadoFiltroChange(event: Event): void {
    this.estadoFiltro.set((event.target as HTMLSelectElement).value);
    this.cargarInvitaciones();
  }

  cambiarTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'invitaciones') {
      this.cargarInvitaciones();
    }
  }

  revocarInvitacion(inv: Invitacion): void {
    if (!confirm(`¿Revocar la invitación enviada a ${inv.email}?`)) return;
    this.revocandoId.set(inv.id);
    this.invitacionesService.remove(inv.id).subscribe({
      next: () => {
        this.revocandoId.set(null);
        this.toast.success(`Invitación a ${inv.email} revocada`);
        this.cargarInvitaciones();
      },
      error: (err) => {
        this.revocandoId.set(null);
        this.toast.error(this.parseError(err));
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

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
