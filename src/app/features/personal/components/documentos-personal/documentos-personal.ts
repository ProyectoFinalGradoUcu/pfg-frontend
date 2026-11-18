import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  Input,
  OnInit,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  ConflictoDocumento,
  DESCRIPCION_MAXIMA,
  DocumentoPersonal,
  esImagen,
  esPdf,
  formatearFecha,
  formatearFechaHora,
  formatearTamanio,
  tipoDocumento,
  tituloDocumento,
} from '../../../../core/models/documentos-personal.models';
import {
  DocumentosPersonalService,
  mensajeErrorDocumento,
} from '../../../../core/services/documentos-personal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { parseError, sobreDeError } from '../../../../shared/utils/parse-error';

@Component({
  selector: 'app-documentos-personal',
  standalone: false,
  templateUrl: './documentos-personal.html',
  styleUrl: './documentos-personal.scss',
})
export class DocumentosPersonal implements OnInit {
  @Input({ required: true }) personaId!: number;

  @Input() puedeEditar = false;

  private readonly documentosSvc = inject(DocumentosPersonalService);
  private readonly toast = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly documentos = signal<DocumentoPersonal[]>([]);
  readonly cargando = signal(true);
  readonly errorListado = signal<string | null>(null);

  readonly modalCargaAbierto = signal(false);

  /** Documento con el que chocó un 409. */
  readonly resaltadoId = signal<string | null>(null);

  readonly detalleId = signal<string | null>(null);

  readonly visorId = signal<string | null>(null);
  /** Se calcula al abrir: desde el template, cada detección de cambios recargaría el PDF. */
  readonly visorUrl = signal<SafeResourceUrl | null>(null);

  readonly editandoId = signal<string | null>(null);
  readonly descripcionEditada = signal('');
  readonly guardandoId = signal<string | null>(null);
  readonly errorEdicion = signal<string | null>(null);

  readonly aEliminar = signal<DocumentoPersonal | null>(null);
  readonly eliminando = signal(false);

  readonly descripcionMaxima = DESCRIPCION_MAXIMA;

  readonly titulo = tituloDocumento;
  readonly esPdf = esPdf;
  readonly esImagen = esImagen;
  readonly fechaHora = formatearFechaHora;
  readonly fecha = formatearFecha;
  readonly tipo = tipoDocumento;
  readonly porId = (_: number, d: DocumentoPersonal) => d.id;

  ngOnInit(): void {
    this.listar();
  }

