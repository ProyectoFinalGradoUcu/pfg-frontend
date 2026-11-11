import { Page, expect, test } from '@playwright/test';

/** La sesión del admin viene del `storageState` de playwright.config.ts. */
test.describe('unidades por base', () => {
  async function abrirTab(page: Page, nombre: string) {
    await page.goto('/usuarios-y-roles');
    await page.locator('.ur__tab', { hasText: nombre }).click();
  }

  test('la tabla de bases se agrupa por comando y se filtra por comando', async ({ page }) => {
    await abrirTab(page, 'Unidades');
    await expect(page.getByRole('heading', { name: 'Bases', exact: true })).toBeVisible();

    const grupos = page.locator('tr.un__grupo');
    await expect(grupos.first()).toBeVisible({ timeout: 10_000 });
    for (const comando of ['C.A.L.', 'C.A.O.', 'C.A.P.', 'C.G.']) {
      await expect(grupos.filter({ hasText: new RegExp(`^\\s*${comando.replace(/\./g, '\\.')}\\s*$`) })).toHaveCount(1);
    }

    const filtro = page.getByLabel('Comando');
    await expect(filtro).toHaveValue('');
    await expect(filtro.locator('option:checked')).toHaveText('Todos los comandos');

    await filtro.selectOption({ label: 'C.A.P.' });
    await expect(grupos).toHaveCount(1);
    await expect(grupos).toHaveText('C.A.P.');
    const tabla = page.locator('.un__table');
    await expect(tabla.getByText('E.T.A.', { exact: true })).toBeVisible();
    await expect(tabla.getByText('E.M.A.', { exact: true })).toBeVisible();
    await expect(tabla.getByText('B.A.I.', { exact: true })).toHaveCount(0);
  });

  test('gestionar una base abre el modal con su comando', async ({ page }) => {
    await abrirTab(page, 'Unidades');

    const fila = page.locator('.un__table tbody tr', { has: page.getByText('E.T.A.', { exact: true }) });
    await fila.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('heading', { level: 3, name: 'E.T.A. (C.A.P.)' })).toBeVisible();
    await expect(page.locator('.un__tab', { hasText: 'Usuarios del sistema' })).toBeVisible();
  });

  test('la lista de usuarios muestra las bases de cada cuenta', async ({ page }) => {
    await abrirTab(page, 'Usuarios');

    await page.getByLabel('Buscar por nombre o email').fill('supervisor.bai.eta');
    const fila = page.locator('.ur__table tbody tr', { hasText: 'supervisor.bai.eta@fau.mil.uy' });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });

    const columnaBases = fila.locator('td').nth(3);
    await expect(columnaBases).toContainText('B.A.I.');
    await expect(columnaBases).toContainText('E.T.A.');
  });

  test('el modal de edición ofrece las bases con su comando', async ({ page }) => {
    await abrirTab(page, 'Usuarios');

    await page.getByLabel('Buscar por nombre o email').fill('supervisor.bai.eta');
    const fila = page.locator('.ur__table tbody tr', { hasText: 'supervisor.bai.eta@fau.mil.uy' });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });
    await fila.getByRole('button', { name: 'Editar' }).click();

    await expect(page.getByRole('heading', { name: 'Editar Usuario' })).toBeVisible();
    const bases = page.locator('.modal__field', { hasText: 'Bases' }).locator('.appsel__control');
    await expect(bases).toHaveText(/B\.A\.I\. \(C\.A\.O\.\), E\.T\.A\. \(C\.A\.P\.\)/);

    // Solo se mira el desplegable: se cierra sin guardar.
    await bases.click();
    await expect(page.getByRole('option', { name: 'B.A.II. (C.A.O.)', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'E.M.A. (C.A.P.)', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Usuario' })).toHaveCount(0);
  });
});
