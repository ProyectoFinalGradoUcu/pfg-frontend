import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../api.config';
import { PaginatedResponse } from '../models/auth.models';
import {
  CalificacionResponse,
  CursoDefinicion,
  CursoFuncionarioItem,
  CreateCursoDefinicionPayload,
  CreateDesignacionPayload,
  CreateHistorialCursoPayload,
  CreateModuloPayload,
  FuncionarioConCursos,
  HistorialCurso,
  ModuloCurso,
  UpdateCursoPayload,
} from '../models/cursos.models';

@Injectable({ providedIn: 'root' })
export class CursosService {
  constructor(private readonly http: HttpClient) {}

  // ── Historial ──────────────────────────────────────────────────────────────

  findAllHistorial(page = 1, pageSize = 20): Observable<PaginatedResponse<HistorialCurso>> {
    return this.http.get<PaginatedResponse<HistorialCurso>>(
      `${API_BASE_URL}/historial-cursos?page=${page}&pageSize=${pageSize}`,
      { withCredentials: true },
    );
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

  findFuncionariosConCursos(cedula?: string, page = 1, pageSize = 100): Observable<FuncionarioConCursos[]> {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (cedula) qs.set('cedula', cedula);
    return this.http
      .get<PaginatedResponse<any>>(`${API_BASE_URL}/cursos/funcionarios?${qs}`, { withCredentials: true })
      .pipe(
        map((res) => {
          // Agrupamos filas planas por persona
          const items: any[] = res.items ?? [];
          const agrupados = new Map<string, FuncionarioConCursos>();
          for (const row of items) {
            const persona = row.persona ?? {};
            const personaId = String(persona.id ?? '');
            if (!personaId) continue;
            if (!agrupados.has(personaId)) {
              const nombre = [persona.primer_nombre, persona.primer_apellido]
                .filter(Boolean)
                .join(' ')
                .trim() || (persona.nombre ?? '');
              agrupados.set(personaId, { id: personaId, cedula: persona.cedula ?? '', nombre, cursos: [] });
            }
            agrupados.get(personaId)!.cursos.push(this.mapCursoFuncionario(row));
          }
          return Array.from(agrupados.values());
        }),
      );
  }

  // ── Definiciones (Catálogo) ────────────────────────────────────────────────

  findAllDefiniciones(
    page = 1,
    pageSize = 10,
    nombre?: string,
    institucion?: string,
    esObligatorio?: boolean,
  ): Observable<PaginatedResponse<CursoDefinicion>> {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (nombre)                  qs.set('nombre', nombre);
    if (institucion)             qs.set('institucion', institucion);
    if (esObligatorio !== undefined) qs.set('es_obligatorio', String(esObligatorio));
    return this.http
      .get<PaginatedResponse<any>>(`${API_BASE_URL}/cursos?${qs}`, { withCredentials: true })
      .pipe(map((res) => ({ ...res, items: res.items.map((i: any) => this.mapDefinicion(i)) })));
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

  // ── Curso (editar) ───────────────────────────────────────────────────────

  editarCurso(cursoId: string, payload: UpdateCursoPayload): Observable<CursoDefinicion> {
    return this.http
      .patch<any>(`${API_BASE_URL}/cursos/${cursoId}`, payload, { withCredentials: true })
      .pipe(map((raw) => this.mapDefinicion(raw)));
  }

  // ── Calificaciones ────────────────────────────────────────────────────────

  registrarCalificacion(
    cursoId: string,
    designacionId: string,
    calificacion: number,
  ): Observable<CalificacionResponse> {
    return this.http.patch<CalificacionResponse>(
      `${API_BASE_URL}/cursos/${cursoId}/designaciones/${designacionId}`,
      { calificacion },
      { withCredentials: true },
    );
  }

  // ── Designaciones / Instancias ─────────────────────────────────────────────

  crearDesignacion(cursoId: string, payload: CreateDesignacionPayload): Observable<any> {
    return this.http.post<any>(
      `${API_BASE_URL}/cursos/${cursoId}/designaciones`,
      payload,
      { withCredentials: true },
    );
  }

  // ── Mapeo API → modelo ─────────────────────────────────────────────────────

  private mapCursoFuncionario(raw: any): CursoFuncionarioItem {
    const cursoObj = raw.curso ?? raw;
    return {
      id:            String(cursoObj?.id ?? ''),
      designacionId: String(raw.id ?? ''),
      nombre_curso:  cursoObj?.nombre_curso ?? raw.nombre ?? '',
      institucion:   cursoObj?.institucion  ?? raw.institucion ?? '',
      tipo:          cursoObj?.es_obligatorio ? 'obligatorio' : 'optativo',
      fechaInicio:   raw.fecha_inicio ?? raw.fechaInicio ?? '',
      fechaFin:      raw.fecha_fin    ?? raw.fechaFin    ?? '',
      calificacion:  raw.calificacion != null ? Number(raw.calificacion) : null,
      numero_orden:  raw.numero_orden ?? null,
      boletin:       raw.boletin      ?? null,
      documentoUrl:  raw.documentoUrl ?? raw.documento_url ?? null,
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
      es_obligatorio: raw.es_obligatorio ?? false,
      modulos: modulosRaw.map((m) => this.mapModulo(m)),
    };
  }
}
