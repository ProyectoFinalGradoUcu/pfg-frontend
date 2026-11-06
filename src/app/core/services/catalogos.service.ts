import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { Comando } from '../models/destinos.models';
import { MotivoBajaCatalogo } from '../models/retiros.models';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/catalogos`;

  getMotivosBaja(): Observable<MotivoBajaCatalogo[]> {
    return this.http.get<MotivoBajaCatalogo[]>(`${this.base}/motivos-baja`, { withCredentials: true });
  }

  /**
   * Los comandos (C.A.O., C.A.P., C.A.L., C.G.), solo vigentes. Unidades y sub-unidades
   * son catálogos de liquidación: la app los lee, pero no los crea, edita ni da de baja.
   * El backend manda el id como número; se pasa a string para compararlo con los demás ids.
   */
  getComandos(): Observable<Comando[]> {
    return this.http
      .get<{ id: number | string; codigo: string; denominacion: string }[]>(`${this.base}/unidades`, {
        withCredentials: true,
      })
      .pipe(map((items) => items.map((u) => ({ id: String(u.id), codigo: u.codigo, denominacion: u.denominacion }))));
  }
}
