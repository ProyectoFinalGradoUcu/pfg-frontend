import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { UnidadesPage } from './unidades-page';
import { UnidadesService } from '../../../../core/services/unidades.service';
import { RolesService } from '../../../../core/services/roles.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { UnidadDetalle, UnidadListItem } from '../../../../core/models/unidades.models';

const CAO = { id: '3', codigo: 'CAO', denominacion: 'C.A.O.' };
const CAP = { id: '4', codigo: 'CAP', denominacion: 'C.A.P.' };

function makeBase(id: string, denominacion: string, comando = CAO, overrides: Partial<UnidadListItem> = {}): UnidadListItem {
  return {
    id,
    codigo: denominacion.replace(/\./g, ''),
    denominacion,
    vigente: true,
    comando,
    cantidadRoles: 1,
    cantidadUsuarios: 2,
    cantidadFuncionarios: 30,
    ...overrides,
  };
}

const BASES = [
  makeBase('12', 'B.A.I.'),
  makeBase('13', 'B.A.II'),
  makeBase('20', 'E.T.A.', CAP),
  makeBase('21', 'E.M.A.', CAP),
];

const detalle: UnidadDetalle = {
  id: '12',
  codigo: 'BAI',
  denominacion: 'B.A.I.',
  vigente: true,
  comando: CAO,
  roles: [],
  cantidadUsuarios: 2,
  cantidadFuncionarios: 30,
};

describe('UnidadesPage', () => {
  let fixture: ComponentFixture<UnidadesPage>;
  let component: UnidadesPage;
  let unidades: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findUsuarios: ReturnType<typeof vi.fn>;
  };
  let catalogos: { getComandos: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    unidades = {
      findAll: vi.fn().mockReturnValue(of({ items: BASES, total: BASES.length, page: 1, pageSize: 20 })),
      findOne: vi.fn().mockReturnValue(of(detalle)),
      findUsuarios: vi.fn().mockReturnValue(of({ items: [], total: 0 })),
    };
    catalogos = { getComandos: vi.fn().mockReturnValue(of([CAO, CAP])) };

    await TestBed.configureTestingModule({
      declarations: [UnidadesPage],
      imports: [ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: UnidadesService, useValue: unidades },
        { provide: RolesService, useValue: { findAll: vi.fn().mockReturnValue(of([])) } },
        { provide: UsuariosService, useValue: { findAll: vi.fn() } },
        { provide: CatalogosService, useValue: catalogos },
        {
          provide: AuthService,
          useValue: { hasPermiso: () => true, hasAllPermisos: () => true, currentUser: () => ({ id: '1', unidades: [] }) },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ErrorModalService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const textos = (selector: string) =>
    Array.from(el().querySelectorAll(selector)).map((n) => n.textContent?.trim());

  describe('listado', () => {
    it('pide la primera página de 20 sin filtro de comando', () => {
      expect(unidades.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: undefined, unidad_id: undefined });
      expect(component.unidades().length).toBe(4);
    });

    it('carga los comandos para el filtro', () => {
      expect(catalogos.getComandos).toHaveBeenCalled();
      expect(textos('.un__select option')).toEqual(['Todos los comandos', 'C.A.O.', 'C.A.P.']);
    });

    it('si fallan los comandos el filtro queda solo con "Todos"', () => {
      catalogos.getComandos.mockReturnValue(throwError(() => new Error('500')));
      fixture = TestBed.createComponent(UnidadesPage);
      fixture.detectChanges();
      expect(textos('.un__select option')).toEqual(['Todos los comandos']);
    });

    it('agrupa las bases bajo su comando con una sola cabecera por comando', () => {
      expect(textos('.un__table tr.un__grupo')).toEqual(['C.A.O.', 'C.A.P.']);
      // 2 cabeceras + 4 bases.
      expect(el().querySelectorAll('.un__table tbody tr').length).toBe(6);
    });

    it('la cabecera de cada comando va antes de su primera base', () => {
      const filas = Array.from(el().querySelectorAll('.un__table tbody tr')).map((tr) =>
        tr.classList.contains('un__grupo') ? `# ${tr.textContent?.trim()}` : tr.querySelector('strong')?.textContent,
      );
      expect(filas).toEqual(['# C.A.O.', 'B.A.I.', 'B.A.II', '# C.A.P.', 'E.T.A.', 'E.M.A.']);
    });

    it('filas() marca solo la primera base de cada comando', () => {
      expect(component.filas().map((f) => f.empiezaComando)).toEqual([true, false, true, false]);
    });

    it('sin resultados habla de bases', () => {
      unidades.findAll.mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 20 }));
      component.cargar();
      fixture.detectChanges();
      expect(el().querySelector('.un__empty')?.textContent).toContain('No hay bases');
    });
  });

  describe('filtro por comando', () => {
    it('al elegir un comando recarga desde la primera página con unidad_id', () => {
      component.cargar(2);
      unidades.findAll.mockClear();

      component.comandoFiltro.setValue('4');

      expect(unidades.findAll).toHaveBeenCalledTimes(1);
      expect(unidades.findAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1, unidad_id: '4' }));
      expect(component.pagina()).toBe(1);
    });

    it('volver a "Todos los comandos" deja de mandar unidad_id', () => {
      component.comandoFiltro.setValue('4');
      component.comandoFiltro.setValue('');

      expect(unidades.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ unidad_id: undefined }));
    });

    it('elegirlo desde el select dispara la recarga', () => {
      const select = el().querySelector<HTMLSelectElement>('.un__select')!;
      select.value = select.options[2].value;
      select.dispatchEvent(new Event('change'));

      expect(unidades.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ unidad_id: '4' }));
    });

    it('paginar conserva el comando elegido', () => {
      component.comandoFiltro.setValue('3');
      component.cargar(2);

      expect(unidades.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, unidad_id: '3' }));
    });

    it('la búsqueda también respeta el comando elegido', () => {
      vi.useFakeTimers();
      try {
        component.comandoFiltro.setValue('3');
        component.busqueda.setValue('B.A.');
        vi.advanceTimersByTime(300);

        expect(unidades.findAll).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1, search: 'B.A.', unidad_id: '3' }),
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('gestionar', () => {
    it('abre el detalle de la base y muestra su comando', () => {
      const boton = Array.from(el().querySelectorAll<HTMLButtonElement>('.un__table button')).find((b) =>
        b.textContent?.includes('Gestionar'),
      )!;
      boton.click();
      fixture.detectChanges();

      expect(unidades.findOne).toHaveBeenCalledWith('12');
      expect(component.modal()).toBe('gestionar');
      const titulo = el().querySelector('.modal__header h3')?.textContent?.replace(/\s+/g, ' ').trim();
      expect(titulo).toBe('B.A.I. (C.A.O.)');
    });

    it('sin roles asignados avisa que la base no tiene roles', () => {
      component.abrirGestionar(BASES[0]);
      fixture.detectChanges();

      expect(el().querySelector('.modal .un__empty')?.textContent).toContain('Esta base no tiene roles asignados');
    });
  });
});
