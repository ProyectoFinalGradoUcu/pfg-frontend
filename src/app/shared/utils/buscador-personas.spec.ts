import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { BuscadorPersonas, DEBOUNCE_BUSQUEDA_MS } from './buscador-personas';
import { PersonalService } from '../../core/services/personal.service';
import { PersonaListItem } from '../../core/models/personal.models';

function persona(id: string, nombre: string, cedula: string): PersonaListItem {
  return { id, nombre, cedula, rango: null, destino: null, estado: null, relacion_estado: 'activo' };
}

const ANA = persona('1', 'Ana Pereyra', '60000001');
const JUAN = persona('2', 'Juan Dagalipega', '41234567');
const LUIS = persona('3', 'Luis Silva', '50000003');

const esperarDebounce = () => new Promise((r) => setTimeout(r, DEBOUNCE_BUSQUEDA_MS + 60));

describe('BuscadorPersonas', () => {
  let findPaginado: ReturnType<typeof vi.fn>;
  let buscador: BuscadorPersonas;

  function responder(items: PersonaListItem[]): void {
    findPaginado.mockReturnValue(of({ items, total: items.length, page: 1, pageSize: 20 }));
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    findPaginado = vi.fn();
    responder([]);
    TestBed.configureTestingModule({
      providers: [{ provide: PersonalService, useValue: { findPaginado } }],
    });
    buscador = TestBed.runInInjectionContext(() => new BuscadorPersonas());
  });

  it('busca en el servidor con lo escrito, no sobre una lista ya cargada', async () => {
    responder([JUAN]);
    buscador.buscar('dagalipega');
    await esperarDebounce();

    expect(findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: 'dagalipega' }));
    expect(buscador.opciones().map((p) => p.id)).toEqual(['2']);
  });

  it('la etiqueta muestra la cédula, así se ve por qué coincidió', async () => {
    responder([JUAN]);
    buscador.buscar('4123');
    await esperarDebounce();

    expect(buscador.opciones()[0].etiqueta).toBe('Juan Dagalipega · CI 41234567');
  });

  it('sin término trae la primera página', async () => {
    responder([ANA, LUIS]);
    buscador.buscar('  ');
    await esperarDebounce();

    expect(findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
    expect(buscador.opciones()).toHaveLength(2);
  });

  it('espera a que se deje de escribir: una sola consulta por ráfaga', async () => {
    buscador.buscar('d');
    buscador.buscar('da');
    buscador.buscar('dag');
    await esperarDebounce();

    expect(findPaginado).toHaveBeenCalledTimes(1);
    expect(findPaginado).toHaveBeenCalledWith(expect.objectContaining({ search: 'dag' }));
  });

  it('el elegido sigue en las opciones aunque la búsqueda nueva no lo traiga', async () => {
    responder([JUAN]);
    buscador.buscar('dagalipega');
    await esperarDebounce();
    buscador.recordar('2');

    responder([ANA]);
    buscador.buscar('pereyra');
    await esperarDebounce();

    expect(buscador.opciones().map((p) => p.id)).toEqual(['2', '1']);
  });

  it('con selección múltiple recuerda a todos los elegidos, sin repetirlos', async () => {
    responder([ANA, JUAN]);
    buscador.buscar('');
    await esperarDebounce();
    buscador.recordar(['1', '2']);

    responder([JUAN, LUIS]);
    buscador.buscar('silva');
    await esperarDebounce();

    expect(buscador.opciones().map((p) => p.id)).toEqual(['1', '2', '3']);
  });

  it('al vaciar la selección deja de mostrar a los que ya no están elegidos', async () => {
    responder([JUAN]);
    buscador.buscar('dagalipega');
    await esperarDebounce();
    buscador.recordar('2');
    buscador.recordar(null);

    responder([ANA]);
    buscador.buscar('pereyra');
    await esperarDebounce();

    expect(buscador.opciones().map((p) => p.id)).toEqual(['1']);
  });

  it('vincular() sigue al control: recuerda lo que se elige y olvida al vaciarlo', async () => {
    const control = new FormControl<string[]>([]);
    buscador.vincular(control);
    responder([ANA, JUAN]);
    buscador.buscar('');
    await esperarDebounce();

    control.setValue(['2']);
    responder([LUIS]);
    buscador.buscar('silva');
    await esperarDebounce();
    expect(buscador.opciones().map((p) => p.id)).toEqual(['2', '3']);

    control.reset([]);
    expect(buscador.opciones().map((p) => p.id)).toEqual(['3']);
  });

  it('persona() resuelve el id que emite el select', async () => {
    responder([JUAN]);
    buscador.buscar('dagalipega');
    await esperarDebounce();

    expect(buscador.persona('2')).toEqual(JUAN);
    expect(buscador.persona('99')).toBeNull();
  });

  it('marca que está buscando hasta que llega la respuesta', async () => {
    buscador.buscar('dag');
    expect(buscador.buscando()).toBe(true);
    await esperarDebounce();
    expect(buscador.buscando()).toBe(false);
  });

  it('si la búsqueda falla deja la lista vacía y sigue respondiendo a la siguiente', async () => {
    findPaginado.mockReturnValueOnce(throwError(() => new Error('500')));
    buscador.buscar('dag');
    await esperarDebounce();
    expect(buscador.opciones()).toEqual([]);
    expect(buscador.buscando()).toBe(false);

    responder([JUAN]);
    buscador.buscar('daga');
    await esperarDebounce();
    expect(buscador.opciones().map((p) => p.id)).toEqual(['2']);
  });
});
