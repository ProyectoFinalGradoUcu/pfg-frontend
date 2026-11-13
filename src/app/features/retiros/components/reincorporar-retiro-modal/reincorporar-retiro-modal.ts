import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PreviaReincorporacion,
  ReincorporarBody,
  Reincorporado,
} from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  aFraccion,
  formatoMoneda,
  formatoPorcentaje,
  haberYPorcentajeJuntos,
  redondearHaber,
  validadoresHaber,
  validadoresPorcentaje,
} from '../../datos-calculo';

type Paso = 'datos' | 'confirmar';

export interface ValoresReincorporacion {
  fecha_reincorporacion: string;
  grado_reincorporacion_id: number | null;
  haber_retiro: number | null;
  /** En %, como figura en el acto. */
  porcentaje: number | null;
  /** Base (sub-unidad) a la que vuelve. */
  sub_unidad_id: number | null;
  numero_orden: string;
  boletin: string;
  posicion_destino: string;
  observaciones: string;
}

export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${Number(dia)}/${Number(mes)}/${anio}`;
}

/** Las denominaciones del catálogo a veces traen punto final. */
export function sinPuntoFinal(texto: string): string {
  return texto.replace(/\.\s*$/, '');
}

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function armarBodyReincorporacion(v: ValoresReincorporacion): ReincorporarBody {
  const body: ReincorporarBody = {
    fecha_reincorporacion: v.fecha_reincorporacion,
    grado_reincorporacion_id: Number(v.grado_reincorporacion_id),
    sub_unidad_id: Number(v.sub_unidad_id),
  };
  if (v.haber_retiro !== null && v.porcentaje !== null) {
    body.haber_retiro = redondearHaber(Number(v.haber_retiro));
    body.porcentaje_progresivo = aFraccion(Number(v.porcentaje));
  }
  const opcionales = ['numero_orden', 'boletin', 'posicion_destino', 'observaciones'] as const;
  for (const clave of opcionales) {
    const valor = v[clave].trim();
    if (valor) body[clave] = valor;
  }
  return body;
}

/** La base donde revista hoy y, si no, donde revistaba al retirarse. */
export function baseSugerida(p: PreviaReincorporacion): number | null {
  const id = p.destino_abierto?.sub_unidad?.id ?? p.sub_unidad_anterior?.id;
  return id ? Number(id) : null;
}

export function mensajeReincorporado(r: Reincorporado): string {
  const destino = r.destino.anterior_cerrado
    ? 'Se abrió un destino nuevo y se cerró el anterior.'
    : 'Se abrió un destino nuevo.';
  return `Funcionario reincorporado (${r.relacion_laboral.situacion.codigo}) desde ${fechaCorta(r.relacion_laboral.fecha_inicio)}. ${destino}`;
}

function fechaEntre(min: string | null, max: string): ValidatorFn {
  return (c) => {
    const v = c.value as string;
    if (!v) return null;
    if (min && v < min) return { anteriorAlRetiro: true };
    if (v > max) return { futura: true };
    return null;
  };
}

const ordenOBoletin: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const orden = String(g.get('numero_orden')?.value ?? '').trim();
  const boletin = String(g.get('boletin')?.value ?? '').trim();
  return orden || boletin ? null : { ordenOBoletin: true };
};

@Component({
  selector: 'app-reincorporar-retiro-modal',
  standalone: false,
  templateUrl: './reincorporar-retiro-modal.html',
  styleUrl: './reincorporar-retiro-modal.scss',
})
export class ReincorporarRetiroModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly retirosService = inject(RetirosService);
  private readonly personalService = inject(PersonalService);

  @Input({ required: true }) previa!: PreviaReincorporacion;

  @Output() reincorporado = new EventEmitter<Reincorporado>();
  @Output() cerrado = new EventEmitter<void>();

  readonly paso = signal<Paso>('datos');
  readonly grados = signal<{ id: number; codigo: string; denominacion: string }[]>([]);
  /** Bases con su comando: "B.A.I. (C.A.O.)". */
  readonly bases = signal<{ id: number; etiqueta: string }[]>([]);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly hoy = new Date().toISOString().slice(0, 10);
  minFecha: string | null = null;

  readonly fechaCorta = fechaCorta;
  readonly sinPuntoFinal = sinPuntoFinal;

  readonly form = this.fb.nonNullable.group(
    {
      fecha_reincorporacion: ['', Validators.required],
      grado_reincorporacion_id: [null as number | null, Validators.required],
      haber_retiro: [null as number | null, validadoresHaber],
      porcentaje: [null as number | null, validadoresPorcentaje],
      sub_unidad_id: [null as number | null, Validators.required],
      numero_orden: ['', Validators.maxLength(50)],
      boletin: ['', Validators.maxLength(50)],
      posicion_destino: ['', Validators.maxLength(200)],
      observaciones: [''],
    },
    { validators: [ordenOBoletin, haberYPorcentajeJuntos] },
  );

  ngOnInit(): void {
    const fechaRetiro = this.previa.retiro.fecha_retiro;
    this.minFecha = fechaRetiro ? diaSiguiente(fechaRetiro) : null;
    this.form.controls.fecha_reincorporacion.addValidators(fechaEntre(this.minFecha, this.hoy));

    const grado = this.previa.se_copia.grado;
    this.form.patchValue({
      grado_reincorporacion_id: grado ? Number(grado.id) : null,
      sub_unidad_id: baseSugerida(this.previa),
    });

    // El catálogo por escalafón no sirve acá: deja afuera grados que el backend acepta e incluye cadetes.
    this.grados.set(this.previa.grados_validos.map((g) => ({ ...g, id: Number(g.id) })));
    this.descartarSiNoEsta('grado_reincorporacion_id', this.grados());
    this.personalService.getBases().subscribe({
      next: (b) => {
        this.bases.set(b.map((x) => ({ id: Number(x.id), etiqueta: x.etiqueta })));
        this.descartarSiNoEsta('sub_unidad_id', this.bases());
      },
    });
  }

  /** Un valor por defecto que no está en el catálogo (no vigente) daría 422: mejor que lo elijan. */
  private descartarSiNoEsta(control: 'grado_reincorporacion_id' | 'sub_unidad_id', opciones: { id: number }[]): void {
    const actual = this.form.controls[control].value;
    if (actual !== null && !opciones.some((o) => o.id === actual)) {
      this.form.controls[control].setValue(null);
    }
  }

  faltaRespaldo(): boolean {
    const { numero_orden, boletin } = this.form.controls;
    return this.form.hasError('ordenOBoletin') && (numero_orden.touched || boletin.touched);
  }

  faltaPar(): boolean {
    const { haber_retiro, porcentaje } = this.form.controls;
    return this.form.hasError('haberYPorcentaje') && (haber_retiro.touched || porcentaje.touched);
  }

  nombreGrado(): string {
    const id = this.form.controls.grado_reincorporacion_id.value;
    return this.grados().find((g) => g.id === id)?.denominacion ?? '—';
  }

  nombreBase(): string {
    const id = this.form.controls.sub_unidad_id.value;
    return this.bases().find((b) => b.id === id)?.etiqueta ?? 'la base elegida';
  }

  /** El backend siempre abre un destino con la orden del acto, aunque sea la misma base. */
  efectoDestino(): string | null {
    if (this.form.controls.sub_unidad_id.value === null) return null;
    const d = this.previa.destino_abierto;
    const base = this.nombreBase();

    if (d) {
      const anterior = d.sub_unidad?.denominacion ?? d.unidad?.denominacion ?? 'su base';
      return `Se cierra el destino abierto en ${anterior} el día anterior a la reincorporación y se abre uno nuevo en ${base}.`;
    }
    return `Se abre un destino nuevo en ${base}.`;
  }

  parCargado(): boolean {
    const { haber_retiro, porcentaje } = this.form.controls;
    return haber_retiro.value !== null && porcentaje.value !== null;
  }

  porcentajeIngresado(): string {
    return formatoPorcentaje(aFraccion(Number(this.form.controls.porcentaje.value)));
  }

  moneda(valor: number | null): string {
    return valor === null ? '—' : formatoMoneda(valor);
  }

  /** Método y no `computed`: `form.valid` no es un signal. */
  puedeContinuar(): boolean {
    return this.form.valid && this.previa.bloqueos.length === 0 && !this.enviando();
  }

  irAConfirmar(): void {
    if (!this.puedeContinuar()) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.paso.set('confirmar');
  }

  volverADatos(): void {
    this.paso.set('datos');
  }

  confirmar(): void {
    if (!this.puedeContinuar()) return;

    const body = armarBodyReincorporacion(this.form.getRawValue());

    this.enviando.set(true);
    this.error.set(null);

    this.retirosService.reincorporar(this.previa.retiro.id, body).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.reincorporado.emit(r);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(parseError(err));
        this.paso.set('datos');
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
