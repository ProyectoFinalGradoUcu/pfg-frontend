/** Los ids llegan como string: en el backend son BigInt. */

export interface GradoRefAscensos {
  id: string;
  codigo: string;
  denominacion: string;
  orden: number;
}

export interface UsuarioRefAscensos {
  id: string;
  username: string;
}

export interface CursoDeRequisito {
  id: string;
  nombre_curso: string | null;
  institucion: string | null;
}

export type CondicionAplicacion =
  | 'SIEMPRE'
  | 'ES_MUTADO'
  | 'NO_ES_MUTADO'
  | 'EGRESADO_ETA'
  | 'NO_EGRESADO_ETA'
  | 'NIVEL_LICEAL';

export const CONDICIONES_APLICACION: { value: CondicionAplicacion; label: string }[] = [
  { value: 'SIEMPRE',         label: 'Siempre' },
  { value: 'ES_MUTADO',       label: 'Solo si es mutado' },
  { value: 'NO_ES_MUTADO',    label: 'Solo si no es mutado' },
  { value: 'EGRESADO_ETA',    label: 'Solo si egresó de la ETA' },
  { value: 'NO_EGRESADO_ETA', label: 'Solo si no egresó de la ETA' },
  { value: 'NIVEL_LICEAL',    label: 'Solo si tiene nivel liceal' },
];

export const TIPOS_REQUISITO = [
  { value: 'CURSO_APROBADO',      label: 'Curso aprobado' },
  { value: 'ANTIGUEDAD_SERVICIO', label: 'Antigüedad de servicio' },
];

export interface ReglaRequisito {
  id: string;
  tipo: string;
  descripcion: string;
  modo: 'TODOS' | 'ALGUNO' | string;
  aplica_si: string[];
  parametros: Record<string, unknown> | null;
  orden: number;
  cursos: CursoDeRequisito[];
}

export interface ReglaVersion {
  id: string;
  nombre: string;
  dias_minimos: number;
  edad_maxima: number | null;
  notas: string | null;
  activo: boolean;
  es_por_defecto: boolean;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  actualizado_por: UsuarioRefAscensos | null;
  requisitos: { descripcion: string; aplica_si: string[]; cursos: (string | null)[] }[];
}

export interface ReglaAscenso {
  id: string;
  nombre: string;
  grado_origen: GradoRefAscensos;
  grado_destino: GradoRefAscensos;
  dias_minimos: number;
  anios: number;
  meses: number;
  edad_maxima: number | null;
  notas: string | null;
  es_por_defecto: boolean;
  activo: boolean;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  actualizado_en: string | null;
  actualizado_por: UsuarioRefAscensos | null;
  requisitos: ReglaRequisito[];
  versiones_anteriores?: ReglaVersion[];
}

/** Un tramo de la escalera, con o sin regla cargada. */
export interface EscalonRegla {
  grado_origen: GradoRefAscensos;
  grado_destino: GradoRefAscensos | null;
  funcionarios_en_grado: number;
  regla: ReglaAscenso | null;
}

export interface GrupoEscalera {
  clave: string;
  nombre: string;
  escalones: EscalonRegla[];
}

export interface EscaleraReglas {
  grupos: GrupoEscalera[];
  stats: {
    tramos_con_regla: number;
    tramos_activos: number;
    reglas_modificadas: number;
  };
}

export interface RequisitoPayload {
  tipo: string;
  descripcion: string;
  modo?: string;
  aplica_si?: string[];
  parametros?: Record<string, unknown>;
  orden?: number;
  cursos_ids?: number[];
}

export interface CrearReglaPayload {
  nombre: string;
  grado_origen_id: number;
  grado_destino_id: number;
  dias_minimos: number;
  edad_maxima?: number | null;
  notas?: string | null;
  activo?: boolean;
  requisitos?: RequisitoPayload[];
}

export interface EditarReglaPayload {
  nombre?: string;
  grado_destino_id?: number;
  dias_minimos?: number;
  edad_maxima?: number | null;
  notas?: string | null;
  activo?: boolean;
  requisitos?: RequisitoPayload[];
}

export interface CursoDelCatalogo {
  id: string;
  nombre_curso: string | null;
  institucion: string | null;
}

// ─── Motor de elegibilidad ─────────────────────────────────────────────────

export type EstadoElegibilidad =
  | 'PASIBLE'
  | 'PROXIMO'
  | 'BLOQUEADO'
  | 'FUERA_DE_EDAD'
  | 'SIN_REGLA'
  | 'TOPE_DE_ESCALA';

export const ESTADOS_ELEGIBILIDAD: { value: EstadoElegibilidad; label: string; ayuda: string }[] = [
  { value: 'PASIBLE',        label: 'Pasible',        ayuda: 'Puede ir en la próxima orden' },
  { value: 'PROXIMO',        label: 'Próximo',        ayuda: 'Solo le falta tiempo en el grado' },
  { value: 'BLOQUEADO',      label: 'Bloqueado',      ayuda: 'Le falta un curso o su situación lo impide' },
  { value: 'FUERA_DE_EDAD',  label: 'Fuera de edad',  ayuda: 'Ya no puede ascender por esta regla' },
  { value: 'SIN_REGLA',      label: 'Sin regla',      ayuda: 'Su grado no tiene una regla cargada' },
  { value: 'TOPE_DE_ESCALA', label: 'Tope de escala', ayuda: 'Está en el último grado de su escala' },
];

export type EstadoCurso =
  | 'APROBADO'
  | 'EN_CURSO'
  | 'NO_APROBADO'
  | 'DADO_DE_BAJA'
  | 'NO_REALIZADO';

