import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActualizarReincorporacionBody, RetiroDetalle } from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { parseError } from '../../../../shared/utils/parse-error';
import {
  aFraccion,
  aPorcentaje,
  haberYPorcentajeJuntos,
  redondearHaber,
  validadoresHaber,
  validadoresPorcentaje,
} from '../../datos-calculo';

export interface ValoresDatosCalculo {
  grado_reincorporacion_id: number | null;
  haber_retiro: number | null;
  /** En %, como figura en el acto. */
  porcentaje: number | null;
}

/** Solo lo que cambió: si cambia uno del par viajan los dos. */
export function cambiosDatosCalculo(
  inicial: ValoresDatosCalculo,
  actual: ValoresDatosCalculo,
): ActualizarReincorporacionBody {
  const body: ActualizarReincorporacionBody = {};
  if (actual.grado_reincorporacion_id !== null && actual.grado_reincorporacion_id !== inicial.grado_reincorporacion_id) {
    body.grado_reincorporacion_id = Number(actual.grado_reincorporacion_id);
  }
  const parCambiado =
    actual.haber_retiro !== inicial.haber_retiro || actual.porcentaje !== inicial.porcentaje;
  if (parCambiado && actual.haber_retiro !== null && actual.porcentaje !== null) {
    body.haber_retiro = redondearHaber(Number(actual.haber_retiro));
    body.porcentaje_progresivo = aFraccion(Number(actual.porcentaje));
  }
  return body;
}

@Component({
  selector: 'app-datos-calculo-reincorporacion-modal',
  standalone: false,
  templateUrl: './datos-calculo-reincorporacion-modal.html',
  styleUrl: './datos-calculo-reincorporacion-modal.scss',
})
export class DatosCalculoReincorporacionModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly retirosService = inject(RetirosService);

  @Input({ required: true }) retiro!: RetiroDetalle;

  @Output() guardado = new EventEmitter<RetiroDetalle>();
  @Output() cerrado = new EventEmitter<void>();

  readonly grados = signal<{ id: number; denominacion: string }[]>([]);
  readonly gradosListos = signal(false);
  readonly gradosError = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  private inicial!: ValoresDatosCalculo;

  readonly form = this.fb.nonNullable.group(
    {
      grado_reincorporacion_id: [null as number | null],
      haber_retiro: [null as number | null, validadoresHaber],
      porcentaje: [null as number | null, validadoresPorcentaje],
    },
    { validators: haberYPorcentajeJuntos },
  );

  ngOnInit(): void {
    const re = this.retiro.reincorporacion!;
    this.inicial = {
      grado_reincorporacion_id: re.grado_reincorporacion ? Number(re.grado_reincorporacion.id) : null,
      haber_retiro: re.haber_retiro,
      porcentaje: re.porcentaje_progresivo === null ? null : aPorcentaje(re.porcentaje_progresivo),
    };
    this.form.setValue(this.inicial);

    // El backend no tiene cómo vaciarlos: cargados, solo se corrigen.
    if (re.haber_retiro !== null && re.porcentaje_progresivo !== null) {
      this.form.controls.haber_retiro.addValidators(Validators.required);
      this.form.controls.porcentaje.addValidators(Validators.required);
      this.form.updateValueAndValidity();
    }

    const actual = re.grado_reincorporacion;
    const cargado = actual ? [{ id: Number(actual.id), denominacion: actual.denominacion }] : [];
    this.grados.set(cargado);

    // Ya reincorporado, la previa trae un bloqueo por la relación activa: acá solo importan los grados.
    this.retirosService.previaReincorporacion(this.retiro.id).subscribe({
      next: (p) => {
        const opciones = p.grados_validos.map((g) => ({ id: Number(g.id), denominacion: g.denominacion }));
        // El cargado puede no estar entre los válidos de hoy, pero es el que tiene la relación.
        const faltante = cargado.filter((c) => !opciones.some((o) => o.id === c.id));
        this.grados.set([...opciones, ...faltante]);
        this.gradosListos.set(true);
      },
      error: (err: HttpErrorResponse) => this.gradosError.set(parseError(err)),
    });
  }

  faltaPar(): boolean {
    const { haber_retiro, porcentaje } = this.form.controls;
    return this.form.hasError('haberYPorcentaje') && (haber_retiro.touched || porcentaje.touched);
  }

  cambios(): ActualizarReincorporacionBody {
    return cambiosDatosCalculo(this.inicial, this.form.getRawValue());
  }

  /** Método y no `computed`: `form.valid` no es un signal. */
  puedeGuardar(): boolean {
    return this.form.valid && Object.keys(this.cambios()).length > 0 && !this.enviando();
  }

  guardar(): void {
    if (!this.puedeGuardar()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);

    this.retirosService.actualizarReincorporacion(this.retiro.id, this.cambios()).subscribe({
      next: (detalle) => {
        this.enviando.set(false);
        this.guardado.emit(detalle);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
