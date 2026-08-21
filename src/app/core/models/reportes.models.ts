export type TipoParametro = 'texto' | 'numero' | 'fecha' | 'select' | 'booleano';
export type TipoColumna = 'texto' | 'numero' | 'porcentaje' | 'fecha';

export interface OpcionParametro {
  valor: string;
  etiqueta: string;
}

export interface ParametroReporte {
  clave: string;
  etiqueta: string;
  tipo: TipoParametro;
  requerido?: boolean;
  opciones?: OpcionParametro[];
  fuenteOpciones?: string;
  valorPorDefecto?: string | number | boolean;
  ayuda?: string;
}

export interface ReporteCatalogo {
  clave: string;
  titulo: string;
  descripcion: string;
  categoria?: string;
  parametros: ParametroReporte[];
}

export interface ColumnaReporte {
  clave: string;
  etiqueta: string;
  tipo?: TipoColumna;
}

export interface SeccionReporte {
  titulo: string;
  columnas: ColumnaReporte[];
  filas: Record<string, unknown>[];
}

export interface LineaResumen {
  etiqueta: string;
  valor: string | number;
}

export interface ResultadoReporte {
  columnas?: ColumnaReporte[];
  filas?: Record<string, unknown>[];
  secciones?: SeccionReporte[];
  resumen?: LineaResumen[];
}

export interface FuenteCatalogo {
  clave: string;
  titulo: string;
  columnas: ColumnaReporte[];
  filtros: ParametroReporte[];
}

export interface CustomReportePayload {
  fuente: string;
  columnas: string[];
  filtros: Record<string, string>;
}
