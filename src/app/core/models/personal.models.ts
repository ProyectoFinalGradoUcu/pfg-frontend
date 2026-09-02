export interface PersonaListItem {
  id: string;
  nombre: string;
  cedula: string;
  rango: string;
  destino: string;
  estado: string;
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
  relacion_laboral: RelacionLaboral;
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
  id: number;
  fecha_ascenso: string;
  numero_orden: string;
  grado: GradoRef;
}

export interface HistorialMilitar {
  historial_rangos: HistorialRango[];
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
