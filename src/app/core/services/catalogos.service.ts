import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  Comando,
  ComandoCatalogo,
  CrearBasePayload,
  CrearComandoPayload,
  EditarBasePayload,
  EditarComandoPayload,
} from '../models/destinos.models';
import { MotivoBajaCatalogo } from '../models/retiros.models';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/catalogos`;

  getMotivosBaja(): Observable<MotivoBajaCatalogo[]> {
    return this.http.get<MotivoBajaCatalogo[]>(`${this.base}/motivos-baja`, { withCredentials: true });
  }

  /**
   * Los comandos (C.A.O., C.A.P., C.A.L., C.G., ...), solo vigentes, para los selectores.
   * El backend manda el id como número; se pasa a string para compararlo con los demás ids.
   */
  getComandos(): Observable<Comando[]> {
    return this.http
      .get<{ id: number | string; codigo: string; denominacion: string }[]>(`${this.base}/unidades`, {
        withCredentials: true,
      })
      .pipe(map((items) => items.map((u) => ({ id: String(u.id), codigo: u.codigo, denominacion: u.denominacion }))));
  }

  /** Todos los comandos, también los dados de baja, con su cantidad de bases vigentes. */
  listarComandos(): Observable<ComandoCatalogo[]> {
    return this.http
      .get<(Omit<ComandoCatalogo, 'id'> & { id: number | string })[]>(`${this.base}/unidades`, {
        params: { incluir_bajas: 'true' },
        withCredentials: true,
      })
      .pipe(
        map((items) =>
          items.map((u) => ({
            id: String(u.id),
            codigo: u.codigo,
            denominacion: u.denominacion,
            vigente: u.vigente,
            total_bases: u.total_bases ?? 0,
          })),
        ),
      );
  }

  // Unidades (comandos) y sub-unidades (bases) se comparten con liquidación: la baja es
  // lógica (`vigente: false`) y el código no se edita.

  crearComando(payload: CrearComandoPayload): Observable<unknown> {
    return this.http.post(`${this.base}/unidades`, { service_request: payload }, { withCredentials: true });
  }

  editarComando(id: string, payload: EditarComandoPayload): Observable<unknown> {
    return this.http.patch(`${this.base}/unidades/${id}`, { service_request: payload }, { withCredentials: true });
  }

  crearBase(payload: CrearBasePayload): Observable<unknown> {
    return this.http.post(`${this.base}/sub-unidades`, { service_request: payload }, { withCredentials: true });
  }

  editarBase(id: string, payload: EditarBasePayload): Observable<unknown> {
    return this.http.patch(`${this.base}/sub-unidades/${id}`, { service_request: payload }, {
      withCredentials: true,
    });
  }
}
