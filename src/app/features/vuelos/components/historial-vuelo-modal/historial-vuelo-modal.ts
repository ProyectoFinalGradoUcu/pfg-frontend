import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { VuelosService } from '../../../../core/services/vuelos.service';
import { HistorialVueloPersona } from '../../../../core/models/vuelos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { formatoHoras } from '../../horas';

@Component({
  selector: 'app-historial-vuelo-modal',
  standalone: false,
  templateUrl: './historial-vuelo-modal.html',
  styleUrl: './historial-vuelo-modal.scss',
})
export class HistorialVueloModal implements OnInit {
  private readonly vuelosService = inject(VuelosService);

  @Input({ required: true }) personaId!: string;
  @Output() cerrado = new EventEmitter<void>();

  readonly formatoHoras = formatoHoras;

  readonly historial = signal<HistorialVueloPersona | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.vuelosService.historialPersona(this.personaId).subscribe({
      next: (h) => {
        this.historial.set(h);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(parseError(err));
        this.loading.set(false);
      },
    });
  }

  /** La unidad cambió respecto del período anterior (los registros vienen del más reciente al más viejo). */
  cambioUnidad(i: number): boolean {
    const registros = this.historial()?.registros ?? [];
    const previo = registros[i + 1];
    return !!previo && (previo.unidad_vuelo?.id ?? null) !== (registros[i].unidad_vuelo?.id ?? null);
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
