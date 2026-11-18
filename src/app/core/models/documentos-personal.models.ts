export interface DocumentoPersonal {
  id: string;
  descripcion: string | null;
  nombre_original: string;
  content_type: string;
  /** BIGINT serializado como string. */
  tamanio_bytes: string;
  subido_en: string;
  subido_por: { id: string; username: string } | null;
}

export type MotivoDuplicado = 'contenido' | 'nombre' | 'descripcion';

/** Datos del 409 al subir o al cambiar la descripción. */
export interface ConflictoDocumento {
  motivo: MotivoDuplicado;
  existente: DocumentoPersonal;
}

// Los valida el backend; acá solo para avisar antes de subir.
export const DOCUMENTO_TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024;

export const DOCUMENTO_TIPOS_PERMITIDOS: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];

export const DOCUMENTO_EXTENSIONES_PERMITIDAS = '.pdf,.jpg,.jpeg,.png';

export const DESCRIPCION_MAXIMA = 200;

const EXTENSIONES = DOCUMENTO_EXTENSIONES_PERMITIDAS.split(',');

/** Devuelve el mensaje de error, o `null` si pasa. El contenido real lo valida el backend. */
export function validarArchivo(archivo: File): string | null {
  if (archivo.size > DOCUMENTO_TAMANIO_MAXIMO_BYTES) {
    return 'El archivo supera el tamaño máximo de 10 MB.';
  }
  const nombre = archivo.name.toLowerCase();
  const extensionOk = EXTENSIONES.some((ext) => nombre.endsWith(ext));
  const tipoOk = DOCUMENTO_TIPOS_PERMITIDOS.includes(archivo.type);
  if (!extensionOk || !tipoOk) {
    return 'Tipo de archivo no permitido. Solo PDF, JPG o PNG.';
  }
  return null;
}

export function formatearTamanio(bytes: string | number): string {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** En hora local: el `formatDate` del perfil fuerza UTC y correría la hora. */
export function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatearFecha(iso)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

const TIPOS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

export function tipoDocumento(doc: { content_type: string }): string {
  return TIPOS[doc.content_type] ?? doc.content_type;
}

export function tituloDocumento(doc: DocumentoPersonal): string {
  return doc.descripcion ?? doc.nombre_original;
}

export function esPdf(doc: { content_type: string }): boolean {
  return doc.content_type.startsWith('application/pdf');
}

export function esImagen(doc: { content_type: string }): boolean {
  return doc.content_type.startsWith('image/');
}
