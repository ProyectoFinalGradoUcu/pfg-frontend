import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';

import { DocumentosPersonalService, mensajeErrorDocumento } from './documentos-personal.service';
import { API_BASE_URL } from '../api.config';
import { DocumentoPersonal } from '../models/documentos-personal.models';

const BASE = `${API_BASE_URL}/personas/31/documentos`;

function makeDocumento(overrides: Partial<DocumentoPersonal> = {}): DocumentoPersonal {
  return {
    id: '12',
    descripcion: 'Cédula, frente y dorso',
    nombre_original: 'Cédula frente.pdf',
    content_type: 'application/pdf',
    tamanio_bytes: '184223',
    subido_en: '2026-09-30T19:40:00.000Z',
    subido_por: { id: '1', username: 'admin@fau.mil.uy' },
    ...overrides,
  };
}

function pdf(): File {
  return new File(['%PDF-1.4'], 'cedula.pdf', { type: 'application/pdf' });
}

describe('DocumentosPersonalService', () => {
  let service: DocumentosPersonalService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DocumentosPersonalService],
    });
    service = TestBed.inject(DocumentosPersonalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar pide GET /personas/:id/documentos', () => {
    let result: DocumentoPersonal[] | undefined;
    service.listar(31).subscribe((r) => (result = r));
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([makeDocumento()]);
    expect(result!.length).toBe(1);
  });

  describe('subir', () => {
    it('manda multipart con el archivo y la descripción recortada, sin service_request', () => {
      service.subir(31, pdf(), '  Cédula  ').subscribe();
      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      const body = req.request.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect((body.get('archivo') as File).name).toBe('cedula.pdf');
      expect(body.get('descripcion')).toBe('Cédula');
      expect(body.has('service_request')).toBe(false);
      expect(req.request.headers.has('Content-Type')).toBe(false);
      expect(req.request.reportProgress).toBe(true);
      req.flush(makeDocumento(), { status: 201, statusText: 'Created' });
    });

    it('no manda descripcion si es solo espacios', () => {
      service.subir(31, pdf(), '   ').subscribe();
      const req = http.expectOne(BASE);
      expect((req.request.body as FormData).has('descripcion')).toBe(false);
      req.flush(makeDocumento(), { status: 201, statusText: 'Created' });
    });

    it('no manda descripcion si no se pasó', () => {
      service.subir(31, pdf()).subscribe();
      const req = http.expectOne(BASE);
      expect((req.request.body as FormData).has('descripcion')).toBe(false);
      req.flush(makeDocumento(), { status: 201, statusText: 'Created' });
    });

    it('emite los eventos de la subida y termina con la respuesta', () => {
      const eventos: HttpEvent<DocumentoPersonal>[] = [];
      service.subir(31, pdf()).subscribe((e) => eventos.push(e));
      http.expectOne(BASE).flush(makeDocumento(), { status: 201, statusText: 'Created' });
      expect(eventos.some((e) => e.type === HttpEventType.Response)).toBe(true);
    });
  });

  describe('cambiarDescripcion', () => {
    it('manda { descripcion } plano por PATCH', () => {
      service.cambiarDescripcion(31, '12', 'Cédula').subscribe();
      const req = http.expectOne(`${BASE}/12`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ descripcion: 'Cédula' });
      req.flush(makeDocumento());
    });

    it('manda null para quitar la descripción', () => {
      service.cambiarDescripcion(31, '12', null).subscribe();
      const req = http.expectOne(`${BASE}/12`);
      expect(req.request.body).toEqual({ descripcion: null });
      req.flush(makeDocumento({ descripcion: null }));
    });
  });

  it('eliminar pide DELETE /personas/:id/documentos/:docId', () => {
    service.eliminar(31, '12').subscribe();
    const req = http.expectOne(`${BASE}/12`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('inspeccionar pide HEAD del documento: confirma que existe sin bajarlo', () => {
    let terminado = false;
    service.inspeccionar(31, '12').subscribe(() => (terminado = true));
    const req = http.expectOne(`${BASE}/12`);
    expect(req.request.method).toBe('HEAD');
    req.flush(null);
    expect(terminado).toBe(true);
  });

  it('url arma la ruta directa, y con descarga agrega ?download=1', () => {
    expect(service.url(31, '12')).toBe(`${BASE}/12`);
    expect(service.url(31, '12', { descarga: true })).toBe(`${BASE}/12?download=1`);
  });
});

describe('mensajeErrorDocumento', () => {
  function error(body: unknown, status: number): HttpErrorResponse {
    return new HttpErrorResponse({ error: body, status });
  }

  function sobre(mensaje: string, status: string) {
    return { service_response: { service_status: { http_status: status, http_message: mensaje }, service_data: null } };
  }

  it('el 413 se decide por el status aunque el cuerpo no sea JSON (Caddy)', () => {
    expect(mensajeErrorDocumento(error('<html>413 Request Entity Too Large</html>', 413)))
      .toBe('El archivo supera el tamaño máximo de 10 MB.');
  });

  it('traduce los 400 que vienen del framework en inglés', () => {
    expect(mensajeErrorDocumento(error(sobre('File is required', '400'), 400)))
      .toBe('No se envió ningún archivo.');
    expect(mensajeErrorDocumento(error(sobre('descripcion must be shorter than or equal to 200 characters', '400'), 400)))
      .toBe('La descripción no puede superar los 200 caracteres.');
    expect(mensajeErrorDocumento(error(sobre('property foo should not exist', '400'), 400)))
      .toBe('La solicitud tiene campos no permitidos.');
  });

  it('deja pasar tal cual los mensajes del backend que ya vienen en castellano', () => {
    const mensaje = 'Tipo de archivo no permitido. Solo PDF, JPG o PNG';
    expect(mensajeErrorDocumento(error(sobre(mensaje, '400'), 400))).toBe(mensaje);
  });

  it('un 500 muestra el mensaje genérico del backend', () => {
    expect(mensajeErrorDocumento(error(sobre('Error interno del servidor', '500'), 500)))
      .toBe('Error interno del servidor');
  });

  it('sin conexión', () => {
    expect(mensajeErrorDocumento(error(null, 0))).toBe('No se pudo conectar con el servidor.');
  });
});
