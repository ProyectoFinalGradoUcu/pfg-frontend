import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  PreviaReincorporacion,
  ReincorporacionAnulada,
  Reincorporado,
  RetiroAnulado,
  RetiroDetalle,
  SlotDocumentoRetiro,
} from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { mensajeErrorDocumento } from '../../../../core/services/documentos-personal.service';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  ETIQUETA_ESTADO,
  estadoRetiro,
  motivoNoAnulable,
  nombreFuncionario,
} from '../../retiro-presentacion';
import { mensajeReversion } from '../../components/anular-retiro-modal/anular-retiro-modal';
import { mensajeReincorporacionAnulada } from '../../components/anular-reincorporacion-modal/anular-reincorporacion-modal';
import { mensajeReincorporado } from '../../components/reincorporar-retiro-modal/reincorporar-retiro-modal';
import { formatoMoneda, formatoPorcentaje } from '../../datos-calculo';

type ModalAbierto =
  | 'corregir'
  | 'anular'
  | 'reincorporar'
  | 'anular-reincorporacion'
  | 'datos-calculo'
  | null;

/** La relación posterior al retiro puede haberse abierto sin reincorporar: esas no tienen datos de cálculo. */
const SITUACIONES_REINCORPORADO = ['SIT16', 'SIT17'];

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
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly sanitizer = inject(DomSanitizer);

  private retiroId!: string;

  readonly retiro = signal<RetiroDetalle | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly modalAbierto = signal<ModalAbierto>(null);
  readonly previaReincorporacion = signal<PreviaReincorporacion | null>(null);
  readonly previaReincorporacionError = signal<string | null>(null);

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

  /** El resto de los 409 los informa el modal. */
  readonly noAnulable = computed(() => {
    const r = this.retiro();
    const motivo = r ? motivoNoAnulable(r) : null;
    return motivo && this.puedeAnularReincorporacion()
      ? `${motivo} Anulá primero la reincorporación.`
      : motivo;
  });

  /** Solo la reincorporación todavía activa: si un retiro posterior la cerró, se anula ese primero. */
  readonly puedeAnularReincorporacion = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado && !!r.reincorporacion?.activa && this.conDatosCalculo();
  });

  /** Ya reincorporado, la tarjeta lo dice y la previa solo traería un bloqueo. */
  readonly puedeReincorporar = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado && !r.reincorporacion;
  });

  readonly bloqueosReincorporacion = computed(() => {
    const error = this.previaReincorporacionError();
    if (error) return [`No se pudo verificar si se puede reincorporar. ${error}`];
    return this.previaReincorporacion()?.bloqueos ?? [];
  });

  readonly reincorporacionHabilitada = computed(
    () => !!this.previaReincorporacion() && this.bloqueosReincorporacion().length === 0,
  );

  readonly conDatosCalculo = computed(() => {
    const codigo = this.retiro()?.reincorporacion?.situacion?.codigo;
    return !!codigo && SITUACIONES_REINCORPORADO.includes(codigo);
  });

  /** Con la relación cerrada o un retiro anulado el backend responde 409. */
  readonly puedeEditarDatosCalculo = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado && !!r.reincorporacion?.activa && this.conDatosCalculo();
  });

  readonly mostrarRelacionCerrada = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado && r.reincorporacion?.activa === false && this.conDatosCalculo();
  });

  /** `cerrado_con_el_retiro` puede venir `{}`: la plantilla no debe defenderse. */
  readonly cierres = computed(() => {
    const c = this.retiro()?.cerrado_con_el_retiro;
    const inscripciones = c?.inscripciones_ids ?? [];
    const comisiones = c?.comisiones ?? [];
    return {
      destino: c?.destino_id ?? null,
      inscripciones,
      comisiones,
      usuario: c?.usuario_id ?? null,
      ninguno:
        !c?.destino_id && !c?.usuario_id && inscripciones.length === 0 && comisiones.length === 0,
    };
  });

  tieneRespaldo(): boolean {
    const r = this.retiro();
    return !!(
      r?.numero_orden ||
      r?.boletin ||
      r?.observaciones ||
      r?.documentos.orden ||
      r?.documentos.boletin
    );
  }

  /** Un retiro anulado conserva sus documentos, pero ya no se tocan. */
  readonly puedeAdjuntar = computed(() => {
    const r = this.retiro();
    return this.puedeEscribir && !!r && !r.anulado;
  });

  readonly trabajando = signal<SlotDocumentoRetiro | null>(null);

  readonly visor = signal<{ slot: SlotDocumentoRetiro; url: SafeResourceUrl } | null>(null);

  urlDocumento(slot: SlotDocumentoRetiro, descarga = false): string {
    return this.retirosService.urlDocumento(this.retiroId, slot, { descarga });
  }

  visorUrl(slot: SlotDocumentoRetiro): SafeResourceUrl | null {
    const v = this.visor();
    return v?.slot === slot ? v.url : null;
  }

  /** HEAD antes de montar el visor: el `<embed>` no avisa si el documento ya no existe. */
  alternarVisor(slot: SlotDocumentoRetiro): void {
    if (this.visor()?.slot === slot) {
      this.visor.set(null);
      return;
    }
    this.retirosService.inspeccionarDocumento(this.retiroId, slot).subscribe({
      next: () => {
        const url = this.sanitizer.bypassSecurityTrustResourceUrl(this.urlDocumento(slot));
        this.visor.set({ slot, url });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
          return;
        }
        if (err.status === 404) {
          this.toast.error('El documento ya no existe.');
          this.visor.set(null);
          this.recargar();
          return;
        }
        this.toast.error(mensajeErrorDocumento(err));
      },
    });
  }

  adjuntar(slot: SlotDocumentoRetiro, archivo: File): void {
    this.trabajando.set(slot);
    this.retirosService.subirDocumento(this.retiroId, slot, archivo).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.toast.success('Documento adjuntado.');
        this.recargar();
      },
      error: (err: HttpErrorResponse) => {
        this.trabajando.set(null);
        this.toast.error(mensajeErrorDocumento(err));
        // 404 o 409: el retiro cambió por otro lado, se muestra como quedó.
        if (err.status === 404 || err.status === 409) this.recargar();
      },
    });
  }

  async quitar(slot: SlotDocumentoRetiro): Promise<void> {
    const documento = this.retiro()?.documentos[slot];
    if (!documento) return;
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Quitar documento',
      mensaje: `¿Quitar «${documento.nombre_original}» de este retiro?`,
      textoConfirmar: 'Quitar',
    });
    if (!confirmado) return;

    this.trabajando.set(slot);
    this.retirosService.quitarDocumento(this.retiroId, slot).subscribe({
      next: () => {
        this.trabajando.set(null);
        if (this.visor()?.slot === slot) this.visor.set(null);
        this.toast.success('Documento quitado.');
        this.recargar();
      },
      error: (err: HttpErrorResponse) => {
        this.trabajando.set(null);
        this.toast.error(mensajeErrorDocumento(err));
        this.recargar();
      },
    });
  }

  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly nombreFuncionario = nombreFuncionario;
  readonly formatoMoneda = formatoMoneda;
  readonly formatoPorcentaje = formatoPorcentaje;

  ngOnInit(): void {
    this.retiroId = this.route.snapshot.paramMap.get('retiroId')!;
    this.recargar();
  }

  recargar(): void {
    this.loading.set(true);
    this.previaReincorporacion.set(null);
    this.previaReincorporacionError.set(null);
    this.retirosService.detalle(this.retiroId).subscribe({
      next: (r) => {
        this.retiro.set(r);
        this.loading.set(false);
        if (this.puedeReincorporar()) this.cargarPreviaReincorporacion();
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

  private cargarPreviaReincorporacion(): void {
    this.retirosService.previaReincorporacion(this.retiroId).subscribe({
      next: (p) => this.previaReincorporacion.set(p),
      error: (err: HttpErrorResponse) => this.previaReincorporacionError.set(parseError(err)),
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

  onReincorporacionAnulada(r: ReincorporacionAnulada): void {
    this.toast.success(mensajeReincorporacionAnulada(r));
    this.alGuardar();
  }

  onReincorporado(r: Reincorporado): void {
    this.toast.success(mensajeReincorporado(r));
    this.alGuardar();
  }

  /** El PATCH devuelve el detalle completo: no hace falta volver a pedirlo. */
  onDatosCalculoGuardados(r: RetiroDetalle): void {
    this.toast.success('Datos de cálculo guardados.');
    this.retiro.set(r);
    this.cerrarModal();
  }

  volver(): void {
    this.router.navigate(['/retiros']);
  }
}
