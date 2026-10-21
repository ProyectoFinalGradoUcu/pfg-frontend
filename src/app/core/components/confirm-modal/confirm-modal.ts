import { Component, HostListener, inject } from '@angular/core';
import { ConfirmModalService } from '../../services/confirm-modal.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: false,
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.scss',
})
export class ConfirmModal {
  private readonly confirmModal = inject(ConfirmModalService);

  readonly state = this.confirmModal.state;

  responder(confirmado: boolean): void {
    this.confirmModal.responder(confirmado);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state()) this.responder(false);
  }
}
