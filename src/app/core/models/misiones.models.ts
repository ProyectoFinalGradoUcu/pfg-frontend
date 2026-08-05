import { PaginatedResponse } from './auth.models';

// ── Misión (catálogo / definición reutilizable) ──────────────────────────────

export interface MisionDefinicion {
  id: string;
  nombre_mision: string;
  pais: string;
  total_convocatorias: number;
}

export interface CreateMisionDefinicionPayload {
  nombre_mision: string;
  pais: string;
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
  numero_orden?: string;
  boletin?: string;
  fecha_salida?: string;
  fecha_llegada?: string;
  observaciones?: string;
}

// ── Funcionarios asignados a una convocatoria ────────────────────────────────

export interface FuncionarioConvocatoria {
  persona_id: string;
  cedula: string | null;
  primer_nombre: string | null;
  primer_apellido: string | null;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
}

export interface FuncionarioConvocatoriaPayload {
  persona_id: string;
  numero_orden?: string;
  boletin?: string;
  observaciones?: string;
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

export interface FuncionarioConMisiones {
  id: string;
  cedula: string;
  nombre: string;
  misiones: FuncionarioMisionItem[];
}

export interface MisionOpcion {
  id: string;
  nombre_mision: string;
}
