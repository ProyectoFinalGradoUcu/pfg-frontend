import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { PaginatedPermisosResponse } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class PermisosService {
  constructor(private readonly http: HttpClient) {}

  findAll(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Observable<PaginatedPermisosResponse> {
    let httpParams = new HttpParams();
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.pageSize) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    if (params?.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http.get<PaginatedPermisosResponse>(`${API_BASE_URL}/permisos`, {
      withCredentials: true,
      params: httpParams,
    });
  }
}