export const ETIQUETAS_ESTADO_CURSO: Record<EstadoCurso, string> = {
  APROBADO: 'Aprobado',
  EN_CURSO: 'En curso',
  NO_APROBADO: 'No aprobado',
  DADO_DE_BAJA: 'Dado de baja',
  NO_REALIZADO: 'No realizado',
};

export interface CursoEvaluado {
  id: string;
  nombre: string;
  estado: EstadoCurso;
}

export interface RequisitoEvaluado {
  tipo: string;
  descripcion: string;
  aplica: boolean;
  cumple: boolean;
  detalle: string;
  valor?: number;
  esperado?: number;
  fecha_cumpliria?: string | null;
  cursos?: CursoEvaluado[];
}

export interface Elegibilidad {
  persona: {
    id: string;
    cedula: string;
    nombre_completo: string;
    apellido: string;
    unidad: { id: string; denominacion: string } | null;
    escalafon: { id: string; denominacion: string } | null;
    situacion: { id: string; codigo: string; denominacion: string } | null;
  };
  grado_actual: GradoRefAscensos;
  grado_destino: GradoRefAscensos | null;
  regla: { id: string; nombre: string } | null;
  estado: EstadoElegibilidad;
  fecha_cumpliria: string | null;
  motivo: string | null;
  antiguedad_dias: number;
  edad: number | null;
  requisitos: RequisitoEvaluado[];
}

export interface ConteoPorEstado {
  PASIBLE: number;
  PROXIMO: number;
  BLOQUEADO: number;
  FUERA_DE_EDAD: number;
  SIN_REGLA: number;
  TOPE_DE_ESCALA: number;
}

export interface PasiblesPaginados {
  items: Elegibilidad[];
  total: number;
  page: number;
  pageSize: number;
  fecha_referencia: string;
  horizonte_meses: number;
  stats: ConteoPorEstado;
}

export interface ListarPasiblesQuery {
  page?: number;
  pageSize?: number;
  estado?: EstadoElegibilidad[];
  escalafon_id?: number;
  grado_id?: number;
  unidad_id?: number;
  query?: string;
  fecha_referencia?: string;
  horizonte_meses?: number;
}

export interface ResumenAscensos {
  fecha_referencia: string;
  total_evaluados: number;
  por_estado: ConteoPorEstado;
  por_escalafon: { escalafon: string; total: number; pasibles: number }[];
  por_unidad: { unidad: string; total: number; pasibles: number }[];
  cursos_que_bloquean: { curso: string; funcionarios: number }[];
  sin_fecha_nacimiento: number;
}

export interface ImpactoRegla {
  regla: { id: string; nombre: string };
  evaluados: number;
  pasan_a_pasibles: number;
  dejan_de_ser_pasibles: number;
  sin_cambio: number;
  ganan: Elegibilidad[];
  pierden: Elegibilidad[];
}

export interface SimularImpactoPayload {
  dias_minimos?: number;
  edad_maxima?: number | null;
  requisitos?: RequisitoPayload[];
}

// ─── Órdenes de ascenso ────────────────────────────────────────────────────

export interface UsuarioRefOrden {
  id: string;
  username: string;
}

export interface AscensoDeOrden {
  id: string;
  persona: { id: string; cedula: string; nombre_completo: string } | null;
  grado_anterior: { id: string; codigo: string; denominacion: string } | null;
  grado_nuevo: { id: string; codigo: string; denominacion: string } | null;
  fecha_ascenso: string | null;
  numero_orden: string | null;
  regla: { id: string; nombre: string } | null;
  cumplia_requisitos: boolean | null;
  por_excepcion: boolean;
  motivo_excepcion: string | null;
  anulado: boolean;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  registrado_por: UsuarioRefOrden | null;
  anulado_por: UsuarioRefOrden | null;
  /** Solo viene en el detalle de la orden. */
  evaluacion?: Elegibilidad | null;
}

export interface OrdenAscenso {
  id: string;
  /** `numero_orden` o `boletin`: al menos uno viene cargado. */
  numero_orden: string | null;
  fecha_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  anulada: boolean;
  anulada_en: string | null;
  motivo_anulacion: string | null;
  creada_en: string | null;
  creada_por: UsuarioRefOrden | null;
  anulada_por: UsuarioRefOrden | null;
  cantidad_funcionarios: number;
  cantidad_vigentes: number;
  cantidad_por_excepcion: number;
  ascensos: AscensoDeOrden[];
}

export interface OrdenesPaginadas {
  items: OrdenAscenso[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    ordenes: number;
    ordenes_anuladas: number;
    ascensos: number;
    ascensos_anulados: number;
    por_excepcion: number;
  };
}

export interface ListarOrdenesQuery {
  page?: number;
  pageSize?: number;
  anio?: number;
  desde?: string;
  hasta?: string;
  numero_orden?: string;
  grado_destino_id?: number;
  unidad_id?: number;
  registrado_por?: number;
  anuladas?: boolean;
  con_excepciones?: boolean;
}

export interface FuncionarioDeOrdenPayload {
  persona_id: number;
  grado_destino_id?: number;
  fecha_ascenso?: string;
  motivo_excepcion?: string;
}

export interface CrearOrdenPayload {
  /** `numero_orden` o `boletin`: al menos uno es obligatorio. */
  numero_orden?: string;
  fecha_orden: string;
  boletin?: string;
  observaciones?: string;
  funcionarios: FuncionarioDeOrdenPayload[];
}

// ─── Panorama del módulo ───────────────────────────────────────────────────

export interface EstadisticasAscensos {
  totales: { ascensos: number; anulados: number };
  piramide: { grado: string; codigo: string; orden: number; dotacion: number }[];
}

export interface EstadisticasQuery {
  anio_desde?: number;
  anio_hasta?: number;
}
