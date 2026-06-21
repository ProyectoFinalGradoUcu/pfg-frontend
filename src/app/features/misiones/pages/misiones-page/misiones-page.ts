import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MisionesService } from '../../../../core/services/misiones.service';
import { Mision, MisionesStats } from '../../../../core/models/misiones.models';

type TabKind = 'historial' | 'gestion';
type ModalKind = 'nuevaMision' | 'editarMision' | null;

@Component({
  selector: 'app-misiones-page',
  standalone: false,
  templateUrl: './misiones-page.html',
  styleUrl: './misiones-page.scss',
})
export class MisionesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly misionesService = inject(MisionesService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tab = signal<TabKind>('historial');
  readonly loading = signal(false);
  readonly guardando = signal(false);
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);

  readonly misiones = signal<Mision[]>([]);
  readonly stats = signal<MisionesStats>({ total: 0, activas: 0, finalizadas: 0 });
  readonly totalItems = signal(0);
  readonly page = signal(1);
  readonly limit = 10;

  readonly misionEditando = signal<Mision | null>(null);
  readonly menuAbierto = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  // Permisos
  readonly puedeGestionar = computed(() => this.auth.hasPermiso('misiones.gestionar'));

  // Formulario
  readonly misionForm = this.fb.group({
    pais: [''],
    tipo_mision: [''],
    fecha_salida: [''],
    fecha_llegada: [''],
    observaciones: [''],
    comando_responsable: [''],
  });

  ngOnInit(): void {
    const section = this.route.snapshot.data['section'] as TabKind;
    if (section) this.tab.set(section);
    this.cargarMisiones();
  }

  cargarMisiones(p = this.page()): void {
    this.loading.set(true);
    this.misionesService.findAll(p, this.limit).subscribe({
      next: (res) => {
        this.misiones.set(res.data);
        this.stats.set(res.stats);
        this.totalItems.set(res.total);
        this.page.set(res.page);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
      },
    });
  }

  verDetalle(mision: Mision): void {
    this.menuAbierto.set(null);
    this.router.navigate(['/misiones/gestion', mision.id]);
  }

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuAbierto() === id) {
      this.cerrarMenu();
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      this.menuAbierto.set(id);
    }
  }

  cerrarMenu(): void {
    this.menuAbierto.set(null);
    this.menuPosition.set(null);
  }

  abrirNueva(): void {
    this.misionForm.reset({
      pais: '',
      tipo_mision: '',
      fecha_salida: '',
      fecha_llegada: '',
      observaciones: '',
      comando_responsable: '',
    });
    this.modalError.set(null);
    this.misionEditando.set(null);
    this.modal.set('nuevaMision');
  }

  abrirEditar(mision: Mision): void {
    this.modalError.set(null);
    this.misionEditando.set(mision);
    this.misionForm.patchValue({
      pais: mision.pais,
      tipo_mision: mision.tipo_mision,
      fecha_salida: mision.fecha_salida,
      fecha_llegada: mision.fecha_llegada,
      observaciones: mision.observaciones,
      comando_responsable: mision.comando_responsable,
    });
    this.modal.set('editarMision');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.misionEditando.set(null);
  }

  // Acciones

  guardarMision(): void {
    if (this.misionForm.invalid) {
      this.misionForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
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

    this.modalError.set(null);
    this.guardando.set(true);

    const editando = this.misionEditando();

    if (editando) {
      this.misionesService.update(editando.id, payload).subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          this.toast.success('Misión actualizada correctamente');
          this.cargarMisiones(this.page());
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
    } else {
      this.misionesService.create(payload).subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          this.toast.success('Misión creada correctamente');
          this.cargarMisiones(1);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
    }
  }

  eliminarMision(mision: Mision): void {
    if (!confirm(`¿Eliminar la misión en "${mision.pais}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.misionesService.delete(mision.id).subscribe({
      next: () => {
        this.toast.success('Misión eliminada');
        this.cargarMisiones(this.page());
      },
      error: (err: HttpErrorResponse) => this.toast.error(this.parseError(err)),
    });
  }

  trackMision = (_: number, m: Mision) => m.id;

  private parseError(err: HttpErrorResponse): string {
    return (
      err.error?.service_response?.service_status?.http_message ??
      err.error?.message ??
      err.message ??
      'Error inesperado'
    );
  }
}
