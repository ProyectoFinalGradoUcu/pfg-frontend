import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../api.config';
import { PaginatedResponse, Permiso } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class PermisosService {
  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<Permiso[]> {
    return this.http
      .get<PaginatedResponse<Permiso>>(`${API_BASE_URL}/permisos?pageSize=100`, {
        withCredentials: true,
      })
      .pipe(map((res) => res.items));
  }
}
