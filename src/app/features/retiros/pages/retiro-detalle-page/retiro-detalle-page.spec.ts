import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterModule, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { MockInstance, vi } from 'vitest';

import { RetiroDetallePage } from './retiro-detalle-page';
import { RetirosService } from '../../../../core/services/retiros.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { DocumentoAdjunto } from '../../../../shared/components/documento-adjunto/documento-adjunto';
import {
  PreviaReincorporacion,
  Reincorporado,
  RetiroDetalle,
} from '../../../../core/models/retiros.models';

function makeDetalle(overrides: Partial<RetiroDetalle> = {}): RetiroDetalle {
  return {
    id: '7',
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    grado: { id: '14', denominacion: 'Coronel' },
    unidad: { id: '5', denominacion: 'E.M.G.F.A.' },
    fecha_retiro: '2026-08-28',
    hora_retiro: null,
    motivo_baja: { codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
    motivo: 'Retiro voluntario',
    anulado: false,
    vigente: true,
    numero_orden: 'O.D. 12455',
    boletin: null,
    observaciones: null,
    relacion_laboral_cerrada: {
      id: '3',
      fecha_inicio: '2005-03-01',
      fecha_fin: '2026-08-28',
      unidad: { id: '5', denominacion: 'E.M.G.F.A.' },
      grado: { id: '14', denominacion: 'Coronel' },
    },
    movimiento: { id: '8', tipo: 'Retiro', fecha: '2026-08-28' },
    cerrado_con_el_retiro: { destino_id: '3', inscripciones_ids: [], usuario_id: '3' },
    registrado_por: { id: '1', username: 'admin@fau.mil.uy' },
    registrado_en: '2026-08-28T13:04:22.117Z',
    anulacion: null,
    reincorporacion: null,
    documentos: { orden: null, boletin: null },
    ...overrides,
  };
}

type Reincorporacion = NonNullable<RetiroDetalle['reincorporacion']>;

function makeReincorporacion(overrides: Partial<Reincorporacion> = {}): Reincorporacion {
  return {
    relacion_laboral_id: '40',
    fecha: '2026-10-01',
    situacion: { codigo: 'SIT16', denominacion: 'Personal Superior reincorporado.' },
    activa: true,
    grado_reincorporacion: { id: '14', denominacion: 'Coronel' },
    haber_retiro: 45000.5,
    porcentaje_progresivo: 0.3,
    faltan_datos_de_calculo: false,
    ...overrides,
  };
}

function reincorporado(overrides: Partial<Reincorporacion> = {}): RetiroDetalle {
  return makeDetalle({ vigente: false, reincorporacion: makeReincorporacion(overrides) });
}

function makePreviaReincorporacion(overrides: Partial<PreviaReincorporacion> = {}): PreviaReincorporacion {
  return {
    retiro: { id: '7', fecha_retiro: '2026-08-28' },
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    situacion: { id: '16', codigo: 'SIT16', denominacion: 'Personal Superior reincorporado.' },
    se_copia: {
      regimen: null,
      programa: null,
      escalafon: null,
      grado: { id: '14', denominacion: 'Coronel' },
      tipo_funcionario: 'oficial',
      fecha_ascenso_oficial: null,
      fecha_ultimo_ascenso: null,
      anios_servicio_anterior: 0,
      anios_inactivos: null,
      riesgo_vuelo: null,
      categoria_viatico: 0,
      usa_fonasa: false,
      superprima: false,
      prima_tecnica: null,
      prima_solidaria_familiar: null,
    },
    unidad_anterior: { id: '5', denominacion: 'E.M.G.F.A.' },
    grados_validos: [{ id: '14', codigo: 'CNEL', denominacion: 'Coronel' }],
    destino_abierto: null,
    bloqueos: [],
    ...overrides,
  };
}

describe('RetiroDetallePage', () => {
  let fixture: ComponentFixture<RetiroDetallePage>;
  let retiros: {
    detalle: ReturnType<typeof vi.fn>;
    previaReincorporacion: ReturnType<typeof vi.fn>;
    subirDocumento: ReturnType<typeof vi.fn>;
    quitarDocumento: ReturnType<typeof vi.fn>;
    inspeccionarDocumento: ReturnType<typeof vi.fn>;
    urlDocumento: ReturnType<typeof vi.fn>;
  };
  let errorModal: { show: ReturnType<typeof vi.fn> };
  let confirmModal: { confirmar: ReturnType<typeof vi.fn> };
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };
  let router: { navigate: MockInstance };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [RetiroDetallePage, DocumentoAdjunto],
      // El template enlaza [routerLink]: sin RouterModule el render falla.
      imports: [RouterModule],
      providers: [
        provideRouter([]),
        { provide: RetirosService, useValue: retiros },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmModalService, useValue: confirmModal },
        { provide: ErrorModalService, useValue: errorModal },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '7' } } } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    router = { navigate: vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) };
    fixture = TestBed.createComponent(RetiroDetallePage);
    fixture.detectChanges();
  }

  function boton(texto: string): HTMLButtonElement | undefined {
    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    return botones.find((b) => b.textContent?.trim() === texto);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    retiros = {
      detalle: vi.fn().mockReturnValue(of(makeDetalle())),
      previaReincorporacion: vi.fn().mockReturnValue(of(makePreviaReincorporacion())),
      subirDocumento: vi.fn().mockReturnValue(of({})),
      quitarDocumento: vi.fn().mockReturnValue(of(null)),
      inspeccionarDocumento: vi.fn().mockReturnValue(of(undefined)),
      urlDocumento: vi.fn(
        (id: string, slot: string, o?: { descarga?: boolean }) =>
          `/api/retiros/${id}/documentos/${slot}${o?.descarga ? '?download=1' : ''}`,
      ),
    };
    confirmModal = { confirmar: vi.fn().mockResolvedValue(true) };
    errorModal = { show: vi.fn() };
    auth = { hasPermiso: vi.fn().mockReturnValue(true) };
    toast = { success: vi.fn(), error: vi.fn() };
  });

  it('resuelve el detalle con GET /retiros/:id y no con la fila del listado', async () => {
    await montar();
    expect(retiros.detalle).toHaveBeenCalledWith('7');
  });

  it('etiqueta el grado y la unidad como del momento del retiro', async () => {
    await montar();
    expect(fixture.nativeElement.textContent).toContain('al momento del retiro');
  });

  it('muestra la etiqueta del movimiento tal como viene, sin normalizar', async () => {
    retiros.detalle.mockReturnValue(
      of(makeDetalle({ movimiento: { id: '8', tipo: 'Baja', fecha: '2026-08-28' } })),
    );
    await montar();
    expect(fixture.nativeElement.textContent).toContain('Baja');
  });

  it('oculta las acciones de escritura sin el permiso retiros.registrar', async () => {
    auth.hasPermiso.mockReturnValue(false);
    await montar();
    expect(fixture.componentInstance.puedeAnular()).toBe(false);
    expect(fixture.componentInstance.puedeCorregir()).toBe(false);
  });

  it('un retiro anulado no se puede corregir ni anular de nuevo: el backend da 409', async () => {
    retiros.detalle.mockReturnValue(of(makeDetalle({ anulado: true, vigente: false })));
    await montar();
    expect(fixture.componentInstance.puedeCorregir()).toBe(false);
    expect(fixture.componentInstance.puedeAnular()).toBe(false);
  });

  // La API devuelve `{}` cuando el retiro no cerró nada.
  it('soporta cerrado_con_el_retiro vacío sin romper', async () => {
    retiros.detalle.mockReturnValue(
      of(makeDetalle({ cerrado_con_el_retiro: {} })),
    );
    await expect(montar()).resolves.not.toThrow();
    expect(fixture.nativeElement.textContent).toContain('No arrastró ningún cierre');
  });

  it('normaliza los cierres ausentes a vacío', async () => {
    retiros.detalle.mockReturnValue(of(makeDetalle({ cerrado_con_el_retiro: {} })));
    await montar();
    expect(fixture.componentInstance.cierres()).toEqual({
      destino: null,
      inscripciones: [],
      comisiones: [],
      usuario: null,
      ninguno: true,
    });
  });

  it('lista los cierres que sí vinieron', async () => {
    retiros.detalle.mockReturnValue(
      of(makeDetalle({ cerrado_con_el_retiro: { destino_id: '3', usuario_id: '4' } })),
    );
    await montar();
    const c = fixture.componentInstance.cierres();
    expect(c.destino).toBe('3');
    expect(c.usuario).toBe('4');
    expect(c.ninguno).toBe(false);
  });

  it('pide la previa de reincorporación del retiro', async () => {
    await montar();
    expect(retiros.previaReincorporacion).toHaveBeenCalledWith('7');
  });

  it('sin el permiso retiros.registrar no pide la previa ni ofrece reincorporar', async () => {
    auth.hasPermiso.mockReturnValue(false);
    await montar();
    expect(retiros.previaReincorporacion).not.toHaveBeenCalled();
    expect(boton('Reincorporar')).toBeUndefined();
  });

  it('un retiro anulado no ofrece reincorporar', async () => {
    retiros.detalle.mockReturnValue(of(makeDetalle({ anulado: true, vigente: false, movimiento: null })));
    await montar();
    expect(retiros.previaReincorporacion).not.toHaveBeenCalled();
    expect(boton('Reincorporar')).toBeUndefined();
  });

  it('con bloqueos deshabilita Reincorporar y muestra los motivos', async () => {
    retiros.previaReincorporacion.mockReturnValue(
      of(makePreviaReincorporacion({ bloqueos: ['El funcionario falleció: no se puede reincorporar.'] })),
    );
    await montar();
    expect(boton('Reincorporar')?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('El funcionario falleció: no se puede reincorporar.');
  });

  it('sin bloqueos habilita Reincorporar', async () => {
    await montar();
    expect(boton('Reincorporar')?.disabled).toBe(false);
  });

  it('si la previa falla deshabilita Reincorporar y lo explica', async () => {
    retiros.previaReincorporacion.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await montar();
    expect(boton('Reincorporar')?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No se pudo verificar si se puede reincorporar');
  });

  it('con la reincorporación hecha la muestra y no ofrece reincorporar de nuevo', async () => {
    retiros.detalle.mockReturnValue(of(reincorporado()));
    await montar();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('fue reincorporado');
    expect(texto).toContain('SIT16');
    expect(texto).toContain('1/10/2026');
    expect(boton('Reincorporar')).toBeUndefined();
    expect(retiros.previaReincorporacion).not.toHaveBeenCalled();
  });

  it('muestra el grado, el haber y el porcentaje de la reincorporación', async () => {
    retiros.detalle.mockReturnValue(of(reincorporado()));
    await montar();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Coronel');
    expect(texto).toContain('$ 45.000,50');
    expect(texto).toContain('30 %');
  });

  it('sin haber ni porcentaje los muestra sin cargar y avisa que faltan', async () => {
    retiros.detalle.mockReturnValue(
      of(reincorporado({ haber_retiro: null, porcentaje_progresivo: null, faltan_datos_de_calculo: true })),
    );
    await montar();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Sin cargar');
    expect(texto).toContain(
      'Falta cargar el haber de retiro y el porcentaje progresivo del acto de reincorporación.',
    );
    expect(texto).not.toMatch(/liquidación|descuent/i);
    expect(boton('Cargar datos')).toBeDefined();
    expect(boton('Corregir datos de cálculo')).toBeUndefined();
  });

  it('con los datos cargados ofrece corregirlos', async () => {
    retiros.detalle.mockReturnValue(of(reincorporado()));
    await montar();
    expect(boton('Corregir datos de cálculo')).toBeDefined();
    expect(boton('Cargar datos')).toBeUndefined();
  });

  it('sin el permiso retiros.registrar avisa lo que falta pero no ofrece cargarlo', async () => {
    auth.hasPermiso.mockReturnValue(false);
    retiros.detalle.mockReturnValue(
      of(reincorporado({ haber_retiro: null, porcentaje_progresivo: null, faltan_datos_de_calculo: true })),
    );
    await montar();
    expect(fixture.nativeElement.textContent).toContain('Falta cargar el haber de retiro');
    expect(boton('Cargar datos')).toBeUndefined();
  });

  it('con la relación de la reincorporación cerrada no ofrece cambiar los datos y explica por qué', async () => {
    retiros.detalle.mockReturnValue(of(reincorporado({ activa: false })));
    await montar();
    expect(boton('Corregir datos de cálculo')).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('sus datos de cálculo no se cambian');
  });

  it('si la relación posterior no es de reincorporado no muestra datos de cálculo', async () => {
    retiros.detalle.mockReturnValue(
      of(
        reincorporado({
          situacion: { codigo: 'SIT01', denominacion: 'Personal Superior.' },
          grado_reincorporacion: null,
          haber_retiro: null,
          porcentaje_progresivo: null,
        }),
      ),
    );
    await montar();
    expect(fixture.nativeElement.textContent).not.toContain('Haber de retiro');
    expect(boton('Corregir datos de cálculo')).toBeUndefined();
  });

  it('al guardar los datos de cálculo usa el detalle devuelto sin volver a pedirlo', async () => {
    retiros.detalle.mockReturnValue(
      of(reincorporado({ haber_retiro: null, porcentaje_progresivo: null, faltan_datos_de_calculo: true })),
    );
    await montar();
    fixture.componentInstance.abrir('datos-calculo');
    fixture.componentInstance.onDatosCalculoGuardados(reincorporado());
    fixture.detectChanges();
    expect(toast.success).toHaveBeenCalledWith('Datos de cálculo guardados.');
    expect(fixture.componentInstance.modalAbierto()).toBeNull();
    expect(retiros.detalle).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).not.toContain('Falta cargar el haber de retiro');
  });

  it('deshabilita Anular en un retiro importado o histórico y explica por qué', async () => {
    retiros.detalle.mockReturnValue(of(makeDetalle({ movimiento: null })));
    await montar();
    expect(boton('Anular')?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('histórico o importado');
  });

  it('deshabilita Anular si el funcionario volvió al servicio después del retiro', async () => {
    retiros.detalle.mockReturnValue(of(makeDetalle({ vigente: false })));
    await montar();
    expect(boton('Anular')?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('volvió al servicio después de este retiro');
  });

  it('deja anular un retiro registrado desde el módulo', async () => {
    await montar();
    expect(boton('Anular')?.disabled).toBe(false);
  });

  it('al reincorporar avisa y vuelve a pedir el detalle', async () => {
    await montar();
    const r: Reincorporado = {
      retiro_id: '7',
      relacion_laboral: {
        id: '40',
        fecha_inicio: '2026-10-01',
        situacion: { codigo: 'SIT16', denominacion: 'Personal Superior reincorporado.' },
      },
      movimiento_id: '90',
      destino: { id: '12', anterior_cerrado: null },
    };
    fixture.componentInstance.onReincorporado(r);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('SIT16'));
    expect(retiros.detalle).toHaveBeenCalledTimes(2);
  });

  it('ante un 404 avisa y vuelve al listado', async () => {
    retiros.detalle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await montar();
    expect(toast.error).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/retiros']);
  });

  describe('respaldo documental', () => {
    const documento = {
      nombre_original: 'orden.pdf',
      content_type: 'application/pdf',
      tamanio_bytes: '2048',
      subido_en: '2026-11-06T12:00:00.000Z',
    };
    const conOrden = (overrides: Partial<RetiroDetalle> = {}) =>
      makeDetalle({ numero_orden: 'O.D. 12455', documentos: { orden: documento, boletin: null }, ...overrides });
    const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    const accion = (titulo: string) =>
      ((fixture.nativeElement as HTMLElement).querySelector(`[title="${titulo}"]`) as HTMLElement | null) ??
      undefined;
    const botonQueContiene = (t: string) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
        b.textContent?.includes(t),
      ) as HTMLButtonElement | undefined;
    const pdf = () => new File(['%PDF-1.4'], 'boletin.pdf', { type: 'application/pdf' });

    it('con documento de orden muestra el nombre, Ver y el link de Descargar', async () => {
      retiros.detalle.mockReturnValue(of(conOrden()));
      await montar();

      expect(texto()).toContain('orden.pdf');
      expect(accion('Ver vista previa')).toBeDefined();
      expect(accion('Descargar')?.getAttribute('href')).toBe('/api/retiros/7/documentos/orden?download=1');
    });

    describe('vista previa', () => {
      const foto = {
        ...documento,
        nombre_original: 'boletin.png',
        content_type: 'image/png',
      };
      const visor = () => (fixture.nativeElement as HTMLElement).querySelector('embed, img');
      const clic = (t: string) => {
        accion(t)!.click();
        fixture.detectChanges();
      };

      it('Ver confirma que el documento exista y lo muestra en la página', async () => {
        retiros.detalle.mockReturnValue(of(conOrden()));
        await montar();

        clic('Ver vista previa');

        expect(retiros.inspeccionarDocumento).toHaveBeenCalledWith('7', 'orden');
        expect(visor()?.tagName).toBe('EMBED');
        expect(visor()?.getAttribute('src')).toBe('/api/retiros/7/documentos/orden');
        expect(accion('Ocultar vista previa')).toBeDefined();
      });

      it('Ocultar cierra la vista previa', async () => {
        retiros.detalle.mockReturnValue(of(conOrden()));
        await montar();

        clic('Ver vista previa');
        clic('Ocultar vista previa');

        expect(visor()).toBeNull();
        expect(accion('Ver vista previa')).toBeDefined();
      });

      it('muestra un documento por vez', async () => {
        retiros.detalle.mockReturnValue(
          of(conOrden({ boletin: 'B.P. 8891', documentos: { orden: documento, boletin: foto } })),
        );
        await montar();

        fixture.componentInstance.alternarVisor('orden');
        fixture.detectChanges();
        fixture.componentInstance.alternarVisor('boletin');
        fixture.detectChanges();

        const visores = (fixture.nativeElement as HTMLElement).querySelectorAll('embed, img');
        expect(visores.length).toBe(1);
        expect(visores[0].tagName).toBe('IMG');
      });

      it('si el documento ya no existe, avisa, no lo muestra y recarga', async () => {
        retiros.detalle.mockReturnValue(of(conOrden()));
        retiros.inspeccionarDocumento.mockReturnValue(
          throwError(() => new HttpErrorResponse({ status: 404 })),
        );
        await montar();

        clic('Ver vista previa');

        expect(visor()).toBeNull();
        expect(toast.error).toHaveBeenCalledWith('El documento ya no existe.');
        expect(retiros.detalle).toHaveBeenCalledTimes(2);
      });

      it('un 403 abre el modal de error y no lo muestra', async () => {
        retiros.detalle.mockReturnValue(of(conOrden()));
        retiros.inspeccionarDocumento.mockReturnValue(
          throwError(() => new HttpErrorResponse({ status: 403 })),
        );
        await montar();

        clic('Ver vista previa');

        expect(errorModal.show).toHaveBeenCalledWith('No tenés permiso para realizar esta acción.');
        expect(visor()).toBeNull();
      });

      it('quitar el documento que se está viendo cierra la vista previa', async () => {
        retiros.detalle.mockReturnValue(of(conOrden()));
        await montar();
        clic('Ver vista previa');

        await fixture.componentInstance.quitar('orden');
        fixture.detectChanges();

        expect(visor()).toBeNull();
      });
    });

    it('sin número ni documento no se muestra la fila ni Adjuntar', async () => {
      await montar();

      const etiquetas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('dt')).map((d) =>
        d.textContent?.trim(),
      );
      expect(etiquetas).toContain('Número de orden');
      expect(etiquetas).not.toContain('Boletín');
      const adjuntar = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Adjuntar'),
      );
      expect(adjuntar.length).toBe(1);
    });

    it('sin respaldo muestra el mensaje vacío aunque se pueda adjuntar', async () => {
      retiros.detalle.mockReturnValue(of(makeDetalle({ numero_orden: null })));
      await montar();

      expect(texto()).toContain('No se cargó número de orden, boletín ni observaciones.');
      expect(botonQueContiene('Adjuntar')).toBeUndefined();
    });

    it('el documento se muestra aunque el número esté vacío', async () => {
      retiros.detalle.mockReturnValue(of(conOrden({ numero_orden: null })));
      await montar();

      expect(texto()).toContain('orden.pdf');
      expect(accion('Ver vista previa')).toBeDefined();
      expect(accion('Quitar')).toBeDefined();
    });

    it('adjuntar sube al slot, avisa y recarga el detalle', async () => {
      await montar();
      const archivo = pdf();

      fixture.componentInstance.adjuntar('boletin', archivo);

      expect(retiros.subirDocumento).toHaveBeenCalledWith('7', 'boletin', archivo);
      expect(toast.success).toHaveBeenCalledWith('Documento adjuntado.');
      expect(retiros.detalle).toHaveBeenCalledTimes(2);
    });

    it('si adjuntar falla, muestra el error y no recarga', async () => {
      retiros.subirDocumento.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413 })));
      await montar();

      fixture.componentInstance.adjuntar('boletin', pdf());

      expect(toast.error).toHaveBeenCalledWith('El archivo supera el tamaño máximo de 10 MB.');
      expect(retiros.detalle).toHaveBeenCalledTimes(1);
    });

    it('quitar pide confirmación y, si se confirma, quita y recarga', async () => {
      retiros.detalle.mockReturnValue(of(conOrden()));
      await montar();

      await fixture.componentInstance.quitar('orden');

      expect(confirmModal.confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ textoConfirmar: 'Quitar', mensaje: expect.stringContaining('orden.pdf') }),
      );
      expect(retiros.quitarDocumento).toHaveBeenCalledWith('7', 'orden');
      expect(toast.success).toHaveBeenCalledWith('Documento quitado.');
      expect(retiros.detalle).toHaveBeenCalledTimes(2);
    });

    it('quitar sin confirmar no llama al servicio', async () => {
      retiros.detalle.mockReturnValue(of(conOrden()));
      confirmModal.confirmar.mockResolvedValue(false);
      await montar();

      await fixture.componentInstance.quitar('orden');

      expect(retiros.quitarDocumento).not.toHaveBeenCalled();
    });

    it('retiro anulado: no muestra Adjuntar ni Quitar', async () => {
      retiros.detalle.mockReturnValue(of(conOrden({ anulado: true, boletin: 'B.P. 8891' })));
      await montar();

      expect(texto()).toContain('orden.pdf');
      expect(botonQueContiene('Adjuntar')).toBeUndefined();
      expect(accion('Quitar')).toBeUndefined();
    });

    it('sin retiros.registrar: no muestra Adjuntar ni Quitar', async () => {
      auth.hasPermiso.mockReturnValue(false);
      retiros.detalle.mockReturnValue(of(conOrden({ boletin: 'B.P. 8891' })));
      await montar();

      expect(accion('Ver vista previa')).toBeDefined();
      expect(botonQueContiene('Adjuntar')).toBeUndefined();
      expect(accion('Quitar')).toBeUndefined();
    });
  });
});
