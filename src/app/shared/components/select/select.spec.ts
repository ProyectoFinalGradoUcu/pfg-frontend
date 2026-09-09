import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Select } from './select';

interface Opt {
  label: string;
  value: number;
}

describe('Select', () => {
  let component: Select;
  let fixture: ComponentFixture<Select>;

  const opts: Opt[] = Array.from({ length: 60 }, (_, i) => ({
    label: `Persona ${i + 1}`,
    value: i + 1,
  }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Select],
    }).compileComponents();

    fixture = TestBed.createComponent(Select);
    component = fixture.componentInstance;
    component.multiple = true;
    component.items = opts;
    await fixture.whenStable();
  });

  const chipLabels = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.appsel__chip-label') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim() ?? '');

  const summaryChip = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('.appsel__chip--summary');

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Escenario 2 — Regresión: pocos ítems se siguen mostrando individualmente.
  it('lista cada ítem como chip cuando la selección no supera el umbral', () => {
    component.writeValue([1, 2, 3]);
    fixture.detectChanges();

    expect(component.summarizeMulti()).toBe(false);
    expect(chipLabels()).toEqual(['Persona 1', 'Persona 2', 'Persona 3']);
    expect(summaryChip()).toBeNull();
  });

  // Escenario 1 — Comportamiento mejorado: muchas selecciones se resumen en "+N".
  it('resume la selección en un chip "+N" al superar el umbral', () => {
    component.writeValue(opts.map((o) => o.value)); // 60 seleccionados
    fixture.detectChanges();

    expect(component.summarizeMulti()).toBe(true);
    expect(component.summaryChipLabel()).toBe('+60');
    expect(chipLabels()).toEqual([]);
    expect(summaryChip()?.textContent?.trim()).toBe('+60');
  });

  it('respeta un maxChips configurable', () => {
    component.maxChips = 5;
    component.writeValue([1, 2, 3, 4, 5]);
    fixture.detectChanges();
    expect(component.summarizeMulti()).toBe(false);

    component.writeValue([1, 2, 3, 4, 5, 6]);
    fixture.detectChanges();
    expect(component.summarizeMulti()).toBe(true);
  });

  it('removeItem quita solo el ítem elegido y emite el nuevo valor', () => {
    const emitted: unknown[] = [];
    component.registerOnChange((v) => emitted.push(v));
    component.writeValue([1, 2, 3]);
    fixture.detectChanges();

    const stop = vi.fn();
    component.removeItem(opts[1], { stopPropagation: stop } as unknown as MouseEvent);

    expect(stop).toHaveBeenCalled();
    expect(emitted.at(-1)).toEqual([1, 3]);
    expect(component.open()).toBe(false);
  });

  it('no altera el modo simple (un solo valor, sin chips)', () => {
    component.multiple = false;
    component.writeValue(2);
    fixture.detectChanges();

    expect(component.selectedLabel()).toBe('Persona 2');
    expect(chipLabels()).toEqual([]);
    expect(summaryChip()).toBeNull();
  });
});
