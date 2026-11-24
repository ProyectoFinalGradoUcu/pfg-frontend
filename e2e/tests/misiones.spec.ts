import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import {
  asignaciones,
  asignar,
  borrarMision,
  convocatorias,
  crearConvocatoria,
  elegir,
  leerConvocatoria,
  leerMision,
  misionPorNombre,
  quitar,
  totalPersonalEnMision,
} from '../fixtures/misiones';
import { esperarFecha, llenarFecha } from '../fixtures/fechas';

test.describe.configure({ mode: 'serial' });
// Alto de sobra: el menú ⋯ de las filas de abajo se abre fuera de la pantalla.
test.use({ viewport: { width: 1400, height: 1400 } });

const SUF = Date.now().toString(36);
const NOMBRE = `E2E Misión ${SUF}`;
const ORDEN = `ORD-${SUF}`;
const ORDEN_FIN = `FIN-${SUF}`;

let api: APIRequestContext;
let misionId: string | undefined;
let convId: string;
let convFinId: string;
let uno: { id: string; cedula: string };
let dos: { id: string; cedula: string };

const modal = (page: Page) => page.locator('.modal__card');
const campo = (scope: Locator, nombre: string) => scope.locator(`[formcontrolname="${nombre}"]`);
const fila = (page: Page, texto: string) => page.locator('tbody tr', { hasText: texto });

async function menu(page: Page, filaLocator: Locator, opcion: string) {
  await filaLocator.getByRole('button', { name: 'Acciones' }).click();
  await page
    .locator('.misiones__dropdown, .convs__dropdown, .detalle__dropdown')
    .getByRole('button', { name: opcion, exact: true })
    .click();
}

async function abrirCatalogoFiltrado(page: Page) {
  await page.goto('/misiones/catalogo');
  await page.getByPlaceholder('Nombre de la misión...').fill(NOMBRE);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(fila(page, NOMBRE)).toBeVisible();
}

async function abrirDetalle(page: Page) {
  await page.goto(`/misiones/catalogo/${misionId}/convocatorias/${convId}`);
  await expect(page.getByRole('heading', { name: 'Datos de la Convocatoria' })).toBeVisible();
}

test.beforeAll(async () => {
  api = await apiAdmin();
  uno = await crearSubalternoEnBase(api, 'E.T.A.', `MisE2E ${SUF} Uno`);
  dos = await crearSubalternoEnBase(api, 'E.T.A.', `MisE2E ${SUF} Dos`);
});

test.afterAll(async () => {
  await borrarMision(api, misionId ?? (await misionPorNombre(api, NOMBRE))?.id);
  await api.dispose();
});

