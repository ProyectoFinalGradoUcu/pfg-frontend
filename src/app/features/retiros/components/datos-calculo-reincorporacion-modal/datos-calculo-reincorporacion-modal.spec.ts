import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DatosCalculoReincorporacionModal, cambiosDatosCalculo } from './datos-calculo-reincorporacion-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { PreviaReincorporacion, RetiroDetalle } from '../../../../core/models/retiros.models';

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

function makeDetalle(reincorporacion: Reincorporacion = makeReincorporacion()): RetiroDetalle {
  return {
    id: '7',
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    grado: { id: '14', denominacion: 'Coronel' },
    unidad: { id: '5', denominacion: 'E.M.G.F.A.' },
    fecha_retiro: '2026-08-28',
    hora_retiro: null,
    motivo_baja: { codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
    motivo: null,
    anulado: false,
    vigente: false,
    numero_orden: 'O.D. 12455',
    boletin: null,
    documentos: { orden: null, boletin: null },
    observaciones: null,
    relacion_laboral_cerrada: {
      id: '3',
      fecha_inicio: '2005-03-01',
      fecha_fin: '2026-08-28',
      unidad: { id: '5', denominacion: 'E.M.G.F.A.' },
      grado: { id: '14', denominacion: 'Coronel' },
    },
    movimiento: { id: '8', tipo: 'Retiro', fecha: '2026-08-28' },
    cerrado_con_el_retiro: {},
    registrado_por: null,
    registrado_en: null,
    anulacion: null,
    reincorporacion,
  };
}

/** Después de reincorporar la previa trae un bloqueo: el modal solo usa la lista de grados. */
function makePrevia(gradosValidos: PreviaReincorporacion['grados_validos']): PreviaReincorporacion {
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
    unidad_anterior: null,
    sub_unidad_anterior: null,
    grados_validos: gradosValidos,
    destino_abierto: null,
    bloqueos: ['El funcionario ya tiene una relación laboral activa.'],
  };
}

const GRADOS_VALIDOS = [
  { id: '13', codigo: 'TCNEL', denominacion: 'Teniente Coronel' },
  { id: '14', codigo: 'CNEL', denominacion: 'Coronel' },
];

describe('cambiosDatosCalculo', () => {
  const inicial = { grado_reincorporacion_id: 14, haber_retiro: 45000.5, porcentaje: 30 };

  it('sin cambios no manda nada', () => {
    expect(cambiosDatosCalculo(inicial, inicial)).toEqual({});
  });

  it('manda solo el grado si cambió el grado', () => {
    expect(cambiosDatosCalculo(inicial, { ...inicial, grado_reincorporacion_id: 13 })).toEqual({
      grado_reincorporacion_id: 13,
    });
  });

  it('si cambió uno del par manda los dos, con el porcentaje como fracción', () => {
    expect(cambiosDatosCalculo(inicial, { ...inicial, porcentaje: 33.33 })).toEqual({
      haber_retiro: 45000.5,
      porcentaje_progresivo: 0.3333,
    });
  });

  it('carga el par que faltaba', () => {
    const sinPar = { grado_reincorporacion_id: 14, haber_retiro: null, porcentaje: null };
    expect(cambiosDatosCalculo(sinPar, { ...sinPar, haber_retiro: 1000, porcentaje: 10 })).toEqual({
      haber_retiro: 1000,
      porcentaje_progresivo: 0.1,
    });
  });
});

