import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { DestinosService } from '../../../../core/services/destinos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ComandoCatalogo,
  ListarSubUnidadesQuery,
  SubUnidadConDestinados,
} from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { DEBOUNCE_MS } from '../../destino-presentacion';
import { TipoCatalogo } from '../../components/unidad-form-modal/unidad-form-modal';

/** El comando o la base sobre la que se abrió un modal. */
type Seleccion =
  | { tipo: 'comando'; item: ComandoCatalogo }
  | { tipo: 'base'; item: SubUnidadConDestinados };

type ModalKind = 'form' | 'baja' | 'reactivar' | null;

type Tab = 'bases' | 'comandos';

const VIGENCIA_POR_DEFECTO = 'true';

interface MenuAbierto {
  seleccion: Seleccion;
  top: number;
  right: number;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Comandos (`unidades`) y sub-unidades o bases (`sub_unidades`, los destinos posibles)
 * con su dotación actual.
 *
 * Con `catalogos.gestionar` se pueden crear, editar, dar de baja y reactivar. Son tablas
 * compartidas con liquidación: la baja es lógica, el código no se edita y una base
 * siempre se crea dentro de un comando.
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
  private readonly auth = inject(AuthService);

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('catalogos.gestionar'));

  readonly loading = signal(false);
  readonly subUnidades = signal<SubUnidadConDestinados[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = 10;

  /** Todos los comandos, también los dados de baja. */
  readonly comandos = signal<ComandoCatalogo[]>([]);
  readonly comandosVigentes = computed(() => this.comandos().filter((c) => c.vigente));
  readonly comandoOpciones = computed(() =>
    this.comandos().map((c) => ({ value: c.id, label: `${c.codigo} · ${c.denominacion}` })),
  );

  readonly filtroQuery = signal('');
  readonly filtroComandoId = signal('');
  readonly filtroVigente = signal(VIGENCIA_POR_DEFECTO);
  readonly hayFiltros = computed(
    () => !!this.filtroQuery() || !!this.filtroComandoId() || this.filtroVigente() !== VIGENCIA_POR_DEFECTO,
  );

  readonly vigenteOpciones = [
    { value: 'true', label: 'Vigentes' },
    { value: 'false', label: 'Dadas de baja' },
    { value: '', label: 'Todas' },
  ];

  // ── Pestañas ──
  readonly tab = signal<Tab>('bases');

  // ── Comandos (vienen todos, se filtran y paginan en el front) ──
  readonly filtroComandoQuery = signal('');
  readonly filtroComandoVigente = signal(VIGENCIA_POR_DEFECTO);
  readonly hayFiltrosComandos = computed(
    () => !!this.filtroComandoQuery() || this.filtroComandoVigente() !== VIGENCIA_POR_DEFECTO,
  );
  readonly vigenteComandoOpciones = [
    { value: 'true', label: 'Vigentes' },
    { value: 'false', label: 'Dados de baja' },
    { value: '', label: 'Todos' },
  ];
  readonly comandosFiltrados = computed(() => {
    const texto = normalizar(this.filtroComandoQuery().trim());
    const vigente = this.filtroComandoVigente();
    return this.comandos().filter(
      (c) =>
        (!texto || normalizar(`${c.codigo} ${c.denominacion}`).includes(texto)) &&
        (!vigente || c.vigente === (vigente === 'true')),
    );
  });
  readonly comandosPage = signal(1);
  // Si la página queda vacía, vuelve a la última
  readonly comandosPageActual = computed(() => {
    const ultima = Math.max(1, Math.ceil(this.comandosFiltrados().length / this.pageSize));
    return Math.min(this.comandosPage(), ultima);
  });
  readonly comandosDePagina = computed(() => {
    const desde = (this.comandosPageActual() - 1) * this.pageSize;
    return this.comandosFiltrados().slice(desde, desde + this.pageSize);
  });

  // ── Menú de acciones ──
  readonly menu = signal<MenuAbierto | null>(null);

  // ── Modales ──
  readonly modal = signal<ModalKind>(null);
  readonly formTipo = signal<TipoCatalogo>('base');
  readonly seleccion = signal<Seleccion | null>(null);
  readonly modalError = signal<string | null>(null);
  readonly procesando = signal(false);

  readonly comandoEnEdicion = computed(() => {
    const s = this.seleccion();
    return s?.tipo === 'comando' ? s.item : null;
  });
  readonly baseEnEdicion = computed(() => {
    const s = this.seleccion();
    return s?.tipo === 'base' ? s.item : null;
  });

  /**
   * Motivo por el que la baja va a fallar, para avisarlo antes de pegarle al backend.
   * El backend igual valida (también las relaciones laborales activas, que acá no se ven).
   */
  readonly motivoBloqueoBaja = computed<string | null>(() => {
    const s = this.seleccion();
    if (!s) return null;
    if (s.tipo === 'base' && s.item.total_destinados > 0) {
      const n = s.item.total_destinados;
      return `tiene ${n} ${n === 1 ? 'funcionario' : 'funcionarios'} con destino vigente. Reasignalos antes de darla de baja.`;
    }
    if (s.tipo === 'comando' && s.item.total_bases > 0) {
      const n = s.item.total_bases;
      return `tiene ${n} ${n === 1 ? 'base vigente' : 'bases vigentes'}. Dalas de baja primero.`;
    }
    return null;
  });

  private readonly querySubject = new Subject<void>();

  ngOnInit(): void {
    this.cargar();
    this.cargarComandos();
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

  cargarComandos(): void {
    this.catalogosService.listarComandos().subscribe({
      next: (c) => this.comandos.set(c),
      error: () => this.comandos.set([]),
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
    this.filtroVigente.set(VIGENCIA_POR_DEFECTO);
    this.page.set(1);
    this.cargar();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar();
  }

  cambiarTab(t: Tab): void {
    this.cerrarMenu();
    this.tab.set(t);
  }

  verBasesDeComando(comando: ComandoCatalogo): void {
    this.filtroQuery.set('');
    this.filtroComandoId.set(comando.id);
    this.filtroVigente.set(VIGENCIA_POR_DEFECTO);
    this.page.set(1);
    this.cambiarTab('bases');
    this.cargar();
  }

  onComandoQueryInput(value: string): void {
    this.filtroComandoQuery.set(value);
    this.comandosPage.set(1);
  }

  onComandoVigenteChange(value: string | null): void {
    this.filtroComandoVigente.set(value ?? '');
    this.comandosPage.set(1);
  }

  limpiarFiltrosComandos(): void {
    this.filtroComandoQuery.set('');
    this.filtroComandoVigente.set(VIGENCIA_POR_DEFECTO);
    this.comandosPage.set(1);
  }

  // ── Menú de acciones ──

  toggleMenu(seleccion: Seleccion, event: MouseEvent): void {
    event.stopPropagation();
    if (this.esMenuAbierto(seleccion.tipo, seleccion.item.id)) {
      this.cerrarMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set({ seleccion, top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  // Un comando y una base pueden tener el mismo id
  esMenuAbierto(tipo: Seleccion['tipo'], id: string): boolean {
    const s = this.menu()?.seleccion;
    return !!s && s.tipo === tipo && s.item.id === id;
  }

  cerrarMenu(): void {
    this.menu.set(null);
  }

  accionVerDetalle(s: Seleccion): void {
    this.cerrarMenu();
    if (s.tipo === 'base') this.verDetalle(s.item);
  }

  accionEditar(s: Seleccion): void {
    this.cerrarMenu();
    if (s.tipo === 'comando') this.abrirEditarComando(s.item);
    else this.abrirEditarBase(s.item);
  }

  accionBaja(s: Seleccion): void {
    this.cerrarMenu();
    this.abrirConfirmacion('baja', s);
  }

  accionReactivar(s: Seleccion): void {
    this.cerrarMenu();
    this.abrirConfirmacion('reactivar', s);
  }

  verDetalle(subUnidad: SubUnidadConDestinados): void {
    this.router.navigate(['/destinos/unidades', subUnidad.id]);
  }

  // ── Alta / edición ──

  abrirCrearComando(): void {
    this.abrirForm('comando', null);
  }

  abrirCrearBase(): void {
    this.abrirForm('base', null);
  }

  abrirEditarComando(comando: ComandoCatalogo): void {
    this.abrirForm('comando', { tipo: 'comando', item: comando });
  }

  abrirEditarBase(base: SubUnidadConDestinados): void {
    this.abrirForm('base', { tipo: 'base', item: base });
  }

  private abrirForm(tipo: TipoCatalogo, seleccion: Seleccion | null): void {
    this.formTipo.set(tipo);
    this.seleccion.set(seleccion);
    this.modal.set('form');
  }

  onGuardado(): void {
    const tipo = this.formTipo();
    const editando = this.seleccion() !== null;
    this.toast.success(
      tipo === 'comando'
        ? editando ? 'Comando actualizado' : 'Comando creado'
        : editando ? 'Base actualizada' : 'Base creada',
    );
    this.cerrarModal();
    this.recargarTodo();
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.seleccion.set(null);
    this.modalError.set(null);
    this.procesando.set(false);
  }

  // ── Baja lógica / reactivación ──

  abrirBajaComando(comando: ComandoCatalogo): void {
    this.abrirConfirmacion('baja', { tipo: 'comando', item: comando });
  }

  abrirBajaBase(base: SubUnidadConDestinados): void {
    this.abrirConfirmacion('baja', { tipo: 'base', item: base });
  }

  abrirReactivarComando(comando: ComandoCatalogo): void {
    this.abrirConfirmacion('reactivar', { tipo: 'comando', item: comando });
  }

  abrirReactivarBase(base: SubUnidadConDestinados): void {
    this.abrirConfirmacion('reactivar', { tipo: 'base', item: base });
  }

  private abrirConfirmacion(kind: 'baja' | 'reactivar', seleccion: Seleccion): void {
    this.seleccion.set(seleccion);
    this.modalError.set(null);
    this.modal.set(kind);
  }

  confirmarBaja(): void {
    if (this.motivoBloqueoBaja()) return;
    this.cambiarVigencia(false);
  }

  confirmarReactivar(): void {
    this.cambiarVigencia(true);
  }

  private cambiarVigencia(vigente: boolean): void {
    const s = this.seleccion();
    if (!s) return;
    const op: Observable<unknown> =
      s.tipo === 'comando'
        ? this.catalogosService.editarComando(s.item.id, { vigente })
        : this.catalogosService.editarBase(s.item.id, { vigente });
    const que = s.tipo === 'comando' ? 'Comando' : 'Base';
    const hecho = s.tipo === 'comando' ? (vigente ? 'reactivado' : 'dado de baja') : vigente ? 'reactivada' : 'dada de baja';

    this.procesando.set(true);
    this.modalError.set(null);
    op.subscribe({
      next: () => {
        this.toast.success(`${que} ${hecho}`);
        this.cerrarModal();
        this.recargarTodo();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.modalError.set(parseError(err));
      },
    });
  }

  private recargarTodo(): void {
    this.cargar();
    this.cargarComandos();
  }

  trackSubUnidad = (_: number, s: SubUnidadConDestinados) => s.id;
  trackComando = (_: number, c: ComandoCatalogo) => c.id;
}
