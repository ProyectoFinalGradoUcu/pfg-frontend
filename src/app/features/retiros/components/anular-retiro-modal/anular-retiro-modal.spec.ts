import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AnularRetiroModal, mensajeReversion } from './anular-retiro-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { RetiroAnulado } from '../../../../core/models/retiros.models';

function anulado(revertido: Partial<RetiroAnulado['revertido']> = {}): RetiroAnulado {
  return {
    id: '6',
    revertido: {
      relacion_laboral: '3',
      movimiento_borrado: '8',
      destino: null,
      inscripciones: [],
      usuario: null,
      ...revertido,
    },
  };
}

describe('mensajeReversion', () => {
  it('nombra solo lo que se revirtió de verdad', () => {
    const msg = mensajeReversion(anulado({ destino: null, usuario: '3' }));
    expect(msg).toContain('Se reabrió la relación laboral');
    expect(msg).toContain('se reactivó la cuenta');
    expect(msg).not.toContain('destino');
  });

  it('menciona las inscripciones en plural cuando hay más de una', () => {
    const msg = mensajeReversion(anulado({ destino: '3', inscripciones: ['1', '2'] }));
    expect(msg).toContain('se reabrió el destino');
    expect(msg).toContain('2 inscripciones');
  });

  it('usa el singular con una sola inscripción', () => {
    expect(mensajeReversion(anulado({ inscripciones: ['1'] }))).toContain('1 inscripción');
  });
});

describe('AnularRetiroModal', () => {
  let fixture: ComponentFixture<AnularRetiroModal>;
  let component: AnularRetiroModal;
  let retiros: { anular: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    retiros = { anular: vi.fn().mockReturnValue(of(anulado())) };

    await TestBed.configureTestingModule({
      declarations: [AnularRetiroModal],
      imports: [ReactiveFormsModule],
      providers: [{ provide: RetirosService, useValue: retiros }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AnularRetiroModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('retiroId', '7');
    fixture.detectChanges();
  });

  it('un click en el overlay no cierra el modal', () => {
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);

    fixture.nativeElement.querySelector('.modal-overlay').click();
    fixture.detectChanges();

    expect(cerrado).not.toHaveBeenCalled();
  });

  it('no deja enviar con menos de 5 caracteres', () => {
    component.form.patchValue({ motivo_anulacion: 'malo' });
    expect(component.form.invalid).toBe(true);
  });

  it('acepta 5 caracteres o más', () => {
    component.form.patchValue({ motivo_anulacion: 'error' });
    expect(component.form.valid).toBe(true);
  });

  it('con el formulario inválido no llama al backend', () => {
    component.form.patchValue({ motivo_anulacion: 'mal' });
    component.confirmar();
    expect(retiros.anular).not.toHaveBeenCalled();
  });

  it('llama a anular con el motivo y emite el resultado', () => {
    const emitido = vi.fn();
    component.anulado.subscribe(emitido);
    component.form.patchValue({ motivo_anulacion: 'Cargado sobre la persona equivocada' });
    component.confirmar();

    expect(retiros.anular).toHaveBeenCalledWith('7', {
      motivo_anulacion: 'Cargado sobre la persona equivocada',
    });
    expect(emitido).toHaveBeenCalled();
  });

  it('muestra el mensaje del backend si falla', () => {
    retiros.anular.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { service_response: { service_status: { http_message: 'Ya estaba anulado.' } } },
          }),
      ),
    );
    component.form.patchValue({ motivo_anulacion: 'Un motivo válido' });
    component.confirmar();
    expect(component.error()).toBe('Ya estaba anulado.');
  });
});
