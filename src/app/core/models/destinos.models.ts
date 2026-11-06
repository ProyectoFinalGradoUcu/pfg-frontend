
// ── Referencias anidadas ──────────────────────────────────────────────────────

export interface PersonaRef {
  id: string;
  cedula: string;
  primer_nombre: string;
  primer_apellido: string;
}

/** El comando (C.A.O., C.A.P., C.A.L., C.G.): la `unidad` del catálogo de liquidación. */
export interface UnidadRef {
  id: string;
  codigo: string;
  denominacion: string;
}

/** El lugar concreto (B.A.I., E.M.A., ...): lo que la app llama "destino". */
export interface SubUnidadRef {
  id: string;
  codigo: string;
  denominacion: string;
}

// ── Recursos ──────────────────────────────────────────────────────────────────

/**
 * Una asignación: la persona está o estuvo en la sub-unidad entre dos fechas.
 * `sub_unidad` es el destino real; `unidad` es su comando. `sub_unidad` viene en
 * null solo en históricos viejos, y `persona`/`unidad` pueden venir en null en filas
 * cargadas antes del módulo. `activo` lo calcula el backend; no derivarlo de `fecha_fin`.
 */
export interface Destino {
  id: string;
  persona: PersonaRef | null;
  unidad: UnidadRef | null;
  sub_unidad: SubUnidadRef | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  posicion_destino: string | null;
  numero_orden: string | null;
  boletin: string | null;
  numero_destino: string | null;
  fecha_orden: string | null;
  fecha_boletin: string | null;
  numero_resolucion: string | null;
  fecha_resolucion: string | null;
  observaciones: string | null;
  activo: boolean;
}

/**
 * `GET /destinos/sub-unidades`. Unidades y sub-unidades son catálogos de liquidación:
 * la app solo los lee, no los crea, edita ni da de baja.
 */
export interface SubUnidadConDestinados extends SubUnidadRef {
  vigente: boolean;
  /** El comando al que pertenece. */
  unidad: UnidadRef;
  /** Cuenta solo destinos activos, no el histórico. */
  total_destinados: number;
}

/** `GET /catalogos/unidades` — los comandos. El backend manda el id como número; el servicio lo pasa a string. */
export interface Comando {
  id: string;
  codigo: string;
  denominacion: string;
}

/** `GET /personas/:id/destinos` — array plano, sin paginar y aplanado. No es un `Destino`. */
export interface DestinoDePersona {
  id: string;
  unidad_id: string | null;
  unidad: string | null;
  codigo_unidad: string | null;
  /** El destino real; null solo en históricos viejos. `unidad*` es el comando. */
  sub_unidad_id: string | null;
  sub_unidad: string | null;
  codigo_sub_unidad: string | null;
  posicion_destino: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  activo: boolean;
}

// ── Listados ──────────────────────────────────────────────────────────────────

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** `destinos_activos` y `sub_unidades_con_personal` son globales: ignoran los filtros. */
export interface DestinosStats {
  total_destinos: number;
  destinos_activos: number;
  sub_unidades_con_personal: number;
}

export interface ListaDestinos extends Paginado<Destino> {
  stats: DestinosStats;
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CrearDestinoPayload {
  persona_id: number;
  /** El destino. El comando lo deduce el backend. */
  sub_unidad_id: number;
  fecha_inicio: string;
  /** `numero_orden` o `boletin`: al menos uno es obligatorio. */
  numero_orden?: string;
  boletin?: string;
  posicion_destino?: string;
  /** Número de destino (Des Num) y actos administrativos desde C. General. */
  numero_destino?: string;
  fecha_orden?: string;
  fecha_boletin?: string;
  numero_resolucion?: string;
  fecha_resolucion?: string;
  /** Con qué fecha cerrar el destino previo. Omitido = el día anterior a `fecha_inicio`. */
  fecha_fin_anterior?: string;
  observaciones?: string;
}

export interface EditarDestinoPayload {
  fecha_inicio?: string;
  /** Una fecha cierra el destino; `null` lo reabre. */
  fecha_fin?: string | null;
  posicion_destino?: string | null;
  numero_orden?: string | null;
  boletin?: string | null;
  numero_destino?: string | null;
  fecha_orden?: string | null;
  fecha_boletin?: string | null;
  numero_resolucion?: string | null;
  fecha_resolucion?: string | null;
  observaciones?: string | null;
}

export interface DestinoEliminado {
  id: string;
  eliminado: true;
  /** Si se eliminó el vigente: el destino anterior que se reabrió (el que había cerrado el pase). */
  destino_reabierto?: string | null;
}

// ── Query params ──────────────────────────────────────────────────────────────

export interface ListarDestinosQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  /** Filtra por comando. */
  unidad_id?: number;
  sub_unidad_id?: number;
  activo?: boolean;
  categoria?: 'oficial' | 'subalterno';
}

export interface ListarSubUnidadesQuery {
  page?: number;
  pageSize?: number;
  /** Busca en código o denominación. */
  query?: string;
  /** Filtra por comando. */
  unidad_id?: number;
  vigente?: boolean;
}

/** `activo` es del destino; `relacion_estado`, de la relación laboral. */
export interface FuncionarioUnidad extends Destino {
  relacion_estado: 'activo' | 'inactivo' | null;
}

export interface ListarFuncionariosUnidadQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  activo?: boolean;
  categoria?: 'oficial' | 'subalterno';
}
