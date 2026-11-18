import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { Observable, Subject, debounceTime, of, switchMap, takeUntil, catchError, map } from 'rxjs';
import {
  CRITERIOS_SUGERENCIA,
  CambioDerecha,
  CriterioSugerencia,
  EscalaDerecha,
  EscalaDerechaResumen,
  Impacto,
  PersonalDerecha,
  ResultadoCambio,
} from '../../../../core/models/derecha.models';
import { DerechaService } from '../../../../core/services/derecha.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PanelImpacto } from '../../../../shared/components/panel-impacto/panel-impacto';
import { parseError } from '../../../../shared/utils/parse-error';

type Campo = 'derecha' | 'numor';


interface Fila extends PersonalDerecha {
  /** Valor que queda con el cambio pendiente (igual al guardado si no cambia). */
  derechaNueva: number | null;
  numorNuevo: number | null;
  cambiaDerecha: boolean;
  cambiaNumor: boolean;
}

const TAMANIO_PAGINA = 10;

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

@Component({
  selector: 'app-configuracion-derecha-page',
  standalone: false,
  templateUrl: './configuracion-derecha-page.html',
  styleUrl: './configuracion-derecha-page.scss',
})
export class ConfiguracionDerechaPage implements OnInit, OnDestroy {
  private readonly derecha = inject(DerechaService);
  private readonly toast = inject(ToastService);

  @ViewChild(PanelImpacto) panel?: PanelImpacto;

  readonly criterios = CRITERIOS_SUGERENCIA;
  readonly tamanioPagina = TAMANIO_PAGINA;

  readonly escalas = signal<EscalaDerechaResumen[]>([]);
  readonly personal = signal<PersonalDerecha[]>([]);
  readonly cargando = signal(true);

  // ─── Filtros ───────────────────────────────────────────────────────────────

  // Vacío = todos.
  readonly filtroEscalas = signal<EscalaDerecha[]>([]);
  readonly filtroGrados = signal<string[]>([]);
  readonly filtroEscalafones = signal<string[]>([]);
  readonly filtroTexto = signal('');
  readonly pagina = signal(1);

  /** Los grados que se ofrecen dependen de las escalas elegidas. */
  readonly opcionesGrado = computed(() =>
    this.escalas()
      .filter((e) => !this.filtroEscalas().length || this.filtroEscalas().includes(e.escala))
      .flatMap((e) => e.grados),
  );

  /** Los escalafones que tiene el personal de las escalas y grados elegidos. */
  readonly opcionesEscalafon = computed(() => {
    const vistos = new Map<string, string>();
    for (const p of this.personal()) {
      if (!this.coincideEscalaYGrado(p)) continue;
      vistos.set(p.escalafon_id, p.escalafon ?? p.escalafon_id);
    }
    return [...vistos].map(([id, codigo]) => ({ id, codigo })).sort((a, b) => a.codigo.localeCompare(b.codigo));
  });

  readonly hayFiltros = computed(
    () =>
      !!(this.filtroEscalas().length || this.filtroGrados().length || this.filtroEscalafones().length || this.filtroTexto()),
  );

  readonly filtrados = computed(() => {
    const texto = normalizar(this.filtroTexto());
    const escalafones = this.filtroEscalafones();
    return this.personal().filter(
      (p) =>
        this.coincideEscalaYGrado(p) &&
        (!escalafones.length || escalafones.includes(p.escalafon_id)) &&
        (!texto || normalizar(p.nombre).includes(texto) || p.cedula.includes(texto)),
    );
  });

  readonly filas = computed<Fila[]>(() => {
    const desde = (this.pagina() - 1) * TAMANIO_PAGINA;
    const escritos = this.escritos();
    const nuevos = this.nuevos();
    return this.filtrados()
      .slice(desde, desde + TAMANIO_PAGINA)
      .map((p) => {
        const escrito = escritos.get(p.persona_id);
        const n = nuevos.get(p.persona_id);
        const derechaNueva = escrito?.derecha ?? (n && 'derecha' in n ? n.derecha! : p.derecha);
        const numorNuevo = escrito?.numor ?? (n && 'numor' in n ? n.numor! : p.numor);
        return {
          ...p,
          derechaNueva,
          numorNuevo,
          cambiaDerecha: derechaNueva !== p.derecha,
          cambiaNumor: numorNuevo !== p.numor,
        };
      });
  });

