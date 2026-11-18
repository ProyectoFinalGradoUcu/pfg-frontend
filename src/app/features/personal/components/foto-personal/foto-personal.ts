import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FotoPersonalService, mensajeErrorFoto } from '../../../../core/services/foto-personal.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Encuadre, conZoom, encuadreInicial, escalaDe, mover, recortarImagen, LADO_VISTA, ZOOM_MAXIMO } from './encuadre';

const TIPOS = ['image/jpeg', 'image/png'];
// El original se procesa en el navegador; lo que se sube es el recorte liviano.
const TAMANIO_MAXIMO_ORIGINAL = 10 * 1024 * 1024;

/** Avatar de la ficha: la foto del funcionario, o sus iniciales si no tiene o no carga. */
@Component({
  selector: 'app-foto-personal',
  standalone: false,
  templateUrl: './foto-personal.html',
  styleUrl: './foto-personal.scss',
})
export class FotoPersonal implements OnChanges, OnDestroy {
  @Input({ required: true }) personaId!: number;
  @Input() fotoId: string | null | undefined = null;
  @Input({ required: true }) iniciales!: string;
  @Input() nombre = '';
  @Input() puedeEditar = false;
  @Output() fotoCambiada = new EventEmitter<string | null>();

  private readonly svc = inject(FotoPersonalService);
  private readonly confirm = inject(ConfirmModalService);
  private readonly toast = inject(ToastService);

  readonly ladoVista = LADO_VISTA;
  readonly zoomMaximo = ZOOM_MAXIMO;

  readonly falloCarga = signal(false);
  readonly abierto = signal(false);
  readonly vista = signal<{ url: string; imagen: HTMLImageElement } | null>(null);
  readonly encuadre = signal<Encuadre | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  private arrastre: { id: number; x: number; y: number } | null = null;

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['fotoId']) this.falloCarga.set(false);
  }

  ngOnDestroy(): void {
    this.descartarVista();
  }

  url(): string | null {
    return this.fotoId ? this.svc.url(this.personaId, this.fotoId) : null;
  }

  abrir(): void {
    this.error.set(null);
    this.abierto.set(true);
  }

  cerrar(): void {
    if (this.guardando()) return;
    this.abierto.set(false);
    this.error.set(null);
    this.descartarVista();
  }

  async elegir(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    if (!TIPOS.includes(archivo.type)) {
      this.error.set('Solo se aceptan imágenes JPG o PNG.');
      return;
    }
    if (archivo.size > TAMANIO_MAXIMO_ORIGINAL) {
      this.error.set('La imagen supera el tamaño máximo de 10 MB.');
      return;
    }

    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.src = url;
    try {
      await imagen.decode();
    } catch {
      URL.revokeObjectURL(url);
      this.error.set('No se pudo leer la imagen.');
      return;
    }

    this.descartarVista();
    this.error.set(null);
    this.vista.set({ url, imagen });
    this.encuadre.set(encuadreInicial(imagen.naturalWidth, imagen.naturalHeight));
  }

  estilo(e: Encuadre): Record<string, string> {
    const escala = escalaDe(e);
    return {
      width: `${e.ancho * escala}px`,
      height: `${e.alto * escala}px`,
      transform: `translate(${e.x}px, ${e.y}px)`,
    };
  }

  cambiarZoom(evento: Event): void {
    const e = this.encuadre();
    if (e) this.encuadre.set(conZoom(e, Number((evento.target as HTMLInputElement).value)));
  }

  empezarArrastre(evento: PointerEvent): void {
    (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
    this.arrastre = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
  }

  arrastrar(evento: PointerEvent): void {
    const e = this.encuadre();
    if (!e || this.arrastre?.id !== evento.pointerId) return;
    this.encuadre.set(mover(e, evento.clientX - this.arrastre.x, evento.clientY - this.arrastre.y));
    this.arrastre = { id: evento.pointerId, x: evento.clientX, y: evento.clientY };
  }

  soltar(evento: PointerEvent): void {
    if (this.arrastre?.id === evento.pointerId) this.arrastre = null;
  }

  async guardar(): Promise<void> {
    const vista = this.vista();
    const e = this.encuadre();
    if (!vista || !e || this.guardando()) return;

    this.guardando.set(true);
    this.error.set(null);
    let imagen: Blob;
    try {
      imagen = await recortarImagen(vista.imagen, e);
    } catch {
      this.guardando.set(false);
      this.error.set('No se pudo procesar la imagen.');
      return;
    }

    this.svc.cargar(this.personaId, imagen).subscribe({
      next: ({ foto_id }) => {
        this.guardando.set(false);
        this.fotoCambiada.emit(foto_id);
        this.toast.success('Foto actualizada');
        this.cerrar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeErrorFoto(err));
      },
    });
  }

  async quitar(): Promise<void> {
    if (this.guardando()) return;
    const confirmado = await this.confirm.confirmar({
      titulo: 'Quitar foto',
      mensaje: 'Se borra la foto del funcionario y vuelven a mostrarse sus iniciales.',
      textoConfirmar: 'Quitar',
    });
    if (!confirmado) return;

    this.guardando.set(true);
    this.error.set(null);
    this.svc.quitar(this.personaId).subscribe({
      next: () => {
        this.guardando.set(false);
        this.fotoCambiada.emit(null);
        this.toast.success('Foto quitada');
        this.cerrar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeErrorFoto(err));
      },
    });
  }

  private descartarVista(): void {
    const vista = this.vista();
    if (vista) URL.revokeObjectURL(vista.url);
    this.vista.set(null);
    this.encuadre.set(null);
    this.arrastre = null;
  }
}
