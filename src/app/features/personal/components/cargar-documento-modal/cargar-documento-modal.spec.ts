import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CargarDocumentoModal } from './cargar-documento-modal';
import { DocumentosPersonalService } from '../../../../core/services/documentos-personal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { DocumentoPersonal, MotivoDuplicado } from '../../../../core/models/documentos-personal.models';

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

function archivo(nombre = 'cedula.pdf', tipo = 'application/pdf'): File {
  return new File(['%PDF-1.4'], nombre, { type: tipo });
}

/** jsdom no tiene `DataTransfer`: alcanza con la forma que lee el componente. */
function drop(...archivos: File[]): DragEvent {
  return { preventDefault: vi.fn(), dataTransfer: { files: archivos } } as unknown as DragEvent;
}

function sobre(mensaje: string, status: string, datos: unknown = null) {
  return { service_response: { service_status: { http_status: status, http_message: mensaje }, service_data: datos } };
}

function conflicto409(motivo: MotivoDuplicado, mensaje: string, existente = makeDocumento()): HttpErrorResponse {
  return new HttpErrorResponse({ status: 409, error: sobre(mensaje, '409', { motivo, existente }) });
}

describe('CargarDocumentoModal', () => {
  let fixture: ComponentFixture<CargarDocumentoModal>;
  let component: CargarDocumentoModal;
  let svc: { subir: ReturnType<typeof vi.fn> };
  let errorModal: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    svc = { subir: vi.fn() };
    errorModal = { show: vi.fn() };
    await TestBed.configureTestingModule({
      declarations: [CargarDocumentoModal],
      providers: [
        { provide: DocumentosPersonalService, useValue: svc },
        { provide: ErrorModalService, useValue: errorModal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CargarDocumentoModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personaId', 31);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  function boton(texto: string): HTMLButtonElement {
    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    return botones.find((b) => b.textContent?.trim() === texto)!;
  }

  describe('elegir el archivo', () => {
    it('arranca mostrando la zona para arrastrar o elegir', () => {
      expect(component.etapa()).toBe('elegir');
      expect(fixture.nativeElement.querySelector('.carga__zona')).not.toBeNull();
    });

    it('soltar un archivo válido pasa a confirmar', () => {
      const ev = drop(archivo());
      component.onDrop(ev);
      expect(ev.preventDefault).toHaveBeenCalled();
      expect(component.etapa()).toBe('confirmar');
      expect(component.archivo()!.name).toBe('cedula.pdf');
    });

    it('un archivo inválido no pasa a confirmar', () => {
      component.onDrop(drop(archivo('notas.txt', 'text/plain')));
      expect(component.etapa()).toBe('elegir');
      expect(component.error()).toBe('Tipo de archivo no permitido. Solo PDF, JPG o PNG.');
    });

    it('soltar dos archivos se rechaza y no toma ninguno', () => {
      component.onDrop(drop(archivo('a.pdf'), archivo('b.pdf')));
      expect(component.archivo()).toBeNull();
      expect(component.error()).toBe('Soltá un solo archivo a la vez.');
    });

    it('elegir desde el input limpia su valor, para poder volver a elegir el mismo archivo', () => {
      const input = { files: [archivo()], value: 'C:\\fakepath\\cedula.pdf' };
      component.onArchivoElegido({ target: input } as unknown as Event);
      expect(input.value).toBe('');
      expect(component.etapa()).toBe('confirmar');
    });
  });

  describe('subir', () => {
    beforeEach(() => component.onDrop(drop(archivo())));

    it('manda la descripción escrita', () => {
      svc.subir.mockReturnValue(new Subject());
      component.descripcion.set('Cédula');
      component.subir();
      expect(svc.subir).toHaveBeenCalledWith(31, expect.any(File), 'Cédula');
    });

    it('doble clic en Subir manda un solo POST', () => {
      svc.subir.mockReturnValue(new Subject());
      component.subir();
      component.subir();
      expect(svc.subir).toHaveBeenCalledTimes(1);
    });

    it('mientras sube, Subir, Cancelar y la X quedan deshabilitados y cerrar no emite', () => {
      svc.subir.mockReturnValue(new Subject());
      const cerrado = vi.fn();
      component.cerrado.subscribe(cerrado);
      component.subir();
      fixture.detectChanges();

      expect(boton('Cancelar').disabled).toBe(true);
      expect(boton('Subiendo...').disabled).toBe(true);
      expect((fixture.nativeElement.querySelector('.modal__close') as HTMLButtonElement).disabled).toBe(true);
      component.cerrar();
      expect(cerrado).not.toHaveBeenCalled();
    });

    it('mientras sube ignora los archivos que se suelten', () => {
      svc.subir.mockReturnValue(new Subject());
      component.subir();
      component.onDrop(drop(archivo('otro.pdf')));
      expect(component.archivo()!.name).toBe('cedula.pdf');
    });

    it('muestra el porcentaje de la subida', () => {
      const eventos = new Subject<unknown>();
      svc.subir.mockReturnValue(eventos);
      component.subir();
      eventos.next({ type: HttpEventType.UploadProgress, loaded: 50, total: 200 });
      expect(component.progreso()).toBe(25);
    });

    it('sin total la barra es indeterminada, no NaN', () => {
      const eventos = new Subject<unknown>();
      svc.subir.mockReturnValue(eventos);
      component.subir();
      eventos.next({ type: HttpEventType.UploadProgress, loaded: 50 });
      expect(component.progreso()).toBeNull();
      expect(component.textoProgreso()).toBe('Subiendo...');
    });

    it('al 100 % muestra "Procesando..." hasta que llega la respuesta', () => {
      const eventos = new Subject<unknown>();
      svc.subir.mockReturnValue(eventos);
      component.subir();
      eventos.next({ type: HttpEventType.UploadProgress, loaded: 200, total: 200 });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Procesando...');
    });

    it('al terminar emite cargado con el documento', () => {
      const doc = makeDocumento({ id: '13' });
      svc.subir.mockReturnValue(of(new HttpResponse({ body: doc, status: 201 })));
      const cargado = vi.fn();
      component.cargado.subscribe(cargado);
      component.subir();
      expect(cargado).toHaveBeenCalledWith(doc);
      expect(component.subiendo()).toBe(false);
    });
  });

  describe('errores', () => {
    beforeEach(() => component.onDrop(drop(archivo())));

    it('el 409 muestra el existente, emite conflicto y deja editar la descripción', () => {
      svc.subir.mockReturnValue(
        throwError(() => conflicto409('descripcion', 'Ya existe un documento con la descripción «Cédula, frente y dorso»')),
      );
      const conflicto = vi.fn();
      component.conflicto.subscribe(conflicto);
      component.subir();
      fixture.detectChanges();

      expect(component.error()).toBe('Ya existe un documento con la descripción «Cédula, frente y dorso»');
      expect(component.ayudaConflicto()).toBe('Cambiá la descripción y volvé a intentar.');
      expect(conflicto).toHaveBeenCalledWith('12');
      expect(component.etapa()).toBe('confirmar');
      const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
      expect(input.disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('.carga__existente')?.textContent).toContain('Cédula, frente y dorso');
    });

    it('el 409 por nombre sugiere renombrar el archivo', () => {
      svc.subir.mockReturnValue(throwError(() => conflicto409('nombre', 'Ya existe un documento con el nombre «Cédula frente.pdf»')));
      component.subir();
      expect(component.ayudaConflicto()).toBe('Renombrá el archivo en tu computadora y elegilo de nuevo.');
    });

    it('un 409 sin el existente muestra el mensaje y no rompe', () => {
      svc.subir.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: sobre('Este archivo ya está cargado para el funcionario', '409') })),
      );
      const conflicto = vi.fn();
      component.conflicto.subscribe(conflicto);
      component.subir();
      fixture.detectChanges();

      expect(component.error()).toBe('Este archivo ya está cargado para el funcionario');
      expect(component.conflictoActual()).toBeNull();
      expect(conflicto).not.toHaveBeenCalled();
    });

    it('elegir otro archivo después de un 409 limpia el error y el conflicto', () => {
      svc.subir.mockReturnValue(throwError(() => conflicto409('contenido', 'Este archivo ya está cargado para el funcionario')));
      component.subir();
      component.onDrop(drop(archivo('otro.pdf')));
      expect(component.error()).toBeNull();
      expect(component.conflictoActual()).toBeNull();
      expect(component.archivo()!.name).toBe('otro.pdf');
    });

    it('el 403 cierra el modal y abre el modal de error', () => {
      svc.subir.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: sobre('Permiso insuficiente', '403') })));
      const cerrado = vi.fn();
      component.cerrado.subscribe(cerrado);
      component.subir();
      expect(cerrado).toHaveBeenCalled();
      expect(errorModal.show).toHaveBeenCalledWith('Permiso insuficiente');
    });

    it('el 413 se muestra por el status aunque venga sin JSON', () => {
      svc.subir.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413, error: '<html>413</html>' })));
      component.subir();
      expect(component.error()).toBe('El archivo supera el tamaño máximo de 10 MB.');
      expect(component.subiendo()).toBe(false);
    });

    it('después de un 409, un archivo inválido muestra solo su error, sin la ayuda del conflicto', () => {
      svc.subir.mockReturnValue(throwError(() => conflicto409('nombre', 'Ya existe un documento con el nombre «Cédula frente.pdf»')));
      component.subir();
      component.onDrop(drop(archivo('notas.txt', 'text/plain')));
      expect(component.error()).toBe('Tipo de archivo no permitido. Solo PDF, JPG o PNG.');
      expect(component.ayudaConflicto()).toBeNull();
      expect(component.conflictoActual()).toBeNull();
    });

    it('después de un 409, soltar dos archivos tampoco arrastra la ayuda del conflicto', () => {
      svc.subir.mockReturnValue(throwError(() => conflicto409('nombre', 'Ya existe un documento con el nombre «Cédula frente.pdf»')));
      component.subir();
      component.onDrop(drop(archivo('a.pdf'), archivo('b.pdf')));
      expect(component.error()).toBe('Soltá un solo archivo a la vez.');
      expect(component.conflictoActual()).toBeNull();
    });
  });
});
