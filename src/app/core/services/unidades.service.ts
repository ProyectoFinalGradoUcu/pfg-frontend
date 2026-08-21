import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  ListUnidadesQuery,
  UsuariosDeUnidadResponse,
  PaginatedUnidadesResponse,
  ResultadoAsignacion,
  UnidadDetalle,
} from '../models/unidades.models';

@Injectable({ providedIn: 'root' })
export class UnidadesService {
  constructor(private readonly http: HttpClient) {}

  findAll(query: ListUnidadesQuery = {}): Observable<PaginatedUnidadesResponse> {
    let params = new HttpParams();
    if (query.page !== undefined) params = params.set('page', query.page);
    if (query.pageSize !== undefined) params = params.set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.vigente !== undefined) params = params.set('vigente', query.vigente);

    return this.http.get<PaginatedUnidadesResponse>(`${API_BASE_URL}/unidades`, {
      params,
      withCredentials: true,
    });
  }

  findOne(id: string): Observable<UnidadDetalle> {
    return this.http.get<UnidadDetalle>(`${API_BASE_URL}/unidades/${id}`, {
      withCredentials: true,
    });
  }

  /** Usuarios del sistema asignados a la unidad (no el personal destinado acá). */
  findUsuarios(id: string): Observable<UsuariosDeUnidadResponse> {
    return this.http.get<UsuariosDeUnidadResponse>(
      `${API_BASE_URL}/unidades/${id}/usuarios`,
      { withCredentials: true },
    );
  }

  /** Cambia la unidad de la cuenta. Les cierra la sesión activa. */
  asignarUsuarios(
    id: string,
    usuarioIds: string[],
  ): Observable<ResultadoAsignacion> {
    return this.http.post<ResultadoAsignacion>(
      `${API_BASE_URL}/unidades/${id}/usuarios`,
      { usuarioIds },
      { withCredentials: true },
    );
  }

  quitarUsuario(id: string, usuarioId: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${API_BASE_URL}/unidades/${id}/usuarios/${usuarioId}`,
      { withCredentials: true },
    );
  }

  /** Todos los usuarios de la unidad quedan deslogueados. Confirmar antes de llamar. */
  asignarRol(unidadId: string, rolId: string): Observable<UnidadDetalle> {
    return this.http.post<UnidadDetalle>(
      `${API_BASE_URL}/unidades/${unidadId}/roles`,
      { rolId },
      { withCredentials: true },
    );
  }

  /** Ídem asignarRol: invalida las sesiones de toda la unidad. */
  quitarRol(unidadId: string, rolId: string): Observable<UnidadDetalle> {
    return this.http.delete<UnidadDetalle>(
      `${API_BASE_URL}/unidades/${unidadId}/roles/${rolId}`,
      { withCredentials: true },
    );
  }
}
