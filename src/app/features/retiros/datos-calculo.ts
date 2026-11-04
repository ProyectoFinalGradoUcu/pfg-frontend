import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

// Haber de retiro y porcentaje progresivo: los dos formularios de la reincorporación los piden igual.

const MONEDA = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PORCENTAJE = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 });

const vacio = (v: unknown) => v === null || v === undefined || v === '';

const positivo: ValidatorFn = (c) => (vacio(c.value) || Number(c.value) > 0 ? null : { positivo: true });

function maxDecimales(n: number): ValidatorFn {
  const factor = 10 ** n;
  return (c) => {
    if (vacio(c.value)) return null;
    const escalado = Number(c.value) * factor;
    return Math.abs(escalado - Math.round(escalado)) < 1e-6 ? null : { decimales: n };
  };
}

export const validadoresHaber = [positivo, maxDecimales(2), Validators.max(999999999999.99)];

/** El formulario lo pide en %, no como fracción. */
export const validadoresPorcentaje = [positivo, maxDecimales(2), Validators.max(100)];

/** Con uno solo el backend responde 422. */
export const haberYPorcentajeJuntos: ValidatorFn = (g: AbstractControl): ValidationErrors | null =>
  vacio(g.get('haber_retiro')?.value) === vacio(g.get('porcentaje')?.value) ? null : { haberYPorcentaje: true };

/** El backend quiere la fracción con 4 decimales. */
export function aFraccion(porcentaje: number): number {
  return Math.round(porcentaje * 100) / 10000;
}

export function aPorcentaje(fraccion: number): number {
  return Math.round(fraccion * 10000) / 100;
}

export function redondearHaber(haber: number): number {
  return Math.round(haber * 100) / 100;
}

export function formatoMoneda(valor: number): string {
  return MONEDA.format(valor);
}

export function formatoPorcentaje(fraccion: number): string {
  return `${PORCENTAJE.format(aPorcentaje(fraccion))} %`;
}
