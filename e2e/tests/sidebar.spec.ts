import { expect, test, type Page } from '@playwright/test';

/**
 * El sidebar deja un solo grupo abierto: con todos abiertos la lista se
 * desborda. La sesión viene del `storageState` de playwright.config.ts.
 */
test.describe('sidebar', () => {
  const grupo = (page: Page, label: string) =>
    page.locator('app-sidebar .sidebar__item--trigger', { hasText: label });
  const abiertos = (page: Page) => page.locator('app-sidebar .sidebar__item--open');
  const subItems = (page: Page) => page.locator('app-sidebar .sidebar__sub--open');

  test('abrir un grupo cierra el que estaba abierto', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(grupo(page, 'Personal')).toBeVisible();
    await expect(abiertos(page)).toHaveCount(0);

    await grupo(page, 'Personal').click();
    await expect(abiertos(page)).toHaveCount(1);
    await expect(grupo(page, 'Personal')).toHaveClass(/sidebar__item--open/);

    await grupo(page, 'Ascensos').click();
    await expect(abiertos(page)).toHaveCount(1);
    await expect(grupo(page, 'Ascensos')).toHaveClass(/sidebar__item--open/);
    await expect(subItems(page)).toHaveCount(1);

    // Tocar el grupo abierto lo cierra y no deja ninguno.
    await grupo(page, 'Ascensos').click();
    await expect(abiertos(page)).toHaveCount(0);
  });

  test('abrir todos uno por uno deja solo el último abierto', async ({ page }) => {
    await page.goto('/dashboard');
    const triggers = page.locator('app-sidebar .sidebar__item--trigger');
    await expect(triggers.first()).toBeVisible();
    const total = await triggers.count();
    expect(total).toBeGreaterThan(1);

    for (let i = 0; i < total; i++) {
      await triggers.nth(i).click();
      await expect(abiertos(page)).toHaveCount(1);
      await expect(triggers.nth(i)).toHaveClass(/sidebar__item--open/);
    }
    // Los cerrados siguen en el DOM por la animación, pero inert: no se tabulan.
    await expect(page.locator('app-sidebar .sidebar__sub[inert]')).toHaveCount(total - 1);
  });

  test('entrar por URL abre el grupo de esa ruta y navegar a otro lo cambia', async ({ page }) => {
    await page.goto('/personal');
    await expect(grupo(page, 'Personal')).toHaveClass(/sidebar__item--open/);
    await expect(abiertos(page)).toHaveCount(1);

    await grupo(page, 'Ascensos').click();
    await page.locator('app-sidebar .sidebar__sub-item', { hasText: 'Pasibles de ascenso' }).click();
    await expect(page).toHaveURL(/\/ascensos-y-retiros\/pasibles/);
    await expect(grupo(page, 'Ascensos')).toHaveClass(/sidebar__item--open/);
    await expect(abiertos(page)).toHaveCount(1);
  });
});
