import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { CambiarSituacionModal, hoyLocal, opcionesDeCambio } from './cambiar-situacion-modal';
import { PersonalService } from '../../../../core/services/personal.service';
import { SituacionRef } from '../../../../core/models/personal.models';

const SIT = (codigo: string, denominacion = codigo): SituacionRef => ({ id: Number(codigo.slice(3)), codigo, denominacion });

describe('opcionesDeCambio', () => {
  it('un oficial en actividad puede pedir licencia sin goce (SIT03) o No Disponible (SIT04)', () => {
    expect(opcionesDeCambio('SIT01', 'oficial').map((o) => [o.cambio, o.destino])).toEqual([
      ['LICENCIA_SIN_GOCE', 'SIT03'],
      ['NO_DISPONIBLE', 'SIT04'],
    ]);
  });

  it('un subalterno solo licencia (SIT09): liquidación no tiene No Disponible para subalternos', () => {
    expect(opcionesDeCambio('SIT07', 'subalterno').map((o) => o.destino)).toEqual(['SIT09']);
  });

  it('un reincorporado también puede pedir licencia', () => {
    expect(opcionesDeCambio('SIT17', 'subalterno').map((o) => o.cambio)).toEqual(['LICENCIA_SIN_GOCE']);
  });

  it('quien está fuera de actividad solo puede volver', () => {
    expect(opcionesDeCambio('SIT03', 'oficial').map((o) => o.cambio)).toEqual(['VOLVER_A_ACTIVIDAD']);
    expect(opcionesDeCambio('SIT09', 'subalterno').map((o) => o.cambio)).toEqual(['VOLVER_A_ACTIVIDAD']);
  });

  it('desde otras situaciones (cadetes, reservistas) no hay opciones', () => {
    expect(opcionesDeCambio('SIT12', 'subalterno')).toEqual([]);
    expect(opcionesDeCambio(undefined, 'oficial')).toEqual([]);
  });
});

describe('CambiarSituacionModal', () => {
  let fixture: ComponentFixture<CambiarSituacionModal>;
  let component: CambiarSituacionModal;
  let svc: { cambiarSituacion: ReturnType<typeof vi.fn> };

  const crear = async (situacion: SituacionRef, tipo = 'oficial') => {
    svc = {
      cambiarSituacion: vi.fn().mockReturnValue(
        of({ persona_id: 42, relacion_anterior_id: 1, relacion_nueva_id: 2, fecha: hoyLocal(),
          situacion_anterior: situacion, situacion: SIT('SIT03', 'Licencia sin goce de sueldo.') }),
      ),
    };
    await TestBed.configureTestingModule({
      declarations: [CambiarSituacionModal],
      imports: [ReactiveFormsModule],
      providers: [{ provide: PersonalService, useValue: svc }],
    }).compileComponents();
    fixture = TestBed.createComponent(CambiarSituacionModal);
    component = fixture.componentInstance;
    component.personaId = 42;
    component.situacion = situacion;
    component.tipoFuncionario = tipo;
    fixture.detectChanges();
  };

  it('pide orden o boletín antes de llamar al backend', async () => {
    await crear(SIT('SIT01'));
    component.form.controls.cambio.setValue('LICENCIA_SIN_GOCE');
    component.guardar();
    expect(component.error()).toContain('orden o el boletín');
    expect(svc.cambiarSituacion).not.toHaveBeenCalled();
  });

  it('avisa que liquidación deja de pagarle al elegir licencia', async () => {
    await crear(SIT('SIT01'));
    component.form.controls.cambio.setValue('LICENCIA_SIN_GOCE');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Liquidación deja de pagarle');
  });

  it('manda el cambio con la orden y emite el resultado', async () => {
    await crear(SIT('SIT01'));
    const emitido = vi.fn();
    component.guardado.subscribe(emitido);
    component.form.patchValue({ cambio: 'LICENCIA_SIN_GOCE', numero_orden: ' O.C.G.F.A. 1 ', fecha: '2026-11-01' });
    component.guardar();
    expect(svc.cambiarSituacion).toHaveBeenCalledWith(42, {
      cambio: 'LICENCIA_SIN_GOCE',
      fecha: '2026-11-01',
      numero_orden: 'O.C.G.F.A. 1',
    });
    expect(emitido).toHaveBeenCalled();
  });

  it('rechaza una fecha futura sin llamar al backend', async () => {
    await crear(SIT('SIT01'));
    component.form.patchValue({ cambio: 'LICENCIA_SIN_GOCE', boletin: 'B.1', fecha: '2999-01-01' });
    component.guardar();
    expect(component.error()).toContain('no puede ser futura');
    expect(svc.cambiarSituacion).not.toHaveBeenCalled();
  });

  it('con licencia, "volver a actividad" ya viene elegido', async () => {
    await crear(SIT('SIT03'));
    expect(component.form.controls.cambio.value).toBe('VOLVER_A_ACTIVIDAD');
  });

  it('muestra el error del backend', async () => {
    await crear(SIT('SIT01'));
    svc.cambiarSituacion.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Anterior al último movimiento' } })),
    );
    component.form.patchValue({ cambio: 'NO_DISPONIBLE', boletin: 'B.1' });
    component.guardar();
    expect(component.error()).toBe('Anterior al último movimiento');
    expect(component.guardando()).toBe(false);
  });
});
