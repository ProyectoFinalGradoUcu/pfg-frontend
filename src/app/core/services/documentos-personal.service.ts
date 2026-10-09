import { HttpClient, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { DocumentoPersonal } from '../models/documentos-personal.models';
import { sobreDeError } from '../../shared/utils/parse-error';

/** La subida es multipart y el PATCH es JSON plano: ninguno va dentro de `service_request`. */
@Injectable({ providedIn: 'root' })
export class DocumentosPersonalService {
  private readonly http = inject(HttpClient);

  private base(personaId: string | number): string {
    return `${API_BASE_URL}/personas/${personaId}/documentos`;
  }

  listar(personaId: string | number): Observable<DocumentoPersonal[]> {
    return this.http.get<DocumentoPersonal[]>(this.base(personaId));
  }

  /** Sin `Content-Type` a mano: lo pone el navegador con el boundary. */
  subir(
    personaId: string | number,
    archivo: File,
    descripcion?: string | null,
  ): Observable<HttpEvent<DocumentoPersonal>> {
    const form = new FormData();
    form.append('archivo', archivo);
    const texto = descripcion?.trim();
    if (texto) form.append('descripcion', texto);
    return this.http.post<DocumentoPersonal>(this.base(personaId), form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /** `null` quita la descripción. */
  cambiarDescripcion(
    personaId: string | number,
    id: string,
    descripcion: string | null,
  ): Observable<DocumentoPersonal> {
    return this.http.patch<DocumentoPersonal>(`${this.base(personaId)}/${id}`, { descripcion });
  }

  /** Confirma que el documento existe sin bajar el archivo. */
  inspeccionar(personaId: string | number, id: string): Observable<void> {
    return this.http.head(`${this.base(personaId)}/${id}`).pipe(map(() => undefined));
  }

  eliminar(personaId: string | number, id: string): Observable<null> {
    return this.http.delete<null>(`${this.base(personaId)}/${id}`);
  }

  /** Con `descarga: true` el backend responde `attachment` con el nombre original. */
  url(personaId: string | number, id: string, { descarga = false }: { descarga?: boolean } = {}): string {
    return `${this.base(personaId)}/${id}${descarga ? '?download=1' : ''}`;
  }
}

export function mensajeErrorDocumento(err: HttpErrorResponse): string {
  // Por status: el 413 de Caddy viene sin JSON.
  if (err.status === 413) return 'El archivo supera el tamaño máximo de 10 MB.';
  if (err.status === 0) return 'No se pudo conectar con el servidor.';
  const { mensaje } = sobreDeError(err);
  // Estos vienen del framework, en inglés.
  if (mensaje === 'File is required') return 'No se envió ningún archivo.';
  if (mensaje.includes('descripcion must be shorter')) return 'La descripción no puede superar los 200 caracteres.';
  if (/property \S+ should not exist/.test(mensaje)) return 'La solicitud tiene campos no permitidos.';
  return mensaje;
}
