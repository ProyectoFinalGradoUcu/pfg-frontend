import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Destino,
  DestinosStats,
  ListarDestinosQuery,
  UnidadConDestinados,
} from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  DEBOUNCE_MS,
  nombreFuncionario as nombreFuncionarioDe,
  ordenOBoletin as ordenOBoletinDe,
  trackDestino as trackDestinoDe,
} from '../../destino-presentacion';

export type EstadoFiltro = '' | 'vigentes' | 'historial';

export type ModalKind = 'form' | 'cerrar' | 'reabrir' | 'eliminar' | null;

@Component({
  selector: 'app-asignaciones-page',
  standalone: false,
  templateUrl: './asignaciones-page.html',
  styleUrl: './asignaciones-page.scss',
})
export class AsignacionesPage implements OnInit, OnDestroy {
  private readonly destinosService = inject(DestinosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly destinos = signal<Destino[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;

  /** Globales: `destinos_activos` y `unidades_con_personal` ignoran los filtros. */
  readonly stats = signal<DestinosStats>({
    total_destinos: 0,
    destinos_activos: 0,
    unidades_con_personal: 0,
  });

  readonly unidades = signal<UnidadConDestinados[]>([]);

  readonly filtroQuery = signal('');
  readonly filtroUnidadId = signal<string>('');
  readonly filtroEstado = signal<EstadoFiltro>('');
  readonly hayFiltros = computed(
    () => !!this.filtroQuery() || !!this.filtroUnidadId() || !!this.filtroEstado(),
  );

  readonly estadoOpciones = [
    { value: '', label: 'Todos' },
    { value: 'vigentes', label: 'Vigentes' },
    { value: 'historial', label: 'Historial' },
  ];

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('destinos.gestionar'));

  readonly modal = signal<ModalKind>(null);
  readonly destinoEnEdicion = signal<Destino | null>(null);

  readonly destinoSeleccionado = signal<Destino | null>(null);
  readonly procesando = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly fechaFinForm = new FormControl('', { nonNullable: true });

  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    this.cargar();
    this.destinosService.listarUnidadesParaSelector().subscribe({
      next: (u) => this.unidades.set(u),
      error: () => this.unidades.set([]),
    });

    this.querySubject.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => {
      this.page.set(1);
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.querySubject.complete();
  }

  cargar(): void {
    this.loading.set(true);
    this.destinosService.listar(this.query()).subscribe({
      next: (res) => {
        this.destinos.set(res.items);
        this.total.set(res.total);
        this.stats.set(res.stats);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(parseError(err));
        this.loading.set(false);
      },
    });
  }

  private query(): ListarDestinosQuery {
    const q: ListarDestinosQuery = { page: this.page(), pageSize: this.pageSize };
    const texto = this.filtroQuery().trim();
    if (texto) q.query = texto;
    if (this.filtroUnidadId()) q.unidad_id = Number(this.filtroUnidadId());
    const estado = this.filtroEstado();
    if (estado) q.activo = estado === 'vigentes';
    return q;
  }

  onQueryInput(value: string): void {
    this.filtroQuery.set(value);
    this.querySubject.next();
  }

  onUnidadChange(value: string | null): void {
    this.filtroUnidadId.set(value ?? '');
    this.page.set(1);
    this.cargar();
  }

  onEstadoChange(value: string): void {
    this.filtroEstado.set(value as EstadoFiltro);
    this.page.set(1);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroQuery.set('');
    this.filtroUnidadId.set('');
    this.filtroEstado.set('');
    this.page.set(1);
    this.cargar();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar();
  }

  nombreFuncionario(d: Destino): string {
    return nombreFuncionarioDe(d);
  }

  ordenOBoletin(d: Destino): string {
    return ordenOBoletinDe(d);
  }

  trackDestino = (_: number, d: Destino) => trackDestinoDe(_, d);

  abrirCrear(): void {
    this.destinoEnEdicion.set(null);
    this.modal.set('form');
  }

  abrirEditar(destino: Destino): void {
    this.cerrarMenu();
    this.destinoEnEdicion.set(destino);
    this.modal.set('form');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.destinoEnEdicion.set(null);
    this.destinoSeleccionado.set(null);
    this.modalError.set(null);
  }

  onGuardado(): void {
    const editaba = this.destinoEnEdicion() !== null;
    this.cerrarModal();
    this.toast.success(editaba ? 'Destino actualizado correctamente' : 'Destino registrado correctamente');
    this.cargar();
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

  abrirCerrar(destino: Destino): void {
    this.cerrarMenu();
    this.destinoSeleccionado.set(destino);
    this.fechaFinForm.setValue('');
    this.modalError.set(null);
    this.modal.set('cerrar');
  }

  abrirReabrir(destino: Destino): void {
    this.cerrarMenu();
    this.destinoSeleccionado.set(destino);
    this.modalError.set(null);
    this.modal.set('reabrir');
  }

  abrirEliminar(destino: Destino): void {
    this.cerrarMenu();
    this.destinoSeleccionado.set(destino);
    this.modalError.set(null);
    this.modal.set('eliminar');
  }

  confirmarCerrar(): void {
    const destino = this.destinoSeleccionado();
    if (!destino) return;
    const fecha = this.fechaFinForm.value.trim();
    if (!fecha) {
      this.modalError.set('Ingresá la fecha de fin.');
      return;
    }
    this.ejecutar(this.destinosService.editar(destino.id, { fecha_fin: fecha }), 'Destino cerrado correctamente');
  }

  confirmarReabrir(): void {
    const destino = this.destinoSeleccionado();
    if (!destino) return;
    this.ejecutar(this.destinosService.editar(destino.id, { fecha_fin: null }), 'Destino reabierto correctamente');
  }

  confirmarEliminar(): void {
    const destino = this.destinoSeleccionado();
    if (!destino) return;
    // Si era el único de la página, la página deja de existir — pero solo si el borrado sale bien.
    const eraUltimoDeLaPagina = this.destinos().length === 1 && this.page() > 1;
    this.ejecutar(this.destinosService.eliminar(destino.id), 'Destino eliminado del historial', () => {
      if (eraUltimoDeLaPagina) this.page.update((p) => p - 1);
    });
  }

  private ejecutar(operacion: Observable<unknown>, mensajeExito: string, onExito?: () => void): void {
    this.procesando.set(true);
    this.modalError.set(null);
    operacion.subscribe({
      next: () => {
        this.procesando.set(false);
        this.modal.set(null);
        this.destinoSeleccionado.set(null);
        onExito?.();
        this.toast.success(mensajeExito);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.modalError.set(parseError(err));
      },
    });
  }
}
