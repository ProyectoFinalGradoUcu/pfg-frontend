import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CrearUnidadPayload, EditarUnidadPayload, Unidad } from '../models/destinos.models';

/** Valores crudos del formulario de edición de unidad. Un string vacío significa "sin valor". */
export interface CamposEditablesUnidad {
  denominacion: string;
  tipo: string;
  vigente: boolean;
}

/**
 * Arma el body del `PATCH` con **solo** las claves que cambiaron.
 *
 * `codigo` nunca aparece acá aunque `original` lo tenga: no forma parte de
 * `CamposEditablesUnidad` a propósito, porque el backend corre con
 * `forbidNonWhitelisted: true` y `codigo` no es un campo válido en un PATCH de
 * unidad — es la clave con la que los seeds y las migraciones la referencian.
 */
export function payloadEdicionUnidad(original: Unidad, valores: CamposEditablesUnidad): EditarUnidadPayload {
  const payload: EditarUnidadPayload = {};

  const denominacion = valores.denominacion.trim();
  if (denominacion && denominacion !== original.denominacion) {
    payload.denominacion = denominacion;
  }

  const tipo = valores.tipo.trim() || null;
  if (tipo !== (original.tipo ?? null)) payload.tipo = tipo;

  if (valores.vigente !== original.vigente) payload.vigente = valores.vigente;

  return payload;
}

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/catalogos/unidades`;

  crearUnidad(payload: CrearUnidadPayload): Observable<Unidad> {
    return this.http.post<Unidad>(this.base, { service_request: payload }, { withCredentials: true });
  }

  /**
   * `codigo` nunca es un campo válido en este PATCH: mandarlo devuelve 400
   * (`forbidNonWhitelisted`). El body se reconstruye con una lista blanca de
   * claves en vez de reenviar `payload` tal cual, para no depender de que el
   * llamador nunca se equivoque — es el 400 más fácil de causar de todo el módulo.
   */
  editarUnidad(unidadId: string, payload: EditarUnidadPayload): Observable<Unidad> {
    const body: EditarUnidadPayload = {};
    if (payload.denominacion !== undefined) body.denominacion = payload.denominacion;
    if (payload.tipo !== undefined) body.tipo = payload.tipo;
    if (payload.vigente !== undefined) body.vigente = payload.vigente;
    return this.http.patch<Unidad>(`${this.base}/${unidadId}`, { service_request: body }, { withCredentials: true });
  }

  /** Baja lógica: el backend pone `vigente = false` y devuelve la unidad actualizada. */
  darDeBajaUnidad(unidadId: string): Observable<Unidad> {
    return this.http.delete<Unidad>(`${this.base}/${unidadId}`, { withCredentials: true });
  }
}
