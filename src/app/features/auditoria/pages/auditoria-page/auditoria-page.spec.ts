import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuditoriaPage } from './auditoria-page';
import { Paginator } from '../../../../shared/components/paginator/paginator';
import { Select } from '../../../../shared/components/select/select';
import { ClearFiltersButton } from '../../../../shared/components/clear-filters-button/clear-filters-button';
import { DateInput } from '../../../../shared/components/date-input/date-input';
import { AuditoriaService } from '../../../../core/services/auditoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { AuditoriaRegistro } from '../../../../core/models/auditoria.models';

const registro = (id: number): AuditoriaRegistro => ({
  id: String(id),
  fecha: '2026-11-03T12:00:00Z',
  accion: 'CREAR',
  contexto: 'Roles',
  entidad: 'Rol',
  entidadId: String(id),
  host: '10.0.0.1',
  detalle: null,
  usuario: { id: '1', username: 'admin@fau.mil.uy' },
});

const USUARIOS = [
  { id: '1', username: 'admin@fau.mil.uy' },
  { id: '2', username: 'bloqueado@fau.mil.uy' },
];

describe('AuditoriaPage: filtros', () => {
  let fixture: ComponentFixture<AuditoriaPage>;
  let component: AuditoriaPage;
  let auditoria: { listar: ReturnType<typeof vi.fn>; filtros: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn> };

  const responder = (cantidad: number, total = cantidad) =>
    auditoria.listar.mockReturnValue(
      of({ items: Array.from({ length: cantidad }, (_, i) => registro(i + 1)), total, page: 1, pageSize: 20 }),
    );
  const fallar = () => auditoria.listar.mockReturnValue(throwError(() => ({ status: 500, error: {} })));

  async function setup(cantidad = 2, total = cantidad) {
    auditoria = {
      listar: vi.fn(),
      filtros: vi.fn().mockReturnValue(of({ acciones: [], contextos: [], usuarios: USUARIOS })),
    };
    responder(cantidad, total);
    toast = { error: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [AuditoriaPage, Paginator, Select, ClearFiltersButton, DateInput],
      imports: [ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ToastService, useValue: toast },
        { provide: ErrorModalService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditoriaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const ultimoPedido = () => auditoria.listar.mock.calls.at(-1)![0];
  const vacio = () => el().querySelector('.aud__empty')?.textContent?.trim();
  const refrescar = () => fixture.detectChanges();
  const filtrar = (valores: Record<string, string>) => component.filtrosForm.patchValue(valores);

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('arranca vacío, con los usuarios disponibles y pidiendo todos los eventos', async () => {
    await setup();

    expect(component.filtrosForm.value.usuarioId).toBeNull();
    expect(component.usuarios()).toEqual(USUARIOS);
    expect(ultimoPedido().usuarioId).toBeUndefined();
    expect(el().querySelectorAll('.aud__filtros app-select').length).toBe(3);
    expect(el().querySelectorAll('.aud__filtros app-date-input').length).toBe(2);
    expect(el().querySelector('.aud__filtros select, .aud__filtros input[type="date"]')).toBeNull();
  });

  it('no hay botón Filtrar y limpiar es el botón estándar, deshabilitado sin filtros', async () => {
    await setup();

    expect(el().querySelector('button[type="submit"]')).toBeNull();
    expect(el().querySelector('.aud__filtros app-clear-filters-button button')?.hasAttribute('disabled')).toBe(true);
  });

  it('elegir un usuario pide sus eventos enseguida, desde la primera página', async () => {
    await setup(20, 45);
    component.onPageChange(3);

    filtrar({ usuarioId: '2' });

    expect(ultimoPedido()).toEqual(expect.objectContaining({ usuarioId: '2', page: 1, pageSize: 20 }));
  });

  it('acción y contexto también se aplican enseguida y se combinan', async () => {
    await setup();
    filtrar({ usuarioId: '2' });
    filtrar({ accion: 'CREAR' });
    filtrar({ contexto: 'Roles' });

    expect(ultimoPedido()).toEqual(expect.objectContaining({ usuarioId: '2', accion: 'CREAR', contexto: 'Roles' }));
    expect(auditoria.listar).toHaveBeenCalledTimes(4);
  });

  it('las fechas se aplican enseguida y se combinan con el usuario', async () => {
    await setup();
    filtrar({ usuarioId: '2' });
    filtrar({ desde: '2026-01-01' });
    filtrar({ hasta: '2026-01-31' });

    expect(ultimoPedido()).toEqual(
      expect.objectContaining({ usuarioId: '2', desde: '2026-01-01', hasta: '2026-01-31', page: 1 }),
    );
  });

  it('cada fecha limita a la otra', async () => {
    await setup();
    filtrar({ desde: '2026-01-10' });
    refrescar();

    const [desde, hasta] = fixture.debugElement
      .queryAll((d) => d.name === 'app-date-input')
      .map((d) => d.componentInstance as DateInput);
    hasta.alternar();
    hasta.elegir('2026-01-09');

    expect(component.filtrosForm.value.hasta).toBe('');
    expect(desde.valor()).toBe('2026-01-10');
  });

  it('paginar conserva los filtros', async () => {
    await setup(20, 45);
    filtrar({ usuarioId: '2' });

    component.onPageChange(2);

    expect(ultimoPedido()).toEqual(expect.objectContaining({ usuarioId: '2', page: 2 }));
  });

  it('limpiar vacía todo con una sola petición', async () => {
    await setup();
    filtrar({ usuarioId: '2' });
    filtrar({ desde: '2026-01-01' });
    auditoria.listar.mockClear();

    component.limpiarFiltros();
    refrescar();

    expect(auditoria.listar).toHaveBeenCalledTimes(1);
    expect(component.filtrosForm.value.usuarioId).toBeNull();
    expect(ultimoPedido().usuarioId).toBeUndefined();
    expect(ultimoPedido().desde).toBeUndefined();
    expect(component.hayFiltros()).toBe(false);
    expect(el().querySelector('.aud__filtros .appdate__placeholder')).not.toBeNull();
  });

  it('sin resultados mantiene los encabezados y muestra el mensaje de la historia', async () => {
    await setup();
    responder(0);
    filtrar({ usuarioId: '2' });
    refrescar();

    expect([...el().querySelectorAll('.aud__table thead th')].map((th) => th.textContent?.trim())).toEqual([
      'Fecha',
      'Usuario',
      'Acción',
      'Contexto',
      'Detalle',
    ]);
    expect(vacio()).toBe('No hay eventos que coincidan con los filtros.');
  });

  it('sin filtros y sin eventos no habla de filtros', async () => {
    await setup(0);
    expect(vacio()).toBe('No hay eventos registrados.');
  });

  it('si falla un filtro avisa y no deja filas que no lo cumplen', async () => {
    await setup();
    fallar();

    filtrar({ usuarioId: '2' });
    refrescar();

    expect(toast.error).toHaveBeenCalled();
    expect(component.registros()).toEqual([]);
    expect(el().querySelector('app-paginator nav')).toBeNull();
    expect(vacio()).toContain('No se pudieron cargar');
  });

  it('si falla un cambio de página conserva la página y las filas cargadas', async () => {
    await setup(20, 45);
    fallar();

    component.onPageChange(2);
    refrescar();

    expect(toast.error).toHaveBeenCalled();
    expect(component.page()).toBe(1);
    expect(component.registros().length).toBe(20);
    expect(el().querySelector('.paginator__btn--active')?.textContent?.trim()).toBe('1');
  });
});
