import { CUSTOM_ELEMENTS_SCHEMA, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DocumentosRegistroComponent } from './documentos-registro';
import { DocumentoAdjunto } from '../documento-adjunto/documento-adjunto';
import { ApiDocumentos, SlotVista } from '../../../core/services/documentos-registro';
import { DocumentoRegistro } from '../../../core/models/documentos-registro.models';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalService } from '../../../core/services/confirm-modal.service';
import { ErrorModalService } from '../../../core/services/error-modal.service';

const documento: DocumentoRegistro = {
  nombre_original: 'orden.pdf',
  content_type: 'application/pdf',
  tamanio_bytes: '2048',
  subido_en: '2026-11-06T12:00:00.000Z',
};

describe('DocumentosRegistroComponent', () => {
  let fixture: ComponentFixture<DocumentosRegistroComponent>;
  let api: {
    subir: ReturnType<typeof vi.fn>;
    quitar: ReturnType<typeof vi.fn>;
    inspeccionar: ReturnType<typeof vi.fn>;
    url: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirmModal: { confirmar: ReturnType<typeof vi.fn> };
  let errorModal: { show: ReturnType<typeof vi.fn> };
  let cambio: ReturnType<typeof vi.fn>;

  const slot = (over: Partial<SlotVista> = {}): SlotVista => ({
    slot: 'orden',
    etiqueta: 'N° de orden',
    numero: 'O.D. 1',
    documento: null,
    api: api as unknown as ApiDocumentos,
    editable: true,
    ...over,
  });
  const boletin = (over: Partial<SlotVista> = {}) =>
    slot({ slot: 'boletin', etiqueta: 'Resolución', numero: 'B.P. 2', ...over });

  async function montar(slots: SlotVista[], registro?: string, mostrarNumero = true): Promise<void> {
    fixture = TestBed.createComponent(DocumentosRegistroComponent);
    const c = fixture.componentInstance;
    c.slots = slots;
    if (registro) c.registro = registro;
    c.mostrarNumero = mostrarNumero;
    cambio = vi.fn();
    c.cambio.subscribe(cambio);
    c.ngOnChanges({ slots: new SimpleChange(undefined, slots, true) });
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';
  const accion = (titulo: string) => el().querySelector(`[title="${titulo}"]`) as HTMLElement | null;
  const boton = (t: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(t)) as
      | HTMLButtonElement
      | undefined;
  const archivo = () => new File(['%PDF-1.4'], 'orden.pdf', { type: 'application/pdf' });

  beforeEach(async () => {
    api = {
      subir: vi.fn().mockReturnValue(of(documento)),
      quitar: vi.fn().mockReturnValue(of(null)),
      inspeccionar: vi.fn().mockReturnValue(of(undefined)),
      url: vi.fn(
        (s: string, o?: { descarga?: boolean }) => `/api/x/documentos/${s}${o?.descarga ? '?download=1' : ''}`,
      ),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirmModal = { confirmar: vi.fn().mockResolvedValue(true) };
    errorModal = { show: vi.fn() };
    await TestBed.configureTestingModule({
      declarations: [DocumentosRegistroComponent, DocumentoAdjunto],
      providers: [
        { provide: ToastService, useValue: toast },
        { provide: ConfirmModalService, useValue: confirmModal },
        { provide: ErrorModalService, useValue: errorModal },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  it('muestra cada slot con su etiqueta y su número', async () => {
    await montar([slot(), boletin()]);

    expect(texto()).toContain('N° de orden');
    expect(texto()).toContain('O.D. 1');
    expect(texto()).toContain('Resolución');
    expect(texto()).toContain('B.P. 2');
  });

  it('con documento y sin número muestra el documento sin Adjuntar', async () => {
    await montar([slot({ numero: null, documento })]);

    expect(texto()).toContain('orden.pdf');
    expect(boton('Adjuntar')).toBeUndefined();
  });

  it('sin número ni documento no muestra el slot', async () => {
    await montar([slot({ numero: null }), boletin()]);

    expect(texto()).not.toContain('N° de orden');
    expect(texto()).toContain('Resolución');
  });

  it('sin ningún slot visible avisa que no hay número de orden ni resolución', async () => {
    await montar([slot({ numero: null }), boletin({ numero: '  ' })]);

    expect(texto()).toContain('Sin número de orden ni resolución.');
  });

  it('con mostrarNumero en false no muestra el número pero sí la etiqueta y el documento', async () => {
    await montar([slot({ documento })], undefined, false);

    expect(texto()).not.toContain('O.D. 1');
    expect(texto()).toContain('N° de orden');
    expect(el().querySelector('app-documento-adjunto')).not.toBeNull();
    expect(texto()).toContain('orden.pdf');
  });

  it('nota se muestra junto al documento', async () => {
    await montar([slot({ documento, nota: 'Cargado en la convocatoria' })]);

    expect(texto()).toContain('Cargado en la convocatoria');
  });

  it('adjuntar llama a api.subir del slot, muestra el documento y emite cambio', async () => {
    await montar([slot()]);
    const f = archivo();

    fixture.componentInstance.adjuntar(fixture.componentInstance.estado()[0], f);
    fixture.detectChanges();

    expect(api.subir).toHaveBeenCalledWith('orden', f);
    expect(toast.success).toHaveBeenCalledWith('Documento adjuntado.');
    expect(texto()).toContain('orden.pdf');
    expect(cambio).toHaveBeenCalledTimes(1);
  });

  it('adjuntar emite ocupadoCambio true y luego false', async () => {
    const subida = new Subject<DocumentoRegistro>();
    api.subir.mockReturnValue(subida);
    await montar([slot()]);
    const ocupado = vi.fn();
    fixture.componentInstance.ocupadoCambio.subscribe(ocupado);

    fixture.componentInstance.adjuntar(fixture.componentInstance.estado()[0], archivo());
    expect(ocupado).toHaveBeenLastCalledWith(true);

    subida.next(documento);
    subida.complete();
    expect(ocupado).toHaveBeenLastCalledWith(false);
  });

  it('adjuntar con 409 avisa y emite cambio', async () => {
    api.subir.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Registro cambiado' } })),
    );
    await montar([slot()]);

    fixture.componentInstance.adjuntar(fixture.componentInstance.estado()[0], archivo());

    expect(toast.error).toHaveBeenCalled();
    expect(cambio).toHaveBeenCalledTimes(1);
  });

  it('adjuntar con otro error avisa y no emite cambio', async () => {
    api.subir.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await montar([slot()]);

    fixture.componentInstance.adjuntar(fixture.componentInstance.estado()[0], archivo());

    expect(toast.error).toHaveBeenCalled();
    expect(cambio).not.toHaveBeenCalled();
  });

  describe('quitar', () => {
    it('pide confirmación con el nombre y el sustantivo, quita y emite cambio', async () => {
      await montar([slot({ documento })], 'este destino');

      accion('Quitar')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(confirmModal.confirmar).toHaveBeenCalledWith({
        titulo: 'Quitar documento',
        mensaje: '¿Quitar «orden.pdf» de este destino?',
        textoConfirmar: 'Quitar',
      });
      expect(api.quitar).toHaveBeenCalledWith('orden');
      expect(toast.success).toHaveBeenCalledWith('Documento quitado.');
      expect(texto()).not.toContain('orden.pdf');
      expect(cambio).toHaveBeenCalledTimes(1);
    });

    it('cancelar no llama a la API', async () => {
      confirmModal.confirmar.mockResolvedValue(false);
      await montar([slot({ documento })]);

      accion('Quitar')!.click();
      await fixture.whenStable();

      expect(api.quitar).not.toHaveBeenCalled();
      expect(cambio).not.toHaveBeenCalled();
    });

    it('un error al quitar avisa y emite cambio', async () => {
      api.quitar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      await montar([slot({ documento })]);

      accion('Quitar')!.click();
      await fixture.whenStable();

      expect(toast.error).toHaveBeenCalled();
      expect(cambio).toHaveBeenCalledTimes(1);
    });
  });

  describe('vista previa', () => {
    const visor = () => el().querySelector('embed, img');
    const clic = (t: string) => {
      accion(t)!.click();
      fixture.detectChanges();
    };

    it('Ver hace HEAD y monta el visor', async () => {
      await montar([slot({ documento })]);

      clic('Ver vista previa');

      expect(api.inspeccionar).toHaveBeenCalledWith('orden');
      expect(visor()?.getAttribute('src')).toBe('/api/x/documentos/orden');
      expect(accion('Ocultar vista previa')).not.toBeNull();
    });

    it('con 404 avisa, no monta el visor y emite cambio', async () => {
      api.inspeccionar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      await montar([slot({ documento })]);

      clic('Ver vista previa');

      expect(toast.error).toHaveBeenCalledWith('El documento ya no existe.');
      expect(visor()).toBeNull();
      expect(cambio).toHaveBeenCalledTimes(1);
    });

    it('con 403 muestra el modal de error', async () => {
      api.inspeccionar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Sin permiso' } })),
      );
      await montar([slot({ documento })]);

      clic('Ver vista previa');

      expect(errorModal.show).toHaveBeenCalled();
      expect(visor()).toBeNull();
    });

    it('muestra un documento por vez', async () => {
      await montar([slot({ documento }), boletin({ documento })]);

      clic('Ver vista previa');
      (el().querySelector('[title="Ver vista previa"]') as HTMLElement).click();
      fixture.detectChanges();

      expect(el().querySelectorAll('embed, img').length).toBe(1);
      expect(api.inspeccionar).toHaveBeenCalledTimes(2);
    });

    it('un cambio de slots con el documento todavía presente mantiene el visor', async () => {
      await montar([slot({ documento }), boletin()]);
      clic('Ver vista previa');

      const nuevos = [slot({ documento }), boletin({ documento })];
      fixture.componentInstance.slots = nuevos;
      fixture.componentInstance.ngOnChanges({ slots: new SimpleChange([], nuevos, false) });
      fixture.detectChanges();

      expect(visor()).not.toBeNull();
    });

    it('un cambio de slots no recrea las filas (el visor abierto no se recarga)', async () => {
      await montar([slot({ documento }), boletin()]);
      const antes = el().querySelector('dl > div');

      const nuevos = [slot({ documento }), boletin()];
      fixture.componentInstance.slots = nuevos;
      fixture.componentInstance.ngOnChanges({ slots: new SimpleChange([], nuevos, false) });
      fixture.detectChanges();

      expect(el().querySelector('dl > div')).toBe(antes);
    });

    it('un cambio de slots sin el documento cierra el visor', async () => {
      await montar([slot({ documento })]);
      clic('Ver vista previa');

      const nuevos = [slot({ documento: null })];
      fixture.componentInstance.slots = nuevos;
      fixture.componentInstance.ngOnChanges({ slots: new SimpleChange([], nuevos, false) });
      fixture.detectChanges();

      expect(visor()).toBeNull();
    });

    it('quitar el documento que se está viendo cierra la vista previa', async () => {
      await montar([slot({ documento })]);

      clic('Ver vista previa');
      accion('Quitar')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(visor()).toBeNull();
    });
  });

  it('slot no editable: sin Adjuntar ni Quitar', async () => {
    await montar([slot({ editable: false, documento }), boletin({ editable: false })]);

    expect(boton('Adjuntar')).toBeUndefined();
    expect(accion('Quitar')).toBeNull();
    expect(accion('Descargar')?.getAttribute('href')).toBe('/api/x/documentos/orden?download=1');
  });
});
