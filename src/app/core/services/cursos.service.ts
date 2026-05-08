import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CursoDefinicion,
  CreateCursoDefinicionPayload,
  CreateHistorialCursoPayload,
  CreateModuloPayload,
  HistorialCurso,
  ModuloCurso,
} from '../models/cursos.models';

@Injectable({ providedIn: 'root' })
export class CursosService {
  constructor(private readonly http: HttpClient) {}

  // ── Historial ──────────────────────────────────────────────────────────────

  findAllHistorial(): Observable<HistorialCurso[]> {
    return this.http.get<HistorialCurso[]>(`${API_BASE_URL}/historial-cursos`, {
      withCredentials: true,
    });
  }

  createHistorial(
    payload: CreateHistorialCursoPayload,
    documento?: File | null,
  ): Observable<HistorialCurso> {
    if (documento) {
      const form = new FormData();
      (Object.keys(payload) as (keyof CreateHistorialCursoPayload)[]).forEach((key) =>
        form.append(key, payload[key]),
      );
      form.append('documento', documento);
      return this.http.post<HistorialCurso>(`${API_BASE_URL}/historial-cursos`, form, {
        withCredentials: true,
      });
    }
    return this.http.post<HistorialCurso>(`${API_BASE_URL}/historial-cursos`, payload, {
      withCredentials: true,
    });
  }

  // ── Definiciones ──────────────────────────────────────────────────────────

  findAllDefiniciones(): Observable<CursoDefinicion[]> {
    return this.http.get<CursoDefinicion[]>(`${API_BASE_URL}/cursos`, {
      withCredentials: true,
    });
  }

  createDefinicion(payload: CreateCursoDefinicionPayload): Observable<CursoDefinicion> {
    return this.http.post<CursoDefinicion>(`${API_BASE_URL}/cursos`, payload, {
      withCredentials: true,
    });
  }

  // ── Módulos ────────────────────────────────────────────────────────────────

  createModulo(cursoId: string, payload: CreateModuloPayload): Observable<ModuloCurso> {
    return this.http.post<ModuloCurso>(
      `${API_BASE_URL}/cursos/${cursoId}/modulos`,
      payload,
      { withCredentials: true },
    );
  }

  deleteModulo(cursoId: string, moduloId: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${API_BASE_URL}/cursos/${cursoId}/modulos/${moduloId}`,
      { withCredentials: true },
    );
  }
}
