import { Component, inject } from '@angular/core';
import { ErrorModalService } from '../../services/error-modal.service';

@Component({
  selector: 'app-error-modal',
  standalone: false,
  templateUrl: './error-modal.html',
  styleUrl: './error-modal.scss',
})
export class ErrorModal {
  private readonly errorModal = inject(ErrorModalService);

  readonly state = this.errorModal.state;

  close(): void {
    this.errorModal.close();
  }
}
