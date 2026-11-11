import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NuevoPersonalPage } from './nuevo-personal-page';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BaseOpcion, PersonaListItem } from '../../../../core/models/personal.models';

function makeBase(id: number, denominacion: string, comando = 'C.A.O.'): BaseOpcion {
  return {
    id,
    codigo: denominacion.replace(/\./g, ''),
    denominacion,
    unidad_id: 3,
    comando: { id: 3, codigo: comando.replace(/\./g, ''), denominacion: comando },
    etiqueta: `${denominacion} (${comando})`,
  };
}

const BASES = [makeBase(12, 'B.A.I.'), makeBase(13, 'B.A.II'), makeBase(20, 'E.T.A.', 'C.A.P.')];

function makePersona(overrides: Partial<PersonaListItem> = {}): PersonaListItem {
  return { id: '16', nombre: 'Laura Acosta', cedula: '60000016', rango: 'Cabo Segundo', destino: 'Base Aérea Nº 1', estado: 'Activo', relacion_estado: 'activo', ...overrides };
}

describe('NuevoPersonalPage', () => {
  let component: NuevoPersonalPage;
  let fixture: ComponentFixture<NuevoPersonalPage>;
  let personalService: {
    getRegimenes: ReturnType<typeof vi.fn>;
    getEscalafones: ReturnType<typeof vi.fn>;
    getProgramas: ReturnType<typeof vi.fn>;
    getSituaciones: ReturnType<typeof vi.fn>;
    getBases: ReturnType<typeof vi.fn>;
    getGrados: ReturnType<typeof vi.fn>;
    findPaginado: ReturnType<typeof vi.fn>;
    crear: ReturnType<typeof vi.fn>;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let auth: {
    alcanceDe: ReturnType<typeof vi.fn>;
    hasPermiso: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };

  function crearComponente(): void {
    fixture = TestBed.createComponent(NuevoPersonalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Datos mínimos para que el resto del formulario sea válido.
    component.form.patchValue({
      cedula: '12345678',
      primer_nombre: 'Prueba',
      primer_apellido: 'Persona',
    });
  }

  beforeEach(async () => {
    personalService = {
      getRegimenes: vi.fn().mockReturnValue(of([])),
      getEscalafones: vi.fn().mockReturnValue(of([])),
      getProgramas: vi.fn().mockReturnValue(of([])),
      getSituaciones: vi.fn().mockReturnValue(of([])),
      getBases: vi.fn().mockReturnValue(of(BASES)),
      getGrados: vi.fn().mockReturnValue(of([])),
      findPaginado: vi.fn().mockReturnValue(of({ items: [makePersona()], total: 1, page: 1, pageSize: 8 })),
      crear: vi.fn().mockReturnValue(of({})),
    };
    toastService = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };
    auth = {
      alcanceDe: vi.fn().mockReturnValue('global'),
      hasPermiso: vi.fn().mockReturnValue(false),
      currentUser: vi.fn().mockReturnValue({ id: '1', unidades: [] }),
    };

    await TestBed.configureTestingModule({
      declarations: [NuevoPersonalPage],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: PersonalService, useValue: personalService },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    crearComponente();
  });

  function llenarDatosLaborales(): void {
    component.form.patchValue({
      tipo_funcionario: 'oficial',
      regimen_id: 1,
      escalafon_id: 1,
      grado_id: 1,
      sub_unidad_id: 12,
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

  describe('base', () => {
    const opciones = () =>
      Array.from(fixture.nativeElement.querySelectorAll('#sub_unidad_id option') as NodeListOf<HTMLOptionElement>)
        .map((o) => o.textContent?.trim());

    it('ofrece todas las bases rotuladas con su comando', () => {
      expect(component.bases().map((b) => b.id)).toEqual([12, 13, 20]);
      expect(opciones()).toEqual(['Seleccionar...', 'B.A.I. (C.A.O.)', 'B.A.II (C.A.O.)', 'E.T.A. (C.A.P.)']);
    });

    it('ya no hay control de unidad: el comando lo pone el backend', () => {
      expect(component.form.get('unidad_id')).toBeNull();
    });

    it('para un militar es obligatoria y sin ella no se manda nada', () => {
      llenarDatosLaborales();
      component.form.patchValue({ sub_unidad_id: null });

      component.submit();

      expect(component.form.get('sub_unidad_id')!.hasError('required')).toBe(true);
      expect(component.hasError('sub_unidad_id')).toBe(true);
      expect(personalService.crear).not.toHaveBeenCalled();
    });

    it('manda sub_unidad_id como número y nunca unidad_id', () => {
      llenarDatosLaborales();
      component.submit();

      const payload = personalService.crear.mock.calls[0][0];
      expect(payload.sub_unidad_id).toBe(12);
      expect('unidad_id' in payload).toBe(false);
    });

    it('para un civil no se exige base ni se manda', () => {
      component.form.get('es_civil')!.setValue(true);
      component.addFamiliar(makePersona());

      expect(component.form.get('sub_unidad_id')!.valid).toBe(true);
      component.submit();

      const payload = personalService.crear.mock.calls[0][0];
      expect('sub_unidad_id' in payload).toBe(false);
      expect('unidad_id' in payload).toBe(false);
    });

    it('al volver de civil a militar la base vuelve a ser obligatoria', () => {
      component.form.get('es_civil')!.setValue(true);
      component.form.get('es_civil')!.setValue(false);

      expect(component.form.get('sub_unidad_id')!.hasError('required')).toBe(true);
    });

    it('con alcance de unidad solo ofrece las bases propias', () => {
      auth.alcanceDe.mockReturnValue('unidad');
      auth.currentUser.mockReturnValue({
        id: '1',
        unidades: [
          { id: '13', denominacion: 'B.A.II', comando: { id: '3', denominacion: 'C.A.O.' } },
          { id: '20', denominacion: 'E.T.A.', comando: { id: '4', denominacion: 'C.A.P.' } },
        ],
      });
      crearComponente();

      expect(auth.alcanceDe).toHaveBeenCalledWith('personas.crear');
      expect(component.bases().map((b) => b.id)).toEqual([13, 20]);
      expect(opciones()).toEqual(['Seleccionar...', 'B.A.II (C.A.O.)', 'E.T.A. (C.A.P.)']);
    });

    it('con alcance de unidad y sin bases asignadas no ofrece ninguna', () => {
      auth.alcanceDe.mockReturnValue('unidad');
      crearComponente();

      expect(component.bases()).toEqual([]);
    });
  });
});
