import { Page, expect, test } from '@playwright/test';
import { elegir } from '../fixtures/misiones';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';

const toast = (page: Page, texto: string | RegExp) => page.locator('.toast__message', { hasText: texto });
const modal = (page: Page) => page.locator('app-destino-form-modal');
const filas = (page: Page) => page.locator('.asignaciones__table tbody tr', { has: page.locator('.asignaciones__badge') });
const fila = (page: Page, base: string) => filas(page).filter({ has: page.getByRole('cell', { name: new RegExp(`^${base.replace(/\./g, '\\.')}`) }) });

// Subalterno nuevo con destino en E.T.A. desde el 1/3/2020.
async function nuevoSubalterno(apellido: string) {
  const api = await apiAdmin();
  const persona = await crearSubalternoEnBase(api, 'E.T.A.', apellido);
  await api.dispose();
  return persona;
}

async function buscar(page: Page, cedula: string) {
  await page.getByPlaceholder('Cédula, nombre o apellido...').fill(cedula);
  await expect(filas(page).first()).toContainText(cedula, { timeout: 10_000 });
}

async function abrirRegistro(page: Page, cedula: string) {
  await page.getByRole('button', { name: 'Registrar destino' }).click();
  await modal(page).getByPlaceholder('Buscar por cédula, nombre o apellido...').fill(cedula);
  await modal(page).locator('.destino-form__resultados li', { hasText: cedula }).click();
  await expect(modal(page).getByText('Este registro es un pase')).toBeVisible({ timeout: 10_000 });
}

async function accion(page: Page, base: string, nombre: string) {
  await fila(page, base).getByRole('button', { name: 'Acciones' }).click();
  await page.locator('.asignaciones__menu').getByRole('button', { name: nombre }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/destinos/asignaciones');
  await expect(page.getByRole('heading', { name: 'Asignaciones' })).toBeVisible();
});

test.describe('registrar un pase', () => {
  test('cierra el destino anterior el día previo y queda en el historial', async ({ page }) => {
    const { cedula } = await nuevoSubalterno('Pase Asignaciones');
    await abrirRegistro(page, cedula);

    const m = modal(page);
    await expect(m.locator('.destino-form__pase')).toContainText('Sale de E.T.A.');
    await elegir(page, m.locator('app-select'), 'E.M.A. (C.A.P.)', 'E.M.A.');
    await m.locator('[formcontrolname=fecha_inicio]').fill('2025-02-01');
    await expect(m.locator('.destino-form__pase')).toContainText('Ese destino se cerrará el 2025-01-31');
    await m.locator('[formcontrolname=posicion_destino]').fill('Jefe de sección');

    await m.getByRole('button', { name: 'Registrar destino' }).click();
    await expect(m.locator('.modal__error')).toHaveText('Ingresá al menos el N° de orden o el boletín.');

    await m.locator('[formcontrolname=numero_orden]').fill(`O.D. ${cedula}`);
    await m.getByRole('button', { name: 'Registrar destino' }).click();
    await expect(toast(page, 'Destino registrado correctamente')).toBeVisible();
    await expect(m).toHaveCount(0);

    await buscar(page, cedula);
    await expect(filas(page)).toHaveCount(2);
    await expect(fila(page, 'E.M.A.')).toContainText('Jefe de sección');
    await expect(fila(page, 'E.M.A.')).toContainText('1/2/2025');
    await expect(fila(page, 'E.M.A.')).toContainText('Vigente');
    await expect(fila(page, 'E.T.A.')).toContainText('31/1/2025');
    await expect(fila(page, 'E.T.A.')).toContainText('Cerrado');
  });

  test('no acepta la misma base ni cerrar el anterior después del nuevo inicio', async ({ page }) => {
    const { cedula } = await nuevoSubalterno('Pase Invalido');
    await abrirRegistro(page, cedula);
    const m = modal(page);

    await elegir(page, m.locator('app-select'), 'E.T.A. (C.A.P.)', 'E.T.A.');
    await expect(m.getByText('Ya revista en esa base: elegí otro destino.')).toBeVisible();

    await elegir(page, m.locator('app-select'), 'E.M.A. (C.A.P.)', 'E.M.A.');
    await expect(m.getByText('Ya revista en esa base: elegí otro destino.')).toHaveCount(0);
    await m.locator('[formcontrolname=fecha_inicio]').fill('2025-02-01');
    await m.locator('[formcontrolname=fecha_fin_anterior]').fill('2025-03-01');
    await m.locator('[formcontrolname=numero_orden]').fill(`O.D. ${cedula}`);
    await m.getByRole('button', { name: 'Registrar destino' }).click();

    await expect(m.locator('.modal__error')).toHaveText('El destino anterior tiene que cerrar antes de la fecha de inicio del nuevo.');
    await m.getByRole('button', { name: 'Cancelar' }).click();
    await buscar(page, cedula);
    await expect(filas(page)).toHaveCount(1);
  });
});

