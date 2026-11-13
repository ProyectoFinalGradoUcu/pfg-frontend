import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CARGAS_MASIVAS } from '../../../../core/services/carga-masiva.service';
import {
  Comando,
  Destino,
  DestinoEliminado,
  DestinosStats,
  ListarDestinosQuery,
  SubUnidadConDestinados,
} from '../../../../core/models/destinos.models';
import {
  FiltroCategoria,
  OPCIONES_FILTRO_CATEGORIA,
  categoriaParam,
} from '../../../../core/models/personal.models';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  DEBOUNCE_MS,
  comandoDestino as comandoDestinoDe,
  etiquetaSubUnidad,
  nombreDestino as nombreDestinoDe,
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
  private readonly catalogosService = inject(CatalogosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly destinos = signal<Destino[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;

  /** Globales: `destinos_activos` y `sub_unidades_con_personal` ignoran los filtros. */
  readonly stats = signal<DestinosStats>({
    total_destinos: 0,
    destinos_activos: 0,
    sub_unidades_con_personal: 0,
  });

  readonly comandos = signal<Comando[]>([]);
  readonly subUnidades = signal<SubUnidadConDestinados[]>([]);

  readonly comandoOpciones = computed(() =>
    this.comandos().map((c) => ({ value: c.id, label: c.codigo || c.denominacion })),
  );
  /** Con un comando elegido, solo se ofrecen sus sub-unidades. */
  readonly subUnidadOpciones = computed(() => {
    const comando = this.filtroComandoId();
    return this.subUnidades()
      .filter((s) => !comando || s.unidad?.id === comando)
      .map((s) => ({ value: s.id, label: etiquetaSubUnidad(s) }));
  });

  readonly filtroQuery = signal('');
  /** Filtro por comando (`unidad_id` en el backend). */
  readonly filtroComandoId = signal<string>('');
  readonly filtroSubUnidadId = signal<string>('');
  readonly filtroEstado = signal<EstadoFiltro>('');
  readonly filtroCategoria = signal<FiltroCategoria>('todos');
  readonly categoriaOpciones = OPCIONES_FILTRO_CATEGORIA;
  readonly hayFiltros = computed(
    () =>
      !!this.filtroQuery() ||
      !!this.filtroComandoId() ||
      !!this.filtroSubUnidadId() ||
      !!this.filtroEstado() ||
      this.filtroCategoria() !== 'todos',
  );

  readonly estadoOpciones = [
    { value: '', label: 'Todos' },
    { value: 'vigentes', label: 'Vigentes' },
    { value: 'historial', label: 'Historial' },
  ];

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('destinos.gestionar'));

  readonly modal = signal<ModalKind>(null);
  readonly destinoEnEdicion = signal<Destino | null>(null);

  readonly importOpen = signal(false);
  readonly cargaDestinos = CARGAS_MASIVAS.destinos;

  cerrarImportar(huboCambios: boolean): void {
    this.importOpen.set(false);
    if (huboCambios) this.cargar();
  }

  readonly destinoSeleccionado = signal<Destino | null>(null);
  readonly procesando = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly fechaFinForm = new FormControl('', { nonNullable: true });

  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    this.cargar();
    this.catalogosService.getComandos().subscribe({
      next: (c) => this.comandos.set(c),
      error: () => this.comandos.set([]),
    });
    this.destinosService.listarSubUnidadesParaSelector().subscribe({
      next: (s) => this.subUnidades.set(s),
      error: () => this.subUnidades.set([]),
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
    if (this.filtroComandoId()) q.unidad_id = Number(this.filtroComandoId());
    if (this.filtroSubUnidadId()) q.sub_unidad_id = Number(this.filtroSubUnidadId());
    const estado = this.filtroEstado();
    if (estado) q.activo = estado === 'vigentes';
    q.categoria = categoriaParam(this.filtroCategoria());
    return q;
  }

  onQueryInput(value: string): void {
    this.filtroQuery.set(value);
    this.querySubject.next();
  }

  onComandoChange(value: string | null): void {
    const comando = value ?? '';
    this.filtroComandoId.set(comando);
    // Una sub-unidad de otro comando daría siempre cero resultados: se suelta.
    const sub = this.subUnidades().find((s) => s.id === this.filtroSubUnidadId());
    if (comando && sub && sub.unidad?.id !== comando) this.filtroSubUnidadId.set('');
    this.page.set(1);
    this.cargar();
  }

  onSubUnidadChange(value: string | null): void {
    this.filtroSubUnidadId.set(value ?? '');
    this.page.set(1);
    this.cargar();
  }

  onEstadoChange(value: string): void {
    this.filtroEstado.set(value as EstadoFiltro);
    this.page.set(1);
    this.cargar();
  }

  onCategoriaChange(value: FiltroCategoria | null): void {
    this.filtroCategoria.set(value ?? 'todos');
    this.page.set(1);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroQuery.set('');
    this.filtroComandoId.set('');
    this.filtroSubUnidadId.set('');
    this.filtroEstado.set('');
    this.filtroCategoria.set('todos');
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

  nombreDestino(d: Destino): string {
    return nombreDestinoDe(d);
  }

  comandoDestino(d: Destino): string {
    return comandoDestinoDe(d);
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
    this.ejecutar(
      this.destinosService.eliminar(destino.id),
      // Si era el vigente, el backend deshizo el pase y reabrió el destino anterior.
      (r: DestinoEliminado) =>
        r.destino_reabierto
          ? 'Pase deshecho. Se reabrió el destino anterior y el funcionario vuelve a revistar en esa base'
          : destino.activo
            ? 'Pase deshecho'
            : 'Destino eliminado del historial',
      () => {
        if (eraUltimoDeLaPagina) this.page.update((p) => p - 1);
      },
    );
  }

  private ejecutar<T>(
    operacion: Observable<T>,
    mensajeExito: string | ((resultado: T) => string),
    onExito?: () => void,
  ): void {
    this.procesando.set(true);
    this.modalError.set(null);
    operacion.subscribe({
      next: (resultado) => {
        this.procesando.set(false);
        this.modal.set(null);
        this.destinoSeleccionado.set(null);
        onExito?.();
        this.toast.success(typeof mensajeExito === 'function' ? mensajeExito(resultado) : mensajeExito);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.modalError.set(parseError(err));
      },
    });
  }
}
