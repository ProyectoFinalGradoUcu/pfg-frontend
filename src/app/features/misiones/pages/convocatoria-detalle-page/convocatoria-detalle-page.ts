import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PersonalService, PersonaListItem } from '../../../../core/services/personal.service';
import {
  Convocatoria,
  FuncionarioConvocatoria,
  FuncionarioConvocatoriaPayload,
  MisionDefinicion,
} from '../../../../core/models/misiones.models';

@Component({
  selector: 'app-convocatoria-detalle-page',
  standalone: false,
  templateUrl: './convocatoria-detalle-page.html',
  styleUrl: './convocatoria-detalle-page.scss',
})
export class ConvocatoriaDetallePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly misionesService = inject(MisionesService);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private misionId = '';

  readonly mision = signal<MisionDefinicion | null>(null);
  readonly convocatoria = signal<Convocatoria | null>(null);
  readonly loading = signal(false);
  readonly loadingFuncionarios = signal(false);
  readonly asignando = signal(false);
  readonly editando = signal(false);
  readonly borrandoTodos = signal(false);
  readonly modalAsignar = signal(false);
  readonly modalErrorAsignar = signal<string | null>(null);
  readonly modalConfirmEliminarTodos = signal(false);
  readonly modalEditarConvocatoria = signal(false);
  readonly modalErrorConvocatoria = signal<string | null>(null);
  readonly guardandoConvocatoria = signal(false);
  readonly modalErrorEditarFuncionario = signal<string | null>(null);
  readonly funcionarioEditando = signal<FuncionarioConvocatoria | null>(null);
  readonly funcionarioAQuitar = signal<FuncionarioConvocatoria | null>(null);
  readonly quitando = signal(false);
  readonly menuAbierto = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);
  readonly personal = signal<PersonaListItem[]>([]);
  readonly funcionarios = signal<FuncionarioConvocatoria[]>([]);
  readonly funcionariosTotal = signal(0);
  readonly funcionariosPage = signal(1);
  readonly funcionariosLimit = 5;
  readonly busquedaFuncionario = signal('');
  private readonly busquedaSubject = new Subject<string>();

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('misiones.gestionar'));

  readonly asignarForm = this.fb.group({
    persona_id: ['', Validators.required],
    numero_orden: [''],
    boletin: [''],
    observaciones: [''],
  });

  readonly editarFuncionarioForm = this.fb.group({
    numero_orden: [''],
    boletin: [''],
    observaciones: [''],
  });

  readonly convocatoriaForm = this.fb.group({
    numero_orden: [''],
    boletin: [''],
    fecha_salida: [''],
    fecha_llegada: [''],
    observaciones: [''],
  });

  ngOnInit(): void {
    this.misionId = this.route.snapshot.paramMap.get('misionId')!;
    const convocatoriaId = this.route.snapshot.paramMap.get('convocatoriaId')!;
    this.cargar(convocatoriaId);
    this.personalService.findAll().subscribe({
      next: (p) => this.personal.set(p),
    });

    this.busquedaSubject.pipe(debounceTime(350)).subscribe(() => {
      const c = this.convocatoria();
      if (!c) return;
      this.cargarFuncionarios(c.id, 1);
    });
  }

  cargar(convocatoriaId: string): void {
    this.loading.set(true);
    forkJoin({
      mision: this.misionesService.findDefinicionById(this.misionId),
      convocatoria: this.misionesService.findConvocatoriaById(this.misionId, convocatoriaId),
    }).subscribe({
      next: ({ mision, convocatoria }) => {
        this.mision.set(mision);
        this.convocatoria.set(convocatoria);
        this.loading.set(false);
        this.cargarFuncionarios(convocatoriaId, 1);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
        this.router.navigate(['/misiones/catalogo', this.misionId]);
      },
    });
  }

  cargarFuncionarios(convocatoriaId: string, page = this.funcionariosPage()): void {
    this.loadingFuncionarios.set(true);
    this.misionesService
      .findFuncionariosByConvocatoria(
        this.misionId,
        convocatoriaId,
        page,
        this.funcionariosLimit,
        this.busquedaFuncionario().trim() || undefined,
      )
      .subscribe({
        next: (res) => {
          this.funcionarios.set(res.items);
          this.funcionariosTotal.set(res.total);
          this.funcionariosPage.set(res.page);
          this.loadingFuncionarios.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.loadingFuncionarios.set(false);
        },
      });
  }

  cargarFuncionariosPage(page: number): void {
    const c = this.convocatoria();
    if (!c) return;
    this.cargarFuncionarios(c.id, page);
  }

  onBusquedaFuncionarioInput(value: string): void {
    this.busquedaFuncionario.set(value);
    this.busquedaSubject.next(value);
  }

  limpiarBusquedaFuncionario(): void {
    this.busquedaFuncionario.set('');
    this.busquedaSubject.next('');
  }

  volver(): void {
    this.router.navigate(['/misiones/catalogo', this.misionId]);
  }

  irAlCatalogo(): void {
    this.router.navigate(['/misiones/catalogo']);
  }

  abrirEditarConvocatoria(): void {
    const c = this.convocatoria();
    if (!c) return;

    this.modalErrorConvocatoria.set(null);
    this.convocatoriaForm.patchValue({
      numero_orden: c.numero_orden,
      boletin: c.boletin,
      fecha_salida: c.fecha_salida,
      fecha_llegada: c.fecha_llegada,
      observaciones: c.observaciones,
    });
    this.modalEditarConvocatoria.set(true);
  }

  cerrarModalConvocatoria(): void {
    this.modalEditarConvocatoria.set(false);
    this.modalErrorConvocatoria.set(null);
  }

  guardarConvocatoria(): void {
    const c = this.convocatoria();
    if (!c) return;

    const raw = this.convocatoriaForm.getRawValue();
    const payload = {
      numero_orden: raw.numero_orden || undefined,
      boletin: raw.boletin || undefined,
      fecha_salida: raw.fecha_salida || undefined,
      fecha_llegada: raw.fecha_llegada || undefined,
      observaciones: raw.observaciones || undefined,
    };

    this.modalErrorConvocatoria.set(null);
    this.guardandoConvocatoria.set(true);
    this.misionesService
      .editarConvocatoria(this.misionId, c.id, payload)
      .subscribe({
        next: (updated) => {
          this.convocatoria.set(updated);
          this.guardandoConvocatoria.set(false);
          this.cerrarModalConvocatoria();
          this.toast.success('Convocatoria actualizada correctamente');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoConvocatoria.set(false);
          this.modalErrorConvocatoria.set(this.parseError(err));
        },
      });
  }

  // ── Asignar funcionario (modal) ──────────────────────────────────────────

  abrirModalAsignar(): void {
    this.asignarForm.reset({ persona_id: '', numero_orden: '', boletin: '', observaciones: '' });
    this.modalErrorAsignar.set(null);
    this.modalAsignar.set(true);
  }

  cerrarModalAsignar(): void {
    this.modalAsignar.set(false);
    this.modalErrorAsignar.set(null);
  }

  asignarFuncionario(): void {
    const c = this.convocatoria();
    if (!c || this.asignarForm.invalid) {
      this.asignarForm.markAllAsTouched();
      return;
    }

    const raw = this.asignarForm.getRawValue();
    if (!raw.numero_orden?.trim() && !raw.boletin?.trim()) {
      this.modalErrorAsignar.set('Debés ingresar al menos el N° de orden o el boletín.');
      return;
    }

    const payload: FuncionarioConvocatoriaPayload = {
      persona_id: raw.persona_id!,
      numero_orden: raw.numero_orden || undefined,
      boletin: raw.boletin || undefined,
      observaciones: raw.observaciones || undefined,
    };

    this.modalErrorAsignar.set(null);
    this.asignando.set(true);
    this.misionesService
      .addFuncionarios(this.misionId, c.id, [payload])
      .pipe(switchMap(() => this.recargarDetalleYFuncionarios$(c.id, this.funcionariosPage())))
      .subscribe({
        next: ({ detalle, funcionarios }) => {
          this.convocatoria.set(detalle);
          this.funcionarios.set(funcionarios.items);
          this.funcionariosTotal.set(funcionarios.total);
          this.funcionariosPage.set(funcionarios.page);
          this.asignando.set(false);
          this.cerrarModalAsignar();
          this.toast.success('Funcionario asignado correctamente');
        },
        error: (err: HttpErrorResponse) => {
          this.modalErrorAsignar.set(this.parseError(err));
          this.asignando.set(false);
        },
      });
  }

  toggleMenu(personaId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuAbierto() === personaId) {
      this.cerrarMenu();
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      this.menuAbierto.set(personaId);
    }
  }

  cerrarMenu(): void {
    this.menuAbierto.set(null);
    this.menuPosition.set(null);
  }

  // ── Quitar funcionario (modal de confirmación) ───────────────────────────

  abrirConfirmQuitar(f: FuncionarioConvocatoria): void {
    this.cerrarMenu();
    this.funcionarioAQuitar.set(f);
  }

  cerrarConfirmQuitar(): void {
    this.funcionarioAQuitar.set(null);
  }

  confirmarQuitarFuncionario(): void {
    const c = this.convocatoria();
    const f = this.funcionarioAQuitar();
    if (!c || !f) return;

    this.quitando.set(true);
    this.misionesService.deleteFuncionario(this.misionId, c.id, f.persona_id).subscribe({
      next: () => {
        this.quitando.set(false);
        this.cerrarConfirmQuitar();
        this.cargar(c.id);
        this.toast.success('Funcionario removido');
      },
      error: (err: HttpErrorResponse) => {
        this.quitando.set(false);
        this.toast.error(this.parseError(err));
      },
    });
  }

  eliminarTodosFuncionarios(): void {
    const c = this.convocatoria();
    if (!c) return;

    this.borrandoTodos.set(true);
    this.misionesService
      .deleteAllFuncionarios(this.misionId, c.id)
      .pipe(switchMap(() => this.recargarDetalleYFuncionarios$(c.id, 1)))
      .subscribe({
        next: ({ detalle, funcionarios }) => {
          this.convocatoria.set(detalle);
          this.funcionarios.set(funcionarios.items);
          this.funcionariosTotal.set(funcionarios.total);
          this.funcionariosPage.set(funcionarios.page);
          this.modalConfirmEliminarTodos.set(false);
          this.borrandoTodos.set(false);
          this.toast.success('Funcionarios eliminados correctamente');
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.borrandoTodos.set(false);
        },
      });
  }

  abrirConfirmEliminarTodos(): void {
    this.modalConfirmEliminarTodos.set(true);
  }

  cerrarConfirmEliminarTodos(): void {
    this.modalConfirmEliminarTodos.set(false);
  }

  abrirEditarFuncionario(f: FuncionarioConvocatoria): void {
    this.funcionarioEditando.set(f);
    this.modalErrorEditarFuncionario.set(null);
    this.editarFuncionarioForm.patchValue({
      numero_orden: f.numero_orden ?? '',
      boletin: f.boletin ?? '',
      observaciones: f.observaciones ?? '',
    });
    this.cerrarMenu();
  }

  cerrarEditarFuncionario(): void {
    this.funcionarioEditando.set(null);
    this.modalErrorEditarFuncionario.set(null);
    this.editarFuncionarioForm.reset({ numero_orden: '', boletin: '', observaciones: '' });
  }

  guardarEdicionFuncionario(): void {
    const c = this.convocatoria();
    const f = this.funcionarioEditando();
    if (!c || !f) return;

    const raw = this.editarFuncionarioForm.getRawValue();
    if (!raw.numero_orden?.trim() && !raw.boletin?.trim()) {
      this.modalErrorEditarFuncionario.set('Debés ingresar al menos el N° de orden o el boletín.');
      return;
    }

    const payload: Partial<FuncionarioConvocatoriaPayload> = {
      numero_orden: raw.numero_orden || undefined,
      boletin: raw.boletin || undefined,
      observaciones: raw.observaciones || undefined,
    };

    this.modalErrorEditarFuncionario.set(null);
    this.editando.set(true);
    this.misionesService
      .updateFuncionario(this.misionId, c.id, f.persona_id, payload)
      .pipe(switchMap(() => this.recargarDetalleYFuncionarios$(c.id, this.funcionariosPage())))
      .subscribe({
        next: ({ detalle, funcionarios }) => {
          this.convocatoria.set(detalle);
          this.funcionarios.set(funcionarios.items);
          this.funcionariosTotal.set(funcionarios.total);
          this.funcionariosPage.set(funcionarios.page);
          this.editando.set(false);
          this.cerrarEditarFuncionario();
          this.toast.success('Funcionario actualizado correctamente');
        },
        error: (err: HttpErrorResponse) => {
          this.modalErrorEditarFuncionario.set(this.parseError(err));
          this.editando.set(false);
        },
      });
  }

  trackFuncionario = (_: number, f: FuncionarioConvocatoria) => f.persona_id;

  private recargarDetalleYFuncionarios$(convocatoriaId: string, page = 1) {
    return forkJoin({
      detalle: this.misionesService.findConvocatoriaById(this.misionId, convocatoriaId),
      funcionarios: this.misionesService.findFuncionariosByConvocatoria(
        this.misionId,
        convocatoriaId,
        page,
        this.funcionariosLimit,
        this.busquedaFuncionario().trim() || undefined,
      ),
    });
  }

  private parseError(err: HttpErrorResponse): string {
    return (
      err.error?.service_response?.service_status?.http_message ??
      err.error?.message ??
      err.message ??
      'Error inesperado'
    );
  }
}
