import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  from,
  ignoreElements,
  map,
  of,
  takeUntil,
} from 'rxjs';
import {
  DocumentoRegistro,
  DocumentosRegistro,
  SLOTS_DOCUMENTO,
  SlotDocumento,
} from '../models/documentos-registro.models';

export interface ApiDocumentos {
  subir(slot: SlotDocumento, archivo: File): Observable<DocumentoRegistro>;
  quitar(slot: SlotDocumento): Observable<null>;
  inspeccionar(slot: SlotDocumento): Observable<void>;
  url(slot: SlotDocumento, opciones?: { descarga?: boolean }): string;
}

export function apiDocumentos(http: HttpClient, baseRegistro: string): ApiDocumentos {
  const url = (slot: SlotDocumento, { descarga = false }: { descarga?: boolean } = {}) =>
    `${baseRegistro}/documentos/${slot}${descarga ? '?download=1' : ''}`;
  return {
    // Sin Content-Type: el navegador arma el boundary del multipart.
    subir: (slot, archivo) => {
      const form = new FormData();
      form.append('archivo', archivo);
      return http.post<DocumentoRegistro>(url(slot), form);
    },
    quitar: (slot) => http.delete<null>(url(slot)),
    inspeccionar: (slot) => http.head(url(slot)).pipe(map(() => undefined)),
    url,
  };
}

export interface SlotVista {
  slot: SlotDocumento;
  etiqueta: string;
  numero: string | null;
  documento: DocumentoRegistro | null;
  api: ApiDocumentos;
  editable: boolean;
  nota?: string;
}

const ETIQUETAS_POR_DEFECTO: Record<SlotDocumento, string> = {
  orden: 'N° de orden',
  boletin: 'Boletín',
};

export function armarSlots(
  api: ApiDocumentos,
  documentos: DocumentosRegistro,
  numeros: Record<SlotDocumento, string | null>,
  editable: boolean,
  etiquetas: Record<SlotDocumento, string> = ETIQUETAS_POR_DEFECTO,
): SlotVista[] {
  return SLOTS_DOCUMENTO.map((slot) => ({
    slot,
    etiqueta: etiquetas[slot],
    numero: numeros[slot],
    documento: documentos[slot],
    api,
    editable,
  }));
}

/** Emite una vez al terminar, aunque algún archivo falle. */
export function subirPendientes(
  subir: (slot: SlotDocumento, archivo: File) => Observable<unknown>,
  archivos: Partial<Record<SlotDocumento, File>>,
  alFallar: (archivo: File, err: HttpErrorResponse) => void,
): Observable<void> {
  const pendientes = SLOTS_DOCUMENTO.filter((slot) => archivos[slot]).map((slot) => ({
    slot,
    archivo: archivos[slot]!,
  }));
  return concat(
    from(pendientes).pipe(
      concatMap(({ slot, archivo }) =>
        subir(slot, archivo).pipe(
          catchError((err: HttpErrorResponse) => {
            alFallar(archivo, err);
            return EMPTY;
          }),
        ),
      ),
      ignoreElements(),
    ),
    of(undefined),
  );
}

export class ArchivosPendientes {
  readonly archivos: WritableSignal<Partial<Record<SlotDocumento, File>>> = signal({});

  elegir(slot: SlotDocumento, archivo: File): void {
    this.archivos.update((a) => ({ ...a, [slot]: archivo }));
  }

  quitar(slot: SlotDocumento): void {
    if (!this.archivos()[slot]) return;
    this.archivos.update((a) => {
      const { [slot]: _, ...resto } = a;
      return resto;
    });
  }

  limpiar(): void {
    this.archivos.set({});
  }

  hay(): boolean {
    return Object.keys(this.archivos()).length > 0;
  }

  // Sin número no se adjunta: si lo borran, el archivo elegido se descarta.
  descartarSiVacio(
    control: AbstractControl<string | null>,
    slot: SlotDocumento,
    destroy$: Observable<unknown>,
  ): void {
    control.valueChanges.pipe(takeUntil(destroy$)).subscribe((valor) => {
      if (!(valor ?? '').trim()) this.quitar(slot);
    });
  }
}
