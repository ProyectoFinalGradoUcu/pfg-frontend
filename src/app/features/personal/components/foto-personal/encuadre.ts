/** Lado en px del círculo donde se encuadra la foto. */
export const LADO_VISTA = 240;
/** Lado máximo en px de la foto que se sube. */
export const LADO_FOTO = 512;
export const ZOOM_MAXIMO = 3;

/** Imagen de `ancho`×`alto` px, escalada y desplazada (x, y) dentro de un cuadrado de `lado`. */
export interface Encuadre {
  ancho: number;
  alto: number;
  lado: number;
  zoom: number;
  x: number;
  y: number;
}

/** Con zoom 1 la imagen cubre justo el cuadrado por su lado más corto. */
export const escalaDe = (e: Encuadre): number =>
  Math.max(e.lado / e.ancho, e.lado / e.alto) * e.zoom;

/** Que la imagen siempre cubra todo el cuadrado, sin bordes vacíos. */
function acotar(e: Encuadre): Encuadre {
  const escala = escalaDe(e);
  const minX = e.lado - e.ancho * escala;
  const minY = e.lado - e.alto * escala;
  return { ...e, x: Math.min(0, Math.max(minX, e.x)), y: Math.min(0, Math.max(minY, e.y)) };
}

export function encuadreInicial(ancho: number, alto: number, lado = LADO_VISTA): Encuadre {
  const e = { ancho, alto, lado, zoom: 1, x: 0, y: 0 };
  const escala = escalaDe(e);
  return { ...e, x: (lado - ancho * escala) / 2, y: (lado - alto * escala) / 2 };
}

export function mover(e: Encuadre, dx: number, dy: number): Encuadre {
  return acotar({ ...e, x: e.x + dx, y: e.y + dy });
}

/** El centro del cuadrado queda sobre el mismo punto de la imagen. */
export function conZoom(e: Encuadre, zoom: number): Encuadre {
  const z = Math.min(ZOOM_MAXIMO, Math.max(1, zoom));
  const antes = escalaDe(e);
  const cx = (e.lado / 2 - e.x) / antes;
  const cy = (e.lado / 2 - e.y) / antes;
  const despues = escalaDe({ ...e, zoom: z });
  return acotar({ ...e, zoom: z, x: e.lado / 2 - cx * despues, y: e.lado / 2 - cy * despues });
}

/** Cuadrado de la imagen original, en sus px, que queda dentro del encuadre. */
export function recorte(e: Encuadre): { sx: number; sy: number; lado: number } {
  const escala = escalaDe(e);
  return { sx: -e.x / escala, sy: -e.y / escala, lado: e.lado / escala };
}

/** JPG de hasta LADO_FOTO px: el original no se sube ni se descarga en cada visita. */
export function recortarImagen(imagen: CanvasImageSource, e: Encuadre): Promise<Blob> {
  const r = recorte(e);
  const salida = Math.max(1, Math.round(Math.min(LADO_FOTO, r.lado)));
  const canvas = document.createElement('canvas');
  canvas.width = salida;
  canvas.height = salida;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('No se pudo procesar la imagen'));
  // JPG no tiene transparencia: un PNG con fondo transparente quedaría negro.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, salida, salida);
  ctx.drawImage(imagen, r.sx, r.sy, r.lado, r.lado, 0, 0, salida, salida);
  return new Promise((resolver, rechazar) =>
    canvas.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo procesar la imagen'))),
      'image/jpeg',
      0.9,
    ),
  );
}
