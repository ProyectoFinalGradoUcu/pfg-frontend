import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuditoriaService } from '../../../../core/services/auditoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import {
  AuditoriaFiltroItem,
  AuditoriaRegistro,
  AuditoriaUsuario,
} from '../../../../core/models/auditoria.models';
import { SeccionDetalle, formatearDetalle } from '../../detalle-auditoria';
import { parseError } from '../../../../shared/utils/parse-error';

@Component({
  selector: 'app-auditoria-page',
  standalone: false,
  templateUrl: './auditoria-page.html',
  styleUrl: './auditoria-page.scss',
})
export class AuditoriaPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly toast = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);

  readonly registros = signal<AuditoriaRegistro[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly acciones = signal<AuditoriaFiltroItem[]>([]);
  readonly contextos = signal<AuditoriaFiltroItem[]>([]);
  readonly usuarios = signal<AuditoriaUsuario[]>([]);
  readonly detalleAbierto = signal<AuditoriaRegistro | null>(null);
  readonly detalleSecciones = signal<SeccionDetalle[]>([]);
  readonly mostrarJson = signal(false);

  readonly page = signal(1);
  readonly pageSize = 20;

  readonly filtrosForm = this.fb.group({
    usuarioId: [null as string | null],
    accion: [null as string | null],
    contexto: [null as string | null],
    desde: [''],
    hasta: [''],
  });

  /** El formulario no es reactivo para la plantilla: esto es lo que leen los mensajes y el botón. */
  private readonly filtrosAplicados = signal(this.filtrosForm.getRawValue());
  /** El listado filtrado no se pudo cargar: la tabla queda vacía y lo avisa. */
  private readonly errorAlCargar = signal(false);
  /** Última página cargada: si falla un cambio de página, la tabla y el paginador vuelven acá. */
  private pageCargada = 1;
  private cargaSub?: Subscription;

  readonly hayFiltros = computed(() => Object.values(this.filtrosAplicados()).some(Boolean));

  readonly mensajeVacio = computed(() => {
    if (this.errorAlCargar()) return 'No se pudieron cargar los eventos. Volvé a intentar.';
    return this.hayFiltros()
      ? 'No hay eventos que coincidan con los filtros.'
      : 'No hay eventos registrados.';
  });

  ngOnInit(): void {
    this.auditoriaService.filtros().subscribe({
      next: (f) => {
        this.acciones.set(f.acciones);
        this.contextos.set(f.contextos);
        this.usuarios.set(f.usuarios);
      },
      error: () => {
        // Los filtros son un extra; si fallan, la tabla sigue funcionando.
      },
    });

    this.filtrosForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.aplicarFiltros());

    this.cargar();
  }

  /**
   * `vaciarSiFalla`: tras cambiar los filtros, las filas ya cargadas no cumplen lo pedido y no
   * pueden quedar a la vista. Al paginar siguen siendo válidas y solo se vuelve de página.
   */
  private cargar({ vaciarSiFalla = true } = {}): void {
    // Con filtros o clics seguidos, una respuesta vieja no debe pisar a la última.
    this.cargaSub?.unsubscribe();
    this.loading.set(true);
    const { usuarioId, accion, contexto, desde, hasta } = this.filtrosAplicados();
    this.cargaSub = this.auditoriaService
      .listar({
        page: this.page(),
        pageSize: this.pageSize,
        usuarioId: usuarioId || undefined,
        accion: accion || undefined,
        contexto: contexto || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      })
      .subscribe({
        next: ({ items, total }) => {
          this.registros.set(items);
          this.total.set(total);
          this.pageCargada = this.page();
          this.errorAlCargar.set(false);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.reportarError(err);
          if (vaciarSiFalla) {
            this.registros.set([]);
            this.total.set(0);
            this.pageCargada = 1;
            this.errorAlCargar.set(true);
          } else {
            this.page.set(this.pageCargada);
          }
          this.loading.set(false);
        },
      });
  }

  private aplicarFiltros(): void {
    this.filtrosAplicados.set(this.filtrosForm.getRawValue());
    this.page.set(1);
    this.cargar();
  }

  limpiarFiltros(): void {
    // Sin evento: si no, cada campo que se vacía dispararía su propia petición.
    this.filtrosForm.reset(
      { usuarioId: null, accion: null, contexto: null, desde: '', hasta: '' },
      { emitEvent: false },
    );
    this.aplicarFiltros();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar({ vaciarSiFalla: false });
  }

  verDetalle(registro: AuditoriaRegistro): void {
    this.detalleAbierto.set(registro);
    this.detalleSecciones.set(formatearDetalle(registro.detalle));
    this.mostrarJson.set(false);
  }

  cerrarDetalle(): void {
    this.detalleAbierto.set(null);
    this.detalleSecciones.set([]);
  }

  toggleJson(): void {
    this.mostrarJson.update((v) => !v);
  }

  soloJson(): boolean {
    return this.detalleSecciones().length === 0;
  }

  detalleJson(detalle: unknown): string {
    if (detalle === null || detalle === undefined) return '—';
    return JSON.stringify(detalle, null, 2);
  }

  trackSeccion = (i: number, s: SeccionDetalle) => `${i}-${s.titulo ?? ''}`;
  trackCampo = (i: number, c: { etiqueta: string }) => `${i}-${c.etiqueta}`;

  trackRegistro = (_: number, r: AuditoriaRegistro) => r.id;

  /** 403 es bloqueante: se muestra en el modal informativo en vez de un toast que desaparece solo. */
  private reportarError(err: HttpErrorResponse): void {
    const msg = parseError(err);
    if (err.status === 403) this.errorModal.show(msg);
    else this.toast.error(msg);
  }
}
