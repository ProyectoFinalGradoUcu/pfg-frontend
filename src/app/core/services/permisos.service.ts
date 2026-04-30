import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { Permiso } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class PermisosService {
  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${API_BASE_URL}/permisos`, {
      withCredentials: true,
    });
  }
}
