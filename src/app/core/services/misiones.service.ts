import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { API_BASE_URL } from '../api.config';
import { PaginatedResponse } from '../models/auth.models';
import {
  Convocatoria,
  CreateConvocatoriaPayload,
  CreateMisionDefinicionPayload,
  FuncionarioConMisiones,
  FuncionarioConvocatoria,
  FuncionarioConvocatoriaPayload,
  FuncionarioMisionItem,
  MisionDefinicion,
  MisionesCatalogoResponse,
  MisionOpcion,
  UpdateConvocatoriaPayload,
  UpdateMisionDefinicionPayload,
} from '../models/misiones.models';
import { PersonalService } from './personal.service';

// ─────────────────────────────────────────────────────────────────────────
// MODO MOCK: usado mientras el backend de "misiones" no existía, para poder
// probar toda la interfaz con datos hardcodeados en memoria. El backend ya
// implementa el contrato acordado, así que queda en `false` — si hiciera
// falta volver a probar sin backend disponible, poner `useMockData` en
// `true` reactiva las respuestas simuladas más abajo. Expuesto como objeto
// (en vez de una constante) para que los tests puedan alternar el modo.
// ─────────────────────────────────────────────────────────────────────────
export const misionesServiceConfig = { useMockData: false };
const MOCK_DELAY_MS = 300;

@Injectable({ providedIn: 'root' })
export class MisionesService {
  private mockMisiones: MisionDefinicion[] = [
    { id: '1', nombre_mision: 'Congo (MONUSCO)', pais: 'República Democrática del Congo', total_convocatorias: 0 },
    { id: '2', nombre_mision: 'Chipre (UNFICYP)', pais: 'Chipre', total_convocatorias: 0 },
    { id: '3', nombre_mision: 'Sinaí (MFO)', pais: 'Egipto', total_convocatorias: 0 },
  ];

  private mockConvocatorias: Convocatoria[] = [
    {
      id: '101',
      mision_id: '1',
      numero_orden: 'ORD-1542',
      boletin: 'BOL-2026-04',
      fecha_salida: '2026-03-01',
      fecha_llegada: '2026-09-01',
      observaciones: 'Rotación anual del contingente.',
      total_funcionarios: 0,
      finalizada: false,
    },
    {
      id: '102',
      mision_id: '1',
      numero_orden: 'ORD-1201',
      boletin: null,
      fecha_salida: '2025-03-01',
      fecha_llegada: '2025-09-01',
      observaciones: null,
      total_funcionarios: 0,
      finalizada: true,
    },
    {
      id: '201',
      mision_id: '2',
      numero_orden: null,
      boletin: 'BOL-2025-11',
      fecha_salida: '2025-06-15',
      fecha_llegada: null,
      observaciones: 'Observadores en zona de amortiguación, sin fecha de regreso definida.',
      total_funcionarios: 0,
      finalizada: false,
    },
  ];

  private mockFuncionarios: Record<string, FuncionarioConvocatoria[]> = {
    '101': [
      {
        persona_id: '1001',
        cedula: '1.234.567-8',
        primer_nombre: 'Juan',
        primer_apellido: 'Pérez',
        numero_orden: null,
        boletin: 'BOL-2026-04',
        observaciones: null,
      },
      {
        persona_id: '1002',
        cedula: '2.345.678-9',
        primer_nombre: 'María',
        primer_apellido: 'Gómez',
        numero_orden: 'ORD-1542-A',
        boletin: 'BOL-2026-04',
        observaciones: 'Jefa de equipo',
      },
    ],
    '102': [
      {
        persona_id: '1003',
        cedula: '3.456.789-0',
        primer_nombre: 'Carlos',
        primer_apellido: 'Rodríguez',
        numero_orden: null,
        boletin: null,
        observaciones: null,
      },
    ],
    '201': [
      {
        persona_id: '1001',
        cedula: '1.234.567-8',
        primer_nombre: 'Juan',
        primer_apellido: 'Pérez',
        numero_orden: null,
        boletin: 'BOL-2025-11',
        observaciones: null,
      },
    ],
  };

