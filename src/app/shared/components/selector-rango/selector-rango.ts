import { Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, inject, signal } from '@angular/core';

export interface RangoNumerico {
  desde: number | null;
  hasta: number | null;
}

/**
 * Rango numérico que se elige como un selector de fechas: el control muestra el
 * rango aplicado y al presionarlo abre "desde" y "hasta" (solo números enteros).
 */
@Component({
  selector: 'app-selector-rango',
  standalone: false,
  templateUrl: './selector-rango.html',
  styleUrl: './selector-rango.scss',
})
export class SelectorRango {
  private readonly elementRef = inject(ElementRef);

  /** Nombre del campo: es el placeholder y el prefijo del valor ("Derecha: 1 – 20"). */
  @Input() etiqueta = '';
  @Input() set desde(v: number | null | undefined) {
    this.aplicado.update((r) => ({ ...r, desde: v ?? null }));
  }
  @Input() set hasta(v: number | null | undefined) {
    this.aplicado.update((r) => ({ ...r, hasta: v ?? null }));
  }
  @Output() rangoChange = new EventEmitter<RangoNumerico>();

  readonly aplicado = signal<RangoNumerico>({ desde: null, hasta: null });
  readonly abierto = signal(false);
  /** Lo que se está escribiendo en el panel, todavía sin aplicar. */
  readonly borradorDesde = signal('');
  readonly borradorHasta = signal('');

  readonly texto = computed(() => {
    const { desde, hasta } = this.aplicado();
    if (desde == null && hasta == null) return null;
    if (desde === hasta) return `${desde}`;
    if (hasta == null) return `desde ${desde}`;
    if (desde == null) return `hasta ${hasta}`;
    return `${desde} – ${hasta}`;
  });

  readonly invertido = computed(() => {
    const d = this.borradorDesde();
    const h = this.borradorHasta();
    return d !== '' && h !== '' && Number(d) > Number(h);
  });

  alternar(): void {
    if (this.abierto()) {
      this.abierto.set(false);
      return;
    }
    const { desde, hasta } = this.aplicado();
    this.borradorDesde.set(desde == null ? '' : String(desde));
    this.borradorHasta.set(hasta == null ? '' : String(hasta));
    this.abierto.set(true);
  }

  /** Bloquea todo lo que no sea un dígito (las teclas de edición y los atajos siguen funcionando). */
  soloDigitos(event: KeyboardEvent): void {
    if (event.key.length === 1 && !/\d/.test(event.key) && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
    }
  }

  /** Por si se pega texto: quedan solo los dígitos, sin ceros adelante. */
  onEscribir(campo: 'desde' | 'hasta', event: Event): void {
    const input = event.target as HTMLInputElement;
    const limpio = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
    input.value = limpio;
    (campo === 'desde' ? this.borradorDesde : this.borradorHasta).set(limpio);
  }

  aplicar(): void {
    if (this.invertido()) return;
    const n = (t: string) => (t === '' ? null : Number(t));
    this.emitir({ desde: n(this.borradorDesde()), hasta: n(this.borradorHasta()) });
  }

  limpiar(event?: Event): void {
    event?.stopPropagation();
    this.emitir({ desde: null, hasta: null });
  }

  private emitir(r: RangoNumerico): void {
    this.aplicado.set(r);
    this.abierto.set(false);
    this.rangoChange.emit(r);
  }

  @HostListener('document:click', ['$event'])
  alClickAfuera(event: MouseEvent): void {
    if (this.abierto() && !this.elementRef.nativeElement.contains(event.target)) this.abierto.set(false);
  }

  @HostListener('keydown.escape')
  alEscape(): void {
    this.abierto.set(false);
  }
}
