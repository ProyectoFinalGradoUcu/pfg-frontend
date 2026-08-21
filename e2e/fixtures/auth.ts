import { Page, expect } from '@playwright/test';


// Credenciales de un seed en desarrollo.
export const ADMIN_USER = {
  username: 'admin@fau.mil.uy',
  password: 'FAUadmin1!',
};

export const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json';

/** Login vía UI. Deja la página en /dashboard. */
export async function login(page: Page, user = ADMIN_USER): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(user.username);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