  private mockIdCounter = 1000;

  constructor(
    private readonly http: HttpClient,
    private readonly personalService: PersonalService,
  ) {}

  // ── Definiciones (Catálogo) ─────────────────────────────────────────────

  findAllDefiniciones(
    page = 1,
    pageSize = 10,
    nombre?: string,
    pais?: string,
  ): Observable<MisionesCatalogoResponse> {
    if (misionesServiceConfig.useMockData) {
      let items = this.mockMisiones.map((m) => this.conTotalConvocatorias(m));
      if (nombre) items = items.filter((m) => m.nombre_mision.toLowerCase().includes(nombre.toLowerCase()));
      if (pais) items = items.filter((m) => m.pais.toLowerCase().includes(pais.toLowerCase()));

      const total = items.length;
      const start = (page - 1) * pageSize;
      const paginados = items.slice(start, start + pageSize);

      const convocatoriasActivas = this.mockConvocatorias.filter((c) => !c.finalizada).length;
      const personalDesplegado = new Set(
        this.mockConvocatorias
          .filter((c) => !c.finalizada)
          .flatMap((c) => (this.mockFuncionarios[c.id] ?? []).map((f) => f.persona_id)),
      ).size;

      return this.mockOf({
        items: paginados,
        total,
        page,
        pageSize,
        stats: {
          total_misiones: this.mockMisiones.length,
          convocatorias_activas: convocatoriasActivas,
          personal_desplegado: personalDesplegado,
        },
      });
    }

    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (nombre) qs.set('nombre', nombre);
    if (pais) qs.set('pais', pais);
    return this.http.get<MisionesCatalogoResponse>(`${API_BASE_URL}/misiones?${qs}`, {
      withCredentials: true,
    });
  }

  /** Lista liviana de {id, nombre_mision} para poblar selects de filtro. */
  findMisionesOpciones(): Observable<MisionOpcion[]> {
    if (misionesServiceConfig.useMockData) {
      return this.mockOf(this.mockMisiones.map((m) => ({ id: m.id, nombre_mision: m.nombre_mision })));
    }
    return this.http
      .get<MisionesCatalogoResponse>(`${API_BASE_URL}/misiones?page=1&pageSize=200`, {
        withCredentials: true,
      })
      .pipe(map((res) => res.items.map((m) => ({ id: m.id, nombre_mision: m.nombre_mision }))));
  }

  findDefinicionById(misionId: string): Observable<MisionDefinicion> {
    if (misionesServiceConfig.useMockData) {
      const mision = this.mockMisiones.find((m) => m.id === misionId);
      if (!mision) return this.mockNotFound('Misión no encontrada');
      return this.mockOf(this.conTotalConvocatorias(mision));
    }
    return this.http.get<MisionDefinicion>(`${API_BASE_URL}/misiones/${misionId}`, {
      withCredentials: true,
    });
  }

