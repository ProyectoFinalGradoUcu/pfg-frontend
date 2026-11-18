import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { Impacto, UMBRAL_ALTO_IMPACTO } from '../../../core/models/derecha.models';

/**
 * Antes → después de cada funcionario que corre un cambio de derecha o numor.
 * Sin `conAcciones` es solo informativo (alta y ascenso confirman en su propio formulario).
 */
@Component({
  selector: 'app-panel-impacto',
  standalone: false,
  templateUrl: './panel-impacto.html',
  styleUrl: './panel-impacto.scss',
})
export class PanelImpacto {
  @Input() impacto: Impacto | null = null;
  @Input() cargando = false;
  @Input() error: string | null = null;
  @Input() pendiente = false;
  @Input() confirmando = false;
  @Input() conAcciones = true;
  @Input() textoVacio = 'Mové a un funcionario para ver a quién afecta el cambio.';

  @Output() descartar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<string>();

  readonly umbral = UMBRAL_ALTO_IMPACTO;
  readonly motivo = signal('');

  valor(v: number | null): string {
    return v === null ? '—' : String(v);
  }

  onDescartar(): void {
    this.motivo.set('');
    this.descartar.emit();
  }

  onConfirmar(): void {
    this.confirmar.emit(this.motivo().trim());
  }

  /** Lo llama el padre después de confirmar, para que el motivo no quede para el próximo cambio. */
  limpiarMotivo(): void {
    this.motivo.set('');
  }
}
