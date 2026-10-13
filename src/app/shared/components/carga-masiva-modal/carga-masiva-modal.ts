import { Component, EventEmitter, HostListener, Input, Output, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CargaMasivaConfig, CargaMasivaResult } from '../../../core/models/carga-masiva.models';
import { CargaMasivaService } from '../../../core/services/carga-masiva.service';
import { parseError } from '../../utils/parse-error';

const MAX_BYTES = 5 * 1024 * 1024;

/** Modal de las cargas masivas. Si `cerrado` emite true, la página tiene que recargar sus datos. */
@Component({
  selector: 'app-carga-masiva-modal',
  standalone: false,
  templateUrl: './carga-masiva-modal.html',
  styleUrl: './carga-masiva-modal.scss',
})
export class CargaMasivaModal {
  private readonly cargaMasiva = inject(CargaMasivaService);

  @Input({ required: true }) config!: CargaMasivaConfig;
  /** `true` si se cargó al menos una fila: la página debería refrescar su listado. */
  @Output() cerrado = new EventEmitter<boolean>();

  readonly archivo = signal<File | null>(null);
  readonly procesando = signal(false);
  readonly descargando = signal(false);
  readonly arrastrando = signal(false);
  readonly resultado = signal<CargaMasivaResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly soloErrores = signal(false);

  readonly filasVisibles = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    return this.soloErrores() ? r.resultados.filter((f) => f.estado === 'error') : r.resultados;
  });

  /** Filas cargadas con archivos anteriores en esta misma apertura del modal. */
  private cargadasAntes = 0;

  @HostListener('document:keydown.escape')
  cerrar(): void {
    if (this.procesando()) return;
    this.cerrado.emit(this.cargadasAntes + (this.resultado()?.exitosos ?? 0) > 0);
  }

  descargarPlantilla(): void {
    this.descargando.set(true);
    this.error.set(null);
    this.cargaMasiva.descargarPlantilla(this.config).subscribe({
      next: () => this.descargando.set(false),
      error: () => {
        this.descargando.set(false);
        this.error.set('No se pudo descargar la plantilla. Intentá de nuevo.');
      },
    });
  }

  onArchivoElegido(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.elegir(input.files?.[0] ?? null);
    // Permite volver a elegir el mismo archivo después de corregirlo.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    this.elegir(event.dataTransfer?.files?.[0] ?? null);
  }

  procesar(): void {
    const archivo = this.archivo();
    if (!archivo) return;
    this.procesando.set(true);
    this.error.set(null);
    this.cargaMasiva.procesar(this.config, archivo).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.soloErrores.set(resultado.errores > 0 && resultado.exitosos > 0);
        this.procesando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(parseError(err));
        this.procesando.set(false);
      },
    });
  }

  /** Vuelve al paso de subida para mandar el archivo corregido. */
  cargarOtro(): void {
    this.cargadasAntes += this.resultado()?.exitosos ?? 0;
    this.resultado.set(null);
    this.archivo.set(null);
    this.error.set(null);
  }

  private elegir(archivo: File | null): void {
    this.error.set(null);
    if (!archivo) return;
    if (!/\.xlsx$/i.test(archivo.name)) {
      this.error.set('El archivo tiene que ser un Excel .xlsx (usá la plantilla).');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      this.error.set('El archivo no puede superar los 5 MB.');
      return;
    }
    this.archivo.set(archivo);
  }
}
