import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

/** Required que no acepta solo espacios. */
export const requeridoSinEspacios = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.trim() === '' ? { required: true } : null;

/** Cédula uruguaya: entre 6 y 9 dígitos, sin puntos ni guión (la misma regla que el backend). */
export const validadorCedula = Validators.pattern(/^\d{6,9}$/);
