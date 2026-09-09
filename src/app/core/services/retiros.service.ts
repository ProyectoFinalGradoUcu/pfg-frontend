import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  AnularRetiroBody,
  CorregirRetiroBody,
  CrearRetiroBody,
  ListarRetirosQuery,
  Paginado,
  PreviaRetiro,
  Retiro,
  RetiroAnulado,
  RetiroCreado,
  RetiroDetalle,
} from '../models/retiros.models';

@Injectable({ providedIn: 'root' })
export class RetirosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/retiros`;

  listar(query: ListarRetirosQuery = {}): Observable<Paginado<Retiro>> {
    return this.http.get<Paginado<Retiro>>(this.base, {
      params: this.params(query),
      withCredentials: true,
    });
  }

  /** Simula la escritura: el impacto depende de la fecha, y el retiro aún no existe. */
  previa(personaId: string | number, fechaRetiro: string): Observable<PreviaRetiro> {
    return this.http.get<PreviaRetiro>(`${this.base}/previa/${personaId}`, {
      params: new HttpParams().set('fecha_retiro', fechaRetiro),
      withCredentials: true,
    });
  }

  detalle(retiroId: string): Observable<RetiroDetalle> {
    return this.http.get<RetiroDetalle>(`${this.base}/${retiroId}`, { withCredentials: true });
  }

  registrar(body: CrearRetiroBody): Observable<RetiroCreado> {
    return this.http.post<RetiroCreado>(
      this.base,
      { service_request: body },
      { withCredentials: true },
    );
  }

  corregir(retiroId: string, body: CorregirRetiroBody): Observable<RetiroDetalle> {
    return this.http.patch<RetiroDetalle>(
      `${this.base}/${retiroId}`,
      { service_request: body },
      { withCredentials: true },
    );
  }

  /** El motivo va en el body del DELETE: `HttpClient` solo lo permite vía `body`. */
  anular(retiroId: string, body: AnularRetiroBody): Observable<RetiroAnulado> {
    return this.http.delete<RetiroAnulado>(`${this.base}/${retiroId}`, {
      body: { service_request: body },
      withCredentials: true,
    });
  }

  /** Omite los vacíos; `false` sí viaja, porque `vigentes=false` filtra. */
  private params(query: ListarRetirosQuery): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return params;
  }
}
