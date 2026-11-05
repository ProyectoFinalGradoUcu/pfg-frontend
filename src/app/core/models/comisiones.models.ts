import { Paginado, PersonaRef } from './destinos.models';

export interface Comision {
  id: string;
  denominacion: string;
  vigente: boolean;
  total_integrantes: number;
}
/** Período laboral en que estaba anotada una comisión importada del Access. */
export interface PeriodoComision {
  fecha_inicio: string | null;
  fecha_fin: string | null;
}
/** Las importadas pueden no tener fecha ni documento: los completa la FAU. */
interface DatosImportada {
  importada: boolean;
  texto_original: string | null;
  periodo: PeriodoComision | null;
}
export interface AsignacionComision extends DatosImportada {
  id: string;
  categoria: 'oficial' | 'subalterno' | 'civil' | null;
  cargo: string | null;
  persona: PersonaRef;
  comision: Pick<Comision, 'id' | 'denominacion' | 'vigente'>;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  numero_orden: string | null;
  boletin: string | null;
  activo: boolean;
}
export interface ComisionDePersona extends DatosImportada {
  id: string;
  cargo: string | null;
  comision_id: string;
  comision: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  numero_orden: string | null;
  boletin: string | null;
  activo: boolean;
}
export interface ComisionesQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  vigente?: boolean;
  activo?: boolean;
  persona_id?: number;
  comision_id?: number;
  categoria?: 'oficial' | 'subalterno';
}
export interface ComisionesStats {
  total_asignaciones: number;
  asignaciones_activas: number;
  comisiones_con_personal: number;
}
export interface ListaAsignacionesComision extends Paginado<AsignacionComision> {
  stats: ComisionesStats;
}
export interface CrearAsignacionComision {
  cargo?: string | null;
  persona_id: number;
  comision_id: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  numero_orden?: string | null;
  boletin?: string | null;
}
export type EditarAsignacionComision = Partial<Omit<CrearAsignacionComision, 'persona_id' | 'comision_id'>>;
export interface CrearLoteAsignacionesComision extends Omit<CrearAsignacionComision, 'persona_id'> {
  persona_ids: number[];
}
