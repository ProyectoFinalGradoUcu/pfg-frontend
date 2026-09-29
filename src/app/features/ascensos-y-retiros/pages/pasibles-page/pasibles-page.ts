import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PersonalService } from '../../../../core/services/personal.service';
import {
  ESTADOS_ELEGIBILIDAD,
  ETIQUETAS_ESTADO_CURSO,
  Elegibilidad,
  EstadoCurso,
  EstadoElegibilidad,
  PasiblesPaginados,
} from '../../../../core/models/ascensos.models';
import { OpcionSelect } from '../../../../core/models/personal.models';
import { parseError } from '../../../../shared/utils/parse-error';

const PAGE_SIZE = 10;
const ESTADOS_POR_DEFECTO: EstadoElegibilidad[] = ['PASIBLE', 'PROXIMO'];
const HORIZONTE_POR_DEFECTO = 6;
// La app no registra el locale es: el pipe `date` pondría los meses en inglés.
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Listado evaluado. Por defecto muestra pasibles y próximos; con el filtro de
 * estado se ve a todos con su porqué.
 */
@Component({
  selector: 'app-pasibles-page',
  standalone: false,
  templateUrl: './pasibles-page.html',
  styleUrl: './pasibles-page.scss',
})
export class PasiblesPage implements OnInit, OnDestroy {
  private readonly svc = inject(AscensosService);
  private readonly personal = inject(PersonalService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly estadosDisponibles = ESTADOS_ELEGIBILIDAD;
  readonly PAGE_SIZE = PAGE_SIZE;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<PasiblesPaginados | null>(null);

  readonly page = signal(1);
  readonly filtroTexto = signal('');
  /** Lo tipeado, al instante; `filtroTexto` recién después del debounce. */
  readonly textoBusqueda = signal('');
  /** Vacío equivale a «Todos los estados». */
  readonly filtroEstados = signal<EstadoElegibilidad[]>([...ESTADOS_POR_DEFECTO]);
  readonly filtroEscalafon = signal<number | null>(null);
  readonly filtroUnidad = signal<number | null>(null);
  readonly fechaReferencia = signal<string>('');
  readonly horizonteMeses = signal(HORIZONTE_POR_DEFECTO);
  readonly masFiltrosAbiertos = signal(false);

  readonly escalafones = signal<OpcionSelect[]>([]);
  readonly unidades = signal<OpcionSelect[]>([]);

  readonly seleccionado = signal<Elegibilidad | null>(null);

  readonly marcados = signal<Set<string>>(new Set());
  readonly puedeRegistrar = computed(() => this.auth.hasPermiso('ascensos.registrar'));

  readonly items = computed(() => this.datos()?.items ?? []);
  readonly total = computed(() => this.datos()?.total ?? 0);
  readonly stats = computed(() => this.datos()?.stats ?? null);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  /** Los de la fila plegada: se marcan en el botón para que no queden activos sin verse. */
  readonly hayFiltrosAvanzados = computed(
    () => !!this.fechaReferencia() || this.horizonteMeses() !== HORIZONTE_POR_DEFECTO,
  );

  readonly hayFiltrosActivos = computed(() => {
    const estados = this.filtroEstados();
    const estadosPorDefecto =
      estados.length === ESTADOS_POR_DEFECTO.length &&
      ESTADOS_POR_DEFECTO.every((e) => estados.includes(e));
    return (
      !!this.textoBusqueda() ||
      !estadosPorDefecto ||
      this.filtroEscalafon() !== null ||
      this.filtroUnidad() !== null ||
      this.hayFiltrosAvanzados()
    );
  });

  /** Hasta dónde llega «próximos»: desde la fecha evaluada, o desde hoy. */
  readonly fechaHorizonte = computed(() => {
    const base = this.fechaReferencia() ? new Date(`${this.fechaReferencia()}T00:00:00`) : new Date();
    base.setMonth(base.getMonth() + this.horizonteMeses());
    const anio = base.getFullYear() !== new Date().getFullYear() ? ` de ${base.getFullYear()}` : '';
    return `${base.getDate()} de ${MESES[base.getMonth()]}${anio}`;
  });

  private readonly busqueda$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe((texto) => {
        this.filtroTexto.set(texto);
        this.page.set(1);
        this.cargar();
      });

    // El select compara con ===: los ids tienen que ser del mismo tipo que el filtro.
    const conIdNumerico = (ops: OpcionSelect[]) => ops.map((o) => ({ ...o, id: Number(o.id) }));
    this.personal.getEscalafones().subscribe({ next: (e) => this.escalafones.set(conIdNumerico(e)) });
    this.personal.getUnidades().subscribe({ next: (u) => this.unidades.set(conIdNumerico(u)) });

    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc
      .listarPasibles({
        page: this.page(),
        pageSize: PAGE_SIZE,
        // Sin estados elegidos se piden todos, no el default del backend.
        estado: this.filtroEstados().length
          ? this.filtroEstados()
          : this.estadosDisponibles.map((e) => e.value),
        query: this.filtroTexto() || undefined,
        escalafon_id: this.filtroEscalafon() ?? undefined,
        unidad_id: this.filtroUnidad() ?? undefined,
        fecha_referencia: this.fechaReferencia() || undefined,
        horizonte_meses: this.horizonteMeses(),
      })
      .subscribe({
        next: (d) => {
          this.datos.set(d);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(parseError(err));
        },
      });
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────

  onBusqueda(texto: string): void {
    this.textoBusqueda.set(texto);
    this.busqueda$.next(texto);
  }

  onEstados(estados: EstadoElegibilidad[] | null): void {
    this.filtroEstados.set(estados ?? []);
    this.page.set(1);
    this.cargar();
  }

  onEscalafon(valor: number | string | null): void {
    this.filtroEscalafon.set(valor ? Number(valor) : null);
    this.page.set(1);
    this.cargar();
  }

  onUnidad(valor: number | string | null): void {
    this.filtroUnidad.set(valor ? Number(valor) : null);
    this.page.set(1);
    this.cargar();
  }

  onFecha(valor: string): void {
    this.fechaReferencia.set(valor);
    this.page.set(1);
    this.cargar();
  }

  /** La Ley 19.775 confiere los ascensos de oficiales con esa fecha. */
  alPrimeroDeFebrero(): void {
    this.onFecha(this.proximoPrimeroDeFebrero());
  }

  esPrimeroDeFebrero(): boolean {
    return this.fechaReferencia() === this.proximoPrimeroDeFebrero();
  }

  /** Atajo con estado: si ya está evaluando al 1.º de febrero, vuelve a hoy. */
  alternarPrimeroDeFebrero(): void {
    if (this.esPrimeroDeFebrero()) this.onFecha('');
    else this.alPrimeroDeFebrero();
  }

  private proximoPrimeroDeFebrero(): string {
    const hoy = new Date();
    const anio = hoy.getMonth() > 1 ? hoy.getFullYear() + 1 : hoy.getFullYear();
    return `${anio}-02-01`;
  }

  onHorizonte(valor: string): void {
    const meses = Number(valor);
    if (!Number.isFinite(meses) || meses < 1) return;
    this.horizonteMeses.set(meses);
    this.page.set(1);
    this.cargar();
  }

  alternarMasFiltros(): void {
    this.masFiltrosAbiertos.update((v) => !v);
  }

  limpiarFiltros(): void {
    this.textoBusqueda.set('');
    this.filtroTexto.set('');
    this.filtroEstados.set([...ESTADOS_POR_DEFECTO]);
    this.filtroEscalafon.set(null);
    this.filtroUnidad.set(null);
    this.fechaReferencia.set('');
    this.horizonteMeses.set(HORIZONTE_POR_DEFECTO);
    this.page.set(1);
    this.cargar();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.page.set(pagina);
    this.cargar();
  }

  // ─── Selección múltiple ──────────────────────────────────────────────────

  estaMarcado(personaId: string): boolean {
    return this.marcados().has(personaId);
  }

  alternarMarca(personaId: string): void {
    this.marcados.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(personaId)) nuevo.delete(personaId);
      else nuevo.add(personaId);
      return nuevo;
    });
  }

  marcarTodosDeLaPagina(marcar: boolean): void {
    this.marcados.update((set) => {
      const nuevo = new Set(set);
      for (const item of this.items()) {
        if (marcar) nuevo.add(item.persona.id);
        else nuevo.delete(item.persona.id);
      }
      return nuevo;
    });
  }

  todosDeLaPaginaMarcados(): boolean {
    const items = this.items();
    return items.length > 0 && items.every((i) => this.marcados().has(i.persona.id));
  }

  limpiarSeleccion(): void {
    this.marcados.set(new Set());
  }

  /** Lleva al registro con los seleccionados ya cargados. */
  registrarOrdenConSeleccionados(): void {
    const ids = [...this.marcados()];
    if (ids.length === 0) return;
    this.router.navigate(['/ascensos-y-retiros/ordenes/nueva'], {
      queryParams: { personas: ids.join(',') },
    });
  }

  // ─── Detalle ─────────────────────────────────────────────────────────────

  abrirDetalle(item: Elegibilidad): void {
    this.seleccionado.set(item);
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
  }

  // ─── Presentación ────────────────────────────────────────────────────────

  etiquetaEstado(estado: EstadoElegibilidad): string {
    return this.estadosDisponibles.find((e) => e.value === estado)?.label ?? estado;
  }

  etiquetaCurso(estado: EstadoCurso): string {
    return ETIQUETAS_ESTADO_CURSO[estado] ?? estado;
  }

  /** ✓ cumple · ✗ no cumple · ○ no aplica */
  simboloRequisito(req: { aplica: boolean; cumple: boolean }): string {
    if (!req.aplica) return '○';
    return req.cumple ? '✓' : '✗';
  }

  claseRequisito(req: { aplica: boolean; cumple: boolean }): string {
    if (!req.aplica) return 'chip--noaplica';
    return req.cumple ? 'chip--ok' : 'chip--falta';
  }

  antiguedadLegible(dias: number): string {
    const anios = Math.floor(dias / 365);
    const meses = Math.floor((dias % 365) / 30);
    const partes: string[] = [];
    if (anios > 0) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`);
    return partes.length ? partes.join(' ') : `${dias} días`;
  }
}
