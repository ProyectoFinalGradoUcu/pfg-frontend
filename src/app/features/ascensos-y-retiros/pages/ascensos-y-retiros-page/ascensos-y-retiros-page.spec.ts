import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterModule, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AscensosYRetirosPage } from './ascensos-y-retiros-page';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ResumenAscensos } from '../../../../core/models/ascensos.models';

function makeResumen(overrides: Partial<ResumenAscensos> = {}): ResumenAscensos {
  return {
    fecha_referencia: '2026-09-06',
    total_evaluados: 28,
    por_estado: {
      PASIBLE: 4,
      PROXIMO: 2,
      BLOQUEADO: 19,
      FUERA_DE_EDAD: 2,
      SIN_REGLA: 1,
      TOPE_DE_ESCALA: 0,
    },
    por_escalafon: [{ escalafon: 'Aerotécnicos', total: 12, pasibles: 2 }],
    por_unidad: [{ unidad: 'Base Aérea Nº 1', total: 12, pasibles: 2 }],
    cursos_que_bloquean: [{ curso: 'Prueba de Suficiencia', funcionarios: 5 }],
    sin_fecha_nacimiento: 0,
    ...overrides,
  };
}

describe('AscensosYRetirosPage (panorama)', () => {
  let component: AscensosYRetirosPage;
  let fixture: ComponentFixture<AscensosYRetirosPage>;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  let auth: { hasPermiso: ReturnType<typeof vi.fn>; hasAnyPermiso: ReturnType<typeof vi.fn> };

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [AscensosYRetirosPage],
      imports: [RouterModule],
      providers: [
        provideRouter([]),
        { provide: AscensosService, useValue: svc },
        { provide: AuthService, useValue: auth },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AscensosYRetirosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    svc = {
      getResumen: vi.fn().mockReturnValue(of(makeResumen())),
      getEstadisticas: vi.fn().mockReturnValue(
        of({
          totales: { ascensos: 8, anulados: 1 },
          piramide: [
            { grado: 'Cbo. 2ª', codigo: 'CBO_2DA', orden: 2, dotacion: 12 },
            { grado: 'Cbo. 1ª', codigo: 'CBO_1RA', orden: 3, dotacion: 3 },
          ],
        }),
      ),
      listarOrdenes: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 5 })),
    };
    auth = {
      hasPermiso: vi.fn().mockReturnValue(true),
      hasAnyPermiso: vi.fn().mockReturnValue(true),
    };
  });

  afterEach(() => TestBed.resetTestingModule());

  it('carga resumen, estadísticas del año y últimas órdenes', async () => {
    await montar();

    expect(svc['getResumen']).toHaveBeenCalled();
    expect(svc['getEstadisticas']).toHaveBeenCalledWith({
      anio_desde: new Date().getFullYear(),
      anio_hasta: new Date().getFullYear(),
    });
    expect(svc['listarOrdenes']).toHaveBeenCalledWith({ pageSize: 5 });
    expect(component.resumen()?.por_estado.PASIBLE).toBe(4);
  });

  it('sin permiso de ascensos no consulta nada', async () => {
    auth.hasAnyPermiso.mockReturnValue(false);
    await montar();

    expect(svc['getResumen']).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('si falla el resumen muestra el error', async () => {
    svc['getResumen'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Se cayó' } })),
    );
    await montar();

    expect(component.error()).toBe('Se cayó');
  });

  it('si fallan los bloques complementarios el panorama igual se muestra', async () => {
    svc['getEstadisticas'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    svc['listarOrdenes'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await montar();

    expect(component.error()).toBeNull();
    expect(component.resumen()).not.toBeNull();
    expect(component.estadisticas()).toBeNull();
    expect(component.ultimasOrdenes()).toEqual([]);
  });

  it('dibuja la pirámide en proporción al grado más numeroso', async () => {
    await montar();

    expect(component.anchoBarra(12)).toBe('100%');
    expect(component.anchoBarra(3)).toBe('25%');
  });
});
