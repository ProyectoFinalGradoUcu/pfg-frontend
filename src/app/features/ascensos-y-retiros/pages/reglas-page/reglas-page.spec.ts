import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ReglasPage } from './reglas-page';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  EscaleraReglas,
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
        aplica_si: ['ES_MUTADO', 'NIVEL_LICEAL'],
        parametros: null,
        orden: 1,
        cursos: [{ id: '12', nombre_curso: 'Curso M-02', institucion: 'ETA' }],
      },
    ],
    ...overrides,
  };
}

function makeEscalon(overrides: Partial<EscalonRegla> = {}): EscalonRegla {
  return {
    grado_origen: makeGrado(),
    grado_destino: makeGrado({ id: '4', codigo: 'CBO_1RA', denominacion: 'Cbo. 1ª', orden: 3 }),
    funcionarios_en_grado: 12,
    regla: makeRegla(),
    ...overrides,
  };
}

function makeEscalera(escalones: EscalonRegla[] = [makeEscalon()]): EscaleraReglas {
  return {
    grupos: [{ clave: 'SUBALTERNOS', nombre: 'Subalternos (SG y ST)', escalones }],
    stats: { tramos_con_regla: 1, tramos_activos: 1, reglas_modificadas: 0 },
  };
}

describe('ReglasPage', () => {
  let component: ReglasPage;
  let fixture: ComponentFixture<ReglasPage>;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  let auth: { hasPermiso: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    svc = {
      getEscalera: vi.fn().mockReturnValue(of(makeEscalera())),
      getCursosDelCatalogo: vi.fn().mockReturnValue(of([])),
      crearRegla: vi.fn().mockReturnValue(of(makeRegla())),
      editarRegla: vi.fn().mockReturnValue(of(makeRegla())),
      desactivarRegla: vi.fn().mockReturnValue(of(makeRegla({ activo: false }))),
      activarRegla: vi.fn().mockReturnValue(of(makeRegla())),
    };
    auth = { hasPermiso: vi.fn().mockReturnValue(true) };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [ReglasPage],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: AscensosService, useValue: svc },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReglasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga la escalera al entrar, con las inactivas y las versiones', () => {
    expect(svc['getEscalera']).toHaveBeenCalledWith({
      incluirInactivas: true,
      incluirVersiones: true,
    });
    expect(component.escalera()?.grupos).toHaveLength(1);
    expect(component.loading()).toBe(false);
  });

  it('muestra el error del backend y deja reintentar', () => {
    svc['getEscalera'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Se cayó' } })),
    );

    component.cargar();

    expect(component.error()).toBe('Se cayó');
  });

  it('sigue funcionando si el catálogo de cursos no carga', () => {
    expect(component.cursos()).toEqual([]);
  });

  describe('presentación', () => {
    it('traduce los días mínimos a un texto legible', () => {
      expect(component.tiempoLegible(makeRegla())).toBe('2 años');
      expect(component.tiempoLegible(makeRegla({ anios: 0, meses: 6 }))).toBe('6 meses');
      expect(component.tiempoLegible(makeRegla({ anios: 1, meses: 6 }))).toBe('1 año y 6 meses');
    });

    it('dice cuándo no hay tope de edad, que es el caso de los oficiales', () => {
      expect(component.edadLegible(makeRegla())).toBe('menor de 47');
      expect(component.edadLegible(makeRegla({ edad_maxima: null }))).toBe('sin tope de edad');
    });

    it('arma la condición del requisito como la escribe el reglamento', () => {
      expect(component.condicionLegible(['ES_MUTADO', 'NIVEL_LICEAL'])).toBe(
        'solo si es mutado o tiene nivel liceal',
      );
    });

    it('no muestra condición cuando el requisito aplica siempre', () => {
      expect(component.condicionLegible(['SIEMPRE'])).toBeNull();
      expect(component.condicionLegible([])).toBeNull();
    });
  });

  describe('guardar', () => {
    it('un tramo con regla se edita: crea una versión nueva', () => {
      component.abrirEditor(makeEscalon());
      component.guardarRegla({ dias_minimos: 1095 });

      expect(svc['editarRegla']).toHaveBeenCalledWith('40', { dias_minimos: 1095 });
      expect(svc['crearRegla']).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
      expect(component.modal()).toBeNull();
    });

    it('un tramo sin regla se crea', () => {
      component.abrirEditor(makeEscalon({ regla: null }));
      component.guardarRegla({
        nombre: 'x',
        grado_origen_id: 3,
        grado_destino_id: 4,
        dias_minimos: 730,
      });

      expect(svc['crearRegla']).toHaveBeenCalled();
      expect(svc['editarRegla']).not.toHaveBeenCalled();
    });

    it('avisa si el backend rechaza el guardado y deja el modal abierto', () => {
      svc['editarRegla'].mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya está cerrada' } })),
      );

      component.abrirEditor(makeEscalon());
      component.guardarRegla({ dias_minimos: 1095 });

      expect(toast.error).toHaveBeenCalledWith('Ya está cerrada');
      expect(component.modal()).toBe('editor');
      expect(component.procesando()).toBe(false);
    });
  });

  describe('desactivar', () => {
    it('desactiva solo después de confirmar', () => {
      component.pedirDesactivar(makeRegla());
      expect(svc['desactivarRegla']).not.toHaveBeenCalled();

      component.confirmarDesactivar();
      expect(svc['desactivarRegla']).toHaveBeenCalledWith('40');
      expect(component.modal()).toBeNull();
    });

    it('sin permiso de gestión no se ofrecen las acciones', async () => {
      auth.hasPermiso.mockReturnValue(false);
      const otro = TestBed.createComponent(ReglasPage);
      otro.detectChanges();

      expect(otro.componentInstance.puedeGestionar()).toBe(false);
    });
  });
});
