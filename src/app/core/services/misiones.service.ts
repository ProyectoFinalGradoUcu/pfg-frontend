import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CreateMisionPayload,
  FuncionariosMisionPaginatedData,
  FuncionarioMisionPayload,
  MisionDetalle,
  MisionesPaginatedData,
  UpdateMisionPayload,
} from '../models/misiones.models';

@Injectable({ providedIn: 'root' })
export class MisionesService {
  constructor(private readonly http: HttpClient) {}

  findAll(page = 1, limit = 10): Observable<MisionesPaginatedData> {
    return this.http.get<MisionesPaginatedData>(
      `${API_BASE_URL}/misiones?page=${page}&limit=${limit}`,
      { withCredentials: true },
    );
  }

  findById(id: string): Observable<MisionDetalle> {
    return this.http.get<MisionDetalle>(`${API_BASE_URL}/misiones/${id}`, {
      withCredentials: true,
    });
  }

  findFuncionariosByMision(
    misionId: string,
    page = 1,
    limit = 5,
  ): Observable<FuncionariosMisionPaginatedData> {
    return this.http.get<FuncionariosMisionPaginatedData>(
      `${API_BASE_URL}/misiones/${misionId}/funcionarios?page=${page}&limit=${limit}`,
      { withCredentials: true },
    );
  }

  create(payload: CreateMisionPayload): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      `${API_BASE_URL}/misiones`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  update(id: string, payload: UpdateMisionPayload): Observable<{ id: string }> {
    return this.http.patch<{ id: string }>(
      `${API_BASE_URL}/misiones/${id}`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/misiones/${id}`, { withCredentials: true });
  }

  addFuncionarios(misionId: string, funcionarios: FuncionarioMisionPayload[]): Observable<void> {
    return this.http.post<void>(
      `${API_BASE_URL}/misiones/${misionId}/funcionarios`,
      { service_request: { funcionarios_misiones: funcionarios } },
      { withCredentials: true },
    );
  }

  updateFuncionario(
    misionId: string,
    personaId: string,
    data: Partial<FuncionarioMisionPayload>,
  ): Observable<void> {
    return this.http.patch<void>(
      `${API_BASE_URL}/misiones/${misionId}/funcionarios/${personaId}`,
      { service_request: data },
      { withCredentials: true },
    );
  }

  deleteFuncionario(misionId: string, personaId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_BASE_URL}/misiones/${misionId}/funcionarios/${personaId}`,
      { withCredentials: true },
    );
  }

  deleteAllFuncionarios(misionId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/misiones/${misionId}/funcionarios`, {
      withCredentials: true,
    });
  }
}
