import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RangoNumerico, SelectorRango } from './selector-rango';

describe('SelectorRango', () => {
  let fixture: ComponentFixture<SelectorRango>;
  let component: SelectorRango;
  let emitidos: RangoNumerico[];

  async function montar(desde: number | null = null, hasta: number | null = null): Promise<void> {
    await TestBed.configureTestingModule({ declarations: [SelectorRango] }).compileComponents();
    fixture = TestBed.createComponent(SelectorRango);
    component = fixture.componentInstance;
    component.etiqueta = 'Derecha';
    component.desde = desde;
    component.hasta = hasta;
    emitidos = [];
    component.rangoChange.subscribe((r) => emitidos.push(r));
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const control = () => el().querySelector<HTMLButtonElement>('.sr__control')!;
  const inputs = () => el().querySelectorAll<HTMLInputElement>('.sr__panel input');
  const botonAplicar = () => el().querySelector<HTMLButtonElement>('.sr__btn--primario')!;

  function abrir(): void {
    control().click();
    fixture.detectChanges();
  }

  function escribir(input: HTMLInputElement, valor: string): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('texto del control', () => {
    it('sin rango muestra solo la etiqueta', async () => {
      await montar();
      expect(control().textContent?.trim()).toBe('Derecha');
      expect(el().querySelector('.sr__quitar')).toBeNull();
    });

    it.each([
      [1, 20, '1 – 20'],
      [10, null, 'desde 10'],
      [null, 20, 'hasta 20'],
      [5, 5, '5'],
    ])('desde %s y hasta %s se muestra "%s"', async (desde, hasta, esperado) => {
      await montar(desde, hasta);
      expect(component.texto()).toBe(esperado);
      expect(el().querySelector('.sr__valor')?.textContent).toContain(esperado);
    });
  });

  describe('panel', () => {
    it('al presionar el control abre el panel con el rango aplicado precargado', async () => {
      await montar(3, 8);
      abrir();
      expect(el().querySelector('.sr__panel')).not.toBeNull();
      expect([...inputs()].map((i) => i.value)).toEqual(['3', '8']);
    });

    it('un click afuera lo cierra sin emitir', async () => {
      await montar();
      abrir();
      document.body.click();
      fixture.detectChanges();
      expect(component.abierto()).toBe(false);
      expect(emitidos).toEqual([]);
    });

    it('Escape lo cierra sin emitir', async () => {
      await montar();
      abrir();
      el().querySelector('.sr')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(component.abierto()).toBe(false);
      expect(emitidos).toEqual([]);
    });
  });

  describe('solo números', () => {
    it('bloquea letras y símbolos pero deja pasar dígitos y teclas de edición', async () => {
      await montar();
      const tecla = (key: string, extra: KeyboardEventInit = {}) => {
        const evento = new KeyboardEvent('keydown', { key, cancelable: true, ...extra });
        const preventDefault = vi.spyOn(evento, 'preventDefault');
        component.soloDigitos(evento);
        return preventDefault.mock.calls.length > 0;
      };
      expect(tecla('a')).toBe(true);
      expect(tecla('-')).toBe(true);
      expect(tecla('e')).toBe(true);
      expect(tecla('7')).toBe(false);
      expect(tecla('Backspace')).toBe(false);
      expect(tecla('v', { metaKey: true })).toBe(false);
    });

    it('al pegar texto quedan solo los dígitos, sin ceros adelante', async () => {
      await montar();
      abrir();
      escribir(inputs()[0], 'ab0012x3');
      expect(inputs()[0].value).toBe('123');
      expect(component.borradorDesde()).toBe('123');
    });
  });

  describe('aplicar y limpiar', () => {
    it('Aplicar emite el rango y cierra el panel', async () => {
      await montar();
      abrir();
      escribir(inputs()[0], '2');
      escribir(inputs()[1], '15');
      botonAplicar().click();
      fixture.detectChanges();

      expect(emitidos).toEqual([{ desde: 2, hasta: 15 }]);
      expect(component.abierto()).toBe(false);
      expect(component.texto()).toBe('2 – 15');
    });

    it('un campo vacío queda como rango abierto', async () => {
      await montar();
      abrir();
      escribir(inputs()[1], '30');
      botonAplicar().click();
      expect(emitidos).toEqual([{ desde: null, hasta: 30 }]);
    });

    it('con "desde" mayor que "hasta" avisa y no deja aplicar', async () => {
      await montar();
      abrir();
      escribir(inputs()[0], '20');
      escribir(inputs()[1], '5');

      expect(el().querySelector('.sr__error')).not.toBeNull();
      expect(botonAplicar().disabled).toBe(true);
      component.aplicar();
      expect(emitidos).toEqual([]);
    });

    it('Limpiar del panel emite el rango vacío', async () => {
      await montar(1, 10);
      abrir();
      el().querySelector<HTMLButtonElement>('.sr__btn--texto')!.click();
      expect(emitidos).toEqual([{ desde: null, hasta: null }]);
      expect(component.texto()).toBeNull();
    });

    it('la ✕ del control quita el filtro sin abrir el panel', async () => {
      await montar(1, 10);
      el().querySelector<HTMLElement>('.sr__quitar')!.click();
      fixture.detectChanges();
      expect(emitidos).toEqual([{ desde: null, hasta: null }]);
      expect(component.abierto()).toBe(false);
    });
  });
});
