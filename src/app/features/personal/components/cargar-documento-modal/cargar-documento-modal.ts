import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import {
  ConflictoDocumento,
  DESCRIPCION_MAXIMA,
  DOCUMENTO_EXTENSIONES_PERMITIDAS,
  DocumentoPersonal,
  formatearFechaHora,
  formatearTamanio,
  tituloDocumento,
  validarArchivo,
} from '../../../../core/models/documentos-personal.models';
import {
  DocumentosPersonalService,
  mensajeErrorDocumento,
} from '../../../../core/services/documentos-personal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { parseError, sobreDeError } from '../../../../shared/utils/parse-error';

type Etapa = 'elegir' | 'confirmar';

@Component({
  selector: 'app-cargar-documento-modal',
  standalone: false,
  templateUrl: './cargar-documento-modal.html',
  styleUrl: './cargar-documento-modal.scss',
})
export class CargarDocumentoModal {
  @Input({ required: true }) personaId!: number;

  @Output() readonly cargado = new EventEmitter<DocumentoPersonal>();
  /** Id del documento existente, para resaltarlo en la lista. */
  @Output() readonly conflicto = new EventEmitter<string>();
  @Output() readonly cerrado = new EventEmitter<void>();

  private readonly documentos = inject(DocumentosPersonalService);
  private readonly errorModal = inject(ErrorModalService);

  readonly extensionesPermitidas = DOCUMENTO_EXTENSIONES_PERMITIDAS;
  readonly descripcionMaxima = DESCRIPCION_MAXIMA;
  readonly titulo = tituloDocumento;
  readonly fechaHora = formatearFechaHora;

  readonly archivo = signal<File | null>(null);
  readonly descripcion = signal('');
  readonly arrastrando = signal(false);
  readonly subiendo = signal(false);
  /** `null` si el navegador no informa el total: barra indeterminada. */
  readonly progreso = signal<number | null>(0);
  readonly error = signal<string | null>(null);
  readonly conflictoActual = signal<ConflictoDocumento | null>(null);

  readonly etapa = computed<Etapa>(() => (this.archivo() ? 'confirmar' : 'elegir'));
  readonly tamanioArchivo = computed(() => formatearTamanio(this.archivo()?.size ?? 0));

  readonly textoProgreso = computed(() => {
    const p = this.progreso();
    if (p === null) return 'Subiendo...';
    // Ya subió: falta que el backend lo guarde.
    if (p >= 100) return 'Procesando...';
    return `Subiendo... ${p} %`;
  });

  readonly ayudaConflicto = computed(() => {
    switch (this.conflictoActual()?.motivo) {
      case 'contenido':
        return 'Es el documento que aparece abajo.';
      case 'nombre':
        return 'Renombrá el archivo en tu computadora y elegilo de nuevo.';
      case 'descripcion':
        return 'Cambiá la descripción y volvé a intentar.';
      default:
        return null;
    }
  });

  onArchivoElegido(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    // Si no se limpia, elegir el mismo archivo no dispara `change`.
    input.value = '';
    if (archivo) this.tomar(archivo);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.subiendo()) this.arrastrando.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // También salta al pasar sobre un hijo.
    const tarjeta = event.currentTarget as HTMLElement | null;
    if (!tarjeta?.contains(event.relatedTarget as Node | null)) this.arrastrando.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    if (this.subiendo()) return;
    const archivos = event.dataTransfer?.files;
    if (!archivos || archivos.length === 0) return;
    if (archivos.length > 1) {
      this.conflictoActual.set(null);
      this.error.set('Soltá un solo archivo a la vez.');
      return;
    }
    this.tomar(archivos[0]);
  }

  /** Que el navegador no abra el archivo si se suelta en el fondo. */
  bloquearDrop(event: DragEvent): void {
    event.preventDefault();
  }

  private tomar(archivo: File): void {
    const problema = validarArchivo(archivo);
    if (problema) {
      this.conflictoActual.set(null);
      this.error.set(problema);
      return;
    }
    this.error.set(null);
    this.conflictoActual.set(null);
    this.archivo.set(archivo);
  }

  subir(): void {
    const archivo = this.archivo();
    if (!archivo || this.subiendo()) return;

    this.subiendo.set(true);
    this.progreso.set(0);
    this.error.set(null);
    this.conflictoActual.set(null);

    this.documentos.subir(this.personaId, archivo, this.descripcion()).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.progreso.set(event.total ? Math.round((100 * event.loaded) / event.total) : null);
        } else if (event.type === HttpEventType.Response) {
          this.subiendo.set(false);
          if (event.body) this.cargado.emit(event.body);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.subiendo.set(false);
        if (err.status === 403) {
          this.cerrado.emit();
          this.errorModal.show(parseError(err));
          return;
        }
        if (err.status === 409) {
          const { mensaje, datos } = sobreDeError<ConflictoDocumento>(err);
          this.error.set(mensaje);
          if (datos?.existente) {
            this.conflictoActual.set(datos);
            this.conflicto.emit(datos.existente.id);
          }
          return;
        }
        this.error.set(mensajeErrorDocumento(err));
      },
    });
  }

  cerrar(): void {
    if (this.subiendo()) return;
    this.cerrado.emit();
  }
}
