import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import { RetiroFormModal, mensajeCierres } from './retiro-form-modal';
import { RetirosService } from '../../../../core/services/retiros.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { PreviaRetiro, Retiro } from '../../../../core/models/retiros.models';
import { DEBOUNCE_MS } from '../../retiro-presentacion';
import { Select } from '../../../../shared/components/select/select';

function makePrevia(overrides: Partial<PreviaRetiro> = {}): PreviaRetiro {
  return {
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    relacion_laboral: null,
    destino_vigente: null,
    inscripciones_activas: [],
    usuario: null,
    vivienda: null,
    bloqueos: [],
    ...overrides,
  };
}

function makeRetiro(): Retiro {
  return {
    id: '7',
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    grado: null,
    unidad: null,
    fecha_retiro: '2026-08-28',
    hora_retiro: null,
    motivo_baja: { codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
    motivo: null,
    anulado: false,
    vigente: true,
  };
}

const esperarDebounce = () => new Promise((r) => setTimeout(r, DEBOUNCE_MS + 60));

describe('RetiroFormModal', () => {
  let fixture: ComponentFixture<RetiroFormModal>;
  let component: RetiroFormModal;
  let retiros: { previa: ReturnType<typeof vi.fn>; registrar: ReturnType<typeof vi.fn> };
  let catalogos: { getMotivosBaja: ReturnType<typeof vi.fn> };

  async function montar(personaId: string | null = '1'): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [RetiroFormModal, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: RetirosService, useValue: retiros },
        { provide: CatalogosService, useValue: catalogos },
        {
          provide: PersonalService,
          useValue: { findAll: vi.fn().mockReturnValue(of([])) },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RetiroFormModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personaId', personaId);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    retiros = {
      previa: vi.fn().mockReturnValue(of(makePrevia())),
      registrar: vi
        .fn()
        .mockReturnValue(
          of({ ...makeRetiro(), cerrado: { destino: null, inscripciones: [], usuario: null } }),
        ),
    };
    catalogos = {
      getMotivosBaja: vi
        .fn()
        .mockReturnValue(
          of([{ id: 5, codigo: 'RETIRO_OBL', denominacion: 'Baja por retiro obligatorio.' }]),
        ),
    };
  });

  it('un click en el overlay no cierra el modal', async () => {
    await montar();
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);

    fixture.nativeElement.querySelector('.modal-overlay').click();
    fixture.detectChanges();

    expect(cerrado).not.toHaveBeenCalled();
  });

  it('Cancelar sí cierra: es deliberado', async () => {
    await montar();
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);

    component.cerrar();

    expect(cerrado).toHaveBeenCalled();
  });

  it('al montar pide el catálogo de motivos', async () => {
    await montar();
    expect(catalogos.getMotivosBaja).toHaveBeenCalled();
  });

  it('NO pide la previa al montar: calcularía destino, cursos y cuenta para nada', async () => {
    await montar();
    expect(retiros.previa).not.toHaveBeenCalled();
  });

  it('pide la previa cuando hay una fecha válida', async () => {
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28' });
    await esperarDebounce();
    expect(retiros.previa).toHaveBeenCalledWith('1', '2026-08-28');
  });

  it('vuelve a pedir la previa si cambia la fecha: el impacto depende de la fecha', async () => {
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28' });
    await esperarDebounce();
    component.form.patchValue({ fecha_retiro: '2026-08-31' });
    await esperarDebounce();

    expect(retiros.previa).toHaveBeenCalledTimes(2);
    expect(retiros.previa).toHaveBeenLastCalledWith('1', '2026-08-31');
  });

  it('pre-tilda los ítems con cerrar_sugerido y respeta los que vienen en false', async () => {
    retiros.previa.mockReturnValue(
      of(
        makePrevia({
          destino_vigente: { id: '3', unidad: null, fecha_inicio: null, cerrar_sugerido: true },
          inscripciones_activas: [
            {
              id: '301',
              curso: { id: '9', nombre_curso: 'Estado Mayor' },
              fecha_inicio: null,
              cerrar_sugerido: true,
            },
          ],
          usuario: { id: '3', username: 'jefe@fau.mil.uy', cerrar_sugerido: false },
        }),
      ),
    );
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28' });
    await esperarDebounce();

    expect(component.cerrarDestino()).toBe(true);
    expect(component.inscripcionesElegidas()).toEqual(['301']);
    expect(component.cerrarUsuario()).toBe(false);
  });

  it('la vivienda no genera checkbox: es informativa', async () => {
    retiros.previa.mockReturnValue(
      of(makePrevia({ vivienda: { vivienda_id: '3', informativo: true } })),
    );
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28' });
    await esperarDebounce();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('bloqueos deshabilita el envío', async () => {
    retiros.previa.mockReturnValue(
      of(makePrevia({ bloqueos: ['El funcionario ya tiene un retiro vigente.'] })),
    );
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28', motivo_baja_id: 5 });
    await esperarDebounce();

    expect(component.puedeConfirmar()).toBe(false);
  });

  it('manda cerrar SIEMPRE explícito, con lo que quedó tildado', async () => {
    retiros.previa.mockReturnValue(
      of(
        makePrevia({
          destino_vigente: { id: '3', unidad: null, fecha_inicio: null, cerrar_sugerido: true },
          inscripciones_activas: [
            {
              id: '301',
              curso: { id: '9', nombre_curso: 'Estado Mayor' },
              fecha_inicio: null,
              cerrar_sugerido: true,
            },
          ],
          usuario: { id: '3', username: 'jefe@fau.mil.uy', cerrar_sugerido: true },
        }),
      ),
    );
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28', motivo_baja_id: 5 });
    await esperarDebounce();

    component.cerrarUsuario.set(false); // el operador lo destilda
    component.confirmar();

    expect(retiros.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        persona_id: 1,
        cerrar: { destino: true, inscripciones: [301], usuario: false },
      }),
    );
  });

  it('las inscripciones viajan como número, no como string', async () => {
    retiros.previa.mockReturnValue(
      of(
        makePrevia({
          inscripciones_activas: [
            {
              id: '301',
              curso: { id: '9', nombre_curso: 'Estado Mayor' },
              fecha_inicio: null,
              cerrar_sugerido: true,
            },
          ],
        }),
      ),
    );
    await montar();
    component.form.patchValue({ fecha_retiro: '2026-08-28', motivo_baja_id: 5 });
    await esperarDebounce();
    component.confirmar();

    expect(retiros.registrar.mock.calls[0][0].cerrar.inscripciones).toEqual([301]);
  });

  it('emite lo que el backend cerró de verdad, no lo que dijo la previa', async () => {
    retiros.previa.mockReturnValue(
      of(
        makePrevia({
          destino_vigente: { id: '3', unidad: null, fecha_inicio: null, cerrar_sugerido: true },
        }),
      ),
    );
    retiros.registrar.mockReturnValue(
      of({ ...makeRetiro(), cerrado: { destino: null, inscripciones: [], usuario: '3' } }),
    );
    await montar();

    const emitido = vi.fn();
    component.registrado.subscribe(emitido);
    component.form.patchValue({ fecha_retiro: '2026-08-28', motivo_baja_id: 5 });
    await esperarDebounce();
    component.confirmar();

    expect(emitido.mock.calls[0][0].cerrado).toEqual({
      destino: null,
      inscripciones: [],
      usuario: '3',
    });
  });

  it('sin personaId arranca en el paso de elegir persona', async () => {
    await montar(null);
    expect(component.paso()).toBe('persona');
  });

  it('sin personaId carga el padrón para el selector con buscador', async () => {
    await montar(null);
    expect(TestBed.inject(PersonalService).findAll).toHaveBeenCalled();
  });

  describe('cambiar de funcionario sin cerrar el modal', () => {
    const padron = [
      { id: '1', nombre: 'Ana Pereyra', cedula: '60000001', rango: null, destino: null, estado: null, relacion_estado: 'activo' as const },
      { id: '2', nombre: 'Juan Silva', cedula: '60000002', rango: null, destino: null, estado: null, relacion_estado: 'activo' as const },
    ];

    async function montarConPadron(): Promise<void> {
      await montar(null);
      component.personal.set(padron);
    }

    it('elegir a otro funcionario vuelve al paso de datos con la persona nueva', async () => {
      await montarConPadron();
      component.elegirPersona('1');
      expect(component.personaElegida()?.nombre).toBe('Ana Pereyra');

      component.cambiarPersona();
      expect(component.paso()).toBe('persona');

      component.elegirPersona('2');
      expect(component.personaElegida()?.nombre).toBe('Juan Silva');
      expect(component.paso()).toBe('datos');
    });

    it('vuelve a pedir la previa al cambiar de persona, aunque la fecha no cambie', async () => {
      await montarConPadron();
      component.elegirPersona('1');
      component.form.patchValue({ fecha_retiro: '2026-08-28' });
      await esperarDebounce();
      expect(retiros.previa).toHaveBeenLastCalledWith('1', '2026-08-28');

      component.elegirPersona('2');
      await esperarDebounce();
      expect(retiros.previa).toHaveBeenLastCalledWith('2', '2026-08-28');
      expect(retiros.previa).toHaveBeenCalledTimes(2);
    });

    it('mientras se recalcula no queda en pantalla la previa del anterior', async () => {
      await montarConPadron();
      component.elegirPersona('1');
      component.form.patchValue({ fecha_retiro: '2026-08-28' });
      await esperarDebounce();
      expect(component.previa()).not.toBeNull();

      // Pendiente a propósito: con un mock síncrono no se vería el intermedio.
      retiros.previa.mockReturnValue(NEVER);
      component.elegirPersona('2');

      expect(component.previa()).toBeNull();
      expect(component.previaCargando()).toBe(true);
      expect(component.puedeConfirmar()).toBe(false);
    });

    it('reelegir al mismo funcionario no vuelve a pedir la previa', async () => {
      await montarConPadron();
      component.elegirPersona('1');
      component.form.patchValue({ fecha_retiro: '2026-08-28' });
      await esperarDebounce();

      component.elegirPersona('1');
      await esperarDebounce();
      expect(retiros.previa).toHaveBeenCalledTimes(1);
    });

    it('con personaId dado no se ofrece cambiarla', async () => {
      await montar('1');
      expect(component.eligePersona).toBe(false);
    });
  });

  it('con personaId no carga el padrón: la persona ya está elegida', async () => {
    await montar('1');
    expect(TestBed.inject(PersonalService).findAll).not.toHaveBeenCalled();
  });
});

describe('mensajeCierres', () => {
  it('nombra solo lo que se cerró de verdad', () => {
    expect(mensajeCierres({ destino: '3', inscripciones: [], usuario: null })).toBe(
      'Retiro registrado: se cerró el destino.',
    );
  });

  it('usa el plural con más de una inscripción', () => {
    const msg = mensajeCierres({ destino: null, inscripciones: ['1', '2'], usuario: '4' });
    expect(msg).toContain('se dieron de baja 2 inscripciones');
    expect(msg).toContain('se bloqueó la cuenta de sistema');
    expect(msg).not.toContain('destino');
  });

  it('lo dice igual cuando no arrastró nada', () => {
    expect(mensajeCierres({ destino: null, inscripciones: [], usuario: null })).toBe(
      'Retiro registrado. No arrastró ningún cierre.',
    );
  });
});
