import { Destino, SubUnidadConDestinados } from '../../core/models/destinos.models';

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

/**
 * El destino es la sub-unidad. En históricos viejos `sub_unidad` viene en null y lo
 * único que queda es el comando, así que se cae a él.
 */
export function nombreDestino(d: Destino): string {
  return d.sub_unidad?.denominacion || d.unidad?.denominacion || '—';
}

/** El comando como dato secundario; vacío si no hay sub-unidad (ya se mostró como destino). */
export function comandoDestino(d: Destino): string {
  return d.sub_unidad ? (d.unidad?.denominacion || d.unidad?.codigo || '') : '';
}

/**
 * "B.A.I. (C.A.O.)": la sub-unidad con su comando, para selectores. Mismo formato que la
 * plantilla de carga masiva. Va la denominación y no el código: en el catálogo de
 * liquidación son casi iguales (BAI / B.A.I.) y mostrar los dos solo repite.
 */
export function etiquetaSubUnidad(s: SubUnidadConDestinados): string {
  const nombre = s.denominacion || s.codigo;
  const comando = s.unidad?.denominacion || s.unidad?.codigo;
  const base = comando ? `${nombre} (${comando})` : nombre;
  return s.vigente ? base : `${base} — de baja`;
}
