import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { PermisosService } from '../../../../core/services/permisos.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { Permiso, Rol, Usuario } from '../../../../core/models/auth.models';

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
  private readonly toast = inject(ToastService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly usuariosTotal = signal(0);
  readonly roles = signal<Rol[]>([]);
  readonly permisos = signal<Permiso[]>([]);
  readonly permisosTotal = signal(0);
  readonly loading = signal(false);
  readonly usuariosLoading = signal(false);
  readonly permisosLoading = signal(false);
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);
  readonly editTarget = signal<Usuario | null>(null);

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

  readonly usuariosPage = signal(1);
  readonly usuariosPageSize = 10;

  readonly permisoSearch = signal('');
  readonly permisoPage = signal(1);
  readonly permisoPageSize = 10;

  onPermisoSearch(event: Event): void {
    this.permisoSearch.set((event.target as HTMLInputElement).value);
    this.permisoPage.set(1);
    this.cargarPermisos();
  }

  onPermisoPageChange(page: number): void {
    this.permisoPage.set(page);
    this.cargarPermisos();
  }

  readonly nuevoUsuarioForm = this.fb.group({
    username: ['', [Validators.required, Validators.email, Validators.maxLength(60)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rol: ['', Validators.required],
  });

  readonly editForm = this.fb.group({
    rol: [''],
    estado: ['activo' as 'activo' | 'bloqueado'],
    nuevaPassword: [''],
  });

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

  onUsuariosPageChange(page: number): void {
    this.usuariosPage.set(page);
    this.cargarUsuarios();
  }

  private cargarUsuarios(): void {
    this.usuariosLoading.set(true);
    this.usuariosService
      .findAll({
        page: this.usuariosPage(),
        pageSize: this.usuariosPageSize,
      })
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

  abrirNuevoUsuario(): void {
    this.nuevoUsuarioForm.reset({
      username: '',
      password: '',
      rol: '',
    });
    this.modalError.set(null);
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

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.editTarget.set(null);
  }

  crearUsuario(): void {
    if (this.nuevoUsuarioForm.invalid) {
      this.nuevoUsuarioForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
      return;
    }
    const { username, password, rol } = this.nuevoUsuarioForm.getRawValue();
    this.modalError.set(null);
    this.usuariosService
      .create({
        username: username!,
        password: password!,
        roles: rol ? [rol] : undefined,
      })
      .subscribe({
        next: () => {
          this.cerrarModal();
          this.toast.success(`Usuario ${username} creado correctamente`);
          this.cargar();
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

  trackUsuario = (_: number, u: Usuario) => u.id;
  trackRol = (_: number, r: Rol) => r.id;
  trackPermiso = (_: number, p: Permiso) => p.id;

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
