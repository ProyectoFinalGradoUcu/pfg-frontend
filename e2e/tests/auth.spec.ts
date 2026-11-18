import { test, expect } from '@playwright/test';
import { ADMIN_USER } from '../fixtures/auth';

/**
 * Flujos de login. Sirven de plantilla para agregar specs de features:
 * selectores por rol y texto accesible, web-first assertions, sin timeouts fijos.
 */
test.describe('autenticación', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('rechaza credenciales inválidas', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(ADMIN_USER.username);
    await page.getByLabel('Contraseña').fill('passwordIncorrecta1!');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('protege las rutas privadas redirigiendo al login', async ({ page }) => {
    await page.goto('/misiones/catalogo');

    // authGuard manda al login con la ruta pedida en returnUrl, para volver ahí después.
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fmisiones%2Fcatalogo$/);
    await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeVisible();
  });

  test('login exitoso lleva al dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(ADMIN_USER.username);
    await page.getByLabel('Contraseña').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
