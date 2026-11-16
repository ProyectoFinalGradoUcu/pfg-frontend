import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { datos } from './usuarios';

type Elegibilidad = {
  estado: string;
  grado_actual: { id: string; denominacion: string };
  grado_destino: { id: string; denominacion: string } | null;
};
type FilaDerecha = { persona_id: string; derecha: number };

// Ayer y no hoy: de noche "hoy" en UTC ya es mañana en Uruguay.
export const ayer = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export const sufijo = () => `${Date.now() % 1_000_000}-${Math.floor(Math.random() * 100)}`;

export async function elegibilidad(api: APIRequestContext, personaId: string): Promise<Elegibilidad> {
  const res = await api.get(`/api/ascensos/elegibilidad/${personaId}`);
  expect(res.ok(), `elegibilidad ${personaId} respondió ${res.status()}`).toBeTruthy();
  return datos<Elegibilidad>(res);
}

// Derecha de la persona en su grado, o undefined si no figura.
export async function derechaEnGrado(api: APIRequestContext, gradoId: string, personaId: string) {
  const res = await api.get(`/api/configuracion-derecha/grados/${gradoId}`);
  expect(res.ok(), `derecha del grado ${gradoId} respondió ${res.status()}`).toBeTruthy();
  const { items } = await datos<{ items: FilaDerecha[] }>(res);
  return items.find((i) => i.persona_id === personaId)?.derecha;
}

export async function crearOrdenPorApi(
  api: APIRequestContext,
  personaId: string,
  numero: string,
): Promise<{ id: string; ascensoId: string }> {
  const res = await api.post('/api/ascensos/ordenes', {
    data: {
      numero_orden: numero,
      fecha_orden: ayer(),
      funcionarios: [{ persona_id: Number(personaId), fecha_ascenso: ayer(), motivo_excepcion: 'Excepción de prueba E2E' }],
    },
  });
  expect(res.ok(), `crear orden respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  const orden = await datos<{ id: string; ascensos: { id: string }[] }>(res);
  return { id: String(orden.id), ascensoId: String(orden.ascensos[0].id) };
}

export async function anularAscensoPorApi(api: APIRequestContext, ascensoId: string): Promise<void> {
  const res = await api.post(`/api/ascensos/${ascensoId}/anular`, { data: { motivo: 'Anulado por el test E2E' } });
  expect(res.ok(), `anular ascenso respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
}

export async function retirarPorApi(api: APIRequestContext, personaId: string, fecha = ayer()): Promise<number> {
  const motivos = await datos<{ id: number }[]>(await api.get('/api/catalogos/motivos-baja'));
  const res = await api.post('/api/retiros', {
    data: { service_request: { persona_id: Number(personaId), fecha_retiro: fecha, motivo_baja_id: Number(motivos[0].id) } },
  });
  expect(res.ok(), `retiro respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  return (await datos<{ id: number }>(res)).id;
}

export async function crearComisionPorApi(api: APIRequestContext, denominacion: string): Promise<string> {
  const res = await api.post('/api/comisiones', { data: { service_request: { denominacion } } });
  expect(res.ok(), `crear comisión respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  return String((await datos<{ id: string }>(res)).id);
}

// Abre un app-select, busca y elige la única opción que contiene el texto.
export async function elegirEnSelect(page: Page, control: Locator, busqueda: string): Promise<void> {
  await control.click();
  await page.locator('.appsel__search input').fill(busqueda);
  const opcion = page.locator('.appsel__option', { hasText: busqueda });
  await expect(opcion).toHaveCount(1, { timeout: 10_000 });
  await opcion.click();
}
