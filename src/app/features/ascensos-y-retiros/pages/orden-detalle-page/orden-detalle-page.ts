import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  AscensoDeOrden,
  ESTADOS_ELEGIBILIDAD,
  EstadoElegibilidad,
  OrdenAscenso,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

type ModalKind = 'anular-orden' | 'anular-ascenso' | null;

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

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orden = signal<OrdenAscenso | null>(null);

  readonly modal = signal<ModalKind>(null);
  readonly ascensoSeleccionado = signal<AscensoDeOrden | null>(null);
  readonly motivo = signal('');
  readonly procesando = signal(false);

  readonly expandidas = signal<Set<string>>(new Set());

  readonly puedeAnular = computed(() => this.auth.hasPermiso('ascensos.anular'));

  readonly vigentes = computed(
    () => this.orden()?.ascensos.filter((a) => !a.anulado) ?? [],
  );

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
    this.svc.getOrden(this.ordenId).subscribe({
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

  // ─── Foto de evaluación ───────────────────────────────────────────────────

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

  simboloRequisito(req: { aplica: boolean; cumple: boolean }): string {
    if (!req.aplica) return '○';
    return req.cumple ? '✓' : '✗';
  }

  // ─── Anulación ────────────────────────────────────────────────────────────

  pedirAnularOrden(): void {
    this.motivo.set('');
    this.modal.set('anular-orden');
  }

  pedirAnularAscenso(ascenso: AscensoDeOrden): void {
    this.motivo.set('');
    this.ascensoSeleccionado.set(ascenso);
    this.modal.set('anular-ascenso');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.ascensoSeleccionado.set(null);
    this.motivo.set('');
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
        this.orden.set(o);
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
