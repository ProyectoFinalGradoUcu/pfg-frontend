import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: false,
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  @Input() title = '';
  @Input() description = '';
  @Input() actionLabel = '';
  @Input() actionLink = '';
}
