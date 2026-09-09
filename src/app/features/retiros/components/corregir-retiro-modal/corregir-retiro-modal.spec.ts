import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CamposCorregibles, CorregirRetiroModal, payloadCorreccion } from './corregir-retiro-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { RetiroDetalle } from '../../../../core/models/retiros.models';

function makeDetalle(overrides: Partial<RetiroDetalle> = {}): RetiroDetalle {
  return {
    id: '7',
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    grado: null,
    unidad: null,
    fecha_retiro: '2026-08-28',
    hora_retiro: null,
    motivo_baja: { codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
    motivo: 'Retiro voluntario',
    anulado: false,
    vigente: true,
    numero_orden: 'O.D. 12455',
    boletin: null,
    observaciones: null,
    relacion_laboral_cerrada: null,
    movimiento: null,
    cerrado_con_el_retiro: { destino_id: null, inscripciones_ids: [], usuario_id: null },
    registrado_por: null,
    registrado_en: null,
    anulacion: null,
    reincorporacion: null,
    ...overrides,
  };
}

const original = makeDetalle();

const sinCambios: CamposCorregibles = {
  fecha_retiro: '2026-08-28',
  hora_retiro: '',
  motivo_baja_id: 2,
  motivo: 'Retiro voluntario',
  numero_orden: 'O.D. 12455',
  boletin: '',
  observaciones: '',
};

describe('payloadCorreccion', () => {
  it('devuelve un objeto vacío cuando no cambió nada', () => {
    expect(payloadCorreccion(original, sinCambios, 2)).toEqual({});
  });

  it('manda solo la clave que cambió', () => {
    expect(payloadCorreccion(original, { ...sinCambios, fecha_retiro: '2026-08-29' }, 2)).toEqual({
      fecha_retiro: '2026-08-29',
    });
  });

  it('un texto vaciado viaja como null, no como string vacío', () => {
    expect(payloadCorreccion(original, { ...sinCambios, numero_orden: '' }, 2)).toEqual({
      numero_orden: null,
    });
  });

  it('incluye motivo_baja_id solo si cambió respecto del id original', () => {
    expect(payloadCorreccion(original, sinCambios, 5)).toEqual({ motivo_baja_id: 2 });
  });

  it('recorta espacios antes de comparar', () => {
    expect(payloadCorreccion(original, { ...sinCambios, motivo: '  Retiro voluntario  ' }, 2)).toEqual(
      {},
    );
  });
});

describe('CorregirRetiroModal', () => {
  let fixture: ComponentFixture<CorregirRetiroModal>;
  let component: CorregirRetiroModal;
  let retiros: { corregir: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    retiros = { corregir: vi.fn().mockReturnValue(of(makeDetalle())) };

    await TestBed.configureTestingModule({
      declarations: [CorregirRetiroModal],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: RetirosService, useValue: retiros },
        {
          provide: CatalogosService,
          useValue: {
            getMotivosBaja: vi
              .fn()
              .mockReturnValue(
                of([{ id: 2, codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' }]),
              ),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CorregirRetiroModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('retiro', makeDetalle());
    fixture.detectChanges();
  });

  it('un click en el overlay no cierra el modal', () => {
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);

    fixture.nativeElement.querySelector('.modal-overlay').click();
    fixture.detectChanges();

    expect(cerrado).not.toHaveBeenCalled();
  });

  it('precarga el formulario con los datos del retiro', () => {
    expect(component.form.getRawValue().fecha_retiro).toBe('2026-08-28');
    expect(component.form.getRawValue().numero_orden).toBe('O.D. 12455');
  });

  it('si no cambió nada no llama al backend', () => {
    component.confirmar();
    expect(retiros.corregir).not.toHaveBeenCalled();
  });

  it('manda solo lo que cambió', () => {
    component.form.patchValue({ boletin: 'B.P. 8891' });
    component.confirmar();
    expect(retiros.corregir).toHaveBeenCalledWith('7', { boletin: 'B.P. 8891' });
  });

  it('avisa que cambiar la fecha no reajusta la cascada', () => {
    component.form.controls.fecha_retiro.setValue('2026-08-29');
    component.form.controls.fecha_retiro.markAsDirty();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no reajusta');
  });
});
