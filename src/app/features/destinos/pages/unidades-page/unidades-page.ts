import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Comando, ListarSubUnidadesQuery, SubUnidadConDestinados } from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { DEBOUNCE_MS } from '../../destino-presentacion';

/**
 * Sub-unidades (los destinos posibles) con su comando y dotación actual.
 *
 * Solo lectura: unidades y sub-unidades son catálogos del sistema de liquidación,
 * así que acá no hay alta, edición ni baja.
 */
@Component({
  selector: 'app-unidades-page',
  standalone: false,
  templateUrl: './unidades-page.html',
  styleUrl: './unidades-page.scss',
})
export class UnidadesPage implements OnInit, OnDestroy {
  private readonly destinosService = inject(DestinosService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly subUnidades = signal<SubUnidadConDestinados[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;

  readonly comandos = signal<Comando[]>([]);
  readonly comandoOpciones = computed(() =>
    this.comandos().map((c) => ({ value: c.id, label: `${c.codigo} · ${c.denominacion}` })),
  );

  readonly filtroQuery = signal('');
  readonly filtroComandoId = signal('');
  readonly filtroVigente = signal('');
  readonly hayFiltros = computed(
    () => !!this.filtroQuery() || !!this.filtroComandoId() || !!this.filtroVigente(),
  );

  readonly vigenteOpciones = [
    { value: '', label: 'Todas' },
    { value: 'true', label: 'Vigentes' },
    { value: 'false', label: 'Dadas de baja' },
  ];

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    this.cargar();
    this.catalogosService.getComandos().subscribe({
      next: (c) => this.comandos.set(c),
      error: () => this.comandos.set([]),
    });
    this.querySubject.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => {
      this.page.set(1);
      this.cargar();
    });
  }

  ngOnDestroy(): void {
    this.querySubject.complete();
  }

  cargar(): void {
    this.loading.set(true);
    this.destinosService.listarSubUnidades(this.query()).subscribe({
      next: (res) => {
        this.subUnidades.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(parseError(err));
        this.loading.set(false);
      },
    });
  }

  private query(): ListarSubUnidadesQuery {
    const q: ListarSubUnidadesQuery = { page: this.page(), pageSize: this.pageSize };
    const texto = this.filtroQuery().trim();
    if (texto) q.query = texto;
    const comando = this.filtroComandoId();
    if (comando) q.unidad_id = Number(comando);
    const vigente = this.filtroVigente();
    if (vigente) q.vigente = vigente === 'true';
    return q;
  }

  onQueryInput(value: string): void {
    this.filtroQuery.set(value);
    this.querySubject.next();
  }

  onComandoChange(value: string | null): void {
    this.filtroComandoId.set(value ?? '');
    this.page.set(1);
    this.cargar();
  }

  onVigenteChange(value: string): void {
    this.filtroVigente.set(value ?? '');
    this.page.set(1);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroQuery.set('');
    this.filtroComandoId.set('');
    this.filtroVigente.set('');
    this.page.set(1);
    this.cargar();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar();
  }

  verDetalle(subUnidad: SubUnidadConDestinados): void {
    this.router.navigate(['/destinos/unidades', subUnidad.id]);
  }

  trackSubUnidad = (_: number, s: SubUnidadConDestinados) => s.id;
}
