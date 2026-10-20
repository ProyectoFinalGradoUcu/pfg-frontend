export type EscalaDerecha = 'OFICIALES' | 'SUBALTERNOS';

export const NOMBRES_ESCALA: Record<EscalaDerecha, string> = {
  OFICIALES: 'Oficiales',
  SUBALTERNOS: 'Personal Subalterno',
};

export interface GradoDerechaResumen {
  id: string;
  codigo: string;
  denominacion: string;
  escala: EscalaDerecha;
  cantidad: number;
  derecha_desde: number | null;
  derecha_hasta: number | null;
  /** Cantidad habitual del grado. Superarla es un aviso, no un bloqueo. */
  tope: number | null;
  excede_tope: boolean;
}

export interface EscalaDerechaResumen {
  escala: EscalaDerecha;
  nombre: string;
  grados: GradoDerechaResumen[];
}

export interface IntegranteGrado {
  persona_id: string;
  relacion_id: string;
  nombre: string;
  cedula: string;
  derecha: number | null;
  posicion_grado: number;
  escalafon_id: string;
  escalafon: string | null;
  numor: number | null;
}

export interface GradoDerechaDetalle extends GradoDerechaResumen {
  escalafones: { id: string; codigo: string | null; cantidad: number }[];
  items: IntegranteGrado[];
}

export interface IntegranteNumor {
  persona_id: string;
  relacion_id: string;
  nombre: string;
  cedula: string;
  derecha: number | null;
  numor: number | null;
  posicion: number;
}

export interface GrupoNumor {
  grado: { id: string; codigo: string; denominacion: string };
  escalafon: { id: string; codigo: string | null };
  cantidad: number;
  items: IntegranteNumor[];
}

/** Una fila del padrón de derecha: funcionario en actividad con su grado, escalafón, derecha y numor. */
export interface PersonalDerecha {
  persona_id: string;
  nombre: string;
  cedula: string;
  escala: EscalaDerecha;
  grado_id: string;
  grado: string;
  escalafon_id: string;
  escalafon: string | null;
  derecha: number | null;
  numor: number | null;
}

export interface Afectado {
  persona_id: string | null;
  nombre: string;
  grado: string | null;
  escalafon: string | null;
  antes: number | null;
  despues: number | null;
}

export interface Impacto {
  afectados: number;
  derecha: Afectado[];
  numor: Afectado[];
  avisos: string[];
}

export interface ResultadoCambio extends Impacto {
  lote_id: string | null;
}

export type OperacionPrevisualizable =
  | 'REORDEN'
  | 'REORDEN_NUMOR'
  | 'ALTA'
  | 'BAJA'
  | 'ASCENSO'
  | 'CAMBIO_ESCALAFON';

export interface PrevisualizarPayload {
  operacion: OperacionPrevisualizable;
  persona_id?: number;
  grado_id?: number;
  escalafon_id?: number;
  posicion?: number;
  posicion_numor?: number;
  /** Derecha / numor finales del funcionario (REORDEN por valor). */
  derecha?: number;
  numor?: number;
  orden?: number[];
  cambios?: CambioDerecha[];
}

export interface ReordenarPayload {
  grado_id: number;
  orden: number[];
  motivo?: string;
}

/** Un paso de un lote: un funcionario a una derecha/numor, o el orden completo de un grado. */
export type CambioDerecha =
  | { persona_id: number; derecha?: number; numor?: number }
  | { grado_id: number; orden: number[] };

export interface AplicarCambiosPayload {
  cambios: CambioDerecha[];
  motivo?: string;
}

export interface ReordenarNumorPayload extends ReordenarPayload {
  escalafon_id: number;
}

export type CriterioSugerencia = 'ANTIGUEDAD' | 'EGRESO';

export const CRITERIOS_SUGERENCIA: { value: CriterioSugerencia; label: string; ayuda: string }[] = [
  {
    value: 'ANTIGUEDAD',
    label: 'Antigüedad en el grado',
    ayuda: 'Por fecha de ascenso al grado. Los de la misma tanda se desempatan por egreso de la ETA.',
  },
  {
    value: 'EGRESO',
    label: 'Egreso de la ETA',
    ayuda: 'Por fecha de egreso de la Escuela Técnica.',
  },
];

export interface SugerenciaOrden {
  grado_id: string;
  criterio: CriterioSugerencia;
  orden: string[];
  items: { persona_id: string; nombre: string; ingreso_grado: string | null; egreso_eta: string | null }[];
  sin_datos: string[];
}

export interface HistorialDerechaItem {
  id: string;
  persona_id: string;
  nombre: string;
  tipo: 'DERECHA' | 'NUMOR';
  valor_anterior: number | null;
  valor_nuevo: number | null;
  operacion: 'ALTA' | 'BAJA' | 'REORDEN' | 'ASCENSO' | 'CAMBIO_ESCALAFON';
  motivo: string | null;
  usuario: string | null;
  fecha: string;
  lote_id: string;
}

export interface HistorialDerechaPaginado {
  items: HistorialDerechaItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Más de esta cantidad de afectados se avisa como cambio de alto impacto. */
export const UMBRAL_ALTO_IMPACTO = 3;

// ─── Filtro y orden común (FiltroDerechaNumorDto) ───────────────────────────

export type OrdenarPorDerechaNumor = 'derecha' | 'numor' | 'apellido';
export type DireccionOrden = 'ASC' | 'DESC';

export interface FiltroDerechaNumor {
  derechaDesde?: number | null;
  derechaHasta?: number | null;
  numorDesde?: number | null;
  numorHasta?: number | null;
  gradoId?: number | null;
  escalafonId?: number | null;
  escala?: EscalaDerecha | null;
  ordenarPor?: OrdenarPorDerechaNumor;
  direccion?: DireccionOrden;
}

export const FILTRO_DERECHA_NUMOR_INICIAL: FiltroDerechaNumor = {
  ordenarPor: 'derecha',
  direccion: 'ASC',
};

/** Parámetros de query (o filtros de reporte) con solo los campos cargados. */
export function filtroDerechaNumorParams(f: FiltroDerechaNumor): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(f)) {
    if (valor !== null && valor !== undefined && valor !== '') params[clave] = String(valor);
  }
  return params;
}
