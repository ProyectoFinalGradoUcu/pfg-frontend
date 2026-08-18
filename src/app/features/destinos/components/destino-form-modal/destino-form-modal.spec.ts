import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';

import { DestinoFormModal } from './destino-form-modal';
import { DestinosService } from '../../../../core/services/destinos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { Destino } from '../../../../core/models/destinos.models';
import { PersonaListItem } from '../../../../core/models/personal.models';
import { Select } from '../../../../shared/components/select/select';

function makeDestino(overrides: Partial<Destino> = {}): Destino {
  return {
    id: '200',
    persona: { id: '42', cedula: '50000001', primer_nombre: 'José', primer_apellido: 'Pérez' },
    unidad: { id: '5', codigo: 'EMGFA', denominacion: 'E.M.G.F.A.', tipo: 'Organismo' },
    fecha_inicio: '2024-04-30',
    fecha_fin: null,
    posicion_destino: 'Sub-Jefe',
    numero_orden: 'O.D. 11760',
    boletin: null,
    observaciones: null,
    activo: true,
    ...overrides,
  };
}

function makePersona(overrides: Partial<PersonaListItem> = {}): PersonaListItem {
  return { id: '42', nombre: 'José Pérez', cedula: '50000001', rango: 'Cnel.', destino: 'E.M.G.F.A.', estado: 'Activo', ...overrides };
}

function makeLista(items: Destino[] = []) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    stats: { total_destinos: items.length, destinos_activos: 0, unidades_con_personal: 0 },
  };
}

