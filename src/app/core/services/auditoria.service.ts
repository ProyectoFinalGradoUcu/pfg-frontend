import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { PaginatedResponse } from '../models/auth.models';
import {
  AuditoriaFiltros,
  AuditoriaQuery,
  AuditoriaRegistro,
} from '../models/auditoria.models';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  constructor(private readonly http: HttpClient) {}

  listar(query: AuditoriaQuery): Observable<PaginatedResponse<AuditoriaRegistro>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);

    if (query.usuarioId) params = params.set('usuarioId', query.usuarioId);
    if (query.accion) params = params.set('accion', query.accion);
    if (query.contexto) params = params.set('contexto', query.contexto);
    if (query.entidad) params = params.set('entidad', query.entidad);
    if (query.desde) params = params.set('desde', query.desde);
    if (query.hasta) params = params.set('hasta', query.hasta);

    return this.http.get<PaginatedResponse<AuditoriaRegistro>>(
      `${API_BASE_URL}/auditoria`,
      { params, withCredentials: true },
    );
  }

  filtros(): Observable<AuditoriaFiltros> {
    return this.http.get<AuditoriaFiltros>(`${API_BASE_URL}/auditoria/filtros`, {
      withCredentials: true,
    });
  }
}
