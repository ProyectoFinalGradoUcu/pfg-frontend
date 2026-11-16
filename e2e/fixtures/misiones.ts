import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { datos } from './usuarios';

export type Mision = {
  id: string;
  nombre_mision: string;
  pais: string;
  fecha_orden: string | null;
  fecha_boletin: string | null;
  numero_resolucion: string | null;
  fecha_resolucion: string | null;
  resolucion_cje: string | null;
  total_convocatorias: number;
};
export type Convocatoria = {
  id: string;
  numero_orden: string | null;
  boletin: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  observaciones: string | null;
  finalizada: boolean;
};
export type Asignacion = {
  persona_id: string;
  cedula: string;
  numero_orden: string | null;
  boletin: string | null;
  observaciones: string | null;
};
export type Periodo = { id: string; anio: number; numero: number; etiqueta: string; cerrado: boolean; total_registros: number };

// El backend envuelve los cuerpos en service_request.
const cuerpo = (data: unknown) => ({ data: { service_request: data } });

async function ok(res: { ok(): boolean; status(): number; text(): Promise<string> }, que: string) {
  expect(res.ok(), `${que} respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
}

export async function crearMision(api: APIRequestContext, data: Partial<Mision> & { nombre_mision: string }): Promise<Mision> {
  const res = await api.post('/api/misiones', cuerpo({ pais: 'Chipre', ...data }));
  await ok(res, 'crear misión');
  return datos<Mision>(res);
}

export async function leerMision(api: APIRequestContext, id: string): Promise<Mision> {
  const res = await api.get(`/api/misiones/${id}`);
  await ok(res, 'leer misión');
  return datos<Mision>(res);
}

export async function misionPorNombre(api: APIRequestContext, nombre: string): Promise<Mision | undefined> {
  const res = await api.get(`/api/misiones?page=1&pageSize=50&nombre=${encodeURIComponent(nombre)}`);
  await ok(res, 'listar misiones');
  return (await datos<{ items: Mision[] }>(res)).items.find((m) => m.nombre_mision === nombre);
}

// Borra la misión con sus convocatorias y asignaciones; no falla si ya no existe.
export async function borrarMision(api: APIRequestContext, id: string | undefined) {
  if (id) await api.delete(`/api/misiones/${id}`);
}

export async function crearConvocatoria(
  api: APIRequestContext,
  misionId: string,
  data: Partial<Omit<Convocatoria, 'id' | 'finalizada'>>,
): Promise<Convocatoria> {
  const res = await api.post(`/api/misiones/${misionId}/convocatorias`, cuerpo(data));
  await ok(res, 'crear convocatoria');
  return datos<Convocatoria>(res);
}

export async function leerConvocatoria(api: APIRequestContext, misionId: string, id: string): Promise<Convocatoria> {
  const res = await api.get(`/api/misiones/${misionId}/convocatorias/${id}`);
  await ok(res, 'leer convocatoria');
  return datos<Convocatoria>(res);
}

export async function convocatorias(api: APIRequestContext, misionId: string): Promise<Convocatoria[]> {
  const res = await api.get(`/api/misiones/${misionId}/convocatorias?page=1&pageSize=50`);
  await ok(res, 'listar convocatorias');
  return (await datos<{ items: Convocatoria[] }>(res)).items;
}

export async function asignar(
  api: APIRequestContext,
  misionId: string,
  convocatoriaId: string,
  personaId: string,
  data: { numero_orden?: string; boletin?: string; observaciones?: string },
) {
  const res = await api.post(
    `/api/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios`,
    cuerpo({ funcionarios: [{ persona_id: Number(personaId), ...data }] }),
  );
  await ok(res, 'asignar funcionario');
}

export async function quitar(api: APIRequestContext, misionId: string, convocatoriaId: string, personaId: string) {
  const res = await api.delete(`/api/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios/${personaId}`);
  await ok(res, 'quitar funcionario');
}

export async function asignaciones(api: APIRequestContext, misionId: string, convocatoriaId: string): Promise<Asignacion[]> {
  const res = await api.get(`/api/misiones/${misionId}/convocatorias/${convocatoriaId}/funcionarios?page=1&pageSize=50`);
  await ok(res, 'listar funcionarios de la convocatoria');
  return (await datos<{ items: Asignacion[] }>(res)).items;
}

export async function totalPersonalEnMision(api: APIRequestContext): Promise<number> {
  const res = await api.get('/api/misiones/funcionarios?page=1&pageSize=1');
  await ok(res, 'listar personal en misión');
  return (await datos<{ total: number }>(res)).total;
}

export async function periodos(api: APIRequestContext): Promise<Periodo[]> {
  const res = await api.get('/api/vuelos/periodos');
  await ok(res, 'listar períodos');
  return datos<Periodo[]>(res);
}

export async function borrarPeriodo(api: APIRequestContext, id: string | undefined) {
  if (id) await api.delete(`/api/vuelos/periodos/${id}`);
}

// Año libre entre 2900 y 2989, para no pisar períodos reales ni de otras corridas.
export async function anioLibre(api: APIRequestContext): Promise<number> {
  const ocupados = new Set((await periodos(api)).map((p) => p.anio));
  for (let intento = 0; intento < 200; intento++) {
    const anio = 2900 + Math.floor(Math.random() * 90);
    if (!ocupados.has(anio)) return anio;
  }
  throw new Error('No hay años libres entre 2900 y 2989');
}

// Abre un app-select, filtra si tiene buscador y elige la opción con ese texto exacto.
export async function elegir(page: Page, select: Locator, opcion: string, buscar = opcion) {
  await select.locator('.appsel__control').click();
  const panel = page.locator('.appsel__dropdown');
  await expect(panel).toBeVisible();
  const input = panel.locator('.appsel__search input');
  if (await input.count()) await input.fill(buscar);
  await panel.getByRole('option', { name: opcion, exact: true }).click();
}
