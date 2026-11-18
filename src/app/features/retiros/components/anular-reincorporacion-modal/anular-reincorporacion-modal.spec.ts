import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  AnularReincorporacionModal,
  mensajeReincorporacionAnulada,
} from './anular-reincorporacion-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { ReincorporacionAnulada } from '../../../../core/models/retiros.models';

function anulada(revertido: Partial<ReincorporacionAnulada['revertido']> = {}): ReincorporacionAnulada {
  return {
    retiro_id: '4',
    revertido: {
      relacion_laboral_borrada: '78',
      movimientos_borrados: ['22'],
      destino_borrado: '56',
      destino_reabierto: null,
      ...revertido,
    },
  };
}

describe('mensajeReincorporacionAnulada', () => {
  it('nombra solo lo que se revirtió de verdad', () => {
    const msg = mensajeReincorporacionAnulada(anulada());
    expect(msg).toContain('se borró el destino');
    expect(msg).not.toContain('se reabrió el destino anterior');
    expect(msg).toContain('Ahora se puede anular el retiro');
  });

  it('avisa cuando reabrió el destino anterior', () => {
    expect(mensajeReincorporacionAnulada(anulada({ destino_reabierto: '50' }))).toContain(
      'se reabrió el destino anterior',
    );
  });
});

describe('AnularReincorporacionModal', () => {
  let fixture: ComponentFixture<AnularReincorporacionModal>;
  let component: AnularReincorporacionModal;
  let retiros: { anularReincorporacion: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    retiros = { anularReincorporacion: vi.fn().mockReturnValue(of(anulada())) };

    await TestBed.configureTestingModule({
      declarations: [AnularReincorporacionModal],
      imports: [ReactiveFormsModule],
      providers: [{ provide: RetirosService, useValue: retiros }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AnularReincorporacionModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('retiroId', '4');
    fixture.detectChanges();
  });

  it('pide confirmación con un motivo: con menos de 5 caracteres no llama al backend', () => {
    component.form.patchValue({ motivo_anulacion: 'mal' });
    component.confirmar();
    expect(retiros.anularReincorporacion).not.toHaveBeenCalled();
  });

  it('llama a anularReincorporacion con el motivo y emite el resultado', () => {
    const emitido = vi.fn();
    component.anulada.subscribe(emitido);
    component.form.patchValue({ motivo_anulacion: 'Reincorporada por error' });
    component.confirmar();

    expect(retiros.anularReincorporacion).toHaveBeenCalledWith('4', {
      motivo_anulacion: 'Reincorporada por error',
    });
    expect(emitido).toHaveBeenCalled();
  });

  it('muestra el mensaje del backend si falla', () => {
    retiros.anularReincorporacion.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              service_response: { service_status: { http_message: 'Tiene un ascenso registrado.' } },
            },
          }),
      ),
    );
    component.form.patchValue({ motivo_anulacion: 'Un motivo válido' });
    component.confirmar();
    expect(component.error()).toBe('Tiene un ascenso registrado.');
  });
});