test.describe('editar un destino', () => {
  test('valida las fechas y guarda el cargo', async ({ page }) => {
    const { cedula } = await nuevoSubalterno('Destino Editar');
    await buscar(page, cedula);
    await accion(page, 'E.T.A.', 'Editar');

    const m = modal(page);
    await expect(m.getByRole('heading', { name: 'Editar destino' })).toBeVisible();
    // El destino que crea el alta no trae orden ni boletín.
    await m.locator('[formcontrolname=numero_orden]').fill(`O.D. ${cedula}`);
    await m.locator('[formcontrolname=fecha_fin]').fill('2019-01-01');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(m.locator('.modal__error')).toHaveText('La fecha de fin del destino no puede ser anterior a su fecha de inicio');

    await m.locator('[formcontrolname=fecha_fin]').fill('');
    await m.locator('[formcontrolname=posicion_destino]').fill('Encargado de pañol');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(toast(page, 'Destino actualizado correctamente')).toBeVisible();
    await expect(fila(page, 'E.T.A.')).toContainText('Encargado de pañol');
    await expect(fila(page, 'E.T.A.')).toContainText('Vigente');
  });

  test('no deja mover las fechas encima de otro destino', async ({ page }) => {
    const { cedula } = await nuevoSubalterno('Destino Superpuesto');
    await abrirRegistro(page, cedula);
    await elegir(page, modal(page).locator('app-select'), 'E.M.A. (C.A.P.)', 'E.M.A.');
    await modal(page).locator('[formcontrolname=fecha_inicio]').fill('2025-02-01');
    await modal(page).locator('[formcontrolname=numero_orden]').fill(`O.D. ${cedula}`);
    await modal(page).getByRole('button', { name: 'Registrar destino' }).click();
    await expect(toast(page, 'Destino registrado correctamente')).toBeVisible();

    await buscar(page, cedula);
    await accion(page, 'E.M.A.', 'Editar');
    await modal(page).locator('[formcontrolname=fecha_inicio]').fill('2024-06-01');
    await modal(page).getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(modal(page).locator('.modal__error')).toHaveText('Las fechas se superponen con otro destino del funcionario');
  });
});

test.describe('cerrar, reabrir y deshacer', () => {
  test('cerrar el vigente y reabrirlo', async ({ page }) => {
    const { cedula } = await nuevoSubalterno('Destino Cerrar');
    await buscar(page, cedula);

    await accion(page, 'E.T.A.', 'Cerrar destino');
    const cerrar = page.locator('.modal', { has: page.getByRole('heading', { name: 'Cerrar destino' }) });
    await cerrar.getByRole('button', { name: 'Cerrar destino' }).click();
    await expect(cerrar.locator('.modal__error')).toHaveText('Ingresá la fecha de fin.');
    await cerrar.locator('input[type=date]').fill('2025-06-30');
    await cerrar.getByRole('button', { name: 'Cerrar destino' }).click();

    await expect(toast(page, 'Destino cerrado correctamente')).toBeVisible();
    await expect(fila(page, 'E.T.A.')).toContainText('30/6/2025');
    await expect(fila(page, 'E.T.A.')).toContainText('Cerrado');

    await accion(page, 'E.T.A.', 'Reabrir');
    await page.locator('.modal', { has: page.getByRole('heading', { name: 'Reabrir destino' }) })
      .getByRole('button', { name: 'Reabrir' }).click();

    await expect(toast(page, 'Destino reabierto correctamente')).toBeVisible();
    await expect(fila(page, 'E.T.A.')).toContainText('Vigente');
  });

  test('deshacer el pase vuelve a la base anterior', async ({ page }) => {
    const { cedula } = await nuevoSubalterno('Destino Deshacer');
    await abrirRegistro(page, cedula);
    await elegir(page, modal(page).locator('app-select'), 'E.M.A. (C.A.P.)', 'E.M.A.');
    await modal(page).locator('[formcontrolname=fecha_inicio]').fill('2025-02-01');
    await modal(page).locator('[formcontrolname=boletin]').fill(`B.P. ${cedula}`);
    await modal(page).getByRole('button', { name: 'Registrar destino' }).click();
    await expect(toast(page, 'Destino registrado correctamente')).toBeVisible();

    await buscar(page, cedula);
    await expect(filas(page)).toHaveCount(2);
    await accion(page, 'E.M.A.', 'Deshacer pase');
    await page.locator('.modal', { has: page.getByRole('heading', { name: 'Deshacer pase' }) })
      .getByRole('button', { name: 'Deshacer pase' }).click();

    await expect(toast(page, /^Pase deshecho\. Se reabrió el destino anterior/)).toBeVisible();
    await expect(filas(page)).toHaveCount(1);
    await expect(fila(page, 'E.T.A.')).toContainText('Vigente');
  });
});

test('el filtro de estado separa vigentes e historial', async ({ page }) => {
  const { cedula } = await nuevoSubalterno('Destino Filtro');
  await abrirRegistro(page, cedula);
  await elegir(page, modal(page).locator('app-select'), 'E.M.A. (C.A.P.)', 'E.M.A.');
  await modal(page).locator('[formcontrolname=fecha_inicio]').fill('2025-02-01');
  await modal(page).locator('[formcontrolname=numero_orden]').fill(`O.D. ${cedula}`);
  await modal(page).getByRole('button', { name: 'Registrar destino' }).click();
  await expect(toast(page, 'Destino registrado correctamente')).toBeVisible();

  await buscar(page, cedula);
  await expect(filas(page)).toHaveCount(2);

  const estado = page.locator('app-select.asignaciones__filter-select').nth(2);
  await elegir(page, estado, 'Vigentes');
  await expect(filas(page)).toHaveCount(1);
  await expect(fila(page, 'E.M.A.')).toBeVisible();

  await elegir(page, estado, 'Historial');
  await expect(filas(page)).toHaveCount(1);
  await expect(fila(page, 'E.T.A.')).toBeVisible();

  await page.getByRole('button', { name: 'Borrar filtros' }).click();
  await expect(page.getByPlaceholder('Cédula, nombre o apellido...')).toHaveValue('');
});
