import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { elegir } from '../fixtures/misiones';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import { haceDias } from '../fixtures/retiros';

type Envoltorio<T> = { service_response: { service_data: T } };
type Base = { id: string; codigo: string; denominacion: string; vigente: boolean; unidad_id?: string };

const toast = (page: Page, texto: string | RegExp) => page.locator('.toast__message', { hasText: texto });
const filas = (page: Page) => page.locator('.unidad-detalle__table tbody tr', { has: page.locator('.unidad-detalle__badge') });

// Base de prueba que se reutiliza: las bases no se pueden borrar.
const BASE_E2E = { codigo: 'E2EBASE', denominacion: 'Base E2E' };

async function leer<T>(api: APIRequestContext, url: string): Promise<T> {
  const res = await api.get(url);
  expect(res.ok(), `GET ${url} respondió ${res.status()}`).toBeTruthy();
  return ((await res.json()) as Envoltorio<T>).service_response.service_data;
}

async function idBase(api: APIRequestContext, denominacion: string): Promise<string> {
  const bases = await leer<Base[]>(api, '/api/catalogos/sub-unidades');
  return String(bases.find((b) => b.denominacion === denominacion)!.id);
}

// Pase por API a otra base.
async function pase(api: APIRequestContext, personaId: string, base: string, fecha: string) {
  const res = await api.post('/api/destinos', {
    data: {
      service_request: {
        persona_id: Number(personaId),
        sub_unidad_id: Number(await idBase(api, base)),
        fecha_inicio: fecha,
        numero_orden: `O.D. pase ${personaId}`,
      },
    },
  });
  expect(res.ok(), `pase respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
}

// Crea la base si no existe y la deja dada de baja.
async function baseE2EDadaDeBaja(api: APIRequestContext): Promise<void> {
  const { items } = await leer<{ items: Base[] }>(api, `/api/destinos/sub-unidades?query=${BASE_E2E.codigo}&pageSize=50`);
  let id = items.find((b) => b.codigo === BASE_E2E.codigo)?.id;
  if (!id) {
    const comandos = await leer<{ id: string; codigo: string }[]>(api, '/api/catalogos/unidades');
    const res = await api.post('/api/catalogos/sub-unidades', {
      data: { service_request: { unidad_id: Number(comandos.find((c) => c.codigo === 'CG')!.id), ...BASE_E2E } },
    });
    expect(res.ok(), `crear base respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
    id = ((await res.json()) as Envoltorio<Base>).service_response.service_data.id;
  }
  const baja = await api.patch(`/api/catalogos/sub-unidades/${id}`, { data: { service_request: { vigente: false } } });
  expect(baja.ok(), `dar de baja respondió ${baja.status()}: ${await baja.text()}`).toBeTruthy();
}

async function abrirDetalle(page: Page, id: string, nombre: string) {
  await page.goto(`/destinos/unidades/${id}`);
  await expect(page.getByRole('heading', { name: nombre, exact: true })).toBeVisible({ timeout: 10_000 });
}

async function buscar(page: Page, cedula: string) {
  await page.getByPlaceholder('Cédula, nombre o apellido...').fill(cedula);
}