test.describe('catálogo', () => {
  test('crea una misión con todos los datos', async ({ page }) => {
    await page.goto('/misiones/catalogo');
    await page.getByRole('button', { name: 'Nueva Misión' }).click();
    const m = modal(page);
    await campo(m, 'nombre_mision').fill(NOMBRE);
    await elegir(page, campo(m, 'pais'), 'Chipre');
    await llenarFecha(campo(m, 'fecha_orden'), '2026-01-10');
    await campo(m, 'boletin').fill(`R-${SUF}`);
    await llenarFecha(campo(m, 'fecha_boletin'), '2026-01-12');
    await campo(m, 'resolucion_cje').fill(`CJE-${SUF}`);
    await m.getByRole('button', { name: 'Crear Misión' }).click();

    await expect(page.getByText(`Misión "${NOMBRE}" creada correctamente`)).toBeVisible();
    await expect(m).toHaveCount(0);

    const creada = await misionPorNombre(api, NOMBRE);
    expect(creada).toBeTruthy();
    misionId = creada!.id;
    expect(creada).toMatchObject({
      pais: 'Chipre',
      fecha_orden: '2026-01-10',
      boletin: `R-${SUF}`,
      fecha_boletin: '2026-01-12',
      resolucion_cje: `CJE-${SUF}`,
      total_convocatorias: 0,
    });

    await page.getByPlaceholder('Nombre de la misión...').fill(NOMBRE);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(fila(page, NOMBRE)).toContainText('Chipre');
  });

  test('el nombre y el país son obligatorios', async ({ page }) => {
    await page.goto('/misiones/catalogo');
    await page.getByRole('button', { name: 'Nueva Misión' }).click();
    const m = modal(page);
    await campo(m, 'nombre_mision').fill(`${NOMBRE} sin país`);
    await m.getByRole('button', { name: 'Crear Misión' }).click();
    await expect(m.locator('.modal__error')).toHaveText('Completá todos los campos requeridos');
    await m.getByRole('button', { name: 'Cancelar' }).click();
    await expect(m).toHaveCount(0);
    expect(await misionPorNombre(api, `${NOMBRE} sin país`)).toBeUndefined();
  });

  test('editar y vaciar los campos opcionales los deja en null', async ({ page }) => {
    await abrirCatalogoFiltrado(page);
    await menu(page, fila(page, NOMBRE), 'Editar');
    const m = modal(page);
    await expect(m.getByRole('heading', { name: 'Editar Misión' })).toBeVisible();
    await esperarFecha(campo(m, 'fecha_orden'), '2026-01-10');
    await expect(campo(m, 'resolucion_cje')).toHaveValue(`CJE-${SUF}`);

    for (const c of ['fecha_orden', 'fecha_boletin']) await llenarFecha(campo(m, c), '');
    for (const c of ['boletin', 'resolucion_cje']) await campo(m, c).fill('');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Misión actualizada correctamente')).toBeVisible();

    expect(await leerMision(api, misionId!)).toMatchObject({
      nombre_mision: NOMBRE,
      pais: 'Chipre',
      fecha_orden: null,
      boletin: null,
      fecha_boletin: null,
      resolucion_cje: null,
    });
  });

  test('la fila lleva al detalle de la misión', async ({ page }) => {
    await abrirCatalogoFiltrado(page);
    await fila(page, NOMBRE).locator('td').first().click();
    await expect(page).toHaveURL(new RegExp(`/misiones/catalogo/${misionId}$`));
    await expect(page.getByRole('heading', { name: NOMBRE })).toBeVisible();
    await expect(page.getByText('Esta misión todavía no tiene convocatorias registradas')).toBeVisible();
  });
});

test.describe('convocatorias', () => {
  test('no acepta llegada anterior a la salida ni falta de orden y resolución', async ({ page }) => {
    await page.goto(`/misiones/catalogo/${misionId}`);
    await page.getByRole('button', { name: 'Nueva Convocatoria' }).click();
    const m = modal(page);

    await llenarFecha(campo(m, 'fecha_salida'), '2026-05-10');
    await m.getByRole('button', { name: 'Crear Convocatoria' }).click();
    await expect(m.locator('.modal__error')).toHaveText('Debés ingresar al menos el N° de orden o la resolución.');

    await campo(m, 'numero_orden').fill(ORDEN);
    await llenarFecha(campo(m, 'fecha_llegada'), '2026-05-01');
    await m.getByRole('button', { name: 'Crear Convocatoria' }).click();
    await expect(m.locator('.modal__error')).toHaveText('La fecha de llegada no puede ser anterior a la fecha de salida');
    expect(await convocatorias(api, misionId!)).toHaveLength(0);
  });

  test('crea una convocatoria', async ({ page }) => {
    await page.goto(`/misiones/catalogo/${misionId}`);
    await page.getByRole('button', { name: 'Nueva Convocatoria' }).click();
    const m = modal(page);
    await campo(m, 'numero_orden').fill(ORDEN);
    await campo(m, 'boletin').fill(`BOL-${SUF}`);
    await llenarFecha(campo(m, 'fecha_salida'), '2026-05-10');
    await llenarFecha(campo(m, 'fecha_llegada'), '2099-05-20');
    await campo(m, 'observaciones').fill('Obs E2E');
    await m.getByRole('button', { name: 'Crear Convocatoria' }).click();

    await expect(page.getByText('Convocatoria creada correctamente')).toBeVisible();
    const r = fila(page, ORDEN);
    await expect(r).toContainText(`BOL-${SUF}`);
    await expect(r).toContainText('10/5/2026');
    await expect(r).toContainText('20/5/2099');
    await expect(r).toContainText('Activa');

    const lista = await convocatorias(api, misionId!);
    expect(lista).toHaveLength(1);
    convId = lista[0].id;
    expect(lista[0]).toMatchObject({ boletin: `BOL-${SUF}`, observaciones: 'Obs E2E', fecha_salida: '2026-05-10' });
  });

  test('el listado filtra por orden y por estado', async ({ page }) => {
    convFinId = (
      await crearConvocatoria(api, misionId!, {
        numero_orden: ORDEN_FIN,
        fecha_salida: '2020-01-01',
        fecha_llegada: '2020-02-01',
      })
    ).id;
    await page.goto(`/misiones/catalogo/${misionId}`);
    const filas = page.locator('tbody tr');
    await expect(filas).toHaveCount(2);

    await page.getByPlaceholder('N° orden o resolución...').fill(ORDEN_FIN);
    await expect(filas).toHaveCount(1);
    await expect(fila(page, ORDEN_FIN)).toContainText('Finalizada');
    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(filas).toHaveCount(2);

    const estado = page.locator('select.convs__estado-select');
    await estado.selectOption('finalizada');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(ORDEN_FIN);
    await estado.selectOption('activa');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(ORDEN);
  });

  test('el texto y el estado se combinan', async ({ page }) => {
    // Con texto y "Activa" el backend arma un OR y aparecen las finalizadas que coinciden.
    test.fixme(true, 'texto + finalizada=false combina con OR en el listado de convocatorias');
    await page.goto(`/misiones/catalogo/${misionId}`);
    await page.getByPlaceholder('N° orden o resolución...').fill(ORDEN_FIN);
    await page.locator('select.convs__estado-select').selectOption('activa');
    await expect(page.getByText('No se encontraron convocatorias con esos filtros')).toBeVisible();
  });

  test('editar desde el listado vacía la fecha de llegada y las observaciones', async ({ page }) => {
    const tmp = await crearConvocatoria(api, misionId!, {
      boletin: `TMP-${SUF}`,
      fecha_salida: '2026-06-01',
      fecha_llegada: '2026-06-30',
      observaciones: 'Temporal',
    });
    await page.goto(`/misiones/catalogo/${misionId}`);
    await menu(page, fila(page, `TMP-${SUF}`), 'Editar');
    const m = modal(page);
    await esperarFecha(campo(m, 'fecha_llegada'), '2026-06-30');
    await llenarFecha(campo(m, 'fecha_llegada'), '');
    await campo(m, 'observaciones').fill('');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Convocatoria actualizada correctamente')).toBeVisible();
    expect(await leerConvocatoria(api, misionId!, tmp.id)).toMatchObject({
      fecha_llegada: null,
      observaciones: null,
      finalizada: false,
    });

    await menu(page, fila(page, `TMP-${SUF}`), 'Eliminar');
    await page.locator('.modal__card').getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Convocatoria eliminada')).toBeVisible();
    await expect(fila(page, `TMP-${SUF}`)).toHaveCount(0);
  });
});

