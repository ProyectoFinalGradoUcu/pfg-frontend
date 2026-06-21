import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PersonalService, PersonaListItem } from '../../../../core/services/personal.service';
import {
  FuncionarioMisionPayload,
  FuncionarioMision,
  MisionDetalle,
} from '../../../../core/models/misiones.models';

@Component({
  selector: 'app-mision-detalle-page',
  standalone: false,
  templateUrl: './mision-detalle-page.html',
  styleUrl: './mision-detalle-page.scss',
})
export class MisionDetallePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly misionesService = inject(MisionesService);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mision = signal<MisionDetalle | null>(null);
  readonly loading = signal(false);
  readonly loadingFuncionarios = signal(false);
  readonly asignando = signal(false);
  readonly editando = signal(false);
  readonly borrandoTodos = signal(false);
  readonly modalConfirmEliminarTodos = signal(false);
  readonly modalEditarMision = signal(false);
  readonly modalErrorMision = signal<string | null>(null);
  readonly guardandoMision = signal(false);
  readonly funcionarioEditando = signal<FuncionarioMision | null>(null);
  readonly menuAbierto = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);
  readonly personal = signal<PersonaListItem[]>([]);
  readonly funcionarios = signal<FuncionarioMision[]>([]);
  readonly funcionariosTotal = signal(0);
  readonly funcionariosPage = signal(1);
  readonly funcionariosLimit = 5;

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('misiones.gestionar'));

  readonly asignarForm = this.fb.group({
    persona_id: ['', Validators.required],
    boletin: [''],
    observaciones: [''],
    numero_control_migratorio: [''],
  });

  readonly editarFuncionarioForm = this.fb.group({
    boletin: [''],
    observaciones: [''],
    numero_control_migratorio: [''],
  });

  readonly misionForm = this.fb.group({
    pais: [''],
    tipo_mision: [''],
    fecha_salida: [''],
    fecha_llegada: [''],
    observaciones: [''],
    comando_responsable: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.cargar(id);
    this.personalService.findAll().subscribe({
      next: (p) => this.personal.set(p),
    });
  }

  cargar(id: string): void {
    this.loading.set(true);
    this.misionesService.findById(id).subscribe({
      next: (m) => {
        this.mision.set(m);
        this.loading.set(false);
        this.cargarFuncionarios(id, 1);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
        this.router.navigate(['/misiones/gestion']);
      },
    });
  }

  cargarFuncionarios(misionId: string, page = this.funcionariosPage()): void {
    this.loadingFuncionarios.set(true);
    this.misionesService.findFuncionariosByMision(misionId, page, this.funcionariosLimit).subscribe({
      next: (res) => {
        this.funcionarios.set(res.data);
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
    const m = this.mision();
    if (!m) return;
    this.cargarFuncionarios(m.id, page);
  }

  volver(): void {
    this.router.navigate(['/misiones/gestion']);
  }

  abrirEditarMision(): void {
    const m = this.mision();
    if (!m) return;

    this.modalErrorMision.set(null);
    this.misionForm.patchValue({
      pais: m.pais,
      tipo_mision: m.tipo_mision,
      fecha_salida: m.fecha_salida,
      fecha_llegada: m.fecha_llegada,
      observaciones: m.observaciones,
      comando_responsable: m.comando_responsable,
    });
    this.modalEditarMision.set(true);
  }

  cerrarModalMision(): void {
    this.modalEditarMision.set(false);
    this.modalErrorMision.set(null);
  }

  guardarMision(): void {
    const m = this.mision();
    if (!m || this.misionForm.invalid) {
      this.misionForm.markAllAsTouched();
      this.modalErrorMision.set('Completá todos los campos requeridos');
      return;
    }

    const raw = this.misionForm.getRawValue();
    const payload = {
      pais: raw.pais || undefined,
      tipo_mision: raw.tipo_mision || undefined,
      fecha_salida: raw.fecha_salida || undefined,
      fecha_llegada: raw.fecha_llegada || undefined,
      observaciones: raw.observaciones || undefined,
      comando_responsable: raw.comando_responsable || undefined,
    };

    this.modalErrorMision.set(null);
    this.guardandoMision.set(true);
    this.misionesService
      .update(m.id, payload)
      .pipe(switchMap(() => this.misionesService.findById(m.id)))
      .subscribe({
        next: (updated) => {
          this.mision.set(updated);
          this.guardandoMision.set(false);
          this.cerrarModalMision();
          this.toast.success('Misión actualizada correctamente');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoMision.set(false);
          this.modalErrorMision.set(this.parseError(err));
        },
      });
  }

  asignarFuncionario(): void {
    const m = this.mision();
    if (!m || this.asignarForm.invalid) {
      this.asignarForm.markAllAsTouched();
      return;
    }

    const raw = this.asignarForm.getRawValue();
    const payload: FuncionarioMisionPayload = {
      persona_id: raw.persona_id!,
      boletin: raw.boletin || undefined,
      observaciones: raw.observaciones || undefined,
      numero_control_migratorio: raw.numero_control_migratorio || undefined,
    };

    this.asignando.set(true);
    this.misionesService.addFuncionarios(m.id, [payload]).pipe(
      switchMap(() => this.recargarDetalleYFuncionarios$(m.id, this.funcionariosPage())),
    ).subscribe({
      next: ({ detalle, funcionarios }) => {
        this.mision.set(detalle);
        this.funcionarios.set(funcionarios.data);
        this.funcionariosTotal.set(funcionarios.total);
        this.funcionariosPage.set(funcionarios.page);
        this.asignarForm.reset({ persona_id: '', boletin: '', observaciones: '', numero_control_migratorio: '' });
        this.asignando.set(false);
        this.toast.success('Funcionario asignado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
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

  quitarFuncionario(personaId: string): void {
    const m = this.mision();
    if (!m) return;
    if (!confirm('¿Quitar este funcionario de la misión?')) return;

    this.cerrarMenu();
    this.misionesService.deleteFuncionario(m.id, personaId).subscribe({
      next: () => {
        this.cargar(m.id);
        this.toast.success('Funcionario removido');
      },
      error: (err: HttpErrorResponse) => this.toast.error(this.parseError(err)),
    });
  }

  eliminarTodosFuncionarios(): void {
    const m = this.mision();
    if (!m) return;

    this.borrandoTodos.set(true);
    this.misionesService
      .deleteAllFuncionarios(m.id)
      .pipe(switchMap(() => this.recargarDetalleYFuncionarios$(m.id, 1)))
      .subscribe({
        next: ({ detalle, funcionarios }) => {
          this.mision.set(detalle);
          this.funcionarios.set(funcionarios.data);
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

  abrirEditarFuncionario(f: FuncionarioMision): void {
    this.funcionarioEditando.set(f);
    this.editarFuncionarioForm.patchValue({
      boletin: f.boletin ?? '',
      observaciones: f.observaciones ?? '',
      numero_control_migratorio: f.numero_control_migratorio ?? '',
    });
    this.cerrarMenu();
  }

  cerrarEditarFuncionario(): void {
    this.funcionarioEditando.set(null);
    this.editarFuncionarioForm.reset({ boletin: '', observaciones: '', numero_control_migratorio: '' });
  }

  guardarEdicionFuncionario(): void {
    const m = this.mision();
    const f = this.funcionarioEditando();
    if (!m || !f) return;

    const raw = this.editarFuncionarioForm.getRawValue();
    const payload: Partial<FuncionarioMisionPayload> = {
      boletin: raw.boletin || undefined,
      observaciones: raw.observaciones || undefined,
      numero_control_migratorio: raw.numero_control_migratorio || undefined,
    };

    this.editando.set(true);
    this.misionesService
      .updateFuncionario(m.id, f.persona_id, payload)
      .pipe(switchMap(() => this.recargarDetalleYFuncionarios$(m.id, this.funcionariosPage())))
      .subscribe({
        next: ({ detalle, funcionarios }) => {
          this.mision.set(detalle);
          this.funcionarios.set(funcionarios.data);
          this.funcionariosTotal.set(funcionarios.total);
          this.funcionariosPage.set(funcionarios.page);
          this.editando.set(false);
          this.cerrarEditarFuncionario();
          this.toast.success('Funcionario actualizado correctamente');
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.editando.set(false);
        },
      });
  }

  trackFuncionario = (_: number, f: FuncionarioMision) => f.persona_id;

  private recargarDetalleYFuncionarios$(misionId: string, page = 1) {
    return forkJoin({
      detalle: this.misionesService.findById(misionId),
      funcionarios: this.misionesService.findFuncionariosByMision(misionId, page, this.funcionariosLimit),
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
