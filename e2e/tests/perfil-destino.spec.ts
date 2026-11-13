import { expect, test } from '@playwright/test';
import { apiAdmin, crearSubalternoEnBase, esperarPerfil } from '../fixtures/personal';

/** La sesión del admin viene del `storageState` de playwright.config.ts. */
test.describe('base en el perfil y registro de destino', () => {
  test('la base no se edita en el perfil: se cambia registrando un destino', async ({ page }) => {
    const api = await apiAdmin();
    const { id, cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Perfil Destino');
    await api.dispose();

    await page.goto(`/personal/${id}`);
    await esperarPerfil(page);

    const base = page.locator('.pd__field', { has: page.getByText('Base', { exact: true }) });
    await expect(base.locator('.pd__value')).toHaveText('E.T.A. (C.A.P.)');

    await page.getByRole('button', { name: 'Editar Perfil' }).click();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    await expect(page.locator('[formcontrolname=sub_unidad_id]')).toHaveCount(0);
    await expect(base.getByText('La base no se edita acá')).toBeVisible();

    await base.getByRole('button', { name: 'Registrar destino' }).click();

    // La persona viene puesta desde el perfil y no se puede cambiar.
    const modal = page.locator('app-destino-form-modal');
    await expect(modal.getByRole('heading', { name: 'Registrar destino' })).toBeVisible();
    await expect(modal.locator('.destino-form__persona')).toContainText(cedula);
    await expect(modal.getByRole('button', { name: 'Cambiar' })).toHaveCount(0);
    await expect(modal.getByText('Este registro es un pase')).toBeVisible({ timeout: 10_000 });

    await modal.locator('.appsel__control').click();
    await modal.getByRole('option', { name: 'B.A.I. (C.A.O.)', exact: true }).click();
    await modal.locator('[formcontrolname=fecha_inicio]').fill('2025-02-01');
    await modal.locator('[formcontrolname=numero_orden]').fill(`O.D. ${cedula}`);
    await modal.getByRole('button', { name: 'Registrar destino' }).click();

    await expect(page.getByText('Destino registrado', { exact: true })).toBeVisible();
    await expect(modal).toHaveCount(0);
    await expect(base.locator('.pd__value')).toHaveText('B.A.I. (C.A.O.)');
  });
});
