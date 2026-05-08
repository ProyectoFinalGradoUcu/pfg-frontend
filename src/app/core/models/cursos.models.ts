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
  nombre: string;
  tipo: TipoCurso;
  descripcion?: string | null;
  modulos: ModuloCurso[];
}

export interface CreateCursoDefinicionPayload {
  nombre: string;
  tipo: TipoCurso;
  descripcion?: string;
}

export interface CreateModuloPayload {
  nombre: string;
  descripcion?: string;
  orden?: number;
}
