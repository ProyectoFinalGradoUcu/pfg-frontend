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
  /** Pertenencias a comisiones cerradas, con la fecha_fin que tenían para poder reabrirlas. */
  comisiones?: { id: string; fecha_fin_anterior: string | null }[];
  usuario_id?: string | null;
}

export interface Retiro {
  id: string;
  persona: PersonaMin;
  /** Al momento del retiro, no los actuales. */
  grado: Ref | null;
  unidad: Ref | null;
  sub_unidad?: Ref | null;
  fecha_retiro: string;
  hora_retiro: string | null;
  motivo_baja: MotivoBaja;
  motivo: string | null;
  anulado: boolean;
  /** No anulado y nadie volvió a entrar después de él: ninguna relación posterior, ni activa. */
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
    sub_unidad?: Ref | null;
    grado: Ref | null;
  } | null;
  /** `null` si el retiro fue anulado o es importado o histórico. `tipo` dice "Retiro" o "Baja" según el motivo. */
  movimiento: { id: string; tipo: string | null; fecha: string | null } | null;
  cerrado_con_el_retiro: CierresAplicados;
  registrado_por: { id: string; username: string } | null;
  registrado_en: string | null;
  anulacion: {
    motivo: string | null;
    fecha: string | null;
    por: { id: string; username: string } | null;
  } | null;
  /** La primera relación laboral que empieza después del retiro, se haya abierto como se haya abierto. */
  reincorporacion: {
    relacion_laboral_id: string;
    fecha: string | null;
    situacion: { codigo: string; denominacion: string } | null;
    /** Una relación cerrada ya se liquidó: sus datos de cálculo no se cambian. */
    activa: boolean;
    grado_reincorporacion: Ref | null;
    haber_retiro: number | null;
    /** Fracción, no porcentaje: 0.3 es un 30 %. */
    porcentaje_progresivo: number | null;
    /** Sin haber y porcentaje liquidación le paga sin el descuento. */
    faltan_datos_de_calculo: boolean;
  } | null;
  documentos: Record<SlotDocumentoRetiro, DocumentoRetiro | null>;
}

export type SlotDocumentoRetiro = 'orden' | 'boletin';

export interface DocumentoRetiro {
  nombre_original: string;
  content_type: string;
  /** BIGINT: llega como string. */
  tamanio_bytes: string;
  subido_en: string;
}

export interface PreviaRetiro {
  persona: PersonaMin;
  relacion_laboral: {
    id: string;
    fecha_inicio: string | null;
    tipo_funcionario: 'oficial' | 'subalterno' | null;
    unidad: Ref | null;
    sub_unidad?: Ref | null;
    situacion: { id: string; codigo: string } | null;
  } | null;
  destino_vigente: {
    id: string;
    unidad: Ref | null;
    sub_unidad?: Ref | null;
    fecha_inicio: string | null;
    cerrar_sugerido: boolean;
  } | null;
  inscripciones_activas: {
    id: string;
    curso: { id: string; nombre_curso: string };
    fecha_inicio: string | null;
    cerrar_sugerido: boolean;
  }[];
  /** Abiertas, o que terminan después de la fecha del retiro. */
  comisiones_abiertas: {
    id: string;
    comision: Ref;
    cargo: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
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
  cerrar?: { destino?: boolean; inscripciones?: number[]; comisiones?: number[]; usuario?: boolean };
}

export interface RetiroCreado extends Retiro {
  /** Lo que se cerró de verdad. Mostrar esto, no lo que dijo la previa. */
  cerrado: {
    destino: string | null;
    inscripciones: string[];
    comisiones: string[];
    usuario: string | null;
  };
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
    comisiones: string[];
    usuario: string | null;
  };
}

export interface ReincorporacionAnulada {
  retiro_id: string;
  revertido: {
    relacion_laboral_borrada: string;
    movimientos_borrados: string[];
    destino_borrado: string | null;
    destino_reabierto: string | null;
  };
}

/** Lo que la relación nueva hereda de la cerrada. No se edita desde la reincorporación. */
export interface DatosCopiadosReincorporacion {
  regimen: Ref | null;
  programa: Ref | null;
  escalafon: Ref | null;
  grado: Ref | null;
  tipo_funcionario: 'oficial' | 'subalterno' | null;
  fecha_ascenso_oficial: string | null;
  fecha_ultimo_ascenso: string | null;
  anios_servicio_anterior: number;
  anios_inactivos: number | null;
  riesgo_vuelo: number | null;
  categoria_viatico: number;
  usa_fonasa: boolean;
  superprima: boolean;
  prima_tecnica: string | null;
  prima_solidaria_familiar: string | null;
}

export interface PreviaReincorporacion {
  retiro: { id: string; fecha_retiro: string | null };
  persona: PersonaMin;
  /** `null` si la categoría no admite reincorporación: en ese caso viene un bloqueo. */
  situacion: { id: string; codigo: string; denominacion: string } | null;
  se_copia: DatosCopiadosReincorporacion;
  unidad_anterior: Ref | null;
  /** Base (sub-unidad) de la relación cerrada. */
  sub_unidad_anterior: Ref | null;
  /** Los que aceptan el POST y el PATCH según la categoría: vigentes, ordenados, sin cadetes, aprendices ni At. 3.ª. */
  grados_validos: { id: string; codigo: string; denominacion: string }[];
  destino_abierto: { id: string; unidad: Ref | null; sub_unidad: Ref | null; fecha_inicio: string | null } | null;
  /** Si trae elementos el POST falla con 409 o 422. Son strings listos para mostrar. */
  bloqueos: string[];
}

export interface ReincorporarBody {
  fecha_reincorporacion: string;
  grado_reincorporacion_id: number;
  /** Del acto de reincorporación; se descuenta del sueldo. Va junto con el porcentaje. */
  haber_retiro?: number;
  /** Fracción, no porcentaje: 0.3 es un 30 %. Va junto con el haber. */
  porcentaje_progresivo?: number;
  /** Base a la que vuelve; el comando sale de ella. */
  sub_unidad_id: number;
  numero_orden?: string;
  boletin?: string;
  posicion_destino?: string;
  observaciones?: string;
}

export interface Reincorporado {
  retiro_id: string;
  relacion_laboral: {
    id: string;
    fecha_inicio: string;
    situacion: { codigo: string; denominacion: string };
  };
  movimiento_id: string;
  /** Siempre se abre uno nuevo; `anterior_cerrado` es el que estaba abierto, si había. */
  destino: { id: string; anterior_cerrado: string | null };
}

/** Al menos un dato; haber y porcentaje van juntos. */
export interface ActualizarReincorporacionBody {
  grado_reincorporacion_id?: number;
  haber_retiro?: number;
  porcentaje_progresivo?: number;
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
  /** Base (sub-unidad) de la relación laboral cerrada. */
  sub_unidad_id?: string | number;
  motivo_baja_id?: string | number;
  desde?: string;
  hasta?: string;
  /** `true`: los retirados de hoy. `false`: todos los eventos de retiro. */
  vigentes?: boolean;
  incluir_anulados?: boolean;
  categoria?: 'oficial' | 'subalterno';
}
