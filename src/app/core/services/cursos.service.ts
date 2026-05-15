import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../api.config';
import { PaginatedResponse } from '../models/auth.models';
import {
  CursoDefinicion,
  CursoFuncionarioItem,
  CreateCursoDefinicionPayload,
  CreateHistorialCursoPayload,
  CreateModuloPayload,
  FuncionarioConCursos,
  HistorialCurso,
  ModuloCurso,
} from '../models/cursos.models';

@Injectable({ providedIn: 'root' })
export class CursosService {
  constructor(private readonly http: HttpClient) {}

  // ── Historial ──────────────────────────────────────────────────────────────

  findAllHistorial(): Observable<HistorialCurso[]> {
    return this.http
      .get<PaginatedResponse<HistorialCurso>>(`${API_BASE_URL}/historial-cursos?pageSize=100`, {
        withCredentials: true,
      })
      .pipe(map((res) => res.items));
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

  // ── Funcionarios con cursos ────────────────────────────────────────────────

  findFuncionariosConCursos(cedula?: string): Observable<FuncionarioConCursos[]> {
    const params = cedula ? `?cedula=${encodeURIComponent(cedula)}` : '';
    return this.http
      .get<any>(`${API_BASE_URL}/cursos/funcionarios${params}`, { withCredentials: true })
      .pipe(
        map((res) => {
          const items: any[] = Array.isArray(res) ? res : (res.items ?? []);
          return items.map((f) => this.mapFuncionario(f));
        }),
      );
  }

  // ── Definiciones (Catálogo) ────────────────────────────────────────────────

  findAllDefiniciones(): Observable<CursoDefinicion[]> {
    return this.http
      .get<PaginatedResponse<any>>(`${API_BASE_URL}/cursos?pageSize=100`, {
        withCredentials: true,
      })
      .pipe(map((res) => res.items.map((item: any) => this.mapDefinicion(item))));
  }

  createDefinicion(payload: CreateCursoDefinicionPayload): Observable<CursoDefinicion> {
    return this.http
      .post<any>(`${API_BASE_URL}/cursos`, payload, { withCredentials: true })
      .pipe(map((raw) => this.mapDefinicion(raw)));
  }

  deleteDefinicion(cursoId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/cursos/${cursoId}`, {
      withCredentials: true,
    });
  }

  // ── Módulos ────────────────────────────────────────────────────────────────

  createModulo(cursoId: string, payload: CreateModuloPayload): Observable<ModuloCurso> {
    return this.http
      .post<any>(`${API_BASE_URL}/cursos/${cursoId}/modulos`, payload, { withCredentials: true })
      .pipe(map((raw) => this.mapModulo(raw)));
  }

  deleteModulo(cursoId: string, moduloId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_BASE_URL}/cursos/${cursoId}/modulos/${moduloId}`,
      { withCredentials: true },
    );
  }

  // ── Mapeo API → modelo ─────────────────────────────────────────────────────

  private mapCursoFuncionario(raw: any): CursoFuncionarioItem {
    return {
      id: raw.id,
      nombre_curso: raw.nombre_curso ?? raw.nombre,
      institucion: raw.institucion,
      tipo: raw.tipo,
      fechaInicio: raw.fechaInicio ?? raw.fecha_inicio,
      fechaFin: raw.fechaFin ?? raw.fecha_fin,
      estado: raw.estado,
      documentoUrl: raw.documentoUrl ?? raw.documento_url ?? null,
    };
  }

  private mapFuncionario(raw: any): FuncionarioConCursos {
    const cursosRaw: any[] = raw.cursos ?? [];
    return {
      id: raw.id,
      cedula: raw.cedula,
      nombre: raw.nombre,
      cursos: cursosRaw.map((c) => this.mapCursoFuncionario(c)),
    };
  }

  private mapModulo(raw: any): ModuloCurso {
    return {
      id: raw.id,
      nombre: raw.nombre_modulo ?? raw.nombre,
      descripcion: raw.descripcion,
      orden: raw.orden_modulo ?? raw.orden,
    };
  }

  private mapDefinicion(raw: any): CursoDefinicion {
    const modulosRaw: any[] = raw.modulos_curso ?? raw.modulos ?? [];
    return {
      id: raw.id,
      nombre_curso: raw.nombre_curso,
      institucion: raw.institucion,
      boletin: raw.boletin,
      numero_orden: raw.numero_orden,
      es_obligatorio: raw.es_obligatorio ?? false,
      modulos: modulosRaw.map((m) => this.mapModulo(m)),
    };
  }
}
