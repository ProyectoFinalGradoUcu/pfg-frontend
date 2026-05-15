import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { PaginatedResponse, Permiso } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class PermisosService {
  constructor(private readonly http: HttpClient) {}

  findAll(params: { page: number; pageSize: number; search?: string }): Observable<PaginatedResponse<Permiso>> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    return this.http.get<PaginatedResponse<Permiso>>(`${API_BASE_URL}/permisos`, {
      params: httpParams,
      withCredentials: true,
    });
  }
}
