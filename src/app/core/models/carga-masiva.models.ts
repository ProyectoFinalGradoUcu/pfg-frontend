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

/**
 * Qué carga masiva abre el modal compartido. Las cuatro (personal, historial de cursos,
 * destinos y misiones) siguen el mismo contrato: GET de la plantilla y POST del archivo.
 */
export interface CargaMasivaConfig {
  titulo: string;
  descripcion: string;
  urlPlantilla: string;
  urlCarga: string;
  nombrePlantilla: string;
  notas?: string[];
}
