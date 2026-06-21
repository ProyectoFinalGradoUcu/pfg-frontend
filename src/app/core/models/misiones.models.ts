export interface Mision {
  id: string;
  pais: string;
  tipo_mision: string;
  fecha_salida: string;
  fecha_llegada: string;
  numero_orden: string;
  boletin: string;
  observaciones: string;
  comando_responsable: string;
  total_funcionarios: number;
}

export interface MisionesStats {
  total: number;
  activas: number;
  finalizadas: number;
}

export interface MisionesPaginatedData {
  data: Mision[];
  total: number;
  page: number;
  limit: number;
  stats: MisionesStats;
}

export interface FuncionarioMision {
  persona_id: string;
  cedula: string | null;
  primer_nombre: string | null;
  primer_apellido: string | null;
  boletin: string | null;
  observaciones: string | null;
  numero_control_migratorio: string | null;
}

export interface MisionDetalle {
  id: string;
  pais: string | null;
  tipo_mision: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  comando_responsable: string | null;
  total_funcionarios: number;
}

export interface FuncionariosMisionPaginatedData {
  data: FuncionarioMision[];
  total: number;
  page: number;
  limit: number;
}

export interface FuncionarioMisionPayload {
  persona_id: string;
  boletin?: string;
  observaciones?: string;
  numero_control_migratorio?: string;
}

export interface CreateMisionPayload {
  pais?: string;
  tipo_mision?: string;
  fecha_salida?: string;
  fecha_llegada?: string;
  observaciones?: string;
  comando_responsable?: string;
}

export type UpdateMisionPayload = CreateMisionPayload;
