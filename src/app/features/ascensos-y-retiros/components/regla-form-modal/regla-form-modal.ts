import { Component, EventEmitter, HostListener, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { pairwise, startWith } from 'rxjs';
import {
  CONDICIONES_APLICACION,
  CrearReglaPayload,
  CursoDelCatalogo,
  EditarReglaPayload,
  EscalonRegla,
  ImpactoRegla,
  SimularImpactoPayload,
  TIPOS_REQUISITO,
} from '../../../../core/models/ascensos.models';

/**
 * Sirve para crear el tramo que todavía no tiene regla y para editar el
 * vigente. El tiempo mínimo se edita en años y meses, como está escrito el
 * reglamento, y se manda en días.
 */
@Component({
  selector: 'app-regla-form-modal',
  standalone: false,
  templateUrl: './regla-form-modal.html',
  styleUrl: './regla-form-modal.scss',
})
export class ReglaFormModal implements OnInit {
  /** Con `regla` en null es un alta. */
  @Input({ required: true }) escalon!: EscalonRegla;
  /** Solo se usa en alta: los tramos del escalafón que todavía no tienen regla. */
  @Input() escalonesDisponibles: EscalonRegla[] = [];
  @Input() cursos: CursoDelCatalogo[] = [];
  @Input() guardando = false;
  @Input() impacto: ImpactoRegla | null = null;
  @Input() calculandoImpacto = false;

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<CrearReglaPayload | EditarReglaPayload>();
  @Output() verImpacto = new EventEmitter<SimularImpactoPayload>();

  private readonly fb = inject(FormBuilder);

  readonly condiciones = CONDICIONES_APLICACION;
  readonly tipos = TIPOS_REQUISITO;
  readonly cursoBuscado = signal('');
  readonly impactoAbierto = signal(false);

  /** En alta, cuál de los tramos sin regla eligió el usuario. */
  readonly escalonElegido = signal<EscalonRegla | null>(null);

  readonly form: FormGroup = this.fb.group({
    anios: [2, [Validators.required, Validators.min(0), Validators.max(40)]],
    meses: [0, [Validators.required, Validators.min(0), Validators.max(11)]],
    sin_tope_de_edad: [false],
    edad_maxima: [null as number | null, [Validators.min(18), Validators.max(80)]],
    activo: [true],
    requisitos: this.fb.array([]),
  });

  readonly esAlta = computed(() => this.escalon?.regla == null);

  /** El tramo real sobre el que se está trabajando: fijo en edición, elegible en alta. */
  readonly escalonActivo = computed<EscalonRegla | null>(() =>
    this.esAlta() ? this.escalonElegido() : this.escalon,
  );

  get requisitos(): FormArray {
    return this.form.get('requisitos') as FormArray;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrar.emit();
  }

  ngOnInit(): void {
    const regla = this.escalon.regla;

    if (this.esAlta()) {
      this.escalonElegido.set(this.escalonesDisponibles[0] ?? this.escalon);
    }

    this.form.patchValue({
      anios: regla ? regla.anios : 2,
      meses: regla ? regla.meses : 0,
      sin_tope_de_edad: regla ? regla.edad_maxima == null : false,
      edad_maxima: regla?.edad_maxima ?? null,
      activo: regla?.activo ?? true,
    });

    for (const req of regla?.requisitos ?? []) {
      this.pushRequisito({
        tipo: req.tipo,
        descripcion: req.descripcion,
        modo: req.modo ?? 'TODOS',
        aplica_si: req.aplica_si?.length ? req.aplica_si : ['SIEMPRE'],
        anios_antiguedad: req.anios_antiguedad,
        cursos_ids: req.cursos.map((c) => c.id),
      });
    }
  }

  /** Cambiar el tramo elegido en alta: no toca nada más del formulario. */
  elegirEscalon(escalon: EscalonRegla): void {
    this.escalonElegido.set(escalon);
  }

  private pushRequisito(valores: {
    tipo: string;
    descripcion: string;
    modo: string;
    aplica_si: string[];
    anios_antiguedad: number | null;
    cursos_ids: string[];
  }): void {
    const grupo = this.fb.group({
      tipo: [valores.tipo, Validators.required],
      descripcion: [valores.descripcion],
      modo: [valores.modo],
      aplica_si: [valores.aplica_si],
      anios_antiguedad: [valores.anios_antiguedad],
      cursos_ids: [valores.cursos_ids],
    });
    this.aplicarValidadoresPorTipo(grupo);
    this.wireAplicaExclusividad(grupo);
    this.requisitos.push(grupo);
  }

  /** `descripcion` solo hace falta para CURSO_APROBADO; antigüedad se autodescribe. */
  private aplicarValidadoresPorTipo(grupo: FormGroup): void {
    const esAntiguedad = grupo.get('tipo')?.value === 'ANTIGUEDAD_SERVICIO';
    const descripcion = grupo.get('descripcion')!;
    const aniosAntiguedad = grupo.get('anios_antiguedad')!;

    descripcion.setValidators(esAntiguedad ? [] : [Validators.required, Validators.maxLength(200)]);
    aniosAntiguedad.setValidators(esAntiguedad ? [Validators.required, Validators.min(1), Validators.max(60)] : []);
    descripcion.updateValueAndValidity({ emitEvent: false });
    aniosAntiguedad.updateValueAndValidity({ emitEvent: false });
  }

  /** "Siempre" es excluyente con el resto: se detecta qué cambió y se reaplica la regla. */
  private wireAplicaExclusividad(grupo: FormGroup): void {
    const ctrl = grupo.get('aplica_si')!;
    ctrl.valueChanges
      .pipe(startWith(ctrl.value as string[]), pairwise())
      .subscribe(([anterior, actual]: [string[], string[]]) => {
        const agregado = (actual ?? []).find((v) => !(anterior ?? []).includes(v));
        const corregido = this.exclusividadSiempre(anterior ?? [], actual ?? [], agregado);
        if (JSON.stringify(corregido) !== JSON.stringify(actual)) {
          ctrl.setValue(corregido, { emitEvent: false });
        }
      });
  }

  private exclusividadSiempre(anterior: string[], actual: string[], agregado: string | undefined): string[] {
    if (agregado === 'SIEMPRE') return ['SIEMPRE'];
    if (agregado && agregado !== 'SIEMPRE') return actual.filter((v) => v !== 'SIEMPRE');
    if (actual.length === 0) return ['SIEMPRE'];
    return actual;
  }

  agregarRequisito(): void {
    this.pushRequisito({
      tipo: 'CURSO_APROBADO',
      descripcion: '',
      modo: 'TODOS',
      aplica_si: ['SIEMPRE'],
      anios_antiguedad: null,
      cursos_ids: [],
    });
  }

  quitarRequisito(i: number): void {
    this.requisitos.removeAt(i);
  }

  onTipoChange(i: number): void {
    this.aplicarValidadoresPorTipo(this.requisitos.at(i) as FormGroup);
  }

  /** Un requisito de curso sin curso vinculado no se puede evaluar. */
  requisitoSinCurso(i: number): boolean {
    const g = this.requisitos.at(i);
    return g.get('tipo')?.value === 'CURSO_APROBADO' && (g.get('cursos_ids')?.value ?? []).length === 0;
  }

  cursoElegido(i: number, cursoId: string): boolean {
    return ((this.requisitos.at(i).get('cursos_ids')?.value ?? []) as string[]).includes(cursoId);
  }

  alternarCurso(i: number, cursoId: string): void {
    const ctrl = this.requisitos.at(i).get('cursos_ids')!;
    const actuales = (ctrl.value ?? []) as string[];
    ctrl.setValue(
      actuales.includes(cursoId)
        ? actuales.filter((c) => c !== cursoId)
        : [...actuales, cursoId],
    );
  }

  cursosFiltrados(): CursoDelCatalogo[] {
    const q = this.cursoBuscado().trim().toLowerCase();
    if (!q) return this.cursos;
    return this.cursos.filter((c) => (c.nombre_curso ?? '').toLowerCase().includes(q));
  }

  nombreDeCurso(id: string): string {
    return this.cursos.find((c) => c.id === id)?.nombre_curso ?? `Curso ${id}`;
  }

  /** Etiqueta fija del requisito de antigüedad, para mostrarla junto al input. */
  descripcionAntiguedad(i: number): string {
    const anios = Number(this.requisitos.at(i).get('anios_antiguedad')?.value ?? 0);
    return `Antigüedad de servicio: requiere ${anios} ${anios === 1 ? 'año' : 'años'}`;
  }

  toggleImpactoDetalle(): void {
    this.impactoAbierto.update((v) => !v);
  }

  /** En un alta no hay con qué comparar. */
  onVerImpacto(): void {
    if (this.esAlta()) return;
    const armado = this.armarPayload();
    if (!armado) return;
    this.impactoAbierto.set(true);
    this.verImpacto.emit({
      dias_minimos: armado.dias_minimos,
      edad_maxima: armado.edad_maxima,
      requisitos: armado.requisitos,
    });
  }

  onSubmit(): void {
    const base = this.armarPayload();
    if (!base) return;

    this.guardar.emit(
      this.esAlta()
        ? ({ ...base, grado_origen_id: Number(this.escalonActivo()!.grado_origen.id) } as CrearReglaPayload)
        : (base as EditarReglaPayload),
    );
  }

  /** El nombre lo fija el tramo: no se edita desde acá. */
  private nombreDelTramo(): string {
    const escalon = this.escalonActivo();
    return (
      this.escalon.regla?.nombre ??
      `${escalon?.grado_origen.denominacion ?? ''} → ${escalon?.grado_destino?.denominacion ?? ''}`.trim()
    );
  }

  private gradoDestinoId(): string | null {
    return this.escalon.regla?.grado_destino?.id ?? this.escalonActivo()?.grado_destino?.id ?? null;
  }

  /** null si el formulario todavía no está en condiciones de mandarse. */
  private armarPayload(): EditarReglaPayload | null {
    // Sin destino no hay regla posible; el botón de guardar ya está deshabilitado.
    const destino = this.gradoDestinoId();
    if (destino == null) return null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }

    const raw = this.form.getRawValue();
    const dias = Number(raw.anios) * 365 + Number(raw.meses) * 30;
    if (dias <= 0) {
      this.form.get('anios')!.setErrors({ min: true });
      this.form.markAllAsTouched();
      return null;
    }

    const requisitos = (raw.requisitos as Record<string, unknown>[]).map((r, i) => {
      const esAntiguedad = r['tipo'] === 'ANTIGUEDAD_SERVICIO';
      const aniosAntiguedad = esAntiguedad ? Number(r['anios_antiguedad'] ?? 0) : null;
      return {
        tipo: String(r['tipo']),
        descripcion: esAntiguedad
          ? `Antigüedad de servicio: requiere ${aniosAntiguedad} ${aniosAntiguedad === 1 ? 'año' : 'años'}`
          : String(r['descripcion']),
        modo: String(r['modo'] ?? 'TODOS'),
        aplica_si: (r['aplica_si'] as string[]) ?? ['SIEMPRE'],
        anios_antiguedad: aniosAntiguedad,
        orden: i + 1,
        cursos_ids: esAntiguedad ? [] : ((r['cursos_ids'] as string[]) ?? []).map((c) => Number(c)),
      };
    });

    return {
      nombre: this.nombreDelTramo(),
      grado_destino_id: Number(destino),
      dias_minimos: dias,
      edad_maxima: raw.sin_tope_de_edad ? null : (raw.edad_maxima ?? null),
      activo: !!raw.activo,
      requisitos,
    };
  }
}
