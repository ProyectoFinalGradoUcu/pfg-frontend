import { RetiroHistorial } from './retiros.models';

export interface PersonaListItem {
  id: string;
  nombre: string;
  cedula: string;
  rango: string | null;
  destino: string | null;
  /** La **situación**, no el estado de la relación: un retirado la conserva. */
  estado: string | null;
  /** Lo que hay que mirar para saber si está retirado. */
  relacion_estado: 'activo' | 'inactivo' | null;
}

export interface PersonasPaginadas {
  items: PersonaListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FindPersonasParams {
  page?: number;
  pageSize?: number;
  search?: string;
  destino?: number;
  rango?: number;
  estado?: number;
  /** Sin esto los retirados no aparecen: el backend exige relación abierta. */
  incluir_inactivos?: boolean;
}

export interface OpcionSelect {
  id: number;
  codigo: string;
  denominacion: string;
}

export interface GradoItem extends OpcionSelect {
  escalafon_id: number;
  orden: number;
}

export type TipoFuncionario = 'oficial' | 'subalterno' | 'civil';

export interface FamiliarPayload {
  cedula: string;
  tipo_relacion?: string;
}

export interface FamiliarEntry {
  persona: PersonaListItem;
  tipo_relacion: string;
}

// ─── Detail / Profile ─────────────────────────────────────────────────────────

export interface GradoRef    { id: number; denominacion: string; codigo: string }
export interface UnidadRef   { id: number; denominacion: string; codigo: string }
export interface SituacionRef{ id: number; denominacion: string; codigo: string }
export interface SimpleRef   { id: number; denominacion: string }

export interface RelacionLaboral {
  id: number;
  estado: string;
  tipo_funcionario: string;
  fecha_inicio: string;
  fecha_ultimo_ascenso: string | null;
  fecha_ascenso_oficial: string | null;
  /** Texto libre. El motor de ascensos lo lee como booleano. */
  mutaciones: string | null;
  tiene_mando: boolean;
  prima_tecnica: string | null;
  observaciones: string | null;
  grado: GradoRef;
  unidad: UnidadRef;
  situacion: SituacionRef;
  regimen: SimpleRef;
  programa: SimpleRef;
  escalafon: SimpleRef;
  sub_unidad: SimpleRef | null;
}

/** Niveles educativos que admite el legajo militar. */
export const NIVELES_EDUCATIVOS = [
  { value: 'PRIMARIA',                 label: 'Primaria' },
  { value: 'CICLO_BASICO_INCOMPLETO',  label: 'Ciclo básico incompleto' },
  { value: 'CICLO_BASICO',             label: 'Ciclo básico' },
  { value: 'BACHILLERATO_INCOMPLETO',  label: 'Bachillerato incompleto' },
  { value: 'BACHILLERATO',             label: 'Bachillerato' },
  { value: 'BACHILLERATO_TECNOLOGICO', label: 'Bachillerato tecnológico (UTU)' },
  { value: 'TERCIARIO',                label: 'Terciario' },
] as const;

/** Nivel educativo y egreso de la ETA; la mutación vive en la relación laboral. */
export interface LegajoMilitar {
  persona_id?: number;
  nivel_educativo: string | null;
  nivel_educativo_label: string | null;
  fecha_ingreso_eta: string | null;
  fecha_egreso_eta: string | null;
  numero_orden_egreso_eta: string | null;
  egresado_eta: boolean;
  mutaciones: string | null;
  es_mutado: boolean;
  actualizado_en?: string | null;
}

export interface LegajoMilitarPayload {
  nivel_educativo?: string | null;
  fecha_ingreso_eta?: string | null;
  fecha_egreso_eta?: string | null;
  numero_orden_egreso_eta?: string | null;
  mutaciones?: string | null;
}

export interface PersonaDetalle {
  id: number;
  cedula: string;
  nombre_completo: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  fecha_nacimiento: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  genero: string | null;
  estado_civil: string | null;
  lugar_nacimiento: string | null;
  etnia: string | null;
  codigo_postal: string | null;
  seccional: string | null;
  es_civil: boolean;
  /** `null` si no hay relación **abierta**: un retirado cae acá. */
  relacion_laboral: RelacionLaboral | null;
  legajo_militar: LegajoMilitar;
}

export interface FamiliarItem {
  id: number;
  cedula: string;
  nombre_completo: string;
  tipo_relacion: string;
  grado: string | null;
  unidad: string | null;
}

export interface HistorialRango {
  id: number | null;
  fecha_ascenso: string;
  numero_orden: string | null;
  observaciones?: string | null;
  orden_ascenso_id?: number | null;
  es_rango_inicial?: boolean;
  es_rango_actual?: boolean;
  cumplia_requisitos?: boolean | null;
  por_excepcion?: boolean;
  motivo_excepcion?: string | null;
  anulado?: boolean;
  motivo_anulacion?: string | null;
  grado: GradoRef;
  grado_anterior?: GradoRef | null;
}

export interface HistorialMilitar {
  historial_rangos: HistorialRango[];
  /** Sin anulados, del más reciente al más antiguo. Ninguna UI lo consume hoy. */
  retiros: RetiroHistorial[];
}

export interface CursoPersona {
  curso_id: number;
  nombre_curso: string;
  institucion: string;
  es_obligatorio: boolean;
  boletin: string | null;
  numero_orden: string;
  fecha_inicio: string;
  fecha_fin: string;
  aprobado: boolean | null;
  calificacion: string | null;
  observacion: string | null;
  completado: boolean;
}

export interface MisionPersona {
  mision_id: string;
  convocatoria_id: string;
  nombre_mision: string;
  pais: string;
  fecha_salida: string;
  fecha_llegada: string | null;
  numero_orden: string;
  boletin: string | null;
  finalizada: boolean;
}

export interface PatchPersonaPayload {
  primer_nombre?: string;
  segundo_nombre?: string | null;
  primer_apellido?: string;
  segundo_apellido?: string | null;
  telefono?: string;
  email?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  genero?: string;
  estado_civil?: string;
  lugar_nacimiento?: string;
  etnia?: string | null;
  codigo_postal?: string | null;
  seccional?: string | null;
  fecha_inicio?: string;
  grado_id?: number;
  unidad_id?: number;
  situacion_id?: number;
  regimen_id?: number;
  programa_id?: number;
  escalafon_id?: number;
  sub_unidad_id?: number | null;
  prima_tecnica?: string | null;
  tiene_mando?: boolean;
  observaciones_laborales?: string | null;
  // Legajo militar
  nivel_educativo?: string | null;
  fecha_ingreso_eta?: string | null;
  fecha_egreso_eta?: string | null;
  numero_orden_egreso_eta?: string | null;
  mutaciones?: string | null;
}

export interface CrearPersonaPayload {
  cedula: string;
  primer_nombre: string;
  primer_apellido: string;
  segundo_nombre?: string;
  segundo_apellido?: string;
  fecha_nacimiento?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  genero?: string;
  estado_civil?: string;
  lugar_nacimiento?: string;
  es_civil?: boolean;
  familiares?: FamiliarPayload[];
  tipo_funcionario?: TipoFuncionario;
  regimen_id: number;
  unidad_id: number;
  programa_id: number;
  situacion_id: number;
  escalafon_id: number;
  grado_id: number;
  fecha_inicio: string;
  sub_unidad_id?: number;
  observaciones?: string;
  // Legajo militar (opcional en el alta)
  nivel_educativo?: string;
  fecha_ingreso_eta?: string;
  fecha_egreso_eta?: string;
  numero_orden_egreso_eta?: string;
  mutaciones?: string;
}

export interface CargaMasivaResultadoItem {
  fila: number;
  cedula: string;
  estado: 'ok' | 'error';
  id?: number;
  mensaje?: string;
}

export interface CargaMasivaResult {
  total: number;
  exitosos: number;
  errores: number;
  resultados: CargaMasivaResultadoItem[];
}

export interface CrearPersonaResponse {
  id: number;
  cedula: string;
  primer_nombre: string;
  primer_apellido: string;
  relacion_laboral: {
    id: number;
    tipo_funcionario: string;
    estado: string;
    fecha_inicio: string;
    escalafon_id: number;
    grado_id: number;
    regimen_id: number;
    unidad_id: number;
    programa_id: number;
    situacion_id: number;
  };
}
