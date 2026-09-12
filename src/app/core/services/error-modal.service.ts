import { Injectable, computed, signal } from '@angular/core';

export interface ErrorModalState {
  title: string;
  message: string;
}

/**
 * Errores bloqueantes (típicamente 403: permiso insuficiente o alcance sin unidades
 * asignadas) se muestran acá en vez de con un toast, para que el usuario no se quede
 * con un "error inesperado" que desaparece solo sin entender por qué no pudo actuar.
 */
@Injectable({ providedIn: 'root' })
export class ErrorModalService {
  private readonly stateSignal = signal<ErrorModalState | null>(null);

  readonly state = computed(() => this.stateSignal());

  show(message: string, title = 'Acción no permitida'): void {
    this.stateSignal.set({ title, message });
  }

  close(): void {
    this.stateSignal.set(null);
  }
}