test.describe('detalle de una base', () => {
  test('muestra la dotación actual y el historial de la base', async ({ page }) => {
    const api = await apiAdmin();
    const { id, cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Detalle Base');
    await pase(api, id, 'E.M.A.', '2025-02-01');
    const eta = await idBase(api, 'E.T.A.');
    const ema = await idBase(api, 'E.M.A.');
    await api.dispose();

    await abrirDetalle(page, ema, 'E.M.A.');
    await expect(page.locator('.unidad-detalle__header p')).toContainText('Comando: CAP (C.A.P.)');
    await buscar(page, cedula);
    await expect(filas(page)).toHaveCount(1, { timeout: 10_000 });
    await expect(filas(page)).toContainText('1/2/2025');
    await expect(filas(page)).toContainText(`O.D. pase ${id}`);
    await expect(filas(page)).toContainText('Vigente');

    // En la base anterior solo aparece en el historial.
    await page.locator('.breadcrumb').getByRole('link', { name: 'Bases y comandos' }).click();
    await expect(page).toHaveURL(/\/destinos\/unidades$/);
    await abrirDetalle(page, eta, 'E.T.A.');
    await buscar(page, cedula);
    await expect(page.getByText('No hay funcionarios destinados hoy en esta base.')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Todo el historial' }).click();
    await expect(filas(page)).toHaveCount(1);
    await expect(filas(page)).toContainText('31/1/2025');
    await expect(filas(page)).toContainText('Cerrado');
  });

  test('filtra por categoría', async ({ page }) => {
    const api = await apiAdmin();
    const { cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Detalle Categoria');
    const eta = await idBase(api, 'E.T.A.');
    await api.dispose();

    await abrirDetalle(page, eta, 'E.T.A.');
    await buscar(page, cedula);
    await expect(filas(page)).toHaveCount(1, { timeout: 10_000 });

    await page.getByRole('group', { name: 'Categoría' }).getByRole('button', { name: 'Oficiales' }).click();
    await expect(page.getByText('No hay funcionarios destinados hoy en esta base.')).toBeVisible();
    await page.getByRole('group', { name: 'Categoría' }).getByRole('button', { name: 'Subalternos' }).click();
    await expect(filas(page)).toHaveCount(1);
  });

  test('un retirado que conservó el destino se marca como retirado', async ({ page }) => {
    const api = await apiAdmin();
    const { id, cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Detalle Retirado');
    const motivos = await leer<{ id: number; codigo: string }[]>(api, '/api/catalogos/motivos-baja');
    const retiro = await api.post('/api/retiros', {
      data: {
        service_request: {
          persona_id: Number(id),
          fecha_retiro: haceDias(10),
          motivo_baja_id: Number(motivos.find((m) => m.codigo === 'RETIRO_VOL')!.id),
          cerrar: { destino: false, inscripciones: [], comisiones: [], usuario: false },
        },
      },
    });
    expect(retiro.ok(), `retiro respondió ${retiro.status()}: ${await retiro.text()}`).toBeTruthy();
    const eta = await idBase(api, 'E.T.A.');
    await api.dispose();

    await abrirDetalle(page, eta, 'E.T.A.');
    await buscar(page, cedula);
    await expect(filas(page)).toHaveCount(1, { timeout: 10_000 });
    await expect(filas(page).locator('.unidad-detalle__badge--retirado')).toHaveText('Retirado');
  });

  test('una base que no existe vuelve al listado', async ({ page }) => {
    await page.goto('/destinos/unidades/999999999');
    await expect(page).toHaveURL(/\/destinos\/unidades$/, { timeout: 10_000 });
    await expect(page.locator('.toast--error')).toBeVisible();
  });
});

test.describe('alta y edición de bases', () => {
  test('nueva base valida los campos y no acepta un código repetido', async ({ page }) => {
    await page.goto('/destinos/unidades');
    await page.getByRole('button', { name: 'Nueva base' }).click();
    const modal = page.locator('app-unidad-form-modal');

    await modal.getByRole('button', { name: 'Crear base' }).click();
    await expect(modal.locator('.modal__error')).toHaveText('Completá código, denominación y comando.');

    await elegir(page, modal.locator('app-select'), 'CG · C.G.');
    await modal.locator('[formcontrolname=codigo]').fill('BAI');
    await modal.locator('[formcontrolname=denominacion]').fill('Repetida E2E');
    await modal.getByRole('button', { name: 'Crear base' }).click();
    await expect(modal.locator('.modal__error')).toHaveText('El código "BAI" ya es de la base B.A.I. (C.A.O.)');

    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('reactivar, editar y dar de baja una base', async ({ page }) => {
    const api = await apiAdmin();
    await baseE2EDadaDeBaja(api);
    await api.dispose();

    await page.goto('/destinos/unidades');
    await page.getByLabel('Buscar bases por código o denominación').fill(BASE_E2E.codigo);
    await elegir(page, page.locator('app-select.unidades__filtros-select').nth(1), 'Todas');
    const fila = page.getByTestId('tabla-bases').locator('tbody tr', { hasText: BASE_E2E.codigo });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });
    const menu = page.locator('.unidades__dropdown');

    await expect(fila.locator('.unidades__badge')).toHaveText('Dada de baja');
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await menu.getByRole('menuitem', { name: 'Reactivar' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Reactivar' }).click();
    await expect(toast(page, 'Base reactivada')).toBeVisible();
    await expect(fila.locator('.unidades__badge')).toHaveCount(0);

    const nombre = `Base E2E ${Date.now() % 100_000}`;
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await menu.getByRole('menuitem', { name: 'Editar' }).click();
    const modal = page.locator('app-unidad-form-modal');
    await expect(modal.locator('.unidad-form__readonly')).toContainText(BASE_E2E.codigo);
    await modal.locator('[formcontrolname=denominacion]').fill(nombre);
    await modal.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(toast(page, 'Base actualizada')).toBeVisible();
    await expect(fila).toContainText(nombre);

    await fila.getByRole('button', { name: 'Acciones' }).click();
    await menu.getByRole('menuitem', { name: 'Dar de baja' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Dar de baja' }).click();

    await expect(toast(page, 'Base dada de baja')).toBeVisible();
    await expect(fila.locator('.unidades__badge')).toHaveText('Dada de baja');
  });

  test('una base con destinados no se deja dar de baja', async ({ page }) => {
    await page.goto('/destinos/unidades');
    await page.getByLabel('Buscar bases por código o denominación').fill('E.T.A.');
    const fila = page.getByTestId('tabla-bases').locator('tbody tr', { hasText: 'E.T.A.' }).first();
    await expect(fila).toBeVisible({ timeout: 10_000 });

    await fila.getByRole('button', { name: 'Acciones' }).click();
    await page.locator('.unidades__dropdown').getByRole('menuitem', { name: 'Dar de baja' }).click();

    const modal = page.locator('.modal', { has: page.getByRole('heading', { name: 'Dar de baja base' }) });
    await expect(modal.locator('.modal__warning')).toContainText('con destino vigente. Reasignalos antes de darla de baja.');
    await expect(modal.getByRole('button', { name: 'Dar de baja' })).toHaveCount(0);
    await modal.getByRole('button', { name: 'Cerrar' }).click();
  });
});
