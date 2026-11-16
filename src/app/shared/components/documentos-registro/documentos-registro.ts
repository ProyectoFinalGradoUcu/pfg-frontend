import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SlotDocumento } from '../../../core/models/documentos-registro.models';
import { SlotVista } from '../../../core/services/documentos-registro';
import { mensajeErrorDocumento } from '../../../core/services/documentos-personal.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';
import { ErrorModalService } from '../../../core/services/error-modal.service';
import { parseError } from '../../utils/parse-error';

/** Orden y boletín de un registro: cada slot habla con su propia API. */
@Component({
  selector: 'app-documentos-registro',
  standalone: false,
  templateUrl: './documentos-registro.html',
  styleUrl: './documentos-registro.scss',
})
export class DocumentosRegistroComponent implements OnChanges {
  private readonly toast = inject(ToastService);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() slots: SlotVista[] = [];
  /** Frase con demostrativo de «¿Quitar «x» de …?», p. ej. «esta orden». */
  @Input() registro = 'este registro';
  /** La ficha ya muestra el número en la tarjeta: ahí solo van la etiqueta y el documento. */
  @Input() mostrarNumero = true;
  @Output() cambio = new EventEmitter<void>();
  @Output() ocupadoCambio = new EventEmitter<boolean>();

  readonly estado = signal<SlotVista[]>([]);
  readonly trabajando = signal<SlotDocumento | null>(null);
  readonly visor = signal<{ slot: SlotDocumento; url: SafeResourceUrl } | null>(null);

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['slots']) {
      this.estado.set(this.slots.map((s) => ({ ...s })));
      // El visor sigue abierto mientras su documento exista (adjuntar en otro slot recarga el padre).
      const v = this.visor();
      if (v && !this.slots.some((s) => s.slot === v.slot && s.documento)) this.visor.set(null);
    }
  }

  visibles(): SlotVista[] {
    return this.estado().filter((s) => !!s.numero?.trim() || !!s.documento);
  }

  porSlot(_: number, s: SlotVista): SlotDocumento {
    return s.slot;
  }

  visorUrl(slot: SlotDocumento): SafeResourceUrl | null {
    const v = this.visor();
    return v?.slot === slot ? v.url : null;
  }

  /** HEAD antes de montar el visor: el `<embed>` no avisa si el documento ya no existe. */
  alternarVisor(s: SlotVista): void {
    if (this.visor()?.slot === s.slot) {
      this.visor.set(null);
      return;
    }
    s.api.inspeccionar(s.slot).subscribe({
      next: () => {
        const url = this.sanitizer.bypassSecurityTrustResourceUrl(s.api.url(s.slot));
        this.visor.set({ slot: s.slot, url });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.errorModal.show(parseError(err));
          return;
        }
        if (err.status === 404) {
          this.toast.error('El documento ya no existe.');
          this.visor.set(null);
          this.cambio.emit();
          return;
        }
        this.toast.error(mensajeErrorDocumento(err));
      },
    });
  }

  adjuntar(s: SlotVista, archivo: File): void {
    this.ocupar(s.slot);
    s.api.subir(s.slot, archivo).subscribe({
      next: (documento) => {
        this.ocupar(null);
        this.fijar(s.slot, documento);
        this.toast.success('Documento adjuntado.');
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.ocupar(null);
        this.toast.error(mensajeErrorDocumento(err));
        // 404 o 409: el registro cambió por otro lado.
        if (err.status === 404 || err.status === 409) this.cambio.emit();
      },
    });
  }

  async quitar(s: SlotVista): Promise<void> {
    if (!s.documento) return;
    const confirmado = await this.confirmModal.confirmar({
      titulo: 'Quitar documento',
      mensaje: `¿Quitar «${s.documento.nombre_original}» de ${this.registro}?`,
      textoConfirmar: 'Quitar',
    });
    if (!confirmado) return;

    this.ocupar(s.slot);
    s.api.quitar(s.slot).subscribe({
      next: () => {
        this.ocupar(null);
        if (this.visor()?.slot === s.slot) this.visor.set(null);
        this.fijar(s.slot, null);
        this.toast.success('Documento quitado.');
        this.cambio.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.ocupar(null);
        this.toast.error(mensajeErrorDocumento(err));
        this.cambio.emit();
      },
    });
  }

  private ocupar(slot: SlotDocumento | null): void {
    this.trabajando.set(slot);
    this.ocupadoCambio.emit(slot !== null);
  }

  private fijar(slot: SlotDocumento, documento: SlotVista['documento']): void {
    this.estado.update((lista) => lista.map((s) => (s.slot === slot ? { ...s, documento } : s)));
  }
}