test.describe('detalle de la convocatoria', () => {
  test('asigna un funcionario elegido en el selector', async ({ page }) => {
    await abrirDetalle(page);
    await page.getByRole('button', { name: 'Asignar Funcionario' }).click();
    const m = modal(page);
    await elegir(page, campo(m, 'persona_id'), `Test MisE2E ${SUF} Uno · CI ${uno.cedula}`, `MisE2E ${SUF} Uno`);
    await campo(m, 'numero_orden').fill(ORDEN);
    await m.getByRole('button', { name: 'Asignar funcionario' }).click();
    await expect(page.getByText('Funcionario asignado correctamente')).toBeVisible();
    await expect(fila(page, uno.cedula)).toContainText(ORDEN);
    // Los tests siguientes arrancan con la convocatoria vacía.
    await quitar(api, misionId!, convId, uno.id);
  });

  test('pide orden o resolución al asignar', async ({ page }) => {
    await abrirDetalle(page);
    await page.getByRole('button', { name: 'Asignar Funcionario' }).click();
    const m = modal(page);
    await campo(m, 'persona_id').locator('.appsel__control').click();
    await page.locator('.appsel__dropdown .appsel__option').first().click();
    await m.getByRole('button', { name: 'Asignar funcionario' }).click();
    await expect(m.locator('.modal__error')).toHaveText('Debés ingresar al menos el N° de orden o la resolución.');
    await m.getByRole('button', { name: 'Cancelar' }).click();
    expect(await asignaciones(api, misionId!, convId)).toHaveLength(0);
  });

  test('editar la asignación vacía resolución y observaciones', async ({ page }) => {
    await asignar(api, misionId!, convId, uno.id, { numero_orden: ORDEN, boletin: `B-${SUF}`, observaciones: 'Obs uno' });
    await asignar(api, misionId!, convId, dos.id, { numero_orden: ORDEN });
    await abrirDetalle(page);
    const r = fila(page, uno.cedula);
    await expect(r).toContainText('Obs uno');

    await menu(page, r, 'Editar');
    const m = modal(page);
    await expect(campo(m, 'boletin')).toHaveValue(`B-${SUF}`);
    await campo(m, 'boletin').fill('');
    await campo(m, 'observaciones').fill('');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Funcionario actualizado correctamente')).toBeVisible();
    await expect(r).not.toContainText('Obs uno');

    const a = (await asignaciones(api, misionId!, convId)).find((x) => x.persona_id === uno.id);
    expect(a).toMatchObject({ numero_orden: ORDEN, boletin: null, observaciones: null });
  });

  test('busca funcionarios por cédula', async ({ page }) => {
    await abrirDetalle(page);
    const filas = page.locator('tbody tr');
    await expect(filas).toHaveCount(2);
    await page.getByPlaceholder('Buscar por nombre o cédula...').fill(dos.cedula);
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(dos.cedula);
  });

  test('quita un funcionario', async ({ page }) => {
    await abrirDetalle(page);
    await menu(page, fila(page, uno.cedula), 'Quitar');
    await page.locator('.modal__card').getByRole('button', { name: 'Quitar' }).click();
    await expect(page.getByText('Funcionario removido')).toBeVisible();
    await expect(fila(page, uno.cedula)).toHaveCount(0);
    await expect(fila(page, dos.cedula)).toBeVisible();
    expect((await asignaciones(api, misionId!, convId)).map((a) => a.persona_id)).toEqual([dos.id]);
  });

  test('editar los datos vacía resolución y observaciones', async ({ page }) => {
    await abrirDetalle(page);
    await page.locator('.detalle__section-header').getByRole('button', { name: 'Editar' }).click();
    const m = modal(page);
    await expect(campo(m, 'observaciones')).toHaveValue('Obs E2E');
    await campo(m, 'boletin').fill('');
    await campo(m, 'observaciones').fill('');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Convocatoria actualizada correctamente')).toBeVisible();

    const datosCard = page.locator('.detalle__info-grid');
    await expect(datosCard.locator('.detalle__info-field', { hasText: 'Resolución' })).toContainText('—');
    await expect(datosCard.locator('.detalle__info-field', { hasText: 'Observaciones' })).toContainText('—');
    expect(await leerConvocatoria(api, misionId!, convId)).toMatchObject({
      numero_orden: ORDEN,
      boletin: null,
      observaciones: null,
    });
  });

  test('la ruta aguanta recarga', async ({ page }) => {
    await abrirDetalle(page);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/misiones/catalogo/${misionId}/convocatorias/${convId}$`));
    await expect(page.getByRole('heading', { name: `${NOMBRE} — Convocatoria` })).toBeVisible();
  });
});

test.describe('personal en misión', () => {
  test('filtra por misión, texto, orden y estado', async ({ page }) => {
    await asignar(api, misionId!, convFinId, uno.id, { numero_orden: ORDEN_FIN });
    await page.goto('/misiones/personal');
    await expect(page.getByRole('heading', { name: 'Personal en Misión' })).toBeVisible();

    await elegir(page, page.locator('app-select.misiones__filter-select'), NOMBRE);
    await page.keyboard.press('Escape');
    const filas = page.locator('tbody tr');
    await expect(filas).toHaveCount(2);
    await expect(fila(page, uno.cedula)).toContainText('Finalizada');
    await expect(fila(page, dos.cedula)).toContainText('Activa');

    const estado = page.locator('select.misiones__def-tipo-select').first();
    await estado.selectOption('finalizada');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(uno.cedula);
    await estado.selectOption('activa');
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(dos.cedula);
    await estado.selectOption('');
    await expect(filas).toHaveCount(2);

    await page.getByPlaceholder('N° orden o resolución...').fill(ORDEN_FIN);
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(uno.cedula);
    await page.getByPlaceholder('N° orden o resolución...').fill('');
    await expect(filas).toHaveCount(2);

    await page.getByPlaceholder('Cédula o nombre...').fill(dos.cedula);
    await expect(filas).toHaveCount(1);
    await expect(filas.first()).toContainText(NOMBRE);

    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(page.getByPlaceholder('Cédula o nombre...')).toHaveValue('');
    await expect(page.locator('app-select.misiones__filter-select .appsel__placeholder')).toBeVisible();
  });

  test('pagina de a 10', async ({ page }) => {
    const total = await totalPersonalEnMision(api);
    expect(total).toBeGreaterThan(10);
    await page.goto('/misiones/personal');
    const filas = page.locator('tbody tr');
    await expect(filas).toHaveCount(10);
    await expect(page.locator('.paginator__range')).toHaveText(new RegExp(`Mostrando\\s*1–10\\s*de\\s*${total}`));
    const primera = await filas.first().textContent();

    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(page.locator('.paginator__range')).toHaveText(new RegExp(`Mostrando\\s*11–${Math.min(20, total)}\\s*de`));
    await expect(filas).toHaveCount(Math.min(10, total - 10));
    expect(await filas.first().textContent()).not.toBe(primera);
  });

  test('editar la asignación cambia las observaciones', async ({ page }) => {
    await page.goto('/misiones/personal');
    await page.getByPlaceholder('Cédula o nombre...').fill(dos.cedula);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await menu(page, fila(page, dos.cedula), 'Editar');
    const m = modal(page);
    await campo(m, 'boletin').fill(`BP-${SUF}`);
    await campo(m, 'observaciones').fill('Obs personal');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Funcionario actualizado correctamente')).toBeVisible();
    await expect(fila(page, dos.cedula)).toContainText(`BP-${SUF}`);

    const a = (await asignaciones(api, misionId!, convId)).find((x) => x.persona_id === dos.id);
    expect(a).toMatchObject({ boletin: `BP-${SUF}`, observaciones: 'Obs personal' });
  });

  test('editar la asignación vacía observaciones y resolución', async ({ page }) => {
    // Manda undefined en vez de null y el backend deja el valor anterior.
    test.fixme(true, 'en Personal en misión › Editar no se pueden vaciar Observaciones ni Resolución');
    await page.goto('/misiones/personal');
    await page.getByPlaceholder('Cédula o nombre...').fill(dos.cedula);
    await menu(page, fila(page, dos.cedula), 'Editar');
    const m = modal(page);
    await campo(m, 'boletin').fill('');
    await campo(m, 'observaciones').fill('');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Funcionario actualizado correctamente')).toBeVisible();
    const a = (await asignaciones(api, misionId!, convId)).find((x) => x.persona_id === dos.id);
    expect(a).toMatchObject({ boletin: null, observaciones: null });
  });

  test('quita una asignación', async ({ page }) => {
    await page.goto('/misiones/personal');
    await page.getByPlaceholder('Cédula o nombre...').fill(uno.cedula);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await menu(page, fila(page, uno.cedula), 'Eliminar');
    await page.locator('.modal__card').getByRole('button', { name: 'Quitar' }).click();
    await expect(page.getByText('Funcionario removido de la convocatoria')).toBeVisible();
    await expect(page.getByText('No se encontraron resultados con esos filtros')).toBeVisible();
    expect(await asignaciones(api, misionId!, convFinId)).toHaveLength(0);
  });
});

test.describe('navegación', () => {
  test('una misión inexistente vuelve al catálogo', async ({ page }) => {
    await page.goto('/misiones/catalogo/999999999');
    await expect(page).toHaveURL(/\/misiones\/catalogo$/);
    await expect(page.getByRole('heading', { name: 'Catálogo de Misiones' })).toBeVisible();
  });

  test('una convocatoria inexistente vuelve a la misión', async ({ page }) => {
    await page.goto(`/misiones/catalogo/${misionId}/convocatorias/999999999`);
    await expect(page).toHaveURL(new RegExp(`/misiones/catalogo/${misionId}$`));
    await expect(page.getByRole('heading', { name: NOMBRE })).toBeVisible();
  });
});

test.describe('baja', () => {
  test('eliminar la misión avisa y borra sus convocatorias', async ({ page }) => {
    await abrirCatalogoFiltrado(page);
    await menu(page, fila(page, NOMBRE), 'Eliminar');
    const m = modal(page);
    await expect(m.locator('.modal__warning')).toContainText('tiene convocatorias registradas');
    await m.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText(`Misión "${NOMBRE}" eliminada`)).toBeVisible();
    await expect(page.getByText('No se encontraron misiones con esos filtros')).toBeVisible();

    expect((await api.get(`/api/misiones/${misionId}`)).status()).toBe(404);
    expect((await api.get(`/api/misiones/${misionId}/convocatorias/${convId}`)).status()).toBe(404);
    misionId = undefined;
  });
});
