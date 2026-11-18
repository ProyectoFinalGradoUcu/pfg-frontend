import { Paginado } from './destinos.models';

// ── Referencias ───────────────────────────────────────────────────────────────

export interface RefDenominacion {
  id: string;
  denominacion: string;
}

export interface PersonaVuelo {
  id: string;
  cedula: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  /** "PEREZ PEREZ, Juan R.", como en la planilla. */
  nombre_completo: string;
}

// ── Recursos ──────────────────────────────────────────────────────────────────

/** Unidad en la que vuela el personal (Esc. Aér. 5, E.V.B…). No es una `unidades` administrativa. */
export interface UnidadVuelo extends RefDenominacion {
  vigente: boolean;
}

/** 4 por año; el año militar es el año calendario. */
export interface PeriodoVuelo {
  id: string;
  anio: number;
  numero: number;
  /** "3er Período 2026". */
  etiqueta: string;
  /** Cerrado = no admite más cambios hasta reabrirlo. */
  cerrado: boolean;
  creado_en: string;
  /** Solo en el listado; cuentan dentro del alcance del usuario. */
  total_registros?: number;
  registros_editados?: number;
}

/**
 * Horas de una persona en un período. Grado, escalafón y categoría son los que tenía al
 * abrirse el período. `total` lo calcula el backend: la suma de las 4 columnas de horas.
 */
export interface RegistroVuelo {
  id: string;
  periodo_id: string;
  periodo: string;
  persona: PersonaVuelo;
  grado: RefDenominacion | null;
  escalafon: RefDenominacion | null;
  tipo_funcionario: 'oficial' | 'subalterno' | null;
  unidad_vuelo: RefDenominacion | null;
  aeronaves: string | null;
  hs_av_anio_militar: number;
  hs_av_total: number;
  hs_ob_anio_militar: number;
  hs_ob_total: number;
  total: number;
  /** null = fila generada al abrir el período y nunca editada. */
  editado_en: string | null;
}

/** Resumen del período para la categoría elegida; no lleva los filtros de la tabla. */
export interface StatsRegistrosVuelo {
  total: number;
  cargados: number;
  oficiales: number;
  subalternos: number;
  /** Suma de las 4 columnas de los registros ya cargados. */
  horas_cargadas: number;
}

/** Pestañas de la tabla: con todos los filtros salvo el estado. */
export interface ConteosRegistrosVuelo {
  todos: number;
  pendientes: number;
  cargados: number;
}

export interface ListaRegistrosVuelo extends Paginado<RegistroVuelo> {
  periodo: PeriodoVuelo;
  stats: StatsRegistrosVuelo;
  conteos: ConteosRegistrosVuelo;
}

export interface CambioUnidadVuelo {
  id: string;
  periodo_id: string;
  periodo: string;
  unidad_anterior: RefDenominacion | null;
  unidad_nueva: RefDenominacion | null;
  usuario: string | null;
  fecha: string;
}

export interface HistorialVueloPersona {
  persona: { id: string; cedula: string; nombre_completo: string };
  /** Del período más reciente al más viejo. */
  registros: (RegistroVuelo & { periodo_cerrado: boolean })[];
  /** Del más reciente al más viejo. */
  cambios_unidad: CambioUnidadVuelo[];
}

// ── Payloads y queries ────────────────────────────────────────────────────────

export interface CrearPeriodoVueloPayload {
  anio: number;
  numero: number;
}

export interface PeriodoVueloCreado extends PeriodoVuelo {
  registros_generados: number;
}

export interface PeriodoVueloSincronizado extends PeriodoVuelo {
  registros_agregados: number;
}

/** Solo las claves que cambian: el backend corre con `forbidNonWhitelisted`. */
export interface EditarRegistroVueloPayload {
  /** `null` deja a la persona sin unidad de vuelo. */
  unidad_vuelo_id?: number | null;
  aeronaves?: string | null;
  hs_av_anio_militar?: number;
  hs_av_total?: number;
  hs_ob_anio_militar?: number;
  hs_ob_total?: number;
}

/** Filtros del listado; la exportación usa los mismos sin paginar. */
export interface FiltrosRegistrosVuelo {
  query?: string;
  categoria?: 'oficial' | 'subalterno';
  grado_id?: number;
  escalafon_id?: number;
  unidad_vuelo_id?: number;
  /** Gana sobre `unidad_vuelo_id`. */
  sin_unidad?: boolean;
  /** pendientes = nunca editados en el período. */
  estado?: EstadoRegistroVuelo;
}

export type EstadoRegistroVuelo = 'pendientes' | 'cargados';

export interface ListarRegistrosVueloQuery extends FiltrosRegistrosVuelo {
  page?: number;
  pageSize?: number;
}

export interface EditarUnidadVueloPayload {
  denominacion?: string;
  vigente?: boolean;
}
