import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  ReincorporarRetiroModal,
  ValoresReincorporacion,
  armarBodyReincorporacion,
  mensajeReincorporado,
  sinPuntoFinal,
  baseSugerida,
} from './reincorporar-retiro-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { Select } from '../../../../shared/components/select/select';
import { PreviaReincorporacion, Reincorporado } from '../../../../core/models/retiros.models';

function makePrevia(overrides: Partial<PreviaReincorporacion> = {}): PreviaReincorporacion {
  return {
    retiro: { id: '7', fecha_retiro: '2026-01-15' },
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    situacion: { id: '17', codigo: 'SIT17', denominacion: 'Personal Subalterno reincorporado.' },
    se_copia: {
      regimen: { id: '1', denominacion: 'Ley 19.695' },
      programa: { id: '1', denominacion: 'Programa 300' },
      escalafon: { id: '2', denominacion: '(S.G.)' },
      grado: { id: '3', denominacion: 'Sargento' },
      tipo_funcionario: 'subalterno',
      fecha_ascenso_oficial: null,
      fecha_ultimo_ascenso: '2020-02-01',
      anios_servicio_anterior: 2,
      anios_inactivos: null,
      riesgo_vuelo: 1500,
      categoria_viatico: 1,
      usa_fonasa: true,
      superprima: false,
      prima_tecnica: 'VACIO',
      prima_solidaria_familiar: null,
    },
    unidad_anterior: { id: '5', denominacion: 'C.A.O.' },
    sub_unidad_anterior: { id: '50', denominacion: 'B.A.I.' },
    grados_validos: [
      { id: '3', codigo: 'SG', denominacion: 'Sargento' },
      { id: '4', codigo: 'SG1', denominacion: 'Sargento 1°' },
    ],
    destino_abierto: null,
    bloqueos: [],
    ...overrides,
  };
}

function valores(overrides: Partial<ValoresReincorporacion> = {}): ValoresReincorporacion {
  return {
    fecha_reincorporacion: '2026-03-01',
    grado_reincorporacion_id: 3,
    haber_retiro: 45000.5,
    porcentaje: 30,
    sub_unidad_id: 50,
    numero_orden: 'O.D. 13001',
    boletin: '',
    posicion_destino: '',
    observaciones: '',
    ...overrides,
  };
}

function reincorporado(anteriorCerrado: string | null = null): Reincorporado {
  return {
    retiro_id: '7',
    relacion_laboral: {
      id: '40',
      fecha_inicio: '2026-03-01',
      situacion: { codigo: 'SIT17', denominacion: 'Personal Subalterno reincorporado.' },
    },
    movimiento_id: '90',
    destino: { id: '12', anterior_cerrado: anteriorCerrado },
  };
}

describe('armarBodyReincorporacion', () => {
  it('manda el porcentaje como fracción', () => {
    expect(armarBodyReincorporacion(valores({ porcentaje: 30 })).porcentaje_progresivo).toBe(0.3);
  });

  it('redondea la fracción a 4 decimales sin arrastrar error de coma flotante', () => {
    expect(armarBodyReincorporacion(valores({ porcentaje: 33.33 })).porcentaje_progresivo).toBe(0.3333);
  });

  it('manda los ids como número y omite los opcionales vacíos', () => {
    expect(armarBodyReincorporacion(valores({ boletin: '  ', observaciones: '' }))).toEqual({
      fecha_reincorporacion: '2026-03-01',
      grado_reincorporacion_id: 3,
      haber_retiro: 45000.5,
      porcentaje_progresivo: 0.3,
      sub_unidad_id: 50,
      numero_orden: 'O.D. 13001',
    });
  });

  it('sin haber ni porcentaje no los manda', () => {
    const body = armarBodyReincorporacion(valores({ haber_retiro: null, porcentaje: null }));
    expect('haber_retiro' in body).toBe(false);
    expect('porcentaje_progresivo' in body).toBe(false);
  });

  it('recorta los textos', () => {
    const body = armarBodyReincorporacion(
      valores({ numero_orden: '', boletin: ' B.P. 9012 ', posicion_destino: ' Jefe ', observaciones: ' Ok ' }),
    );
    expect(body.numero_orden).toBeUndefined();
    expect(body.boletin).toBe('B.P. 9012');
    expect(body.posicion_destino).toBe('Jefe');
    expect(body.observaciones).toBe('Ok');
  });
});

