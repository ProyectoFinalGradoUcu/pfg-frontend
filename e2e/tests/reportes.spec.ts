import { Page, expect, test } from '@playwright/test';
import { encabezados } from '../fixtures/excel';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import { descargar, dia, esperarXlsxConDatos, leerApi, retirar } from '../fixtures/reportes';

type Parametro = { clave: string; etiqueta: string; tipo: string; requerido?: boolean };
type Reporte = { clave: string; titulo: string; parametros: Parametro[] };
type Fuente = { clave: string; titulo: string; columnas: { clave: string; etiqueta: string }[] };

const errores = (page: Page) => page.locator('.toast--error');
const seccion = (page: Page, titulo: string) =>
  page.locator('.tabla-bloque').filter({ has: page.locator('.tabla-bloque__titulo', { hasText: titulo }) });

async function generar(page: Page, url: string) {
  const respuesta = page.waitForResponse((r) => r.url().includes(url) && r.request().method() !== 'OPTIONS');
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  expect((await respuesta).ok()).toBeTruthy();
}

test.describe('reportes predefinidos', () => {
  test('la lista muestra los reportes que devuelve la API', async ({ page }) => {
    const api = await apiAdmin();
    const reportes = await leerApi<Reporte[]>(api, '/api/reportes');
    await api.dispose();
    expect(reportes.length).toBeGreaterThan(0);

    await page.goto('/reportes');
    await expect(page.locator('.reporte-card__titulo')).toHaveText(reportes.map((r) => r.titulo));

    await page.locator('.reporte-card', { hasText: reportes[0].titulo }).click();
    await expect(page).toHaveURL(new RegExp(`/reportes/${reportes[0].clave}$`));
    await expect(page.locator('.breadcrumb__item--current')).toHaveText(reportes[0].titulo);
  });

  test('cada reporte genera la vista previa y exporta un .xlsx válido', async ({ page }) => {
    test.setTimeout(180_000);
    const api = await apiAdmin();
    const reportes = await leerApi<Reporte[]>(api, '/api/reportes');
    await api.dispose();

    for (const reporte of reportes) {
      await test.step(reporte.titulo, async () => {
        await page.goto(`/reportes/${reporte.clave}`);
        await expect(page.getByRole('heading', { name: reporte.titulo, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Exportar a Excel' })).toBeDisabled();

        for (const p of reporte.parametros.filter((p) => p.requerido)) {
          const select = page.locator(`select#${p.clave}`);
          await expect(select.locator('option').nth(1)).toBeAttached();
          await select.selectOption({ index: 1 });
        }

        await generar(page, `/api/reportes/${reporte.clave}/preview`);
        await expect(page.locator('.tabla-bloque').first()).toBeVisible();
        await expect(errores(page)).toHaveCount(0);

        const { nombre, buffer } = await descargar(page, page.getByRole('button', { name: 'Exportar a Excel' }));
        expect(nombre).toBe(`${reporte.clave}.xlsx`);
        await esperarXlsxConDatos(buffer);
        await expect(errores(page)).toHaveCount(0);
      });
    }
  });

  test('un parámetro obligatorio vacío no deja generar', async ({ page }) => {
    const api = await apiAdmin();
    const reportes = await leerApi<Reporte[]>(api, '/api/reportes');
    await api.dispose();
    const reporte = reportes.find((r) => r.parametros.some((p) => p.requerido));
    test.skip(!reporte, 'Ningún reporte tiene parámetros obligatorios.');
    const requerido = reporte!.parametros.find((p) => p.requerido)!;

    await page.goto(`/reportes/${reporte!.clave}`);
    await page.getByRole('button', { name: 'Generar', exact: true }).click();
    await expect(errores(page)).toContainText(`Seleccioná o completá ${requerido.etiqueta}`);
    await expect(page.locator('.tabla-bloque')).toHaveCount(0);
  });

  test('una ruta de reporte que no existe avisa y no muestra filtros', async ({ page }) => {
    await page.goto('/reportes/no-existe-e2e');
    await expect(errores(page)).toContainText("Reporte 'no-existe-e2e' no encontrado");
    await expect(page.locator('.visor__filtros')).toHaveCount(0);
    await expect(page.locator('.breadcrumb__item--current')).toHaveText('Reporte');

    await page.locator('.breadcrumb__item--link', { hasText: 'Reportes' }).click();
    await expect(page).toHaveURL(/\/reportes$/);
  });
});

test.describe('altas, ascensos, bajas y retiros', () => {
  test.describe.configure({ mode: 'serial' });
  const URL_PREVIEW = '/api/reportes/movimientos-personal/preview';
  let altaCedula = '';
  let retiradoCedula = '';
  let retiroId = 0;
  const fechaRetiro = dia(-1);

  test.beforeAll(async () => {
    const api = await apiAdmin();
    altaCedula = (await crearSubalternoEnBase(api, 'E.T.A.', 'Alta Reporte E2E')).cedula;
    const retirado = await crearSubalternoEnBase(api, 'E.T.A.', 'Retiro Reporte E2E');
    retiradoCedula = retirado.cedula;
    retiroId = await retirar(api, retirado.id, fechaRetiro);
    await api.dispose();
  });

  test.afterAll(async () => {
    if (!retiroId) return;
    const api = await apiAdmin();
    await api.delete(`/api/retiros/${retiroId}`, {
      data: { service_request: { motivo_anulacion: 'Limpieza del test de reportes' } },
    });
    await api.dispose();
  });

  test('el subalterno nuevo aparece en altas y los filtros lo sacan', async ({ page }) => {
    await page.goto('/reportes/movimientos-personal');
    const altas = seccion(page, 'Altas por ingreso');

    // crearSubalternoEnBase lo da de alta el 2020-03-01.
    await page.locator('#desde').fill('2020-03-01');
    await page.locator('#hasta').fill('2020-03-01');
    await generar(page, URL_PREVIEW);
    await expect(altas.locator('tbody tr', { hasText: altaCedula })).toContainText('Alta por ingreso');
    await expect(altas.locator('tbody tr', { hasText: altaCedula })).toContainText('E.T.A.');

    await page.locator('#categoria').selectOption({ label: 'Solo oficiales' });
    await expect(page.locator('.tabla-bloque')).toHaveCount(0);
    await generar(page, URL_PREVIEW);
    await expect(altas).toBeVisible();
    await expect(altas.getByText(altaCedula)).toHaveCount(0);

    await page.locator('#categoria').selectOption({ label: 'Solo subalternos' });
    await generar(page, URL_PREVIEW);
    await expect(altas.getByText(altaCedula)).toBeVisible();

    await page.locator('#desde').fill('2019-01-01');
    await page.locator('#hasta').fill('2019-12-31');
    await generar(page, URL_PREVIEW);
    await expect(altas).toBeVisible();
    await expect(altas.getByText(altaCedula)).toHaveCount(0);
  });

  test('un retirado sale en retiros y no en bajas', async ({ page }) => {
    await page.goto('/reportes/movimientos-personal');
    await page.locator('#desde').fill(dia(-2));
    await page.locator('#hasta').fill(dia(1));
    await generar(page, URL_PREVIEW);

    await expect(seccion(page, 'Retiros').locator('tbody tr', { hasText: retiradoCedula })).toHaveCount(1);
    await expect(seccion(page, 'Bajas')).toBeVisible();
    await expect(seccion(page, 'Bajas').getByText(retiradoCedula)).toHaveCount(0);
  });

  test('el export trae una hoja por sección con el retirado solo en retiros', async ({ page }) => {
    await page.goto('/reportes/movimientos-personal');
    await page.locator('#desde').fill(dia(-2));
    await page.locator('#hasta').fill(dia(1));
    await generar(page, URL_PREVIEW);

    const { buffer } = await descargar(page, page.getByRole('button', { name: 'Exportar a Excel' }));
    const wb = await esperarXlsxConDatos(buffer);
    const nombres = wb.worksheets.map((w: { name: string }) => w.name);
    expect(nombres).toEqual(expect.arrayContaining(['1 · Altas por ingreso', '3 · Bajas', '4 · Retiros']));
    expect(encabezados(wb, '4 · Retiros')).toContain('C.I.');

    const cedulas = (hoja: string) => {
      const valores: string[] = [];
      wb.getWorksheet(hoja).eachRow((fila: { getCell(i: number): { value: unknown } }) => {
        valores.push(String(fila.getCell(1).value));
      });
      return valores;
    };
    expect(cedulas('4 · Retiros')).toContain(retiradoCedula);
    expect(cedulas('3 · Bajas')).not.toContain(retiradoCedula);
  });
});

test.describe('reporte personalizado', () => {
  const URL_PREVIEW = '/api/reportes/custom/preview';
  let fuentes: Fuente[] = [];

  test.beforeAll(async () => {
    const api = await apiAdmin();
    fuentes = await leerApi<Fuente[]>(api, '/api/reportes/custom/fuentes');
    await api.dispose();
  });

  test('cada fuente genera con todas sus columnas y exporta', async ({ page }) => {
    test.setTimeout(90_000);
    expect(fuentes.length).toBeGreaterThan(0);
    await page.goto('/reportes/personalizado');
    await expect(page.locator('#fuente option')).toHaveText(fuentes.map((f) => f.titulo));

    for (const fuente of fuentes) {
      await test.step(fuente.titulo, async () => {
        await page.locator('#fuente').selectOption(fuente.clave);
        await expect(page.locator('.columnas input[type=checkbox]')).toHaveCount(fuente.columnas.length);
        await generar(page, URL_PREVIEW);
        await expect(page.locator('.tabla thead th')).toHaveText(fuente.columnas.map((c) => c.etiqueta));
        await expect(errores(page)).toHaveCount(0);

        const { nombre, buffer } = await descargar(page, page.getByRole('button', { name: 'Exportar a Excel' }));
        expect(nombre).toBe(`${fuente.clave}-personalizado.xlsx`);
        const wb = await esperarXlsxConDatos(buffer);
        expect(encabezados(wb, wb.worksheets[0].name)).toEqual(fuente.columnas.map((c) => c.etiqueta));
      });
    }
  });

  test('con dos columnas elegidas el preview y el Excel traen solo esas', async ({ page }) => {
    const fuente = fuentes[0];
    const elegidas = fuente.columnas.slice(0, 2).map((c) => c.etiqueta);
    await page.goto('/reportes/personalizado');
    await page.locator('#fuente').selectOption(fuente.clave);
    for (const col of fuente.columnas.slice(2)) {
      await page.locator('label.check', { hasText: col.etiqueta }).getByRole('checkbox').uncheck();
    }

    await generar(page, URL_PREVIEW);
    await expect(page.locator('.tabla thead th')).toHaveText(elegidas);

    const { buffer } = await descargar(page, page.getByRole('button', { name: 'Exportar a Excel' }));
    const wb = await esperarXlsxConDatos(buffer);
    expect(encabezados(wb, wb.worksheets[0].name)).toEqual(elegidas);
  });

  test('sin columnas no deja generar', async ({ page }) => {
    await page.goto('/reportes/personalizado');
    const checks = page.locator('.columnas input[type=checkbox]');
    await expect(checks.first()).toBeVisible();
    for (const check of await checks.all()) await check.uncheck();
    await page.getByRole('button', { name: 'Generar', exact: true }).click();
    await expect(errores(page)).toContainText('Elegí al menos una columna');
    await expect(page.getByRole('button', { name: 'Exportar a Excel' })).toBeDisabled();
  });

  // Falla: el export usa las columnas tildadas en ese momento, no las del preview que se está viendo.
  test.fixme('cambiar columnas después de generar no cambia lo que se exporta', async ({ page }) => {
    const fuente = fuentes[0];
    await page.goto('/reportes/personalizado');
    await page.locator('#fuente').selectOption(fuente.clave);
    await generar(page, URL_PREVIEW);
    const delPreview = await page.locator('.tabla thead th').allTextContents();

    await page.locator('label.check', { hasText: fuente.columnas[0].etiqueta }).getByRole('checkbox').uncheck();
    const { buffer } = await descargar(page, page.getByRole('button', { name: 'Exportar a Excel' }));
    const wb = await esperarXlsxConDatos(buffer);
    expect(encabezados(wb, wb.worksheets[0].name)).toEqual(delPreview.map((t) => t.trim()));
  });
});
