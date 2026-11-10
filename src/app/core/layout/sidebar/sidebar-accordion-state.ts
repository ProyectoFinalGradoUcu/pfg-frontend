import { Injectable, signal } from '@angular/core';

/**
 * Qué grupo del sidebar está abierto. 
 */
@Injectable()
export class SidebarAccordionState {
  readonly abierto = signal<string | null>(null);
}
