export type EstadoCurso = 'en_curso' | 'completado';
export type TipoCurso = 'obligatorio' | 'optativo';

export interface PersonaCursoRef {
  id: string;
  nombre: string;
}

// ── Tab Historial ────────────────────────────────────────────────────────────

export interface HistorialCurso {
  id: string;
  persona: PersonaCursoRef;
  nombre: string;
  institucion: string;
  tipo: TipoCurso;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoCurso;
  documentoUrl?: string | null;
}

export interface CursoFuncionarioItem {
  id: string;
  nombre_curso: string;
  institucion: string;
  tipo: TipoCurso;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoCurso;
  documentoUrl?: string | null;
}

export interface FuncionarioConCursos {
  id: string;
  cedula: string;
  nombre: string;
  cursos: CursoFuncionarioItem[];
}

export interface CreateHistorialCursoPayload {
  personaId: string;
  nombre: string;
  institucion: string;
  tipo: TipoCurso;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoCurso;
}

// ── Tab Gestión ──────────────────────────────────────────────────────────────

export interface ModuloCurso {
  id: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
}

export interface CursoDefinicion {
  id: string;
  nombre_curso: string;
  institucion: string;
  boletin?: string | null;
  numero_orden?: string | null;
  es_obligatorio?: boolean;
  modulos?: ModuloCurso[];
}

export interface CreateCursoDefinicionPayload {
  nombre_curso: string;
  institucion: string;
  boletin?: string;
  numero_orden?: string;
  es_obligatorio?: boolean;
}

export interface CreateModuloPayload {
  nombre_modulo: string;
  orden_modulo: number;
  descripcion?: string;
}
