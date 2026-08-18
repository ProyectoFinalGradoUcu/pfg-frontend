import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, switchMap, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { CargaMasivaResult, GradoItem, OpcionSelect, PersonaListItem } from '../../../../core/models/personal.models';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';

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
  readonly selectedDestino = signal<number | null>(null);
  readonly selectedRango   = signal<number | null>(null);
  readonly selectedEstado  = signal<number | null>(null);
  readonly currentPage     = signal(1);

  readonly items   = signal<PersonaListItem[]>([]);
  readonly total   = signal(0);
  readonly loading = signal(false);

  readonly unidades    = signal<OpcionSelect[]>([]);
  readonly todosGrados = signal<GradoItem[]>([]);
  readonly situaciones = signal<OpcionSelect[]>([]);

  readonly hayFiltrosActivos = computed(() =>
    !!this.searchTerm() || !!this.selectedDestino() || !!this.selectedRango() || !!this.selectedEstado()
  );

  readonly openMenuId    = signal<string | null>(null);
  readonly menuPosition  = signal<{ top: number; right: number } | null>(null);

  // ─── Import ───────────────────────────────────────────────────────────────────
  readonly importPanelOpen = signal(false);
  readonly importFile      = signal<File | null>(null);
  readonly importLoading   = signal(false);
  readonly importResult    = signal<CargaMasivaResult | null>(null);
  readonly importError     = signal<string | null>(null);

  private readonly destroy$       = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();
  private readonly triggerLoad$   = new Subject<void>();

  ngOnInit(): void {
    // Todas las peticiones pasan por triggerLoad$ con switchMap para cancelar
    // la anterior si llega una nueva antes de que responda.
    this.triggerLoad$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.personalService.findPaginado({
            page:     this.currentPage(),
            pageSize: this.PAGE_SIZE,
            search:   this.searchTerm().trim() || undefined,
            destino:  this.selectedDestino() ?? undefined,
            rango:    this.selectedRango()   ?? undefined,
            estado:   this.selectedEstado()  ?? undefined,
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
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
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
    this.personalService.getGrados().subscribe({ next: d => this.todosGrados.set(d) });
    this.personalService.getSituaciones().subscribe({ next: d => this.situaciones.set(d) });
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.searchSubject$.next(this.searchTerm());
  }

  onDestinoChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedDestino.set(val ? Number(val) : null);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onRangoChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedRango.set(val ? Number(val) : null);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onEstadoChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedEstado.set(val ? Number(val) : null);
    this.currentPage.set(1);
    this.triggerLoad$.next();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.triggerLoad$.next();
  }

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.selectedDestino.set(null);
    this.selectedRango.set(null);
    this.selectedEstado.set(null);
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
    this.importFile.set(null);
    this.importResult.set(null);
    this.importError.set(null);
    this.importPanelOpen.set(true);
  }

  cerrarImportar(): void {
    if (this.importResult()?.exitosos) {
      this.triggerLoad$.next();
    }
    this.importPanelOpen.set(false);
  }

  onImportFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.importFile.set(file);
    this.importError.set(null);
    this.importResult.set(null);
  }

  procesarImportacion(): void {
    const file = this.importFile();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.importError.set('El archivo no puede superar los 5 MB.');
      return;
    }
    this.importLoading.set(true);
    this.importError.set(null);
    this.personalService.cargaMasiva(file).subscribe({
      next: result => {
        this.importResult.set(result);
        this.importLoading.set(false);
      },
      error: () => {
        this.importError.set('Error al procesar el archivo. Verificá el formato e intentá de nuevo.');
        this.importLoading.set(false);
      },
    });
  }

  descargarPlantilla(): void {
    this.personalService.descargarPlantilla();
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
