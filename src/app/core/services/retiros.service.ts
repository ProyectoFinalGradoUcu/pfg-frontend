import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  ActualizarReincorporacionBody,
  AnularRetiroBody,
  CorregirRetiroBody,
  CrearRetiroBody,
  DocumentoRetiro,
  ListarRetirosQuery,
  Paginado,
  PreviaReincorporacion,
  PreviaRetiro,
  ReincorporarBody,
  Reincorporado,
  Retiro,
  ReincorporacionAnulada,
  RetiroAnulado,
  RetiroCreado,
  RetiroDetalle,
  SlotDocumentoRetiro,
} from '../models/retiros.models';

@Injectable({ providedIn: 'root' })
export class RetirosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/retiros`;

  listar(query: ListarRetirosQuery = {}): Observable<Paginado<Retiro>> {
    return this.http.get<Paginado<Retiro>>(this.base, {
      params: this.params(query),
      withCredentials: true,
    });
  }

  /** Simula la escritura: el impacto depende de la fecha, y el retiro aún no existe. */
  previa(personaId: string | number, fechaRetiro: string): Observable<PreviaRetiro> {
    return this.http.get<PreviaRetiro>(`${this.base}/previa/${personaId}`, {
      params: new HttpParams().set('fecha_retiro', fechaRetiro),
      withCredentials: true,
    });
  }

  detalle(retiroId: string): Observable<RetiroDetalle> {
    return this.http.get<RetiroDetalle>(`${this.base}/${retiroId}`, { withCredentials: true });
  }

  /** Multipart sin `service_request` ni Content-Type: el navegador arma el boundary. */
  subirDocumento(
    retiroId: string,
    slot: SlotDocumentoRetiro,
    archivo: File,
  ): Observable<DocumentoRetiro> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<DocumentoRetiro>(this.urlDocumento(retiroId, slot), form);
  }

  quitarDocumento(retiroId: string, slot: SlotDocumentoRetiro): Observable<null> {
    return this.http.delete<null>(this.urlDocumento(retiroId, slot));
  }

  inspeccionarDocumento(retiroId: string, slot: SlotDocumentoRetiro): Observable<void> {
    return this.http.head(this.urlDocumento(retiroId, slot)).pipe(map(() => undefined));
  }

  /** Con `descarga: true` el backend responde `attachment` con el nombre original. */
  urlDocumento(
    retiroId: string,
    slot: SlotDocumentoRetiro,
    { descarga = false }: { descarga?: boolean } = {},
  ): string {
    return `${this.base}/${retiroId}/documentos/${slot}${descarga ? '?download=1' : ''}`;
  }

  registrar(body: CrearRetiroBody): Observable<RetiroCreado> {
    return this.http.post<RetiroCreado>(
      this.base,
      { service_request: body },
      { withCredentials: true },
    );
  }

  corregir(retiroId: string, body: CorregirRetiroBody): Observable<RetiroDetalle> {
    return this.http.patch<RetiroDetalle>(
      `${this.base}/${retiroId}`,
      { service_request: body },
      { withCredentials: true },
    );
  }

  /** El motivo va en el body del DELETE: `HttpClient` solo lo permite vía `body`. */
  anular(retiroId: string, body: AnularRetiroBody): Observable<RetiroAnulado> {
    return this.http.delete<RetiroAnulado>(`${this.base}/${retiroId}`, {
      body: { service_request: body },
      withCredentials: true,
    });
  }

  /** Solo lectura: qué heredaría la relación nueva y por qué no se podría reincorporar. */
  previaReincorporacion(retiroId: string): Observable<PreviaReincorporacion> {
    return this.http.get<PreviaReincorporacion>(`${this.base}/${retiroId}/reincorporacion/previa`, {
      withCredentials: true,
    });
  }

  reincorporar(retiroId: string, body: ReincorporarBody): Observable<Reincorporado> {
    return this.http.post<Reincorporado>(
      `${this.base}/${retiroId}/reincorporacion`,
      { service_request: body },
      { withCredentials: true },
    );
  }

  /** Devuelve el detalle completo del retiro, igual que `detalle`. */
  actualizarReincorporacion(retiroId: string, body: ActualizarReincorporacionBody): Observable<RetiroDetalle> {
    return this.http.patch<RetiroDetalle>(
      `${this.base}/${retiroId}/reincorporacion`,
      { service_request: body },
      { withCredentials: true },
    );
  }

  /** Deshace la reincorporación; después el retiro se puede anular. El motivo va en el body del DELETE. */
  anularReincorporacion(retiroId: string, body: AnularRetiroBody): Observable<ReincorporacionAnulada> {
    return this.http.delete<ReincorporacionAnulada>(`${this.base}/${retiroId}/reincorporacion`, {
      body: { service_request: body },
      withCredentials: true,
    });
  }

  /** Omite los vacíos; `false` sí viaja, porque `vigentes=false` filtra. */
  private params(query: ListarRetirosQuery): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return params;
  }
}
