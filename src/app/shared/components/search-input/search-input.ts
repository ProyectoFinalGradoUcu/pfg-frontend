import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Buscador de texto de las barras de filtro. No aplica debounce: la pantalla decide
 * cuándo pedir al backend, así cada listado mantiene su propio margen.
 */
@Component({
  selector: 'app-search-input',
  standalone: false,
  templateUrl: './search-input.html',
  styleUrl: './search-input.scss',
})
export class SearchInput {
  @Input() value = '';
  @Input() placeholder = 'Buscar...';
  @Input() ariaLabel: string | null = null;

  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.valueChange.emit(this.value);
  }

  clear(): void {
    this.value = '';
    this.valueChange.emit('');
  }
}
