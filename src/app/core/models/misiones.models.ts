import { PaginatedResponse } from './auth.models';
import { DocumentosRegistro } from './documentos-registro.models';

// ── Misión (catálogo / definición reutilizable) ──────────────────────────────

export interface MisionDefinicion {
  id: string;
  nombre_mision: string;
  pais: string;
  /** Acto administrativo (orden y resolución) generado por C.G. La resolución viaja como boletin. */
  fecha_orden: string | null;
  boletin: string | null;
  fecha_boletin: string | null;
  resolucion_cje: string | null;
  total_convocatorias: number;
}

export interface CreateMisionDefinicionPayload {
  nombre_mision: string;
  pais: string;
  fecha_orden?: string | null;
  boletin?: string | null;
  fecha_boletin?: string | null;
  resolucion_cje?: string | null;
}

export type UpdateMisionDefinicionPayload = Partial<CreateMisionDefinicionPayload>;

export interface MisionesStats {
  total_misiones: number;
  convocatorias_activas: number;
  personal_desplegado: number;
}

export interface MisionesCatalogoResponse extends PaginatedResponse<MisionDefinicion> {
  stats: MisionesStats;
}

// ── Convocatoria (instancia concreta de dictado de una misión) ──────────────

export interface Convocatoria {
  id: string;
  mision_id: string;
  numero_orden: string | null;
  boletin: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  observaciones: string | null;
  total_funcionarios: number;
  finalizada: boolean;
  /** Ausente en las respuestas de crear y editar: hay que recargar. */
  documentos: DocumentosRegistro;
}

export interface CreateConvocatoriaPayload {
  numero_orden?: string;
  boletin?: string;
  fecha_salida?: string;
  fecha_llegada?: string;
  observaciones?: string;
  persona_ids?: number[];
}

export interface UpdateConvocatoriaPayload {
  numero_orden?: string | null;
  boletin?: string | null;
  fecha_salida?: string | null;
  fecha_llegada?: string | null;
  observaciones?: string | null;
}

// ── Funcionarios asignados a una convocatoria ────────────────────────────────

export interface FuncionarioConvocatoria {
  /** Id de la asignación (no el de la persona). */
  id: string;
  persona_id: string;
  cedula: string | null;
  primer_nombre: string | null;
  primer_apellido: string | null;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  documentos: DocumentosRegistro;
}

export interface AgregarFuncionariosResponse {
  asignaciones: { id: string; persona_id: string }[];
}

export interface FuncionarioConvocatoriaPayload {
  persona_id: string;
  numero_orden?: string;
  boletin?: string;
  observaciones?: string;
}

export interface UpdateFuncionarioConvocatoriaPayload {
  numero_orden?: string | null;
  boletin?: string | null;
  observaciones?: string | null;
}

// ── Personal en misión (tab agrupado por persona, análogo a cursos) ─────────

export interface FuncionarioMisionItem {
  id: string; // id de la MisionDefinicion
  convocatoriaId: string;
  nombre_mision: string;
  pais: string;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  finalizada: boolean;
}

export interface FilaPersonalMision {
  /** Id de la asignación a la convocatoria: la fila de la tabla. */
  asignacionId: string;
  documentos: DocumentosRegistro;
  funcionarioId: string;
  cedula: string;
  nombre: string;
  mision: FuncionarioMisionItem;
}

export interface FiltrosPersonalMision {
  query?: string;
  misionIds?: string[];
  orden?: string;
  finalizada?: boolean;
  categoria?: 'oficial' | 'subalterno';
}

export interface MisionOpcion {
  id: string;
  nombre_mision: string;
}
