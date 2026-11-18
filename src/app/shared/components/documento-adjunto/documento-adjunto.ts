import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import {
  DOCUMENTO_EXTENSIONES_PERMITIDAS,
  esImagen,
  esPdf,
  formatearTamanio,
  validarArchivo,
} from '../../../core/models/documentos-personal.models';

/** Un documento adjunto opcional: muestra el que hay (Ver, Descargar, Quitar) o deja elegir uno. */
@Component({
  selector: 'app-documento-adjunto',
  standalone: false,
  templateUrl: './documento-adjunto.html',
  styleUrl: './documento-adjunto.scss',
})
export class DocumentoAdjunto {
  @Input() nombre: string | null = null;
  @Input() tamanio: string | number | null = null;
  @Input() tipo: string | null = null;
  @Input() puedeVer = false;
  @Input() visorUrl: SafeResourceUrl | null = null;
  @Input() urlDescarga: string | null = null;
  @Input() puedeEditar = false;
  @Input() habilitado = true;
  @Input() ocupado = false;

  @Output() elegido = new EventEmitter<File>();
  @Output() quitado = new EventEmitter<void>();
  @Output() verAlternado = new EventEmitter<void>();

  readonly extensiones = DOCUMENTO_EXTENSIONES_PERMITIDAS;
  readonly error = signal<string | null>(null);

  esPdf(): boolean {
    return !!this.tipo && esPdf({ content_type: this.tipo });
  }

  esImagen(): boolean {
    return !!this.tipo && esImagen({ content_type: this.tipo });
  }

  tamanioLegible(): string {
    return this.tamanio === null ? '' : formatearTamanio(this.tamanio);
  }

  onArchivoElegido(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    // Sin esto, volver a elegir el mismo archivo no dispara `change`.
    input.value = '';
    if (!archivo) return;

    const error = validarArchivo(archivo);
    this.error.set(error);
    if (!error) this.elegido.emit(archivo);
  }
}
