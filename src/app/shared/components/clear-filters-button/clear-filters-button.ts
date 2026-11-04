import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Botón 'Borrar filtros' de las barras de filtro; la pantalla define qué se limpia. */
@Component({
  selector: 'app-clear-filters-button',
  standalone: false,
  templateUrl: './clear-filters-button.html',
  styleUrl: './clear-filters-button.scss',
})
export class ClearFiltersButton {
  @Input() disabled = false;
  @Input() label = 'Borrar filtros';

  @Output() limpiar = new EventEmitter<void>();
}
