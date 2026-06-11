import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CreateInvitacionPayload,
  Invitacion,
  VerificarInvitacionResponse,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class InvitacionesService {
  constructor(private readonly http: HttpClient) {}

  verificar(token: string): Observable<VerificarInvitacionResponse> {
    return this.http.get<VerificarInvitacionResponse>(
      `${API_BASE_URL}/invitaciones/verificar`,
      { params: new HttpParams().set('token', token), withCredentials: true },
    );
  }

  aceptar(payload: { token: string; password: string }): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API_BASE_URL}/invitaciones/aceptar`,
      payload,
      { withCredentials: true },
    );
  }

  findAll(params?: { estado?: string }): Observable<Invitacion[]> {
    let httpParams = new HttpParams();
    if (params?.estado) {
      httpParams = httpParams.set('estado', params.estado);
    }
    return this.http.get<Invitacion[]>(`${API_BASE_URL}/invitaciones`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  create(payload: CreateInvitacionPayload): Observable<Invitacion> {
    return this.http.post<Invitacion>(`${API_BASE_URL}/invitaciones`, payload, {
      withCredentials: true,
    });
  }

  remove(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${API_BASE_URL}/invitaciones/${id}`,
      { withCredentials: true },
    );
  }
}