describe('DestinoFormModal (crear)', () => {
  let component: DestinoFormModal;
  let fixture: ComponentFixture<DestinoFormModal>;
  let destinosService: {
    crear: ReturnType<typeof vi.fn>;
    editar: ReturnType<typeof vi.fn>;
    listar: ReturnType<typeof vi.fn>;
    listarUnidadesParaSelector: ReturnType<typeof vi.fn>;
  };
  let personalService: { findPaginado: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    destinosService = {
      crear: vi.fn().mockReturnValue(of(makeDestino())),
      editar: vi.fn().mockReturnValue(of(makeDestino())),
      listar: vi.fn().mockReturnValue(of(makeLista())),
      listarUnidadesParaSelector: vi.fn().mockReturnValue(of([])),
    };
    personalService = {
      findPaginado: vi.fn().mockReturnValue(of({ items: [makePersona()], total: 1, page: 1, pageSize: 10 })),
    };

    await TestBed.configureTestingModule({
      declarations: [DestinoFormModal, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: DestinosService, useValue: destinosService },
        { provide: PersonalService, useValue: personalService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinoFormModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  describe('búsqueda de persona', () => {
    it('debounce la búsqueda contra /personas', () => {
      vi.useFakeTimers();
      component.onBuscarPersona('Pérez');
      expect(personalService.findPaginado).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400);
      expect(personalService.findPaginado).toHaveBeenCalledWith({ search: 'Pérez', pageSize: 10 });
      expect(component.resultados().length).toBe(1);
    });

    it('no busca con menos de 2 caracteres y limpia los resultados', () => {
      vi.useFakeTimers();
      component.onBuscarPersona('P');
      vi.advanceTimersByTime(400);
      expect(personalService.findPaginado).not.toHaveBeenCalled();
      expect(component.resultados()).toEqual([]);
    });
  });

  describe('editando', () => {
    it('refleja un destino asignado después de la primera lectura', () => {
      // Si `editando` fuera un `computed()` sin dependencias de señal, esta segunda
      // lectura devolvería el resultado congelado de la primera (false) en vez de true.
      expect(component.editando()).toBe(false);
      component.destino = makeDestino();
      expect(component.editando()).toBe(true);
    });
  });

  describe('preview del pase', () => {
    it('al elegir la persona busca su destino activo por cédula', () => {
      component.elegirPersona(makePersona());
      // pageSize: 50, no 1 — el `query` matchea cédula/nombre/apellido de forma parcial
      // (una cédula corta matchea otras que la contienen), así que hay que traer una
      // tanda y filtrar en el cliente por persona.id, no asumir que el primer resultado
      // es el de la persona elegida.
      expect(destinosService.listar).toHaveBeenCalledWith({ query: '50000001', activo: true, pageSize: 50 });
    });

    it('guarda el destino activo encontrado', () => {
      destinosService.listar.mockReturnValue(of(makeLista([makeDestino()])));
      component.elegirPersona(makePersona());
      expect(component.destinoActual()!.unidad!.denominacion).toBe('E.M.G.F.A.');
      expect(component.buscandoDestinoActual()).toBe(false);
    });

    it('deja destinoActual en null cuando la persona no tiene ninguno', () => {
      destinosService.listar.mockReturnValue(of(makeLista([])));
      component.elegirPersona(makePersona());
      expect(component.destinoActual()).toBeNull();
    });

    it('calcula la fecha de cierre como el día previo a fecha_inicio', () => {
      destinosService.listar.mockReturnValue(of(makeLista([makeDestino()])));
      component.elegirPersona(makePersona());
      component.form.patchValue({ fecha_inicio: '2026-09-01' });
      expect(component.fechaCierreCalculada()).toBe('2026-08-31');
    });

    it('resuelve bien el cruce de mes y de año', () => {
      destinosService.listar.mockReturnValue(of(makeLista([makeDestino()])));
      component.elegirPersona(makePersona());
      component.form.patchValue({ fecha_inicio: '2026-01-01' });
      expect(component.fechaCierreCalculada()).toBe('2025-12-31');
      component.form.patchValue({ fecha_inicio: '2026-03-01' });
      expect(component.fechaCierreCalculada()).toBe('2026-02-28');
    });

    it('no calcula nada si la persona no tiene destino activo', () => {
      destinosService.listar.mockReturnValue(of(makeLista([])));
      component.elegirPersona(makePersona());
      component.form.patchValue({ fecha_inicio: '2026-09-01' });
      expect(component.fechaCierreCalculada()).toBeNull();
    });

    it('si la búsqueda del destino activo falla, avisa que no se pudo verificar en vez de decir que no tiene', () => {
      destinosService.listar.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              error: {
                service_response: {
                  service_status: { http_status: '500', http_message: 'No se pudo consultar destinos' },
                  service_data: null,
                },
              },
            }),
        ),
      );
      component.elegirPersona(makePersona());
      expect(component.destinoActual()).toBeNull();
      expect(component.errorDestinoActual()).toBe('No se pudo consultar destinos');
    });

    it('ignora una fila cuya persona no coincide y encuentra la propia aunque no sea la primera', () => {
      const deOtraPersona = makeDestino({
        id: '999',
        persona: { id: '77', cedula: '50000012', primer_nombre: 'Otra', primer_apellido: 'Persona' },
      });
      const propio = makeDestino({ id: '200' }); // persona.id '42', igual al de makePersona()
      destinosService.listar.mockReturnValue(of(makeLista([deOtraPersona, propio])));
      component.elegirPersona(makePersona());
      expect(component.destinoActual()!.id).toBe('200');
      expect(component.errorDestinoActual()).toBeNull();
    });

    it('descarta una respuesta tardía de una persona que ya no es la elegida', () => {
      const subjectA = new Subject<ReturnType<typeof makeLista>>();
      const subjectB = new Subject<ReturnType<typeof makeLista>>();
      let llamada = 0;
      destinosService.listar.mockImplementation(() => {
        llamada += 1;
        return llamada === 1 ? subjectA.asObservable() : subjectB.asObservable();
      });

      const personaA = makePersona({ id: '42', cedula: '50000001' });
      const personaB = makePersona({ id: '99', cedula: '50000099', nombre: 'Otra Persona' });
      const destinoDeB = makeDestino({
        id: '300',
        persona: { id: '99', cedula: '50000099', primer_nombre: 'Otra', primer_apellido: 'Persona' },
      });

      component.elegirPersona(personaA); // dispara la 1ra búsqueda (subjectA), en curso
      component.elegirPersona(personaB); // cambia de persona antes de que la 1ra responda

      // La 2da búsqueda (la vigente) responde primero.
      subjectB.next(makeLista([destinoDeB]));
      subjectB.complete();
      expect(component.destinoActual()!.id).toBe('300');

      // La 1ra búsqueda (para A, ya no elegida) responde tarde: se descarta.
      subjectA.next(makeLista([makeDestino()])); // destino de A (persona.id '42')
      subjectA.complete();
      expect(component.destinoActual()!.id).toBe('300');
    });
  });

  describe('validación', () => {
    beforeEach(() => {
      component.elegirPersona(makePersona());
      component.form.patchValue({ unidad_id: '7', fecha_inicio: '2026-09-01' });
    });

    it('exige número de orden o boletín', () => {
      component.guardar();
      expect(destinosService.crear).not.toHaveBeenCalled();
      expect(component.error()).toBe('Ingresá al menos el N° de orden o el boletín.');
    });

    it('exige persona, unidad y fecha de inicio', () => {
      component.form.patchValue({ unidad_id: '', numero_orden: 'O.D. 1' });
      component.guardar();
      expect(destinosService.crear).not.toHaveBeenCalled();
      expect(component.error()).toBe('Completá los campos requeridos.');
    });
  });

  describe('guardar', () => {
    beforeEach(() => {
      destinosService.listar.mockReturnValue(of(makeLista([makeDestino()])));
      component.elegirPersona(makePersona());
      component.form.patchValue({
        unidad_id: '7',
        fecha_inicio: '2026-09-01',
        numero_orden: 'O.D. 12455',
        posicion_destino: 'Jefe de Sección',
      });
    });

    it('manda los ids como número y omite los campos vacíos', () => {
      component.guardar();
      expect(destinosService.crear).toHaveBeenCalledWith({
        persona_id: 42,
        unidad_id: 7,
        fecha_inicio: '2026-09-01',
        numero_orden: 'O.D. 12455',
        posicion_destino: 'Jefe de Sección',
      });
    });

    it('no manda fecha_fin_anterior si no se tocó la fecha de cierre', () => {
      component.guardar();
      expect(destinosService.crear.mock.calls[0][0].fecha_fin_anterior).toBeUndefined();
    });

    it('manda fecha_fin_anterior cuando el operador la corrige', () => {
      component.form.patchValue({ fecha_fin_anterior: '2026-08-15' });
      component.guardar();
      expect(destinosService.crear.mock.calls[0][0].fecha_fin_anterior).toBe('2026-08-15');
    });

    it('emite guardado con el destino que devuelve el backend', () => {
      const emitido: Destino[] = [];
      component.guardado.subscribe((d) => emitido.push(d));
      component.guardar();
      expect(emitido.length).toBe(1);
      expect(emitido[0].id).toBe('200');
    });

    it('muestra el mensaje del backend ante un 409 y no emite', () => {
      destinosService.crear.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                service_response: {
                  service_status: { http_status: '409', http_message: 'El funcionario 42 ya tiene un destino activo en esa unidad' },
                  service_data: null,
                },
              },
            }),
        ),
      );
      const emitido: Destino[] = [];
      component.guardado.subscribe((d) => emitido.push(d));
      component.guardar();
      expect(component.error()).toBe('El funcionario 42 ya tiene un destino activo en esa unidad');
      expect(component.guardando()).toBe(false);
      expect(emitido.length).toBe(0);
    });
  });
});