  /** Con un único grado elegido en el filtro se ofrece "Sugerir orden". */
  readonly gradoFiltrado = computed(() => {
    const ids = this.filtroGrados();
    return ids.length === 1 ? (this.escalas().flatMap((e) => e.grados).find((g) => g.id === ids[0]) ?? null) : null;
  });

  // ─── Cambios pendientes ────────────────────────────────────────────────────

  /** Se aplican en este orden, cada uno sobre lo que dejó el anterior, y se guardan juntos. */
  readonly cambios = signal<CambioDerecha[]>([]);
  /** Lo recién escrito, para mostrarlo mientras llega la previsualización. */
  private readonly escritos = signal(new Map<string, { derecha?: number; numor?: number }>());
  readonly impacto = signal<Impacto | null>(null);
  readonly calculando = signal(false);
  readonly errorImpacto = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly errorValor = signal<{ persona_id: string; campo: Campo; mensaje: string } | null>(null);

  readonly hayCambios = computed(() => this.cambios().length > 0);

  /** Derecha y numor que quedan para cada funcionario que corren los cambios, según la previsualización. */
  private readonly nuevos = computed(() => {
    const m = new Map<string, { derecha?: number | null; numor?: number | null }>();
    for (const a of this.impacto()?.derecha ?? []) if (a.persona_id) m.set(a.persona_id, { derecha: a.despues });
    for (const a of this.impacto()?.numor ?? [])
      if (a.persona_id) m.set(a.persona_id, { ...m.get(a.persona_id), numor: a.despues });
    return m;
  });

