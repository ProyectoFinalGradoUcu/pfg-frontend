import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { VuelosService } from '../../../../core/services/vuelos.service';
import {
  FiltroCategoria,
  GradoItem,
  OPCIONES_FILTRO_CATEGORIA,
  OpcionSelect,
  categoriaParam,
} from '../../../../core/models/personal.models';
import {
  ConteosRegistrosVuelo,
  EstadoRegistroVuelo,
  FiltrosRegistrosVuelo,
  PeriodoVuelo,
  RegistroVuelo,
  StatsRegistrosVuelo,
  UnidadVuelo,
} from '../../../../core/models/vuelos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { RegistroGuardado } from '../../components/registro-vuelo-modal/registro-vuelo-modal';
import { formatoHoras, sinParentesis } from '../../horas';

const DEBOUNCE_MS = 300;

/** Valor del filtro de unidad que pide a quienes no tienen ninguna. */
const SIN_UNIDAD = 'sin';

const ORDINALES = ['1er', '2do', '3er', '4to'];

export type ModalPeriodo = 'nuevo' | 'cerrar' | 'reabrir' | 'eliminar' | null;

/** '' = Todos. */
export type FiltroEstado = '' | EstadoRegistroVuelo;

interface TarjetaPeriodo {
  numero: number;
  label: string;
  periodo: PeriodoVuelo | null;
}

const STATS_VACIAS: StatsRegistrosVuelo = { total: 0, cargados: 0, oficiales: 0, subalternos: 0, horas_cargadas: 0 };
const CONTEOS_VACIOS: ConteosRegistrosVuelo = { todos: 0, pendientes: 0, cargados: 0 };

/** Porcentaje para las barras de avance. */
export const avance = (cargados: number | undefined, total: number | undefined) =>
  total ? Math.round(((cargados ?? 0) / total) * 100) : 0;

@Component({
  selector: 'app-horas-vuelo-page',
  standalone: false,
  templateUrl: './horas-vuelo-page.html',
  styleUrl: './horas-vuelo-page.scss',
})
export class HorasVueloPage implements OnInit, OnDestroy {
  private readonly vuelosService = inject(VuelosService);
  private readonly personalService = inject(PersonalService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly formatoHoras = formatoHoras;
  readonly sinParentesis = sinParentesis;
  readonly avance = avance;

  // ── Períodos ──

  readonly periodos = signal<PeriodoVuelo[]>([]);
  readonly cargandoPeriodos = signal(true);
  readonly anio = signal(new Date().getFullYear());
  readonly periodo = signal<PeriodoVuelo | null>(null);

  /** Años con algún período, más el actual para poder abrir el primero. */
  readonly anios = computed(() => {
    const set = new Set(this.periodos().map((p) => p.anio));
    set.add(new Date().getFullYear());
    set.add(this.anio());
    return [...set].sort((a, b) => b - a).map((a) => ({ value: a, label: String(a) }));
  });

  /** Las 4 hojas del año, como en el Excel; las que no existen se pueden abrir. */
  readonly tarjetas = computed<TarjetaPeriodo[]>(() =>
    [1, 2, 3, 4].map((numero) => ({
      numero,
      label: `${ORDINALES[numero - 1]} período`,
      periodo: this.periodos().find((p) => p.anio === this.anio() && p.numero === numero) ?? null,
    })),
  );

  /** Oficiales o subalternos: acota el avance de los períodos, el resumen y la tabla. */
  readonly filtroCategoria = signal<FiltroCategoria>('todos');
  readonly categoriaOpciones = OPCIONES_FILTRO_CATEGORIA;

  // ── Registros ──

  readonly loading = signal(false);
  readonly registros = signal<RegistroVuelo[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly stats = signal<StatsRegistrosVuelo>(STATS_VACIAS);
  readonly conteos = signal<ConteosRegistrosVuelo>(CONTEOS_VACIOS);

  // ── Filtros de la tabla ──

  readonly filtroEstado = signal<FiltroEstado>('');
  readonly filtroQuery = signal('');
  readonly filtroGradoId = signal<number | null>(null);
  readonly filtroEscalafonId = signal<number | null>(null);
  readonly filtroUnidad = signal<string>('');
  readonly hayFiltros = computed(
    () =>
      !!this.filtroQuery() ||
      this.filtroGradoId() !== null ||
      this.filtroEscalafonId() !== null ||
      !!this.filtroUnidad(),
  );

  readonly pestanasEstado = computed(() => [
    { value: '' as FiltroEstado, label: 'Todos', cantidad: this.conteos().todos },
    { value: 'pendientes' as FiltroEstado, label: 'Pendientes', cantidad: this.conteos().pendientes },
    { value: 'cargados' as FiltroEstado, label: 'Cargados', cantidad: this.conteos().cargados },
  ]);

  readonly grados = signal<GradoItem[]>([]);
  readonly escalafones = signal<OpcionSelect[]>([]);
  readonly unidades = signal<UnidadVuelo[]>([]);
  readonly unidadOpciones = computed(() => [
    { value: SIN_UNIDAD, label: 'Sin unidad de vuelo' },
    ...this.unidades().map((u) => ({ value: u.id, label: u.vigente ? u.denominacion : `${u.denominacion} (baja)` })),
  ]);

  // ── Permisos ──

  /** Abrir, cerrar y borrar períodos es de alcance global. */
  readonly puedeGestionarPeriodos = computed(() => this.auth.hasPermiso('vuelos.gestionar'));
  readonly puedeCargar = computed(
    () =>
      this.auth.hasAnyPermiso(['vuelos.gestionar', 'vuelos.gestionar.unidad']) &&
      !!this.periodo() &&
      !this.periodo()!.cerrado,
  );

  // ── Menús y modales ──

  /** `'periodo'` = menú de la cabecera del período; si no, el id del registro. */
  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  readonly modal = signal<ModalPeriodo>(null);
  readonly procesando = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly nuevoAnio = signal(new Date().getFullYear());
  readonly nuevoNumero = signal(1);
  readonly numeroOpciones = [1, 2, 3, 4].map((n) => ({ value: n, label: `${ORDINALES[n - 1]} Período` }));

  readonly registroEnEdicion = signal<RegistroVuelo | null>(null);
  readonly historialPersonaId = signal<string | null>(null);
  private huboCambios = false;

  readonly exportando = signal(false);
  readonly sincronizando = signal(false);

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    this.cargarPeriodos();
    this.cargarCatalogos();
    this.querySubject.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => this.filtrar());
  }

