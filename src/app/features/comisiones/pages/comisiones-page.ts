import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounceTime, finalize, of, switchMap } from 'rxjs';
import { ComisionesService } from '../../../core/services/comisiones.service';
import { PersonalService } from '../../../core/services/personal.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AsignacionComision, Comision, ComisionesQuery, ComisionesStats, EditarAsignacionComision } from '../../../core/models/comisiones.models';
import { OPCIONES_FILTRO_CATEGORIA, PersonaListItem } from '../../../core/models/personal.models';
import { parseError } from '../../../shared/utils/parse-error';

type Modal = 'comision' | 'asignacion' | 'cerrar' | 'reabrir' | 'eliminar' | null;

@Component({ selector: 'app-comisiones-page', standalone: false, templateUrl: './comisiones-page.html', styleUrl: './comisiones-page.scss' })
export class ComisionesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ComisionesService);
  private readonly personal = inject(PersonalService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy = inject(DestroyRef);
  readonly catalogo = this.route.snapshot.data['catalogo'] === true;
  readonly comisionId = this.route.snapshot.paramMap.get('comisionId');
  readonly comisionDetalle = signal<Comision | null>(null);
  readonly puedeGestionar = computed(() => this.auth.puedeConAlcance('comisiones.gestionar'));
  readonly puedeGestionarCatalogo = computed(() => this.auth.hasPermiso('comisiones.gestionar'));
  readonly comisiones = signal<Comision[]>([]);
  readonly asignaciones = signal<AsignacionComision[]>([]);
  readonly stats = signal<ComisionesStats>({ total_asignaciones: 0, asignaciones_activas: 0, comisiones_con_personal: 0 });
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly modal = signal<Modal>(null);
  readonly modalError = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly seleccionada = signal<AsignacionComision | null>(null);
  readonly comisionEditada = signal<Comision | null>(null);
  readonly personaElegida = signal<{ id: string; nombre: string } | null>(null);
  readonly personasElegidas = signal<PersonaListItem[]>([]);
  readonly selectorPersona = new FormControl<string | null>(null);
  readonly opcionesPersona = computed(() => this.personas()
    .filter(p => !this.personasElegidas().some(e => e.id === p.id))
    .map(p => ({ id: p.id, label: `${p.nombre} · CI ${p.cedula}` })));
  readonly esLote = computed(() => !this.seleccionada() && this.personasElegidas().length > 1);
  readonly comisionElegida = signal<{ id: string; denominacion: string } | null>(null);
  readonly personas = signal<PersonaListItem[]>([]);
  readonly opcionesComision = signal<Comision[]>([]);
  readonly buscandoPersona = signal(false);
  readonly buscandoComision = signal(false);
  readonly paginaSelector = signal(1);
  readonly totalSelector = signal(0);
  readonly errorSelector = signal<string | null>(null);
  readonly buscandoFiltro = signal(false);
  readonly opcionesFiltro = signal<Comision[]>([]);
  readonly totalFiltro = signal(0);
  readonly paginaFiltro = signal(1);
  readonly comisionFiltroElegida = signal<Comision | null>(null);
  readonly itemsFiltroComision = computed(() => {
    const elegida = this.comisionFiltroElegida();
    return elegida && !this.opcionesFiltro().some(c => c.id === elegida.id)
      ? [elegida, ...this.opcionesFiltro()] : this.opcionesFiltro();
  });
  readonly categoriaOpciones = OPCIONES_FILTRO_CATEGORIA;
  readonly estadoOpciones = [
    { value: '', label: 'Todos los estados' },
    { value: 'true', label: this.catalogo ? 'Vigentes' : 'Abiertas' },
    { value: 'false', label: this.catalogo ? 'Inactivas' : 'Cerradas' },
  ];
  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);
  filtroTexto = '';
  filtroEstado = '';
  filtroCategoria = 'todos';
  filtroComisionId = '';
  filtroComisionTexto = '';
  textoPersona = '';
  textoComision = '';
  fechaCierre = '';
  private readonly recargar = new Subject<void>();
  private readonly buscarTexto = new Subject<void>();
  private readonly buscarPersona = new Subject<string>();
  private readonly buscarComision = new Subject<void>();
  private readonly buscarFiltro = new Subject<void>();
  readonly formComision = this.fb.nonNullable.group({ denominacion: ['', [Validators.required, Validators.maxLength(200)]], vigente: true });
  readonly formAsignacion = this.fb.nonNullable.group({ cargo: ['', Validators.maxLength(200)], fecha_inicio: ['', Validators.required], fecha_fin: '', numero_orden: ['', Validators.maxLength(50)], boletin: ['', Validators.maxLength(50)] });

  constructor() {
    this.recargar.pipe(switchMap(() => {
      this.loading.set(true); this.error.set(null);
      const query = this.query();
      const request: Observable<unknown> = this.catalogo ? this.service.listar(query) : this.service.asignaciones(query);
      return request.pipe(catchError(err => { this.error.set(parseError(err)); return of(null); }));
    }), takeUntilDestroyed(this.destroy)).subscribe(res => {
      if (res) {
        if (this.catalogo) {
          const lista = res as { items: Comision[]; total: number }; this.comisiones.set(lista.items); this.total.set(lista.total);
        } else {
          const lista = res as { items: AsignacionComision[]; total: number; stats: ComisionesStats }; this.asignaciones.set(lista.items); this.total.set(lista.total); this.stats.set(lista.stats);
        }
      }
      this.loading.set(false);
    });
    this.buscarTexto.pipe(debounceTime(300), takeUntilDestroyed(this.destroy)).subscribe(() => this.filtrar());
    this.buscarPersona.pipe(debounceTime(300), switchMap(text => {
      return this.personal.findPaginado({ search: text.trim() || undefined, pageSize: 10, incluir_inactivos: false }).pipe(catchError(err => { this.modalError.set(parseError(err)); return of(null); }));
    }), takeUntilDestroyed(this.destroy)).subscribe(res => { this.personas.set(res?.items ?? []); this.buscandoPersona.set(false); });
    this.selectorPersona.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(id => {
      const persona = this.personas().find(p => p.id === id);
      if (persona) this.elegirPersona(persona);
      this.selectorPersona.setValue(null, { emitEvent: false });
    });
    this.buscarComision.pipe(debounceTime(250), switchMap(() => this.service.listar({ query: this.textoComision.trim(), vigente: true, page: this.paginaSelector(), pageSize: 10 }).pipe(catchError(err => { this.errorSelector.set(parseError(err)); return of(null); }))), takeUntilDestroyed(this.destroy)).subscribe(res => {
      this.opcionesComision.set(res?.items ?? []); this.totalSelector.set(res?.total ?? 0); this.buscandoComision.set(false);
    });
    this.buscarFiltro.pipe(debounceTime(250), switchMap(() => this.service.listar({ query: this.filtroComisionTexto.trim(), page: this.paginaFiltro(), pageSize: 10 }).pipe(catchError(err => { this.error.set(parseError(err)); return of(null); }))), takeUntilDestroyed(this.destroy)).subscribe(res => {
      this.opcionesFiltro.set(res?.items ?? []); this.totalFiltro.set(res?.total ?? 0); this.buscandoFiltro.set(false);
    });
    this.cargar();
    this.cargarDetalle();
    if (!this.catalogo && !this.comisionId) this.filtrarComisiones();
  }
  private query(): ComisionesQuery {
    return { page: this.page(), pageSize: 10, query: this.filtroTexto.trim() || undefined,
      ...(this.catalogo ? { vigente: this.filtroEstado ? this.filtroEstado === 'true' : undefined } : {
        activo: this.filtroEstado ? this.filtroEstado === 'true' : undefined,
        categoria: this.filtroCategoria === 'todos' ? undefined : this.filtroCategoria as 'oficial' | 'subalterno',
        comision_id: this.comisionId ? Number(this.comisionId) : this.filtroComisionId ? Number(this.filtroComisionId) : undefined,
      }),
    };
  }
  cargar() { this.cerrarMenu(); this.recargar.next(); }
  private cargarDetalle() {
    if (this.comisionId) this.service.obtener(this.comisionId).pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: c => this.comisionDetalle.set(c), error: err => this.error.set(parseError(err)) });
  }
  filtrar() { this.page.set(1); this.cargar(); }
  textoCambiado() { this.buscarTexto.next(); }
  cambiarPagina(page: number) { this.page.set(page); this.cargar(); }
  filtrarComisiones(page = 1) { this.paginaFiltro.set(page); this.buscandoFiltro.set(true); this.buscarFiltro.next(); }
  buscarFiltroComision(texto: string) { this.filtroComisionTexto = texto; this.filtrarComisiones(); }
  seleccionarFiltroComision(id: string | null) {
    this.comisionFiltroElegida.set(this.itemsFiltroComision().find(c => c.id === id) ?? null);
    this.filtroComisionId = id ?? ''; this.filtrar();
  }
  hayFiltros() { return !!(this.filtroTexto || this.filtroEstado || this.filtroComisionId || this.filtroCategoria !== 'todos'); }
  filtrosAdicionales() { return Number(!!this.filtroEstado) + Number(!!this.filtroComisionId); }
  limpiarFiltros() {
    this.filtroTexto = ''; this.filtroEstado = ''; this.filtroCategoria = 'todos'; this.filtroComisionId = ''; this.filtroComisionTexto = '';
    this.comisionFiltroElegida.set(null); this.filtrar();
    if (!this.catalogo && !this.comisionId) this.filtrarComisiones();
  }
  categoriaTexto(categoria: AsignacionComision['categoria']) {
    return categoria === 'oficial' ? 'Oficial' : categoria === 'subalterno' ? 'Subalterno' : categoria === 'civil' ? 'Civil' : 'Sin categoría';
  }
  toggleMenu(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.openMenuId() === id) { this.cerrarMenu(); return; }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuPosition.set({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 200)), right: Math.max(8, window.innerWidth - rect.right) });
    this.openMenuId.set(id);
  }
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  cerrarMenu() { this.openMenuId.set(null); this.menuPosition.set(null); }
  abrirComision(c: Comision | null = null) {
    this.cerrarMenu();
    this.comisionEditada.set(c); this.formComision.reset({ denominacion: c?.denominacion ?? '', vigente: c?.vigente ?? true }); this.modalError.set(null); this.modal.set('comision');
  }
  guardarComision() {
    const raw = this.formComision.getRawValue(), denominacion = raw.denominacion.trim();
    if (this.formComision.invalid || !denominacion) { this.formComision.markAllAsTouched(); this.modalError.set('Ingresá una denominación de hasta 200 caracteres'); return; }
    const c = this.comisionEditada();
    this.ejecutar(c ? this.service.editar(c.id, { denominacion, vigente: raw.vigente }) : this.service.crear(denominacion), 'Comisión guardada correctamente');
  }
  abrirAsignacion(a: AsignacionComision | null = null) {
    this.cerrarMenu();
    this.seleccionada.set(a); this.modalError.set(null); this.errorSelector.set(null); this.textoPersona = ''; this.textoComision = ''; this.personas.set([]); this.opcionesComision.set([]);
    this.personaElegida.set(a ? { id: a.persona.id, nombre: `${a.persona.primer_nombre} ${a.persona.primer_apellido}` } : null);
    this.personasElegidas.set([]);
    this.selectorPersona.reset(null, { emitEvent: false });
    this.formAsignacion.controls.cargo.enable({ emitEvent: false });
    this.comisionElegida.set(a?.comision ?? this.comisionDetalle());
    this.formAsignacion.reset({ cargo: a?.cargo ?? '', fecha_inicio: a?.fecha_inicio ?? '', fecha_fin: a?.fecha_fin ?? '', numero_orden: a?.numero_orden ?? '', boletin: a?.boletin ?? '' });
    // Una importada del Access puede seguir sin fecha desde hasta que la FAU la complete.
    const fechaDesde = this.formAsignacion.controls.fecha_inicio;
    if (a?.importada) fechaDesde.clearValidators(); else fechaDesde.setValidators(Validators.required);
    fechaDesde.updateValueAndValidity({ emitEvent: false });
    this.modal.set('asignacion');
    if (!a) this.buscarPersonas();
    if (!a && !this.comisionElegida()) this.buscarComisiones();
  }
  buscarPersonas() { this.personas.set([]); this.buscandoPersona.set(true); this.buscarPersona.next(this.textoPersona); }
  onBuscarPersona(texto: string) { this.textoPersona = texto; this.buscarPersonas(); }
  elegirPersona(p: PersonaListItem) {
    if (this.personasElegidas().some(e => e.id === p.id)) return;
    this.personasElegidas.update(personas => [...personas, p]);
    this.actualizarCargo();
  }
  quitarPersona(id: string) {
    this.personasElegidas.update(personas => personas.filter(p => p.id !== id));
    this.actualizarCargo();
  }
  private actualizarCargo() {
    const control = this.formAsignacion.controls.cargo;
    if (this.esLote()) { control.reset('', { emitEvent: false }); control.disable({ emitEvent: false }); }
    else control.enable({ emitEvent: false });
  }
  buscarComisiones(page = 1) { this.paginaSelector.set(page); this.errorSelector.set(null); this.buscandoComision.set(true); this.buscarComision.next(); }
  elegirComision(c: Comision) { this.comisionElegida.set(c); this.opcionesComision.set([]); }
  cambiarComision() { this.comisionElegida.set(null); this.textoComision = ''; this.buscarComisiones(); }
  guardarAsignacion() {
    const raw = this.formAsignacion.getRawValue(), p = this.personaElegida(), c = this.comisionElegida();
    const tienePersonas = this.seleccionada() ? !!p : this.personasElegidas().length > 0;
    if (!tienePersonas || !c || this.formAsignacion.invalid) { this.modalError.set('Seleccioná al menos una persona, una comisión y una fecha desde válida. El cargo admite hasta 200 caracteres y los documentos hasta 50.'); return; }
    if (!this.seleccionada() && this.personasElegidas().length > 200) { this.modalError.set('Podés asignar hasta 200 personas por lote'); return; }
    const importada = !!this.seleccionada()?.importada;
    if (!importada && !raw.numero_orden.trim() && !raw.boletin.trim()) { this.modalError.set('Ingresá al menos el N.º de orden o el boletín'); return; }
    if (raw.fecha_fin && raw.fecha_inicio && raw.fecha_fin < raw.fecha_inicio) { this.modalError.set('La fecha hasta no puede ser anterior a la fecha desde'); return; }
    const valores = { cargo: this.esLote() ? null : raw.cargo.trim() || null, fecha_inicio: raw.fecha_inicio || null, fecha_fin: raw.fecha_fin || null, numero_orden: raw.numero_orden.trim() || null, boletin: raw.boletin.trim() || null };
    const a = this.seleccionada();
    if (a) {
      const cambios: EditarAsignacionComision = {};
      for (const key of ['cargo', 'fecha_inicio', 'fecha_fin', 'numero_orden', 'boletin'] as const) {
        // La fecha desde no se borra: el backend la exige una vez cargada.
        if (key === 'fecha_inicio' && !valores.fecha_inicio) continue;
        if (valores[key] !== a[key]) Object.assign(cambios, { [key]: valores[key] });
      }
      if (!Object.keys(cambios).length) { this.cerrarModal(); return; }
      this.ejecutar(this.service.editarAsignacion(a.id, cambios), 'Asignación actualizada correctamente');
    } else this.ejecutar(this.service.crearLote({ ...valores, fecha_inicio: raw.fecha_inicio, persona_ids: this.personasElegidas().map(p => Number(p.id)), comision_id: Number(c.id) }), `${this.personasElegidas().length} asignación/es registradas correctamente`);
  }
  abrirAccion(tipo: 'cerrar' | 'reabrir' | 'eliminar', a: AsignacionComision) { this.cerrarMenu(); this.seleccionada.set(a); this.fechaCierre = ''; this.modalError.set(null); this.modal.set(tipo); }
  confirmarAccion() {
    const a = this.seleccionada(); if (!a) return;
    if (this.modal() === 'eliminar') { this.ejecutar(this.service.eliminarAsignacion(a.id), 'Asignación eliminada del historial', true); return; }
    if (this.modal() === 'cerrar' && (!this.fechaCierre || (a.fecha_inicio && this.fechaCierre < a.fecha_inicio))) { this.modalError.set('Ingresá una fecha hasta igual o posterior a la fecha desde'); return; }
    this.ejecutar(this.service.editarAsignacion(a.id, { fecha_fin: this.modal() === 'cerrar' ? this.fechaCierre : null }), 'Asignación actualizada correctamente');
  }
  cerrarModal() { if (!this.guardando()) this.modal.set(null); }
  private ejecutar(operation: Observable<unknown>, mensaje: string, elimina = false) {
    if (this.guardando()) return;
    this.guardando.set(true); this.modalError.set(null);
    operation.pipe(finalize(() => this.guardando.set(false)), takeUntilDestroyed(this.destroy)).subscribe({
      next: () => { this.modal.set(null); this.toast.success(mensaje); if (elimina && this.asignaciones().length === 1 && this.page() > 1) this.page.update(p => p - 1); this.cargar(); this.cargarDetalle(); if (!this.catalogo && !this.comisionId) this.filtrarComisiones(); },
      error: err => this.modalError.set(parseError(err)),
    });
  }
}
