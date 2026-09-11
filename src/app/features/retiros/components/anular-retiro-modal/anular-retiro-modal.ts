import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RetiroAnulado } from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { parseError } from '../../../../shared/utils/parse-error';

/** Nombra solo lo que el backend deshizo de verdad. */
export function mensajeReversion(r: RetiroAnulado): string {
  const partes: string[] = [];
  if (r.revertido.relacion_laboral) partes.push('Se reabrió la relación laboral');
  if (r.revertido.destino) partes.push('se reabrió el destino');

  const n = r.revertido.inscripciones.length;
  if (n === 1) partes.push('se reactivó 1 inscripción');
  if (n > 1) partes.push(`se reactivaron ${n} inscripciones`);

  if (r.revertido.usuario) partes.push('se reactivó la cuenta');

  return partes.length ? `${partes.join(', ')}.` : 'El retiro fue anulado.';
}

@Component({
  selector: 'app-anular-retiro-modal',
  standalone: false,
  templateUrl: './anular-retiro-modal.html',
  styleUrl: './anular-retiro-modal.scss',
})
export class AnularRetiroModal {
  private readonly fb = inject(FormBuilder);
  private readonly retirosService = inject(RetirosService);

  @Input({ required: true }) retiroId!: string;

  @Output() anulado = new EventEmitter<RetiroAnulado>();
  @Output() cerrado = new EventEmitter<void>();

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  /** Mínimo 5 caracteres, igual que el backend. */
  readonly form = this.fb.nonNullable.group({
    motivo_anulacion: ['', [Validators.required, Validators.minLength(5)]],
  });

  confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.retirosService.anular(this.retiroId, this.form.getRawValue()).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.anulado.emit(r);
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
