import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { InvitacionesService } from '../../../../core/services/invitaciones.service';
import { PermisosService } from '../../../../core/services/permisos.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { Invitacion, Permiso, Rol, Usuario } from '../../../../core/models/auth.models';

type Tab = 'usuarios' | 'invitaciones' | 'roles';
type ModalKind = 'nuevoUsuario' | 'editarUsuario' | null;

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
  private readonly rolesService = inject(RolesService);
  private readonly permisosService = inject(PermisosService);
  private readonly invitacionesService = inject(InvitacionesService);
  private readonly toast = inject(ToastService);

  // ── Tab ──────────────────────────────────────────────────────────────────
  readonly tab = signal<Tab>('usuarios');

  // ── Usuarios ──────────────────────────────────────────────────────────────
  readonly usuarios = signal<Usuario[]>([]);
  readonly usuariosTotal = signal(0);
  readonly usuariosLoading = signal(false);
  readonly usuariosPage = signal(1);
  readonly usuariosPageSize = 10;

  // ── Roles / Permisos ──────────────────────────────────────────────────────
  readonly roles = signal<Rol[]>([]);
  readonly permisos = signal<Permiso[]>([]);
  readonly permisosTotal = signal(0);
  readonly loading = signal(false);
  readonly permisosLoading = signal(false);
  readonly permisoSearch = signal('');
  readonly permisoPage = signal(1);
  readonly permisoPageSize = 10;

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
    rol: ['', Validators.required],
  });

  readonly editForm = this.fb.group({
    rol: [''],
    estado: ['activo' as 'activo' | 'bloqueado'],
    nuevaPassword: [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.rolesService.findAll().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
        this.cargarUsuarios();
        this.cargarPermisos();
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
    this.nuevoUsuarioForm.reset({ username: '', rol: '' });
    this.modalError.set(null);
    this.invitacionesService.findAll().subscribe({
      next: (items) => this.invitacionesTodas.set(items),
    });
    this.modal.set('nuevoUsuario');
  }

  abrirEditar(usuario: Usuario): void {
    this.editForm.controls.rol.enable();
    this.editForm.controls.estado.enable();
    this.editForm.reset({
      rol: usuario.roles[0]?.nombre ?? '',
      estado: usuario.estado,
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
    const { username, rol } = this.nuevoUsuarioForm.getRawValue();
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
      .create({ email: username!, roles: rol ? [rol] : undefined })
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

    const { rol, estado, nuevaPassword } = this.editForm.getRawValue();

    if (nuevaPassword && nuevaPassword.length > 0 && nuevaPassword.length < 8) {
      this.modalError.set('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.modalError.set(null);
    const tasks: Observable<unknown>[] = [];

    const rolActual = target.roles[0]?.nombre ?? '';
    if (rol !== rolActual) {
      for (const r of target.roles) {
        tasks.push(this.usuariosService.quitarRol(target.id, r.id));
      }
      if (rol) {
        const nuevoRol = this.roles().find((r) => r.nombre === rol);
        if (nuevoRol) {
          tasks.push(this.usuariosService.asignarRol(target.id, nuevoRol.id));
        }
      }
    }

    if (estado && estado !== target.estado) {
      tasks.push(this.usuariosService.update(target.id, { estado }));
    }

    if (nuevaPassword && nuevaPassword.length >= 8) {
      tasks.push(this.usuariosService.resetPassword(target.id, { password: nuevaPassword }));
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

  // ── Roles / Permisos ──────────────────────────────────────────────────────
  onPermisoSearch(event: Event): void {
    this.permisoSearch.set((event.target as HTMLInputElement).value);
    this.permisoPage.set(1);
    this.cargarPermisos();
  }

  onPermisoPageChange(page: number): void {
    this.permisoPage.set(page);
    this.cargarPermisos();
  }

  private cargarPermisos(): void {
    this.permisosLoading.set(true);
    this.permisosService
      .findAll({
        page: this.permisoPage(),
        pageSize: this.permisoPageSize,
        search: this.permisoSearch(),
      })
      .subscribe({
        next: ({ items, total }) => {
          this.permisos.set(items);
          this.permisosTotal.set(total);
          this.permisosLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.permisosLoading.set(false);
        },
      });
  }

  togglePermisoEnRol(rol: Rol, permiso: Permiso, activar: boolean): void {
    const op = activar
      ? this.rolesService.activarPermiso(rol.id, permiso.id)
      : this.rolesService.desactivarPermiso(rol.id, permiso.id);
    op.subscribe({
      next: (actualizado) => {
        this.roles.update((lista) =>
          lista.map((r) => (r.id === actualizado.id ? actualizado : r)),
        );
        this.toast.success(
          `Permiso ${activar ? 'activado' : 'desactivado'} para ${rol.nombre}`,
        );
      },
      error: (err) => this.toast.error(this.parseError(err)),
    });
  }

  rolTienePermiso(rol: Rol, permiso: Permiso): boolean {
    return rol.permisos.some((p) => p.id === permiso.id);
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
  }

  // ── Track ─────────────────────────────────────────────────────────────────
  trackUsuario = (_: number, u: Usuario) => u.id;
  trackRol = (_: number, r: Rol) => r.id;
  trackPermiso = (_: number, p: Permiso) => p.id;
  trackInvitacion = (_: number, i: Invitacion) => i.id;

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
