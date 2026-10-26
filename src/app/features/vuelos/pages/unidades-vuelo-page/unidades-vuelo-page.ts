import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { VuelosService } from '../../../../core/services/vuelos.service';
import { UnidadVuelo } from '../../../../core/models/vuelos.models';
import { parseError } from '../../../../shared/utils/parse-error';

export type ModalUnidad = 'form' | 'baja' | null;

@Component({
  selector: 'app-unidades-vuelo-page',
  standalone: false,
  templateUrl: './unidades-vuelo-page.html',
  styleUrl: './unidades-vuelo-page.scss',
})
export class UnidadesVueloPage implements OnInit {
  private readonly vuelosService = inject(VuelosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly unidades = signal<UnidadVuelo[]>([]);
  readonly vigentes = computed(() => this.unidades().filter((u) => u.vigente).length);

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('vuelos.gestionar'));

  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  readonly modal = signal<ModalUnidad>(null);
  /** `null` en el formulario = alta. */
  readonly seleccionada = signal<UnidadVuelo | null>(null);
  readonly denominacion = signal('');
  readonly procesando = signal(false);
  readonly modalError = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.vuelosService.listarUnidades().subscribe({
      next: (u) => {
        this.unidades.set(u);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuId() === id) {
      this.cerrarMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    this.openMenuId.set(id);
  }

  cerrarMenu(): void {
    this.openMenuId.set(null);
    this.menuPosition.set(null);
  }

  abrirForm(unidad: UnidadVuelo | null): void {
    this.cerrarMenu();
    this.seleccionada.set(unidad);
    this.denominacion.set(unidad?.denominacion ?? '');
    this.modalError.set(null);
    this.modal.set('form');
  }

  abrirBaja(unidad: UnidadVuelo): void {
    this.cerrarMenu();
    this.seleccionada.set(unidad);
    this.modalError.set(null);
    this.modal.set('baja');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.seleccionada.set(null);
    this.modalError.set(null);
  }

  guardar(): void {
    const denominacion = this.denominacion().trim();
    if (!denominacion) {
      this.modalError.set('La denominación es obligatoria.');
      return;
    }
    const unidad = this.seleccionada();
    if (unidad && denominacion === unidad.denominacion) {
      this.cerrarModal();
      return;
    }
    this.ejecutar(
      unidad ? this.vuelosService.editarUnidad(unidad.id, { denominacion }) : this.vuelosService.crearUnidad(denominacion),
      unidad ? 'Unidad de vuelo actualizada' : 'Unidad de vuelo creada',
    );
  }

  confirmarBaja(): void {
    const unidad = this.seleccionada()!;
    this.ejecutar(this.vuelosService.editarUnidad(unidad.id, { vigente: false }), 'Unidad de vuelo dada de baja');
  }

  reactivar(unidad: UnidadVuelo): void {
    this.cerrarMenu();
    this.vuelosService.editarUnidad(unidad.id, { vigente: true }).subscribe({
      next: () => {
        this.toast.success('Unidad de vuelo reactivada');
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
    });
  }

  private ejecutar(operacion: Observable<unknown>, mensaje: string): void {
    this.procesando.set(true);
    this.modalError.set(null);
    operacion.subscribe({
      next: () => {
        this.procesando.set(false);
        this.cerrarModal();
        this.toast.success(mensaje);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.modalError.set(parseError(err));
      },
    });
  }
}
