import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  AscensoDeOrden,
  ESTADOS_ELEGIBILIDAD,
  Elegibilidad,
  EstadoElegibilidad,
  OrdenAscensoDetalle,
  VigenteDeOrden,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

type ModalKind = 'anular-orden' | 'anular-ascenso' | null;

const PAGE_SIZE = 10;

/**
 * Detalle de una orden y el lugar donde se anula. Anular revierte el ascenso, y
 * por eso la confirmación nombra el grado al que vuelve cada funcionario.
 */
@Component({
  selector: 'app-orden-detalle-page',
  standalone: false,
  templateUrl: './orden-detalle-page.html',
  styleUrl: './orden-detalle-page.scss',
})
export class OrdenDetallePage implements OnInit {
  private readonly svc = inject(AscensosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private ordenId!: string;

  /** Quien abrió el modal: recupera el foco al cerrarlo. */
  private disparadorModal: HTMLElement | null = null;

  @ViewChild('motivoInput') motivoInput?: ElementRef<HTMLTextAreaElement>;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orden = signal<OrdenAscensoDetalle | null>(null);

  readonly PAGE_SIZE = PAGE_SIZE;
  readonly page = signal(1);

  readonly modal = signal<ModalKind>(null);
  readonly ascensoSeleccionado = signal<AscensoDeOrden | null>(null);
  readonly motivo = signal('');
  readonly procesando = signal(false);

  readonly expandidas = signal<Set<string>>(new Set());

  readonly puedeAnular = computed(() => this.auth.hasPermiso('ascensos.anular'));

  /** De la orden entera, no solo de la página que se ve. */
  readonly vigentes = computed<VigenteDeOrden[]>(() => this.orden()?.vigentes ?? []);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/ascensos-y-retiros/ordenes']);
      return;
    }
    this.ordenId = id;
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getOrden(this.ordenId, { page: this.page(), pageSize: PAGE_SIZE }).subscribe({
      next: (o) => {
        this.orden.set(o);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  irAPagina(pagina: number): void {
    this.page.set(pagina);
    this.cargar();
  }

  /** Sin pasar por «Cargando...»: la tabla no parpadea después de anular. */
  private refrescarPagina(): void {
    this.svc.getOrden(this.ordenId, { page: this.page(), pageSize: PAGE_SIZE }).subscribe({
      next: (o) => this.orden.set(o),
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
    });
  }

  // ─── Detalle expandible ───────────────────────────────────────────────────

  /** Motivo de excepción, anulación o foto de la evaluación: si no hay nada, no se ofrece expandir. */
  tieneDetalle(a: AscensoDeOrden): boolean {
    return !!a.evaluacion || (a.por_excepcion && !!a.motivo_excepcion) || a.anulado;
  }

  estaExpandida(id: string): boolean {
    return this.expandidas().has(id);
  }

  alternarEvaluacion(ascenso: AscensoDeOrden): void {
    this.expandidas.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(ascenso.id)) nuevo.delete(ascenso.id);
      else nuevo.add(ascenso.id);
      return nuevo;
    });
  }

  etiquetaEstado(estado: EstadoElegibilidad): string {
    return ESTADOS_ELEGIBILIDAD.find((e) => e.value === estado)?.label ?? estado;
  }

  /** Cómo estaba el funcionario al momento del ascenso. */
  estadoAlAscender(ev: Elegibilidad): string {
    return ev.estado === 'PASIBLE' ? 'Cumplía' : this.etiquetaEstado(ev.estado);
  }

  simboloRequisito(req: { aplica: boolean; cumple: boolean }): string {
    if (!req.aplica) return '○';
    return req.cumple ? '✓' : '✗';
  }

  // ─── Anulación ────────────────────────────────────────────────────────────

  pedirAnularOrden(): void {
    this.motivo.set('');
    this.abrirModal('anular-orden');
  }

  pedirAnularAscenso(ascenso: AscensoDeOrden): void {
    this.motivo.set('');
    this.ascensoSeleccionado.set(ascenso);
    this.abrirModal('anular-ascenso');
  }

  private abrirModal(tipo: Exclude<ModalKind, null>): void {
    this.disparadorModal = document.activeElement as HTMLElement | null;
    this.modal.set(tipo);
    // El textarea recién existe después del próximo render.
    setTimeout(() => this.motivoInput?.nativeElement.focus());
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.ascensoSeleccionado.set(null);
    this.motivo.set('');

    const disparador = this.disparadorModal;
    this.disparadorModal = null;
    // Si el botón ya no existe (ese ascenso quedó anulado), el foco queda donde el navegador lo ponga.
    if (disparador?.isConnected) setTimeout(() => disparador.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal() && !this.procesando()) this.cerrarModal();
  }

  confirmarAnulacion(): void {
    const motivo = this.motivo().trim();
    if (motivo.length < 5) {
      this.toast.error('Escribí un motivo: queda registrado en la bitácora');
      return;
    }

    const esOrden = this.modal() === 'anular-orden';
    const ascenso = this.ascensoSeleccionado();
    if (!esOrden && !ascenso) return;

    this.procesando.set(true);
    const peticion = esOrden
      ? this.svc.anularOrden(this.ordenId, motivo)
      : this.svc.anularAscenso(ascenso!.id, motivo);

    peticion.subscribe({
      next: (o) => {
        // La respuesta trae la primera página; si se estaba viendo otra, se vuelve a pedir.
        this.orden.set(o);
        if (o.page !== this.page() || o.pageSize !== PAGE_SIZE) this.refrescarPagina();
        this.procesando.set(false);
        this.cerrarModal();
        this.toast.success(esOrden ? 'La orden quedó anulada' : 'El ascenso quedó anulado');
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }
}
