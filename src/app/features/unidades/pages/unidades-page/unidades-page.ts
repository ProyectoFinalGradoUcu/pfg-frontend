import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import { UnidadesService } from '../../../../core/services/unidades.service';
import { RolesService } from '../../../../core/services/roles.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Rol, Usuario } from '../../../../core/models/auth.models';
import {
  UnidadDetalle,
  UnidadListItem,
  UsuarioDeUnidad,
} from '../../../../core/models/unidades.models';

type Modal = null | 'nuevaUnidad' | 'editarUnidad' | 'gestionar' | 'agregarUsuarios';
type TabDetalle = 'roles' | 'usuarios';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-unidades-page',
  standalone: false,
  templateUrl: './unidades-page.html',
  styleUrl: './unidades-page.scss',
})
export class UnidadesPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly fb = inject(FormBuilder);
  private readonly unidadesService = inject(UnidadesService);
  private readonly rolesService = inject(RolesService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly PAGE_SIZE = PAGE_SIZE;

  // ── Listado ────────────────────────────────────────────────────────────────
  readonly unidades = signal<UnidadListItem[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busqueda = new FormControl('', { nonNullable: true });

  // ── Modales ────────────────────────────────────────────────────────────────
  readonly modal = signal<Modal>(null);
  readonly modalError = signal<string | null>(null);
  readonly tabDetalle = signal<TabDetalle>('roles');

  readonly seleccionada = signal<UnidadDetalle | null>(null);
  readonly detalleLoading = signal(false);

  readonly roles = signal<Rol[]>([]);
  readonly rolAAgregar = new FormControl('', { nonNullable: true });

  readonly usuariosUnidad = signal<UsuarioDeUnidad[]>([]);
  readonly usuariosLoading = signal(false);

  // ── Alta de usuarios ───────────────────────────────────────────────────────
  readonly candidatos = signal<Usuario[]>([]);
  readonly candidatosLoading = signal(false);
  readonly seleccionados = signal<Set<string>>(new Set());
  readonly filtroCandidatos = signal('');

  readonly unidadForm = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    denominacion: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    vigente: [true],
  });

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('unidades.gestionar'));

  /** Asignar usuarios modifica cuentas, así que el backend exige también `usuarios.gestionar`. */
  readonly puedeAsignarUsuarios = computed(() =>
    this.auth.hasAllPermisos(['unidades.gestionar', 'usuarios.gestionar']),
  );

  /** Usuarios del sistema que todavía no están en esta unidad, filtrados en el cliente. */
  readonly candidatosFiltrados = computed(() => {
    const termino = this.filtroCandidatos().trim().toLowerCase();
    const unidadId = this.seleccionada()?.id;
    return this.candidatos()
      .filter((u) => u.unidad?.id !== unidadId)
      .filter(
        (u) =>
          !termino ||
          u.username.toLowerCase().includes(termino) ||
          (u.persona?.nombre ?? '').toLowerCase().includes(termino),
      );
  });

  readonly rolesAsignables = computed(() => {
    const unidad = this.seleccionada();
    if (!unidad) return [];
    const yaAsignados = new Set(unidad.roles.map((r) => r.id));
    return this.roles().filter((r) => !yaAsignados.has(r.id));
  });

  readonly cantidadSeleccionados = computed(() => this.seleccionados().size);

  ngOnInit(): void {
    this.cargar();

    this.busqueda.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((termino) => {
          this.loading.set(true);
          this.pagina.set(1);
          return this.unidadesService.findAll({
            page: 1,
            pageSize: PAGE_SIZE,
            search: termino || undefined,
          });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => {
          this.unidades.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
          this.error.set(null);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudieron cargar las unidades.');
        },
      });

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Listado ────────────────────────────────────────────────────────────────

  cargar(pagina = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.pagina.set(pagina);

    this.unidadesService
      .findAll({
        page: pagina,
        pageSize: PAGE_SIZE,
        search: this.busqueda.value || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.unidades.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudieron cargar las unidades.');
        },
      });
  }

  // ── Alta y edición de unidad ───────────────────────────────────────────────

  abrirNuevaUnidad(): void {
    this.unidadForm.reset({ codigo: '', denominacion: '', vigente: true });
    this.unidadForm.controls.codigo.enable();
    this.modalError.set(null);
    this.modal.set('nuevaUnidad');
  }

  abrirEditarUnidad(unidad: UnidadListItem): void {
    this.unidadForm.reset({
      codigo: unidad.codigo,
      denominacion: unidad.denominacion,
      vigente: unidad.vigente,
    });
    // El código es la referencia estable de la unidad: se muestra pero no se edita.
    this.unidadForm.controls.codigo.disable();
    this.modalError.set(null);
    this.seleccionada.set({
      id: unidad.id,
      codigo: unidad.codigo,
      denominacion: unidad.denominacion,
      vigente: unidad.vigente,
      roles: [],
      cantidadUsuarios: unidad.cantidadUsuarios,
      cantidadFuncionarios: unidad.cantidadFuncionarios,
    });
    this.modal.set('editarUnidad');
  }

  guardarUnidad(): void {
    if (this.unidadForm.invalid) {
      this.unidadForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
      return;
    }
    this.modalError.set(null);

    const { codigo, denominacion, vigente } = this.unidadForm.getRawValue();
    const esNueva = this.modal() === 'nuevaUnidad';

    const peticion = esNueva
      ? this.unidadesService.create({
          codigo: codigo!,
          denominacion: denominacion!,
          vigente: vigente ?? true,
        })
      : this.unidadesService.update(this.seleccionada()!.id, {
          denominacion: denominacion!,
          vigente: vigente ?? true,
        });

    peticion.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.cerrarModal();
        this.toast.success(esNueva ? 'Unidad creada' : 'Unidad actualizada');
        this.cargar(this.pagina());
      },
      error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
    });
  }

  // ── Gestión (roles + usuarios) ─────────────────────────────────────────────

  abrirGestionar(unidad: UnidadListItem, tab: TabDetalle = 'roles'): void {
    this.tabDetalle.set(tab);
    this.modalError.set(null);
    this.detalleLoading.set(true);
    this.modal.set('gestionar');

    this.unidadesService
      .findOne(unidad.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detalle) => {
          this.seleccionada.set(detalle);
          this.detalleLoading.set(false);
          if (this.roles().length === 0) this.cargarRoles();
          if (tab === 'usuarios') this.cargarUsuarios();
        },
        error: () => {
          this.detalleLoading.set(false);
          this.modalError.set('No se pudo cargar el detalle de la unidad.');
        },
      });
  }

  cambiarTabDetalle(tab: TabDetalle): void {
    this.tabDetalle.set(tab);
    if (tab === 'usuarios' && this.usuariosUnidad().length === 0) {
      this.cargarUsuarios();
    }
  }

  private cargarRoles(): void {
    this.rolesService
      .findAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => this.roles.set(roles),
        error: () => this.toast.error('No se pudieron cargar los roles.'),
      });
  }

  agregarRol(): void {
    const unidad = this.seleccionada();
    const rolId = this.rolAAgregar.value;
    if (!unidad || !rolId) return;
    if (!this.confirmarImpacto(unidad, 'asignar')) return;

    this.unidadesService
      .asignarRol(unidad.id, rolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detalle) => {
          this.seleccionada.set(detalle);
          this.rolAAgregar.setValue('');
          this.toast.success('Rol asignado');
          this.cargar(this.pagina());
        },
        error: (err: HttpErrorResponse) =>
          this.toast.error(
            err.status === 409
              ? 'El rol ya está asignado a esta unidad.'
              : 'No se pudo asignar el rol.',
          ),
      });
  }

  quitarRol(rolId: string): void {
    const unidad = this.seleccionada();
    if (!unidad) return;
    if (!this.confirmarImpacto(unidad, 'quitar')) return;

    this.unidadesService
      .quitarRol(unidad.id, rolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detalle) => {
          this.seleccionada.set(detalle);
          this.toast.success('Rol quitado');
          this.cargar(this.pagina());
        },
        error: () => this.toast.error('No se pudo quitar el rol.'),
      });
  }

  /**
   * Cambiar los roles de una unidad desloguea a todos sus usuarios. El diálogo cuantifica el
   * impacto y avisa aparte si quien confirma se va a desloguear a sí mismo.
   */
  private confirmarImpacto(unidad: UnidadDetalle, accion: 'asignar' | 'quitar'): boolean {
    const n = unidad.cantidadUsuarios;
    if (n === 0) return true;

    let mensaje =
      `Esta unidad tiene ${n} ${n === 1 ? 'usuario' : 'usuarios'}. ` +
      `Al ${accion} este rol, ${n === 1 ? 'va' : 'todos van'} a tener que volver a iniciar sesión.`;

    if (this.auth.currentUser()?.unidadId === unidad.id) {
      mensaje += '\n\nVos pertenecés a esta unidad, así que también se va a cerrar tu sesión.';
    }

    return confirm(`${mensaje}\n\n¿Confirmás?`);
  }

  // ── Usuarios del sistema de la unidad ──────────────────────────────────────

  cargarUsuarios(): void {
    const unidad = this.seleccionada();
    if (!unidad) return;

    this.usuariosLoading.set(true);
    this.unidadesService
      .findUsuarios(unidad.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.usuariosUnidad.set(res.items);
          this.usuariosLoading.set(false);
        },
        error: () => {
          this.usuariosLoading.set(false);
          this.toast.error('No se pudieron cargar los usuarios de la unidad.');
        },
      });
  }

  abrirAgregarUsuarios(): void {
    this.seleccionados.set(new Set());
    this.filtroCandidatos.set('');
    this.modalError.set(null);
    this.modal.set('agregarUsuarios');

    this.candidatosLoading.set(true);
    this.usuariosService
      .findAll({ page: 1, pageSize: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.candidatos.set(res.items);
          this.candidatosLoading.set(false);
        },
        error: () => {
          this.candidatosLoading.set(false);
          this.toast.error('No se pudieron cargar los usuarios del sistema.');
        },
      });
  }

  actualizarFiltroCandidatos(valor: string): void {
    this.filtroCandidatos.set(valor);
  }

  alternarSeleccion(usuarioId: string): void {
    const actual = new Set(this.seleccionados());
    if (actual.has(usuarioId)) actual.delete(usuarioId);
    else actual.add(usuarioId);
    this.seleccionados.set(actual);
  }

  estaSeleccionado(usuarioId: string): boolean {
    return this.seleccionados().has(usuarioId);
  }

  confirmarAgregarUsuarios(): void {
    const unidad = this.seleccionada();
    const ids = [...this.seleccionados()];
    if (!unidad || ids.length === 0) return;

    this.modalError.set(null);
    this.unidadesService
      .asignarUsuarios(unidad.id, ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.modal.set('gestionar');
          this.tabDetalle.set('usuarios');

          const partes: string[] = [];
          if (res.asignados > 0) {
            partes.push(
              `${res.asignados} ${res.asignados === 1 ? 'usuario asignado' : 'usuarios asignados'}`,
            );
          }
          if (res.yaEstaban > 0) partes.push(`${res.yaEstaban} ya estaban en la unidad`);
          this.toast.success(partes.join(' · ') || 'Sin cambios');

          this.cargarUsuarios();
          this.recargarDetalle();
          this.cargar(this.pagina());
        },
        error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
      });
  }

  /** Sacar a un usuario de la unidad le cierra la sesión: pierde los roles heredados. */
  quitarUsuarioDeUnidad(usuario: UsuarioDeUnidad): void {
    const unidad = this.seleccionada();
    if (!unidad) return;

    const confirmado = confirm(
      `${usuario.username} va a quedar sin unidad y va a operar solo con sus permisos ` +
        'globales. Se le va a cerrar la sesión activa.\n\n¿Confirmás?',
    );
    if (!confirmado) return;

    this.unidadesService
      .quitarUsuario(unidad.id, usuario.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Usuario quitado de la unidad');
          this.cargarUsuarios();
          this.recargarDetalle();
          this.cargar(this.pagina());
        },
        error: () => this.toast.error('No se pudo quitar el usuario.'),
      });
  }

  private recargarDetalle(): void {
    const unidad = this.seleccionada();
    if (!unidad) return;
    this.unidadesService
      .findOne(unidad.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (detalle) => this.seleccionada.set(detalle) });
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.seleccionada.set(null);
    this.usuariosUnidad.set([]);
    this.seleccionados.set(new Set());
  }

  volverAGestionar(): void {
    this.modal.set('gestionar');
    this.modalError.set(null);
  }

  private parseError(err: HttpErrorResponse): string {
    const detalle = err.error as { message?: string | string[] } | undefined;
    const mensaje = detalle?.message;
    if (Array.isArray(mensaje)) return mensaje.join('. ');
    if (typeof mensaje === 'string') return mensaje;
    return 'Ocurrió un error. Intentá de nuevo.';
  }
}
