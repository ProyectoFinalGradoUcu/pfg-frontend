import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, merge, of, switchMap, takeUntil } from 'rxjs';
import {
  BaseOpcion,
  CandidatoFamiliar,
  FamiliarEntry,
  GradoItem,
  OpcionSelect,
  NIVELES_EDUCATIVOS,
  NIVELES_IDONEIDAD,
} from '../../../../core/models/personal.models';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { DerechaService } from '../../../../core/services/derecha.service';
import { Impacto } from '../../../../core/models/derecha.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { requeridoSinEspacios, validadorCedula } from '../../../../shared/utils/validadores';
import { ESPERA_BUSQUEDA_MS } from '../../../../shared/utils/espera-busqueda';

/**
 * La relación laboral no puede empezar antes de que la
 * persona haya nacido. Las fechas vienen del input date como 'AAAA-MM-DD', así
 * que se comparan como texto.
 */
function inicioPosteriorANacimiento(group: AbstractControl): ValidationErrors | null {
  if (group.get('es_civil')?.value) return null;
  const nacimiento: string = group.get('fecha_nacimiento')?.value;
  const inicio: string = group.get('fecha_inicio')?.value;
  if (!nacimiento || !inicio) return null;
  return inicio < nacimiento ? { inicioAntesDeNacimiento: true } : null;
}

/** El egreso de la ETA no puede ser anterior al ingreso. */
function egresoEtaPosteriorAIngreso(group: AbstractControl): ValidationErrors | null {
  // Los datos de ETA solo se cargan (y se mandan) para el personal subalterno.
  if (group.get('tipo_funcionario')?.value !== 'subalterno') return null;
  const ingreso: string = group.get('fecha_ingreso_eta')?.value;
  const egreso: string = group.get('fecha_egreso_eta')?.value;
  if (!ingreso || !egreso) return null;
  return egreso < ingreso ? { etaInconsistente: true } : null;
}

export type TipoPersonal = 'oficial' | 'subalterno' | 'civil';
export type SeccionAlta =
  'tipo' | 'identificacion' | 'personales' | 'contacto' | 'laborales' | 'escalafon' | 'formacion' | 'familiares';

interface SeccionAltaDef { key: SeccionAlta; titulo: string }
interface Pendiente { label: string; control: string | null; seccion: SeccionAlta }

/** Obligatorios de cada sección para un militar. El civil solo tiene los de identificación y un familiar. */
const OBLIGATORIOS: Partial<Record<SeccionAlta, { control: string; label: string }[]>> = {
  identificacion: [
    { control: 'cedula', label: 'Cédula' },
    { control: 'primer_nombre', label: 'Primer nombre' },
    { control: 'primer_apellido', label: 'Primer apellido' },
  ],
  laborales: [
    { control: 'fecha_inicio', label: 'Fecha de inicio' },
    { control: 'situacion_id', label: 'Situación' },
    { control: 'regimen_id', label: 'Régimen' },
    { control: 'programa_id', label: 'Programa' },
    { control: 'sub_unidad_id', label: 'Base' },
  ],
  escalafon: [
    { control: 'escalafon_id', label: 'Escalafón' },
    { control: 'grado_id', label: 'Grado' },
  ],
};

