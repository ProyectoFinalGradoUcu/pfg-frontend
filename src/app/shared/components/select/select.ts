import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  effect,
  forwardRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Coordenadas de viewport del panel: se usa `top` o `bottom` según hacia dónde abra. */
interface PanelPos {
  top: number | null;
  bottom: number | null;
  left: number;
  width: number;
  maxHeight: number;
}

@Component({
  selector: 'app-select',
  standalone: false,
  templateUrl: './select.html',
  styleUrl: './select.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true,
    },
  ],
})
export class Select implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input() items: unknown[] = [];
  @Input() bindLabel = 'label';
  @Input() bindValue = 'value';
  @Input() placeholder = 'Seleccionar...';
  @Input() searchable = false;
  @Input() clearable = false;
  /** Selección múltiple: el valor del control pasa a ser un array y el panel no se cierra al elegir. */
  @Input() multiple = false;

  @ViewChild('searchInputRef') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('controlRef') controlRef?: ElementRef<HTMLElement>;

  readonly open = signal(false);
  /**
   * El panel va `position: fixed` con coordenadas de viewport en vez de `absolute`:
   * dentro de un modal (o cualquier contenedor con `overflow`) un panel absoluto
   * queda recortado y obliga a scrollear el modal para elegir.
   */
  readonly panelPos = signal<PanelPos | null>(null);
  /** Abre hacia arriba cuando abajo no hay lugar; invierte los bordes redondeados. */
  readonly flipUp = signal(false);
  readonly searchTerm = signal('');
  // Single: valor escalar. Múltiple: array de valores.
  readonly selectedValue = signal<unknown>(null);
  readonly disabledState = signal(false);

  // ── Single ──────────────────────────────────────────────────────────────
  readonly selectedItem = computed<unknown | null>(() => {
    const value = this.selectedValue();
    if (value === null || value === undefined || value === '') return null;
    return this.items.find((item) => this.getValue(item) === value) ?? null;
  });

  readonly selectedLabel = computed<string | null>(() => {
    const item = this.selectedItem();
    return item === null ? null : String(this.getLabel(item));
  });

  readonly otherFilteredItems = computed<unknown[]>(() => {
    const sel = this.selectedItem();
    const term = this.searchTerm().toLowerCase().trim();
    let list: unknown[] = sel
      ? this.items.filter((item) => this.getValue(item) !== this.getValue(sel))
      : this.items.slice();
    if (this.searchable && term) {
      list = list.filter((item) =>
        String(this.getLabel(item)).toLowerCase().includes(term),
      );
    }
    return list;
  });

  // ── Múltiple ──────────────────────────────────────────────────────────────
  readonly selectedValuesArr = computed<unknown[]>(() => {
    const v = this.selectedValue();
    return Array.isArray(v) ? v : [];
  });

  readonly selectedItemsMulti = computed<unknown[]>(() => {
    const vals = this.selectedValuesArr();
    return this.items.filter((it) => vals.some((v) => v === this.getValue(it)));
  });

  readonly multipleLabel = computed<string | null>(() => {
    const items = this.selectedItemsMulti();
    if (!items.length) return null;
    if (items.length <= 2) {
      return items.map((i) => String(this.getLabel(i))).join(', ');
    }
    return `${items.length} seleccionados`;
  });

  readonly filteredItems = computed<unknown[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    let list = this.items.slice();
    if (this.searchable && term) {
      list = list.filter((item) =>
        String(this.getLabel(item)).toLowerCase().includes(term),
      );
    }
    return list;
  });

  // ── Comunes ────────────────────────────────────────────────────────────────
  readonly displayItems = computed<unknown[]>(() =>
    this.multiple ? this.filteredItems() : this.otherFilteredItems(),
  );

  readonly hasValue = computed<boolean>(() => {
    if (this.multiple) return this.selectedValuesArr().length > 0;
    const v = this.selectedValue();
    return v !== null && v !== undefined && v !== '';
  });

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  /** Aire mínimo entre el panel y el borde del viewport. */
  private static readonly MARGEN = 8;
  /** Debajo de esto no vale la pena abrir hacia abajo. */
  private static readonly ALTO_MINIMO = 160;
  private static readonly ALTO_MAXIMO = 280;

  constructor() {
    effect(() => {
      if (this.open() && this.searchable) {
        queueMicrotask(() => this.searchInputRef?.nativeElement.focus());
      }
    });

    // Capture: los eventos `scroll` de un contenedor interno no burbujean, y el panel
    // tiene que seguir al control cuando se scrollea el modal o la página.
    const reposicionar = () => {
      if (this.open()) this.posicionarPanel();
    };
    window.addEventListener('scroll', reposicionar, true);
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', reposicionar, true));
  }

  private posicionarPanel(): void {
    const control: HTMLElement =
      this.controlRef?.nativeElement ?? (this.elementRef.nativeElement as HTMLElement);
    const rect = control.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rect.bottom - Select.MARGEN;
    const espacioArriba = rect.top - Select.MARGEN;
    const haciaArriba = espacioAbajo < Select.ALTO_MINIMO && espacioArriba > espacioAbajo;

    this.flipUp.set(haciaArriba);
    this.panelPos.set({
      // El -1/+1 solapa el borde del control con el del panel para que se vea una sola línea.
      top: haciaArriba ? null : rect.bottom - 1,
      bottom: haciaArriba ? window.innerHeight - rect.top - 1 : null,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(Select.ALTO_MAXIMO, haciaArriba ? espacioArriba : espacioAbajo),
    });
  }

  writeValue(value: unknown): void {
    this.selectedValue.set(value);
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
    if (isDisabled) this.open.set(false);
  }

  toggle(): void {
    if (this.disabledState()) return;
    this.searchTerm.set('');
    if (!this.open()) this.posicionarPanel();
    this.open.update((v) => !v);
  }

  isSelected(item: unknown): boolean {
    const val = this.getValue(item);
    return this.selectedValuesArr().some((v) => v === val);
  }

  pick(item: unknown): void {
    const value = this.getValue(item);

    if (this.multiple) {
      const current = this.selectedValuesArr();
      const exists = current.some((v) => v === value);
      const next = exists
        ? current.filter((v) => v !== value)
        : [...current, value];
      this.selectedValue.set(next);
      this.onChange(next);
      this.onTouched();
      // Múltiple: el panel queda abierto para seguir agregando.
      return;
    }

    this.selectedValue.set(value);
    this.onChange(value);
    this.onTouched();
    this.searchTerm.set('');
    this.open.set(false);
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    const empty = this.multiple ? [] : null;
    this.selectedValue.set(empty);
    this.onChange(empty);
    this.onTouched();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  getLabelOf(item: unknown): string {
    return String(this.getLabel(item));
  }

  trackItem = (index: number, item: unknown): unknown => this.getValue(item) ?? index;

  private getLabel(item: unknown): unknown {
    if (item === null || item === undefined) return '';
    if (typeof item !== 'object') return item;
    return (item as Record<string, unknown>)[this.bindLabel] ?? item;
  }

  private getValue(item: unknown): unknown {
    if (item === null || item === undefined) return null;
    if (typeof item !== 'object') return item;
    return (item as Record<string, unknown>)[this.bindValue] ?? item;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) this.posicionarPanel();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    // composedPath se calcula al dispatch: robusto aunque el nodo se re-renderice.
    const path = (event.composedPath?.() ?? []) as EventTarget[];
    if (path.includes(host) || host.contains(event.target as Node)) {
      return;
    }
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
