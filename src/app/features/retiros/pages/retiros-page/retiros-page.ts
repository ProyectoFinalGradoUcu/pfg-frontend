import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import {
  ListarRetirosQuery,
  MotivoBajaCatalogo,
  Retiro,
  RetiroCreado,
} from '../../../../core/models/retiros.models';
import { OpcionSelect } from '../../../../core/models/personal.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { mensajeCierres } from '../../components/retiro-form-modal/retiro-form-modal';
import { DEBOUNCE_MS, ETIQUETA_ESTADO, estadoRetiro, nombreFuncionario } from '../../retiro-presentacion';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-retiros-page',
  standalone: false,
  templateUrl: './retiros-page.html',
  styleUrl: './retiros-page.scss',
})
export class RetirosPage implements OnInit, OnDestroy {
  private readonly retirosService = inject(RetirosService);
  private readonly catalogos = inject(CatalogosService);
  private readonly personal = inject(PersonalService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly destroy$ = new Subject<void>();
  private readonly recargar$ = new Subject<void>();
  private readonly busqueda$ = new Subject<string>();

  readonly items = signal<Retiro[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = PAGE_SIZE;

  readonly busqueda = signal('');
  readonly unidadId = signal<number | null>(null);
  readonly motivoBajaId = signal<number | null>(null);
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly incluirAnulados = signal(false);

  readonly unidades = signal<OpcionSelect[]>([]);
  readonly motivos = signal<MotivoBajaCatalogo[]>([]);

  readonly puedeRegistrar = this.auth.hasPermiso('retiros.registrar');

  readonly hayFiltrosActivos = computed(
    () =>
      !!this.busqueda() ||
      this.unidadId() !== null ||
      this.motivoBajaId() !== null ||
      !!this.desde() ||
      !!this.hasta() ||
      this.incluirAnulados(),
  );

  readonly estadoRetiro = estadoRetiro;
  readonly nombreFuncionario = nombreFuncionario;
  readonly etiquetaEstado = ETIQUETA_ESTADO;

  ngOnInit(): void {
    this.personal.getUnidades().subscribe({ next: (u) => this.unidades.set(u) });
    this.catalogos.getMotivosBaja().subscribe({ next: (m) => this.motivos.set(m) });

    this.busqueda$
      .pipe(debounceTime(DEBOUNCE_MS), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.reiniciarPaginado());

    this.recargar$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.retirosService.listar(this.query());
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

    this.recargar$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * `incluir_anulados` no alcanza solo: un anulado nunca es vigente, así que con
   * `vigentes=true` el backend lo filtra igual. Por eso van acoplados.
   */
  private query(): ListarRetirosQuery {
    const q: ListarRetirosQuery = {
      page: this.currentPage(),
      pageSize: PAGE_SIZE,
      vigentes: !this.incluirAnulados(),
    };
    if (this.busqueda().trim()) q.query = this.busqueda().trim();
    if (this.unidadId()) q.unidad_id = this.unidadId()!;
    if (this.motivoBajaId()) q.motivo_baja_id = this.motivoBajaId()!;
    if (this.desde()) q.desde = this.desde();
    if (this.hasta()) q.hasta = this.hasta();
    if (this.incluirAnulados()) q.incluir_anulados = true;
    return q;
  }

  onBuscar(valor: string): void {
    this.busqueda.set(valor);
    this.busqueda$.next(valor);
  }

  setIncluirAnulados(valor: boolean): void {
    this.incluirAnulados.set(valor);
    this.reiniciarPaginado();
  }

  setUnidad(id: number | null): void {
    this.unidadId.set(id);
    this.reiniciarPaginado();
  }

  setMotivo(id: number | null): void {
    this.motivoBajaId.set(id);
    this.reiniciarPaginado();
  }

  setRango(desde: string, hasta: string): void {
    this.desde.set(desde);
    this.hasta.set(hasta);
    this.reiniciarPaginado();
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.unidadId.set(null);
    this.motivoBajaId.set(null);
    this.desde.set('');
    this.hasta.set('');
    this.incluirAnulados.set(false);
    this.reiniciarPaginado();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.recargar$.next();
  }

  abrirDetalle(r: Retiro): void {
    this.router.navigate(['/retiros', r.id]);
  }

  readonly registroAbierto = signal(false);

  abrirRegistro(): void {
    this.registroAbierto.set(true);
  }

  cerrarRegistro(): void {
    this.registroAbierto.set(false);
  }

  onRegistrado(r: RetiroCreado): void {
    this.cerrarRegistro();
    this.toast.success(mensajeCierres(r.cerrado));
    this.reiniciarPaginado();
  }

  private reiniciarPaginado(): void {
    this.currentPage.set(1);
    this.recargar$.next();
  }
}
