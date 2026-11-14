import { parseHoras, RegistroVueloModal } from './registro-vuelo-modal';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { VuelosService } from '../../../../core/services/vuelos.service';
import { vi } from 'vitest';

describe('validación de horas anuales', () => {
  it('rechaza anual mayor al total antes de enviar al backend', () => {
    const editarRegistro = vi.fn();
    TestBed.configureTestingModule({ providers: [FormBuilder, { provide: VuelosService, useValue: { editarRegistro } }] });
    const modal = TestBed.runInInjectionContext(() => new RegistroVueloModal());
    modal.form.patchValue({ hs_av_anio_militar: '10', hs_av_total: '9' });
    modal.guardar(false);
    expect(modal.error()).toContain('no pueden superar');
    expect(editarRegistro).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  });
});

describe('parseHoras', () => {
  it('vacío es cero', () => {
    expect(parseHoras('')).toBe(0);
    expect(parseHoras('  ')).toBe(0);
    expect(parseHoras(null)).toBe(0);
  });

  it('acepta coma decimal como en la planilla', () => {
    expect(parseHoras('221,9')).toBe(221.9);
    expect(parseHoras('1531')).toBe(1531);
    expect(parseHoras(4.8)).toBe(4.8);
  });

  it('lo que no es número da NaN', () => {
    expect(parseHoras('abc')).toBeNaN();
  });
});
