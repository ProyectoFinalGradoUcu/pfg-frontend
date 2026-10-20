import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { FiltroDerechaNumorComponent } from './filtro-derecha-numor';
import { SelectorRango } from '../selector-rango/selector-rango';
import { PersonalService } from '../../../core/services/personal.service';
import { FiltroDerechaNumor } from '../../../core/models/derecha.models';

describe('FiltroDerechaNumorComponent', () => {
  let fixture: ComponentFixture<FiltroDerechaNumorComponent>;
  let component: FiltroDerechaNumorComponent;
  let emitidos: FiltroDerechaNumor[];

  async function montar(opciones: { conOrden?: boolean; conLimpiar?: boolean; valor?: FiltroDerechaNumor } = {}) {
    const personalService = {
      getGrados: vi.fn().mockReturnValue(of([{ id: 14, denominacion: 'Brig. Gral.' }])),
      getEscalafones: vi.fn().mockReturnValue(of([{ id: 1, denominacion: 'AV' }])),
    };
    await TestBed.configureTestingModule({
      declarations: [FiltroDerechaNumorComponent, SelectorRango],
      providers: [{ provide: PersonalService, useValue: personalService }],
    }).compileComponents();

    fixture = TestBed.createComponent(FiltroDerechaNumorComponent);
    component = fixture.componentInstance;
    if (opciones.conOrden !== undefined) component.conOrden = opciones.conOrden;
    if (opciones.conLimpiar !== undefined) component.conLimpiar = opciones.conLimpiar;
    if (opciones.valor) component.valor = opciones.valor;
    emitidos = [];
    component.valorChange.subscribe((f) => emitidos.push(f));
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const selectores = () => el().querySelectorAll('app-selector-rango');
  const selector = (i: number) =>
    fixture.debugElement.queryAll(By.directive(SelectorRango))[i].componentInstance as SelectorRango;

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('muestra un selector de rango para derecha y otro para numor', async () => {
    await montar();
    expect([...selectores()].map((s) => s.textContent?.trim())).toEqual(['Derecha', 'Numor']);
  });

  it('el rango elegido en el selector de derecha se emite como derechaDesde/derechaHasta', async () => {
    await montar();
    selector(0).rangoChange.emit({ desde: 1, hasta: 20 });

    expect(emitidos.at(-1)).toEqual(expect.objectContaining({ derechaDesde: 1, derechaHasta: 20 }));
  });

  it('el de numor emite numorDesde/numorHasta sin tocar la derecha', async () => {
    await montar({ valor: { derechaDesde: 3, derechaHasta: 9 } });
    selector(1).rangoChange.emit({ desde: null, hasta: 4 });

    expect(emitidos.at(-1)).toEqual(
      expect.objectContaining({ derechaDesde: 3, derechaHasta: 9, numorDesde: null, numorHasta: 4 }),
    );
  });

  it('pasa el rango guardado a los selectores', async () => {
    await montar({ valor: { derechaDesde: 5, derechaHasta: 5 } });
    expect(selectores()[0].textContent).toContain('5');
  });

  describe('orden', () => {
    it('por defecto ofrece "Ordenar por" y la dirección', async () => {
      await montar();
      expect(el().querySelector('select[aria-label="Ordenar por"]')).not.toBeNull();
      expect(el().querySelector('.fdn__dir')).not.toBeNull();
    });

    it('con conOrden=false no se muestra', async () => {
      await montar({ conOrden: false });
      expect(el().querySelector('select[aria-label="Ordenar por"]')).toBeNull();
      expect(el().querySelector('.fdn__dir')).toBeNull();
    });
  });

  describe('limpiar', () => {
    it('aparece solo cuando hay algún filtro', async () => {
      await montar();
      expect(el().querySelector('.fdn__limpiar')).toBeNull();

      component.actualizar({ gradoId: 14 });
      fixture.detectChanges();
      expect(el().querySelector('.fdn__limpiar')).not.toBeNull();
    });

    it('con conLimpiar=false no se muestra aunque haya filtros', async () => {
      await montar({ conLimpiar: false, valor: { gradoId: 14 } });
      expect(el().querySelector('.fdn__limpiar')).toBeNull();
    });

    it('borra los filtros pero conserva el orden elegido', async () => {
      await montar({
        valor: { gradoId: 14, derechaDesde: 1, numorHasta: 3, ordenarPor: 'numor', direccion: 'DESC' },
      });
      component.limpiarTodo();

      expect(emitidos.at(-1)).toEqual({ ordenarPor: 'numor', direccion: 'DESC' });
      expect(component.hayFiltro()).toBe(false);
    });
  });
});
