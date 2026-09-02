import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NuevoPersonalPage } from './nuevo-personal-page';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PersonaListItem } from '../../../../core/models/personal.models';

function makePersona(overrides: Partial<PersonaListItem> = {}): PersonaListItem {
  return { id: '16', nombre: 'Laura Acosta', cedula: '60000016', rango: 'Cabo Segundo', destino: 'Base Aérea Nº 1', estado: 'Activo', ...overrides };
}

describe('NuevoPersonalPage', () => {
  let component: NuevoPersonalPage;
  let fixture: ComponentFixture<NuevoPersonalPage>;
  let personalService: {
    getRegimenes: ReturnType<typeof vi.fn>;
    getEscalafones: ReturnType<typeof vi.fn>;
    getUnidades: ReturnType<typeof vi.fn>;
    getProgramas: ReturnType<typeof vi.fn>;
    getSituaciones: ReturnType<typeof vi.fn>;
    getSubUnidades: ReturnType<typeof vi.fn>;
    getGrados: ReturnType<typeof vi.fn>;
    findPaginado: ReturnType<typeof vi.fn>;
    crear: ReturnType<typeof vi.fn>;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    personalService = {
      getRegimenes: vi.fn().mockReturnValue(of([])),
      getEscalafones: vi.fn().mockReturnValue(of([])),
      getUnidades: vi.fn().mockReturnValue(of([])),
      getProgramas: vi.fn().mockReturnValue(of([])),
      getSituaciones: vi.fn().mockReturnValue(of([])),
      getSubUnidades: vi.fn().mockReturnValue(of([])),
      getGrados: vi.fn().mockReturnValue(of([])),
      findPaginado: vi.fn().mockReturnValue(of({ items: [makePersona()], total: 1, page: 1, pageSize: 8 })),
      crear: vi.fn().mockReturnValue(of({})),
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [NuevoPersonalPage],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: PersonalService, useValue: personalService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NuevoPersonalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Datos mínimos para que el resto del formulario sea válido.
    component.form.patchValue({
      cedula: '12345678',
      primer_nombre: 'Prueba',
      primer_apellido: 'Persona',
    });
  });

  function llenarDatosLaborales(): void {
    component.form.patchValue({
      tipo_funcionario: 'oficial',
      regimen_id: 1,
      escalafon_id: 1,
      grado_id: 1,
      unidad_id: 1,
      programa_id: 1,
      situacion_id: 1,
      fecha_inicio: '2024-01-01',
    });
  }

  describe('trackByFamiliarCedula', () => {
    it('usa la cédula del familiar como identidad (para que el <select> de tipo de relación no se recree)', () => {
      const entry = { persona: makePersona(), tipo_relacion: '' };
      expect(component.trackByFamiliarCedula(0, entry)).toBe('60000016');
    });
  });

  describe('addFamiliar / removeFamiliar', () => {
    it('agrega un familiar y no lo duplica si ya estaba', () => {
      component.addFamiliar(makePersona());
      component.addFamiliar(makePersona());
      expect(component.familiares().length).toBe(1);
    });

    it('quita el error de familiares al agregar el primero', () => {
      component.familiaresError.set(true);
      component.addFamiliar(makePersona());
      expect(component.familiaresError()).toBe(false);
    });

    it('quita un familiar por índice', () => {
      component.addFamiliar(makePersona());
      component.addFamiliar(makePersona({ id: '17', cedula: '60000017', nombre: 'Otro' }));
      component.removeFamiliar(0);
      expect(component.familiares().map(f => f.persona.cedula)).toEqual(['60000017']);
    });
  });

  describe('toggle es_civil', () => {
    it('no borra los familiares ya agregados al pasar de civil a militar (o viceversa)', () => {
      component.addFamiliar(makePersona());
      component.form.get('es_civil')!.setValue(true);
      component.form.get('es_civil')!.setValue(false);
      expect(component.familiares().length).toBe(1);
    });
  });

  describe('submit — familiares no exclusivos de civiles', () => {
    it('para un militar (Oficial/Subalterno) sin familiares, no manda la clave "familiares"', () => {
      llenarDatosLaborales();
      component.submit();
      expect(personalService.crear).toHaveBeenCalled();
      const payload = personalService.crear.mock.calls[0][0];
      expect(payload.familiares).toBeUndefined();
    });

    it('para un militar con familiares agregados, sí los manda', () => {
      llenarDatosLaborales();
      component.addFamiliar(makePersona());
      component.submit();
      const payload = personalService.crear.mock.calls[0][0];
      expect(payload.familiares).toEqual([{ cedula: '60000016' }]);
    });

    it('no exige familiares para crear un militar', () => {
      llenarDatosLaborales();
      component.submit();
      expect(personalService.crear).toHaveBeenCalled();
      expect(component.familiaresError()).toBe(false);
    });

    it('para un civil sin familiares, bloquea el envío y marca el error', () => {
      component.form.get('es_civil')!.setValue(true);
      component.submit();
      expect(personalService.crear).not.toHaveBeenCalled();
      expect(component.familiaresError()).toBe(true);
    });

    it('para un civil con familiares, los manda y no manda datos laborales', () => {
      component.form.get('es_civil')!.setValue(true);
      component.addFamiliar(makePersona());
      component.submit();
      const payload = personalService.crear.mock.calls[0][0];
      expect(payload.familiares).toEqual([{ cedula: '60000016' }]);
      expect(payload.tipo_funcionario).toBeUndefined();
    });

    it('incluye tipo_relacion en el familiar solo si se completó', () => {
      llenarDatosLaborales();
      component.addFamiliar(makePersona());
      component.updateTipoRelacion(0, { target: { value: 'Hermano/a' } } as unknown as Event);
      component.submit();
      const payload = personalService.crear.mock.calls[0][0];
      expect(payload.familiares).toEqual([{ cedula: '60000016', tipo_relacion: 'Hermano/a' }]);
    });
  });
});
