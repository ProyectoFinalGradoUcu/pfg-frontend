import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { UnidadFormModal } from './unidad-form-modal';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { Unidad } from '../../../../core/models/destinos.models';
import { Select } from '../../../../shared/components/select/select';

function makeUnidad(overrides: Partial<Unidad> = {}): Unidad {
  return {
    id: '5',
    codigo: 'COA',
    denominacion: 'Comando Aéreo de Operaciones (C.O.A.)',
    tipo: 'Unidad',
    vigente: true,
    ...overrides,
  };
}

describe('UnidadFormModal (crear)', () => {
  let component: UnidadFormModal;
  let fixture: ComponentFixture<UnidadFormModal>;
  let catalogosService: { crearUnidad: ReturnType<typeof vi.fn>; editarUnidad: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    catalogosService = {
      crearUnidad: vi.fn().mockReturnValue(of(makeUnidad())),
      editarUnidad: vi.fn().mockReturnValue(of(makeUnidad())),
    };

    await TestBed.configureTestingModule({
      // `Select` (app-select) se declara acá porque el campo Tipo lo usa con
      // formControlName: sin el componente real registrado, NgModel no encuentra un
      // ControlValueAccessor sobre el elemento y explota con NG01203 en detectChanges().
      declarations: [UnidadFormModal, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [{ provide: CatalogosService, useValue: catalogosService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadFormModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('empieza sin editar', () => {
    expect(component.editando()).toBe(false);
  });

  it('exige código y denominación', () => {
    component.guardar();
    expect(catalogosService.crearUnidad).not.toHaveBeenCalled();
    expect(component.error()).toBe('Completá los campos requeridos.');
  });

  it('crea con código, denominación y tipo', () => {
    component.form.patchValue({ codigo: 'BAIII', denominacion: 'Base Aérea Nº 3 (B.A.III)', tipo: 'Unidad' });
    component.guardar();
    expect(catalogosService.crearUnidad).toHaveBeenCalledWith({
      codigo: 'BAIII',
      denominacion: 'Base Aérea Nº 3 (B.A.III)',
      tipo: 'Unidad',
    });
  });

  it('omite tipo si no se elige ninguno', () => {
    component.form.patchValue({ codigo: 'BAIII', denominacion: 'Base Aérea Nº 3' });
    component.guardar();
    expect(catalogosService.crearUnidad).toHaveBeenCalledWith({
      codigo: 'BAIII',
      denominacion: 'Base Aérea Nº 3',
    });
  });

  it('recorta espacios de código y denominación', () => {
    component.form.patchValue({ codigo: '  BAIII  ', denominacion: '  Base Aérea Nº 3  ' });
    component.guardar();
    expect(catalogosService.crearUnidad).toHaveBeenCalledWith({
      codigo: 'BAIII',
      denominacion: 'Base Aérea Nº 3',
    });
  });

  it('emite guardado con la unidad que devuelve el backend', () => {
    const emitido: Unidad[] = [];
    component.guardado.subscribe((u: Unidad) => emitido.push(u));
    component.form.patchValue({ codigo: 'BAIII', denominacion: 'Base Aérea Nº 3' });
    component.guardar();
    expect(emitido.length).toBe(1);
    expect(emitido[0].codigo).toBe('COA'); // lo que devuelve el mock, no lo que se mandó
  });

  it('ante un 409 de código o denominación duplicados, muestra el mensaje del backend y deja el modal abierto', () => {
    catalogosService.crearUnidad.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              service_response: {
                service_status: { http_status: '409', http_message: 'Ya existe una unidad con ese código' },
                service_data: null,
              },
            },
          }),
      ),
    );
    const emitido: Unidad[] = [];
    const cerrados: void[] = [];
    component.guardado.subscribe((u: Unidad) => emitido.push(u));
    component.cerrado.subscribe(() => cerrados.push(undefined));
    component.form.patchValue({ codigo: 'COA', denominacion: 'Comando Aéreo de Operaciones (C.O.A.)' });
    component.guardar();
    expect(component.error()).toBe('Ya existe una unidad con ese código');
    expect(component.guardando()).toBe(false);
    expect(emitido.length).toBe(0);
    expect(cerrados.length).toBe(0); // el modal se queda abierto: no emite ni guardado ni cerrado
  });

  it('cerrar emite cerrado', () => {
    const cerrados: void[] = [];
    component.cerrado.subscribe(() => cerrados.push(undefined));
    component.cerrar();
    expect(cerrados.length).toBe(1);
  });
});

describe('UnidadFormModal (editar)', () => {
  let component: UnidadFormModal;
  let fixture: ComponentFixture<UnidadFormModal>;
  let catalogosService: { crearUnidad: ReturnType<typeof vi.fn>; editarUnidad: ReturnType<typeof vi.fn> };

  /**
   * `unidad` se asigna ANTES del primer `detectChanges()` (el que dispara `ngOnInit`).
   * Si se asignara después, `precargarEdicion` ya habría corrido con `unidad = null` y
   * el formulario quedaría vacío.
   */
  function crearFixtureEditando(unidad: Unidad): void {
    catalogosService = {
      crearUnidad: vi.fn().mockReturnValue(of(makeUnidad())),
      editarUnidad: vi.fn().mockReturnValue(of(makeUnidad())),
    };

    TestBed.configureTestingModule({
      declarations: [UnidadFormModal, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [{ provide: CatalogosService, useValue: catalogosService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(UnidadFormModal);
    component = fixture.componentInstance;
    component.unidad = unidad;
    fixture.detectChanges();
  }

  it('precarga el formulario con los datos de la unidad', () => {
    crearFixtureEditando(makeUnidad());
    expect(component.form.get('denominacion')!.value).toBe('Comando Aéreo de Operaciones (C.O.A.)');
    expect(component.form.get('tipo')!.value).toBe('Unidad');
  });

  it('manda al servicio solo la clave que cambió', () => {
    crearFixtureEditando(makeUnidad());
    component.form.patchValue({ denominacion: 'Nuevo nombre' });
    component.guardar();
    // Igualdad exacta de objeto: protege contra el rechazo por `forbidNonWhitelisted`
    // si algún día se manda una clave de más (empezando por `codigo`).
    expect(catalogosService.editarUnidad).toHaveBeenCalledWith('5', { denominacion: 'Nuevo nombre' });
  });

  it('nunca manda codigo en el payload de edición, aunque el formulario lo conserve precargado', () => {
    crearFixtureEditando(makeUnidad());
    component.form.patchValue({ denominacion: 'Otro nombre' });
    component.guardar();
    const payloadMandado = catalogosService.editarUnidad.mock.calls[0][1];
    expect('codigo' in payloadMandado).toBe(false);
  });

  it('si no se cambió nada, cierra sin guardar en vez de llamar al backend', () => {
    crearFixtureEditando(makeUnidad());
    const cerrados: void[] = [];
    component.cerrado.subscribe(() => cerrados.push(undefined));
    component.guardar();
    expect(catalogosService.editarUnidad).not.toHaveBeenCalled();
    expect(cerrados.length).toBe(1);
  });

  it('limpia el tipo cuando se lo vacía', () => {
    crearFixtureEditando(makeUnidad());
    component.form.patchValue({ tipo: '' });
    component.guardar();
    expect(catalogosService.editarUnidad).toHaveBeenCalledWith('5', { tipo: null });
  });

  it('exige que la denominación no quede vacía', () => {
    crearFixtureEditando(makeUnidad());
    component.form.patchValue({ denominacion: '' });
    component.guardar();
    expect(catalogosService.editarUnidad).not.toHaveBeenCalled();
    expect(component.error()).toBe('La denominación es obligatoria.');
  });

  it('ante un 409 de denominación duplicada, muestra el mensaje del backend y deja el modal abierto', () => {
    crearFixtureEditando(makeUnidad());
    catalogosService.editarUnidad.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              service_response: {
                service_status: { http_status: '409', http_message: 'Ya existe una unidad con esa denominación' },
                service_data: null,
              },
            },
          }),
      ),
    );
    const cerrados: void[] = [];
    component.cerrado.subscribe(() => cerrados.push(undefined));
    component.form.patchValue({ denominacion: 'Otro nombre' });
    component.guardar();
    expect(component.error()).toBe('Ya existe una unidad con esa denominación');
    expect(cerrados.length).toBe(0);
  });
});
