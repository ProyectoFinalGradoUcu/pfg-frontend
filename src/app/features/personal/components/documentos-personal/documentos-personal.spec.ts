import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DocumentosPersonal } from './documentos-personal';
import { DocumentosPersonalService } from '../../../../core/services/documentos-personal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DocumentoPersonal } from '../../../../core/models/documentos-personal.models';

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

const FOTO = makeDocumento({
  id: '13',
  descripcion: null,
  nombre_original: 'scan.png',
  content_type: 'image/png',
  tamanio_bytes: '2048',
  subido_por: null,
});

function sobre(mensaje: string, status: string, datos: unknown = null) {
  return { service_response: { service_status: { http_status: status, http_message: mensaje }, service_data: datos } };
}

describe('DocumentosPersonal', () => {
  let fixture: ComponentFixture<DocumentosPersonal>;
  let component: DocumentosPersonal;
  let svc: {
    listar: ReturnType<typeof vi.fn>;
    inspeccionar: ReturnType<typeof vi.fn>;
    cambiarDescripcion: ReturnType<typeof vi.fn>;
    eliminar: ReturnType<typeof vi.fn>;
    url: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errorModal: { show: ReturnType<typeof vi.fn> };

  async function montar({ puedeEditar = true, documentos = [makeDocumento(), FOTO] } = {}): Promise<void> {
    svc = {
      listar: vi.fn().mockReturnValue(of(documentos)),
      inspeccionar: vi.fn().mockReturnValue(of(undefined)),
      cambiarDescripcion: vi.fn(),
      eliminar: vi.fn(),
      url: vi.fn(
        (personaId: number, id: string, opciones?: { descarga?: boolean }) =>
          `/api/personas/${personaId}/documentos/${id}${opciones?.descarga ? '?download=1' : ''}`,
      ),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    errorModal = { show: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [DocumentosPersonal],
      providers: [
        { provide: DocumentosPersonalService, useValue: svc },
        { provide: ToastService, useValue: toast },
        { provide: ErrorModalService, useValue: errorModal },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentosPersonal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personaId', 31);
    fixture.componentRef.setInput('puedeEditar', puedeEditar);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botones(texto: string): HTMLElement[] {
    return Array.from(el().querySelectorAll('button, a')).filter(
      (b) => b.textContent?.trim() === texto,
    ) as HTMLElement[];
  }

  function acciones(prefijo: string, raiz: ParentNode = el()): HTMLElement[] {
    return Array.from(raiz.querySelectorAll('[aria-label]')).filter((b) =>
      b.getAttribute('aria-label')!.startsWith(prefijo),
    ) as HTMLElement[];
  }

  function ficha(id: string): HTMLElement {
    return el().querySelector(`[data-documento-id="${id}"] .docs__ficha`) as HTMLElement;
  }

  describe('lista', () => {
    it('lista los documentos del funcionario al montar', async () => {
      await montar();
      expect(svc.listar).toHaveBeenCalledWith(31);
      expect(el().querySelectorAll('.docs__item').length).toBe(2);
    });

    it('el título es la descripción, o el nombre si no tiene, sin repetirlo en los metadatos', async () => {
      await montar();
      expect(ficha('12').querySelector('.docs__titulo')!.textContent!.trim()).toBe('Cédula, frente y dorso');
      expect(ficha('12').querySelector('.docs__meta')!.textContent).toContain('Cédula frente.pdf');
      expect(ficha('13').querySelector('.docs__titulo')!.textContent!.trim()).toBe('scan.png');
      expect(ficha('13').querySelector('.docs__meta')!.textContent).not.toContain('scan.png');
    });

    it('la línea bajo el título muestra tamaño y fecha, sin quién lo subió ni la hora', async () => {
      await montar();
      const meta12 = ficha('12').querySelector('.docs__meta')!.textContent!;
      expect(meta12).toContain('179.9 KB');
      expect(meta12).toContain('30/09/2026');
      expect(meta12).not.toContain('admin@fau.mil.uy');
      expect(meta12).not.toMatch(/\d{2}:\d{2}/);
    });

    it('sin documentos muestra el vacío', async () => {
      await montar({ documentos: [] });
      expect(el().textContent).toContain('Este funcionario no tiene documentos cargados.');
    });

    it('un error al listar muestra el mensaje y Reintentar vuelve a pedir', async () => {
      await montar();
      svc.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.listar();
      fixture.detectChanges();
      expect(el().textContent).toContain('No se pudieron cargar los documentos. Intentá de nuevo.');

      svc.listar.mockReturnValue(of([makeDocumento()]));
      (botones('Reintentar')[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(svc.listar).toHaveBeenCalledTimes(3);
      expect(el().querySelectorAll('.docs__item').length).toBe(1);
    });

    it('un 403 al listar abre el modal de error', async () => {
      await montar();
      svc.listar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: sobre('Permiso insuficiente', '403') })),
      );
      component.listar();
      expect(errorModal.show).toHaveBeenCalledWith('Permiso insuficiente');
    });
  });

  describe('permisos', () => {
    it('sin permiso de edición no hay Cargar, Editar ni Eliminar; Ver y Descargar sí', async () => {
      await montar({ puedeEditar: false });
      expect(botones('Cargar documento').length).toBe(0);
      expect(acciones('Editar descripción').length).toBe(0);
      expect(acciones('Eliminar «').length).toBe(0);
      expect(acciones('Ver vista previa').length).toBe(2);
      expect(acciones('Descargar «').length).toBe(2);
    });

    it('con permiso aparecen las acciones de escritura', async () => {
      await montar();
      expect(botones('Cargar documento').length).toBe(1);
      expect(acciones('Editar descripción').length).toBe(2);
      expect(acciones('Eliminar «').length).toBe(2);
    });
  });

  describe('ver y descargar', () => {
    it('Descargar es un link con ?download=1 y el atributo download', async () => {
      await montar();
      const link = acciones('Descargar «')[0] as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/api/personas/31/documentos/12?download=1');
      expect(link.hasAttribute('download')).toBe(true);
    });

    it('Ver abre el visor de un documento por vez', async () => {
      await montar();
      component.alternarVisor(makeDocumento());
      fixture.detectChanges();
      expect(el().querySelector('[data-documento-id="12"] embed')).not.toBeNull();

      component.alternarVisor(FOTO);
      fixture.detectChanges();
      expect(el().querySelector('embed')).toBeNull();
      expect(el().querySelector('[data-documento-id="13"] img')).not.toBeNull();
      expect(component.visorId()).toBe('13');
    });

    it('Ver de nuevo lo oculta', async () => {
      await montar();
      component.alternarVisor(makeDocumento());
      component.alternarVisor(makeDocumento());
      expect(component.visorId()).toBeNull();
      expect(component.visorUrl()).toBeNull();
    });

    it('la URL del visor se calcula una sola vez, no en cada detección de cambios', async () => {
      await montar();
      component.alternarVisor(makeDocumento());
      fixture.detectChanges();
      fixture.detectChanges();
      fixture.detectChanges();
      const llamadasDelVisor = svc.url.mock.calls.filter((c) => !c[2]?.descarga);
      expect(llamadasDelVisor.length).toBe(1);
    });
  });

  describe('ver un documento que ya no está', () => {
    it('Ver confirma con HEAD que el documento existe antes de montar el visor', async () => {
      await montar();
      component.alternarVisor(makeDocumento());
      expect(svc.inspeccionar).toHaveBeenCalledWith(31, '12');
      expect(component.visorId()).toBe('12');
    });

    it('si otro usuario lo borró, avisa, no monta el visor y vuelve a listar', async () => {
      await montar();
      svc.inspeccionar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      component.alternarVisor(makeDocumento());
      fixture.detectChanges();
      expect(component.visorId()).toBeNull();
      expect(el().querySelector('embed')).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('El documento ya no existe.');
      expect(svc.listar).toHaveBeenCalledTimes(2);
    });

    it('un 403 al ver abre el modal de error y no monta el visor', async () => {
      await montar();
      svc.inspeccionar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      component.alternarVisor(makeDocumento());
      expect(errorModal.show).toHaveBeenCalledWith('No tenés permiso para realizar esta acción.');
      expect(component.visorId()).toBeNull();
    });
  });

  describe('datos del documento', () => {
    function resumen(id: string): HTMLButtonElement {
      return ficha(id).querySelector('.docs__resumen') as HTMLButtonElement;
    }

    function detalle(id: string): HTMLElement | null {
      return el().querySelector(`#docs-detalle-${id}`);
    }

    it('tocar el título despliega los datos sin pedir nada al backend, y tocarlo de nuevo los oculta', async () => {
      await montar();
      resumen('12').click();
      fixture.detectChanges();

      const panel = detalle('12')!;
      expect(panel).not.toBeNull();
      expect(panel.textContent).toContain('Cédula frente.pdf');
      expect(panel.textContent).toContain('PDF');
      expect(panel.textContent).toContain('179.9 KB');
      expect(panel.textContent).toMatch(/30\/09\/2026 \d{2}:\d{2}/);
      expect(panel.textContent).toContain('admin@fau.mil.uy');
      expect(resumen('12').getAttribute('aria-expanded')).toBe('true');
      expect(svc.inspeccionar).not.toHaveBeenCalled();

      resumen('12').click();
      fixture.detectChanges();
      expect(detalle('12')).toBeNull();
      expect(resumen('12').getAttribute('aria-expanded')).toBe('false');
    });

    it('sin usuario registrado dice "Sin registrar"', async () => {
      await montar();
      resumen('13').click();
      fixture.detectChanges();
      expect(detalle('13')!.textContent).toContain('Sin registrar');
      expect(detalle('13')!.textContent).toContain('PNG');
    });

    it('abrir los datos de otro documento cierra los anteriores', async () => {
      await montar();
      resumen('12').click();
      resumen('13').click();
      fixture.detectChanges();
      expect(detalle('12')).toBeNull();
      expect(detalle('13')).not.toBeNull();
    });

    it('los datos y la vista previa son independientes: Ver y el lápiz no despliegan los datos', async () => {
      await montar();
      (acciones('Ver vista previa', ficha('12'))[0] as HTMLButtonElement).click();
      (acciones('Editar descripción', ficha('13'))[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(detalle('12')).toBeNull();
      expect(detalle('13')).toBeNull();
      expect(component.visorId()).toBe('12');
    });

    it('mientras se edita la descripción, esa ficha no se despliega', async () => {
      await montar();
      component.empezarEdicion(makeDocumento());
      fixture.detectChanges();
      expect(resumen('12')).toBeNull();
    });

    it('borrar el documento cierra sus datos', async () => {
      await montar();
      svc.eliminar.mockReturnValue(of(null));
      resumen('12').click();
      component.pedirEliminar(makeDocumento());
      component.confirmarEliminar();
      expect(component.detalleId()).toBeNull();
    });

    it('volver a listar cierra los datos abiertos', async () => {
      await montar();
      resumen('12').click();
      component.listar();
      expect(component.detalleId()).toBeNull();
    });
  });

  describe('íconos', () => {
    it('los íconos tienen tooltip y nombran el documento en su aria-label', async () => {
      await montar();
      const [ver] = acciones('Ver vista previa', ficha('12'));
      const [descargar] = acciones('Descargar «', ficha('12'));
      const [eliminar] = acciones('Eliminar «', ficha('12'));
      expect(ver.getAttribute('aria-label')).toBe('Ver vista previa de «Cédula, frente y dorso»');
      expect(ver.getAttribute('title')).toBe('Ver vista previa');
      expect(descargar.getAttribute('aria-label')).toBe('Descargar «Cédula, frente y dorso»');
      expect(descargar.getAttribute('title')).toBe('Descargar');
      expect(eliminar.getAttribute('aria-label')).toBe('Eliminar «Cédula, frente y dorso»');
      expect(eliminar.getAttribute('title')).toBe('Eliminar');
      expect(ver.textContent!.trim()).toBe('');
    });

    it('con la vista previa abierta el ojo pasa a "Ocultar vista previa"', async () => {
      await montar();
      component.alternarVisor(makeDocumento());
      fixture.detectChanges();
      const [ocultar] = acciones('Ocultar vista previa', ficha('12'));
      expect(ocultar.getAttribute('aria-label')).toBe('Ocultar vista previa de «Cédula, frente y dorso»');
      expect(ocultar.getAttribute('title')).toBe('Ocultar vista previa');
      expect(ocultar.getAttribute('aria-pressed')).toBe('true');
    });

    it('el lápiz está al lado del título, no con las demás acciones', async () => {
      await montar();
      const fila = ficha('12').querySelector('.docs__titulo-fila')!;
      expect(acciones('Editar descripción', fila).length).toBe(1);
      expect(acciones('Editar descripción', ficha('12').querySelector('.docs__acciones')!).length).toBe(0);
      expect(acciones('Editar descripción', fila)[0].getAttribute('title')).toBe('Editar descripción');
    });
  });

  describe('carga', () => {
    it('Cargar documento abre el modal', async () => {
      await montar();
      (botones('Cargar documento')[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().querySelector('app-cargar-documento-modal')).not.toBeNull();
    });

    it('al cargarse cierra el modal y agrega el documento arriba', async () => {
      await montar();
      component.abrirCarga();
      const nuevo = makeDocumento({ id: '20', descripcion: 'Título' });
      component.onCargado(nuevo);
      fixture.detectChanges();

      expect(component.modalCargaAbierto()).toBe(false);
      expect(component.documentos()[0].id).toBe('20');
      expect(component.documentos().length).toBe(3);
      expect(toast.success).toHaveBeenCalledWith('Documento cargado');
    });

    it('un conflicto resalta el existente y al cerrar el modal se desplaza hasta él', async () => {
      await montar();
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      component.abrirCarga();
      component.onConflicto('12');
      component.onCargaCerrada();
      fixture.detectChanges();

      expect(component.modalCargaAbierto()).toBe(false);
      expect(ficha('12').classList.contains('docs__ficha--resaltada')).toBe(true);
      expect(scroll).toHaveBeenCalled();
    });

    it('la próxima acción limpia el resaltado', async () => {
      await montar();
      component.onConflicto('12');
      component.alternarVisor(FOTO);
      expect(component.resaltadoId()).toBeNull();
    });
  });

  describe('resaltado después de resolver el conflicto', () => {
    it('una carga exitosa después de un conflicto limpia el resaltado', async () => {
      await montar();
      component.onConflicto('12');
      component.onCargado(makeDocumento({ id: '20', descripcion: 'Otra' }));
      expect(component.resaltadoId()).toBeNull();
    });
  });

  describe('arrastre con el modal cerrado', () => {
    it('un drop sobre la página se cancela y no abre el modal', async () => {
      await montar();
      const ev = new Event('drop', { cancelable: true });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(component.modalCargaAbierto()).toBe(false);
    });

    it('con el modal cerrado el cursor muestra que no se puede soltar', async () => {
      await montar();
      const ev = { preventDefault: vi.fn(), dataTransfer: { dropEffect: 'copy' } } as unknown as DragEvent;
      component.bloquearArrastre(ev);
      expect(ev.dataTransfer!.dropEffect).toBe('none');
    });

    it('con el modal abierto no toca el dropEffect: el modal recibe el archivo', async () => {
      await montar();
      component.abrirCarga();
      const ev = { preventDefault: vi.fn(), dataTransfer: { dropEffect: 'copy' } } as unknown as DragEvent;
      component.bloquearArrastre(ev);
      expect(ev.dataTransfer!.dropEffect).toBe('copy');
    });
  });

  describe('editar la descripción', () => {
    it('Editar muestra el input con la descripción actual', async () => {
      await montar();
      (acciones('Editar descripción')[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      const input = ficha('12').querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('Cédula, frente y dorso');
    });

    it('Guardar manda el texto recortado y reemplaza el documento en la lista', async () => {
      await montar();
      const actualizado = makeDocumento({ descripcion: 'Cédula vigente' });
      svc.cambiarDescripcion.mockReturnValue(of(actualizado));
      component.empezarEdicion(makeDocumento());
      component.descripcionEditada.set('  Cédula vigente  ');
      component.guardarDescripcion(makeDocumento());

      expect(svc.cambiarDescripcion).toHaveBeenCalledWith(31, '12', 'Cédula vigente');
      expect(component.documentos()[0].descripcion).toBe('Cédula vigente');
      expect(component.editandoId()).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('Descripción actualizada');
    });

    it('vaciar la descripción manda null', async () => {
      await montar();
      svc.cambiarDescripcion.mockReturnValue(of(makeDocumento({ descripcion: null })));
      component.empezarEdicion(makeDocumento());
      component.descripcionEditada.set('');
      component.guardarDescripcion(makeDocumento());
      expect(svc.cambiarDescripcion).toHaveBeenCalledWith(31, '12', null);
    });

    it('sin cambios no pide nada y cierra la edición', async () => {
      await montar();
      component.empezarEdicion(makeDocumento());
      component.guardarDescripcion(makeDocumento());
      expect(svc.cambiarDescripcion).not.toHaveBeenCalled();
      expect(component.editandoId()).toBeNull();
    });

    it('solo espacios sobre un documento sin descripción no pide nada', async () => {
      await montar();
      component.empezarEdicion(FOTO);
      component.descripcionEditada.set('   ');
      component.guardarDescripcion(FOTO);
      expect(svc.cambiarDescripcion).not.toHaveBeenCalled();
    });

    it('Enter guarda y Escape cancela', async () => {
      await montar();
      svc.cambiarDescripcion.mockReturnValue(of(makeDocumento({ descripcion: 'Otra' })));
      component.empezarEdicion(makeDocumento());
      component.descripcionEditada.set('Otra');
      const enter = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
      component.onTeclaEdicion(enter, makeDocumento());
      expect(svc.cambiarDescripcion).toHaveBeenCalledTimes(1);

      component.empezarEdicion(makeDocumento());
      component.onTeclaEdicion({ key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent, makeDocumento());
      expect(component.editandoId()).toBeNull();
    });

    it('abrir la edición de otra ficha cancela la anterior', async () => {
      await montar();
      component.empezarEdicion(makeDocumento());
      component.empezarEdicion(FOTO);
      expect(component.editandoId()).toBe('13');
    });

    it('el 409 deja el input abierto con el mensaje y resalta el existente', async () => {
      await montar();
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      svc.cambiarDescripcion.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: sobre('Ya existe un documento con la descripción «Cédula, frente y dorso»', '409', {
                motivo: 'descripcion',
                existente: makeDocumento(),
              }),
            }),
        ),
      );
      component.empezarEdicion(FOTO);
      component.descripcionEditada.set('Cédula, frente y dorso');
      component.guardarDescripcion(FOTO);
      fixture.detectChanges();

      expect(component.editandoId()).toBe('13');
      expect(component.errorEdicion()).toBe('Ya existe un documento con la descripción «Cédula, frente y dorso»');
      expect(component.resaltadoId()).toBe('12');
      expect(scroll).toHaveBeenCalled();
      expect(ficha('13').textContent).toContain('Ya existe un documento');
    });

    it('un 409 sin el existente muestra el mensaje y no resalta', async () => {
      await montar();
      svc.cambiarDescripcion.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: sobre('Ya existe un documento con la descripción «x»', '409') })),
      );
      component.empezarEdicion(FOTO);
      component.descripcionEditada.set('x');
      component.guardarDescripcion(FOTO);
      expect(component.errorEdicion()).toBe('Ya existe un documento con la descripción «x»');
      expect(component.resaltadoId()).toBeNull();
    });

    it('el 404 avisa que ya no existe y vuelve a listar', async () => {
      await montar();
      svc.cambiarDescripcion.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: sobre('Documento no encontrado', '404') })),
      );
      component.empezarEdicion(makeDocumento());
      component.descripcionEditada.set('Otra');
      component.guardarDescripcion(makeDocumento());
      expect(toast.error).toHaveBeenCalledWith('El documento ya no existe.');
      expect(svc.listar).toHaveBeenCalledTimes(2);
      expect(component.editandoId()).toBeNull();
    });

    it('el 403 cierra la edición y abre el modal de error', async () => {
      await montar();
      svc.cambiarDescripcion.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: sobre('Permiso insuficiente', '403') })),
      );
      component.empezarEdicion(makeDocumento());
      component.descripcionEditada.set('Otra');
      component.guardarDescripcion(makeDocumento());
      expect(errorModal.show).toHaveBeenCalledWith('Permiso insuficiente');
      expect(component.editandoId()).toBeNull();
    });
  });

  describe('edición: resaltado y foco', () => {
    function conflicto409(): HttpErrorResponse {
      return new HttpErrorResponse({
        status: 409,
        error: sobre('Ya existe un documento con la descripción «Cédula, frente y dorso»', '409', {
          motivo: 'descripcion',
          existente: makeDocumento(),
        }),
      });
    }

    it('guardar bien después de un 409 limpia el resaltado', async () => {
      await montar();
      Element.prototype.scrollIntoView = vi.fn();
      svc.cambiarDescripcion
        .mockReturnValueOnce(throwError(() => conflicto409()))
        .mockReturnValueOnce(of(makeDocumento({ id: '13', descripcion: 'Otra' })));
      component.empezarEdicion(FOTO);
      component.descripcionEditada.set('Cédula, frente y dorso');
      component.guardarDescripcion(FOTO);
      expect(component.resaltadoId()).toBe('12');

      component.descripcionEditada.set('Otra');
      component.guardarDescripcion(FOTO);
      expect(component.resaltadoId()).toBeNull();
    });

    it('Editar pone el foco en el input, para que Enter y Escape anden de entrada', async () => {
      await montar();
      component.empezarEdicion(makeDocumento());
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(ficha('12').querySelector('input'));
    });

    it('después de un error al guardar el foco vuelve al input', async () => {
      await montar();
      Element.prototype.scrollIntoView = vi.fn();
      svc.cambiarDescripcion.mockReturnValue(throwError(() => conflicto409()));
      component.empezarEdicion(FOTO);
      fixture.detectChanges();
      await fixture.whenStable();
      (document.activeElement as HTMLElement | null)?.blur();

      component.descripcionEditada.set('Cédula, frente y dorso');
      component.guardarDescripcion(FOTO);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(ficha('13').querySelector('input'));
    });
  });

  describe('eliminar', () => {
    it('pide confirmación avisando que no se puede recuperar', async () => {
      await montar();
      (acciones('Eliminar «')[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      const modal = el().querySelector('.modal') as HTMLElement;
      expect(modal.textContent).toContain('Eliminar documento');
      expect(modal.textContent).toContain('«Cédula, frente y dorso»');
      expect(modal.textContent).toContain('No se puede recuperar.');
    });

    it('confirmar saca la ficha y cierra el visor si era el abierto', async () => {
      await montar();
      svc.eliminar.mockReturnValue(of(null));
      component.alternarVisor(makeDocumento());
      component.pedirEliminar(makeDocumento());
      component.confirmarEliminar();

      expect(svc.eliminar).toHaveBeenCalledWith(31, '12');
      expect(component.documentos().map((d) => d.id)).toEqual(['13']);
      expect(component.visorId()).toBeNull();
      expect(component.aEliminar()).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('Documento eliminado');
    });

    it('eliminar el documento que está en edición cierra la edición', async () => {
      await montar();
      svc.eliminar.mockReturnValue(of(null));
      component.empezarEdicion(makeDocumento());
      component.pedirEliminar(makeDocumento());
      component.confirmarEliminar();
      expect(component.editandoId()).toBeNull();
    });

    it('confirmar dos veces manda un solo DELETE', async () => {
      await montar();
      svc.eliminar.mockReturnValue(new Subject());
      component.pedirEliminar(makeDocumento());
      component.confirmarEliminar();
      component.confirmarEliminar();
      expect(svc.eliminar).toHaveBeenCalledTimes(1);
    });

    it('el 404 al eliminar avisa y vuelve a listar', async () => {
      await montar();
      svc.eliminar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: sobre('Documento no encontrado', '404') })),
      );
      component.pedirEliminar(makeDocumento());
      component.confirmarEliminar();
      expect(toast.error).toHaveBeenCalledWith('El documento ya no existe.');
      expect(svc.listar).toHaveBeenCalledTimes(2);
      expect(component.aEliminar()).toBeNull();
    });

    it('el 403 al eliminar abre el modal de error', async () => {
      await montar();
      svc.eliminar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: sobre('Permiso insuficiente', '403') })),
      );
      component.pedirEliminar(makeDocumento());
      component.confirmarEliminar();
      expect(errorModal.show).toHaveBeenCalledWith('Permiso insuficiente');
    });
  });
});
