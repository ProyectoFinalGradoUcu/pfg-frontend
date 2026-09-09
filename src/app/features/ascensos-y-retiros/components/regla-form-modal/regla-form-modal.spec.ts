import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ReglaFormModal } from './regla-form-modal';
import {
  CrearReglaPayload,
  EditarReglaPayload,
  EscalonRegla,
  ReglaAscenso,
} from '../../../../core/models/ascensos.models';

function makeGrado(overrides: Partial<any> = {}) {
  return { id: '3', codigo: 'CBO_2DA', denominacion: 'Cbo. 2ª', orden: 2, ...overrides };
}

function makeRegla(overrides: Partial<ReglaAscenso> = {}): ReglaAscenso {
  return {
    id: '40',
    nombre: 'Cbo. 2.ª → Cbo. 1.ª',
    grado_origen: makeGrado(),
    grado_destino: makeGrado({ id: '4', codigo: 'CBO_1RA', denominacion: 'Cbo. 1ª', orden: 3 }),
    dias_minimos: 730,
    anios: 2,
    meses: 0,
    edad_maxima: 47,
    notas: null,
    es_por_defecto: true,
    activo: true,
    vigente_desde: '2026-09-01',
    vigente_hasta: null,
    actualizado_en: null,
    actualizado_por: null,
    requisitos: [
      {
        id: '70',
        tipo: 'CURSO_APROBADO',
        descripcion: 'Curso de pasaje de grado (M-02)',
        modo: 'TODOS',
        aplica_si: ['ES_MUTADO'],
        parametros: null,
        orden: 1,
        cursos: [{ id: '12', nombre_curso: 'Curso M-02', institucion: 'ETA' }],
      },
    ],
    ...overrides,
  };
}

function makeEscalon(regla: ReglaAscenso | null = makeRegla()): EscalonRegla {
  return {
    grado_origen: makeGrado(),
    grado_destino: makeGrado({ id: '4', codigo: 'CBO_1RA', denominacion: 'Cbo. 1ª', orden: 3 }),
    funcionarios_en_grado: 12,
    regla,
  };
}

describe('ReglaFormModal', () => {
  let fixture: ComponentFixture<ReglaFormModal>;
  let component: ReglaFormModal;

  async function montar(escalon: EscalonRegla): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [ReglaFormModal],
      imports: [FormsModule, ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReglaFormModal);
    component = fixture.componentInstance;
    component.escalon = escalon;
    component.cursos = [{ id: '12', nombre_curso: 'Curso M-02', institucion: 'ETA' }];
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('precarga el formulario con la regla vigente, requisitos incluidos', async () => {
    await montar(makeEscalon());

    expect(component.esAlta()).toBe(false);
    expect(component.form.get('anios')?.value).toBe(2);
    expect(component.form.get('edad_maxima')?.value).toBe(47);
    expect(component.requisitos.length).toBe(1);
    expect(component.requisitos.at(0).get('cursos_ids')?.value).toEqual(['12']);
  });

  it('un tramo sin regla arranca como alta', async () => {
    await montar(makeEscalon(null));

    expect(component.esAlta()).toBe(true);
    expect(component.requisitos.length).toBe(0);
  });

  it('el nombre y el destino no se editan: salen del tramo', async () => {
    await montar(makeEscalon(null));

    let payload: CrearReglaPayload | null = null;
    component.guardar.subscribe((p) => (payload = p as CrearReglaPayload));
    component.onSubmit();

    expect(component.form.get('nombre')).toBeNull();
    expect(component.form.get('grado_destino_id')).toBeNull();
    expect(payload!.nombre).toBe('Cbo. 2ª → Cbo. 1ª');
    expect(payload!.grado_destino_id).toBe(4);
  });

  it('al editar conserva el nombre que ya tenía la regla', async () => {
    await montar(makeEscalon());

    let payload: EditarReglaPayload | null = null;
    component.guardar.subscribe((p) => (payload = p as EditarReglaPayload));
    component.onSubmit();

    expect(payload!.nombre).toBe('Cbo. 2.ª → Cbo. 1.ª');
  });

  it('las reglas no llevan notas: el payload no las manda', async () => {
    await montar(makeEscalon());

    let payload: EditarReglaPayload | null = null;
    component.guardar.subscribe((p) => (payload = p as EditarReglaPayload));
    component.onSubmit();

    expect(component.form.get('notas')).toBeNull();
    expect(payload!.notas).toBeUndefined();
  });

  it('manda el tiempo en días: 365 por año más 30 por mes', async () => {
    await montar(makeEscalon());
    component.form.patchValue({ anios: 1, meses: 6 });

    let payload: CrearReglaPayload | EditarReglaPayload | null = null;
    component.guardar.subscribe((p) => (payload = p));
    component.onSubmit();

    expect((payload as unknown as EditarReglaPayload).dias_minimos).toBe(545);
  });

  it('sin tope de edad manda null aunque el campo tenga un número viejo', async () => {
    await montar(makeEscalon());
    component.form.patchValue({ sin_tope_de_edad: true, edad_maxima: 47 });

    let payload: EditarReglaPayload | null = null;
    component.guardar.subscribe((p) => (payload = p as EditarReglaPayload));
    component.onSubmit();

    expect(payload!.edad_maxima).toBeNull();
  });

  it('en un alta manda también el grado de origen', async () => {
    await montar(makeEscalon(null));

    let payload: CrearReglaPayload | null = null;
    component.guardar.subscribe((p) => (payload = p as CrearReglaPayload));
    component.onSubmit();

    expect(payload!.grado_origen_id).toBe(3);
    expect(payload!.grado_destino_id).toBe(4);
  });

  it('no emite nada si el tiempo mínimo queda en cero', async () => {
    await montar(makeEscalon());
    component.form.patchValue({ anios: 0, meses: 0 });

    const emitido = vi.fn();
    component.guardar.subscribe(emitido);
    component.onSubmit();

    expect(emitido).not.toHaveBeenCalled();
  });

  it('marcar «Siempre» limpia las demás condiciones del requisito', async () => {
    await montar(makeEscalon());

    component.alternarCondicion(0, 'SIEMPRE');

    expect(component.requisitos.at(0).get('aplica_si')?.value).toEqual(['SIEMPRE']);
  });

  it('elegir otra condición saca «Siempre»', async () => {
    await montar(makeEscalon());
    component.alternarCondicion(0, 'SIEMPRE');

    component.alternarCondicion(0, 'NIVEL_LICEAL');

    expect(component.requisitos.at(0).get('aplica_si')?.value).toEqual(['NIVEL_LICEAL']);
  });

  it('avisa cuando un requisito de curso se quedó sin curso vinculado', async () => {
    await montar(makeEscalon());
    expect(component.requisitoSinCurso(0)).toBe(false);

    component.alternarCurso(0, '12');

    expect(component.requisitoSinCurso(0)).toBe(true);
  });
});
