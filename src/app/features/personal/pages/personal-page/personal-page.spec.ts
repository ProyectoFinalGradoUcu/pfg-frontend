import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PersonalPage } from './personal-page';
import { PersonalService } from '../../../../core/services/personal.service';
import { AuthService } from '../../../../core/services/auth.service';

// Cubre la barra de filtros de la búsqueda avanzada: componentes compartidos, búsqueda y derecha/numor.
describe('PersonalPage · filtros', () => {
  let fixture: ComponentFixture<PersonalPage>;
  let component: PersonalPage;
  let personalService: {
    findPaginado: ReturnType<typeof vi.fn>;
    getUnidades: ReturnType<typeof vi.fn>;
    getSituaciones: ReturnType<typeof vi.fn>;
    getGrados: ReturnType<typeof vi.fn>;
    getEscalafones: ReturnType<typeof vi.fn>;
  };

  async function setup() {
    personalService = {
      findPaginado: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 10 })),
      getUnidades: vi.fn().mockReturnValue(of([])),
      getSituaciones: vi.fn().mockReturnValue(of([])),
      getGrados: vi.fn().mockReturnValue(of([{ id: 14, denominacion: 'Brig. Gral.', escalafon_id: 1, orden: 1 }])),
      getEscalafones: vi.fn().mockReturnValue(of([{ id: 1, denominacion: 'AV' }])),
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
  const abrir = () => { toggle().click(); fixture.detectChanges(); };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('botón para desplegar', () => {
    const dot = () => el().querySelector('.personal-page__toggle-dot');

    it('la segunda fila arranca cerrada', async () => {
      await setup();
      expect(filtro()).toBeNull();
      expect(el().querySelector('.personal-page__check')).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().getAttribute('data-tooltip')).toBe('Más filtros');
    });

    it('al presionarlo se despliega y al volver a presionarlo se oculta', async () => {
      await setup();
      abrir();
      expect(filtro()).not.toBeNull();
      expect(el().querySelector('.personal-page__check')).not.toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('data-tooltip')).toBe('Ocultar filtros');

      abrir();
      expect(filtro()).toBeNull();
    });

    it('cerrada, marca con un punto que hay un rango aplicado', async () => {
      await setup();
      expect(dot()).toBeNull();

      component.onFiltroDerecha({ ...component.filtroDerecha(), derechaDesde: 1, derechaHasta: 20 });
      fixture.detectChanges();
      expect(dot()).not.toBeNull();

      abrir();
      expect(dot()).toBeNull();
    });

    it('cerrada, el punto también avisa de estado y de retirados', async () => {
      await setup();
      component.onEstadosChange([1]);
      fixture.detectChanges();
      expect(dot()).not.toBeNull();

      component.onEstadosChange([]);
      component.setIncluirRetirados(true);
      fixture.detectChanges();
      expect(dot()).not.toBeNull();
    });
  });

  describe('filtro', () => {
    it('se muestra sin "Ordenar por", su propio "Limpiar", escala, grado ni escalafón', async () => {
      await setup();
      abrir();
      const debug = fixture.debugElement.query((d) => d.name === 'app-filtro-derecha-numor');
      expect(debug.properties['conOrden']).toBe(false);
      expect(debug.properties['conLimpiar']).toBe(false);
      expect(debug.properties['conEscala']).toBe(false);
      expect(debug.properties['conGradoEscalafon']).toBe(false);
    });

    it('grado y escalafón de la primera fila viajan en el filtro de derecha y no marcan el punto', async () => {
      await setup();
      component.onGradosChange([14, 15]);
      component.onEscalafonesChange([1]);
      fixture.detectChanges();

      expect(personalService.findPaginado).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, filtroDerecha: expect.objectContaining({ gradoId: [14, 15], escalafonId: [1] }) }),
      );
      expect(component.hayFiltrosActivos()).toBe(true);
      expect(el().querySelector('.personal-page__toggle-dot')).toBeNull();
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
      component.onFiltroDerecha({ ...component.filtroDerecha(), gradoId: [14] });
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

  describe('barra de filtros', () => {
    it('usa los componentes de filtro compartidos', async () => {
      await setup();
      expect(el().querySelector('app-search-input')).not.toBeNull();
      // Categoría, destino, grado y escalafón; estado aparece al desplegar la segunda fila.
      expect(el().querySelectorAll('app-select').length).toBe(4);
      abrir();
      expect(el().querySelectorAll('app-select').length).toBe(5);
      expect(el().querySelector('app-clear-filters-button')).not.toBeNull();
      expect(el().querySelector('select')).toBeNull();
    });

    it('la búsqueda espera 400 ms sin teclear antes de pedir', async () => {
      vi.useFakeTimers();
      try {
        await setup();
        personalService.findPaginado.mockClear();

        component.onSearch('pe');
        vi.advanceTimersByTime(200);
        component.onSearch('perez');
        vi.advanceTimersByTime(399);
        expect(personalService.findPaginado).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(personalService.findPaginado).toHaveBeenCalledTimes(1);
        expect(personalService.findPaginado).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1, search: 'perez' }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('destino, grado, escalafón y estado son multiselect con búsqueda; categoría no', async () => {
      await setup();
      abrir();
      const selects = fixture.debugElement.queryAll((d) => d.name === 'app-select');
      expect(selects.map((d) => !!d.properties['multiple'])).toEqual([false, true, true, true, true]);
      expect(selects.map((d) => !!d.properties['searchable'])).toEqual([false, true, true, true, true]);
    });

    it('vaciar grados no deja filtro activo', async () => {
      await setup();
      component.onGradosChange([14]);
      component.onGradosChange([]);
      expect(component.hayFiltrosActivos()).toBe(false);
    });

    it('sin estados elegidos no manda el filtro', async () => {
      await setup();
      component.onEstadosChange([2]);
      component.onEstadosChange([]);
      expect(personalService.findPaginado).toHaveBeenLastCalledWith(expect.objectContaining({ estado: undefined }));
    });

    it('los filtros se acumulan en la misma petición', async () => {
      await setup();
      component.onDestinosChange([4, 7]);
      component.onEstadosChange([2, 5]);
      component.onCategoriaChange('oficial');

      expect(personalService.findPaginado).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, destino: [4, 7], estado: [2, 5], categoria: 'oficial' }),
      );
    });

    it('"Borrar filtros" vacía todo y recarga desde la primera página', async () => {
      await setup();
      component.searchTerm.set('perez');
      component.onDestinosChange([4]);
      component.onEstadosChange([2]);
      component.onGradosChange([14]);
      component.onPageChange(3);

      component.limpiarFiltros();

      expect(component.hayFiltrosActivos()).toBe(false);
      expect(personalService.findPaginado).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, search: undefined, destino: undefined, estado: undefined, categoria: undefined }),
      );
      expect(component.filtroDerecha().gradoId).toBeUndefined();
    });

    it('después de borrar, volver a escribir el mismo término recarga', async () => {
      vi.useFakeTimers();
      try {
        await setup();
        component.onSearch('perez');
        vi.advanceTimersByTime(400);
        component.limpiarFiltros();
        personalService.findPaginado.mockClear();

        component.onSearch('perez');
        vi.advanceTimersByTime(400);
        expect(personalService.findPaginado).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'perez' }),
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('fila de la tabla', () => {
    const item = {
      id: '7', nombre: 'Ana Pereyra', cedula: '41234567', rango: 'Sargento', escalafon: null,
      derecha: null, numor: null, destino: 'E.M.G.F.A.', estado: 'Activo', relacion_estado: 'activo',
    };
    let router: { navigate: ReturnType<typeof vi.fn> };

    async function conUnaFila() {
      await setup();
      router = TestBed.inject(Router) as unknown as { navigate: ReturnType<typeof vi.fn> };
      component.items.set([item as any]);
      fixture.detectChanges();
    }

    const fila = () => el().querySelector<HTMLTableRowElement>('tbody tr.personal-page__row--clickable')!;

    it('un clic en la fila navega al detalle del funcionario', async () => {
      await conUnaFila();
      fila().querySelector('td')!.click();
      expect(router.navigate).toHaveBeenCalledWith(['/personal', '7']);
    });

    it('un clic en la columna de acciones no navega', async () => {
      await conUnaFila();
      fila().querySelector<HTMLElement>('.personal-page__col-actions')!.click();
      fila().querySelector<HTMLButtonElement>('.personal-page__dots-btn')!.click();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('"Editar" del menú sigue yendo a la edición, una sola vez', async () => {
      await conUnaFila();
      fila().querySelector<HTMLButtonElement>('.personal-page__dots-btn')!.click();
      fixture.detectChanges();
      const editar = [...el().querySelectorAll<HTMLButtonElement>('.personal-page__menu-item')]
        .find((b) => b.textContent?.includes('Editar'))!;
      editar.click();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/personal', '7']);
    });
  });
});
