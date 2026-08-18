import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Destino,
  ListarFuncionariosUnidadQuery,
  UnidadConDestinados,
} from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  DEBOUNCE_MS,
  nombreFuncionario as nombreFuncionarioDe,
  ordenOBoletin as ordenOBoletinDe,
  trackDestino as trackDestinoDe,
} from '../../destino-presentacion';

@Component({
  selector: 'app-unidad-detalle-page',
  standalone: false,
  templateUrl: './unidad-detalle-page.html',
  styleUrl: './unidad-detalle-page.scss',
})
export class UnidadDetallePage implements OnInit, OnDestroy {
  private readonly destinosService = inject(DestinosService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private unidadId = '';

  readonly loading = signal(false);
  readonly unidad = signal<UnidadConDestinados | null>(null);
  readonly funcionarios = signal<Destino[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;

  /** Sin este filtro el listado incluye el historial y no coincide con `total_destinados`. */
  readonly soloVigentes = signal(true);
  readonly filtroQuery = signal('');

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('unidadId');
    if (!id) {
      this.router.navigate(['/destinos/unidades']);
      return;
    }
    this.unidadId = id;

    this.cargar();
    this.cargarUnidad();

    this.querySubject.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => {
      this.page.set(1);
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.querySubject.complete();
  }

  /** El endpoint de funcionarios no devuelve los datos de la unidad; salen del catálogo. */
  private cargarUnidad(): void {
    this.destinosService.listarUnidadesParaSelector().subscribe({
      next: (unidades) => this.unidad.set(unidades.find((u) => u.id === this.unidadId) ?? null),
      error: () => this.unidad.set(null),
    });
  }

  cargar(): void {
    this.loading.set(true);
    this.destinosService.listarFuncionariosUnidad(this.unidadId, this.query()).subscribe({
      next: (res) => {
        this.funcionarios.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.toast.error(parseError(err));
        if (err.status === 404) this.router.navigate(['/destinos/unidades']);
      },
    });
  }

  private query(): ListarFuncionariosUnidadQuery {
    const q: ListarFuncionariosUnidadQuery = { page: this.page(), pageSize: this.pageSize };
    if (this.soloVigentes()) q.activo = true;
    const texto = this.filtroQuery().trim();
    if (texto) q.query = texto;
    return q;
  }

  onQueryInput(value: string): void {
    this.filtroQuery.set(value);
    this.querySubject.next();
  }

  onToggleVigentes(soloVigentes: boolean): void {
    this.soloVigentes.set(soloVigentes);
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

  trackDestino = (_: number, d: Destino) => trackDestinoDe(_, d);
}
