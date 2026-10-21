import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PersonalPage } from './personal-page';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';

// Solo cubre los filtros de derecha y numor de la búsqueda avanzada.
describe('PersonalPage · filtros de derecha y numor', () => {
  let fixture: ComponentFixture<PersonalPage>;
  let component: PersonalPage;
  let personalService: {
    findPaginado: ReturnType<typeof vi.fn>;
    getUnidades: ReturnType<typeof vi.fn>;
    getSituaciones: ReturnType<typeof vi.fn>;
  };

  async function setup() {
    personalService = {
      findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      getUnidades: vi.fn().mockReturnValue(of([])),
      getSituaciones: vi.fn().mockReturnValue(of([])),
    };
    const authService = { alcanceDe: vi.fn().mockReturnValue('global'), currentUser: signal(null) };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [PersonalPage],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: PersonalService, useValue: personalService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const toggle = () => el().querySelector<HTMLButtonElement>('.personal-page__toggle-btn')!;
  const filtro = () => el().querySelector('app-filtro-derecha-numor');

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('botón para desplegar', () => {
    it('la fila de filtros arranca cerrada', async () => {
      await setup();
      expect(filtro()).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().getAttribute('data-tooltip')).toBe('Más filtros');
    });

    it('al presionarlo se despliega y al volver a presionarlo se oculta', async () => {
      await setup();
      toggle().click();
      fixture.detectChanges();
      expect(filtro()).not.toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('data-tooltip')).toBe('Ocultar filtros');

      toggle().click();
      fixture.detectChanges();
      expect(filtro()).toBeNull();
    });

    it('cerrada, marca con un punto que hay filtros de derecha o numor aplicados', async () => {
      await setup();
      expect(el().querySelector('.personal-page__toggle-dot')).toBeNull();

      component.onFiltroDerecha({ ...component.filtroDerecha(), derechaDesde: 1, derechaHasta: 20 });
      fixture.detectChanges();
      expect(el().querySelector('.personal-page__toggle-dot')).not.toBeNull();

      toggle().click();
      fixture.detectChanges();
      expect(el().querySelector('.personal-page__toggle-dot')).toBeNull();
    });
  });

  describe('filtro', () => {
    it('se muestra sin "Ordenar por" ni su propio "Limpiar"', async () => {
      await setup();
      toggle().click();
      fixture.detectChanges();
      const debug = fixture.debugElement.query((d) => d.name === 'app-filtro-derecha-numor');
      expect(debug.properties['conOrden']).toBe(false);
      expect(debug.properties['conLimpiar']).toBe(false);
    });

    it('aplicar un rango vuelve a la primera página y lo manda en la búsqueda', async () => {
      await setup();
      component.currentPage.set(3);
      component.onFiltroDerecha({ ...component.filtroDerecha(), numorDesde: 2, numorHasta: 5 });

      expect(component.currentPage()).toBe(1);
      expect(personalService.findPaginado).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filtroDerecha: expect.objectContaining({ numorDesde: 2, numorHasta: 5 }),
        }),
      );
    });
  });

  describe('"Borrar filtros"', () => {
    it('se habilita con un filtro de derecha o numor', async () => {
      await setup();
      expect(component.hayFiltrosActivos()).toBe(false);
      component.onFiltroDerecha({ ...component.filtroDerecha(), gradoId: 14 });
      expect(component.hayFiltrosActivos()).toBe(true);
    });

    it('borra los filtros de derecha y numor pero conserva el orden de la tabla', async () => {
      await setup();
      component.ordenarPor('numor');
      component.ordenarPor('numor');
      component.onFiltroDerecha({ ...component.filtroDerecha(), derechaDesde: 1, escala: 'OFICIALES' });

      component.limpiarFiltros();

      expect(component.filtroDerecha()).toEqual({ ordenarPor: 'numor', direccion: 'DESC' });
      expect(component.hayFiltrosActivos()).toBe(false);
    });
  });
});
