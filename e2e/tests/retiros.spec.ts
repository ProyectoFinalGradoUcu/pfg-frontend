import { expect, test } from '@playwright/test';

/** La sesión viene del `storageState` de playwright.config.ts. */
test.describe('retiros', () => {
  test('el listado muestra el padrón y suma los anulados con el checkbox', async ({ page }) => {
    await page.goto('/retiros');

    await expect(page.getByRole('heading', { name: 'Retiros' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Funcionarios retirados' })).toBeVisible();

    await expect(page.locator('.retiros__row--anulada')).toHaveCount(0);
    await page.getByText('Incluir anulados').click();
    await expect(page.locator('.retiros__row--anulada').first()).toBeVisible({ timeout: 10_000 });
  });

  test('el detalle de un retiro abre con deep link y aguanta recarga', async ({ page }) => {
    await page.goto('/retiros');
    await page.getByText('Incluir anulados').click();

    // Esperar la recarga antes de contar: si no, se cuentan las filas viejas.
    const filas = page.locator('.retiros__row');
    const vacio = page.getByText('No hay retiros que coincidan con los filtros.');
    await expect(filas.first().or(vacio)).toBeVisible({ timeout: 10_000 });
    test.skip(await vacio.isVisible(), 'No hay retiros cargados en la base de desarrollo.');

    await filas.first().click();
    await expect(page).toHaveURL(/\/retiros\/\d+$/);

    await expect(page.getByText('Grado y unidad al momento del retiro')).toBeVisible();

    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { name: 'Datos del retiro' })).toBeVisible();
  });

  test('el wizard pide la previa recién cuando hay fecha y muestra el impacto', async ({ page }) => {
    await page.goto('/retiros');

    // `isVisible()` no auto-espera: sin esto el skip salta por una carrera.
    await expect(page.getByRole('heading', { name: 'Retiros' })).toBeVisible();

    const abrir = page.getByRole('button', { name: 'Registrar retiro' });
    test.skip((await abrir.count()) === 0, 'El usuario no tiene permiso retiros.registrar.');
    await abrir.click();

    // Hay varios app-select en pantalla: se apunta al del modal por su placeholder.
    const selector = page.getByRole('button', { name: 'Seleccione personal' });
    await expect(selector).toBeVisible();
    await expect(page.getByText('Cargando personal...')).toHaveCount(0, { timeout: 15_000 });
    await selector.click();

    const opciones = page.locator('.appsel__option');
    await expect(opciones.first()).toBeVisible({ timeout: 10_000 });
    await opciones.first().click();

    await expect(page.getByText('Elegí una fecha para ver qué se cerraría.')).toBeVisible();

    await page.getByLabel('Fecha de retiro').fill('2026-01-15');

    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await page.getByLabel('Motivo *').selectOption({ index: 1 });

    // Con la fecha aparece el impacto o los bloqueos: las dos son válidas.
    const impacto = page.getByRole('heading', { name: 'Qué se cierra con este retiro' });
    const bloqueado = page.getByText('No se puede registrar este retiro:');
    await expect(impacto.or(bloqueado)).toBeVisible({ timeout: 10_000 });

    if (await bloqueado.isVisible()) {
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      return;
    }

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Esto cierra una carrera.')).toBeVisible();
  });
});