  listar(): void {
    this.detalleId.set(null);
    this.cargando.set(true);
    this.errorListado.set(null);
    this.documentosSvc.listar(this.personaId).subscribe({
      next: (docs) => {
        this.documentos.set(docs);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
          this.errorListado.set('No tenés permiso para ver los documentos.');
          return;
        }
        this.errorListado.set('No se pudieron cargar los documentos. Intentá de nuevo.');
      },
    });
  }

  tamanio(d: DocumentoPersonal): string {
    return formatearTamanio(d.tamanio_bytes);
  }

  urlDescarga(d: DocumentoPersonal): string {
    return this.documentosSvc.url(this.personaId, d.id, { descarga: true });
  }

  abrirCarga(): void {
    this.limpiarResaltado();
    this.modalCargaAbierto.set(true);
  }

  onCargado(doc: DocumentoPersonal): void {
    this.modalCargaAbierto.set(false);
    this.limpiarResaltado();
    this.documentos.update((lista) => [doc, ...lista]);
    this.toast.success('Documento cargado');
  }

  onConflicto(id: string): void {
    this.resaltadoId.set(id);
  }

  onCargaCerrada(): void {
    this.modalCargaAbierto.set(false);
    this.scrollAlResaltado();
  }

  alternarDetalle(d: DocumentoPersonal): void {
    this.limpiarResaltado();
    this.detalleId.update((abierto) => (abierto === d.id ? null : d.id));
  }

  /** HEAD antes de montar el visor: el `<embed>` no avisa si el documento ya no existe. */
  alternarVisor(d: DocumentoPersonal): void {
    this.limpiarResaltado();
    if (this.visorId() === d.id) {
      this.cerrarVisor();
      return;
    }
    this.documentosSvc.inspeccionar(this.personaId, d.id).subscribe({
      next: () => {
        this.visorId.set(d.id);
        this.visorUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(this.documentosSvc.url(this.personaId, d.id)),
        );
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
          return;
        }
        if (err.status === 404) {
          this.documentoInexistente();
          return;
        }
        this.toast.error(mensajeErrorDocumento(err));
      },
    });
  }

  private cerrarVisor(): void {
    this.visorId.set(null);
    this.visorUrl.set(null);
  }

  empezarEdicion(d: DocumentoPersonal): void {
    this.limpiarResaltado();
    this.errorEdicion.set(null);
    this.editandoId.set(d.id);
    this.descripcionEditada.set(d.descripcion ?? '');
    this.enfocarEdicion();
  }

  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.errorEdicion.set(null);
  }

  onTeclaEdicion(event: KeyboardEvent, d: DocumentoPersonal): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.guardarDescripcion(d);
    } else if (event.key === 'Escape') {
      this.cancelarEdicion();
    }
  }

  guardarDescripcion(d: DocumentoPersonal): void {
    if (this.guardandoId()) return;
    const texto = this.descripcionEditada().trim();
    const nueva = texto === '' ? null : texto;
    if (nueva === d.descripcion) {
      this.cancelarEdicion();
      return;
    }

    this.guardandoId.set(d.id);
    this.errorEdicion.set(null);
    this.documentosSvc.cambiarDescripcion(this.personaId, d.id, nueva).subscribe({
      next: (actualizado) => {
        this.guardandoId.set(null);
        this.documentos.update((lista) => lista.map((x) => (x.id === actualizado.id ? actualizado : x)));
        this.limpiarResaltado();
        this.cancelarEdicion();
        this.toast.success('Descripción actualizada');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoId.set(null);
        if (err.status === 403) {
          this.cancelarEdicion();
          this.errorModal.show(parseError(err));
          return;
        }
        if (err.status === 404) {
          this.documentoInexistente();
          return;
        }
        if (err.status === 409) {
          const { mensaje, datos } = sobreDeError<ConflictoDocumento>(err);
          this.errorEdicion.set(mensaje);
          if (datos?.existente) this.resaltar(datos.existente.id);
          this.enfocarEdicion();
          return;
        }
        this.errorEdicion.set(mensajeErrorDocumento(err));
        this.enfocarEdicion();
      },
    });
  }

  pedirEliminar(d: DocumentoPersonal): void {
    this.limpiarResaltado();
    this.aEliminar.set(d);
  }

  cancelarEliminar(): void {
    if (!this.eliminando()) this.aEliminar.set(null);
  }

  confirmarEliminar(): void {
    const d = this.aEliminar();
    if (!d || this.eliminando()) return;

    this.eliminando.set(true);
    this.documentosSvc.eliminar(this.personaId, d.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.aEliminar.set(null);
        this.documentos.update((lista) => lista.filter((x) => x.id !== d.id));
        // Si queda montado, el navegador muestra el 404.
        if (this.visorId() === d.id) this.cerrarVisor();
        if (this.detalleId() === d.id) this.detalleId.set(null);
        if (this.editandoId() === d.id) this.cancelarEdicion();
        this.toast.success('Documento eliminado');
      },
      error: (err: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.aEliminar.set(null);
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
          return;
        }
        if (err.status === 404) {
          this.documentoInexistente();
          return;
        }
        this.toast.error(mensajeErrorDocumento(err));
      },
    });
  }

  /** Sin foco en el input, Enter y Escape no andan hasta hacer click. */
  private enfocarEdicion(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>('.docs__input')?.focus(),
      { injector: this.injector },
    );
  }

  private documentoInexistente(): void {
    this.toast.error('El documento ya no existe.');
    this.cancelarEdicion();
    this.cerrarVisor();
    this.listar();
  }

  /** Que un archivo soltado fuera del modal no lo abra el navegador. */
  @HostListener('document:dragover', ['$event'])
  @HostListener('document:drop', ['$event'])
  bloquearArrastre(event: DragEvent): void {
    event.preventDefault();
    if (!this.modalCargaAbierto() && event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  }

  private resaltar(id: string): void {
    this.resaltadoId.set(id);
    this.scrollAlResaltado();
  }

  private limpiarResaltado(): void {
    this.resaltadoId.set(null);
  }

  private scrollAlResaltado(): void {
    const id = this.resaltadoId();
    if (!id) return;
    const ficha = this.host.nativeElement.querySelector(`[data-documento-id="${id}"]`);
    ficha?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }
}
