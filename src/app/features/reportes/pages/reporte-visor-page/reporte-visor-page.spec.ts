import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReporteVisorPage } from './reporte-visor-page';
import { ReportesService } from '../../../../core/services/reportes.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';

describe('ReporteVisorPage: filtros obligatorios', () => {
  function montar() {
    const api = { preview: vi.fn().mockReturnValue(of({ filas: [] })), exportarXlsx: vi.fn() };
    const toast = { error: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: ReportesService, useValue: api }, { provide: ToastService, useValue: toast },
      { provide: ErrorModalService, useValue: {} }, { provide: ActivatedRoute, useValue: {} },
      { provide: Router, useValue: {} },
    ] });
    const pagina = TestBed.runInInjectionContext(() => new ReporteVisorPage());
    pagina.definicion.set({ parametros: [{ clave: 'persona_id', etiqueta: 'Funcionario', tipo: 'select', requerido: true }] } as any);
    return { pagina, api, toast };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('no consulta ni exporta un legajo sin funcionario', () => {
    const { pagina, api, toast } = montar();
    pagina.generar(); pagina.exportar();
    expect(api.preview).not.toHaveBeenCalled();
    expect(api.exportarXlsx).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Funcionario'));
  });
  it('permite generar al seleccionar funcionario e invalida el resultado al cambiarlo', () => {
    const { pagina, api } = montar();
    pagina.valores.set({ persona_id: '1' }); pagina.generar();
    expect(api.preview).toHaveBeenCalled();
    expect(pagina.resultado()).not.toBeNull();
    pagina.setValor('persona_id', { target: { value: '2' } } as unknown as Event);
    expect(pagina.resultado()).toBeNull();
  });
});
