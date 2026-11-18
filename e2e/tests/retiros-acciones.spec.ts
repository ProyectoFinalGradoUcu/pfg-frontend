import { Page, expect, test } from '@playwright/test';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import { crearRetiro, haceDias, reincorporar } from '../fixtures/retiros';

const toast = (page: Page, texto: string | RegExp) => page.locator('.toast__message', { hasText: texto });

// Valor de un campo del detalle.
const dato = (page: Page, titulo: string) =>
  page.locator('.retiro-detalle__campos > div', { has: page.getByRole('term').getByText(titulo, { exact: true }) }).getByRole('definition');

const chip = (page: Page) => page.locator('.retiro-detalle__header .retiro-detalle__chip');

async function retiroPorApi(apellido: string) {
  const api = await apiAdmin();
  const retiro = await crearRetiro(api, apellido);
  await api.dispose();
  return retiro;
}

async function abrirRetiro(page: Page, retiroId: number) {
  await page.goto(`/retiros/${retiroId}`);
  await expect(page.getByRole('heading', { name: 'Datos del retiro' })).toBeVisible({ timeout: 15_000 });
}

test.describe('registrar retiro', () => {
  test('desde el listado cierra el destino y queda vigente', async ({ page }) => {
    const api = await apiAdmin();
    const { cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Retiro Wizard');
    await api.dispose();

    await page.goto('/retiros');
    await page.getByRole('button', { name: 'Registrar retiro' }).click();
    await page.getByRole('button', { name: 'Seleccione personal' }).click();
    await page.getByPlaceholder('Buscar...').fill(cedula);
    await page.locator('.appsel__option', { hasText: cedula }).click();

    const modal = page.locator('app-retiro-form-modal');
    await expect(modal.locator('.rf__persona')).toContainText(cedula);
    await modal.getByLabel('Fecha de retiro').fill(haceDias(10));
    await modal.getByLabel('Motivo *').selectOption({ label: 'Baja por retiro voluntario.' });
    await modal.getByLabel('Número de orden').fill('O.D. retiro e2e');

    const destino = modal.locator('.rf__check', { hasText: 'Cerrar destino en' });
    await expect(destino).toContainText('E.T.A.');
    await expect(destino.getByRole('checkbox')).toBeChecked();

    await modal.getByRole('button', { name: 'Continuar' }).click();
    await expect(modal.getByText('Esto cierra una carrera.')).toBeVisible();
    await modal.getByRole('button', { name: 'Confirmar retiro' }).click();

    await expect(toast(page, 'Retiro registrado: se cerró el destino.')).toBeVisible();
    await expect(modal).toHaveCount(0);

    await page.getByPlaceholder('Cédula, nombre o apellido').fill(cedula);
    const fila = page.locator('.retiros__row', { hasText: cedula });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });
    await fila.click();

    await expect(chip(page)).toHaveText('Vigente');
    await expect(dato(page, 'Motivo')).toHaveText('Baja por retiro voluntario.');
    await expect(dato(page, 'Número de orden')).toContainText('O.D. retiro e2e');
    await expect(page.locator('.retiro-detalle__cierres')).toContainText('Destino cerrado');
    await expect(dato(page, 'Base')).toHaveText('E.T.A.');
  });

  test('una fecha futura bloquea el retiro', async ({ page }) => {
    const api = await apiAdmin();
    const { cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Retiro Futuro');
    await api.dispose();

    await page.goto('/retiros');
    await page.getByRole('button', { name: 'Registrar retiro' }).click();
    await page.getByRole('button', { name: 'Seleccione personal' }).click();
    await page.getByPlaceholder('Buscar...').fill(cedula);
    await page.locator('.appsel__option', { hasText: cedula }).click();

    const modal = page.locator('app-retiro-form-modal');
    const enUnMes = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await modal.getByLabel('Fecha de retiro').fill(enUnMes);
    await modal.getByLabel('Motivo *').selectOption({ label: 'Baja por retiro voluntario.' });

    await expect(modal.getByText('No se puede registrar este retiro:')).toBeVisible();
    await expect(modal.getByText('La fecha de retiro no puede ser futura.')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });
});

test.describe('detalle del retiro', () => {
  test('corregir cambia el motivo y el número de orden', async ({ page }) => {
    const { retiroId } = await retiroPorApi('Retiro Corregir');
    await abrirRetiro(page, retiroId);
    await expect(dato(page, 'Motivo')).toHaveText('Baja por retiro voluntario.');

    await page.getByRole('button', { name: 'Corregir' }).click();
    const modal = page.locator('app-corregir-retiro-modal');
    await expect(modal.getByText('Cambiar la fecha no reajusta la cascada.')).toHaveCount(0);
    await modal.getByLabel('Fecha de retiro').fill(haceDias(31));
    await expect(modal.getByText('Cambiar la fecha no reajusta la cascada.')).toBeVisible();
    await modal.getByLabel('Motivo *').selectOption({ label: 'Baja por cese.' });
    await modal.getByLabel('Número de orden').fill('O.D. corregida e2e');
    await modal.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(toast(page, 'Retiro corregido.')).toBeVisible();
    await expect(modal).toHaveCount(0);
    await expect(dato(page, 'Motivo')).toHaveText('Baja por cese.');
    await expect(dato(page, 'Número de orden')).toContainText('O.D. corregida e2e');
    await expect(chip(page)).toHaveText('Vigente');
  });

  test('anular pide un motivo y deja al funcionario activo', async ({ page }) => {
    const { retiroId, personaId } = await retiroPorApi('Retiro Anular');
    await abrirRetiro(page, retiroId);

    await page.getByRole('button', { name: 'Anular', exact: true }).click();
    const modal = page.locator('app-anular-retiro-modal');
    await modal.getByLabel('Motivo de la anulación *').fill('abc');
    await modal.getByRole('button', { name: 'Anular retiro' }).click();
    await expect(modal.getByText('Escribí al menos 5 caracteres.')).toBeVisible();

    await modal.getByLabel('Motivo de la anulación *').fill('Cargado sobre la persona equivocada');
    await modal.getByRole('button', { name: 'Anular retiro' }).click();

    await expect(toast(page, /^Se reabrió la relación laboral/)).toBeVisible();
    await expect(chip(page)).toHaveText('Anulado');
    await expect(page.getByRole('heading', { name: 'Este retiro fue anulado' })).toBeVisible();
    await expect(dato(page, 'Motivo de la anulación')).toHaveText('Cargado sobre la persona equivocada');
    await expect(page.locator('.retiro-detalle__acciones').getByRole('button')).toHaveCount(0);

    await page.goto(`/personal/${personaId}`);
    await expect(page.locator('.pd__aside .pd__situacion')).toHaveText('Personal Subalterno en actividad.');
  });

  test('reincorporar y cargar los datos de cálculo', async ({ page }) => {
    const { retiroId } = await retiroPorApi('Retiro Reincorporar');
    await abrirRetiro(page, retiroId);

    const reincorporarBtn = page.getByRole('button', { name: 'Reincorporar' });
    await expect(reincorporarBtn).toBeEnabled();
    await reincorporarBtn.click();

    const modal = page.locator('app-reincorporar-retiro-modal');
    await expect(modal.getByText('SIT17 · Personal Subalterno reincorporado')).toBeVisible();
    await modal.getByLabel('Fecha de reincorporación *').fill(haceDias(1));
    await modal.getByLabel('Grado de reincorporación *').selectOption({ label: 'Sgto.' });

    // Haber sin porcentaje no se acepta.
    await modal.getByLabel('Haber de retiro mensual').fill('45000');
    await modal.getByLabel('Haber de retiro mensual').blur();
    await expect(modal.getByText('Cargá el haber y el porcentaje juntos, o dejá los dos vacíos.')).toBeVisible();
    await modal.getByLabel('Haber de retiro mensual').fill('');

    await modal.getByRole('button', { name: 'Continuar' }).click();
    await expect(modal.getByText('Indicá el número de orden o la resolución del acto.')).toBeVisible();
    await modal.getByLabel('Número de orden').fill('O.D. reincorporación e2e');

    await modal.getByRole('button', { name: 'Continuar' }).click();
    await expect(modal.getByText('El funcionario vuelve al servicio.')).toBeVisible();
    await expect(modal.locator('.ri__resumen')).toContainText('sin cargar');
    await modal.getByRole('button', { name: 'Confirmar reincorporación' }).click();

    await expect(toast(page, /^Funcionario reincorporado \(SIT17\)/)).toBeVisible();
    await expect(modal).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'El funcionario fue reincorporado' })).toBeVisible();
    await expect(chip(page)).toHaveText('Revertido');
    await expect(page.getByRole('button', { name: 'Anular', exact: true })).toBeDisabled();
    await expect(page.locator('.retiro-detalle__bloqueos')).toContainText('Anulá primero la reincorporación.');

    await expect(page.getByText('Falta cargar el haber de retiro y el porcentaje progresivo')).toBeVisible();
    await page.getByRole('button', { name: 'Cargar datos' }).click();
    const calculo = page.locator('app-datos-calculo-reincorporacion-modal');
    await calculo.getByLabel('Haber de retiro mensual').fill('45000.5');
    await calculo.getByLabel('Porcentaje progresivo').fill('30');
    await calculo.getByRole('button', { name: 'Guardar' }).click();

    await expect(toast(page, 'Datos de cálculo guardados.')).toBeVisible();
    await expect(page.getByText('Falta cargar el haber de retiro')).toHaveCount(0);
    await expect(dato(page, 'Haber de retiro')).toContainText('45.000,50');
    await expect(dato(page, 'Porcentaje progresivo')).toContainText('30');
  });

  test('anular la reincorporación deja el retiro vigente otra vez', async ({ page }) => {
    const { retiroId } = await retiroPorApi('Retiro Anular Reinc');
    const api = await apiAdmin();
    await reincorporar(api, retiroId);
    await api.dispose();
    await abrirRetiro(page, retiroId);
    await expect(chip(page)).toHaveText('Revertido');

    await page.getByRole('button', { name: 'Anular reincorporación' }).click();
    const modal = page.locator('app-anular-reincorporacion-modal');
    await modal.getByLabel('Motivo de la anulación *').fill('Se reincorporó a la persona equivocada');
    await modal.getByRole('button', { name: 'Anular reincorporación' }).click();

    await expect(toast(page, /^Se anuló la reincorporación/)).toBeVisible();
    await expect(chip(page)).toHaveText('Vigente');
    await expect(page.getByRole('heading', { name: 'El funcionario fue reincorporado' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reincorporar' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Anular', exact: true })).toBeEnabled();
  });
});
