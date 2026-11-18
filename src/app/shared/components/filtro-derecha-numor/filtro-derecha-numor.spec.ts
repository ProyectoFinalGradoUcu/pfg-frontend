import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { FiltroDerechaNumorComponent } from './filtro-derecha-numor';
import { SelectorRango } from '../selector-rango/selector-rango';
import { Select } from '../select/select';
import { PersonalService } from '../../../core/services/personal.service';
import { FiltroDerechaNumor } from '../../../core/models/derecha.models';

describe('FiltroDerechaNumorComponent', () => {
  let fixture: ComponentFixture<FiltroDerechaNumorComponent>;
  let component: FiltroDerechaNumorComponent;
  let emitidos: FiltroDerechaNumor[];

  let personalService: { getGrados: ReturnType<typeof vi.fn>; getEscalafones: ReturnType<typeof vi.fn> };

  async function montar(
    opciones: {
      conOrden?: boolean;
      conLimpiar?: boolean;
      conEscala?: boolean;
      conGradoEscalafon?: boolean;
      valor?: FiltroDerechaNumor;
    } = {},
  ) {
    personalService = {
      getGrados: vi.fn().mockReturnValue(of([{ id: 14, denominacion: 'Brig. Gral.' }])),
      getEscalafones: vi.fn().mockReturnValue(of([{ id: 1, denominacion: 'AV' }])),
    };
    await TestBed.configureTestingModule({
      declarations: [FiltroDerechaNumorComponent, SelectorRango, Select],
      imports: [FormsModule],
      providers: [{ provide: PersonalService, useValue: personalService }],
    }).compileComponents();

    fixture = TestBed.createComponent(FiltroDerechaNumorComponent);
    component = fixture.componentInstance;
    if (opciones.conOrden !== undefined) component.conOrden = opciones.conOrden;
    if (opciones.conLimpiar !== undefined) component.conLimpiar = opciones.conLimpiar;
    if (opciones.conEscala !== undefined) component.conEscala = opciones.conEscala;
    if (opciones.conGradoEscalafon !== undefined) component.conGradoEscalafon = opciones.conGradoEscalafon;
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
      expect(el().querySelector('.fdn__orden')).not.toBeNull();
      expect(el().querySelector('.fdn__dir')).not.toBeNull();
    });

    it('con conOrden=false no se muestra', async () => {
      await montar({ conOrden: false });
      expect(el().querySelector('.fdn__orden')).toBeNull();
      expect(el().querySelector('.fdn__dir')).toBeNull();
    });
  });

  describe('limpiar', () => {
    it('aparece solo cuando hay algún filtro', async () => {
      await montar();
      expect(el().querySelector('.fdn__limpiar')).toBeNull();

      component.actualizar({ gradoId: [14] });
      fixture.detectChanges();
      expect(el().querySelector('.fdn__limpiar')).not.toBeNull();
    });

    it('con conLimpiar=false no se muestra aunque haya filtros', async () => {
      await montar({ conLimpiar: false, valor: { gradoId: [14] } });
      expect(el().querySelector('.fdn__limpiar')).toBeNull();
    });

    it('borra los filtros pero conserva el orden elegido', async () => {
      await montar({
        valor: { gradoId: [14], derechaDesde: 1, numorHasta: 3, ordenarPor: 'numor', direccion: 'DESC' },
      });
      component.limpiarTodo();

      expect(emitidos.at(-1)).toEqual({ ordenarPor: 'numor', direccion: 'DESC' });
      expect(component.hayFiltro()).toBe(false);
    });
  });

  describe('selects', () => {
    const selectDe = (clase: string) =>
      fixture.debugElement.query(By.css(clase))?.componentInstance as Select | undefined;

    it('escala, grado y escalafón usan app-select', async () => {
      await montar();
      expect(el().querySelector('select')).toBeNull();
      expect(selectDe('.fdn__escala')).toBeDefined();
      expect(selectDe('.fdn__grado')?.items).toEqual([{ id: 14, denominacion: 'Brig. Gral.' }]);
      expect(selectDe('.fdn__escalafon')?.items).toEqual([{ id: 1, denominacion: 'AV' }]);
    });

    it('grado y escalafón son multiselect: lo elegido se emite como lista', async () => {
      await montar();
      expect(selectDe('.fdn__grado')!.multiple).toBe(true);
      expect(selectDe('.fdn__escalafon')!.multiple).toBe(true);

      selectDe('.fdn__grado')!.pick({ id: 14, denominacion: 'Brig. Gral.' });
      expect(emitidos.at(-1)).toEqual(expect.objectContaining({ gradoId: [14] }));
    });

    it('una lista vacía no cuenta como filtro', async () => {
      await montar({ valor: { gradoId: [], escalafonId: [] } });
      expect(component.hayFiltro()).toBe(false);
    });

    it('con conEscala=false no muestra la escala', async () => {
      await montar({ conEscala: false });
      expect(el().querySelector('.fdn__escala')).toBeNull();
    });

    it('con conGradoEscalafon=false no muestra grado ni escalafón ni pide sus catálogos', async () => {
      await montar({ conGradoEscalafon: false });
      expect(el().querySelector('.fdn__grado')).toBeNull();
      expect(el().querySelector('.fdn__escalafon')).toBeNull();
      expect(personalService.getGrados).not.toHaveBeenCalled();
      expect(personalService.getEscalafones).not.toHaveBeenCalled();
    });
  });
});
