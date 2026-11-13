import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PersonalService } from '../../../../core/services/personal.service';
import {
  CambioSituacion,
  CambioSituacionResultado,
  SITUACIONES_DE_ACTIVIDAD,
  SITUACIONES_FUERA_DE_ACTIVIDAD,
  SituacionRef,
} from '../../../../core/models/personal.models';
import { parseError } from '../../../../shared/utils/parse-error';

export interface OpcionCambio {
  cambio: CambioSituacion;
  etiqueta: string;
  /** Qué situación de liquidación queda, para mostrarla antes de confirmar. */
  destino: string;
}

/** Hoy en AAAA-MM-DD, en la hora local: el backend no acepta fechas futuras. */
export function hoyLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Las opciones que admite el backend según la situación actual y la escala. */
export function opcionesDeCambio(codigoActual: string | undefined, tipoFuncionario: string | undefined): OpcionCambio[] {
  const oficial = tipoFuncionario === 'oficial';
  if (codigoActual && SITUACIONES_FUERA_DE_ACTIVIDAD.includes(codigoActual)) {
    return [{ cambio: 'VOLVER_A_ACTIVIDAD', etiqueta: 'Volver a actividad', destino: 'la situación que tenía antes' }];
  }
  if (!codigoActual || !SITUACIONES_DE_ACTIVIDAD.includes(codigoActual)) return [];
  const opciones: OpcionCambio[] = [
    { cambio: 'LICENCIA_SIN_GOCE', etiqueta: 'Licencia sin goce de sueldo', destino: oficial ? 'SIT03' : 'SIT09' },
  ];
  // Liquidación no tiene No Disponible para subalternos.
  if (oficial) opciones.push({ cambio: 'NO_DISPONIBLE', etiqueta: 'No Disponible', destino: 'SIT04' });
  return opciones;
}

function ordenOBoletin(group: AbstractControl): ValidationErrors | null {
  const orden = String(group.get('numero_orden')?.value ?? '').trim();
  const boletin = String(group.get('boletin')?.value ?? '').trim();
  return orden || boletin ? null : { faltaRespaldo: true };
}

@Component({
  selector: 'app-cambiar-situacion-modal',
  standalone: false,
  templateUrl: './cambiar-situacion-modal.html',
  styleUrl: './cambiar-situacion-modal.scss',
})
export class CambiarSituacionModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly svc = inject(PersonalService);

  @Input({ required: true }) personaId!: number;
  @Input() nombre = '';
  @Input({ required: true }) situacion!: SituacionRef | null;
  @Input() tipoFuncionario: string | undefined;

  @Output() guardado = new EventEmitter<CambioSituacionResultado>();
  @Output() cerrado = new EventEmitter<void>();

  readonly hoy = hoyLocal();
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly opciones = signal<OpcionCambio[]>([]);
  readonly elegido = signal<CambioSituacion | null>(null);
  readonly opcionElegida = computed(() => this.opciones().find((o) => o.cambio === this.elegido()) ?? null);
  /** Licencia y No Disponible: liquidación deja de pagarle. */
  readonly dejaDeCobrar = computed(() => {
    const c = this.elegido();
    return c === 'LICENCIA_SIN_GOCE' || c === 'NO_DISPONIBLE';
  });

  readonly form = this.fb.group(
    {
      cambio: this.fb.control<CambioSituacion | null>(null, Validators.required),
      fecha: [this.hoy, Validators.required],
      numero_orden: ['', Validators.maxLength(50)],
      boletin: ['', Validators.maxLength(50)],
      observaciones: ['', Validators.maxLength(500)],
    },
    { validators: ordenOBoletin },
  );

  ngOnInit(): void {
    const opciones = opcionesDeCambio(this.situacion?.codigo, this.tipoFuncionario);
    this.opciones.set(opciones);
    this.form.controls.cambio.valueChanges.subscribe((v) => this.elegido.set(v));
    // Si hay una sola opción (volver a actividad), ya queda elegida.
    if (opciones.length === 1) this.form.controls.cambio.setValue(opciones[0].cambio);
  }

  guardar(): void {
    this.form.markAllAsTouched();
    this.error.set(null);
    const v = this.form.getRawValue();
    if (this.form.invalid || !v.cambio) {
      this.error.set(
        this.form.hasError('faltaRespaldo')
          ? 'Indicá el número de orden o el boletín.'
          : 'Completá los campos obligatorios.',
      );
      return;
    }
    if (v.fecha! > this.hoy) {
      this.error.set('La fecha no puede ser futura: liquidación aplica el cambio en el próximo cálculo.');
      return;
    }
    this.guardando.set(true);
    this.svc
      .cambiarSituacion(this.personaId, {
        cambio: v.cambio,
        fecha: v.fecha!,
        ...(v.numero_orden?.trim() && { numero_orden: v.numero_orden.trim() }),
        ...(v.boletin?.trim() && { boletin: v.boletin.trim() }),
        ...(v.observaciones?.trim() && { observaciones: v.observaciones.trim() }),
      })
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.guardado.emit(r);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(parseError(err));
        },
      });
  }

  cerrar(): void {
    if (!this.guardando()) this.cerrado.emit();
  }
}
