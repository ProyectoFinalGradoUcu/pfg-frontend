import { APIRequestContext, Page, expect, test } from '@playwright/test';
import fs from 'node:fs';
import { apiAdmin } from '../fixtures/personal';
import { datos } from '../fixtures/usuarios';
import { encabezados, leerWorkbook } from '../fixtures/excel';
import { Periodo, anioLibre, borrarPeriodo, elegir, periodos } from '../fixtures/misiones';

// No se cargan horas: un período con horas cargadas ya no se puede borrar y lo ven todos.
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1400, height: 1400 } });

type Unidad = { id: string; denominacion: string; vigente: boolean };

let api: APIRequestContext;
let anio: number;
let periodo: Periodo | undefined;
let cedula: string;

const overlay = (page: Page) => page.locator('.modal-overlay');
const tile = (page: Page, n: number) => page.locator('.periodo-tile').nth(n - 1);

async function irAlAnio(page: Page) {
  await page.goto('/vuelos/horas');
  await expect(page.getByRole('heading', { name: 'Horas de vuelo' })).toBeVisible();
  await elegir(page, page.locator('.periodos__campo--anio app-select'), String(anio));
  await expect(tile(page, 1)).toHaveClass(/periodo-tile--activa/);
}

test.beforeAll(async () => {
  api = await apiAdmin();
  anio = await anioLibre(api);
});

test.afterAll(async () => {
  const quedo = (await periodos(api)).find((p) => p.anio === anio);
  await borrarPeriodo(api, quedo?.id);
  await api.dispose();
});

test('la pantalla de horas carga con las 4 hojas del año', async ({ page }) => {
  await page.goto('/vuelos/horas');
  await expect(page.getByRole('heading', { name: 'Horas de vuelo' })).toBeVisible();
  await expect(page.locator('.periodo-tile')).toHaveCount(4);
  await expect(tile(page, 1)).toContainText('1er período');
  await expect(tile(page, 4)).toContainText('4to período');
  await expect(page.getByRole('button', { name: 'Abrir período', exact: true })).toBeVisible();
});

