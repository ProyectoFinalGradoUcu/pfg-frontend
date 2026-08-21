import { Destino } from '../../core/models/destinos.models';

/**
 * Compartido entre los componentes del módulo Destinos: antes vivía duplicado
 * (byte a byte) en `asignaciones-page.ts`, `unidad-detalle-page.ts`, `unidades-page.ts`
 * y `destino-form-modal.ts`.
 */
export const DEBOUNCE_MS = 350;

export function nombreFuncionario(d: Destino): string {
  if (!d.persona) return '—';
  return [d.persona.primer_nombre, d.persona.primer_apellido].filter(Boolean).join(' ') || '—';
}

export function ordenOBoletin(d: Destino): string {
  return [d.numero_orden, d.boletin].filter(Boolean).join(' / ') || '—';
}

export function trackDestino(_: number, d: Destino): string {
  return d.id;
}
