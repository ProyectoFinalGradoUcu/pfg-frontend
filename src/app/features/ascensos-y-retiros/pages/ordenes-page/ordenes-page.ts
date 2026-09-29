import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { EMPTY, Subject, debounceTime, expand, reduce, takeUntil } from 'rxjs';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OrdenAscenso, OrdenesPaginadas } from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

const PAGE_SIZE = 10;

/** Para listar las órdenes de todos los años y sacar de ahí los períodos del filtro. */
const TODO_EL_HISTORIAL = { desde: '1900-01-01', hasta: '2201-01-01', pageSize: 200 };

/** Ascensos registrados, agrupados por orden. Por defecto, el año en curso. */
@Component({
  selector: 'app-ordenes-page',
  standalone: false,
  templateUrl: './ordenes-page.html',
  styleUrl: './ordenes-page.scss',
})
export class OrdenesPage implements OnInit, OnDestroy {
  private readonly svc = inject(AscensosService);
  private readonly auth = inject(AuthService);

  readonly PAGE_SIZE = PAGE_SIZE;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<OrdenesPaginadas | null>(null);

  readonly page = signal(1);
  readonly anio = signal(new Date().getFullYear());
  /** Lo que se ve en el input; `filtroNumero` es lo ya aplicado tras el debounce. */
  readonly textoBusqueda = signal('');
  readonly filtroNumero = signal('');
  readonly filtroAnuladas = signal<string>('');
  readonly filtroExcepciones = signal(false);

  readonly desplegadas = signal<Set<string>>(new Set());

  readonly items = computed(() => this.datos()?.items ?? []);
  readonly total = computed(() => this.datos()?.total ?? 0);
  readonly stats = computed(() => this.datos()?.stats ?? null);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  readonly puedeRegistrar = computed(() => this.auth.hasPermiso('ascensos.registrar'));

  /** Años en los que hay al menos una orden cargada. */
  readonly aniosConOrdenes = signal<number[]>([]);

  /**
   * Los años con órdenes, más el año en curso (el período por defecto, aunque
   * todavía esté vacío) y el elegido, para que el select nunca quede en blanco.
   */
  readonly anios = computed(() => {
    const todos = new Set([...this.aniosConOrdenes(), new Date().getFullYear(), this.anio()]);
    return [...todos].sort((a, b) => b - a);
  });

  /** Al limpiar filtros se vuelve al año más reciente. */
  readonly anioPorDefecto = computed(() =>
    Math.max(new Date().getFullYear(), ...this.aniosConOrdenes()),
  );

  readonly hayFiltrosActivos = computed(
    () =>
      !!this.textoBusqueda() ||
      this.anio() !== this.anioPorDefecto() ||
      this.filtroAnuladas() !== '' ||
      this.filtroExcepciones(),
  );

  private readonly busqueda$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe((texto) => {
        // Se compara con lo aplicado y no con la emisión anterior: limpiar filtros
        // lo cambia por fuera, y volver a escribir lo mismo tiene que recargar.
        if (texto === this.filtroNumero()) return;
        this.filtroNumero.set(texto);
        this.page.set(1);
        this.cargar();
      });

    this.cargar();
    this.cargarAnios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc
      .listarOrdenes({
        page: this.page(),
        pageSize: PAGE_SIZE,
        anio: this.anio(),
        numero_orden: this.filtroNumero() || undefined,
        anuladas:
          this.filtroAnuladas() === '' ? undefined : this.filtroAnuladas() === 'true',
        con_excepciones: this.filtroExcepciones() || undefined,
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

  /** Recorre todas las páginas del historial: el filtro solo ofrece años con órdenes. */
  private cargarAnios(): void {
    const pagina = (page: number) => this.svc.listarOrdenes({ ...TODO_EL_HISTORIAL, page });
    pagina(1)
      .pipe(
        expand((res) => (res.page * res.pageSize < res.total ? pagina(res.page + 1) : EMPTY)),
        reduce((anios, res) => {
          for (const o of res.items) {
            if (o.fecha_orden) anios.add(Number(o.fecha_orden.slice(0, 4)));
          }
          return anios;
        }, new Set<number>()),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (anios) => this.aniosConOrdenes.set([...anios].sort((a, b) => b - a)),
        // Sin la lista, el select igual ofrece el año en curso.
        error: () => this.aniosConOrdenes.set([]),
      });
  }

  // ─── Filtros ──────────────────────────────────────────────────────────────

  onBusqueda(texto: string): void {
    this.textoBusqueda.set(texto);
    this.busqueda$.next(texto);
  }

  limpiarFiltros(): void {
    this.textoBusqueda.set('');
    this.filtroNumero.set('');
    this.anio.set(this.anioPorDefecto());
    this.filtroAnuladas.set('');
    this.filtroExcepciones.set(false);
    this.page.set(1);
    this.cargar();
  }

  onAnio(valor: string): void {
    this.anio.set(Number(valor));
    this.page.set(1);
    this.cargar();
  }

  onAnuladas(valor: string): void {
    this.filtroAnuladas.set(valor);
    this.page.set(1);
    this.cargar();
  }

  onExcepciones(valor: boolean): void {
    this.filtroExcepciones.set(valor);
    this.page.set(1);
    this.cargar();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.page.set(pagina);
    this.cargar();
  }

  // ─── Despliegue ───────────────────────────────────────────────────────────

  estaDesplegada(id: string): boolean {
    return this.desplegadas().has(id);
  }

  alternarDespliegue(orden: OrdenAscenso): void {
    this.desplegadas.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(orden.id)) nuevo.delete(orden.id);
      else nuevo.add(orden.id);
      return nuevo;
    });
  }
}
