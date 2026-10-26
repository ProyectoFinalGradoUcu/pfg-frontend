import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CrearPeriodoVueloPayload,
  EditarRegistroVueloPayload,
  EditarUnidadVueloPayload,
  HistorialVueloPersona,
  ListaRegistrosVuelo,
  ListarRegistrosVueloQuery,
  PeriodoVuelo,
  PeriodoVueloCreado,
  RegistroVuelo,
  UnidadVuelo,
} from '../models/vuelos.models';

@Injectable({ providedIn: 'root' })
export class VuelosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/vuelos`;

  // ── Períodos ──

  /** Con `categoria`, el avance de carga cuenta solo a oficiales o a subalternos. */
  listarPeriodos(categoria?: 'oficial' | 'subalterno'): Observable<PeriodoVuelo[]> {
    return this.http.get<PeriodoVuelo[]>(`${this.base}/periodos${this.qs({ categoria })}`, { withCredentials: true });
  }

  crearPeriodo(payload: CrearPeriodoVueloPayload): Observable<PeriodoVueloCreado> {
    return this.http.post<PeriodoVueloCreado>(`${this.base}/periodos`, payload, { withCredentials: true });
  }

  cambiarEstadoPeriodo(periodoId: string, cerrado: boolean): Observable<PeriodoVuelo> {
    return this.http.patch<PeriodoVuelo>(`${this.base}/periodos/${periodoId}`, { cerrado }, { withCredentials: true });
  }

  eliminarPeriodo(periodoId: string): Observable<{ id: string; eliminado: true }> {
    return this.http.delete<{ id: string; eliminado: true }>(`${this.base}/periodos/${periodoId}`, {
      withCredentials: true,
    });
  }

  // ── Registros ──

  listarRegistros(periodoId: string, query: ListarRegistrosVueloQuery = {}): Observable<ListaRegistrosVuelo> {
    return this.http.get<ListaRegistrosVuelo>(`${this.base}/periodos/${periodoId}/registros${this.qs(query)}`, {
      withCredentials: true,
    });
  }

  editarRegistro(registroId: string, payload: EditarRegistroVueloPayload): Observable<RegistroVuelo> {
    return this.http.patch<RegistroVuelo>(`${this.base}/registros/${registroId}`, payload, { withCredentials: true });
  }

  historialPersona(personaId: string): Observable<HistorialVueloPersona> {
    return this.http.get<HistorialVueloPersona>(`${this.base}/personas/${personaId}/historial`, {
      withCredentials: true,
    });
  }

  /**
   * Descarga el Excel del año, una hoja por período; con `categoria`, solo oficiales o
   * subalternos. Sin otros filtros. Emite cuando terminó (o falla).
   */
  exportarAnio(anio: number, categoria?: 'oficial' | 'subalterno'): Observable<Blob> {
    const sufijo = categoria ? `_${categoria === 'oficial' ? 'oficiales' : 'subalternos'}` : '';
    return this.http
      .get(`${this.base}/exportar${this.qs({ anio, categoria })}`, {
        responseType: 'blob',
        withCredentials: true,
      })
      .pipe(
        tap((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `horas_vuelo_${anio}${sufijo}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        }),
      );
  }

  // ── Unidades de vuelo ──

  listarUnidades(): Observable<UnidadVuelo[]> {
    return this.http.get<UnidadVuelo[]>(`${this.base}/unidades`, { withCredentials: true });
  }

  crearUnidad(denominacion: string): Observable<UnidadVuelo> {
    return this.http.post<UnidadVuelo>(`${this.base}/unidades`, { denominacion }, { withCredentials: true });
  }

  editarUnidad(unidadId: string, payload: EditarUnidadVueloPayload): Observable<UnidadVuelo> {
    return this.http.patch<UnidadVuelo>(`${this.base}/unidades/${unidadId}`, payload, { withCredentials: true });
  }

  /** Omite los params vacíos; `false` sí viaja, porque filtra. */
  private qs(params: object): string {
    const sp = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor === undefined || valor === null || valor === '') continue;
      sp.set(clave, String(valor));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
  }
}
