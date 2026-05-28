import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CargaMasivaResult,
  CrearPersonaPayload,
  CrearPersonaResponse,
  CursoPersona,
  FamiliarItem,
  FindPersonasParams,
  GradoItem,
  HistorialMilitar,
  MisionPersona,
  OpcionSelect,
  PatchPersonaPayload,
  PersonaDetalle,
  PersonaListItem,
  PersonasPaginadas,
} from '../models/personal.models';

// Re-exportado para que módulos que importaban desde el servicio no rompan.
export type { PersonaListItem } from '../models/personal.models';

@Injectable({ providedIn: 'root' })
export class PersonalService {
  private readonly catalogos = `${API_BASE_URL}/catalogos`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<PersonaListItem[]> {
    return this.findPaginado({ pageSize: 100 }).pipe(map(res => res.items));
  }

  findPaginado(params: FindPersonasParams = {}): Observable<PersonasPaginadas> {
    const query: Record<string, string> = {};
    if (params.page)     query['page']     = String(params.page);
    if (params.pageSize) query['pageSize'] = String(params.pageSize);
    if (params.search)   query['search']   = params.search;
    if (params.destino)  query['destino']  = String(params.destino);
    if (params.rango)    query['rango']    = String(params.rango);
    if (params.estado)   query['estado']   = String(params.estado);
    return this.http.get<PersonasPaginadas>(`${API_BASE_URL}/personas`, {
      params: query,
      withCredentials: true,
    });
  }

  crear(payload: CrearPersonaPayload): Observable<CrearPersonaResponse> {
    return this.http.post<CrearPersonaResponse>(`${API_BASE_URL}/personas`, payload, {
      withCredentials: true,
    });
  }

  getUnidades(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${this.catalogos}/unidades`, { withCredentials: true });
  }

  getSituaciones(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${this.catalogos}/situaciones`, { withCredentials: true });
  }

  getEscalafones(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${this.catalogos}/escalafones`, { withCredentials: true });
  }

  getGrados(escalafon_id?: number): Observable<GradoItem[]> {
    const params: Record<string, string> = {};
    if (escalafon_id !== undefined) params['escalafon_id'] = String(escalafon_id);
    return this.http.get<GradoItem[]>(`${this.catalogos}/grados`, {
      params,
      withCredentials: true,
    });
  }

  getRegimenes(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${this.catalogos}/regimenes`, { withCredentials: true });
  }

  getProgramas(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${this.catalogos}/programas`, { withCredentials: true });
  }

  getCompanias(): Observable<OpcionSelect[]> {
    return this.http.get<OpcionSelect[]>(`${this.catalogos}/companias`, { withCredentials: true });
  }

  getById(id: number): Observable<PersonaDetalle> {
    return this.http.get<PersonaDetalle>(`${API_BASE_URL}/personas/${id}`, { withCredentials: true });
  }

  update(id: number, payload: PatchPersonaPayload): Observable<PersonaDetalle> {
    return this.http.patch<PersonaDetalle>(`${API_BASE_URL}/personas/${id}`, payload, { withCredentials: true });
  }

  getFamiliares(id: number): Observable<FamiliarItem[]> {
    return this.http.get<FamiliarItem[]>(`${API_BASE_URL}/personas/${id}/familiares`, { withCredentials: true });
  }

  getHistorialMilitar(id: number): Observable<HistorialMilitar> {
    return this.http.get<HistorialMilitar>(`${API_BASE_URL}/personas/${id}/historial-militar`, { withCredentials: true });
  }

  getCursos(id: number): Observable<CursoPersona[]> {
    return this.http.get<CursoPersona[]>(`${API_BASE_URL}/personas/${id}/cursos`, { withCredentials: true });
  }

  getMisiones(id: number): Observable<MisionPersona[]> {
    return this.http.get<MisionPersona[]>(`${API_BASE_URL}/personas/${id}/misiones`, { withCredentials: true });
  }

  descargarPlantilla(): void {
    this.http.get(`${API_BASE_URL}/personas/plantilla`, {
      responseType: 'blob',
      withCredentials: true,
    }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_personal.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  cargaMasiva(file: File): Observable<CargaMasivaResult> {
    const formData = new FormData();
    formData.append('archivo', file);
    return this.http.post<CargaMasivaResult>(`${API_BASE_URL}/personas/carga-masiva`, formData, {
      withCredentials: true,
    });
  }
}