@Component({
  selector: 'app-nuevo-personal-page',
  standalone: false,
  templateUrl: './nuevo-personal-page.html',
  styleUrl: './nuevo-personal-page.scss',
})
export class NuevoPersonalPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly auth = inject(AuthService);
  private readonly derecha = inject(DerechaService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // ─── Estado general ──────────────────────────────────────────────────────────
  readonly loading = signal(false);

  // ─── Dropdowns catálogos ─────────────────────────────────────────────────────
  readonly regimenes   = signal<OpcionSelect[]>([]);
  readonly escalafones = signal<OpcionSelect[]>([]);
  readonly grados      = signal<GradoItem[]>([]);
  readonly programas   = signal<OpcionSelect[]>([]);
  readonly situaciones = signal<OpcionSelect[]>([]);
  private readonly todasLasBases = signal<BaseOpcion[]>([]);

  /** Con alcance de unidad solo se puede dar de alta en las bases propias. */
  readonly bases = computed(() => {
    const todas = this.todasLasBases();
    if (this.auth.alcanceDe('personas.crear') !== 'unidad') return todas;
    const propias = new Set(this.auth.currentUser()?.unidades.map((u) => u.id) ?? []);
    return todas.filter((b) => propias.has(String(b.id)));
  });

  // ─── Derecha y numor ─────────────────────────────────────────────────────────
  readonly puedeElegirPosicion = computed(() => this.auth.hasPermiso('derecha.gestionar'));
  readonly gradoElegido     = signal<number | null>(null);
  readonly escalafonElegido = signal<number | null>(null);
  /** null = al final del grado / del grupo. */
  readonly posicionDerecha  = signal<number | null>(null);
  readonly posicionNumor    = signal<number | null>(null);
  readonly impactoAlta      = signal<Impacto | null>(null);
  readonly calculandoAlta   = signal(false);
  readonly errorAlta        = signal<string | null>(null);
  private readonly impactoAlta$ = new Subject<void>();

  // ─── Familiares (civil) ───────────────────────────────────────────────────────
  readonly familiares       = signal<FamiliarEntry[]>([]);
  readonly familiaresError  = signal(false);

  // ─── Autocomplete búsqueda de familiar ───────────────────────────────────────
  readonly familiarSearch       = signal('');
  readonly familiarResults      = signal<CandidatoFamiliar[]>([]);
  readonly familiarDropdownOpen = signal(false);

  // ─── Opciones estáticas ───────────────────────────────────────────────────────
  readonly generoOpciones = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
    { value: 'O', label: 'Otro' },
  ];
  readonly estadoCivilOpciones = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'];
  readonly tipoFuncionarioOpciones = [
    { value: 'oficial',    label: 'Oficial' },
    { value: 'subalterno', label: 'Subalterno' },
  ];
  readonly tipoRelacionOpciones = ['Cónyuge', 'Padre', 'Madre', 'Hijo/a', 'Hermano/a', 'Otro'];
  readonly nivelesIdoneidad = NIVELES_IDONEIDAD;
  readonly nivelEducativoOpciones = NIVELES_EDUCATIVOS;
  readonly tiposPersonal: { value: TipoPersonal; label: string; descripcion: string }[] = [
    { value: 'oficial',    label: 'Oficial',             descripcion: 'Personal superior. Habilita el campo Códigos.' },
    { value: 'subalterno', label: 'Personal subalterno', descripcion: 'Habilita datos de ETA y nivel de idoneidad.' },
    { value: 'civil',      label: 'Personal civil',      descripcion: 'Funcionario civil de la FAU. Sin datos laborales; requiere al menos un familiar militar.' },
  ];

  // ─── Formulario ───────────────────────────────────────────────────────────────
  readonly form: FormGroup = this.fb.group({
    cedula:           ['', [Validators.required, validadorCedula]],
    primer_nombre:    ['', requeridoSinEspacios],
    segundo_nombre:   [''],
    primer_apellido:  ['', requeridoSinEspacios],
    segundo_apellido: [''],
    fecha_nacimiento: [''],
    genero:           [''],
    estado_civil:     [''],
    lugar_nacimiento: [''],
    etnia:            [''],
    codigo_postal:    ['', Validators.maxLength(10)],
    seccional:        [''],
    credencial_civica: [''],
    email:            ['', Validators.email],
    telefono:         [''],
    direccion:        [''],
    es_civil:         [false],
    // Datos laborales — requeridos sólo cuando no es civil
    tipo_funcionario: ['', Validators.required],
    regimen_id:       [null, Validators.required],
    escalafon_id:     [null, Validators.required],
    grado_id:         [{ value: null, disabled: true }, Validators.required],
    programa_id:      [null, Validators.required],
    situacion_id:     [null, Validators.required],
    sub_unidad_id:    [null, Validators.required],
    fecha_inicio:     ['', Validators.required],
    prima_tecnica:    [''],
    tiene_mando:      [false],
    // Datos del subalterno (nivel ETA) y del legajo (oficial)
    nivel_idoneidad:  [null],
    codigos_legajo:   [''],
    // Legajo militar (oficiales y subalternos); ETA y mutación, solo subalternos
    nivel_educativo:         [''],
    fecha_ingreso_eta:       [''],
    fecha_egreso_eta:        [''],
    numero_orden_egreso_eta: ['', Validators.maxLength(50)],
    mutaciones:              [''],
    observaciones:    [''],
  }, { validators: [inicioPosteriorANacimiento, egresoEtaPosteriorAIngreso] });

  private readonly destroy$        = new Subject<void>();
  private readonly familiarSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.loadDropdowns();
    this.setupEscalafonCascade();
    this.setupCivilToggle();
    this.setupFamiliarSearch();
    this.setupDerecha();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────────

  private loadDropdowns(): void {
    this.personalService.getRegimenes().subscribe({ next: d => this.regimenes.set(d) });
    this.personalService.getEscalafones().subscribe({ next: d => this.escalafones.set(d) });
    this.personalService.getProgramas().subscribe({ next: d => this.programas.set(d) });
    this.personalService.getSituaciones().subscribe({ next: d => this.situaciones.set(d) });
    this.personalService.getBases().subscribe({ next: d => this.todasLasBases.set(d) });
  }

  private setupEscalafonCascade(): void {
    this.form.get('escalafon_id')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id: number | null) => {
        const gradoCtrl = this.form.get('grado_id')!;
        gradoCtrl.reset(null);
        this.grados.set([]);
        if (id && !this.form.get('es_civil')!.value) {
          gradoCtrl.enable();
          this.personalService.getGrados(Number(id)).subscribe({
            next: data => this.grados.set(data),
            error: () => gradoCtrl.disable(),
          });
        } else {
          gradoCtrl.disable();
        }
      });
  }

  private setupDerecha(): void {
    merge(this.form.get('grado_id')!.valueChanges, this.form.get('escalafon_id')!.valueChanges)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const raw = this.form.getRawValue();
        this.gradoElegido.set(raw.grado_id ? Number(raw.grado_id) : null);
        this.escalafonElegido.set(raw.escalafon_id ? Number(raw.escalafon_id) : null);
        this.posicionDerecha.set(null);
        this.posicionNumor.set(null);
        this.impactoAlta$.next();
      });

    this.impactoAlta$
      .pipe(
        debounceTime(250),
        switchMap(() => {
          const grado = this.gradoElegido();
          const escalafon = this.escalafonElegido();
          if (!grado || !escalafon) return of({ impacto: null, error: null });
          this.calculandoAlta.set(true);
          return this.derecha
            .previsualizar({
              operacion: 'ALTA',
              grado_id: grado,
              escalafon_id: escalafon,
              posicion: this.posicionDerecha() ?? undefined,
              posicion_numor: this.posicionNumor() ?? undefined,
            })
            .pipe(
              map((impacto) => ({ impacto, error: null as string | null })),
              catchError((err: HttpErrorResponse) => of({ impacto: null, error: parseError(err) })),
            );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((r) => {
        this.calculandoAlta.set(false);
        this.impactoAlta.set(r.impacto);
        this.errorAlta.set(r.error);
      });
  }

  onPosicionDerecha(posicion: number | null): void {
    this.posicionDerecha.set(posicion);
    this.impactoAlta$.next();
  }

  onPosicionNumor(posicion: number | null): void {
    this.posicionNumor.set(posicion);
    this.impactoAlta$.next();
  }

  private setupCivilToggle(): void {
    this.form.get('es_civil')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((esCivil: boolean) => {
        this.toggleCivilMode(esCivil);
        if (!esCivil) {
          this.familiaresError.set(false);
        }
      });
  }

  private setupFamiliarSearch(): void {
    this.familiarSearch$
      .pipe(debounceTime(ESPERA_BUSQUEDA_MS), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(term => {
        if (!term || term.length < 2) {
          this.familiarResults.set([]);
          return;
        }
        // Militares en actividad y civiles: cualquiera puede ser familiar.
        this.personalService
          .buscarCandidatosFamiliar(term)
          .subscribe({ next: candidatos => this.familiarResults.set(candidatos) });
      });
  }

  private toggleCivilMode(esCivil: boolean): void {
    const laboralRequired = [
      'tipo_funcionario', 'regimen_id', 'escalafon_id',
      'sub_unidad_id', 'programa_id', 'situacion_id', 'fecha_inicio',
    ];
    if (esCivil) {
      laboralRequired.forEach(f => {
        const ctrl = this.form.get(f)!;
        ctrl.clearValidators();
        ctrl.updateValueAndValidity({ emitEvent: false });
      });
      const gradoCtrl = this.form.get('grado_id')!;
      gradoCtrl.clearValidators();
      gradoCtrl.disable();
      gradoCtrl.updateValueAndValidity({ emitEvent: false });
    } else {
      laboralRequired.forEach(f => {
        const ctrl = this.form.get(f)!;
        ctrl.setValidators(Validators.required);
        ctrl.updateValueAndValidity({ emitEvent: false });
      });
      const gradoCtrl = this.form.get('grado_id')!;
      gradoCtrl.setValidators(Validators.required);
      // Si ya hay escalafón, el grado vuelve a quedar elegible con sus grados.
      const escalafonId = this.form.get('escalafon_id')!.value;
      if (escalafonId) {
        gradoCtrl.enable({ emitEvent: false });
        this.personalService.getGrados(Number(escalafonId)).subscribe({
          next: data => this.grados.set(data),
          error: () => gradoCtrl.disable({ emitEvent: false }),
        });
      } else {
        gradoCtrl.disable({ emitEvent: false });
      }
      gradoCtrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  // ─── Tipo de personal ─────────────────────────────────────────────────────────

  /** Civil, oficial o subalterno; '' mientras no se eligió. */
  tipoPersonal(): TipoPersonal | '' {
    if (this.form.get('es_civil')!.value) return 'civil';
    return (this.form.get('tipo_funcionario')!.value as TipoPersonal) || '';
  }

  esCivil(): boolean {
    return !!this.form.get('es_civil')!.value;
  }

  elegirTipo(tipo: TipoPersonal): void {
    if (tipo === 'civil') {
      this.form.patchValue({ tipo_funcionario: '' });
      this.form.get('es_civil')!.setValue(true);
    } else {
      if (this.esCivil()) this.form.get('es_civil')!.setValue(false);
      this.form.get('tipo_funcionario')!.setValue(tipo);
    }
  }

  // ─── Secciones y obligatorios ─────────────────────────────────────────────────

  seccionesVisibles(): SeccionAltaDef[] {
    const civil = this.esCivil();
    return [
      { key: 'tipo', titulo: 'Tipo de personal' },
      { key: 'identificacion', titulo: 'Identificación' },
      { key: 'personales', titulo: 'Datos personales' },
      { key: 'contacto', titulo: 'Contacto' },
      ...(civil ? [] : [
        { key: 'laborales' as const, titulo: 'Datos laborales' },
        { key: 'escalafon' as const, titulo: 'Escalafón y derecha' },
        { key: 'formacion' as const, titulo: 'Formación' },
      ]),
      { key: 'familiares', titulo: 'Familiares' },
    ];
  }

  numeroSeccion(key: SeccionAlta): number {
    return this.seccionesVisibles().findIndex((s) => s.key === key) + 1;
  }

  /** Cada obligatorio de la sección, cumplido o no. */
  private obligatoriosDe(seccion: SeccionAlta): { pendiente: boolean; item: Pendiente }[] {
    if (seccion === 'tipo') {
      return [{ pendiente: !this.tipoPersonal(), item: { label: 'Tipo de personal', control: null, seccion } }];
    }
    if (seccion === 'familiares') {
      return this.esCivil()
        ? [{ pendiente: this.faltaFamiliarMilitar(), item: { label: 'Un familiar militar', control: null, seccion } }]
        : [];
    }
    if (this.esCivil() && seccion !== 'identificacion') return [];
    return (OBLIGATORIOS[seccion] ?? []).map(({ control, label }) => {
      const ctrl = this.form.get(control)!;
      // Un control deshabilitado (el grado sin escalafón) no es inválido para Angular: cuenta su valor.
      const pendiente = ctrl.disabled ? ctrl.value == null || ctrl.value === '' : ctrl.invalid;
      return { pendiente, item: { label, control, seccion } };
    });
  }

  pendientesDe(seccion: SeccionAlta): number {
    return this.obligatoriosDe(seccion).filter((o) => o.pendiente).length;
  }

  tieneObligatorios(seccion: SeccionAlta): boolean {
    return this.obligatoriosDe(seccion).length > 0;
  }

  pendientes(): Pendiente[] {
    return this.seccionesVisibles().flatMap((s) =>
      this.obligatoriosDe(s.key).filter((o) => o.pendiente).map((o) => o.item),
    );
  }

  totalObligatorios(): number {
    return this.seccionesVisibles().reduce((n, s) => n + this.obligatoriosDe(s.key).length, 0);
  }

  obligatoriosCompletos(): number {
    return this.totalObligatorios() - this.pendientes().length;
  }

  irASeccion(key: SeccionAlta): void {
    this.host.nativeElement.querySelector(`#alta-${key}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  irAPendiente(p: Pendiente): void {
    const campo = p.control ? this.host.nativeElement.querySelector<HTMLElement>(`#${p.control}`) : null;
    if (campo) {
      campo.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      campo.focus({ preventScroll: true });
    } else {
      this.irASeccion(p.seccion);
    }
  }

  etaInconsistente(): boolean {
    return !!this.form.errors?.['etaInconsistente'];
  }

  /** Edad para mostrar bajo la fecha de nacimiento. */
  edad(): number | null {
    const iso: string = this.form.get('fecha_nacimiento')?.value;
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const hoy = new Date();
    let anios = hoy.getFullYear() - y;
    if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios--;
    return anios >= 0 ? anios : null;
  }

  // ─── Gestión de familiares ────────────────────────────────────────────────────

  onFamiliarSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.familiarSearch.set(val);
    this.familiarDropdownOpen.set(true);
    this.familiarSearch$.next(val);
  }

  onFamiliarBlur(): void {
    setTimeout(() => this.familiarDropdownOpen.set(false), 200);
  }

  addFamiliar(persona: CandidatoFamiliar): void {
    const yaAgregado = this.familiares().some(f => f.persona.cedula === persona.cedula);
    if (yaAgregado) return;
    this.familiares.update(list => [...list, { persona, tipo_relacion: '' }]);
    // El error se va recién cuando hay un militar: un civil solo con familiares civiles no alcanza.
    if (this.familiaresError()) this.familiaresError.set(this.faltaFamiliarMilitar());
    // Limpiar búsqueda para agregar otro
    this.familiarSearch.set('');
    this.familiarResults.set([]);
    this.familiarDropdownOpen.set(false);
  }

  /** Un civil necesita al menos un familiar militar: es lo que justifica que esté en el sistema. */
  faltaFamiliarMilitar(): boolean {
    return this.esCivil() && !this.familiares().some(f => !f.persona.es_civil);
  }

  removeFamiliar(index: number): void {
    this.familiares.update(list => list.filter((_, i) => i !== index));
  }

  trackByFamiliarCedula(_index: number, f: FamiliarEntry): string {
    return f.persona.cedula;
  }

  updateTipoRelacion(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.familiares.update(list =>
      list.map((f, i) => i === index ? { ...f, tipo_relacion: value } : f)
    );
  }

  // ─── Helpers de formulario ────────────────────────────────────────────────────

  hasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  /** Error de a pares: vive en el grupo, se muestra bajo la fecha de inicio. */
  fechaInicioAntesDeNacimiento(): boolean {
    if (!this.form.errors?.['inicioAntesDeNacimiento']) return false;
    return !!(this.form.get('fecha_inicio')?.touched || this.form.get('fecha_nacimiento')?.touched);
  }

  /** Tope inferior del datepicker de fecha de inicio. */
  minFechaInicio(): string | null {
    return this.form.get('fecha_nacimiento')?.value || null;
  }

  getError(name: string): string {
    const errors = this.form.get(name)?.errors;
    if (!errors) return '';
    if (errors['cedulaDuplicada']) return 'Ya existe un funcionario con esta cédula';
    if (errors['required'])        return 'Este campo es obligatorio';
    if (errors['email'])           return 'Ingresá un email válido';
    if (errors['pattern'] && name === 'cedula') return 'Entre 6 y 9 dígitos, sin puntos ni guión';
    if (errors['maxlength'])       return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Valor inválido';
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────────

  cancelar(): void {
    this.router.navigate(['/personal']);
  }

  submit(): void {
    this.form.markAllAsTouched();
    const esCivil: boolean = this.form.get('es_civil')!.value;

    if (this.faltaFamiliarMilitar()) {
      this.familiaresError.set(true);
    }

    if (this.form.invalid || this.faltaFamiliarMilitar()) {
      const primero = this.pendientes()[0];
      if (primero) this.irAPendiente(primero);
      return;
    }

    this.loading.set(true);
    const raw = this.form.getRawValue();

    const payload: Record<string, unknown> = {
      cedula:          raw.cedula.trim(),
      primer_nombre:   raw.primer_nombre.trim(),
      primer_apellido: raw.primer_apellido.trim(),
      es_civil:        esCivil,
      ...(raw.segundo_nombre   && { segundo_nombre:   raw.segundo_nombre }),
      ...(raw.segundo_apellido && { segundo_apellido: raw.segundo_apellido }),
      ...(raw.fecha_nacimiento && { fecha_nacimiento: raw.fecha_nacimiento }),
      ...(raw.genero           && { genero:           raw.genero }),
      ...(raw.estado_civil     && { estado_civil:     raw.estado_civil }),
      ...(raw.lugar_nacimiento && { lugar_nacimiento: raw.lugar_nacimiento }),
      ...(raw.etnia            && { etnia:            raw.etnia }),
      ...(raw.codigo_postal    && { codigo_postal:    raw.codigo_postal }),
      ...(raw.seccional        && { seccional:        raw.seccional }),
      ...(raw.credencial_civica && { credencial_civica: raw.credencial_civica }),
      ...(raw.email            && { email:            raw.email }),
      ...(raw.telefono         && { telefono:         raw.telefono }),
      ...(raw.direccion        && { direccion:        raw.direccion }),
      // Van a la relación laboral: el civil no tiene, así que no se mandan.
      ...(!esCivil && raw.observaciones && { observaciones: raw.observaciones }),
    };

    if (this.familiares().length > 0) {
      payload['familiares'] = this.familiares().map(f => ({
        cedula: f.persona.cedula,
        ...(f.tipo_relacion && { tipo_relacion: f.tipo_relacion }),
      }));
    }

    if (!esCivil) {
      payload['tipo_funcionario'] = raw.tipo_funcionario;
      payload['regimen_id']       = Number(raw.regimen_id);
      payload['escalafon_id']     = Number(raw.escalafon_id);
      if (raw.grado_id != null) payload['grado_id'] = Number(raw.grado_id);
      payload['programa_id']      = Number(raw.programa_id);
      payload['situacion_id']     = Number(raw.situacion_id);
      payload['fecha_inicio']     = raw.fecha_inicio;
      payload['tiene_mando']      = !!raw.tiene_mando;
      payload['sub_unidad_id']    = Number(raw.sub_unidad_id);
      if (raw.prima_tecnica) payload['prima_tecnica'] = raw.prima_tecnica;
      if (this.posicionDerecha() !== null) payload['posicion_derecha'] = this.posicionDerecha();
      if (this.posicionNumor() !== null) payload['posicion_numor'] = this.posicionNumor();
      if (raw.nivel_idoneidad != null && raw.tipo_funcionario === 'subalterno') {
        payload['nivel_idoneidad'] = raw.nivel_idoneidad;
      }
      if (raw.codigos_legajo && raw.tipo_funcionario === 'oficial') {
        payload['codigos_legajo'] = raw.codigos_legajo;
      }
      if (raw.nivel_educativo) payload['nivel_educativo'] = raw.nivel_educativo;
      // ETA y mutación son del personal subalterno.
      if (raw.tipo_funcionario === 'subalterno') {
        if (raw.fecha_ingreso_eta) payload['fecha_ingreso_eta'] = raw.fecha_ingreso_eta;
        if (raw.fecha_egreso_eta) payload['fecha_egreso_eta'] = raw.fecha_egreso_eta;
        if (raw.numero_orden_egreso_eta?.trim()) payload['numero_orden_egreso_eta'] = raw.numero_orden_egreso_eta.trim();
        if (raw.mutaciones?.trim()) payload['mutaciones'] = raw.mutaciones.trim();
      }
    }

    this.personalService.crear(payload as never).subscribe({
      next: () => {
        this.toast.success('Personal creado exitosamente');
        this.router.navigate(['/personal']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.form.get('cedula')!.setErrors({ cedulaDuplicada: true });
          this.form.get('cedula')!.markAsTouched();
        } else if (err.status === 400 || err.status === 403) {
          // 400 acá no es solo validación de formulario: incluye reglas de negocio como
          // "solo podés dar de alta personal en tus propias bases".
          this.errorModal.show(parseError(err));
        } else {
          this.toast.error(parseError(err));
        }
      },
    });
  }
}
