import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap, takeUntil, debounceTime, filter } from 'rxjs';
import {
  BaseOpcion,
  FiltroCategoria,
  GradoItem,
  OPCIONES_FILTRO_CATEGORIA,
  OpcionSelect,
  PersonaListItem,
  categoriaParam,
} from '../../../../core/models/personal.models';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  FILTRO_DERECHA_NUMOR_INICIAL,
  FiltroDerechaNumor,
  filtroDerechaNumorParams,
  hayFiltroDerechaNumor,
  OrdenarPorDerechaNumor,
} from '../../../../core/models/derecha.models';
import { CARGAS_MASIVAS } from '../../../../core/services/carga-masiva.service';
import { ToastService } from '../../../../core/services/toast.service';
import { parseError } from '../../../../shared/utils/parse-error';

/** Lista de ids separada por coma ('3,4'); descarta lo que no sea un id válido. */
const idsDeUrl = (valor: string | null): number[] =>
  (valor ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);

const numeroDeUrl = (valor: string | null): number | null => {
  const n = valor == null || valor === '' ? NaN : Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const CLAVES_FILTRO_DERECHA = ['derechaDesde', 'derechaHasta', 'numorDesde', 'numorHasta'] as const;

@Component({
  selector: 'app-personal-page',
  standalone: false,
  templateUrl: './personal-page.html',
  styleUrl: './personal-page.scss',
})
export class PersonalPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly personalService = inject(PersonalService);
  private readonly auth = inject(AuthService);

  /**
   * Con alcance de unidad el backend nunca lista fuera de las bases del usuario: sin destino
   * elegido muestra todas las suyas, y con destino solo las elegidas que sean suyas.
   */
  readonly alcanceAcotado = computed(
    () => this.auth.alcanceDe('personas.ver') === 'unidad',
  );
  /** Opciones del filtro Destino: con alcance de unidad, solo las bases del usuario. */
  readonly basesDelFiltro = computed(() => {
    if (!this.alcanceAcotado()) return this.bases();
    const propias = new Set((this.auth.currentUser()?.unidades ?? []).map((u) => String(u.id)));
    return this.bases().filter((b) => propias.has(String(b.id)));
  });

  readonly PAGE_SIZE = 10;

  readonly searchTerm     = signal('');
  /** En los filtros de lista, vacío equivale a «Todos». */
  readonly selectedDestinos = signal<number[]>([]);
  readonly selectedEstados = signal<number[]>([]);
  readonly selectedCategoria = signal<FiltroCategoria>('todos');
  readonly opcionesCategoria = OPCIONES_FILTRO_CATEGORIA;
  /**
   * `GET /personas` excluye a los retirados por defecto: exige una relación con
   * `fecha_fin: null`. Sin este toggle, un retirado simplemente no está en la grilla.
   */
  readonly incluirRetirados = signal(false);
  /** Grado, escalafón, rangos de derecha y numor, y el orden del listado. */
  readonly filtroDerecha = signal<FiltroDerechaNumor>({ ...FILTRO_DERECHA_NUMOR_INICIAL });
  readonly currentPage     = signal(1);

  readonly items   = signal<PersonaListItem[]>([]);
  readonly total   = signal(0);
  readonly loading = signal(false);

  readonly bases       = signal<BaseOpcion[]>([]);
  readonly situaciones = signal<OpcionSelect[]>([]);
  readonly grados      = signal<GradoItem[]>([]);
  readonly escalafones = signal<OpcionSelect[]>([]);

  /** Segunda fila de filtros (derecha, numor, estado y retirados): se despliega con la flecha. */
  readonly filtrosExtraAbiertos = signal(false);

  /** Solo lo que está en la fila desplegable: es lo que avisa el punto de la flecha. */
  readonly hayFiltroExtra = computed(() => {
    const f = this.filtroDerecha();
    return this.selectedEstados().length > 0 || this.incluirRetirados()
      || [f.derechaDesde, f.derechaHasta, f.numorDesde, f.numorHasta].some((v) => v != null);
  });

  readonly hayFiltrosActivos = computed(() => {
    const f = this.filtroDerecha();
    return !!this.searchTerm() || this.selectedDestinos().length > 0 || this.selectedEstados().length > 0
      || this.selectedCategoria() !== 'todos' || this.incluirRetirados() || hayFiltroDerechaNumor(f);
  });

  readonly openMenuId    = signal<string | null>(null);
  readonly menuPosition  = signal<{ top: number; right: number } | null>(null);

  // ─── Import ───────────────────────────────────────────────────────────────────
  readonly importPanelOpen = signal(false);
  readonly cargaPersonal = CARGAS_MASIVAS.personal;

  private readonly destroy$       = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();
  private readonly triggerLoad$   = new Subject<void>();
  /**
   * Término con el que salió la última petición. Reemplaza a `distinctUntilChanged`, que tras
   * 'Borrar filtros' seguía recordando el término viejo y no recargaba al volver a escribirlo.
   */
  private busquedaAplicada: string | undefined;

  ngOnInit(): void {
    // La página, los filtros y el orden viven en la URL: al volver atrás desde una ficha se recuperan.
    this.leerEstadoDeUrl();

    // Todas las peticiones pasan por triggerLoad$ con switchMap para cancelar
    // la anterior si llega una nueva antes de que responda.
    this.triggerLoad$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.busquedaAplicada = this.searchTerm().trim() || undefined;
          this.escribirEstadoEnUrl();
          return this.personalService.findPaginado({
            page:     this.currentPage(),
            pageSize: this.PAGE_SIZE,
            search:   this.busquedaAplicada,
            destino:  this.selectedDestinos().length ? this.selectedDestinos() : undefined,
            estado:   this.selectedEstados().length ? this.selectedEstados() : undefined,
            filtroDerecha: this.filtroDerecha(),
            incluir_inactivos: this.incluirRetirados() || undefined,
            categoria: categoriaParam(this.selectedCategoria()),
          }).pipe(
            // El error se maneja acá adentro: si llegara al subscribe cortaría el stream
            // y el listado dejaría de responder hasta recargar la página.
            catchError((err: HttpErrorResponse) => {
              this.loading.set(false);
              this.toast.error(parseError(err));
              return EMPTY;
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      });

    // Buscador con 400 ms de margen antes de disparar la petición.
    this.searchSubject$
      .pipe(
        debounceTime(400),
        filter(term => (term.trim() || undefined) !== this.busquedaAplicada),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.currentPage.set(1);
        this.triggerLoad$.next();
      });

    this.loadFilterOptions();
    this.triggerLoad$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private leerEstadoDeUrl(): void {
    const q = this.route.snapshot.queryParamMap;
    if (!q.keys.length) return;

    this.currentPage.set(numeroDeUrl(q.get('page')) ?? 1);
    this.searchTerm.set(q.get('q') ?? '');
    this.selectedDestinos.set(idsDeUrl(q.get('destino')));
    this.selectedEstados.set(idsDeUrl(q.get('estado')));
    const categoria = q.get('categoria');
    if (this.opcionesCategoria.some(o => o.value === categoria)) {
      this.selectedCategoria.set(categoria as FiltroCategoria);
    }
    this.incluirRetirados.set(q.get('retirados') === '1');

    const filtro: FiltroDerechaNumor = { ...FILTRO_DERECHA_NUMOR_INICIAL };
    for (const clave of CLAVES_FILTRO_DERECHA) filtro[clave] = numeroDeUrl(q.get(clave));
    filtro.gradoId = idsDeUrl(q.get('gradoId'));
    filtro.escalafonId = idsDeUrl(q.get('escalafonId'));
    const escala = q.get('escala');
    if (escala === 'OFICIALES' || escala === 'SUBALTERNOS') filtro.escala = escala;
    const ordenarPor = q.get('ordenarPor');
    if (ordenarPor === 'derecha' || ordenarPor === 'numor' || ordenarPor === 'apellido') filtro.ordenarPor = ordenarPor;
    const direccion = q.get('direccion');
    if (direccion === 'ASC' || direccion === 'DESC') filtro.direccion = direccion;
    this.filtroDerecha.set(filtro);

    // Los filtros de la fila desplegable se muestran abiertos si vienen cargados.
    if (this.hayFiltroExtra()) this.filtrosExtraAbiertos.set(true);
  }

  /** Reemplaza la entrada del historial: cambiar un filtro no suma un paso más al botón atrás. */
  private escribirEstadoEnUrl(): void {
    const queryParams: Params = {
      ...filtroDerechaNumorParams(this.filtroDerecha()),
      ...(this.currentPage() > 1 && { page: this.currentPage() }),
      ...(this.busquedaAplicada && { q: this.busquedaAplicada }),
      ...(this.selectedDestinos().length && { destino: this.selectedDestinos().join(',') }),
      ...(this.selectedEstados().length && { estado: this.selectedEstados().join(',') }),
      ...(this.selectedCategoria() !== 'todos' && { categoria: this.selectedCategoria() }),
      ...(this.incluirRetirados() && { retirados: '1' }),
    };
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  private loadFilterOptions(): void {
    this.personalService.getBases().subscribe({ next: d => this.bases.set(d) });
    this.personalService.getSituaciones().subscribe({ next: d => this.situaciones.set(d) });
    this.personalService.getGrados().subscribe({ next: d => this.grados.set(d) });
    this.personalService.getEscalafones().subscribe({ next: d => this.escalafones.set(d) });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchSubject$.next(term);
  }

  onDestinosChange(ids: number[] | null): void {
    this.selectedDestinos.set(ids ?? []);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onFiltroDerecha(filtro: FiltroDerechaNumor): void {
    this.filtroDerecha.set(filtro);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onGradosChange(ids: number[] | null): void {
    this.onFiltroDerecha({ ...this.filtroDerecha(), gradoId: ids ?? [] });
  }

  onEscalafonesChange(ids: number[] | null): void {
    this.onFiltroDerecha({ ...this.filtroDerecha(), escalafonId: ids ?? [] });
  }

  /** Click en el encabezado: el mismo campo invierte la dirección, otro arranca ascendente. */
  ordenarPor(campo: OrdenarPorDerechaNumor): void {
    const actual = this.filtroDerecha();
    const direccion = actual.ordenarPor === campo && actual.direccion === 'ASC' ? 'DESC' : 'ASC';
    this.onFiltroDerecha({ ...actual, ordenarPor: campo, direccion });
  }

  indicadorOrden(campo: OrdenarPorDerechaNumor): string {
    const f = this.filtroDerecha();
    if (f.ordenarPor !== campo) return '';
    return f.direccion === 'DESC' ? '↓' : '↑';
  }

  ariaSort(campo: OrdenarPorDerechaNumor): 'ascending' | 'descending' | 'none' {
    const f = this.filtroDerecha();
    if (f.ordenarPor !== campo) return 'none';
    return f.direccion === 'DESC' ? 'descending' : 'ascending';
  }

  onEstadosChange(ids: number[] | null): void {
    this.selectedEstados.set(ids ?? []);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onCategoriaChange(categoria: FiltroCategoria): void {
    this.selectedCategoria.set(categoria);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  setIncluirRetirados(valor: boolean): void {
    this.incluirRetirados.set(valor);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.triggerLoad$.next();
  }

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedDestinos.set([]);
    this.selectedEstados.set([]);
    // Se conserva el orden elegido en la tabla: limpiar borra filtros, no el orden.
    const { ordenarPor, direccion } = this.filtroDerecha();
    this.filtroDerecha.set({ ...FILTRO_DERECHA_NUMOR_INICIAL, ordenarPor, direccion });
    this.selectedCategoria.set('todos');
    this.incluirRetirados.set(false);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.openMenuId.set(null);
    this.menuPosition.set(null);
  }

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuId() === id) {
      this.openMenuId.set(null);
      this.menuPosition.set(null);
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      this.openMenuId.set(id);
    }
  }

  abrirImportar(): void {
    this.importPanelOpen.set(true);
  }

  cerrarImportar(huboCambios: boolean): void {
    this.importPanelOpen.set(false);
    if (huboCambios) this.triggerLoad$.next();
  }

  abrirNuevoPersonal(): void {
    this.router.navigate(['/personal/nuevo']);
  }

  ver(item: PersonaListItem): void {
    this.router.navigate(['/personal', item.id]);
  }

  editar(item: PersonaListItem): void {
    this.router.navigate(['/personal', item.id], { queryParams: { editar: 1 } });
  }

  trackPersonal = (_index: number, item: PersonaListItem) => item.id;
}
