import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CrearReglaPayload,
  CursoDelCatalogo,
  EditarReglaPayload,
  Elegibilidad,
  EscaleraReglas,
  EstadisticasAscensos,
  EstadisticasQuery,
  ImpactoRegla,
  ListarPasiblesQuery,
  PasiblesPaginados,
  ListarOrdenesQuery,
  CrearOrdenPayload,
  OrdenAscenso,
  OrdenesPaginadas,
  ReglaAscenso,
  ResumenAscensos,
  SimularImpactoPayload,
} from '../models/ascensos.models';

@Injectable({ providedIn: 'root' })
export class AscensosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/ascensos`;
  private readonly reglas = `${API_BASE_URL}/ascensos/reglas`;

  /** Una columna por escalafón, un escalón por tramo. */
  getEscalera(opciones: { incluirInactivas?: boolean; incluirVersiones?: boolean } = {}):
    Observable<EscaleraReglas> {
    const params: Record<string, string> = {};
    if (opciones.incluirInactivas !== undefined) {
      params['incluir_inactivas'] = String(opciones.incluirInactivas);
    }
    if (opciones.incluirVersiones !== undefined) {
      params['incluir_versiones'] = String(opciones.incluirVersiones);
    }
    return this.http.get<EscaleraReglas>(this.reglas, { params, withCredentials: true });
  }

  /** Para el multi-select del editor de requisitos. */
  getCursosDelCatalogo(): Observable<CursoDelCatalogo[]> {
    return this.http.get<CursoDelCatalogo[]>(`${this.reglas}/catalogo-cursos`, {
      withCredentials: true,
    });
  }

  crearRegla(payload: CrearReglaPayload): Observable<ReglaAscenso> {
    return this.http.post<ReglaAscenso>(this.reglas, payload, { withCredentials: true });
  }

  /** No sobreescribe: cierra la versión vigente y abre una nueva. */
  editarRegla(id: string, payload: EditarReglaPayload): Observable<ReglaAscenso> {
    return this.http.patch<ReglaAscenso>(`${this.reglas}/${id}`, payload, {
      withCredentials: true,
    });
  }

  desactivarRegla(id: string): Observable<ReglaAscenso> {
    return this.http.post<ReglaAscenso>(`${this.reglas}/${id}/desactivar`, {}, {
      withCredentials: true,
    });
  }

  activarRegla(id: string): Observable<ReglaAscenso> {
    return this.http.post<ReglaAscenso>(`${this.reglas}/${id}/activar`, {}, {
      withCredentials: true,
    });
  }

  /** Simula un cambio de regla antes de guardarlo. */
  simularImpacto(id: string, payload: SimularImpactoPayload): Observable<ImpactoRegla> {
    return this.http.post<ImpactoRegla>(`${this.reglas}/${id}/impacto`, payload, {
      withCredentials: true,
    });
  }

  // ─── Elegibilidad ─────────────────────────────────────────────────────────

  /** Quién puede ascender, a quién le falta y por qué. */
  listarPasibles(query: ListarPasiblesQuery = {}): Observable<PasiblesPaginados> {
    const params: Record<string, string> = {};
    if (query.page) params['page'] = String(query.page);
    if (query.pageSize) params['pageSize'] = String(query.pageSize);
    if (query.estado?.length) params['estado'] = query.estado.join(',');
    if (query.escalafon_id) params['escalafon_id'] = String(query.escalafon_id);
    if (query.grado_id) params['grado_id'] = String(query.grado_id);
    if (query.unidad_id) params['unidad_id'] = String(query.unidad_id);
    if (query.query) params['query'] = query.query;
    if (query.fecha_referencia) params['fecha_referencia'] = query.fecha_referencia;
    if (query.horizonte_meses) params['horizonte_meses'] = String(query.horizonte_meses);
    return this.http.get<PasiblesPaginados>(`${this.base}/pasibles`, {
      params,
      withCredentials: true,
    });
  }

  getResumen(fechaReferencia?: string): Observable<ResumenAscensos> {
    const params: Record<string, string> = {};
    if (fechaReferencia) params['fecha_referencia'] = fechaReferencia;
    return this.http.get<ResumenAscensos>(`${this.base}/resumen`, {
      params,
      withCredentials: true,
    });
  }

  /** Evaluación completa de un funcionario. */
  getElegibilidad(personaId: string | number, fechaReferencia?: string): Observable<Elegibilidad> {
    const params: Record<string, string> = {};
    if (fechaReferencia) params['fecha_referencia'] = fechaReferencia;
    return this.http.get<Elegibilidad>(`${this.base}/elegibilidad/${personaId}`, {
      params,
      withCredentials: true,
    });
  }

  // ─── Órdenes de ascenso ───────────────────────────────────────────────────

  listarOrdenes(query: ListarOrdenesQuery = {}): Observable<OrdenesPaginadas> {
    const params: Record<string, string> = {};
    if (query.page) params['page'] = String(query.page);
    if (query.pageSize) params['pageSize'] = String(query.pageSize);
    if (query.anio) params['anio'] = String(query.anio);
    if (query.desde) params['desde'] = query.desde;
    if (query.hasta) params['hasta'] = query.hasta;
    if (query.numero_orden) params['numero_orden'] = query.numero_orden;
    if (query.grado_destino_id) params['grado_destino_id'] = String(query.grado_destino_id);
    if (query.unidad_id) params['unidad_id'] = String(query.unidad_id);
    if (query.registrado_por) params['registrado_por'] = String(query.registrado_por);
    if (query.anuladas !== undefined) params['anuladas'] = String(query.anuladas);
    if (query.con_excepciones) params['con_excepciones'] = 'true';
    return this.http.get<OrdenesPaginadas>(`${this.base}/ordenes`, {
      params,
      withCredentials: true,
    });
  }

  getOrden(id: string): Observable<OrdenAscenso> {
    return this.http.get<OrdenAscenso>(`${this.base}/ordenes/${id}`, { withCredentials: true });
  }

  /** Una sola transacción en el backend: o entran todos, o no entra ninguno. */
  crearOrden(payload: CrearOrdenPayload): Observable<OrdenAscenso> {
    return this.http.post<OrdenAscenso>(`${this.base}/ordenes`, payload, {
      withCredentials: true,
    });
  }

  anularOrden(id: string, motivo: string): Observable<OrdenAscenso> {
    return this.http.post<OrdenAscenso>(`${this.base}/ordenes/${id}/anular`, { motivo }, {
      withCredentials: true,
    });
  }

  anularAscenso(ascensoId: string, motivo: string): Observable<OrdenAscenso> {
    return this.http.post<OrdenAscenso>(`${this.base}/${ascensoId}/anular`, { motivo }, {
      withCredentials: true,
    });
  }

  // ─── Panorama del módulo ──────────────────────────────────────────────────

  getEstadisticas(query: EstadisticasQuery = {}): Observable<EstadisticasAscensos> {
    const params: Record<string, string> = {};
    if (query.anio_desde) params['anio_desde'] = String(query.anio_desde);
    if (query.anio_hasta) params['anio_hasta'] = String(query.anio_hasta);
    return this.http.get<EstadisticasAscensos>(`${this.base}/estadisticas`, {
      params,
      withCredentials: true,
    });
  }
}
