import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CrearDestinoPayload,
  Destino,
  DestinoEliminado,
  EditarDestinoPayload,
  ListaDestinos,
  ListarDestinosQuery,
  ListarFuncionariosUnidadQuery,
  ListarUnidadesQuery,
  Paginado,
  UnidadConDestinados,
} from '../models/destinos.models';

/** Máximo que acepta el backend; si se pide más, lo recorta en silencio. */
const PAGE_SIZE_MAXIMO = 200;

/** Valores crudos del formulario de edición. Un string vacío significa "sin valor". */
export interface CamposEditablesDestino {
  fecha_inicio: string;
  fecha_fin: string;
  posicion_destino: string;
  numero_orden: string;
  boletin: string;
  observaciones: string;
}

/**
 * Arma el body del `PATCH` con **solo** las claves que cambiaron.
 *
 * El backend corre con `forbidNonWhitelisted: true`, así que una clave de más rechaza
 * la request entera. Y no se pueden filtrar los nulos a ciegas: `fecha_fin: null` es
 * justamente lo que reabre un destino, así que la ausencia de la clave y la clave en
 * null significan cosas distintas.
 */
export function payloadEdicion(original: Destino, valores: CamposEditablesDestino): EditarDestinoPayload {
  const payload: EditarDestinoPayload = {};

  const inicio = valores.fecha_inicio.trim();
  if (inicio && inicio !== (original.fecha_inicio ?? '')) payload.fecha_inicio = inicio;

  const fin = valores.fecha_fin.trim() || null;
  if (fin !== (original.fecha_fin ?? null)) payload.fecha_fin = fin;

  const textos: [keyof CamposEditablesDestino & keyof EditarDestinoPayload, string | null][] = [
    ['posicion_destino', original.posicion_destino],
    ['numero_orden', original.numero_orden],
    ['boletin', original.boletin],
    ['observaciones', original.observaciones],
  ];

  for (const [campo, anterior] of textos) {
    const nuevo = valores[campo].trim() || null;
    if (nuevo !== (anterior ?? null)) payload[campo] = nuevo as any;
  }

  return payload;
}

@Injectable({ providedIn: 'root' })
export class DestinosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/destinos`;

  listar(query: ListarDestinosQuery = {}): Observable<ListaDestinos> {
    return this.http.get<ListaDestinos>(`${this.base}${this.qs(query)}`, { withCredentials: true });
  }

  obtener(destinoId: string): Observable<Destino> {
    return this.http.get<Destino>(`${this.base}/${destinoId}`, { withCredentials: true });
  }

  crear(payload: CrearDestinoPayload): Observable<Destino> {
    return this.http.post<Destino>(this.base, { service_request: payload }, { withCredentials: true });
  }

  editar(destinoId: string, payload: EditarDestinoPayload): Observable<Destino> {
    return this.http.patch<Destino>(
      `${this.base}/${destinoId}`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  eliminar(destinoId: string): Observable<DestinoEliminado> {
    return this.http.delete<DestinoEliminado>(`${this.base}/${destinoId}`, { withCredentials: true });
  }

  listarUnidades(query: ListarUnidadesQuery = {}): Observable<Paginado<UnidadConDestinados>> {
    return this.http.get<Paginado<UnidadConDestinados>>(`${this.base}/unidades${this.qs(query)}`, {
      withCredentials: true,
    });
  }

  /** Catálogo completo para poblar selectores, en una sola llamada. */
  listarUnidadesParaSelector(): Observable<UnidadConDestinados[]> {
    return this.listarUnidades({ page: 1, pageSize: PAGE_SIZE_MAXIMO }).pipe(map((res) => res.items));
  }

  listarFuncionariosUnidad(
    unidadId: string,
    query: ListarFuncionariosUnidadQuery = {},
  ): Observable<Paginado<Destino>> {
    return this.http.get<Paginado<Destino>>(
      `${this.base}/unidades/${unidadId}/funcionarios${this.qs(query)}`,
      { withCredentials: true },
    );
  }

  /** Omite los params vacíos; `false` sí viaja, porque filtra. */
  private qs(params: any): string {
    const sp = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor === undefined || valor === null || valor === '') continue;
      sp.set(clave, String(valor));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
  }
}
