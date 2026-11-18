import { Injectable, computed, signal } from '@angular/core';

export interface ConfirmModalOpciones {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
}

interface ConfirmModalState extends Required<ConfirmModalOpciones> {
  resolver: (confirmado: boolean) => void;
}

/** Confirmación con el estilo de la app, en lugar del `confirm()` del navegador. */
@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private readonly stateSignal = signal<ConfirmModalState | null>(null);

  readonly state = computed(() => this.stateSignal());

  confirmar(opciones: ConfirmModalOpciones): Promise<boolean> {
    this.stateSignal()?.resolver(false);
    return new Promise((resolver) => {
      this.stateSignal.set({
        textoConfirmar: 'Confirmar',
        textoCancelar: 'Cancelar',
        ...opciones,
        resolver,
      });
    });
  }

  responder(confirmado: boolean): void {
    const state = this.stateSignal();
    if (!state) return;
    this.stateSignal.set(null);
    state.resolver(confirmado);
  }
}
