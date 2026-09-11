import { Retiro } from '../../core/models/retiros.models';

export const DEBOUNCE_MS = 350;

export type EstadoRetiro = 'vigente' | 'revertido' | 'anulado';

/** `anulado` y `vigente` no son opuestos: son tres estados distintos. */
export function estadoRetiro(r: Pick<Retiro, 'anulado' | 'vigente'>): EstadoRetiro {
  if (r.anulado) return 'anulado';
  return r.vigente ? 'vigente' : 'revertido';
}

/** El grado no va acá: es un dato del retiro y tiene columna propia. */
export function nombreFuncionario(r: Pick<Retiro, 'persona'>): string {
  return `${r.persona.primer_nombre} ${r.persona.primer_apellido}`.trim();
}

export const ETIQUETA_ESTADO: Record<EstadoRetiro, string> = {
  vigente: 'Vigente',
  revertido: 'Revertido',
  anulado: 'Anulado',
};