  ngOnDestroy(): void {
    this.querySubject.complete();
  }

  private cargarCatalogos(): void {
    this.personalService.getGrados().subscribe({ next: (g) => this.grados.set(g), error: () => this.grados.set([]) });
    this.personalService.getEscalafones().subscribe({
      next: (e) => this.escalafones.set(e),
      error: () => this.escalafones.set([]),
    });
    this.vuelosService.listarUnidades().subscribe({
      next: (u) => this.unidades.set(u),
      error: () => this.unidades.set([]),
    });
  }

  /** `seleccionarId` elige ese período; si no, conserva el actual o toma el más reciente. */
  cargarPeriodos(seleccionarId?: string): void {
    this.vuelosService.listarPeriodos(categoriaParam(this.filtroCategoria())).subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);
        this.cargandoPeriodos.set(false);
        const id = seleccionarId ?? this.periodo()?.id;
        const elegido = periodos.find((p) => p.id === id) ?? periodos[0] ?? null;
        if (elegido?.id !== this.periodo()?.id || seleccionarId) {
          this.seleccionarPeriodo(elegido);
        } else if (elegido) {
          this.periodo.set(elegido);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPeriodos.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  seleccionarPeriodo(periodo: PeriodoVuelo | null): void {
    this.periodo.set(periodo);
    if (periodo) this.anio.set(periodo.anio);
    this.page.set(1);
    if (periodo) {
      this.cargar();
    } else {
      this.registros.set([]);
      this.total.set(0);
      this.stats.set(STATS_VACIAS);
      this.conteos.set(CONTEOS_VACIOS);
    }
  }

  onAnioChange(anio: number | null): void {
    if (!anio) return;
    this.anio.set(anio);
    const delAnio = this.periodos().filter((p) => p.anio === anio);
    // El más avanzado del año: es el que se está cargando.
    this.seleccionarPeriodo(delAnio.sort((a, b) => b.numero - a.numero)[0] ?? null);
  }

  onCategoriaChange(value: FiltroCategoria | null): void {
    this.filtroCategoria.set(value ?? 'todos');
    this.cargarPeriodos();
    this.filtrar();
  }

  onTarjeta(tarjeta: TarjetaPeriodo): void {
    if (tarjeta.periodo) {
      if (tarjeta.periodo.id !== this.periodo()?.id) this.seleccionarPeriodo(tarjeta.periodo);
      return;
    }
    if (this.puedeGestionarPeriodos()) this.abrirNuevo(tarjeta.numero);
  }

  // ── Registros ──

  /** `silencioso` refresca sin mostrar "Cargando…" (después de editar). */
  cargar(silencioso = false): void {
    const periodo = this.periodo();
    if (!periodo) return;
    if (!silencioso) this.loading.set(true);
    this.vuelosService
      .listarRegistros(periodo.id, { ...this.filtros(), page: this.page(), pageSize: this.pageSize })
      .subscribe({
        next: (res) => {
          // Si mientras tanto se eligió otro período, esta respuesta ya no sirve.
          if (this.periodo()?.id !== periodo.id) return;
          this.registros.set(res.items);
          this.total.set(res.total);
          this.stats.set(res.stats);
          this.conteos.set(res.conteos);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.toast.error(parseError(err));
        },
      });
  }

  private filtros(): FiltrosRegistrosVuelo {
    const f: FiltrosRegistrosVuelo = {};
    const texto = this.filtroQuery().trim();
    if (texto) f.query = texto;
    f.categoria = categoriaParam(this.filtroCategoria());
    if (this.filtroEstado()) f.estado = this.filtroEstado() as EstadoRegistroVuelo;
    if (this.filtroGradoId() !== null) f.grado_id = this.filtroGradoId()!;
    if (this.filtroEscalafonId() !== null) f.escalafon_id = this.filtroEscalafonId()!;
    const unidad = this.filtroUnidad();
    if (unidad === SIN_UNIDAD) f.sin_unidad = true;
    else if (unidad) f.unidad_vuelo_id = Number(unidad);
    return f;
  }

  private filtrar(): void {
    this.page.set(1);
    this.cargar();
  }

  onEstadoChange(value: FiltroEstado): void {
    if (value === this.filtroEstado()) return;
    this.filtroEstado.set(value);
    this.filtrar();
  }

  onQueryInput(value: string): void {
    this.filtroQuery.set(value);
    this.querySubject.next();
  }

  onGradoChange(value: number | null): void {
    this.filtroGradoId.set(value ?? null);
    this.filtrar();
  }

  onEscalafonChange(value: number | null): void {
    this.filtroEscalafonId.set(value ?? null);
    this.filtrar();
  }

  onUnidadChange(value: string | null): void {
    this.filtroUnidad.set(value ?? '');
    this.filtrar();
  }

  limpiarFiltros(): void {
    this.filtroQuery.set('');
    this.filtroGradoId.set(null);
    this.filtroEscalafonId.set(null);
    this.filtroUnidad.set('');
    this.filtrar();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar();
  }

  trackRegistro = (_: number, r: RegistroVuelo) => r.id;

  /** "Brig. Gral. · Av. · CI 60000008" */
  datosFuncionario(r: RegistroVuelo): string {
    return [r.grado?.denominacion, sinParentesis(r.escalafon?.denominacion), `CI ${r.persona.cedula}`]
      .filter(Boolean)
      .join(' · ');
  }

  /** Hay algo para exportar si el año tiene al menos un período abierto. */
  readonly hayPeriodosEnAnio = computed(() => this.tarjetas().some((t) => !!t.periodo));

  readonly tooltipExportar = computed(() => {
    const quienes = { todos: 'todo el personal', oficial: 'solo los oficiales', subalterno: 'solo los subalternos' }[
      this.filtroCategoria()
    ];
    return `Exporta a Excel todos los períodos de ${this.anio()}, cada uno en una hoja, con ${quienes}. No tiene en cuenta los demás filtros.`;
  });

  exportar(): void {
    this.exportando.set(true);
    this.vuelosService.exportarAnio(this.anio(), categoriaParam(this.filtroCategoria())).subscribe({
      next: () => this.exportando.set(false),
      error: (err: HttpErrorResponse) => {
        this.exportando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  // ── Menús ──

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

  // ── Edición y consulta por persona ──

  abrirEditar(registro: RegistroVuelo): void {
    this.cerrarMenu();
    this.registroEnEdicion.set(registro);
  }

  /** Hay siguiente si no es el último de la página. */
  haySiguiente(): boolean {
    const actual = this.registroEnEdicion();
    const lista = this.registros();
    return !!actual && lista.findIndex((r) => r.id === actual.id) < lista.length - 1;
  }

  onRegistroGuardado({ registro, siguiente }: RegistroGuardado): void {
    this.huboCambios = true;
    const lista = this.registros();
    const i = lista.findIndex((r) => r.id === registro.id);
    this.registros.set(lista.map((r) => (r.id === registro.id ? registro : r)));
    if (siguiente && i >= 0 && i < lista.length - 1) {
      this.registroEnEdicion.set(lista[i + 1]);
      return;
    }
    this.toast.success('Horas de vuelo guardadas');
    this.cerrarEdicion();
  }

  cerrarEdicion(): void {
    this.registroEnEdicion.set(null);
    if (this.huboCambios) {
      this.huboCambios = false;
      // Resumen, pestañas y avance del período. Con "Pendientes" la fila cargada sale de la lista.
      this.cargar(true);
      this.cargarPeriodos();
    }
  }

  abrirHistorial(registro: RegistroVuelo): void {
    this.cerrarMenu();
    this.historialPersonaId.set(registro.persona.id);
  }

  // ── Acciones del período ──

  abrirNuevo(numero?: number): void {
    const libres = this.tarjetas().filter((t) => !t.periodo);
    this.nuevoAnio.set(this.anio());
    this.nuevoNumero.set(numero ?? libres[0]?.numero ?? 1);
    this.modalError.set(null);
    this.modal.set('nuevo');
  }

  abrirModal(tipo: Exclude<ModalPeriodo, 'nuevo' | null>): void {
    this.cerrarMenu();
    this.modalError.set(null);
    this.modal.set(tipo);
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
  }

  confirmarNuevo(): void {
    const anio = Number(this.nuevoAnio());
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2999) {
      this.modalError.set('Ingresá un año válido.');
      return;
    }
    this.ejecutar(this.vuelosService.crearPeriodo({ anio, numero: this.nuevoNumero() }), (creado) => {
      this.toast.success(`${creado.etiqueta} abierto con ${creado.registros_generados} funcionarios`);
      this.cargarPeriodos(creado.id);
    });
  }

  confirmarCambioEstado(cerrado: boolean): void {
    const periodo = this.periodo()!;
    this.ejecutar(this.vuelosService.cambiarEstadoPeriodo(periodo.id, cerrado), (actualizado) => {
      this.toast.success(`${actualizado.etiqueta} ${cerrado ? 'cerrado' : 'reabierto'}`);
      this.cargarPeriodos();
    });
  }

  confirmarEliminar(): void {
    const periodo = this.periodo()!;
    this.ejecutar(this.vuelosService.eliminarPeriodo(periodo.id), () => {
      this.toast.success(`${periodo.etiqueta} eliminado`);
      this.periodo.set(null);
      this.cargarPeriodos();
    });
  }

  sincronizar(): void {
    const periodo = this.periodo();
    if (!periodo) return;
    this.sincronizando.set(true);
    this.vuelosService.sincronizarPeriodo(periodo.id).subscribe({
      next: (res) => {
        this.sincronizando.set(false);
        if (!res.registros_agregados) {
          this.toast.success('El período ya tenía a todo el personal en actividad');
          return;
        }
        this.toast.success(`Se agregaron ${res.registros_agregados} funcionarios al período`);
        this.cargar();
        this.cargarPeriodos();
      },
      error: (err: HttpErrorResponse) => {
        this.sincronizando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  private ejecutar<T>(operacion: Observable<T>, onExito: (res: T) => void): void {
    this.procesando.set(true);
    this.modalError.set(null);
    operacion.subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.modal.set(null);
        onExito(res);
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.modalError.set(parseError(err));
      },
    });
  }
}
