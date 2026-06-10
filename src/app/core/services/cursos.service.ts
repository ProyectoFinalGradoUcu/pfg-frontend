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
          // El backend devuelve filas planas: [{persona, curso, numero_orden, boletin, fecha_*, modulos[]}, ...].
          // Agrupamos por persona para que el componente pueda iterar f.cursos.
          const items: any[] = Array.isArray(res) ? res : (res.items ?? []);
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
              agrupados.set(personaId, {
                id: personaId,
                cedula: persona.cedula ?? '',
                nombre,
                cursos: [],
              });
            }
            agrupados.get(personaId)!.cursos.push(this.mapCursoFuncionario(row));
          }
          return Array.from(agrupados.values());
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

  // ── Curso (editar) ───────────────────────────────────────────────────────

  editarCurso(cursoId: string, payload: UpdateCursoPayload): Observable<CursoDefinicion> {
    return this.http
      .patch<any>(`${API_BASE_URL}/cursos/${cursoId}`, payload, { withCredentials: true })
      .pipe(map((raw) => this.mapDefinicion(raw)));
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
    // Acepta tanto el shape plano de /cursos/funcionarios ({curso:{...}, modulos:[]})
    // como un objeto curso "ya plano" (por compatibilidad).
    const cursoObj = raw.curso ?? raw;
    const fechaInicio = raw.fechaInicio ?? raw.fecha_inicio ?? null;
    const fechaFin = raw.fechaFin ?? raw.fecha_fin ?? null;
    const calificacion = raw.calificacion ?? null;
    const modulos: any[] = raw.modulos ?? [];

    // Estado "completado" requiere evidencia real:
    //   • Con módulos: todos los módulos están completados.
    //   • Sin módulos: hay calificación O la fecha de fin ya pasó.
    // Si la fecha de fin es futura, sigue "en curso" (todavía no terminó).
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFinPasada = fechaFin ? new Date(fechaFin) <= hoy : false;
    const todosLosModulosCompletados =
      modulos.length > 0 && modulos.every((m) => !!m.completado);
    const estado: 'en_curso' | 'completado' =
      todosLosModulosCompletados ||
      (modulos.length === 0 && (!!calificacion || fechaFinPasada))
        ? 'completado'
        : 'en_curso';
    const tipo: 'obligatorio' | 'optativo' = cursoObj?.es_obligatorio ? 'obligatorio' : 'optativo';
    return {
      id: String(cursoObj?.id ?? raw.id ?? ''),
      nombre_curso: cursoObj?.nombre_curso ?? raw.nombre ?? '',
      institucion: cursoObj?.institucion ?? raw.institucion ?? '',
      tipo,
      fechaInicio: fechaInicio ?? '',
      fechaFin: fechaFin ?? '',
      estado,
      numero_orden: raw.numero_orden ?? null,
      boletin: raw.boletin ?? null,
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
      es_obligatorio: raw.es_obligatorio ?? false,
      modulos: modulosRaw.map((m) => this.mapModulo(m)),
    };
  }
}