  createDefinicion(payload: CreateMisionDefinicionPayload): Observable<MisionDefinicion> {
    if (misionesServiceConfig.useMockData) {
      const dup = this.mockMisiones.some(
        (m) => m.nombre_mision.toLowerCase() === payload.nombre_mision.toLowerCase(),
      );
      if (dup) return this.mockConflict('Ya existe una misión con ese nombre.');
      const nueva: MisionDefinicion = {
        id: this.nextId(),
        nombre_mision: payload.nombre_mision,
        pais: payload.pais,
        total_convocatorias: 0,
      };
      this.mockMisiones.push(nueva);
      return this.mockOf(nueva);
    }
    return this.http.post<MisionDefinicion>(
      `${API_BASE_URL}/misiones`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  editarDefinicion(
    misionId: string,
    payload: UpdateMisionDefinicionPayload,
  ): Observable<MisionDefinicion> {
    if (misionesServiceConfig.useMockData) {
      const mision = this.mockMisiones.find((m) => m.id === misionId);
      if (!mision) return this.mockNotFound('Misión no encontrada');
      Object.assign(mision, payload);
      return this.mockOf(this.conTotalConvocatorias(mision));
    }
    return this.http.patch<MisionDefinicion>(
      `${API_BASE_URL}/misiones/${misionId}`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  deleteDefinicion(misionId: string): Observable<void> {
    if (misionesServiceConfig.useMockData) {
      this.mockMisiones = this.mockMisiones.filter((m) => m.id !== misionId);
      const idsConvocatorias = this.mockConvocatorias
        .filter((c) => c.mision_id === misionId)
        .map((c) => c.id);
      this.mockConvocatorias = this.mockConvocatorias.filter((c) => c.mision_id !== misionId);
      for (const id of idsConvocatorias) delete this.mockFuncionarios[id];
      return this.mockOf(undefined);
    }
    return this.http.delete<void>(`${API_BASE_URL}/misiones/${misionId}`, {
      withCredentials: true,
    });
  }

  // ── Convocatorias ────────────────────────────────────────────────────────

  findConvocatorias(
    misionId: string,
    page = 1,
    pageSize = 10,
    query?: string,
    finalizada?: boolean,
  ): Observable<PaginatedResponse<Convocatoria>> {
    if (misionesServiceConfig.useMockData) {
      let items = this.mockConvocatorias
        .filter((c) => c.mision_id === misionId)
        .map((c) => this.conTotalFuncionarios(c));
      if (query) {
        const q = query.toLowerCase();
        items = items.filter(
          (c) => (c.numero_orden ?? '').toLowerCase().includes(q) || (c.boletin ?? '').toLowerCase().includes(q),
        );
      }
      if (finalizada !== undefined) items = items.filter((c) => c.finalizada === finalizada);

      const total = items.length;
      const start = (page - 1) * pageSize;
      return this.mockOf({ items: items.slice(start, start + pageSize), total, page, pageSize });
    }

    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query) qs.set('query', query);
    if (finalizada !== undefined) qs.set('finalizada', String(finalizada));
    return this.http.get<PaginatedResponse<Convocatoria>>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias?${qs}`,
      { withCredentials: true },
    );
  }

  findConvocatoriaById(misionId: string, convocatoriaId: string): Observable<Convocatoria> {
    if (misionesServiceConfig.useMockData) {
      const c = this.mockConvocatorias.find((x) => x.id === convocatoriaId && x.mision_id === misionId);
      if (!c) return this.mockNotFound('Convocatoria no encontrada');
      return this.mockOf(this.conTotalFuncionarios(c));
    }
    return this.http.get<Convocatoria>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}`,
      { withCredentials: true },
    );
  }

  crearConvocatoria(
    misionId: string,
    payload: CreateConvocatoriaPayload,
  ): Observable<Convocatoria> {
    if (misionesServiceConfig.useMockData) {
      if (!payload.numero_orden?.trim() && !payload.boletin?.trim()) {
        return this.mockBadRequest('Debés ingresar al menos el N° de orden o el boletín.');
      }
      const nueva: Convocatoria = {
        id: this.nextId(),
        mision_id: misionId,
        numero_orden: payload.numero_orden ?? null,
        boletin: payload.boletin ?? null,
        fecha_salida: payload.fecha_salida ?? null,
        fecha_llegada: payload.fecha_llegada ?? null,
        observaciones: payload.observaciones ?? null,
        total_funcionarios: 0,
        finalizada: false,
      };
      this.mockConvocatorias.push(nueva);

      if (payload.persona_ids && payload.persona_ids.length > 0) {
        return this.personalService.findAll().pipe(
          delay(MOCK_DELAY_MS),
          map((personal) => {
            this.mockFuncionarios[nueva.id] = payload.persona_ids!.map((pid) =>
              this.mockFuncionarioDesdePersona(String(pid), personal, {
                numero_orden: payload.numero_orden,
                boletin: payload.boletin,
              }),
            );
            return this.conTotalFuncionarios(nueva);
          }),
        );
      }

      return this.mockOf(nueva);
    }
    return this.http.post<Convocatoria>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  editarConvocatoria(
    misionId: string,
    convocatoriaId: string,
    payload: UpdateConvocatoriaPayload,
  ): Observable<Convocatoria> {
    if (misionesServiceConfig.useMockData) {
      const c = this.mockConvocatorias.find((x) => x.id === convocatoriaId && x.mision_id === misionId);
      if (!c) return this.mockNotFound('Convocatoria no encontrada');
      Object.assign(c, payload);
      return this.mockOf(this.conTotalFuncionarios(c));
    }
    return this.http.patch<Convocatoria>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}`,
      { service_request: payload },
      { withCredentials: true },
    );
  }

  eliminarConvocatoria(misionId: string, convocatoriaId: string): Observable<void> {
    if (misionesServiceConfig.useMockData) {
      this.mockConvocatorias = this.mockConvocatorias.filter(
        (c) => !(c.id === convocatoriaId && c.mision_id === misionId),
      );
      delete this.mockFuncionarios[convocatoriaId];
      return this.mockOf(undefined);
    }
    return this.http.delete<void>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}`,
      { withCredentials: true },
    );
  }

  // ── Funcionarios de una convocatoria ─────────────────────────────────────

  findFuncionariosByConvocatoria(
    misionId: string,
    convocatoriaId: string,
    page = 1,
    limit = 5,
    query?: string,
  ): Observable<PaginatedResponse<FuncionarioConvocatoria>> {
    if (misionesServiceConfig.useMockData) {
      let items = this.mockFuncionarios[convocatoriaId] ?? [];
      if (query) {
        const q = query.toLowerCase();
        items = items.filter(
          (f) =>
            (f.cedula ?? '').toLowerCase().includes(q) ||
            [f.primer_nombre, f.primer_apellido].filter(Boolean).join(' ').toLowerCase().includes(q),
        );
      }
      const total = items.length;
      const start = (page - 1) * limit;
      return this.mockOf({ items: items.slice(start, start + limit), total, page, pageSize: limit });
    }

    const qs = new URLSearchParams({ page: String(page), pageSize: String(limit) });
    if (query) qs.set('query', query);
    return this.http.get<PaginatedResponse<FuncionarioConvocatoria>>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios?${qs}`,
      { withCredentials: true },
    );
  }

  addFuncionarios(
    misionId: string,
    convocatoriaId: string,
    funcionarios: FuncionarioConvocatoriaPayload[],
  ): Observable<void> {
    if (misionesServiceConfig.useMockData) {
      const sinOrdenNiBoletin = funcionarios.some((f) => !f.numero_orden?.trim() && !f.boletin?.trim());
      if (sinOrdenNiBoletin) {
        return this.mockBadRequest('Cada funcionario debe tener al menos N° de orden o boletín.');
      }
      const existentes = this.mockFuncionarios[convocatoriaId] ?? (this.mockFuncionarios[convocatoriaId] = []);
      const yaAsignado = funcionarios.some((f) =>
        existentes.some((e) => e.persona_id === String(f.persona_id)),
      );
      if (yaAsignado) return this.mockConflict('Esa persona ya está asignada a esta convocatoria.');

      return this.personalService.findAll().pipe(
        delay(MOCK_DELAY_MS),
        map((personal) => {
          for (const f of funcionarios) {
            existentes.push(
              this.mockFuncionarioDesdePersona(String(f.persona_id), personal, {
                numero_orden: f.numero_orden,
                boletin: f.boletin,
                observaciones: f.observaciones,
              }),
            );
          }
          return undefined;
        }),
      );
    }
    const funcionariosConIdNumerico = funcionarios.map((f) => ({
      ...f,
      persona_id: Number(f.persona_id),
    }));
    return this.http.post<void>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios`,
      { service_request: { funcionarios: funcionariosConIdNumerico } },
      { withCredentials: true },
    );
  }

