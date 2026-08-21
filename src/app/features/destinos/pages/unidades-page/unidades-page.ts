import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ListarUnidadesQuery, UnidadConDestinados } from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { DEBOUNCE_MS } from '../../destino-presentacion';

export type ModalKind = 'form' | 'baja' | 'reactivar' | null;

@Component({
  selector: 'app-unidades-page',
  standalone: false,
  templateUrl: './unidades-page.html',
  styleUrl: './unidades-page.scss',
})
export class UnidadesPage implements OnInit, OnDestroy {
  private readonly destinosService = inject(DestinosService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly unidades = signal<UnidadConDestinados[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;

  readonly filtroQuery = signal('');
  readonly filtroTipo = signal('');
  readonly filtroVigente = signal('');
  readonly hayFiltros = computed(
    () => !!this.filtroQuery() || !!this.filtroTipo() || !!this.filtroVigente(),
  );

  readonly tipoOpciones = [
    { value: '', label: 'Todos los tipos' },
    { value: 'Unidad', label: 'Unidad' },
    { value: 'Organismo', label: 'Organismo' },
  ];

  readonly vigenteOpciones = [
    { value: '', label: 'Todas' },
    { value: 'true', label: 'Vigentes' },
    { value: 'false', label: 'Dadas de baja' },
  ];

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('catalogos.gestionar'));

  readonly modal = signal<ModalKind>(null);
  readonly unidadEnEdicion = signal<UnidadConDestinados | null>(null);

  readonly unidadSeleccionada = signal<UnidadConDestinados | null>(null);
  readonly procesando = signal(false);
  readonly modalError = signal<string | null>(null);

  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    this.cargar();
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
    this.destinosService.listarUnidades(this.query()).subscribe({
      next: (res) => {
        this.unidades.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(parseError(err));
        this.loading.set(false);
      },
    });
  }

  private query(): ListarUnidadesQuery {
    const q: ListarUnidadesQuery = { page: this.page(), pageSize: this.pageSize };
    const texto = this.filtroQuery().trim();
    if (texto) q.query = texto;
    const tipo = this.filtroTipo();
    if (tipo) q.tipo = tipo as 'Unidad' | 'Organismo';
    const vigente = this.filtroVigente();
    if (vigente) q.vigente = vigente === 'true';
    return q;
  }

  onQueryInput(value: string): void {
    this.filtroQuery.set(value);
    this.querySubject.next();
  }

  onTipoChange(value: string): void {
    this.filtroTipo.set(value ?? '');
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
    this.filtroTipo.set('');
    this.filtroVigente.set('');
    this.page.set(1);
    this.cargar();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar();
  }

  verDetalle(unidad: UnidadConDestinados): void {
    this.router.navigate(['/destinos/unidades', unidad.id]);
  }

  trackUnidad = (_: number, u: UnidadConDestinados) => u.id;

  // ── Modal de alta / edición ──────────────────────────────────────────────────

  abrirCrear(): void {
    this.unidadEnEdicion.set(null);
    this.modal.set('form');
  }

  abrirEditar(unidad: UnidadConDestinados): void {
    this.cerrarMenu();
    this.unidadEnEdicion.set(unidad);
    this.modal.set('form');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.unidadEnEdicion.set(null);
    this.unidadSeleccionada.set(null);
    this.modalError.set(null);
  }

  onGuardado(): void {
    const editaba = this.unidadEnEdicion() !== null;
    this.cerrarModal();
    this.toast.success(editaba ? 'Unidad actualizada correctamente' : 'Unidad creada correctamente');
    this.cargar();
  }

  // ── Menú kebab ────────────────────────────────────────────────────────────────

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuId() === id) {
      this.cerrarMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    this.openMenuId.set(id);
  }

  cerrarMenu(): void {
    this.openMenuId.set(null);
    this.menuPosition.set(null);
  }

  // ── Baja lógica / reactivación ──────────────────────────────────────────────────

  /**
   * `total_destinados` cuenta solo destinos vigentes, que es justo lo que valida el backend:
   * con gente adentro, tanto el DELETE como el PATCH `vigente: false` responden 409. Se chequea
   * acá para no pegarle al backend sabiendo que va a fallar. La reactivación no se valida.
   */
  readonly bajaBloqueada = computed(() => (this.unidadSeleccionada()?.total_destinados ?? 0) > 0);

  abrirBaja(unidad: UnidadConDestinados): void {
    this.cerrarMenu();
    this.unidadSeleccionada.set(unidad);
    this.modalError.set(null);
    this.modal.set('baja');
  }

  abrirReactivar(unidad: UnidadConDestinados): void {
    this.cerrarMenu();
    this.unidadSeleccionada.set(unidad);
    this.modalError.set(null);
    this.modal.set('reactivar');
  }

  confirmarBaja(): void {
    const unidad = this.unidadSeleccionada();
    if (!unidad || this.bajaBloqueada()) return;
    this.ejecutar(this.catalogosService.darDeBajaUnidad(unidad.id), 'Unidad dada de baja correctamente');
  }

  confirmarReactivar(): void {
    const unidad = this.unidadSeleccionada();
    if (!unidad) return;
    this.ejecutar(this.catalogosService.editarUnidad(unidad.id, { vigente: true }), 'Unidad reactivada correctamente');
  }

  private ejecutar(operacion: Observable<unknown>, mensajeExito: string): void {
    this.procesando.set(true);
    this.modalError.set(null);
    operacion.subscribe({
      next: () => {
        this.procesando.set(false);
        this.modal.set(null);
        this.unidadSeleccionada.set(null);
        this.toast.success(mensajeExito);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.modalError.set(parseError(err));
      },
    });
  }
}
