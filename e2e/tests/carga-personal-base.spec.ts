import { expect, test } from '@playwright/test';
import { encabezados, leerWorkbook } from '../fixtures/excel';
import { cedulaUnica } from '../fixtures/personal';

/** La sesión del admin viene del `storageState` de playwright.config.ts. */
test.describe('carga masiva de personal con base', () => {
  test('la plantilla trae la columna Base y no Unidad ni Sub-unidad', async ({ page }) => {
    const res = await page.request.get('/api/personas/plantilla');
    expect(res.ok()).toBeTruthy();

    const wb = await leerWorkbook(await res.body());
    const titulos = encabezados(wb, 'Personal');
    expect(titulos).toContain('Base');
    expect(titulos).not.toContain('Unidad');
    expect(titulos).not.toContain('Sub-unidad');
    expect(titulos.filter((t) => /unidad/i.test(t))).toEqual([]);
  });

  test('una fila sin base da error y la otra se carga', async ({ page }) => {
    const res = await page.request.get('/api/personas/plantilla');
    const wb = await leerWorkbook(await res.body());
    const hoja = wb.getWorksheet('Personal');
    const columna = new Map(encabezados(wb, 'Personal').map((t, i) => [t, i + 1]));

    const fila = (cedula: string, base?: string) => ({
      'Cédula': cedula,
      'Primer nombre': 'Test',
      'Primer apellido': 'Carga Base',
      'Tipo de personal': 'Subalterno',
      'Régimen': 'Ley Nueva',
      ...(base ? { Base: base } : {}),
      'Programa': 'Programa 300',
      'Situación': 'Personal Subalterno en actividad.',
      'Escalafón': '(S.T.)',
      'Grado': 'Sgto.',
      'Fecha de ingreso': new Date(Date.UTC(2022, 2, 1)),
    });

    const conBase = cedulaUnica();
    const sinBase = cedulaUnica();
    [fila(conBase, 'E.T.A. (C.A.P.)'), fila(sinBase)].forEach((valores, i) => {
      const row = hoja.getRow(i + 2);
      for (const [titulo, valor] of Object.entries(valores)) row.getCell(columna.get(titulo)!).value = valor;
      row.commit();
    });
    const archivo = Buffer.from(await wb.xlsx.writeBuffer());

    await page.goto('/personal');
    await page.getByRole('button', { name: 'Importar' }).click();
    const modal = page.getByRole('dialog');
    await modal.locator('input[type=file]').setInputFiles({
      name: 'carga-personal.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: archivo,
    });
    await modal.getByRole('button', { name: 'Procesar archivo' }).click();

    await expect(modal.locator('.cm-summary__item--ok .cm-summary__num')).toHaveText('1', { timeout: 30_000 });
    await expect(modal.locator('.cm-summary__item--err .cm-summary__num')).toHaveText('1');

    const filas = modal.locator('.cm-table tbody tr');
    const conError = filas.filter({ hasText: sinBase });
    await expect(conError).toContainText('Error');
    await expect(conError.locator('.cm-table__msg')).toContainText('Base');

    // Con errores arranca mostrando solo esas filas.
    await modal.getByLabel('Mostrar solo las filas con error').uncheck();
    await expect(filas.filter({ hasText: conBase })).toContainText('OK');

    await modal.getByRole('button', { name: 'Listo' }).click();
    await page.getByLabel('Buscar por nombre o cédula').fill(conBase);
    const cargada = page.locator('tr.personal-page__row--clickable', { hasText: conBase });
    await expect(cargada.locator('td').nth(5)).toHaveText('E.T.A.', { timeout: 10_000 });
  });
});
