import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { sobreDeError } from '../../shared/utils/parse-error';

@Injectable({ providedIn: 'root' })
export class FotoPersonalService {
  private readonly http = inject(HttpClient);

  private base(personaId: string | number): string {
    return `${API_BASE_URL}/personas/${personaId}/foto`;
  }

  /** Con `v` el backend deja cachear la foto: la URL cambia cuando cambia la foto. */
  url(personaId: string | number, fotoId: string): string {
    return `${this.base(personaId)}?v=${encodeURIComponent(fotoId)}`;
  }

  /** Carga la foto o reemplaza la que tenía. */
  cargar(personaId: string | number, imagen: Blob): Observable<{ foto_id: string }> {
    const form = new FormData();
    form.append('archivo', imagen, 'foto.jpg');
    return this.http.put<{ foto_id: string }>(this.base(personaId), form);
  }

  quitar(personaId: string | number): Observable<null> {
    return this.http.delete<null>(this.base(personaId));
  }
}

export function mensajeErrorFoto(err: HttpErrorResponse): string {
  // Por status: el 413 de Caddy viene sin JSON.
  if (err.status === 413) return 'La imagen supera el tamaño máximo de 2 MB.';
  if (err.status === 0) return 'No se pudo conectar con el servidor.';
  const { mensaje } = sobreDeError(err);
  if (mensaje === 'File is required') return 'No se envió ninguna imagen.';
  return mensaje;
}
