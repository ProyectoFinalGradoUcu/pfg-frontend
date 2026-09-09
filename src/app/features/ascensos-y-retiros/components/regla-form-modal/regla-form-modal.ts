import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
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

  readonly form: FormGroup = this.fb.group({
    anios: [2, [Validators.required, Validators.min(0), Validators.max(40)]],
    meses: [0, [Validators.required, Validators.min(0), Validators.max(11)]],
    sin_tope_de_edad: [false],
    edad_maxima: [null as number | null, [Validators.min(18), Validators.max(80)]],
    activo: [true],
    requisitos: this.fb.array([]),
  });

  readonly esAlta = computed(() => this.escalon?.regla == null);

  get requisitos(): FormArray {
    return this.form.get('requisitos') as FormArray;
  }

  ngOnInit(): void {
    const regla = this.escalon.regla;

    this.form.patchValue({
      anios: regla ? regla.anios : 2,
      meses: regla ? regla.meses : 0,
      sin_tope_de_edad: regla ? regla.edad_maxima == null : false,
      edad_maxima: regla?.edad_maxima ?? null,
      activo: regla?.activo ?? true,
    });

    for (const req of regla?.requisitos ?? []) {
      this.requisitos.push(
        this.fb.group({
          tipo: [req.tipo, Validators.required],
          descripcion: [req.descripcion, [Validators.required, Validators.maxLength(200)]],
          modo: [req.modo ?? 'TODOS'],
          aplica_si: [req.aplica_si?.length ? req.aplica_si : ['SIEMPRE']],
          cursos_ids: [req.cursos.map((c) => c.id)],
        }),
      );
    }
  }

  agregarRequisito(): void {
    this.requisitos.push(
      this.fb.group({
        tipo: ['CURSO_APROBADO', Validators.required],
        descripcion: ['', [Validators.required, Validators.maxLength(200)]],
        modo: ['TODOS'],
        aplica_si: [['SIEMPRE']],
        cursos_ids: [[] as string[]],
      }),
    );
  }

  quitarRequisito(i: number): void {
    this.requisitos.removeAt(i);
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

  condicionElegida(i: number, valor: string): boolean {
    return ((this.requisitos.at(i).get('aplica_si')?.value ?? []) as string[]).includes(valor);
  }

  /** Marcar «Siempre» limpia el resto. */
  alternarCondicion(i: number, valor: string): void {
    const ctrl = this.requisitos.at(i).get('aplica_si')!;
    const actuales = (ctrl.value ?? []) as string[];

    if (valor === 'SIEMPRE') {
      ctrl.setValue(['SIEMPRE']);
      return;
    }

    const sinSiempre = actuales.filter((c) => c !== 'SIEMPRE');
    const nuevas = sinSiempre.includes(valor)
      ? sinSiempre.filter((c) => c !== valor)
      : [...sinSiempre, valor];
    ctrl.setValue(nuevas.length > 0 ? nuevas : ['SIEMPRE']);
  }

  cursosFiltrados(): CursoDelCatalogo[] {
    const q = this.cursoBuscado().trim().toLowerCase();
    if (!q) return this.cursos;
    return this.cursos.filter((c) => (c.nombre_curso ?? '').toLowerCase().includes(q));
  }

  nombreDeCurso(id: string): string {
    return this.cursos.find((c) => c.id === id)?.nombre_curso ?? `Curso ${id}`;
  }

  /** En un alta no hay con qué comparar. */
  onVerImpacto(): void {
    if (this.esAlta()) return;
    const armado = this.armarPayload();
    if (!armado) return;
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
        ? ({ ...base, grado_origen_id: Number(this.escalon.grado_origen.id) } as CrearReglaPayload)
        : (base as EditarReglaPayload),
    );
  }

  /** El nombre y el destino los fija el tramo: no se editan desde acá. */
  private nombreDelTramo(): string {
    return (
      this.escalon.regla?.nombre ??
      `${this.escalon.grado_origen.denominacion} → ${this.escalon.grado_destino?.denominacion ?? ''}`.trim()
    );
  }

  private gradoDestinoId(): string | null {
    return this.escalon.regla?.grado_destino?.id ?? this.escalon.grado_destino?.id ?? null;
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

    const requisitos = (raw.requisitos as Record<string, unknown>[]).map((r, i) => ({
      tipo: String(r['tipo']),
      descripcion: String(r['descripcion']),
      modo: String(r['modo'] ?? 'TODOS'),
      aplica_si: (r['aplica_si'] as string[]) ?? ['SIEMPRE'],
      orden: i + 1,
      cursos_ids: ((r['cursos_ids'] as string[]) ?? []).map((c) => Number(c)),
    }));

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