describe('baseSugerida', () => {
  it('prefiere la base del destino abierto', () => {
    const p = makePrevia({
      destino_abierto: {
        id: '9',
        unidad: { id: '8', denominacion: 'C.A.P.' },
        sub_unidad: { id: '80', denominacion: 'E.T.A.' },
        fecha_inicio: '2025-01-01',
      },
    });
    expect(baseSugerida(p)).toBe(80);
  });

  it('sin destino abierto usa la base de la relación cerrada', () => {
    expect(baseSugerida(makePrevia())).toBe(50);
  });

  it('no sugiere un comando: sin base no sugiere nada', () => {
    expect(baseSugerida(makePrevia({ sub_unidad_anterior: null }))).toBeNull();
  });
});

describe('sinPuntoFinal', () => {
  it('saca el punto final que traen algunas denominaciones', () => {
    expect(sinPuntoFinal('Personal Subalterno reincorporado.')).toBe('Personal Subalterno reincorporado');
  });

  it('deja igual un texto sin punto final', () => {
    expect(sinPuntoFinal('Personal Superior')).toBe('Personal Superior');
  });
});

describe('mensajeReincorporado', () => {
  it('nombra la situación, la fecha y el destino nuevo', () => {
    const msg = mensajeReincorporado(reincorporado());
    expect(msg).toContain('SIT17');
    expect(msg).toContain('1/3/2026');
    expect(msg).toContain('destino nuevo');
    expect(msg).not.toContain('anterior');
  });

  it('avisa cuando cerró el destino que estaba abierto', () => {
    expect(mensajeReincorporado(reincorporado('9'))).toContain('se cerró el anterior');
  });
});

const BAI = { id: '50', denominacion: 'B.A.I.', unidad_id: 5, comando: { id: '5', denominacion: 'C.A.O.' }, etiqueta: 'B.A.I. (C.A.O.)' };
const ETA = { id: '80', denominacion: 'E.T.A.', unidad_id: 8, comando: { id: '8', denominacion: 'C.A.P.' }, etiqueta: 'E.T.A. (C.A.P.)' };

