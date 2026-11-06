import { expect, test } from '@playwright/test';
import { login } from '../fixtures/auth';
import { SIN_SESION, USUARIOS, apiAdmin, crearSubalternoEnBase, esperarPerfil, idPorCedula } from '../fixtures/personal';

/** Persona del seed que revista en B.A.II. */
const CEDULA_BA_II = '60000004';

test.describe('alcance por base', () => {
  test.use({ storageState: SIN_SESION });

  async function idDeBaII(): Promise<string> {
    const api = await apiAdmin();
    const id = await idPorCedula(api, CEDULA_BA_II);
    await api.dispose();
    return id;
  }

  test('un usuario de B.A.I. solo ve personal de su base', async ({ page }) => {
    await login(page, USUARIOS.jefeBai);
    await page.goto('/personal');

    await expect(page.locator('.topbar__alcance')).toHaveText('Viendo: B.A.I.');

    const filas = page.locator('tr.personal-page__row--clickable');
    await expect(filas.first()).toBeVisible({ timeout: 15_000 });
    const destinos = await filas.locator('td:nth-child(6)').allTextContents();
    expect(destinos.length).toBeGreaterThan(0);
    for (const destino of destinos) expect(destino.trim()).toBe('B.A.I.');

    // El filtro de destino queda fijo en su base.
    await expect(page.getByTitle('Solo podés ver el personal de tu unidad').getByRole('button').first()).toBeDisabled();
  });

  test('un usuario de B.A.I. no puede abrir el perfil de alguien de B.A.II.', async ({ page }) => {
    const idBaII = await idDeBaII();
    await login(page, USUARIOS.jefeBai);
    await page.goto(`/personal/${idBaII}`);

    await expect(page.getByText('Personal no encontrado')).toBeVisible();
    await expect(page).toHaveURL(/\/personal$/);
  });

  test('con dos bases se abre el perfil de una de ellas pero no el de otra', async ({ page }) => {
    // Se crean acá para no depender de los destinos que traiga el seed.
    const api = await apiAdmin();
    const { id: idEta } = await crearSubalternoEnBase(api, 'E.T.A.', 'Alcance Eta');
    const { id: idEma } = await crearSubalternoEnBase(api, 'E.M.A.', 'Alcance Ema');
    await api.dispose();

    await login(page, USUARIOS.supervisorBaiEta);

    await page.goto(`/personal/${idEta}`);
    await esperarPerfil(page);
    await expect(page.getByText('E.T.A. (C.A.P.)').first()).toBeVisible();

    await page.goto(`/personal/${idEma}`);
    await expect(page).toHaveURL(/\/personal$/);
  });

  test('con alcance global se ve a cualquiera y el filtro de destino está habilitado', async ({ page }) => {
    const idBaII = await idDeBaII();
    await login(page, USUARIOS.jefePersonal);
    await page.goto('/personal');

    await expect(page.locator('.topbar__alcance')).toHaveCount(0);
    const filtroDestino = page.getByRole('button', { name: 'Destino', exact: true });
    await expect(filtroDestino).toBeEnabled();

    await page.goto(`/personal/${idBaII}`);
    await esperarPerfil(page);
    await expect(page.getByText('B.A.II. (C.A.O.)').first()).toBeVisible();
  });
});
