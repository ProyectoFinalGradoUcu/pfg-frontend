import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { RetirosPage } from './retiros-page';
import { RetirosService } from '../../../../core/services/retiros.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Retiro } from '../../../../core/models/retiros.models';
import { Select } from '../../../../shared/components/select/select';

function makeRetiro(overrides: Partial<Retiro> = {}): Retiro {
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
    vigente: true,
    ...overrides,
  };
}

describe('RetirosPage', () => {
  let fixture: ComponentFixture<RetirosPage>;
  let component: RetirosPage;
  let retiros: { listar: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    retiros = {
      listar: vi
        .fn()
        .mockReturnValue(of({ items: [makeRetiro()], total: 1, page: 1, pageSize: 10 })),
    };

    await TestBed.configureTestingModule({
      declarations: [RetirosPage, Select],
      imports: [FormsModule],
      providers: [
        { provide: RetirosService, useValue: retiros },
        { provide: CatalogosService, useValue: { getMotivosBaja: vi.fn().mockReturnValue(of([])) } },
        { provide: PersonalService, useValue: { getUnidades: vi.fn().mockReturnValue(of([])) } },
        { provide: AuthService, useValue: { hasPermiso: vi.fn().mockReturnValue(true) } },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RetirosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('al montar pide el listado con vigentes en true, que es la pregunta de padrón', () => {
    expect(retiros.listar).toHaveBeenCalledWith(expect.objectContaining({ vigentes: true }));
  });

  it('incluir anulados manda incluir_anulados Y vigentes en false', () => {
    component.setIncluirAnulados(true);
    expect(retiros.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ incluir_anulados: true, vigentes: false }),
    );
  });

  it('incluir anulados vuelve a la página 1', () => {
    component.currentPage.set(3);
    component.setIncluirAnulados(true);
    expect(retiros.listar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('al apagarlo vuelve al padrón: vigentes en true y sin incluir_anulados', () => {
    component.setIncluirAnulados(true);
    component.setIncluirAnulados(false);
    expect(retiros.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ vigentes: true }),
    );
    expect(retiros.listar).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ incluir_anulados: true }),
    );
  });

  it('no manda incluir_anulados cuando está apagado', () => {
    expect(retiros.listar).toHaveBeenCalledWith(
      expect.not.objectContaining({ incluir_anulados: true }),
    );
  });

  it('cambiar de unidad reinicia el paginado', () => {
    component.currentPage.set(4);
    component.setUnidad(5);
    expect(retiros.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ unidad_id: 5, page: 1 }),
    );
  });

  describe('al registrar un retiro', () => {
    const creado = {
      cerrado: { destino: '3', inscripciones: ['301'], usuario: null },
    } as never;

    it('avisa con un toast lo que se cerró', () => {
      component.onRegistrado(creado);
      expect(toast.success).toHaveBeenCalledWith(
        'Retiro registrado: se cerró el destino, se dio de baja 1 inscripción.',
      );
    });

    it('cierra el modal y recarga el listado desde la página 1', () => {
      component.currentPage.set(4);
      component.onRegistrado(creado);
      expect(component.registroAbierto()).toBe(false);
      expect(retiros.listar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    });
  });
});
