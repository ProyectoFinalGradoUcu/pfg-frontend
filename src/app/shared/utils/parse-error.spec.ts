import { HttpErrorResponse } from '@angular/common/http';
import { parseError } from './parse-error';

function error(body: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: body, status });
}

describe('parseError', () => {
  it('devuelve el http_message del envoltorio del backend', () => {
    const err = error(
      {
        service_response: {
          service_status: { http_status: '409', http_message: 'El funcionario 42 ya tiene un destino activo en esa unidad' },
          service_data: null,
        },
      },
      409,
    );
    expect(parseError(err)).toBe('El funcionario 42 ya tiene un destino activo en esa unidad');
  });

  it('devuelve el primer mensaje cuando el backend manda un array de validaciones', () => {
    expect(parseError(error({ message: ['fecha_inicio must be a valid date', 'boletin should not exist'] })))
      .toBe('fecha_inicio must be a valid date');
  });

  it('devuelve message cuando es un string', () => {
    expect(parseError(error({ message: 'Se requiere al menos número de orden o boletín' })))
      .toBe('Se requiere al menos número de orden o boletín');
  });

  it('devuelve el body cuando el backend responde texto plano', () => {
    expect(parseError(error('  Error crudo  '))).toBe('Error crudo');
  });

  it('usa mensajes por status cuando no hay cuerpo aprovechable', () => {
    expect(parseError(error(null, 403))).toBe('No tenés permiso para realizar esta acción.');
    expect(parseError(error(null, 404))).toBe('El recurso no fue encontrado.');
    expect(parseError(error(null, 0))).toBe('No se pudo conectar con el servidor.');
  });

  it('cae en un mensaje genérico para cualquier otro caso', () => {
    expect(parseError(error(null, 500))).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
  });
});
