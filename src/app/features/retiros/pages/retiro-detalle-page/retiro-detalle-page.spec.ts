import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { RetiroDetallePage } from './retiro-detalle-page';
import { RetirosService } from '../../../../core/services/retiros.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { RetiroDetalle } from '../../../../core/models/retiros.models';

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
    ...overrides,
  };
}

describe('RetiroDetallePage', () => {
  let fixture: ComponentFixture<RetiroDetallePage>;
  let retiros: { detalle: ReturnType<typeof vi.fn> };
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [RetiroDetallePage],
      providers: [
        { provide: RetirosService, useValue: retiros },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '7' } } } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RetiroDetallePage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    retiros = { detalle: vi.fn().mockReturnValue(of(makeDetalle())) };
    auth = { hasPermiso: vi.fn().mockReturnValue(true) };
    router = { navigate: vi.fn() };
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

  it('ante un 404 avisa y vuelve al listado', async () => {
    retiros.detalle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await montar();
    expect(toast.error).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/retiros']);
  });
});
