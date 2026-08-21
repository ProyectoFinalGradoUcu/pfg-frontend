
// ── Referencias anidadas ──────────────────────────────────────────────────────

export interface PersonaRef {
  id: string;
  cedula: string;
  primer_nombre: string;
  primer_apellido: string;
}

export interface UnidadRef {
  id: string;
  codigo: string;
  denominacion: string;
  tipo: string | null;
}

// ── Recursos ──────────────────────────────────────────────────────────────────

/**
 * Una asignación: la persona está o estuvo en la unidad entre dos fechas.
 * `persona` y `unidad` pueden venir en null en filas cargadas antes del módulo.
 * `activo` lo calcula el backend; no derivarlo de `fecha_fin`.
 */
export interface Destino {
  id: string;
  persona: PersonaRef | null;
  unidad: UnidadRef | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  posicion_destino: string | null;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  activo: boolean;
}

export interface UnidadConDestinados extends UnidadRef {
  vigente: boolean;
  /** Cuenta solo destinos activos, no el histórico. */
  total_destinados: number;
}

// ── Catálogo de unidades (Task 14) ─────────────────────────────────────────────
//
// Estos tres viven bajo `/catalogos/unidades`, no bajo `/destinos`: una unidad no
// es un destino, y el catálogo lo comparte liquidación a través de
// `relaciones_laborales`. El listado del módulo sigue viniendo de
// `GET /destinos/unidades` (ids como string); `GET /catalogos/unidades` devuelve
// el id como número y sin paginar, así que no se usa para listar.

/** Forma que devuelven los tres endpoints de `/catalogos/unidades`. */
export interface Unidad {
  id: string;
  codigo: string;
  denominacion: string;
  tipo: string | null;
  vigente: boolean;
}

export interface CrearUnidadPayload {
  /** Máx 30. Único (ignorando mayúsculas). Inmutable después de crear. */
  codigo: string;
  /** Máx 150. Única (ignorando mayúsculas). */
  denominacion: string;
  /** Máx 100. `Unidad` u `Organismo`. */
  tipo?: string;
}

/** `codigo` no es un campo válido acá: mandarlo da 400 (`forbidNonWhitelisted`). */
export interface EditarUnidadPayload {
  denominacion?: string;
  /** `null` limpia el tipo. */
  tipo?: string | null;
  /** `false` la saca de los selectores, `true` la reactiva. */
  vigente?: boolean;
}

/** `GET /personas/:id/destinos` — array plano, sin paginar y aplanado. No es un `Destino`. */
export interface DestinoDePersona {
  id: string;
  unidad_id: string | null;
  unidad: string | null;
  codigo_unidad: string | null;
  tipo_unidad: string | null;
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

/** `destinos_activos` y `unidades_con_personal` son globales: ignoran los filtros. */
export interface DestinosStats {
  total_destinos: number;
  destinos_activos: number;
  unidades_con_personal: number;
}

export interface ListaDestinos extends Paginado<Destino> {
  stats: DestinosStats;
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CrearDestinoPayload {
  persona_id: number;
  unidad_id: number;
  fecha_inicio: string;
  /** `numero_orden` o `boletin`: al menos uno es obligatorio. */
  numero_orden?: string;
  boletin?: string;
  posicion_destino?: string;
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
  observaciones?: string | null;
}

export interface DestinoEliminado {
  id: string;
  eliminado: true;
}

// ── Query params ──────────────────────────────────────────────────────────────

export interface ListarDestinosQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  unidad_id?: number;
  activo?: boolean;
}

export interface ListarUnidadesQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  tipo?: 'Unidad' | 'Organismo';
  vigente?: boolean;
}

export interface ListarFuncionariosUnidadQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  activo?: boolean;
}
