import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { RetiroAnulado, RetiroDetalle } from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { parseError } from '../../../../shared/utils/parse-error';
import { ETIQUETA_ESTADO, estadoRetiro, nombreFuncionario } from '../../retiro-presentacion';
import { mensajeReversion } from '../../components/anular-retiro-modal/anular-retiro-modal';

type ModalAbierto = 'corregir' | 'anular' | null;

@Component({
  selector: 'app-retiro-detalle-page',
  standalone: false,
  templateUrl: './retiro-detalle-page.html',
  styleUrl: './retiro-detalle-page.scss',
})
export class RetiroDetallePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly retirosService = inject(RetirosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private retiroId!: string;

  readonly retiro = signal<RetiroDetalle | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly modalAbierto = signal<ModalAbierto>(null);

  private readonly puedeEscribir = this.auth.hasPermiso('retiros.registrar');

  readonly estado = computed(() => {
    const r = this.retiro();
    return r ? estadoRetiro(r) : null;
  });

  /** Corregir un anulado da 409. */
  readonly puedeCorregir = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado;
  });

  /** Anular dos veces da 409. */
  readonly puedeAnular = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado;
  });

  /** `cerrado_con_el_retiro` puede venir `{}`: la plantilla no debe defenderse. */
  readonly cierres = computed(() => {
    const c = this.retiro()?.cerrado_con_el_retiro;
    const inscripciones = c?.inscripciones_ids ?? [];
    return {
      destino: c?.destino_id ?? null,
      inscripciones,
      usuario: c?.usuario_id ?? null,
      ninguno: !c?.destino_id && !c?.usuario_id && inscripciones.length === 0,
    };
  });

  tieneRespaldo(): boolean {
    const r = this.retiro();
    return !!(r?.numero_orden || r?.boletin || r?.observaciones);
  }

  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly nombreFuncionario = nombreFuncionario;

  ngOnInit(): void {
    this.retiroId = this.route.snapshot.paramMap.get('retiroId')!;
    this.recargar();
  }

  recargar(): void {
    this.loading.set(true);
    this.retirosService.detalle(this.retiroId).subscribe({
      next: (r) => {
        this.retiro.set(r);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.toast.error('El retiro no existe.');
          this.router.navigate(['/retiros']);
          return;
        }
        this.error.set(parseError(err));
      },
    });
  }

  abrir(modal: Exclude<ModalAbierto, null>): void {
    this.modalAbierto.set(modal);
  }

  cerrarModal(): void {
    this.modalAbierto.set(null);
  }

  /** Después de escribir el estado cambió: se vuelve a pedir. */
  alGuardar(): void {
    this.cerrarModal();
    this.recargar();
  }

  onCorregido(): void {
    this.toast.success('Retiro corregido.');
    this.alGuardar();
  }

  onAnulado(r: RetiroAnulado): void {
    this.toast.success(mensajeReversion(r));
    this.alGuardar();
  }

  volver(): void {
    this.router.navigate(['/retiros']);
  }
}
