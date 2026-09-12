// Los ids llegan como string y viajan como número en los request bodies.

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Ref {
  id: string;
  denominacion: string;
}

export interface MotivoBaja {
  codigo: string;
  denominacion: string;
}

/** El del catálogo trae `id`, que es lo que se manda al registrar o corregir. */
export interface MotivoBajaCatalogo {
  id: number;
  codigo: string;
  denominacion: string;
}

export interface PersonaMin {
  id: string;
  cedula: string;
  primer_nombre: string;
  primer_apellido: string;
}

/** Las tres claves pueden faltar: un retiro que no cerró nada devuelve `{}`. */
export interface CierresAplicados {
  destino_id?: string | null;
  inscripciones_ids?: string[];
  usuario_id?: string | null;
}

export interface Retiro {
  id: string;
  persona: PersonaMin;
  /** Al momento del retiro, no los actuales. */
  grado: Ref | null;
  unidad: Ref | null;
  fecha_retiro: string;
  hora_retiro: string | null;
  motivo_baja: MotivoBaja;
  motivo: string | null;
  anulado: boolean;
  /** No anulado y la persona no tiene relación laboral activa. */
  vigente: boolean;
}

export interface RetiroDetalle extends Retiro {
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
  relacion_laboral_cerrada: {
    id: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    unidad: Ref | null;
    grado: Ref | null;
  } | null;
  /** `null` si el retiro fue anulado. `tipo` dice "Retiro" o "Baja" según el motivo. */
  movimiento: { id: string; tipo: string | null; fecha: string | null } | null;
  cerrado_con_el_retiro: CierresAplicados;
  registrado_por: { id: string; username: string } | null;
  registrado_en: string | null;
  anulacion: {
    motivo: string | null;
    fecha: string | null;
    por: { id: string; username: string } | null;
  } | null;
  /** Hoy siempre `null`: no hay flujo de reincorporación. Ninguna UI lo consume. */
  reincorporacion: {
    relacion_laboral_id: string;
    fecha: string | null;
    situacion: { codigo: string; denominacion: string } | null;
  } | null;
}

export interface PreviaRetiro {
  persona: PersonaMin;
  relacion_laboral: {
    id: string;
    fecha_inicio: string | null;
    tipo_funcionario: 'oficial' | 'subalterno' | null;
    unidad: Ref | null;
    situacion: { id: string; codigo: string } | null;
  } | null;
  destino_vigente: {
    id: string;
    unidad: Ref | null;
    fecha_inicio: string | null;
    cerrar_sugerido: boolean;
  } | null;
  inscripciones_activas: {
    id: string;
    curso: { id: string; nombre_curso: string };
    fecha_inicio: string | null;
    cerrar_sugerido: boolean;
  }[];
  usuario: { id: string; username: string; cerrar_sugerido: boolean } | null;
  /** Informativa: no hay módulo que cierre ocupaciones de vivienda. Sin checkbox. */
  vivienda: { vivienda_id: string; informativo: true } | null;
  /** Si trae elementos el POST falla con 422. Son strings listos para mostrar. */
  bloqueos: string[];
}

export interface CrearRetiroBody {
  persona_id: number;
  fecha_retiro: string;
  motivo_baja_id: number;
  hora_retiro?: string;
  motivo?: string;
  numero_orden?: string;
  boletin?: string;
  observaciones?: string;
  /** Omitirlo fuerza la cascada completa. Mandarlo siempre. */
  cerrar?: { destino?: boolean; inscripciones?: number[]; usuario?: boolean };
}

export interface RetiroCreado extends Retiro {
  /** Lo que se cerró de verdad. Mostrar esto, no lo que dijo la previa. */
  cerrado: { destino: string | null; inscripciones: string[]; usuario: string | null };
}

export interface CorregirRetiroBody {
  fecha_retiro?: string;
  hora_retiro?: string | null;
  motivo_baja_id?: number;
  motivo?: string | null;
  numero_orden?: string | null;
  boletin?: string | null;
  observaciones?: string | null;
}

export interface AnularRetiroBody {
  motivo_anulacion: string;
}

export interface RetiroAnulado {
  id: string;
  revertido: {
    relacion_laboral: string;
    movimiento_borrado: string | null;
    destino: string | null;
    inscripciones: string[];
    usuario: string | null;
  };
}

/** Elemento de `retiros` en `GET /personas/:id/historial-militar`. */
export interface RetiroHistorial {
  id: string;
  fecha_retiro: string | null;
  hora_retiro: string | null;
  motivo: string | null;
  motivo_baja: MotivoBaja | null;
  vigente: boolean;
}

export interface ListarRetirosQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  unidad_id?: string | number;
  motivo_baja_id?: string | number;
  desde?: string;
  hasta?: string;
  /** `true`: los retirados de hoy. `false`: todos los eventos de retiro. */
  vigentes?: boolean;
  incluir_anulados?: boolean;
}
