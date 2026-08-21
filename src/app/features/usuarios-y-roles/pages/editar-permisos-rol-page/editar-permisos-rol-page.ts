import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { PermisosService } from '../../../../core/services/permisos.service';
import { RolesService } from '../../../../core/services/roles.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Permiso, Rol } from '../../../../core/models/auth.models';

@Component({
  selector: 'app-editar-permisos-rol-page',
  standalone: false,
  templateUrl: './editar-permisos-rol-page.html',
  styleUrl: './editar-permisos-rol-page.scss',
})
export class EditarPermisosRolPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rolesService = inject(RolesService);
  private readonly permisosService = inject(PermisosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private rolId = '';

  readonly rol = signal<Rol | null>(null);
  readonly permisos = signal<Permiso[]>([]);
  readonly permisosTotal = signal(0);
  readonly loading = signal(false);
  readonly permisosLoading = signal(false);

  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = 10;

  readonly puedeGestionarRoles = computed(() =>
    this.auth.hasPermiso('roles.gestionar'),
  );
  readonly esAdministrador = computed(
    () => this.rol()?.nombre === 'Administrador del sistema',
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/usuarios-y-roles']);
      return;
    }
    this.rolId = id;
    this.cargarRol();
    this.cargarPermisos();
  }

  private cargarRol(): void {
    this.loading.set(true);
    this.rolesService.findOne(this.rolId).subscribe({
      next: (rol) => {
        this.rol.set(rol);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
        this.router.navigate(['/usuarios-y-roles']);
      },
    });
  }

  private cargarPermisos(): void {
    this.permisosLoading.set(true);
    this.permisosService
      .findAll({
        page: this.page(),
        pageSize: this.pageSize,
        search: this.search(),
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

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    this.cargarPermisos();
  }

  onPageChange(p: number): void {
    this.page.set(p);
    this.cargarPermisos();
  }

  rolTienePermiso(permiso: Permiso): boolean {
    return this.rol()?.permisos.some((p) => p.id === permiso.id) ?? false;
  }

  togglePermiso(permiso: Permiso, activar: boolean): void {
    const op = activar
      ? this.rolesService.activarPermiso(this.rolId, permiso.id)
      : this.rolesService.desactivarPermiso(this.rolId, permiso.id);
    op.subscribe({
      next: (actualizado) => {
        this.rol.set(actualizado);
        this.toast.success(`Permiso ${activar ? 'activado' : 'desactivado'}`);
      },
      error: (err: HttpErrorResponse) => this.toast.error(this.parseError(err)),
    });
  }

  volver(): void {
    this.router.navigate(['/usuarios-y-roles']);
  }

  trackPermiso = (_: number, p: Permiso) => p.id;

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
