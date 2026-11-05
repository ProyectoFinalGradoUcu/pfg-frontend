import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';
import { Paginado } from '../models/destinos.models';
import { AsignacionComision, Comision, ComisionesQuery, CrearAsignacionComision, CrearLoteAsignacionesComision, EditarAsignacionComision, ListaAsignacionesComision } from '../models/comisiones.models';

@Injectable({ providedIn: 'root' })
export class ComisionesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/comisiones`;
  private options(query: ComisionesQuery = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return { params, withCredentials: true };
  }
  listar(query: ComisionesQuery = {}) { return this.http.get<Paginado<Comision>>(this.base, this.options(query)); }
  obtener(id: string) { return this.http.get<Comision>(`${this.base}/${id}`, this.options()); }
  crear(denominacion: string) { return this.http.post<Comision>(this.base, { service_request: { denominacion } }, this.options()); }
  editar(id: string, cambios: { denominacion?: string; vigente?: boolean }) { return this.http.patch<Comision>(`${this.base}/${id}`, { service_request: cambios }, this.options()); }
  asignaciones(query: ComisionesQuery = {}) { return this.http.get<ListaAsignacionesComision>(`${this.base}/asignaciones`, this.options(query)); }
  crearAsignacion(payload: CrearAsignacionComision) { return this.http.post<AsignacionComision>(`${this.base}/asignaciones`, { service_request: payload }, this.options()); }
  crearLote(payload: CrearLoteAsignacionesComision) { return this.http.post<{ items: AsignacionComision[]; cantidad: number }>(`${this.base}/asignaciones/lote`, { service_request: payload }, this.options()); }
  editarAsignacion(id: string, payload: EditarAsignacionComision) { return this.http.patch<AsignacionComision>(`${this.base}/asignaciones/${id}`, { service_request: payload }, this.options()); }
  eliminarAsignacion(id: string) { return this.http.delete<{ id: string; eliminado: true }>(`${this.base}/asignaciones/${id}`, this.options()); }
}
