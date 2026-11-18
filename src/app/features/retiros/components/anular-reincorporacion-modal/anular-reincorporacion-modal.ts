import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReincorporacionAnulada } from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { parseError } from '../../../../shared/utils/parse-error';

/** Lista lo que deshizo el backend. */
export function mensajeReincorporacionAnulada(r: ReincorporacionAnulada): string {
  const partes = ['Se anuló la reincorporación y se borró la relación laboral nueva'];
  if (r.revertido.destino_borrado) partes.push('se borró el destino que había asignado');
  if (r.revertido.destino_reabierto) partes.push('se reabrió el destino anterior');
  return `${partes.join(', ')}. Ahora se puede anular el retiro.`;
}

@Component({
  selector: 'app-anular-reincorporacion-modal',
  standalone: false,
  templateUrl: './anular-reincorporacion-modal.html',
  styleUrl: './anular-reincorporacion-modal.scss',
})
export class AnularReincorporacionModal {
  private readonly fb = inject(FormBuilder);
  private readonly retirosService = inject(RetirosService);

  @Input({ required: true }) retiroId!: string;

  @Output() anulada = new EventEmitter<ReincorporacionAnulada>();
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

    this.retirosService.anularReincorporacion(this.retiroId, this.form.getRawValue()).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.anulada.emit(r);
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
