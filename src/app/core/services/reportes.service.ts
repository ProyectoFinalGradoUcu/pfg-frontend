import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CustomReportePayload,
  FuenteCatalogo,
  ReporteCatalogo,
  ResultadoReporte,
} from '../models/reportes.models';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  constructor(private readonly http: HttpClient) {}

  listar(): Observable<ReporteCatalogo[]> {
    return this.http.get<ReporteCatalogo[]>(`${API_BASE_URL}/reportes`, {
      withCredentials: true,
    });
  }

  obtenerDefinicion(clave: string): Observable<ReporteCatalogo> {
    return this.http.get<ReporteCatalogo>(`${API_BASE_URL}/reportes/${clave}`, {
      withCredentials: true,
    });
  }

  preview(clave: string, filtros: Record<string, string>): Observable<ResultadoReporte> {
    return this.http.get<ResultadoReporte>(`${API_BASE_URL}/reportes/${clave}/preview`, {
      params: this.toParams(filtros),
      withCredentials: true,
    });
  }

  exportarXlsx(clave: string, filtros: Record<string, string>): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/reportes/${clave}/export`, {
      params: this.toParams(filtros),
      withCredentials: true,
      responseType: 'blob',
    });
  }

  listarFuentes(): Observable<FuenteCatalogo[]> {
    return this.http.get<FuenteCatalogo[]>(`${API_BASE_URL}/reportes/custom/fuentes`, {
      withCredentials: true,
    });
  }

  previewCustom(payload: CustomReportePayload): Observable<ResultadoReporte> {
    return this.http.post<ResultadoReporte>(`${API_BASE_URL}/reportes/custom/preview`, payload, {
      withCredentials: true,
    });
  }

  exportarCustom(payload: CustomReportePayload): Observable<Blob> {
    return this.http.post(`${API_BASE_URL}/reportes/custom/export`, payload, {
      withCredentials: true,
      responseType: 'blob',
    });
  }

  private toParams(filtros: Record<string, string>): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, v);
    }
    return params;
  }
}