  updateFuncionario(
    misionId: string,
    convocatoriaId: string,
    personaId: string,
    data: Partial<FuncionarioConvocatoriaPayload>,
  ): Observable<void> {
    if (misionesServiceConfig.useMockData) {
      const fila = (this.mockFuncionarios[convocatoriaId] ?? []).find((f) => f.persona_id === personaId);
      if (!fila) return this.mockNotFound('Funcionario no encontrado en la convocatoria');
      const numeroOrden = data.numero_orden !== undefined ? data.numero_orden ?? null : fila.numero_orden;
      const boletin = data.boletin !== undefined ? data.boletin ?? null : fila.boletin;
      if (!numeroOrden?.trim() && !boletin?.trim()) {
        return this.mockBadRequest('El funcionario debe tener al menos N° de orden o boletín.');
      }
      fila.numero_orden = numeroOrden;
      fila.boletin = boletin;
      if (data.observaciones !== undefined) fila.observaciones = data.observaciones ?? null;
      return this.mockOf(undefined);
    }
    return this.http.patch<void>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios/${personaId}`,
      { service_request: data },
      { withCredentials: true },
    );
  }

  deleteFuncionario(misionId: string, convocatoriaId: string, personaId: string): Observable<void> {
    if (misionesServiceConfig.useMockData) {
      this.mockFuncionarios[convocatoriaId] = (this.mockFuncionarios[convocatoriaId] ?? []).filter(
        (f) => f.persona_id !== personaId,
      );
      return this.mockOf(undefined);
    }
    return this.http.delete<void>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios/${personaId}`,
      { withCredentials: true },
    );
  }

  deleteAllFuncionarios(misionId: string, convocatoriaId: string): Observable<void> {
    if (misionesServiceConfig.useMockData) {
      this.mockFuncionarios[convocatoriaId] = [];
      return this.mockOf(undefined);
    }
    return this.http.delete<void>(
      `${API_BASE_URL}/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios`,
      { withCredentials: true },
    );
  }

  // ── Personal en misión (agrupado por persona) ────────────────────────────

  findFuncionariosConMisiones(page = 1, pageSize = 200): Observable<FuncionarioConMisiones[]> {
    if (misionesServiceConfig.useMockData) {
      const agrupados = new Map<string, FuncionarioConMisiones>();
      for (const [convocatoriaId, filas] of Object.entries(this.mockFuncionarios)) {
        const convocatoria = this.mockConvocatorias.find((c) => c.id === convocatoriaId);
        if (!convocatoria) continue;
        const mision = this.mockMisiones.find((m) => m.id === convocatoria.mision_id);
        if (!mision) continue;

        for (const f of filas) {
          if (!agrupados.has(f.persona_id)) {
            const nombre = [f.primer_nombre, f.primer_apellido].filter(Boolean).join(' ');
            agrupados.set(f.persona_id, { id: f.persona_id, cedula: f.cedula ?? '', nombre, misiones: [] });
          }
          agrupados.get(f.persona_id)!.misiones.push({
            id: mision.id,
            convocatoriaId: convocatoria.id,
            nombre_mision: mision.nombre_mision,
            pais: mision.pais,
            numero_orden: f.numero_orden ?? convocatoria.numero_orden,
            boletin: f.boletin ?? convocatoria.boletin,
            observaciones: f.observaciones ?? null,
            fecha_salida: convocatoria.fecha_salida,
            fecha_llegada: convocatoria.fecha_llegada,
            finalizada: convocatoria.finalizada,
          });
        }
      }
      return this.mockOf(Array.from(agrupados.values()));
    }

    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return this.http
      .get<PaginatedResponse<any>>(`${API_BASE_URL}/misiones/funcionarios?${qs}`, {
        withCredentials: true,
      })
      .pipe(
        map((res) => {
          // Agrupamos filas planas (persona + convocatoria + misión) por persona
          const items: any[] = res.items ?? [];
          const agrupados = new Map<string, FuncionarioConMisiones>();
          for (const row of items) {
            const persona = row.persona ?? {};
            const personaId = String(persona.id ?? '');
            if (!personaId) continue;
            if (!agrupados.has(personaId)) {
              const nombre =
                [persona.primer_nombre, persona.primer_apellido].filter(Boolean).join(' ').trim() ||
                (persona.nombre ?? '');
              agrupados.set(personaId, {
                id: personaId,
                cedula: persona.cedula ?? '',
                nombre,
                misiones: [],
              });
            }
            agrupados.get(personaId)!.misiones.push(this.mapFuncionarioMisionItem(row));
          }
          return Array.from(agrupados.values());
        }),
      );
  }

  // ── Helpers de mock ──────────────────────────────────────────────────────

  private nextId(): string {
    this.mockIdCounter += 1;
    return String(this.mockIdCounter);
  }

  private mockOf<T>(value: T): Observable<T> {
    return of(value).pipe(delay(MOCK_DELAY_MS));
  }

  private mockError(status: number, message: string): Observable<never> {
    return throwError(
      () => new HttpErrorResponse({ status, error: { message }, statusText: message } as any),
    ).pipe(delay(MOCK_DELAY_MS));
  }

  private mockNotFound(message: string): Observable<never> {
    return this.mockError(404, message);
  }

  private mockConflict(message: string): Observable<never> {
    return this.mockError(409, message);
  }

  private mockBadRequest(message: string): Observable<never> {
    return this.mockError(400, message);
  }

  private conTotalConvocatorias(mision: MisionDefinicion): MisionDefinicion {
    return {
      ...mision,
      total_convocatorias: this.mockConvocatorias.filter((c) => c.mision_id === mision.id).length,
    };
  }

  private conTotalFuncionarios(convocatoria: Convocatoria): Convocatoria {
    return {
      ...convocatoria,
      total_funcionarios: (this.mockFuncionarios[convocatoria.id] ?? []).length,
    };
  }

  private mockFuncionarioDesdePersona(
    personaId: string,
    personal: { id: string; nombre: string; cedula: string }[],
    extra: { numero_orden?: string; boletin?: string; observaciones?: string },
  ): FuncionarioConvocatoria {
    const persona = personal.find((p) => String(p.id) === personaId);
    const [primerNombre, ...resto] = (persona?.nombre ?? '').trim().split(/\s+/);
    return {
      persona_id: personaId,
      cedula: persona?.cedula ?? null,
      primer_nombre: primerNombre || null,
      primer_apellido: resto.join(' ') || null,
      numero_orden: extra.numero_orden ?? null,
      boletin: extra.boletin ?? null,
      observaciones: extra.observaciones ?? null,
    };
  }

  private mapFuncionarioMisionItem(raw: any): FuncionarioMisionItem {
    const mision = raw.mision ?? raw;
    return {
      id: String(mision?.id ?? ''),
      // `raw.id` es el id de la fila de asignación (funcionario-convocatoria), no el
      // de la convocatoria — el backend los devuelve por separado en `convocatoria_id`.
      convocatoriaId: String(raw.convocatoria_id ?? raw.id ?? ''),
      nombre_mision: mision?.nombre_mision ?? '',
      pais: mision?.pais ?? '',
      numero_orden: raw.numero_orden ?? null,
      boletin: raw.boletin ?? null,
      observaciones: raw.observaciones ?? null,
      fecha_salida: raw.fecha_salida ?? null,
      fecha_llegada: raw.fecha_llegada ?? null,
      finalizada: raw.finalizada ?? false,
    };
  }
}
