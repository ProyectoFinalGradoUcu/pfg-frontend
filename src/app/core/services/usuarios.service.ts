import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CreateUsuarioPayload,
  PaginatedResponse,
  ResetPasswordPayload,
  UpdateUsuarioPayload,
  Usuario,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  constructor(private readonly http: HttpClient) {}

  findAll(params: { page: number; pageSize: number }): Observable<PaginatedResponse<Usuario>> {
    const httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);
    return this.http.get<PaginatedResponse<Usuario>>(`${API_BASE_URL}/usuarios`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  findOne(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${API_BASE_URL}/usuarios/${id}`, {
      withCredentials: true,
    });
  }

  create(payload: CreateUsuarioPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${API_BASE_URL}/usuarios`, payload, {
      withCredentials: true,
    });
  }

  update(id: string, payload: UpdateUsuarioPayload): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API_BASE_URL}/usuarios/${id}`, payload, {
      withCredentials: true,
    });
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${API_BASE_URL}/usuarios/${id}`, {
      withCredentials: true,
    });
  }

  asignarRol(usuarioId: string, rolId: string): Observable<Usuario> {
    return this.http.post<Usuario>(
      `${API_BASE_URL}/usuarios/${usuarioId}/roles/${rolId}`,
      {},
      { withCredentials: true },
    );
  }

  quitarRol(usuarioId: string, rolId: string): Observable<Usuario> {
    return this.http.delete<Usuario>(
      `${API_BASE_URL}/usuarios/${usuarioId}/roles/${rolId}`,
      { withCredentials: true },
    );
  }

  /**
   * Unidades de la CUENTA: define qué personal ve el usuario y de qué unidades hereda roles.
   * Reemplaza todas las asignaciones existentes. Cierra su sesión activa.
   */
  asignarUnidades(id: string, unidadIds: string[]): Observable<Usuario> {
    return this.http.patch<Usuario>(
      `${API_BASE_URL}/usuarios/${id}/unidad`,
      { unidadIds },
      { withCredentials: true },
    );
  }

  /** @deprecated Usa asignarUnidades. Mantenido por compatibilidad. */
  asignarUnidad(id: string, unidadId: string | null): Observable<Usuario> {
    return this.asignarUnidades(id, unidadId ? [unidadId] : []);
  }

  resetPassword(id: string, payload: ResetPasswordPayload): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API_BASE_URL}/usuarios/${id}/reset-password`,
      payload,
      { withCredentials: true },
    );
  }
}