describe('DestinoFormModal (editar)', () => {
  let component: DestinoFormModal;
  let fixture: ComponentFixture<DestinoFormModal>;
  let destinosService: {
    crear: ReturnType<typeof vi.fn>;
    editar: ReturnType<typeof vi.fn>;
    listar: ReturnType<typeof vi.fn>;
    listarUnidadesParaSelector: ReturnType<typeof vi.fn>;
  };
  let personalService: { findPaginado: ReturnType<typeof vi.fn> };

  /**
   * A diferencia del describe "(crear)", acá `destino` se asigna ANTES del primer
   * `detectChanges()` (el que dispara `ngOnInit`). Si se asignara después, `precargarEdicion`
   * ya habría corrido con `destino = null` y el formulario quedaría vacío — el bug que
   * dejaba sin cubrir todo el modo edición.
   */
  function crearFixtureEditando(destino: Destino): void {
    destinosService = {
      crear: vi.fn().mockReturnValue(of(makeDestino())),
      editar: vi.fn().mockReturnValue(of(makeDestino())),
      listar: vi.fn().mockReturnValue(of(makeLista())),
      listarUnidadesParaSelector: vi.fn().mockReturnValue(of([])),
    };
    personalService = {
      findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
    };

    TestBed.configureTestingModule({
      declarations: [DestinoFormModal, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: DestinosService, useValue: destinosService },
        { provide: PersonalService, useValue: personalService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(DestinoFormModal);
    component = fixture.componentInstance;
    component.destino = destino;
    fixture.detectChanges();
  }

  it('precarga el formulario con los datos del destino', () => {
    const destino = makeDestino({
      fecha_fin: '2025-01-15',
      boletin: 'B. 45',
      observaciones: 'Nota de prueba',
    });
    crearFixtureEditando(destino);

    expect(component.form.get('unidad_id')!.value).toBe('5');
    expect(component.form.get('fecha_inicio')!.value).toBe('2024-04-30');
    expect(component.form.get('fecha_fin')!.value).toBe('2025-01-15');
    expect(component.form.get('posicion_destino')!.value).toBe('Sub-Jefe');
    expect(component.form.get('numero_orden')!.value).toBe('O.D. 11760');
    expect(component.form.get('boletin')!.value).toBe('B. 45');
    expect(component.form.get('observaciones')!.value).toBe('Nota de prueba');
  });

  it('manda al servicio solo la clave que cambió', () => {
    crearFixtureEditando(makeDestino());
    component.form.patchValue({ posicion_destino: 'Jefe de Sección' });
    component.guardar();
    // Igualdad exacta de objeto: es lo que protege contra el rechazo por `forbidNonWhitelisted`
    // del backend si algún día se manda una clave de más.
    expect(destinosService.editar).toHaveBeenCalledWith('200', { posicion_destino: 'Jefe de Sección' });
  });

  it('si no se cambió nada, cierra sin guardar en vez de llamar al backend', () => {
    crearFixtureEditando(makeDestino());
    const cerrados: void[] = [];
    component.cerrado.subscribe(() => cerrados.push(undefined));
    component.guardar();
    expect(destinosService.editar).not.toHaveBeenCalled();
    expect(cerrados.length).toBe(1);
  });

  it('exige conservar al menos el número de orden o el boletín', () => {
    crearFixtureEditando(makeDestino());
    component.form.patchValue({ numero_orden: '', boletin: '' });
    component.guardar();
    expect(destinosService.editar).not.toHaveBeenCalled();
    expect(component.error()).toBe('El destino debe conservar al menos el N° de orden o el boletín.');
  });
});
