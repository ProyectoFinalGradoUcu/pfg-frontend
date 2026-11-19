import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, merge, of, switchMap, takeUntil } from 'rxjs';
import {
  CambioSituacionResultado, CursoPersona, FamiliarItem, GradoItem, HistorialMilitar,
  MisionPersona, NIVELES_EDUCATIVOS, NIVELES_IDONEIDAD, OpcionSelect, PatchPersonaPayload,
  CandidatoFamiliar, PersonaDetalle,
} from '../../../../core/models/personal.models';
import { DestinoDePersona } from '../../../../core/models/destinos.models';
import { ComisionDePersona } from '../../../../core/models/comisiones.models';
import { PersonalService } from '../../../../core/services/personal.service';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { DerechaService } from '../../../../core/services/derecha.service';
import { DestinosService } from '../../../../core/services/destinos.service';
import { MisionesService } from '../../../../core/services/misiones.service';
import { CursosService } from '../../../../core/services/cursos.service';
import { SlotVista, armarSlots } from '../../../../core/services/documentos-registro';
import { Impacto } from '../../../../core/models/derecha.models';
import { requeridoSinEspacios } from '../../../../shared/utils/validadores';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  ESTADOS_ELEGIBILIDAD,
  Elegibilidad,
  EstadoElegibilidad,
} from '../../../../core/models/ascensos.models';
import { ESPERA_BUSQUEDA_MS } from '../../../../shared/utils/espera-busqueda';

export type TabKey = 'personal' | 'familiar' | 'historial' | 'cursos' | 'destinos' | 'comisiones' | 'misiones' | 'documentos';

interface TabDef { key: TabKey; label: string }

/** Un dato del legajo en la vista de lectura de "Datos personales". */
interface CampoLegajo {
  label: string;
  valor: string | null;
  /** Texto chico debajo del valor (ej. la edad bajo la fecha de nacimiento). */
  nota?: string | null;
  copiable?: boolean;
  /** false: puede quedar vacío sin que falte nada (no suma a la completitud). */
  cuenta?: boolean;
}

export type SeccionEdicionKey =
  'identificacion' | 'personales' | 'contacto' | 'laborales' | 'escalafon' | 'formacion' | 'familiares';

interface SeccionEdicion { key: SeccionEdicionKey; titulo: string }

