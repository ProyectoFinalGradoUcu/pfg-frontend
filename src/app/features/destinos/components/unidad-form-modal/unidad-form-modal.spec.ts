import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UnidadFormModal } from './unidad-form-modal';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { Select } from '../../../../shared/components/select/select';
import { SubUnidadConDestinados } from '../../../../core/models/destinos.models';

const BASE: SubUnidadConDestinados = {
  id: '10',
  codigo: 'BAI',
  denominacion: 'B.A.I.',
  vigente: true,
  unidad: { id: '1', codigo: 'CAO', denominacion: 'C.A.O.' },
  total_destinados: 0,
};

describe('UnidadFormModal', () => {
  let fixture: ComponentFixture<UnidadFormModal>;
  let component: UnidadFormModal;
  let catalogos: Record<'crearComando' | 'editarComando' | 'crearBase' | 'editarBase', ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    catalogos = {
      crearComando: vi.fn().mockReturnValue(of({})),
      editarComando: vi.fn().mockReturnValue(of({})),
      crearBase: vi.fn().mockReturnValue(of({})),
      editarBase: vi.fn().mockReturnValue(of({})),
    };
    await TestBed.configureTestingModule({
      declarations: [UnidadFormModal, Select],
      imports: [ReactiveFormsModule],
      providers: [{ provide: CatalogosService, useValue: catalogos }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(UnidadFormModal);
    component = fixture.componentInstance;
    component.comandos = [
      { id: '1', codigo: 'CAO', denominacion: 'C.A.O.' },
      { id: '2', codigo: 'CAP', denominacion: 'C.A.P.' },
    ];
  });

  it('crea un comando con el código en mayúsculas', () => {
    component.tipo = 'comando';
    fixture.detectChanges();
    component.form.patchValue({ codigo: ' cnuevo ', denominacion: ' C.NUEVO ' });
    const guardado = vi.fn();
    component.guardado.subscribe(guardado);

    component.guardar();

    expect(catalogos.crearComando).toHaveBeenCalledWith({ codigo: 'CNUEVO', denominacion: 'C.NUEVO' });
    expect(guardado).toHaveBeenCalled();
  });

  it('una base nueva exige comando', () => {
    component.tipo = 'base';
    fixture.detectChanges();
    component.form.patchValue({ codigo: 'BAIV', denominacion: 'B.A.IV.' });

    component.guardar();

    expect(catalogos.crearBase).not.toHaveBeenCalled();
    expect(component.error()).toContain('comando');
  });

  it('crea la base dentro del comando elegido', () => {
    component.tipo = 'base';
    fixture.detectChanges();
    component.form.patchValue({ codigo: 'baiv', denominacion: 'B.A.IV.', unidad_id: '2' });

    component.guardar();

    expect(catalogos.crearBase).toHaveBeenCalledWith({ unidad_id: 2, codigo: 'BAIV', denominacion: 'B.A.IV.' });
  });

  it('al editar una base manda solo lo que cambió', () => {
    component.tipo = 'base';
    component.base = BASE;
    fixture.detectChanges();
    expect(component.form.value.unidad_id).toBe('1');
    component.form.patchValue({ unidad_id: '2' });

    component.guardar();

    expect(catalogos.editarBase).toHaveBeenCalledWith('10', { unidad_id: 2 });
  });

  it('si no cambió nada, cierra sin llamar al backend', () => {
    component.tipo = 'comando';
    component.comando = { id: '1', codigo: 'CAO', denominacion: 'C.A.O.', vigente: true, total_bases: 1 };
    fixture.detectChanges();
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);

    component.guardar();

    expect(catalogos.editarComando).not.toHaveBeenCalled();
    expect(cerrado).toHaveBeenCalled();
  });

  it('muestra el error del backend', () => {
    catalogos.crearComando.mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { message: 'El código "BAI" ya es de la base B.A.I.' }, status: 409 })),
    );
    component.tipo = 'comando';
    fixture.detectChanges();
    component.form.patchValue({ codigo: 'BAI', denominacion: 'Base' });

    component.guardar();

    expect(component.error()).toBeTruthy();
    expect(component.guardando()).toBe(false);
  });
});
