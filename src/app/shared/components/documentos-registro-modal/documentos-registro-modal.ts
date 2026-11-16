import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SlotVista } from '../../../core/services/documentos-registro';

@Component({
  selector: 'app-documentos-registro-modal',
  standalone: false,
  templateUrl: './documentos-registro-modal.html',
  styleUrl: './documentos-registro-modal.scss',
})
export class DocumentosRegistroModal {
  @Input() titulo = '';
  @Input() slots: SlotVista[] = [];
  @Input() registro = 'este registro';

  @Output() cambio = new EventEmitter<void>();
  @Output() cerrado = new EventEmitter<void>();

  ocupado = false;

  cerrar(): void {
    if (!this.ocupado) this.cerrado.emit();
  }
}