  private readonly preview$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.preview$
      .pipe(
        debounceTime(250),
        switchMap(() => this.calcularImpacto()),
        takeUntil(this.destroy$),
      )
      .subscribe((r) => {
        this.calculando.set(false);
        this.escritos.set(new Map());
        if (r.error) {
          // El último paso no se pudo aplicar: se descarta y se vuelve a lo anterior.
          this.toast.error(r.error);
          this.cambios.update((c) => c.slice(0, -1));
          this.previsualizar();
          return;
        }
        if (r.impacto?.afectados === 0) {
          // Se volvió a dejar todo como estaba.
          this.cambios.set([]);
          this.impacto.set(null);
          return;
        }
        this.impacto.set(r.impacto);
        this.errorImpacto.set(null);
      });

    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.derecha.listarEscalas().subscribe({
      next: (e) => this.escalas.set(e),
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
    });
    this.derecha.listarPersonal().subscribe({
      next: (p) => {
        this.personal.set(p);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  // ─── Filtros ───────────────────────────────────────────────────────────────

  private coincideEscalaYGrado(p: PersonalDerecha): boolean {
    const escalas = this.filtroEscalas();
    const grados = this.filtroGrados();
    return (!escalas.length || escalas.includes(p.escala)) && (!grados.length || grados.includes(p.grado_id));
  }

  onEscalas(valor: EscalaDerecha[] | null): void {
    this.filtroEscalas.set(valor ?? []);
    // Se sueltan los grados y escalafones que quedaron fuera de las escalas elegidas.
    const grados = new Set(this.opcionesGrado().map((g) => g.id));
    this.filtroGrados.update((ids) => ids.filter((id) => grados.has(id)));
    this.limpiarEscalafonesSinOpcion();
    this.pagina.set(1);
  }

  onGrados(valor: string[] | null): void {
    this.filtroGrados.set(valor ?? []);
    this.limpiarEscalafonesSinOpcion();
    this.pagina.set(1);
  }

  onEscalafones(valor: string[] | null): void {
    this.filtroEscalafones.set(valor ?? []);
    this.pagina.set(1);
  }

  private limpiarEscalafonesSinOpcion(): void {
    const escalafones = new Set(this.opcionesEscalafon().map((e) => e.id));
    this.filtroEscalafones.update((ids) => ids.filter((id) => escalafones.has(id)));
  }

  onTexto(event: Event): void {
    this.filtroTexto.set((event.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  limpiarFiltros(): void {
    this.filtroEscalas.set([]);
    this.filtroGrados.set([]);
    this.filtroEscalafones.set([]);
    this.filtroTexto.set('');
    this.pagina.set(1);
  }

  // ─── Edición ───────────────────────────────────────────────────────────────

  /** Bloque de derecha del grado del funcionario, o 1..M de su grupo de numor. */
  private rango(f: PersonalDerecha, campo: Campo): { desde: number; hasta: number } {
    const todos = this.personal();
    if (campo === 'numor') {
      const grupo = todos.filter((p) => p.grado_id === f.grado_id && p.escalafon_id === f.escalafon_id);
      return { desde: 1, hasta: grupo.length };
    }
    const grado = todos.filter((p) => p.grado_id === f.grado_id);
    const desde = Math.min(...grado.map((p) => p.derecha ?? Infinity));
    const inicio = Number.isFinite(desde) ? desde : 1;
    return { desde: inicio, hasta: inicio + grado.length - 1 };
  }

  /**
   * Se escribe la derecha (o el numor) nueva del funcionario: queda en ese lugar
   * y los de su grado (o su grupo) que estaban en el medio se corren uno.
   */
  onValor(f: Fila, campo: Campo, event: Event): void {
    const input = event.target as HTMLInputElement;
    const actual = campo === 'derecha' ? f.derechaNueva : f.numorNuevo;
    const restaurar = () => (input.value = String(actual ?? ''));
    const valor = Number(input.value);
    const { desde, hasta } = this.rango(f, campo);

    if (!input.value || !Number.isInteger(valor) || valor < desde || valor > hasta) {
      this.errorValor.set({
        persona_id: f.persona_id,
        campo,
        mensaje: `${campo === 'derecha' ? 'La derecha' : 'El numor'} de ${f.grado}${campo === 'numor' ? ` ${f.escalafon ?? ''}` : ''} va de ${desde} a ${hasta}.`,
      });
      restaurar();
      return;
    }
    this.errorValor.set(null);
    if (valor === actual) return;

    this.escritos.update((m) => new Map(m).set(f.persona_id, { ...m.get(f.persona_id), [campo]: valor }));
    this.cambios.update((c) => [...c, { persona_id: Number(f.persona_id), [campo]: valor }]);
    this.previsualizar();
  }

  onSugerir(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const criterio = select.value as CriterioSugerencia;
    select.value = '';
    const grado = this.gradoFiltrado();
    if (!criterio || !grado) return;
    this.derecha.sugerirOrden(grado.id, criterio).subscribe({
      next: (s) => {
        this.cambios.update((c) => [...c, { grado_id: Number(grado.id), orden: s.orden.map(Number) }]);
        this.previsualizar();
        const sinDatos = s.sin_datos.length ? ` Sin fecha: ${s.sin_datos.join(', ')}.` : '';
        this.toast.success(`Orden sugerido aplicado a ${grado.denominacion}. Revisalo antes de guardar.${sinDatos}`);
      },
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
    });
  }

  private previsualizar(): void {
    this.errorImpacto.set(null);
    if (!this.cambios().length) {
      this.impacto.set(null);
      this.calculando.set(false);
      return;
    }
    this.calculando.set(true);
    this.preview$.next();
  }

  descartar(): void {
    this.errorValor.set(null);
    this.escritos.set(new Map());
    this.cambios.set([]);
    this.previsualizar();
  }

  confirmar(motivo: string): void {
    if (!this.cambios().length) return;
    this.confirmando.set(true);
    this.derecha.aplicarCambios({ cambios: this.cambios(), motivo: motivo || undefined }).subscribe({
      next: (r: ResultadoCambio) => {
        this.confirmando.set(false);
        this.panel?.limpiarMotivo();
        this.toast.success(`Cambios guardados: ${r.afectados} ${r.afectados === 1 ? 'funcionario' : 'funcionarios'}.`);
        this.cambios.set([]);
        this.previsualizar();
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.confirmando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  private calcularImpacto(): Observable<{ impacto: Impacto | null; error: string | null }> {
    const cambios = this.cambios();
    if (!cambios.length) return of({ impacto: null, error: null });
    return this.derecha.previsualizar({ operacion: 'REORDEN', cambios }).pipe(
      map((impacto) => ({ impacto, error: null })),
      catchError((err: HttpErrorResponse) => of({ impacto: null, error: parseError(err) })),
    );
  }

  trackFila = (_: number, f: Fila) => f.persona_id;
}
