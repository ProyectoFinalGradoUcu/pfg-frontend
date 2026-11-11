import { Page, expect, test } from '@playwright/test';
import { login } from '../fixtures/auth';
import { SIN_SESION, USUARIOS, cedulaUnica, esperarPerfil } from '../fixtures/personal';

/** Elige una opción de un <select> nativo esperando a que el catálogo llegue. */
async function elegir(page: Page, id: string, etiqueta: string) {
  const select = page.locator(`#${id}`);
  await expect(select.locator('option', { hasText: etiqueta }).first()).toBeAttached({ timeout: 10_000 });
  await select.selectOption({ label: etiqueta });
}

test.describe('alta de personal con base', () => {
  test.use({ storageState: SIN_SESION });

  test('el formulario pide la base con su comando y no la unidad', async ({ page }) => {
    await login(page, USUARIOS.jefePersonal);
    await page.goto('/personal/nuevo');

    const base = page.locator('#sub_unidad_id');
    await expect(base).toBeVisible();
    await expect(page.locator('label[for=sub_unidad_id]')).toContainText('Base');
    await expect(page.locator('label[for=sub_unidad_id] .nf__req')).toHaveText('*');
    await expect(base.locator('option', { hasText: 'E.T.A. (C.A.P.)' })).toBeAttached({ timeout: 10_000 });
    await expect(base.locator('option', { hasText: 'B.A.I. (C.A.O.)' })).toBeAttached();
    await expect(page.locator('#unidad_id')).toHaveCount(0);

    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(base).toHaveClass(/nf__select--error/);
  });

  test('un usuario de B.A.I. solo puede elegir su base', async ({ page }) => {
    await login(page, USUARIOS.jefeBai);
    await page.goto('/personal/nuevo');

    const opciones = page.locator('#sub_unidad_id option');
    await expect(opciones).toHaveText(['Seleccionar...', 'B.A.I. (C.A.O.)'], { timeout: 10_000 });
  });

  test('el alta en E.T.A. queda con esa base en el perfil', async ({ page }) => {
    const cedula = cedulaUnica();
    await login(page, USUARIOS.jefePersonal);
    await page.goto('/personal/nuevo');

    await page.locator('#cedula').fill(cedula);
    await page.locator('#primer_nombre').fill('Test');
    await page.locator('#primer_apellido').fill('Alta Base');

    await page.locator('#tipo_funcionario').selectOption({ label: 'Subalterno' });
    await page.locator('#fecha_inicio').fill('2021-05-10');
    await elegir(page, 'regimen_id', 'Ley Nueva');
    await elegir(page, 'sub_unidad_id', 'E.T.A. (C.A.P.)');
    await elegir(page, 'escalafon_id', '(S.T.)');
    // El grado se habilita recién con el escalafón.
    await expect(page.locator('#grado_id')).toBeEnabled();
    await elegir(page, 'grado_id', 'Sgto.');
    await elegir(page, 'programa_id', 'Programa 300');
    await elegir(page, 'situacion_id', 'Personal Subalterno en actividad.');

    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/personal$/, { timeout: 15_000 });

    await page.getByLabel('Buscar por nombre o cédula').fill(cedula);
    const fila = page.locator('tr.personal-page__row--clickable', { hasText: cedula });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });
    await expect(fila.locator('td').nth(5)).toHaveText('E.T.A.');
    await fila.click();

    await esperarPerfil(page);
    const base = page.locator('.pd__field', { has: page.getByText('Base', { exact: true }) });
    await expect(base.locator('.pd__value')).toHaveText('E.T.A. (C.A.P.)');
  });
});
