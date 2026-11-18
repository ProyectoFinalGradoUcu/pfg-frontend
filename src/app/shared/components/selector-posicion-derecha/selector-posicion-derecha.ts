import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { GradoDerechaDetalle, GrupoNumor } from '../../../core/models/derecha.models';
import { DerechaService } from '../../../core/services/derecha.service';
import { parseError } from '../../utils/parse-error';

/**
 * Se escribe la derecha y el numor que va a tener el funcionario en el grado destino; la
 * lista marca a quiénes corre. Emite posiciones: null = al final, que es el valor por defecto.
 */
@Component({
  selector: 'app-selector-posicion-derecha',
  standalone: false,
  templateUrl: './selector-posicion-derecha.html',
  styleUrl: './selector-posicion-derecha.scss',
})
export class SelectorPosicionDerecha implements OnChanges {
  private readonly derecha = inject(DerechaService);

  @Input() gradoId: number | string | null = null;
  @Input() escalafonId: number | string | null = null;
  @Input() nombre = 'Nuevo funcionario';
  @Input() editable = true;
  @Input() posicion: number | null = null;
  @Input() posicionNumor: number | null = null;

  @Output() posicionChange = new EventEmitter<number | null>();
  @Output() posicionNumorChange = new EventEmitter<number | null>();
  /** La derecha que toma con la posición elegida, para mostrarla fuera del selector. */
  @Output() derechaChange = new EventEmitter<number | null>();

  readonly grado = signal<GradoDerechaDetalle | null>(null);
  readonly grupo = signal<GrupoNumor | null>(null);
  readonly error = signal<string | null>(null);
  readonly errorDerecha = signal<string | null>(null);
  readonly errorNumor = signal<string | null>(null);
  readonly cargando = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gradoId'] || changes['escalafonId']) this.cargar();
  }

  private cargar(): void {
    this.grado.set(null);
    this.grupo.set(null);
    this.error.set(null);
    this.errorDerecha.set(null);
    this.errorNumor.set(null);
    if (!this.gradoId) return;

    this.cargando.set(true);
    this.derecha.obtenerGrado(this.gradoId).subscribe({
      next: (g) => {
        this.grado.set(g);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(parseError(err));
        this.cargando.set(false);
      },
    });
    if (this.escalafonId) {
      this.derecha.obtenerGrupoNumor(this.gradoId, this.escalafonId).subscribe({
        next: (g) => this.grupo.set(g),
        error: () => this.grupo.set(null),
      });
    }
  }

  /** Posición efectiva: la elegida o la última. */
  posicionEfectiva(cantidad: number, elegida: number | null): number {
    return elegida ?? cantidad + 1;
  }

  /** Derecha que toma el primero del grado; null si el grado está vacío. */
  private base(): number | null {
    const g = this.grado();
    return g && g.derecha_desde !== null ? g.derecha_desde : null;
  }

  /** Rango que se puede escribir: del primero del grado hasta quedar último. */
  rangoDerecha(): { desde: number; hasta: number } | null {
    const g = this.grado();
    const base = this.base();
    return g && base !== null ? { desde: base, hasta: base + g.cantidad } : null;
  }

  /** Derecha que tomaría el nuevo, o null si el grado está vacío y no hay referencia. */
  derechaNueva(): number | null {
    const g = this.grado();
    const base = this.base();
    if (!g || base === null) return null;
    return base + this.posicionEfectiva(g.cantidad, this.posicion) - 1;
  }

  /** Corre +1 si queda en la posición elegida o debajo. */
  corre(indice: number, cantidad: number, elegida: number | null): boolean {
    return indice + 1 >= this.posicionEfectiva(cantidad, elegida);
  }

  /** Se escribe la derecha que va a tener; se emite como posición dentro del grado. */
  onDerecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    const g = this.grado();
    const rango = this.rangoDerecha();
    if (!g || !rango) return;
    if (input.value === '') {
      this.errorDerecha.set(null);
      this.emitirPosicion(null);
      return;
    }
    const valor = Number(input.value);
    if (!Number.isInteger(valor) || valor < rango.desde || valor > rango.hasta) {
      this.errorDerecha.set(`La derecha tiene que estar entre ${rango.desde} y ${rango.hasta}.`);
      return;
    }
    this.errorDerecha.set(null);
    const posicion = valor - rango.desde + 1;
    this.emitirPosicion(posicion === g.cantidad + 1 ? null : posicion);
  }

  onNumor(event: Event): void {
    const input = event.target as HTMLInputElement;
    const n = this.grupo();
    if (!n) return;
    if (input.value === '') {
      this.errorNumor.set(null);
      this.emitirPosicionNumor(null);
      return;
    }
    const valor = Number(input.value);
    if (!Number.isInteger(valor) || valor < 1 || valor > n.cantidad + 1) {
      this.errorNumor.set(`El numor tiene que estar entre 1 y ${n.cantidad + 1}.`);
      return;
    }
    this.errorNumor.set(null);
    this.emitirPosicionNumor(valor === n.cantidad + 1 ? null : valor);
  }

  private emitirPosicion(valor: number | null): void {
    this.posicion = valor;
    this.posicionChange.emit(valor);
    this.derechaChange.emit(valor === null ? null : this.derechaNueva());
  }

  private emitirPosicionNumor(valor: number | null): void {
    this.posicionNumor = valor;
    this.posicionNumorChange.emit(valor);
  }
}