test('el catálogo de unidades de vuelo muestra las de la API', async ({ page }) => {
  const unidades = await datos<Unidad[]>(await api.get('/api/vuelos/unidades'));
  expect(unidades.length).toBeGreaterThan(0);
  await page.goto('/vuelos/unidades');
  await expect(page.getByRole('heading', { name: 'Unidades de vuelo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: `Catálogo · ${unidades.filter((u) => u.vigente).length} vigentes` })).toBeVisible();
  await expect(page.locator('.vuelos__table tbody tr')).toHaveCount(unidades.length);
  const u = unidades[0];
  await expect(page.locator('tbody tr', { hasText: u.denominacion }).first()).toContainText(
    u.vigente ? 'Vigente' : 'Dada de baja',
  );
});

test('abrir período valida el año', async ({ page }) => {
  await page.goto('/vuelos/horas');
  await page.getByRole('button', { name: 'Abrir período', exact: true }).click();
  await overlay(page).locator('#nuevo-anio').fill('1800');
  await overlay(page).getByRole('button', { name: 'Abrir período', exact: true }).click();
  await expect(overlay(page).locator('.modal__error')).toHaveText('Ingresá un año válido.');
  await overlay(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(overlay(page)).toHaveCount(0);
});

test('abre un período con todo el personal en actividad', async ({ page }) => {
  await page.goto('/vuelos/horas');
  await page.getByRole('button', { name: 'Abrir período', exact: true }).click();
  const m = overlay(page);
  await m.locator('#nuevo-anio').fill(String(anio));
  await elegir(page, m.locator('app-select'), '1er Período');
  await m.getByRole('button', { name: 'Abrir período', exact: true }).click();

  await expect(page.getByText(new RegExp(`^1er Período ${anio} abierto con \\d+ funcionarios$`))).toBeVisible({
    timeout: 15_000,
  });
  periodo = (await periodos(api)).find((p) => p.anio === anio && p.numero === 1);
  expect(periodo).toBeTruthy();
  expect(periodo!.cerrado).toBe(false);
  expect(periodo!.total_registros).toBeGreaterThan(0);

  await expect(tile(page, 1)).toContainText('Abierto');
  await expect(tile(page, 1)).toContainText(`0 de ${periodo!.total_registros} cargados`);
  await expect(tile(page, 2)).toContainText('Sin abrir');
  await expect(page.locator('.resumen__avance')).toContainText(`0 / ${periodo!.total_registros} funcionarios cargados`);
});

test('la tabla del período busca por cédula', async ({ page }) => {
  const r = await datos<{ items: { persona: { cedula: string } }[] }>(
    await api.get(`/api/vuelos/periodos/${periodo!.id}/registros?page=1&pageSize=1`),
  );
  cedula = r.items[0].persona.cedula;

  await irAlAnio(page);
  const filas = page.locator('table.registros tbody tr');
  await expect(filas).toHaveCount(Math.min(10, periodo!.total_registros));
  await page.getByPlaceholder('Cédula, nombre o apellido...').fill(cedula);
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText(`CI ${cedula}`);

  await filas.first().getByRole('button', { name: 'Acciones' }).click();
  await expect(page.locator('.vuelos__menu').getByRole('button', { name: 'Cargar horas' })).toBeVisible();
  await expect(page.locator('.vuelos__menu').getByRole('button', { name: 'Ver historial' })).toBeVisible();
});

test('exporta el año a Excel con una hoja por período', async ({ page }) => {
  await irAlAnio(page);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe(`horas_vuelo_${anio}.xlsx`);

  const wb = await leerWorkbook(fs.readFileSync(await descarga.path()));
  expect(wb.worksheets.map((w: { name: string }) => w.name)).toEqual([periodo!.etiqueta]);
  expect(encabezados(wb, periodo!.etiqueta)).toEqual([
    'Grado',
    'Esc.',
    'Nombre y apellido',
    'Cédula',
    'Período de vuelo',
    'Unidad de vuelo',
    'Aeronaves',
    'Hs Av Año Militar',
    'Hs Av Total',
    'Hs Ob Año Militar',
    'Hs Ob Total',
    'Total',
  ]);
  const hoja = wb.getWorksheet(periodo!.etiqueta);
  expect(hoja.rowCount - 1).toBe(periodo!.total_registros);
  const cedulas: string[] = [];
  hoja.eachRow((row: { getCell(n: number): { value: unknown } }, n: number) => {
    if (n > 1) cedulas.push(String(row.getCell(4).value));
  });
  expect(cedulas).toContain(cedula);
});

test('cerrar el período saca la carga de horas y se puede reabrir', async ({ page }) => {
  await irAlAnio(page);
  await page.locator('.resumen__acciones').getByRole('button', { name: 'Cerrar período', exact: true }).click();
  await overlay(page).getByRole('button', { name: 'Cerrar período', exact: true }).click();
  await expect(page.getByText(`${periodo!.etiqueta} cerrado`)).toBeVisible();
  await expect(tile(page, 1)).toContainText('Cerrado');
  await expect(page.getByText(`${periodo!.etiqueta} está cerrado: no admite cambios hasta que se reabra.`)).toBeVisible();
  expect((await periodos(api)).find((p) => p.id === periodo!.id)?.cerrado).toBe(true);

  await page.getByPlaceholder('Cédula, nombre o apellido...').fill(cedula);
  const filas = page.locator('table.registros tbody tr');
  await expect(filas).toHaveCount(1);
  await filas.first().getByRole('button', { name: 'Acciones' }).click();
  const menu = page.locator('.vuelos__menu');
  await expect(menu.getByRole('button', { name: 'Ver historial' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Cargar horas' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Reabrir período' }).click();
  await overlay(page).getByRole('button', { name: 'Reabrir', exact: true }).click();
  await expect(page.getByText(`${periodo!.etiqueta} reabierto`)).toBeVisible();
  await expect(tile(page, 1)).toContainText('Abierto');
  expect((await periodos(api)).find((p) => p.id === periodo!.id)?.cerrado).toBe(false);
});

test('eliminar el período lo borra para todos', async ({ page }) => {
  await irAlAnio(page);
  await page.getByRole('button', { name: 'Más acciones del período' }).click();
  await page.locator('.vuelos__menu').getByRole('button', { name: 'Eliminar período' }).click();
  await expect(overlay(page).getByRole('heading', { name: `Eliminar ${periodo!.etiqueta}` })).toBeVisible();
  await overlay(page).getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByText(`${periodo!.etiqueta} eliminado`)).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
  expect((await periodos(api)).some((p) => p.anio === anio)).toBe(false);
});
