import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  DatosCalculoReincorporacionModal,
  cambiosDatosCalculo,
  gradosDelEscalafon,
} from './datos-calculo-reincorporacion-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { RetiroDetalle } from '../../../../core/models/retiros.models';
import { GradoItem } from '../../../../core/models/personal.models';

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

const GRADOS: GradoItem[] = [
  { id: 13, codigo: 'TCNEL', denominacion: 'Teniente Coronel', escalafon_id: 1, orden: 1 },
  { id: 14, codigo: 'CNEL', denominacion: 'Coronel', escalafon_id: 1, orden: 2 },
  { id: 30, codigo: 'SG', denominacion: 'Sargento', escalafon_id: 2, orden: 1 },
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

describe('gradosDelEscalafon', () => {
  it('deja los grados del escalafón del grado de carrera', () => {
    expect(gradosDelEscalafon(GRADOS, 14).map((g) => g.id)).toEqual([13, 14]);
  });

  it('si el grado de carrera no está en el catálogo los ofrece todos', () => {
    expect(gradosDelEscalafon(GRADOS, 99)).toHaveLength(3);
    expect(gradosDelEscalafon(GRADOS, null)).toHaveLength(3);
  });
});

describe('DatosCalculoReincorporacionModal', () => {
  let fixture: ComponentFixture<DatosCalculoReincorporacionModal>;
  let component: DatosCalculoReincorporacionModal;
  let retiros: { actualizarReincorporacion: ReturnType<typeof vi.fn> };
  let personal: { getGrados: ReturnType<typeof vi.fn> };

  async function montar(retiro: RetiroDetalle = makeDetalle()): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [DatosCalculoReincorporacionModal],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: RetirosService, useValue: retiros },
        { provide: PersonalService, useValue: personal },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DatosCalculoReincorporacionModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('retiro', retiro);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    retiros = { actualizarReincorporacion: vi.fn().mockReturnValue(of(makeDetalle())) };
    personal = { getGrados: vi.fn().mockReturnValue(of(GRADOS)) };
  });

  it('precarga los datos actuales, con el porcentaje en %', async () => {
    await montar();
    expect(component.form.getRawValue()).toEqual({
      grado_reincorporacion_id: 14,
      haber_retiro: 45000.5,
      porcentaje: 30,
    });
  });

  it('ofrece los grados del escalafón de la relación cerrada', async () => {
    await montar();
    expect(component.grados().map((g) => g.id)).toEqual([13, 14]);
  });

  it('mantiene el grado cargado aunque ya no esté en el catálogo', async () => {
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
