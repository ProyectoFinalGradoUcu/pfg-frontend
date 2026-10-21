import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CriterioSugerencia,
  EscalaDerechaResumen,
  GradoDerechaDetalle,
  GrupoNumor,
  HistorialDerechaPaginado,
  Impacto,
  AplicarCambiosPayload,
  PersonalDerecha,
  PrevisualizarPayload,
  ReordenarNumorPayload,
  ReordenarPayload,
  ResultadoCambio,
  SugerenciaOrden,
} from '../models/derecha.models';

@Injectable({ providedIn: 'root' })
export class DerechaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/configuracion-derecha`;

  listarEscalas(): Observable<EscalaDerechaResumen[]> {
    return this.http.get<EscalaDerechaResumen[]>(`${this.base}/escalas`, { withCredentials: true });
  }

  listarPersonal(): Observable<PersonalDerecha[]> {
    return this.http.get<PersonalDerecha[]>(`${this.base}/personal`, { withCredentials: true });
  }

  obtenerGrado(gradoId: number | string): Observable<GradoDerechaDetalle> {
    return this.http.get<GradoDerechaDetalle>(`${this.base}/grados/${gradoId}`, { withCredentials: true });
  }

  sugerirOrden(gradoId: number | string, criterio: CriterioSugerencia): Observable<SugerenciaOrden> {
    return this.http.get<SugerenciaOrden>(`${this.base}/grados/${gradoId}/sugerencia`, {
      params: { criterio },
      withCredentials: true,
    });
  }

  obtenerGrupoNumor(gradoId: number | string, escalafonId: number | string): Observable<GrupoNumor> {
    return this.http.get<GrupoNumor>(`${this.base}/numor/${gradoId}/${escalafonId}`, { withCredentials: true });
  }

  previsualizar(payload: PrevisualizarPayload): Observable<Impacto> {
    return this.http.post<Impacto>(`${this.base}/previsualizar`, payload, { withCredentials: true });
  }

  reordenar(payload: ReordenarPayload): Observable<ResultadoCambio> {
    return this.http.patch<ResultadoCambio>(`${this.base}/reordenar`, payload, { withCredentials: true });
  }

  aplicarCambios(payload: AplicarCambiosPayload): Observable<ResultadoCambio> {
    return this.http.patch<ResultadoCambio>(`${this.base}/cambios`, payload, { withCredentials: true });
  }

  reordenarNumor(payload: ReordenarNumorPayload): Observable<ResultadoCambio> {
    return this.http.patch<ResultadoCambio>(`${this.base}/numor/reordenar`, payload, { withCredentials: true });
  }

  historial(params: { persona_id?: number; page?: number; pageSize?: number } = {}): Observable<HistorialDerechaPaginado> {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v != null) query[k] = String(v);
    return this.http.get<HistorialDerechaPaginado>(`${this.base}/historial`, { params: query, withCredentials: true });
  }
}
