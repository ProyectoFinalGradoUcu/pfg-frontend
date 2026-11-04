import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DateInput } from './date-input';

describe('DateInput', () => {
  let fixture: ComponentFixture<DateInput>;
  let component: DateInput;
  let emitidos: string[];

  async function montar(valor: string | null = null, limites: { min?: string; max?: string } = {}) {
    // Mediodía local: el cambio de día no depende del huso de la máquina.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 3, 12));

    await TestBed.configureTestingModule({ declarations: [DateInput] }).compileComponents();
    fixture = TestBed.createComponent(DateInput);
    component = fixture.componentInstance;
    component.min = limites.min;
    component.max = limites.max;
    component.placeholder = 'Desde';
    emitidos = [];
    component.registerOnChange((v) => emitidos.push(v));
    component.writeValue(valor);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const control = () => el().querySelector<HTMLButtonElement>('.appdate__control')!;
  const abrir = () => {
    control().click();
    fixture.detectChanges();
  };
  const dia = (etiqueta: string) => el().querySelector<HTMLButtonElement>(`[aria-label="${etiqueta}"]`)!;
  const mes = () => el().querySelector('.appdate__mes')?.textContent;
  const nav = (etiqueta: string) => {
    el().querySelector<HTMLButtonElement>(`[aria-label="${etiqueta}"]`)!.click();
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('vacío muestra el placeholder', async () => {
    await montar();
    expect(el().querySelector('.appdate__placeholder')?.textContent).toBe('Desde');
    expect(el().querySelector('.appdate__quitar')).toBeNull();
  });

  it('muestra el valor como dd/mm/aaaa', async () => {
    await montar('2026-01-05');
    expect(el().querySelector('.appdate__valor')?.textContent).toBe('05/01/2026');
  });

  it('abre en el mes del valor o, sin valor, en el actual', async () => {
    await montar('2025-02-10');
    abrir();
    expect(mes()).toBe('Febrero 2025');

    TestBed.resetTestingModule();
    await montar();
    abrir();
    expect(mes()).toBe('Noviembre 2026');
  });

  it('la grilla arranca en lunes: noviembre de 2026 empieza domingo', async () => {
    await montar();
    abrir();
    const celdas = [...el().querySelectorAll('.appdate__grilla')[1].children];
    expect(celdas.slice(0, 6).every((c) => c.textContent === '')).toBe(true);
    expect(celdas[6].textContent).toBe('1');
  });

  it('elegir un día emite aaaa-mm-dd y cierra', async () => {
    await montar();
    abrir();

    dia('5 de noviembre de 2026').click();
    fixture.detectChanges();

    expect(emitidos).toEqual(['2026-11-05']);
    expect(el().querySelector('.appdate__panel')).toBeNull();
    expect(el().querySelector('.appdate__valor')?.textContent).toBe('05/11/2026');
  });

  it('navega por mes y por año cruzando el fin de año', async () => {
    await montar('2026-12-15');
    abrir();
    nav('Mes siguiente');
    expect(mes()).toBe('Enero 2027');
    nav('Año anterior');
    expect(mes()).toBe('Enero 2026');
    nav('Mes anterior');
    expect(mes()).toBe('Diciembre 2025');
  });

  it('navegar no cambia el valor', async () => {
    await montar('2026-12-15');
    abrir();
    nav('Mes siguiente');
    expect(emitidos).toEqual([]);
  });

  it('febrero respeta los años bisiestos', async () => {
    await montar('2028-02-01');
    abrir();
    expect(dia('29 de febrero de 2028')).not.toBeNull();
  });

  it('no permite elegir fuera de los límites', async () => {
    await montar(null, { min: '2026-11-10', max: '2026-11-20' });
    abrir();

    expect(dia('9 de noviembre de 2026').disabled).toBe(true);
    expect(dia('10 de noviembre de 2026').disabled).toBe(false);
    expect(dia('20 de noviembre de 2026').disabled).toBe(false);
    expect(dia('21 de noviembre de 2026').disabled).toBe(true);

    component.elegir('2026-11-21');
    expect(emitidos).toEqual([]);
  });

  it('sin valor, abre en el mes permitido si hoy queda fuera de los límites', async () => {
    await montar(null, { max: '2026-03-15' });
    abrir();
    expect(mes()).toBe('Marzo 2026');
  });

  it('"Hoy" elige la fecha local y se deshabilita si queda fuera de los límites', async () => {
    await montar();
    abrir();
    el().querySelector<HTMLButtonElement>('.appdate__hoy')!.click();
    expect(emitidos).toEqual(['2026-11-03']);

    TestBed.resetTestingModule();
    await montar(null, { max: '2026-03-15' });
    abrir();
    expect(el().querySelector<HTMLButtonElement>('.appdate__hoy')!.disabled).toBe(true);
  });

  it('la cruz vacía el valor sin abrir el calendario', async () => {
    await montar('2026-01-05');

    el().querySelector<HTMLElement>('.appdate__quitar')!.click();
    fixture.detectChanges();

    expect(emitidos).toEqual(['']);
    expect(el().querySelector('.appdate__panel')).toBeNull();
    expect(el().querySelector('.appdate__placeholder')).not.toBeNull();
  });

  it('cierra con Escape y con un clic afuera, pero no al navegar', async () => {
    await montar();
    abrir();
    nav('Mes siguiente');
    expect(el().querySelector('.appdate__panel')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el().querySelector('.appdate__panel')).toBeNull();

    abrir();
    document.body.click();
    fixture.detectChanges();
    expect(el().querySelector('.appdate__panel')).toBeNull();
  });

  it('deshabilitado no abre', async () => {
    await montar();
    component.setDisabledState(true);
    fixture.detectChanges();

    component.alternar();
    fixture.detectChanges();

    expect(control().disabled).toBe(true);
    expect(el().querySelector('.appdate__panel')).toBeNull();
  });
});
