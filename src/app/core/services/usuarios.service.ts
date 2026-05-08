import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CreateUsuarioPayload,
  PaginatedUsuariosResponse,
  ResetPasswordPayload,
  UpdateUsuarioPayload,
  Usuario,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  constructor(private readonly http: HttpClient) {}

  findAll(params?: {
    page?: number;
    pageSize?: number;
  }): Observable<PaginatedUsuariosResponse> {
    let httpParams = new HttpParams();
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.pageSize) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }

    return this.http.get<PaginatedUsuariosResponse>(`${API_BASE_URL}/usuarios`, {
      withCredentials: true,
      params: httpParams,
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

  resetPassword(id: string, payload: ResetPasswordPayload): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API_BASE_URL}/usuarios/${id}/reset-password`,
      payload,
      { withCredentials: true },
    );
  }
}