/** Qué controles del formulario viven en cada sección del editor (para los contadores del índice). */
const CONTROLES_POR_SECCION: Record<SeccionEdicionKey, string[]> = {
  identificacion: ['cedula', 'tipo_funcionario', 'credencial_civica', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'],
  personales:     ['fecha_nacimiento', 'genero', 'estado_civil', 'lugar_nacimiento', 'etnia'],
  contacto:       ['email', 'telefono', 'direccion', 'codigo_postal', 'seccional'],
  laborales:      ['fecha_inicio', 'regimen_id', 'programa_id', 'prima_tecnica', 'tiene_mando'],
  escalafon:      ['escalafon_id', 'grado_id', 'derecha', 'numor'],
  formacion:      ['nivel_educativo', 'codigos_legajo', 'observaciones_laborales', 'nivel_idoneidad',
                   'fecha_ingreso_eta', 'fecha_egreso_eta', 'numero_orden_egreso_eta', 'mutaciones'],
  familiares:     [],
};

/** Nombre de cada control, para el resumen de errores. */
const LABEL_CONTROL: Record<string, string> = {
  cedula: 'Cédula', tipo_funcionario: 'Tipo de funcionario',
  primer_nombre: 'Primer nombre', segundo_nombre: 'Segundo nombre', primer_apellido: 'Primer apellido',
  segundo_apellido: 'Segundo apellido', credencial_civica: 'Credencial cívica', fecha_nacimiento: 'Fecha de nacimiento',
  genero: 'Género', estado_civil: 'Estado civil', lugar_nacimiento: 'Lugar de nacimiento', etnia: 'Etnia',
  email: 'Email', telefono: 'Teléfono', direccion: 'Dirección', codigo_postal: 'Código postal', seccional: 'Seccional',
  fecha_inicio: 'Fecha de inicio', regimen_id: 'Régimen', programa_id: 'Programa', prima_tecnica: 'Prima técnica',
  tiene_mando: 'Tiene mando', escalafon_id: 'Escalafón', grado_id: 'Grado', derecha: 'Derecha', numor: 'Numor',
  nivel_educativo: 'Nivel educativo', codigos_legajo: 'Códigos', observaciones_laborales: 'Observaciones laborales',
  nivel_idoneidad: 'Nivel de idoneidad', fecha_ingreso_eta: 'Ingreso a la ETA', fecha_egreso_eta: 'Egreso de la ETA',
  numero_orden_egreso_eta: 'N.º de orden de egreso', mutaciones: 'Mutación de escalafón',
};

interface ErrorEdicion { control: string; label: string; seccion: SeccionEdicionKey }

interface SeccionLegajo {
  titulo: string;
  campos: CampoLegajo[];
  nota?: string;
}

type CursoVista = CursoPersona & { slots: SlotVista[] };
type MisionVista = MisionPersona & { slots: SlotVista[] };
type DestinoVista = DestinoDePersona & { slots: SlotVista[] };

@Component({
  selector: 'app-personal-detail-page',
  standalone: false,
  templateUrl: './personal-detail-page.html',
  styleUrl: './personal-detail-page.scss',
})
export class PersonalDetailPage implements OnInit, OnDestroy {
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly svc      = inject(PersonalService);
  private readonly ascensos = inject(AscensosService);
  private readonly auth     = inject(AuthService);
  private readonly toast    = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly fb       = inject(FormBuilder);
  private readonly derecha  = inject(DerechaService);
  private readonly destinosApi = inject(DestinosService);
  private readonly misionesApi = inject(MisionesService);
  private readonly cursosApi   = inject(CursosService);
  private readonly host        = inject<ElementRef<HTMLElement>>(ElementRef);

  protected personaId!: number;

  // ─── Page state ──────────────────────────────────────────────────────────
  readonly persona        = signal<PersonaDetalle | null>(null);
  readonly loadingPersona = signal(true);

  /** `false` para un retirado: su relación cerrada no viene en la respuesta. */
  readonly tieneRelacionLaboral = computed(() => !!this.persona()?.relacion_laboral);

  // ─── Tabs ────────────────────────────────────────────────────────────────
  readonly activeTab   = signal<TabKey>('personal');
  private readonly loadedTabs = new Set<TabKey>(['personal']);

  readonly visibleTabs = computed<TabDef[]>(() => {
    const p = this.persona();
    if (!p) return [];
    return [
      { key: 'personal',       label: 'Datos personales'     },
      { key: 'familiar',       label: 'Información familiar' },
      ...(p.es_civil
        ? []
        : [{ key: 'historial' as TabKey, label: 'Historial militar'   }]),
      { key: 'cursos',         label: 'Cursos'               },
      { key: 'destinos',       label: 'Destinos'             },
      { key: 'comisiones',     label: 'Comisiones'           },
      { key: 'misiones',       label: 'Misiones'             },
      { key: 'documentos',     label: 'Documentos'           },
    ];
  });

  // ─── Tab data ────────────────────────────────────────────────────────────
  readonly familiares       = signal<FamiliarItem[]>([]);
  readonly loadingFamiliar  = signal(false);
  readonly familiarError    = signal<string | null>(null);
  readonly familiarSeleccionado = signal<FamiliarItem | null>(null);

  // ─── Agregar familiar (modo edición) ─────────────────────────────────────
  readonly tipoRelacionOpciones = ['Cónyuge', 'Padre', 'Madre', 'Hijo/a', 'Hermano/a', 'Otro'];
  readonly familiarAddSearch    = signal('');
  readonly familiarAddResults   = signal<CandidatoFamiliar[]>([]);
  readonly familiarAddDropdownOpen = signal(false);
  readonly familiarAddElegido   = signal<CandidatoFamiliar | null>(null);
  readonly familiarAddTipoRelacion = signal('');
  readonly guardandoFamiliar    = signal(false);
  private readonly familiarAddSearch$ = new Subject<string>();
  readonly historial        = signal<HistorialMilitar | null>(null);
  readonly loadingHistorial = signal(false);

  // ─── Situación de ascenso ────────────────────────────────────────────────
  readonly elegibilidad        = signal<Elegibilidad | null>(null);
  readonly loadingElegibilidad = signal(false);
  readonly elegibilidadError   = signal<string | null>(null);
  readonly puedeRegistrarAscenso = computed(() => this.auth.hasPermiso('ascensos.registrar'));

  readonly puedeEditarDocumentos = computed(() => this.auth.puedeConAlcance('personas.editar'));
  readonly puedeEditarFoto = computed(() => this.auth.puedeConAlcance('personas.editar'));

  // ─── Base y destino ──────────────────────────────────────────────────────────
  // La base no se edita en el perfil. Se cambia registrando un pase, para que el destino
  // y la relación laboral queden iguales.
  readonly puedeRegistrarDestino = computed(() => this.auth.hasPermiso('destinos.gestionar'));
  // Lo que sigue activo se edita en su módulo: el perfil solo lleva hasta ahí.
  readonly puedeGestionarMisiones = computed(() => this.auth.hasPermiso('misiones.gestionar'));
  readonly puedeGestionarCursos = computed(() => this.auth.puedeConAlcance('cursos.gestionar'));
  readonly puedeGestionarComisiones = computed(() => this.auth.puedeConAlcance('comisiones.gestionar'));
  /** La situación se cambia como en liquidación: cerrando la relación y abriendo otra. */
  readonly puedeCambiarSituacion = computed(() => this.auth.puedeConAlcance('personas.editar'));
  readonly cambiandoSituacion = signal(false);
  readonly registrandoDestino = signal(false);

  /** "B.A.I. (C.A.O.)"; si la relación no tiene base, solo el comando. */
  readonly baseActual = computed(() => {
    const rl = this.persona()?.relacion_laboral;
    if (!rl) return '—';
    const comando = rl.unidad?.denominacion;
    if (!rl.sub_unidad) return comando ? `Sin base (${comando})` : '—';
    return comando ? `${rl.sub_unidad.denominacion} (${comando})` : rl.sub_unidad.denominacion;
  });

  /** Para los links "Agregar" de los datos vacíos. */
  readonly puedeEditar = computed(() => this.auth.puedeConAlcance('personas.editar'));
  readonly puedeVerDerecha = computed(() => this.auth.hasPermiso('derecha.gestionar'));

  /** Los datos del legajo agrupados como en la vista de lectura. */
  readonly seccionesLegajo = computed<SeccionLegajo[]>(() => {
    const p = this.persona();
    if (!p) return [];
    const rl = p.relacion_laboral;
    const lm = p.legajo_militar;
    const militar = !p.es_civil;
    const tipo = rl?.tipo_funcionario ?? '';
    const edad = this.aniosDesde(p.fecha_nacimiento);

    const secciones: SeccionLegajo[] = [
      {
        titulo: 'Identificación y datos personales',
        campos: [
          { label: 'Nombre completo', valor: p.nombre_completo },
          { label: 'Cédula de identidad', valor: p.cedula, copiable: true },
          { label: 'Credencial cívica', valor: p.credencial_civica },
          { label: 'Fecha de nacimiento', valor: p.fecha_nacimiento ? this.formatDate(p.fecha_nacimiento) : null,
            nota: edad != null ? `${edad} años` : null },
          { label: 'Género', valor: p.genero ? this.formatGenero(p.genero) : null },
          { label: 'Estado civil', valor: p.estado_civil },
          { label: 'Lugar de nacimiento', valor: p.lugar_nacimiento },
          { label: 'Etnia', valor: p.etnia },
        ],
      },
      {
        titulo: 'Contacto',
        campos: [
          { label: 'Email', valor: p.email },
          { label: 'Teléfono', valor: p.telefono },
          { label: 'Dirección', valor: p.direccion },
          { label: 'Código postal', valor: p.codigo_postal },
          { label: 'Seccional', valor: p.seccional },
        ],
      },
    ];

    if (rl) {
      const carrera: CampoLegajo[] = [
        { label: 'Tipo de funcionario', valor: this.capitalizar(rl.tipo_funcionario) },
        { label: 'Escalafón', valor: rl.escalafon?.denominacion ?? null },
        { label: 'Grado', valor: rl.grado?.denominacion ?? null },
      ];
      if (militar) {
        const enActividad = rl.estado === 'activo';
        carrera.push(
          { label: 'Derecha', valor: enActividad && rl.derecha != null ? String(rl.derecha) : null, cuenta: false,
            nota: enActividad && rl.derecha != null ? null : 'Sin derecha asignada' },
          { label: 'Numor', valor: enActividad && rl.numor != null ? String(rl.numor) : null, cuenta: false },
        );
      }
      const servicio = this.tiempoDesde(rl.fecha_inicio);
      carrera.push({ label: 'Fecha de inicio', valor: rl.fecha_inicio ? this.formatDate(rl.fecha_inicio) : null,
        nota: servicio ? `${servicio} de servicio` : null });
      if (militar) {
        carrera.push(
          { label: 'Último ascenso', valor: rl.fecha_ultimo_ascenso ? this.formatDate(rl.fecha_ultimo_ascenso) : null, cuenta: false },
          { label: 'Tiene mando', valor: rl.tiene_mando ? 'Sí' : 'No' },
        );
      }
      secciones.push(
        { titulo: 'Carrera', campos: carrera },
        {
          titulo: 'Régimen y remuneración',
          campos: [
            { label: 'Régimen', valor: rl.regimen?.denominacion ?? null },
            { label: 'Programa', valor: rl.programa?.denominacion ?? null },
            ...(militar ? [{ label: 'Prima técnica', valor: rl.prima_tecnica }] : []),
          ],
        },
      );
    }

    const formacion: CampoLegajo[] = [];
    if (militar) {
      formacion.push({ label: 'Nivel educativo', valor: lm?.nivel_educativo_label ?? this.etiquetaNivelEducativo(lm?.nivel_educativo) });
    }
    if (tipo === 'oficial') formacion.push({ label: 'Códigos', valor: rl?.codigos_legajo ?? null });
    if (rl) formacion.push({ label: 'Observaciones laborales', valor: rl.observaciones });
    if (tipo === 'subalterno') {
      formacion.push(
        { label: 'Nivel de idoneidad', valor: p.nivel_idoneidad != null ? `Nivel ${p.nivel_idoneidad}` : null },
        { label: 'Ingreso a la ETA', valor: lm?.fecha_ingreso_eta ? this.formatDate(lm.fecha_ingreso_eta) : null },
        { label: 'Egreso de la ETA', valor: lm?.fecha_egreso_eta ? this.formatDate(lm.fecha_egreso_eta) : null },
        { label: 'N.º de orden de egreso', valor: lm?.numero_orden_egreso_eta ?? null },
        { label: 'Mutación de escalafón', valor: lm?.mutaciones ?? null, cuenta: false },
      );
    }
    if (formacion.length) {
      secciones.push({
        titulo: 'Formación y observaciones',
        campos: formacion,
        nota: tipo === 'oficial'
          ? 'Los datos de ETA (ingreso, egreso, orden de egreso y nivel de idoneidad) aplican solo a personal subalterno y no se muestran para oficiales.'
          : undefined,
      });
    }
    return secciones;
  });

  /** Datos que se esperan cargados y están vacíos, en el orden en que aparecen. */
  readonly camposFaltantes = computed(() =>
    this.seccionesLegajo().flatMap((s) => s.campos.filter((c) => c.cuenta !== false && !c.valor)),
  );

  readonly porcentajeLegajo = computed(() => {
    const total = this.seccionesLegajo().reduce((n, s) => n + this.camposQueCuentan(s).length, 0);
    return total ? Math.round(((total - this.camposFaltantes().length) / total) * 100) : 100;
  });

  /** "Credencial cívica, estado civil, lugar de nacimiento y otros." */
  readonly resumenFaltantes = computed(() => {
    const labels = this.camposFaltantes().map((c, i) => (i === 0 ? c.label : c.label.toLowerCase()));
    if (labels.length <= 6) {
      return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}.` : `${labels[0] ?? ''}.`;
    }
    return `${labels.slice(0, 5).join(', ')} y otros.`;
  });

  // ─── Destino y situación ────────────────────────────────────────────────
  readonly ofreceRegistrarDestino = computed(
    () => this.puedeRegistrarDestino() && this.persona()?.relacion_laboral?.estado === 'activo',
  );
  readonly ofreceCambiarSituacion = computed(() => {
    const p = this.persona();
    return this.puedeCambiarSituacion() && p?.relacion_laboral?.estado === 'activo' && !p.es_civil;
  });

  readonly personaDelPase = computed(() => {
    const p = this.persona();
    return p ? { id: String(p.id), nombre: p.nombre_completo, cedula: p.cedula } : null;
  });
  readonly sortedRangos     = computed(() => {
    const rangos = this.historial()?.historial_rangos ?? [];
    return [...rangos].sort((a, b) =>
      new Date(b.fecha_ascenso).getTime() - new Date(a.fecha_ascenso).getTime()
    );
  });
  readonly cursos           = signal<CursoVista[]>([]);
  readonly loadingCursos    = signal(false);
  readonly misiones         = signal<MisionVista[]>([]);
  readonly loadingMisiones  = signal(false);
  readonly busquedaMisiones = signal('');
  readonly misionesFiltradas = computed<MisionVista[]>(() => {
    const q = this.busquedaMisiones().trim().toLowerCase();
    if (!q) return this.misiones();
    return this.misiones().filter(
      (m) => m.nombre_mision.toLowerCase().includes(q) || m.pais.toLowerCase().includes(q),
    );
  });
  readonly destinos          = signal<DestinoVista[]>([]);
  readonly comisiones = signal<ComisionDePersona[]>([]);
  readonly loadingComisiones = signal(false);
  readonly comisionesError = signal<string | null>(null);
  readonly busquedaComisiones = signal('');
  readonly comisionesFiltradas = computed(() => {
    const query = this.busquedaComisiones().trim().toLowerCase();
    return this.comisiones().filter(c => !query || [c.comision, c.cargo, c.numero_orden, c.boletin].some(v => v?.toLowerCase().includes(query)));
  });
  readonly loadingDestinos   = signal(false);
  /** Sin esto un 403/404 dejaba la pestaña vacía como si no tuviera destinos (SCRUM-163). */
  readonly destinosError = signal<string | null>(null);
  readonly busquedaDestinos  = signal('');
  readonly destinosFiltrados = computed<DestinoVista[]>(() => {
    const q = this.busquedaDestinos().trim().toLowerCase();
    if (!q) return this.destinos();
    return this.destinos().filter(
      (d) =>
        (d.sub_unidad ?? '').toLowerCase().includes(q) ||
        (d.codigo_sub_unidad ?? '').toLowerCase().includes(q) ||
        (d.unidad ?? '').toLowerCase().includes(q) ||
        (d.posicion_destino ?? '').toLowerCase().includes(q),
    );
  });

  // ─── Edit drawer ─────────────────────────────────────────────────────────
  readonly editMode    = signal(false);
  readonly editLoading = signal(false);

  readonly editGrados     = signal<GradoItem[]>([]);
  readonly editRegimenes  = signal<OpcionSelect[]>([]);
  readonly editProgramas  = signal<OpcionSelect[]>([]);
  readonly editEscalafones= signal<OpcionSelect[]>([]);
  private catalogsLoaded  = false;

  readonly generoOpciones = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino'  },
    { value: 'O', label: 'Otro'      },
  ];
  readonly estadoCivilOpciones = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'];

  /** Datos militares del legajo: los consultan las reglas de ascenso. */
  readonly nivelEducativoOpciones = NIVELES_EDUCATIVOS;
  readonly nivelesIdoneidad = NIVELES_IDONEIDAD;

  /** El nivel de idoneidad aplica al personal subalterno. */
  esSubalterno(): boolean {
    return this.tipoFuncionario() === 'subalterno';
  }

  /** Los códigos del legajo los carga el oficial. */
  esOficial(): boolean {
    return this.tipoFuncionario() === 'oficial';
  }

  /** En edición manda el tipo elegido en el formulario: cambia qué campos aplican. */
  tipoFuncionario(): string {
    if (this.editMode()) return String(this.valoresEdicion()['tipo_funcionario'] ?? '');
    return this.persona()?.relacion_laboral?.tipo_funcionario ?? '';
  }

  /** El tipo se edita solo para un militar con relación vigente. */
  puedeEditarTipo(): boolean {
    const p = this.persona();
    return !!p && !p.es_civil && !!p.relacion_laboral;
  }

  readonly tipoFuncionarioOpciones = [
    { value: 'oficial', label: 'Oficial' },
    { value: 'subalterno', label: 'Subalterno' },
  ];

  readonly editForm: FormGroup = this.fb.group({
    cedula:                ['', [requeridoSinEspacios, Validators.pattern(/^\d{6,9}$/)]],
    tipo_funcionario:      [''],
    primer_nombre:         ['', requeridoSinEspacios],
    segundo_nombre:        [''],
    primer_apellido:       ['', requeridoSinEspacios],
    segundo_apellido:      [''],
    fecha_nacimiento:      [''],
    genero:                [''],
    estado_civil:          [''],
    lugar_nacimiento:      [''],
    etnia:                 [''],
    codigo_postal:         ['', Validators.maxLength(10)],
    seccional:             [''],
    credencial_civica:     [''],
    email:                 ['', Validators.email],
    telefono:              [''],
    direccion:             [''],
    fecha_inicio:          [''],
    escalafon_id:          [null],
    grado_id:              [{ value: null, disabled: true }],
    regimen_id:            [null],
    programa_id:           [null],
    prima_tecnica:         [''],
    tiene_mando:           [false],
    observaciones_laborales: [''],
    // Datos del subalterno (nivel ETA)
    nivel_idoneidad:         [null],
    codigos_legajo:          [''],
    // Legajo militar
    nivel_educativo:         [''],
    fecha_ingreso_eta:       [''],
    fecha_egreso_eta:        [''],
    numero_orden_egreso_eta: [''],
    mutaciones:              [''],
    // Derecha y numor
    derecha:                 [null as number | null],
    numor:                   [null as number | null],
    motivo_derecha:          [''],
  }, {
    validators: [
      (group: AbstractControl) => this.nacimientoAnteriorAInicio(group),
      (group: AbstractControl) => this.egresoEtaPosteriorAIngreso(group),
    ],
  });

  // ─── Derecha y numor (edición) ───────────────────────────────────────────
  /** Solo con el permiso y si el funcionario tiene derecha (en actividad, grado con derecha). */
  readonly puedeEditarDerecha = computed(
    () => this.auth.hasPermiso('derecha.gestionar') && this.persona()?.relacion_laboral?.derecha != null,
  );
  readonly rangoDerecha = signal<{ desde: number; hasta: number } | null>(null);
  readonly maxNumor = signal<number | null>(null);
  readonly impactoDerecha = signal<Impacto | null>(null);
  readonly calculandoDerecha = signal(false);
  readonly errorDerecha = signal<string | null>(null);

  /**
   * La relación laboral no puede empezar antes de que la persona haya nacido. Acá las dos fechas son
   * editables, así que se compara el par que va a quedar guardado.
   */
  private nacimientoAnteriorAInicio(group: AbstractControl): ValidationErrors | null {
    const nacimiento: string = group.get('fecha_nacimiento')?.value;
    const inicio: string = group.get('fecha_inicio')?.value || this.fechaInicioGuardada();
    if (!nacimiento || !inicio) return null;
    return nacimiento > inicio ? { fechasInconsistentes: true } : null;
  }

  // El egreso de la ETA no puede ser anterior al ingreso.
  private egresoEtaPosteriorAIngreso(group: AbstractControl): ValidationErrors | null {
    const ingreso: string = group.get('fecha_ingreso_eta')?.value;
    const egreso: string = group.get('fecha_egreso_eta')?.value;
    if (!ingreso || !egreso) return null;
    return egreso < ingreso ? { etaInconsistente: true } : null;
  }

  etaInconsistente(): boolean {
    return !!this.editForm.errors?.['etaInconsistente'];
  }

  /** Error de a pares: vive en el grupo, se muestra bajo las dos fechas. */
  fechasInconsistentes(): boolean {
    return !!this.editForm.errors?.['fechasInconsistentes'];
  }

  maxFechaNacimiento(): string | null {
    return this.editForm.get('fecha_inicio')?.value || this.fechaInicioGuardada();
  }

  minFechaInicio(): string | null {
    return this.editForm.get('fecha_nacimiento')?.value || null;
  }

  private fechaInicioGuardada(): string | null {
    return this.persona()?.relacion_laboral?.fecha_inicio?.split('T')[0] ?? null;
  }

  // ─── Editor: cambios sin guardar ─────────────────────────────────────────
  /** Lo que tenía el formulario al abrir el editor. */
  private readonly valoresIniciales = signal<Record<string, unknown> | null>(null);
  /** Copia de getRawValue() que se actualiza con cada cambio: hace reactivos los contadores. */
  readonly valoresEdicion = signal<Record<string, unknown>>({});

  readonly seccionesEdicion = computed<SeccionEdicion[]>(() => {
    const p = this.persona();
    if (!p) return [];
    const rl = p.relacion_laboral;
    return [
      { key: 'identificacion', titulo: 'Identificación' },
      { key: 'personales',     titulo: 'Datos personales' },
      { key: 'contacto',       titulo: 'Contacto' },
      ...(rl ? [{ key: 'laborales' as const, titulo: 'Datos laborales' }] : []),
      ...(rl && !p.es_civil ? [{ key: 'escalafon' as const, titulo: 'Escalafón y derecha' }] : []),
      ...(!p.es_civil || rl ? [{ key: 'formacion' as const, titulo: 'Formación' }] : []),
      { key: 'familiares',     titulo: 'Familiares' },
    ];
  });

  /** Controles cuyo valor difiere del que tenían al abrir el editor. */
  readonly controlesModificados = computed<Set<string>>(() => {
    const inicial = this.valoresIniciales();
    const actual = this.valoresEdicion();
    const cambiados = new Set<string>();
    if (!inicial) return cambiados;
    for (const key of Object.keys(LABEL_CONTROL)) {
      if (this.normalizar(inicial[key]) !== this.normalizar(actual[key])) cambiados.add(key);
    }
    return cambiados;
  });

  readonly cantidadCambios = computed(() => this.controlesModificados().size);

  modificado(control: string): boolean {
    return this.controlesModificados().has(control);
  }

  /** Número de la sección en el editor (las laborales no aparecen para todos). */
  numeroSeccion(key: SeccionEdicionKey): number {
    return this.seccionesEdicion().findIndex((s) => s.key === key) + 1;
  }

  cambiosEnSeccion(key: SeccionEdicionKey): number {
    return CONTROLES_POR_SECCION[key].filter((c) => this.modificado(c)).length;
  }

  /** Errores visibles: controles inválidos ya tocados y las reglas que cruzan campos. */
  erroresEdicion(): ErrorEdicion[] {
    const errores: ErrorEdicion[] = [];
    for (const seccion of Object.keys(CONTROLES_POR_SECCION) as SeccionEdicionKey[]) {
      for (const control of CONTROLES_POR_SECCION[seccion]) {
        if (this.hasEditError(control)) errores.push({ control, label: LABEL_CONTROL[control], seccion });
      }
    }
    if (this.fechasInconsistentes()) {
      errores.push({ control: 'fecha_nacimiento', label: 'Fecha de nacimiento', seccion: 'personales' });
    }
    if (this.etaInconsistente()) {
      errores.push({ control: 'fecha_egreso_eta', label: 'Egreso de la ETA', seccion: 'formacion' });
    }
    if (this.cambioDerecha() && this.errorRangoDerecha()) {
      errores.push({ control: 'derecha', label: 'Derecha y numor', seccion: 'escalafon' });
    }
    return errores;
  }

  erroresEnSeccion(key: SeccionEdicionKey): number {
    return this.erroresEdicion().filter((e) => e.seccion === key).length;
  }

  /** Cómo se veía el dato antes de editarlo, para "Antes: …". */
  antes(control: string): string {
    const v = this.valoresIniciales()?.[control];
    if (v === null || v === undefined || v === '') return 'sin dato';
    const rl = this.persona()?.relacion_laboral;
    switch (control) {
      case 'genero':          return this.formatGenero(String(v));
      case 'tipo_funcionario': return this.capitalizar(String(v)) ?? String(v);
      case 'tiene_mando':     return v ? 'Sí' : 'No';
      case 'escalafon_id':    return rl?.escalafon?.denominacion ?? String(v);
      case 'grado_id':        return rl?.grado?.denominacion ?? String(v);
      case 'regimen_id':      return rl?.regimen?.denominacion ?? String(v);
      case 'programa_id':     return rl?.programa?.denominacion ?? String(v);
      case 'nivel_idoneidad': return `Nivel ${v}`;
      case 'nivel_educativo': return this.etiquetaNivelEducativo(String(v)) ?? String(v);
    }
    if (control.startsWith('fecha_')) return this.formatDate(String(v));
    return String(v);
  }

  irASeccion(key: SeccionEdicionKey): void {
    (this.host.nativeElement as HTMLElement)
      .querySelector(`#ed-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  irAError(e: ErrorEdicion): void {
    const campo = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`[formControlName="${e.control}"]`);
    if (campo) {
      campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      campo.focus({ preventScroll: true });
    } else {
      this.irASeccion(e.seccion);
    }
  }

  /** "Descartar": pide confirmación solo si hay algo que perder. */
  async descartarEdicion(): Promise<void> {
    const n = this.cantidadCambios();
    if (n) {
      const confirmado = await this.confirmModal.confirmar({
        titulo: 'Descartar cambios',
        mensaje: `Tenés ${n} ${n === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}. Si salís de la edición se pierden.`,
        textoConfirmar: 'Descartar',
        textoCancelar: 'Seguir editando',
      });
      if (!confirmado) return;
    }
    this.closeEdit();
  }

  private normalizar(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v.trim();
    return String(v);
  }

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    if (!raw || isNaN(Number(raw))) {
      this.router.navigate(['/personal']);
      return;
    }
    this.personaId = Number(raw);
    this.loadPersona();
    this.setupEscalafonCascade();
    this.setupFamiliarAddSearch();
    this.setupEdicionDerecha();
    this.editForm.get('tipo_funcionario')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((tipo: string) => this.habilitarCamposDelTipo(tipo ?? ''));
    this.editForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.valoresEdicion.set(this.editForm.getRawValue()));
  }

  /** Mientras se escribe, se previsualiza a quiénes corre el cambio. */
  private setupEdicionDerecha(): void {
    merge(this.editForm.get('derecha')!.valueChanges, this.editForm.get('numor')!.valueChanges)
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const cambio = this.cambioDerecha();
          if (!cambio || this.errorRangoDerecha()) return of({ impacto: null, error: null as string | null });
          this.calculandoDerecha.set(true);
          return this.derecha
            .previsualizar({ operacion: 'REORDEN', persona_id: this.personaId, ...cambio })
            .pipe(
              map((impacto) => ({ impacto, error: null as string | null })),
              catchError((err: HttpErrorResponse) => of({ impacto: null, error: parseError(err) })),
            );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((r) => {
        this.calculandoDerecha.set(false);
        this.impactoDerecha.set(r.impacto);
        this.errorDerecha.set(r.error);
      });
  }

  /** Al cambiar grado o escalafón la derecha la recalcula el sistema: va al final del grado nuevo. */
  cambioGradoOEscalafon(): boolean {
    const rl = this.persona()?.relacion_laboral;
    const raw = this.editForm.getRawValue();
    return (
      (raw.grado_id != null && Number(raw.grado_id) !== Number(rl?.grado?.id)) ||
      (raw.escalafon_id != null && Number(raw.escalafon_id) !== Number(rl?.escalafon?.id))
    );
  }

  /** Lo que cambió de derecha y numor respecto de lo guardado, o null si nada. */
  cambioDerecha(): { derecha?: number; numor?: number } | null {
    if (!this.puedeEditarDerecha() || this.cambioGradoOEscalafon()) return null;
    const rl = this.persona()!.relacion_laboral!;
    const raw = this.editForm.getRawValue();
    const derecha = raw.derecha === null || raw.derecha === '' ? null : Number(raw.derecha);
    const numor = raw.numor === null || raw.numor === '' ? null : Number(raw.numor);
    const cambio: { derecha?: number; numor?: number } = {};
    if (derecha !== null && derecha !== rl.derecha) cambio.derecha = derecha;
    if (numor !== null && numor !== rl.numor) cambio.numor = numor;
    return Object.keys(cambio).length ? cambio : null;
  }

  errorRangoDerecha(): string | null {
    const raw = this.editForm.getRawValue();
    const rango = this.rangoDerecha();
    const derecha = Number(raw.derecha);
    if (rango && raw.derecha != null && raw.derecha !== '' &&
        (!Number.isInteger(derecha) || derecha < rango.desde || derecha > rango.hasta)) {
      return `La derecha tiene que estar entre ${rango.desde} y ${rango.hasta}, el bloque de su grado.`;
    }
    const max = this.maxNumor();
    const numor = Number(raw.numor);
    if (max && raw.numor != null && raw.numor !== '' && (!Number.isInteger(numor) || numor < 1 || numor > max)) {
      return `El numor tiene que estar entre 1 y ${max}.`;
    }
    return null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPersona(): void {
    this.loadingPersona.set(true);
    this.svc.getById(this.personaId).subscribe({
      next: p => {
        this.persona.set(p);
        this.loadingPersona.set(false);
        this.abrirEdicionSiSePidio();
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPersona.set(false);
        if (err.status === 404) {
          this.toast.error('Personal no encontrado');
          this.router.navigate(['/personal']);
        } else if (err.status === 403) {
          this.errorModal.show(parseError(err));
          this.router.navigate(['/personal']);
        } else {
          this.toast.error('Error al cargar el perfil');
        }
      },
    });
  }

  // "Editar" del listado entra con ?editar=1; se saca de la URL para que no se reabra al recargar.
  private abrirEdicionSiSePidio(): void {
    if (this.route.snapshot.queryParamMap?.get('editar') !== '1') return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { editar: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (!this.editMode() && this.puedeEditar()) this.openEdit();
  }

  private setupEscalafonCascade(): void {
    this.editForm.get('escalafon_id')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id: number | null) => {
        const gradoCtrl = this.editForm.get('grado_id')!;
        gradoCtrl.reset(null);
        this.editGrados.set([]);
        if (id) {
          gradoCtrl.enable();
          this.svc.getGrados(Number(id)).subscribe({
            next: d => this.editGrados.set(d),
            error: () => gradoCtrl.disable(),
          });
        } else {
          gradoCtrl.disable();
        }
      });
  }

  abrirRegistrarDestino(): void {
    this.registrandoDestino.set(true);
  }

  cerrarRegistrarDestino(): void {
    this.registrandoDestino.set(false);
  }

  onDestinoRegistrado(): void {
    this.registrandoDestino.set(false);
    this.toast.success('Destino registrado');
    this.loadPersona();
    // La pestaña Destinos se vuelve a pedir: si está abierta, ahora; si no, cuando se abra.
    this.loadedTabs.delete('destinos');
    if (this.activeTab() === 'destinos') this.switchTab('destinos');
  }

  abrirCambiarSituacion(): void {
    this.cambiandoSituacion.set(true);
  }

  cerrarCambiarSituacion(): void {
    this.cambiandoSituacion.set(false);
  }

  onSituacionCambiada(r: CambioSituacionResultado): void {
    this.cambiandoSituacion.set(false);
    this.toast.success(`Situación cambiada a ${r.situacion.denominacion}`);
    this.loadPersona();
    // El historial militar muestra las relaciones: se vuelve a pedir.
    this.loadedTabs.delete('historial');
  }

  editarConvocatoria(misionId: string, convocatoriaId: string): void {
    this.router.navigate(['/misiones/catalogo', misionId, 'convocatorias', convocatoriaId]);
  }

  verEnCursos(): void {
    this.router.navigate(['/cursos/inscripciones'], { queryParams: { cedula: this.persona()?.cedula } });
  }

  editarDestino(destinoId: string): void {
    this.router.navigate(['/destinos/asignaciones'], { queryParams: { editar: destinoId } });
  }

  editarComision(asignacionId: string): void {
    this.router.navigate(['/comisiones/asignaciones'], { queryParams: { editar: asignacionId, persona: this.personaId } });
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────

  switchTab(key: TabKey): void {
    this.activeTab.set(key);
    if (this.loadedTabs.has(key)) return;
    this.loadedTabs.add(key);
    switch (key) {
      case 'familiar':
        this.loadFamiliares();
        break;
      case 'historial':
        this.loadingHistorial.set(true);
        this.svc.getHistorialMilitar(this.personaId).subscribe({
          next: d => { this.historial.set(d); this.loadingHistorial.set(false); },
          error: () => this.loadingHistorial.set(false),
        });
        this.cargarElegibilidad();
        break;
      case 'cursos':
        this.loadingCursos.set(true);
        this.svc.getCursos(this.personaId).subscribe({
          next: d => { this.cursos.set(d.map(c => this.conSlotsCurso(c))); this.loadingCursos.set(false); },
          error: () => this.loadingCursos.set(false),
        });
        break;
      case 'destinos':
        this.cargarDestinos();
        break;
      case 'comisiones':
        this.cargarComisiones();
        break;
      case 'misiones':
        this.loadingMisiones.set(true);
        this.svc.getMisiones(this.personaId).subscribe({
          next: d => { this.misiones.set(d.map(m => this.conSlotsMision(m))); this.loadingMisiones.set(false); },
          error: () => this.loadingMisiones.set(false),
        });
        break;
    }
  }

  cargarDestinos(): void {
    this.loadingDestinos.set(true);
    this.destinosError.set(null);
    this.svc.getDestinos(this.personaId).pipe(takeUntil(this.destroy$)).subscribe({
      next: d => { this.destinos.set(d.map(x => this.conSlotsDestino(x))); this.loadingDestinos.set(false); },
      error: err => { this.destinosError.set(parseError(err)); this.loadingDestinos.set(false); },
    });
  }

  cargarComisiones(): void {
    this.loadingComisiones.set(true);
    this.comisionesError.set(null);
    this.svc.getComisiones(this.personaId).pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.comisiones.set(data); this.loadingComisiones.set(false); },
      error: err => { this.comisionesError.set(parseError(err)); this.loadingComisiones.set(false); },
    });
  }

  /** La misma evaluación que alimenta el listado de pasibles, para uno solo. */
  private cargarElegibilidad(): void {
    this.loadingElegibilidad.set(true);
    this.elegibilidadError.set(null);
    this.ascensos.getElegibilidad(this.personaId).subscribe({
      next: (e) => {
        this.elegibilidad.set(e);
        this.loadingElegibilidad.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingElegibilidad.set(false);
        // Un 403 es esperable: no todo usuario del perfil ve ascensos.
        this.elegibilidadError.set(
          err.status === 403 ? null : 'No se pudo evaluar la situación de ascenso.',
        );
      },
    });
  }

  etiquetaEstadoAscenso(estado: EstadoElegibilidad): string {
    return ESTADOS_ELEGIBILIDAD.find((e) => e.value === estado)?.label ?? estado;
  }

  /** ✓ cumple · ✗ no cumple · ○ no aplica */
  simboloRequisito(req: { aplica: boolean; cumple: boolean }): string {
    if (!req.aplica) return '○';
    return req.cumple ? '✓' : '✗';
  }

  claseRequisito(req: { aplica: boolean; cumple: boolean }): string {
    if (!req.aplica) return '';
    return req.cumple ? 'pd__req--ok' : 'pd__req--falta';
  }

  private loadFamiliares(): void {
    this.loadingFamiliar.set(true);
    this.familiarError.set(null);
    this.svc.getFamiliares(this.personaId).subscribe({
      next: d => { this.familiares.set(d); this.loadingFamiliar.set(false); },
      error: () => {
        this.loadingFamiliar.set(false);
        this.familiarError.set('No se pudo cargar la información familiar. Intentá de nuevo.');
      },
    });
  }

  retryFamiliares(): void {
    this.loadFamiliares();
  }

  abrirFamiliarDetalle(f: FamiliarItem): void {
    this.familiarSeleccionado.set(f);
  }

  cerrarFamiliarDetalle(): void {
    this.familiarSeleccionado.set(null);
  }

  private setupFamiliarAddSearch(): void {
    this.familiarAddSearch$
      .pipe(debounceTime(ESPERA_BUSQUEDA_MS), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(term => {
        if (!term || term.length < 2) {
          this.familiarAddResults.set([]);
          return;
        }
        // Militares en actividad y civiles; el backend ya saca a la propia persona.
        this.svc.buscarCandidatosFamiliar(term, this.personaId).subscribe({
          next: candidatos => {
            const cedulasActuales = new Set(this.familiares().map(f => f.cedula));
            this.familiarAddResults.set(
              candidatos.filter(p => p.id !== String(this.personaId) && !cedulasActuales.has(p.cedula)),
            );
          },
        });
      });
  }

  onFamiliarAddSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.familiarAddSearch.set(val);
    this.familiarAddDropdownOpen.set(true);
    this.familiarAddSearch$.next(val);
  }

  onFamiliarAddBlur(): void {
    setTimeout(() => this.familiarAddDropdownOpen.set(false), 200);
  }

  elegirFamiliarAAgregar(persona: CandidatoFamiliar): void {
    this.familiarAddElegido.set(persona);
    this.familiarAddSearch.set('');
    this.familiarAddResults.set([]);
    this.familiarAddDropdownOpen.set(false);
  }

  cancelarAgregarFamiliar(): void {
    this.familiarAddElegido.set(null);
    this.familiarAddTipoRelacion.set('');
  }

  /** "Agregar familiar" de la pestaña Información familiar: abre el buscador. */
  readonly agregandoFamiliar = signal(false);

  abrirAgregarFamiliar(): void {
    this.cancelarAgregarFamiliar();
    this.familiarAddSearch.set('');
    this.familiarAddResults.set([]);
    this.agregandoFamiliar.set(true);
  }

  cerrarAgregarFamiliar(): void {
    this.cancelarAgregarFamiliar();
    this.familiarAddSearch.set('');
    this.familiarAddResults.set([]);
    this.familiarAddDropdownOpen.set(false);
    this.agregandoFamiliar.set(false);
  }

  confirmarAgregarFamiliar(): void {
    const persona = this.familiarAddElegido();
    if (!persona) return;

    this.guardandoFamiliar.set(true);
    this.svc.agregarFamiliar(this.personaId, {
      cedula: persona.cedula,
      ...(this.familiarAddTipoRelacion() && { tipo_relacion: this.familiarAddTipoRelacion() }),
    }).subscribe({
      next: nuevo => {
        this.familiares.update(list => [...list, nuevo]);
        this.guardandoFamiliar.set(false);
        this.cancelarAgregarFamiliar();
        this.agregandoFamiliar.set(false);
        this.toast.success('Familiar agregado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoFamiliar.set(false);
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
          return;
        }
        const msg = (err.status === 400 || err.status === 409) && err.error?.message
          ? err.error.message
          : 'No se pudo agregar el familiar. Intentá de nuevo.';
        this.toast.error(msg);
      },
    });
  }

  async quitarFamiliar(f: FamiliarItem): Promise<void> {
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Quitar familiar',
      mensaje: `${f.nombre_completo} deja de figurar como familiar de este funcionario. La persona no se borra del sistema.`,
      textoConfirmar: 'Quitar',
    });
    if (!confirmado) return;

    this.svc.quitarFamiliar(this.personaId, f.id).subscribe({
      next: () => {
        this.familiares.update(list => list.filter(x => x.id !== f.id));
        this.toast.success('Familiar quitado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
        } else {
          this.toast.error('No se pudo quitar el familiar. Intentá de nuevo.');
        }
      },
    });
  }

  // ─── Edit ────────────────────────────────────────────────────────────────

  openEdit(): void {
    const p = this.persona()!;
    const rl = p.relacion_laboral;
    const lm = p.legajo_militar;

    // Patch sin emitir eventos para no disparar la cascada de escalafon→grado
    this.editForm.patchValue({
      cedula:                p.cedula            ?? '',
      tipo_funcionario:      rl?.tipo_funcionario ?? '',
      primer_nombre:         p.primer_nombre     ?? '',
      segundo_nombre:        p.segundo_nombre    ?? '',
      primer_apellido:       p.primer_apellido   ?? '',
      segundo_apellido:      p.segundo_apellido  ?? '',
      fecha_nacimiento:      p.fecha_nacimiento  ? p.fecha_nacimiento.split('T')[0] : '',
      genero:                p.genero            ?? '',
      estado_civil:          p.estado_civil      ?? '',
      lugar_nacimiento:      p.lugar_nacimiento  ?? '',
      etnia:                 p.etnia             ?? '',
      codigo_postal:         p.codigo_postal     ?? '',
      seccional:             p.seccional         ?? '',
      credencial_civica:     p.credencial_civica ?? '',
      email:                 p.email             ?? '',
      telefono:              p.telefono          ?? '',
      direccion:             p.direccion         ?? '',
      fecha_inicio:          rl?.fecha_inicio    ? rl.fecha_inicio.split('T')[0] : '',
      escalafon_id:          rl?.escalafon?.id   ?? null,
      grado_id:              rl?.grado?.id       ?? null,
      regimen_id:            rl?.regimen?.id     ?? null,
      programa_id:           rl?.programa?.id    ?? null,
      prima_tecnica:         rl?.prima_tecnica   ?? '',
      tiene_mando:           rl?.tiene_mando     ?? false,
      observaciones_laborales: rl?.observaciones ?? '',
      nivel_idoneidad:         p.nivel_idoneidad     ?? null,
      codigos_legajo:          rl?.codigos_legajo ?? '',
      nivel_educativo:         lm?.nivel_educativo ?? '',
      fecha_ingreso_eta:       lm?.fecha_ingreso_eta ? lm.fecha_ingreso_eta.split('T')[0] : '',
      fecha_egreso_eta:        lm?.fecha_egreso_eta  ? lm.fecha_egreso_eta.split('T')[0]  : '',
      numero_orden_egreso_eta: lm?.numero_orden_egreso_eta ?? '',
      mutaciones:              lm?.mutaciones ?? '',
      derecha:                 rl?.derecha ?? null,
      numor:                   rl?.numor ?? null,
      motivo_derecha:          '',
    }, { emitEvent: false });

    this.impactoDerecha.set(null);
    this.errorDerecha.set(null);
    if (this.puedeEditarDerecha() && rl?.grado?.id) {
      this.derecha.obtenerGrado(rl.grado.id).subscribe({
        next: (g) => {
          this.rangoDerecha.set(
            g.derecha_desde !== null ? { desde: g.derecha_desde, hasta: g.derecha_hasta! } : null,
          );
          this.maxNumor.set(g.escalafones.find((e) => Number(e.id) === Number(rl.escalafon?.id))?.cantidad ?? null);
        },
      });
    }

    if (rl?.escalafon?.id) {
      this.editForm.get('grado_id')!.enable({ emitEvent: false });
    }

    // [disabled] no tiene efecto con formControlName: se habilitan acá según el tipo.
    this.habilitarCamposDelTipo(rl?.tipo_funcionario ?? '');

    if (!this.catalogsLoaded) {
      this.catalogsLoaded = true;
      this.svc.getRegimenes().subscribe({ next: d => this.editRegimenes.set(d) });
      this.svc.getProgramas().subscribe({ next: d => this.editProgramas.set(d) });
      this.svc.getEscalafones().subscribe({ next: d => this.editEscalafones.set(d) });
      if (rl?.escalafon?.id) {
        this.svc.getGrados(rl.escalafon.id).subscribe({ next: d => this.editGrados.set(d) });
      }
    }

    this.editForm.markAsPristine();
    this.editForm.markAsUntouched();
    const valores = this.editForm.getRawValue();
    this.valoresIniciales.set(valores);
    this.valoresEdicion.set(valores);

    // Los familiares se gestionan desde el editor: se piden si todavía no se habían cargado.
    if (!this.loadedTabs.has('familiar')) {
      this.loadedTabs.add('familiar');
      this.loadFamiliares();
    }

    this.activeTab.set('personal');
    this.editMode.set(true);
  }

  /** El nivel de idoneidad es del subalterno y los códigos, del oficial. */
  private habilitarCamposDelTipo(tipo: string): void {
    const nivelCtrl = this.editForm.get('nivel_idoneidad')!;
    const codigosCtrl = this.editForm.get('codigos_legajo')!;
    if (tipo === 'subalterno') nivelCtrl.enable({ emitEvent: false }); else nivelCtrl.disable({ emitEvent: false });
    if (tipo === 'oficial') codigosCtrl.enable({ emitEvent: false }); else codigosCtrl.disable({ emitEvent: false });
  }

  /** Cambió el tipo pero el grado sigue siendo el que tenía: el backend lo va a rechazar. */
  cambioTipoSinGrado(): boolean {
    const rl = this.persona()?.relacion_laboral;
    return this.modificado('tipo_funcionario') && !this.modificado('grado_id') && !!rl;
  }

  closeEdit(): void {
    this.editMode.set(false);
    this.valoresIniciales.set(null);
    this.cancelarAgregarFamiliar();
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    if (this.cambioDerecha() && this.errorRangoDerecha()) return;
    const raw = this.editForm.getRawValue();
    const payload: PatchPersonaPayload = {
      ...(raw.cedula?.trim() && raw.cedula.trim() !== this.persona()?.cedula && { cedula: raw.cedula.trim() }),
      ...(this.puedeEditarTipo() && raw.tipo_funcionario && { tipo_funcionario: raw.tipo_funcionario }),
      ...(raw.primer_nombre?.trim()   && { primer_nombre:         raw.primer_nombre.trim() }),
      segundo_nombre:                  raw.segundo_nombre?.trim()   || null,
      ...(raw.primer_apellido?.trim() && { primer_apellido:       raw.primer_apellido.trim() }),
      segundo_apellido:                raw.segundo_apellido?.trim() || null,
      ...(raw.fecha_nacimiento      && { fecha_nacimiento:      raw.fecha_nacimiento }),
      ...(raw.genero                && { genero:                raw.genero }),
      ...(raw.estado_civil          && { estado_civil:          raw.estado_civil }),
      ...(raw.lugar_nacimiento      && { lugar_nacimiento:      raw.lugar_nacimiento }),
      etnia:                           raw.etnia       || null,
      codigo_postal:                   raw.codigo_postal || null,
      seccional:                       raw.seccional   || null,
      credencial_civica:               raw.credencial_civica || null,
      ...(raw.email                 && { email:                 raw.email }),
      ...(raw.telefono              && { telefono:              raw.telefono }),
      ...(raw.direccion             && { direccion:             raw.direccion }),
      ...(raw.fecha_inicio          && { fecha_inicio:          raw.fecha_inicio }),
      ...(raw.escalafon_id          && { escalafon_id:          Number(raw.escalafon_id) }),
      ...(raw.grado_id              && { grado_id:              Number(raw.grado_id) }),
      ...(raw.regimen_id            && { regimen_id:            Number(raw.regimen_id) }),
      ...(raw.programa_id           && { programa_id:           Number(raw.programa_id) }),
      prima_tecnica:                   raw.prima_tecnica || null,
      tiene_mando:                     raw.tiene_mando,
      observaciones_laborales:         raw.observaciones_laborales || null,
      // Cada uno va solo para su tipo: mandarlo vacío borraría el dato de la persona.
      ...(this.esSubalterno()         && { nivel_idoneidad:       raw.nivel_idoneidad ?? null }),
      ...(this.esOficial()            && { codigos_legajo:        raw.codigos_legajo || null }),
      // Legajo militar: vacío se manda como null para poder borrar el dato.
      nivel_educativo:                 raw.nivel_educativo || null,
      fecha_ingreso_eta:               raw.fecha_ingreso_eta || null,
      fecha_egreso_eta:                raw.fecha_egreso_eta || null,
      numero_orden_egreso_eta:         raw.numero_orden_egreso_eta || null,
      mutaciones:                      raw.mutaciones || null,
      ...this.cambioDerecha(),
      ...(this.cambioDerecha() && raw.motivo_derecha?.trim() && { motivo_derecha: raw.motivo_derecha.trim() }),
    };

    this.editLoading.set(true);
    this.svc.update(this.personaId, payload).subscribe({
      next: updated => {
        this.persona.set(updated);
        this.editLoading.set(false);
        this.editMode.set(false);
        this.valoresIniciales.set(null);
        this.cancelarAgregarFamiliar();
        // La edición puede cambiar lo que muestran las otras pestañas: se vuelven a pedir al abrirlas.
        this.loadedTabs.clear();
        this.loadedTabs.add('personal');
        this.toast.success('Perfil actualizado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.editLoading.set(false);
        const mensaje = parseError(err);
        if (err.status === 409 && /c[eé]dula/i.test(mensaje)) {
          const cedula = this.editForm.get('cedula')!;
          cedula.setErrors({ cedulaDuplicada: true });
          cedula.markAsTouched();
          this.toast.error(mensaje);
          return;
        }
        if (err.status === 403 || err.status === 400 || err.status === 409) {
          // 400 acá puede ser una regla de negocio, no solo validación de formulario.
          this.errorModal.show(mensaje);
          return;
        }
        this.toast.error('Error al guardar los cambios. Intentá de nuevo.');
      },
    });
  }

  hasEditError(name: string): boolean {
    const ctrl = this.editForm.get(name);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  onFotoCambiada(fotoId: string | null): void {
    this.persona.update(p => (p ? { ...p, foto_id: fotoId } : p));
  }

  initials(p: PersonaDetalle): string {
    return `${p.primer_nombre[0]}${p.primer_apellido[0]}`.toUpperCase();
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-UY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'UTC',
    });
  }

  camposQueCuentan(s: SeccionLegajo): CampoLegajo[] {
    return s.campos.filter((c) => c.cuenta !== false);
  }

  /** "Completo" o "4 de 8 cargados". */
  estadoSeccion(s: SeccionLegajo): string {
    const campos = this.camposQueCuentan(s);
    const cargados = campos.filter((c) => !!c.valor).length;
    return cargados === campos.length ? 'Completo' : `${cargados} de ${campos.length} cargados`;
  }

  /** Años cumplidos desde la fecha (edad). */
  aniosDesde(iso: string | null | undefined): number | null {
    const d = this.diferencia(iso);
    return d ? d.anios : null;
  }

  /** "28 años, 8 meses" desde la fecha hasta hoy. */
  tiempoDesde(iso: string | null | undefined): string | null {
    const d = this.diferencia(iso);
    if (!d) return null;
    const anios = `${d.anios} ${d.anios === 1 ? 'año' : 'años'}`;
    if (!d.meses) return anios;
    return `${anios}, ${d.meses} ${d.meses === 1 ? 'mes' : 'meses'}`;
  }

  private diferencia(iso: string | null | undefined): { anios: number; meses: number } | null {
    if (!iso) return null;
    const [y, m, day] = iso.split('T')[0].split('-').map(Number);
    if (!y || !m || !day) return null;
    const hoy = new Date();
    let meses = (hoy.getFullYear() - y) * 12 + (hoy.getMonth() + 1 - m);
    if (hoy.getDate() < day) meses--;
    if (meses < 0) return null;
    return { anios: Math.floor(meses / 12), meses: meses % 12 };
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.toast.success('Copiado al portapapeles'),
      () => this.toast.error('No se pudo copiar'),
    );
  }

  verDerecha(): void {
    this.router.navigate(['/personal/configuracion-derecha']);
  }

  capitalizar(texto: string | null | undefined): string | null {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : null;
  }

  private etiquetaNivelEducativo(valor: string | null | undefined): string | null {
    if (!valor) return null;
    return NIVELES_EDUCATIVOS.find((n) => n.value === valor)?.label ?? valor;
  }

  formatGenero(g: string | null): string {
    if (!g) return '—';
    return ({ M: 'Masculino', F: 'Femenino', O: 'Otro' } as Record<string, string>)[g] ?? g;
  }

  onBusquedaMisionesInput(value: string): void {
    this.busquedaMisiones.set(value);
  }

  onBusquedaDestinosInput(value: string): void {
    this.busquedaDestinos.set(value);
  }

  ordenOBoletin(d: DestinoDePersona): string {
    return [d.numero_orden, d.boletin].filter(Boolean).join(' / ');
  }

  // Solo lectura: con permiso de ver el módulo y al menos un documento. Se arma al llegar los datos.
  private slotsVisibles(permisoVer: string, slots: SlotVista[]): SlotVista[] {
    return this.auth.puedeConAlcance(permisoVer) && slots.some((s) => s.documento) ? slots : [];
  }

  private conSlotsDestino(d: DestinoDePersona): DestinoVista {
    const slots = armarSlots(this.destinosApi.documentos(d.id), d.documentos, { orden: d.numero_orden, boletin: d.boletin }, false);
    return { ...d, slots: this.slotsVisibles('destinos.ver', slots) };
  }

  private conSlotsCurso(c: CursoPersona): CursoVista {
    const api = this.cursosApi.documentosDesignacion(String(c.curso_id), c.id);
    const slots = armarSlots(api, c.documentos, { orden: c.numero_orden, boletin: c.boletin }, false);
    return { ...c, slots: this.slotsVisibles('cursos.ver', slots) };
  }

  private conSlotsMision(m: MisionPersona): MisionVista {
    const apiConvocatoria = this.misionesApi.documentosConvocatoria(m.convocatoria_id);
    const slots = armarSlots(
      this.misionesApi.documentosAsignacion(m.id), m.documentos, { orden: m.numero_orden, boletin: m.boletin }, false,
    ).map((s): SlotVista => {
      const heredado = m.documentos_convocatoria[s.slot];
      return !s.documento && heredado
        ? { ...s, api: apiConvocatoria, documento: heredado, nota: 'de la convocatoria' }
        : s;
    });
    return { ...m, slots: this.slotsVisibles('misiones.ver', slots) };
  }

  volver(): void {
    this.router.navigate(['/personal']);
  }
}
