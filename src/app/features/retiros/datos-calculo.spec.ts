import { FormControl, FormGroup } from '@angular/forms';

import {
  aFraccion,
  aPorcentaje,
  formatoMoneda,
  formatoPorcentaje,
  haberYPorcentajeJuntos,
  validadoresHaber,
  validadoresPorcentaje,
} from './datos-calculo';

function par(haber: number | null, porcentaje: number | null): FormGroup {
  return new FormGroup(
    {
      haber_retiro: new FormControl<number | null>(haber, validadoresHaber),
      porcentaje: new FormControl<number | null>(porcentaje, validadoresPorcentaje),
    },
    { validators: haberYPorcentajeJuntos },
  );
}

describe('aFraccion', () => {
  it('pasa el porcentaje a fracción', () => {
    expect(aFraccion(30)).toBe(0.3);
  });

  it('redondea a 4 decimales sin arrastrar error de coma flotante', () => {
    expect(aFraccion(33.33)).toBe(0.3333);
  });
});

describe('aPorcentaje', () => {
  it('pasa la fracción a porcentaje', () => {
    expect(aPorcentaje(0.3)).toBe(30);
  });

  it('redondea a 2 decimales', () => {
    expect(aPorcentaje(0.3333)).toBe(33.33);
  });
});

describe('formatos', () => {
  it('muestra el monto con 2 decimales', () => {
    expect(formatoMoneda(45000.5)).toBe('45.000,50');
  });

  it('muestra la fracción como porcentaje', () => {
    expect(formatoPorcentaje(0.3)).toBe('30 %');
    expect(formatoPorcentaje(0.3333)).toBe('33,33 %');
  });
});

describe('haberYPorcentajeJuntos', () => {
  it('acepta los dos vacíos', () => {
    expect(par(null, null).valid).toBe(true);
  });

  it('acepta los dos cargados', () => {
    expect(par(45000.5, 30).valid).toBe(true);
  });

  it('rechaza uno solo', () => {
    expect(par(45000.5, null).hasError('haberYPorcentaje')).toBe(true);
    expect(par(null, 30).hasError('haberYPorcentaje')).toBe(true);
  });
});

describe('validadores de haber y porcentaje', () => {
  it('el haber no puede ser cero y admite hasta 2 decimales', () => {
    expect(par(0, 30).controls['haber_retiro'].invalid).toBe(true);
    expect(par(100.123, 30).controls['haber_retiro'].invalid).toBe(true);
  });

  it('el porcentaje es mayor que 0 y hasta 100, con hasta 2 decimales', () => {
    expect(par(1, 0).controls['porcentaje'].invalid).toBe(true);
    expect(par(1, 100.5).controls['porcentaje'].invalid).toBe(true);
    expect(par(1, 33.333).controls['porcentaje'].invalid).toBe(true);
    expect(par(1, 100).controls['porcentaje'].valid).toBe(true);
  });
});