describe('DatosCalculoReincorporacionModal', () => {
  let fixture: ComponentFixture<DatosCalculoReincorporacionModal>;
  let component: DatosCalculoReincorporacionModal;
  let retiros: {
    actualizarReincorporacion: ReturnType<typeof vi.fn>;
    previaReincorporacion: ReturnType<typeof vi.fn>;
  };

  async function montar(retiro: RetiroDetalle = makeDetalle()): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [DatosCalculoReincorporacionModal],
      imports: [ReactiveFormsModule],
      providers: [{ provide: RetirosService, useValue: retiros }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DatosCalculoReincorporacionModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('retiro', retiro);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    retiros = {
      actualizarReincorporacion: vi.fn().mockReturnValue(of(makeDetalle())),
      previaReincorporacion: vi.fn().mockReturnValue(of(makePrevia(GRADOS_VALIDOS))),
    };
  });

  it('precarga los datos actuales, con el porcentaje en %', async () => {
    await montar();
    expect(component.form.getRawValue()).toEqual({
      grado_reincorporacion_id: 14,
      haber_retiro: 45000.5,
      porcentaje: 30,
    });
  });

  it('ofrece los grados válidos de la previa del retiro, aunque traiga bloqueos', async () => {
    await montar();
    expect(retiros.previaReincorporacion).toHaveBeenCalledWith('7');
    expect(component.grados().map((g) => g.id)).toEqual([13, 14]);
    expect(fixture.nativeElement.textContent).not.toContain('relación laboral activa');
  });

  it('sin grados válidos ni grado cargado avisa que no hay para elegir', async () => {
    retiros.previaReincorporacion.mockReturnValue(of(makePrevia([])));
    await montar(makeDetalle(makeReincorporacion({ grado_reincorporacion: null })));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#dc-grado')).toBeNull();
    expect(el.textContent).toContain('No hay grados para elegir');
  });

  it('si la previa falla lo avisa en el campo del grado', async () => {
    retiros.previaReincorporacion.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await montar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar los grados');
  });

  it('mantiene el grado cargado aunque no esté entre los válidos', async () => {
    await montar(makeDetalle(makeReincorporacion({ grado_reincorporacion: { id: '12', denominacion: 'Mayor' } })));
    expect(component.form.controls.grado_reincorporacion_id.value).toBe(12);
    expect(component.grados().some((g) => g.id === 12 && g.denominacion === 'Mayor')).toBe(true);
  });

  it('sin cambios no deja guardar', async () => {
    await montar();
    expect(component.puedeGuardar()).toBe(false);
  });

  it('con un cambio deja guardar', async () => {
    await montar();
    component.form.patchValue({ grado_reincorporacion_id: 13 });
    expect(component.puedeGuardar()).toBe(true);
  });

  it('cargando lo que falta, el haber y el porcentaje van juntos', async () => {
    await montar(
      makeDetalle(makeReincorporacion({ haber_retiro: null, porcentaje_progresivo: null, faltan_datos_de_calculo: true })),
    );
    component.form.patchValue({ haber_retiro: 45000.5 });
    expect(component.form.hasError('haberYPorcentaje')).toBe(true);
    expect(component.puedeGuardar()).toBe(false);
    component.form.patchValue({ porcentaje: 30 });
    expect(component.puedeGuardar()).toBe(true);
  });

  it('si ya estaban cargados no se pueden borrar', async () => {
    await montar();
    component.form.patchValue({ haber_retiro: null, porcentaje: null });
    expect(component.form.controls.haber_retiro.hasError('required')).toBe(true);
    expect(component.form.controls.porcentaje.hasError('required')).toBe(true);
  });

  it('no calcula plata ni habla de liquidación o del sueldo', async () => {
    await montar();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Del acto de reincorporación. Se cargan los dos o ninguno.');
    expect(texto).not.toMatch(/liquidación|sueldo|descuent|por mes/i);
  });

  it('guarda solo lo que cambió y emite el detalle devuelto', async () => {
    const devuelto = makeDetalle(makeReincorporacion({ porcentaje_progresivo: 0.25 }));
    retiros.actualizarReincorporacion.mockReturnValue(of(devuelto));
    await montar();
    const emitido = vi.fn();
    component.guardado.subscribe(emitido);
    component.form.patchValue({ porcentaje: 25 });
    component.guardar();
    expect(retiros.actualizarReincorporacion).toHaveBeenCalledWith('7', {
      haber_retiro: 45000.5,
      porcentaje_progresivo: 0.25,
    });
    expect(emitido).toHaveBeenCalledWith(devuelto);
  });

  it('muestra arriba el mensaje del backend si falla', async () => {
    retiros.actualizarReincorporacion.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              service_response: {
                service_status: {
                  http_message: 'La relación de la reincorporación ya está cerrada: sus datos de cálculo no se cambian',
                },
              },
            },
          }),
      ),
    );
    await montar();
    component.form.patchValue({ grado_reincorporacion_id: 13 });
    component.guardar();
    fixture.detectChanges();
    expect(component.error()).toContain('ya está cerrada');
    const cuerpo: HTMLElement = fixture.nativeElement.querySelector('.modal__body');
    expect(cuerpo.firstElementChild?.classList).toContain('modal__error');
  });
});
