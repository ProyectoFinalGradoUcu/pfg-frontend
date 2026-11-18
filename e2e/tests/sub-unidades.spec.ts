import { Page, expect, test } from '@playwright/test';

// Solo lectura: los modales se cierran sin guardar.
test.describe('sub-unidades', () => {
  async function abrirComandos(page: Page) {
    await page.goto('/destinos/unidades');
    await page.locator('.unidades__tab', { hasText: 'Comandos' }).click();
    const tabla = page.getByTestId('tabla-comandos');
    await expect(tabla.locator('tbody tr').first()).toContainText('C.', { timeout: 10_000 });
    return tabla;
  }

  test('separa bases y comandos en dos pestañas', async ({ page }) => {
    await page.goto('/destinos/unidades');

    await expect(page.locator('.unidades__tab--active')).toHaveText('Bases');
    await expect(page.getByTestId('tabla-bases')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('tabla-comandos')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva base' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo comando' })).toHaveCount(0);

    await page.locator('.unidades__tab', { hasText: 'Comandos' }).click();
    await expect(page.locator('.unidades__tab--active')).toHaveText('Comandos');
    await expect(page.getByTestId('tabla-comandos')).toBeVisible();
    await expect(page.getByTestId('tabla-bases')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo comando' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva base' })).toHaveCount(0);
  });

  test('la tabla de comandos se filtra por texto y se limpia', async ({ page }) => {
    const tabla = await abrirComandos(page);
    const filas = tabla.locator('tbody tr');
    const total = await filas.count();
    expect(total).toBeGreaterThan(1);

    await page.getByLabel('Buscar comandos por código o denominación').fill('C.A.P.');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText('C.A.P.');

    await page.getByLabel('Buscar comandos por código o denominación').fill('zzz-no-existe');
    await expect(tabla).toContainText('No hay comandos que coincidan con los filtros.');

    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(filas).toHaveCount(total);
  });

  test('el kebab de un comando ofrece sus acciones y Editar abre el modal', async ({ page }) => {
    const tabla = await abrirComandos(page);
    const fila = tabla.locator('tbody tr', { has: page.getByText('C.A.P.', { exact: true }) });

    await fila.getByRole('button', { name: 'Acciones' }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveText(['Editar', /Dar de baja|Reactivar/]);

    // Click afuera lo cierra
    await page.getByRole('heading', { name: 'Bases y comandos', level: 2 }).click();
    await expect(menu).toHaveCount(0);

    await fila.getByRole('button', { name: 'Acciones' }).click();
    await menu.getByRole('menuitem', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Editar comando' })).toBeVisible();
    await expect(menu).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Editar comando' })).toHaveCount(0);
  });

  test('las bases vigentes de un comando llevan a sus bases', async ({ page }) => {
    const tabla = await abrirComandos(page);
    const fila = tabla.locator('tbody tr', { has: page.getByText('C.A.P.', { exact: true }) });
    await fila.getByRole('button', { name: 'Ver las bases de C.A.P.' }).click();

    await expect(page.locator('.unidades__tab--active')).toHaveText('Bases');
    const bases = page.getByTestId('tabla-bases');
    await expect(bases.getByText('E.T.A.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(bases.getByText('B.A.I.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Borrar filtros' })).toBeEnabled();
  });

  test('bases: sin columna Vigente y arranca mostrando solo vigentes', async ({ page }) => {
    await page.goto('/destinos/unidades');
    const tabla = page.getByTestId('tabla-bases');
    await expect(tabla.locator('thead th')).toHaveText(['Base', 'Comando', 'Destinados hoy', 'Acciones'], { timeout: 10_000 });
    await expect(tabla.getByText('Dada de baja')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Borrar filtros' })).toBeDisabled();
  });

  test('el kebab de una base no navega y Ver detalle sí', async ({ page }) => {
    await page.goto('/destinos/unidades');
    const tabla = page.getByTestId('tabla-bases');
    const fila = tabla.locator('tbody tr').first();
    await expect(fila.getByRole('button', { name: 'Acciones' })).toBeVisible({ timeout: 10_000 });

    await fila.getByRole('button', { name: 'Acciones' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem').first()).toHaveText('Ver detalle');
    await expect(page).toHaveURL(/\/destinos\/unidades$/);

    await menu.getByRole('menuitem', { name: 'Ver detalle' }).click();
    await expect(page).toHaveURL(/\/destinos\/unidades\/\d+$/);
  });
});
