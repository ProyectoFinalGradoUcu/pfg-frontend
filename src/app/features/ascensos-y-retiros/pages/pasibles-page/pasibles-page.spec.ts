import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PasiblesPage } from './pasibles-page';
import { Select } from '../../../../shared/components/select/select';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { Elegibilidad, PasiblesPaginados } from '../../../../core/models/ascensos.models';

function makeElegibilidad(overrides: Partial<Elegibilidad> = {}): Elegibilidad {
  return {
    persona: {
      id: '100',
      cedula: '12345678',
      nombre_completo: 'José Pérez',
      apellido: 'Pérez',
      unidad: { id: '5', denominacion: 'Base Aérea Nº 1' },
      escalafon: { id: '14', denominacion: 'Aerotécnicos' },
      situacion: { id: '7', codigo: 'SIT07', denominacion: 'Actividad' },
    },
    grado_actual: { id: '3', codigo: 'CBO_2DA', denominacion: 'Cbo. 2ª', orden: 2 },
    grado_destino: { id: '4', codigo: 'CBO_1RA', denominacion: 'Cbo. 1ª', orden: 3 },
    regla: { id: '40', nombre: 'Cbo. 2.ª → Cbo. 1.ª' },
    estado: 'PASIBLE',
    fecha_cumpliria: null,
    motivo: null,
    antiguedad_dias: 900,
    edad: 36,
    requisitos: [
      {
        tipo: 'ANTIGUEDAD',
        descripcion: 'Antigüedad en el grado',
        aplica: true,
        cumple: true,
        detalle: '2 años 5 meses de 2 años',
      },
    ],
    ...overrides,
  };
}

function makePagina(items: Elegibilidad[] = [makeElegibilidad()]): PasiblesPaginados {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    fecha_referencia: '2026-09-06',
    horizonte_meses: 6,
    stats: {
      PASIBLE: 1,
      PROXIMO: 2,
      BLOQUEADO: 3,
      FUERA_DE_EDAD: 0,
      SIN_REGLA: 0,
      TOPE_DE_ESCALA: 0,
    },
  };
}

