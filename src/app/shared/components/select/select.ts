import {
  Component,
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

  @Input() items: unknown[] = [];
  @Input() bindLabel = 'label';
  @Input() bindValue = 'value';
  @Input() placeholder = 'Seleccionar...';
  @Input() searchable = false;
  @Input() clearable = false;

  @ViewChild('searchInputRef') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly open = signal(false);
  readonly searchTerm = signal('');
  readonly selectedValue = signal<unknown>(null);
  readonly disabledState = signal(false);

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

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      if (this.open() && this.searchable) {
        queueMicrotask(() => this.searchInputRef?.nativeElement.focus());
      }
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
    this.open.update((v) => !v);
  }

  pick(item: unknown): void {
    const value = this.getValue(item);
    this.selectedValue.set(value);
    this.onChange(value);
    this.onTouched();
    this.searchTerm.set('');
    this.open.set(false);
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedValue.set(null);
    this.onChange(null);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
