import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, switchMap, takeUntil, debounceTime, filter } from 'rxjs';
import {
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
  hayFiltroDerechaNumor,
  OrdenarPorDerechaNumor,
} from '../../../../core/models/derecha.models';
import { CARGAS_MASIVAS } from '../../../../core/services/carga-masiva.service';

@Component({
  selector: 'app-personal-page',
  standalone: false,
  templateUrl: './personal-page.html',
  styleUrl: './personal-page.scss',
})
export class PersonalPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly personalService = inject(PersonalService);
  private readonly auth = inject(AuthService);

  /**
   * Con alcance de unidad el backend fuerza el filtro y descarta `destino` del query. El select
   * se muestra fijo y deshabilitado en vez de ocultarse, para que quede claro por qué el
   * listado está acotado.
   */
  readonly alcanceAcotado = computed(
    () => this.auth.alcanceDe('personas.ver') === 'unidad',
  );
  readonly unidadPropia = computed(() => {
    const user = this.auth.currentUser();
    if (!user || user.unidades.length === 0) return null;
    return user.unidades.map((u) => u.denominacion).join(', ');
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

  readonly unidades    = signal<OpcionSelect[]>([]);
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
    // Todas las peticiones pasan por triggerLoad$ con switchMap para cancelar
    // la anterior si llega una nueva antes de que responda.
    this.triggerLoad$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.busquedaAplicada = this.searchTerm().trim() || undefined;
          return this.personalService.findPaginado({
            page:     this.currentPage(),
            pageSize: this.PAGE_SIZE,
            search:   this.busquedaAplicada,
            destino:  this.selectedDestinos().length ? this.selectedDestinos() : undefined,
            estado:   this.selectedEstados().length ? this.selectedEstados() : undefined,
            filtroDerecha: this.filtroDerecha(),
            incluir_inactivos: this.incluirRetirados() || undefined,
            categoria: categoriaParam(this.selectedCategoria()),
          });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: res => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
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

  private loadFilterOptions(): void {
    this.personalService.getUnidades().subscribe({ next: d => this.unidades.set(d) });
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
    this.router.navigate(['/personal', item.id]);
  }

  trackPersonal = (_index: number, item: PersonaListItem) => item.id;
}
