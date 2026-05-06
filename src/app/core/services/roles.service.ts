import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CreateRolPayload, Rol, UpdateRolPayload } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class RolesService {
  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${API_BASE_URL}/roles`, { withCredentials: true });
  }

  findOne(id: string): Observable<Rol> {
    return this.http.get<Rol>(`${API_BASE_URL}/roles/${id}`, { withCredentials: true });
  }

  create(payload: CreateRolPayload): Observable<Rol> {
    return this.http.post<Rol>(`${API_BASE_URL}/roles`, payload, {
      withCredentials: true,
    });
  }

  update(id: string, payload: UpdateRolPayload): Observable<Rol> {
    return this.http.patch<Rol>(`${API_BASE_URL}/roles/${id}`, payload, {
      withCredentials: true,
    });
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${API_BASE_URL}/roles/${id}`, {
      withCredentials: true,
    });
  }

  activarPermiso(rolId: string, permisoId: string): Observable<Rol> {
    return this.http.put<Rol>(
      `${API_BASE_URL}/roles/${rolId}/permisos/${permisoId}`,
      {},
      { withCredentials: true },
    );
  }

  desactivarPermiso(rolId: string, permisoId: string): Observable<Rol> {
    return this.http.delete<Rol>(
      `${API_BASE_URL}/roles/${rolId}/permisos/${permisoId}`,
      { withCredentials: true },
    );
  }
}
