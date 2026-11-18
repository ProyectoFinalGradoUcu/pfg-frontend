import { HttpErrorResponse } from '@angular/common/http';

/**
 * Mensaje mostrable a partir de un error HTTP del backend.
 *
 * `responseUnwrapInterceptor` solo desenvuelve las respuestas exitosas, así que los
 * errores llegan todavía dentro de `service_response`. El `http_message` del backend
 * viene redactado para mostrarse tal cual, sin códigos que machear.
 */
export function parseError(err: HttpErrorResponse): string {
  const body = err.error;

  if (typeof body === 'string' && body.trim()) return body.trim();
  if (Array.isArray(body?.message) && body.message.length) return String(body.message[0]);
  if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();

  const envelope = body?.service_response?.service_status?.http_message;
  if (typeof envelope === 'string' && envelope.trim()) return envelope.trim();

  if (err.status === 403) return 'No tenés permiso para realizar esta acción.';
  if (err.status === 404) return 'El recurso no fue encontrado.';
  if (err.status === 0) return 'No se pudo conectar con el servidor.';
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

/** Como `parseError`, pero también devuelve el `service_data` (por ejemplo, el existente de un 409). */
export function sobreDeError<T = unknown>(err: HttpErrorResponse): { mensaje: string; datos: T | null } {
  const sobre = err.error?.service_response;
  const mensaje = sobre?.service_status?.http_message;
  return {
    mensaje: typeof mensaje === 'string' && mensaje.trim() ? mensaje.trim() : parseError(err),
    datos: (sobre?.service_data ?? null) as T | null,
  };
}