describe('ReincorporarRetiroModal', () => {
  let fixture: ComponentFixture<ReincorporarRetiroModal>;
  let component: ReincorporarRetiroModal;
  let retiros: { reincorporar: ReturnType<typeof vi.fn> };
  let personal: { getGrados: ReturnType<typeof vi.fn>; getBases: ReturnType<typeof vi.fn> };

  async function montar(previa: PreviaReincorporacion = makePrevia()): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [ReincorporarRetiroModal, Select],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: RetirosService, useValue: retiros },
        { provide: PersonalService, useValue: personal },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReincorporarRetiroModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('previa', previa);
    fixture.detectChanges();
  }

  function completar(overrides: Record<string, unknown> = {}): void {
    component.form.patchValue({
      fecha_reincorporacion: '2026-03-01',
      haber_retiro: 45000.5,
      porcentaje: 30,
      numero_orden: 'O.D. 13001',
      ...overrides,
    });
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    retiros = { reincorporar: vi.fn().mockReturnValue(of(reincorporado())) };
    personal = {
      getGrados: vi.fn().mockReturnValue(
        of([
          { id: 3, codigo: 'SG', denominacion: 'Sargento', escalafon_id: 2, orden: 1 },
          { id: 4, codigo: 'SG1', denominacion: 'Sargento 1°', escalafon_id: 2, orden: 2 },
        ]),
      ),
      getBases: vi.fn().mockReturnValue(of([BAI, ETA])),
    };
  });

  it('un click en el overlay no cierra el modal', async () => {
    await montar();
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);
    fixture.nativeElement.querySelector('.modal-overlay').click();
    expect(cerrado).not.toHaveBeenCalled();
  });

  it('propone el grado de carrera y la base sugerida', async () => {
    await montar();
    expect(component.form.controls.grado_reincorporacion_id.value).toBe(3);
    expect(component.form.controls.sub_unidad_id.value).toBe(50);
  });

  it('ofrece los grados válidos de la previa sin pedir el catálogo', async () => {
    await montar();
    expect(component.grados().map((g) => g.id)).toEqual([3, 4]);
    expect(personal.getGrados).not.toHaveBeenCalled();
  });

  it('si el grado de carrera no está entre los válidos lo deja sin elegir', async () => {
    await montar(makePrevia({ grados_validos: [{ id: '4', codigo: 'SG1', denominacion: 'Sargento 1°' }] }));
    expect(component.form.controls.grado_reincorporacion_id.value).toBeNull();
  });

  it('sin grados válidos avisa que no hay para elegir en vez de un combo vacío', async () => {
    await montar(makePrevia({ grados_validos: [] }));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#ri-grado')).toBeNull();
    expect(el.textContent).toContain('No hay grados para elegir');
  });

  it('si la base sugerida no está vigente la deja sin elegir', async () => {
    personal.getBases.mockReturnValue(of([ETA]));
    await montar();
    expect(component.form.controls.sub_unidad_id.value).toBeNull();
  });

  it('con los datos del acto completos el formulario es válido', async () => {
    await montar();
    completar();
    expect(component.form.valid).toBe(true);
  });

  it('se puede reincorporar sin haber ni porcentaje', async () => {
    await montar();
    completar({ haber_retiro: null, porcentaje: null });
    expect(component.form.valid).toBe(true);
  });

  it('el haber y el porcentaje van juntos', async () => {
    await montar();
    completar({ haber_retiro: 45000.5, porcentaje: null });
    expect(component.form.hasError('haberYPorcentaje')).toBe(true);
    completar({ haber_retiro: null, porcentaje: 30 });
    expect(component.form.hasError('haberYPorcentaje')).toBe(true);
  });

  it('avisa que falta el otro dato del par cuando se tocó', async () => {
    await montar();
    completar({ haber_retiro: 45000.5, porcentaje: null });
    expect(component.faltaPar()).toBe(false);
    component.form.controls.haber_retiro.markAsTouched();
    expect(component.faltaPar()).toBe(true);
  });

  it('el haber de retiro no puede ser cero', async () => {
    await montar();
    completar({ haber_retiro: 0 });
    expect(component.form.controls.haber_retiro.invalid).toBe(true);
  });

  it('el haber de retiro admite hasta 2 decimales', async () => {
    await montar();
    completar({ haber_retiro: 100.123 });
    expect(component.form.controls.haber_retiro.invalid).toBe(true);
  });

  it('el porcentaje es mayor que 0 y hasta 100', async () => {
    await montar();
    completar({ porcentaje: 0 });
    expect(component.form.controls.porcentaje.invalid).toBe(true);
    completar({ porcentaje: 100.5 });
    expect(component.form.controls.porcentaje.invalid).toBe(true);
    completar({ porcentaje: 100 });
    expect(component.form.controls.porcentaje.valid).toBe(true);
  });

  it('el porcentaje admite hasta 2 decimales', async () => {
    await montar();
    completar({ porcentaje: 33.333 });
    expect(component.form.controls.porcentaje.invalid).toBe(true);
  });

  it('exige número de orden o boletín', async () => {
    await montar();
    completar({ numero_orden: '', boletin: '' });
    expect(component.form.hasError('ordenOBoletin')).toBe(true);
    completar({ numero_orden: '', boletin: 'B.P. 9012' });
    expect(component.form.hasError('ordenOBoletin')).toBe(false);
  });

  it('la fecha tiene que ser posterior al retiro', async () => {
    await montar();
    completar({ fecha_reincorporacion: '2026-01-15' });
    expect(component.form.controls.fecha_reincorporacion.invalid).toBe(true);
    completar({ fecha_reincorporacion: '2026-01-16' });
    expect(component.form.controls.fecha_reincorporacion.valid).toBe(true);
  });

  it('la fecha no puede ser futura', async () => {
    await montar();
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    completar({ fecha_reincorporacion: manana });
    expect(component.form.controls.fecha_reincorporacion.invalid).toBe(true);
  });

  it('con el formulario inválido no pasa a confirmar', async () => {
    await montar();
    completar({ haber_retiro: 0 });
    component.irAConfirmar();
    expect(component.paso()).toBe('datos');
  });

  it('con bloqueos no deja continuar', async () => {
    await montar(makePrevia({ bloqueos: ['El funcionario falleció: no se puede reincorporar.'] }));
    completar();
    expect(component.puedeContinuar()).toBe(false);
  });

  it('la ayuda de haber y porcentaje no habla de liquidación ni del sueldo', async () => {
    await montar();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Del acto de reincorporación. Se cargan los dos o ninguno.');
    expect(texto).not.toMatch(/liquidación|sueldo|descuent|cobrar/i);
  });

  it('en la confirmación muestra el haber y el porcentaje como dato, sin calcular nada', async () => {
    await montar();
    completar({ haber_retiro: 30000, porcentaje: 20 });
    component.irAConfirmar();
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Haber de retiro: $ 30.000,00 · Porcentaje progresivo: 20 %');
    expect(texto).not.toMatch(/liquidación|sueldo|descuent|cobrar|por mes/i);
  });

  it('los placeholders no parecen datos cargados', async () => {
    await montar();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector<HTMLInputElement>('#ri-haber')!.placeholder).toBe('Ej.: 45.000,50');
    expect(el.querySelector<HTMLInputElement>('#ri-porcentaje')!.placeholder).toBe('Ej.: 30');
  });

  it('avisa que abre un destino nuevo cuando no hay destino abierto', async () => {
    await montar();
    expect(component.efectoDestino()).toContain('Se abre un destino nuevo en B.A.I. (C.A.O.)');
  });

  it('reemplaza el destino abierto aunque se elija su misma base', async () => {
    await montar(
      makePrevia({
        destino_abierto: {
          id: '9',
          unidad: { id: '8', denominacion: 'C.A.P.' },
          sub_unidad: { id: '80', denominacion: 'E.T.A.' },
          fecha_inicio: '2025-04-01',
        },
      }),
    );
    const efecto = component.efectoDestino()!;
    expect(efecto).toContain('Se cierra el destino abierto en E.T.A.');
    expect(efecto).toContain('se abre uno nuevo en E.T.A. (C.A.P.)');
  });

  it('avisa que cierra el destino abierto si se elige otra base', async () => {
    await montar(
      makePrevia({
        destino_abierto: {
          id: '9',
          unidad: { id: '8', denominacion: 'C.A.P.' },
          sub_unidad: { id: '80', denominacion: 'E.T.A.' },
          fecha_inicio: '2025-04-01',
        },
      }),
    );
    component.form.patchValue({ sub_unidad_id: 50 });
    const efecto = component.efectoDestino()!;
    expect(efecto).toContain('Se cierra el destino abierto en E.T.A.');
    expect(efecto).toContain('B.A.I. (C.A.O.)');
  });

  it('confirma con el body armado y emite el resultado', async () => {
    await montar();
    const emitido = vi.fn();
    component.reincorporado.subscribe(emitido);
    completar({ posicion_destino: 'Jefe de Sección' });
    component.irAConfirmar();
    expect(component.paso()).toBe('confirmar');
    component.confirmar();

    expect(retiros.reincorporar).toHaveBeenCalledWith('7', {
      fecha_reincorporacion: '2026-03-01',
      grado_reincorporacion_id: 3,
      haber_retiro: 45000.5,
      porcentaje_progresivo: 0.3,
      sub_unidad_id: 50,
      numero_orden: 'O.D. 13001',
      posicion_destino: 'Jefe de Sección',
    });
    expect(emitido).toHaveBeenCalledWith(reincorporado());
  });

  it('sin haber ni porcentaje confirma diciendo que se pueden cargar después', async () => {
    await montar();
    completar({ haber_retiro: null, porcentaje: null });
    component.irAConfirmar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Haber de retiro y porcentaje: sin cargar (se pueden cargar después)',
    );
    component.confirmar();
    expect(retiros.reincorporar.mock.calls[0][1]).not.toHaveProperty('haber_retiro');
  });

  it('manda la posición aunque la base sea la del destino abierto', async () => {
    await montar(
      makePrevia({
        destino_abierto: {
          id: '9',
          unidad: { id: '8', denominacion: 'C.A.P.' },
          sub_unidad: { id: '80', denominacion: 'E.T.A.' },
          fecha_inicio: '2025-04-01',
        },
      }),
    );
    completar({ posicion_destino: 'Jefe de Sección' });
    component.irAConfirmar();
    component.confirmar();
    expect(retiros.reincorporar.mock.calls[0][1].posicion_destino).toBe('Jefe de Sección');
  });

  it('muestra el mensaje del backend y vuelve a los datos si falla', async () => {
    retiros.reincorporar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              service_response: {
                service_status: { http_message: 'El funcionario ya tiene una relación laboral activa.' },
              },
            },
          }),
      ),
    );
    await montar();
    completar();
    component.irAConfirmar();
    component.confirmar();
    expect(component.error()).toBe('El funcionario ya tiene una relación laboral activa.');
    expect(component.paso()).toBe('datos');

    fixture.detectChanges();
    const cuerpo: HTMLElement = fixture.nativeElement.querySelector('.modal__body');
    expect(cuerpo.firstElementChild?.classList).toContain('modal__error');
  });
});