describe('PasiblesPage', () => {
  let component: PasiblesPage;
  let fixture: ComponentFixture<PasiblesPage>;
  let svc: { listarPasibles: ReturnType<typeof vi.fn> };
  let personal: {
    getEscalafones: ReturnType<typeof vi.fn>;
    getUnidades: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    svc = { listarPasibles: vi.fn().mockReturnValue(of(makePagina())) };
    personal = {
      getEscalafones: vi.fn().mockReturnValue(of([])),
      getUnidades: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      declarations: [PasiblesPage, Select],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: AscensosService, useValue: svc },
        { provide: PersonalService, useValue: personal },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PasiblesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('arranca mostrando pasibles y próximos, que es lo accionable', () => {
    expect(svc.listarPasibles).toHaveBeenCalledWith(
      expect.objectContaining({ estado: ['PASIBLE', 'PROXIMO'], horizonte_meses: 6 }),
    );
    expect(component.items()).toHaveLength(1);
    expect(component.stats()?.BLOQUEADO).toBe(3);
  });

  it('muestra el error del backend y deja reintentar', () => {
    svc.listarPasibles.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Se cayó' } })),
    );

    component.cargar();

    expect(component.error()).toBe('Se cayó');
    expect(component.loading()).toBe(false);
  });

  describe('filtros', () => {
    it('cambiar los estados vuelve a consultar desde la página 1', () => {
      component.irAPagina(1);
      component.onEstados(['PASIBLE', 'PROXIMO', 'BLOQUEADO']);

      expect(component.filtroEstados()).toEqual(['PASIBLE', 'PROXIMO', 'BLOQUEADO']);
      expect(component.page()).toBe(1);
      expect(svc.listarPasibles).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: ['PASIBLE', 'PROXIMO', 'BLOQUEADO'], page: 1 }),
      );
    });

    it('sin estados elegidos pide los seis («Todos los estados»)', () => {
      component.onEstados([]);

      expect(svc.listarPasibles).toHaveBeenLastCalledWith(
        expect.objectContaining({ estado: component.estadosDisponibles.map((e) => e.value) }),
      );
    });

    it('pagina de a 10', () => {
      expect(svc.listarPasibles).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 10 }));
    });

    it('la fila de más filtros arranca plegada', () => {
      expect(component.masFiltrosAbiertos()).toBe(false);
      component.alternarMasFiltros();
      expect(component.masFiltrosAbiertos()).toBe(true);
    });

    it('«quitar filtros» solo se habilita cuando algo difiere de los valores iniciales', () => {
      expect(component.hayFiltrosActivos()).toBe(false);

      component.onHorizonte('12');
      expect(component.hayFiltrosAvanzados()).toBe(true);
      expect(component.hayFiltrosActivos()).toBe(true);

      component.limpiarFiltros();
      expect(component.hayFiltrosActivos()).toBe(false);
    });

    it('la fecha de «próximos» se cuenta desde la fecha evaluada', () => {
      component.onFecha('2027-02-01');
      component.onHorizonte('2');
      expect(component.fechaHorizonte()).toBe('1 de abril de 2027');
    });

    it('el atajo al 1.º de febrero apunta al próximo febrero', () => {
      vi.setSystemTime(new Date('2026-09-06'));
      component.alPrimeroDeFebrero();
      expect(component.fechaReferencia()).toBe('2027-02-01');

      vi.setSystemTime(new Date('2026-01-15'));
      component.alPrimeroDeFebrero();
      expect(component.fechaReferencia()).toBe('2026-02-01');

      vi.useRealTimers();
    });

    it('el atajo de febrero se prende y se apaga', () => {
      component.alternarPrimeroDeFebrero();
      expect(component.esPrimeroDeFebrero()).toBe(true);

      component.alternarPrimeroDeFebrero();
      expect(component.fechaReferencia()).toBe('');
    });

    it('limpiar vuelve a los valores iniciales', () => {
      component.onEstados([]);
      component.onBusqueda('pérez');
      component.onUnidad('5');
      component.onFecha('2027-02-01');

      component.limpiarFiltros();

      expect(component.filtroEstados()).toEqual(['PASIBLE', 'PROXIMO']);
      expect(component.filtroUnidad()).toBeNull();
      expect(component.textoBusqueda()).toBe('');
      expect(component.fechaReferencia()).toBe('');
      expect(component.horizonteMeses()).toBe(6);
    });

    it('ignora un horizonte inválido en vez de romper la consulta', () => {
      component.onHorizonte('cero');
      expect(component.horizonteMeses()).toBe(6);
    });
  });

  describe('presentación', () => {
    it('los símbolos distinguen cumple, no cumple y no aplica', () => {
      expect(component.simboloRequisito({ aplica: true, cumple: true })).toBe('✓');
      expect(component.simboloRequisito({ aplica: true, cumple: false })).toBe('✗');
      expect(component.simboloRequisito({ aplica: false, cumple: true })).toBe('○');
    });

    it('la antigüedad se lee en años y meses', () => {
      expect(component.antiguedadLegible(900)).toBe('2 años 5 meses');
      expect(component.antiguedadLegible(20)).toBe('20 días');
    });

    it('traduce el estado a la etiqueta de pantalla', () => {
      expect(component.etiquetaEstado('FUERA_DE_EDAD')).toBe('Fuera de edad');
    });
  });

  describe('selección', () => {
    it('lleva al registro de la orden con los seleccionados', () => {
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.alternarMarca('100');
      component.alternarMarca('200');
      component.registrarOrdenConSeleccionados();

      expect(navigate).toHaveBeenCalledWith(['/ascensos-y-retiros/ordenes/nueva'], {
        queryParams: { personas: '100,200' },
      });
    });
  });

  describe('detalle', () => {
    it('abrir y cerrar el panel de un funcionario', () => {
      const item = makeElegibilidad();
      component.abrirDetalle(item);
      expect(component.seleccionado()).toBe(item);

      component.cerrarDetalle();
      expect(component.seleccionado()).toBeNull();
    });
  });

});
