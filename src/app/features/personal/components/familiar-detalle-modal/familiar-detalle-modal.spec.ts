import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { FamiliarDetalleModal } from './familiar-detalle-modal';
import { PersonalService } from '../../../../core/services/personal.service';
import { FamiliarItem, PersonaDetalle } from '../../../../core/models/personal.models';

function makeFamiliarItem(overrides: Partial<FamiliarItem> = {}): FamiliarItem {
  return { id: 16, cedula: '60000016', nombre_completo: 'Laura Acosta', tipo_relacion: 'Madre', grado: 'Cabo Segundo', unidad: 'Base Aérea Nº 1', ...overrides };
}

function makePersonaDetalle(overrides: Partial<PersonaDetalle> = {}): PersonaDetalle {
  return {
    id: 16,
    cedula: '60000016',
    nombre_completo: 'Laura Cecilia Acosta Ferreira',
    primer_nombre: 'Laura',
    segundo_nombre: 'Cecilia',
    primer_apellido: 'Acosta',
    segundo_apellido: 'Ferreira',
    fecha_nacimiento: '1993-08-22T00:00:00.000Z',
    email: null,
    telefono: null,
    direccion: null,
    genero: 'F',
    estado_civil: null,
    lugar_nacimiento: null,
    etnia: null,
    codigo_postal: null,
    seccional: null,
    es_civil: false,
    relacion_laboral: null as unknown as PersonaDetalle['relacion_laboral'],
    ...overrides,
  };
}

describe('FamiliarDetalleModal', () => {
  let component: FamiliarDetalleModal;
  let fixture: ComponentFixture<FamiliarDetalleModal>;
  let svc: { getById: ReturnType<typeof vi.fn> };

  function crearFixture(familiar: FamiliarItem = makeFamiliarItem()): void {
    TestBed.configureTestingModule({
      declarations: [FamiliarDetalleModal],
      providers: [{ provide: PersonalService, useValue: svc }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(FamiliarDetalleModal);
    component = fixture.componentInstance;
    component.familiar = familiar;
    fixture.detectChanges();
  }

  beforeEach(() => {
    svc = { getById: vi.fn().mockReturnValue(of(makePersonaDetalle())) };
  });

  it('al iniciar pide el detalle completo del familiar por su id', () => {
    crearFixture(makeFamiliarItem({ id: 16 }));
    expect(svc.getById).toHaveBeenCalledWith(16);
    expect(component.loading()).toBe(false);
    expect(component.detalle()!.nombre_completo).toBe('Laura Cecilia Acosta Ferreira');
  });

  it('ante un error de red/servidor muestra un mensaje y no rompe', () => {
    svc.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    crearFixture();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('No se pudo cargar la información de este familiar. Intentá de nuevo.');
    expect(component.detalle()).toBeNull();
  });

  it('reintentar (cargar de nuevo) limpia el error si esta vez funciona', () => {
    svc.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    crearFixture();
    expect(component.error()).not.toBeNull();

    svc.getById.mockReturnValue(of(makePersonaDetalle()));
    component.cargar();
    expect(component.error()).toBeNull();
    expect(component.detalle()).not.toBeNull();
  });

  it('cerrar emite el evento "cerrado"', () => {
    crearFixture();
    const emitidos: void[] = [];
    component.cerrado.subscribe(() => emitidos.push(undefined));
    component.cerrar();
    expect(emitidos.length).toBe(1);
  });

  describe('helpers de formato', () => {
    beforeEach(() => crearFixture());

    it('initials toma la primera letra del nombre y del apellido', () => {
      expect(component.initials(makePersonaDetalle({ primer_nombre: 'Laura', primer_apellido: 'Acosta' }))).toBe('LA');
    });

    it('formatDate muestra "—" si no hay fecha', () => {
      expect(component.formatDate(null)).toBe('—');
      expect(component.formatDate(undefined)).toBe('—');
    });

    it('formatDate formatea en dd/mm/aaaa', () => {
      expect(component.formatDate('1993-08-22T00:00:00.000Z')).toBe('22/08/1993');
    });

    it('formatGenero traduce el código a texto', () => {
      expect(component.formatGenero('F')).toBe('Femenino');
      expect(component.formatGenero('M')).toBe('Masculino');
      expect(component.formatGenero('O')).toBe('Otro');
    });

    it('formatGenero muestra "—" si no hay género', () => {
      expect(component.formatGenero(null)).toBe('—');
    });
  });
});
