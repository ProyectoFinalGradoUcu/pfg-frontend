import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OrdenAscenso, OrdenesPaginadas } from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

const PAGE_SIZE = 10;

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

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<OrdenesPaginadas | null>(null);

  readonly page = signal(1);
  readonly anio = signal(new Date().getFullYear());
  readonly filtroNumero = signal('');
  readonly filtroAnuladas = signal<string>('');
  readonly filtroExcepciones = signal(false);

  readonly desplegadas = signal<Set<string>>(new Set());

  readonly items = computed(() => this.datos()?.items ?? []);
  readonly total = computed(() => this.datos()?.total ?? 0);
  readonly stats = computed(() => this.datos()?.stats ?? null);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  readonly puedeRegistrar = computed(() => this.auth.hasPermiso('ascensos.registrar'));

  // Arranca en el año que viene: una orden puede estar fechada más adelante.
  readonly anios = computed(() => {
    const actual = new Date().getFullYear();
    return Array.from({ length: 13 }, (_, i) => actual + 1 - i);
  });

  private readonly busqueda$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((texto) => {
        this.filtroNumero.set(texto);
        this.page.set(1);
        this.cargar();
      });

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

  // ─── Filtros ──────────────────────────────────────────────────────────────

  onBusqueda(texto: string): void {
    this.busqueda$.next(texto);
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
