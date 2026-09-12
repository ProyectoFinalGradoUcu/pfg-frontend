import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
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

const PAGE_SIZE = 20;

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

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<PasiblesPaginados | null>(null);

  readonly page = signal(1);
  readonly filtroTexto = signal('');
  readonly filtroEstados = signal<EstadoElegibilidad[]>(['PASIBLE', 'PROXIMO']);
  readonly filtroEscalafon = signal<number | null>(null);
  readonly filtroUnidad = signal<number | null>(null);
  readonly fechaReferencia = signal<string>('');
  readonly horizonteMeses = signal(6);

  readonly escalafones = signal<OpcionSelect[]>([]);
  readonly unidades = signal<OpcionSelect[]>([]);

  readonly seleccionado = signal<Elegibilidad | null>(null);

  readonly marcados = signal<Set<string>>(new Set());
  readonly puedeRegistrar = computed(() => this.auth.hasPermiso('ascensos.registrar'));

  readonly items = computed(() => this.datos()?.items ?? []);
  readonly total = computed(() => this.datos()?.total ?? 0);
  readonly stats = computed(() => this.datos()?.stats ?? null);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  private readonly busqueda$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((texto) => {
        this.filtroTexto.set(texto);
        this.page.set(1);
        this.cargar();
      });

    this.personal.getEscalafones().subscribe({ next: (e) => this.escalafones.set(e) });
    this.personal.getUnidades().subscribe({ next: (u) => this.unidades.set(u) });

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
        estado: this.filtroEstados(),
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
    this.busqueda$.next(texto);
  }

  estadoElegido(estado: EstadoElegibilidad): boolean {
    return this.filtroEstados().includes(estado);
  }

  /** Quitar el último dejaría la tabla vacía sin explicación. */
  alternarEstado(estado: EstadoElegibilidad): void {
    const actuales = this.filtroEstados();
    const nuevos = actuales.includes(estado)
      ? actuales.filter((e) => e !== estado)
      : [...actuales, estado];
    if (nuevos.length === 0) return;
    this.filtroEstados.set(nuevos);
    this.page.set(1);
    this.cargar();
  }

  verTodos(): void {
    this.filtroEstados.set(this.estadosDisponibles.map((e) => e.value));
    this.page.set(1);
    this.cargar();
  }

  onEscalafon(valor: string): void {
    this.filtroEscalafon.set(valor ? Number(valor) : null);
    this.page.set(1);
    this.cargar();
  }

  onUnidad(valor: string): void {
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
    const hoy = new Date();
    const anio = hoy.getMonth() > 1 ? hoy.getFullYear() + 1 : hoy.getFullYear();
    this.onFecha(`${anio}-02-01`);
  }

  onHorizonte(valor: string): void {
    const meses = Number(valor);
    if (!Number.isFinite(meses) || meses < 1) return;
    this.horizonteMeses.set(meses);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroTexto.set('');
    this.filtroEstados.set(['PASIBLE', 'PROXIMO']);
    this.filtroEscalafon.set(null);
    this.filtroUnidad.set(null);
    this.fechaReferencia.set('');
    this.horizonteMeses.set(6);
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
