export type SlotDocumento = 'orden' | 'boletin';

export const SLOTS_DOCUMENTO: readonly SlotDocumento[] = ['orden', 'boletin'];

export interface DocumentoRegistro {
  nombre_original: string;
  content_type: string;
  tamanio_bytes: string;
  subido_en: string;
}

export type DocumentosRegistro = Record<SlotDocumento, DocumentoRegistro | null>;
