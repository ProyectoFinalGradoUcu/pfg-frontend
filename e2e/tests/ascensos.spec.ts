import { expect, test } from '@playwright/test';
import { apiAdmin, crearSubalternoEnBase, SIN_SESION } from '../fixtures/personal';
import { api, asegurarRol, asegurarUsuario, datos, loginUI, usuarioE2E } from '../fixtures/usuarios';
import {
  anularAscensoPorApi,
  ayer,
  crearOrdenPorApi,
  derechaEnGrado,
  elegibilidad,
  elegirEnSelect,
  sufijo,
} from '../fixtures/ascensos';

const LECTOR = usuarioE2E('ascensos-lector');
const ROL_LECTOR = 'E2E Ascensos Lector';

test.describe.configure({ mode: 'default' });

test.describe('pasibles', () => {
  test('lista, busca por cédula y suma los bloqueados con el filtro de estado', async ({ page }) => {
    const a = await apiAdmin();
    const { cedula } = await crearSubalternoEnBase(a, 'E.T.A.', 'Pasible E2E');
    await a.dispose();

    await page.goto('/ascensos-y-retiros/pasibles');
    await expect(page.getByRole('heading', { name: 'Pasibles de ascenso' })).toBeVisible();
    await expect(page.locator('.tile', { hasText: 'pasibles' }).first()).toBeVisible();

    await page.getByPlaceholder('Cédula, nombre o apellido...').fill(cedula);
    // Sin fecha de nacimiento ni cursos queda bloqueado, y por defecto solo se ven pasibles y próximos.
    await expect(page.getByText('No hay funcionarios con estos filtros.')).toBeVisible({ timeout: 10_000 });

    const estado = page.locator('.filtros__campo', { hasText: 'Estado' }).locator('.appsel__control');
    await estado.click();
    await page.locator('.appsel__option', { hasText: 'Bloqueado' }).click();
    await page.keyboard.press('Escape');

    const fila = page.locator('tbody tr', { hasText: cedula });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });
    await expect(fila).toContainText('Sgto.');
    await expect(fila).toContainText('→ Sgto. 1°');
    await expect(fila.locator('.badge')).toHaveText('Bloqueado');

    await fila.locator('.tabla__nombre').click();
    const panel = page.locator('aside.panel');
    await expect(panel.getByRole('heading', { name: 'Requisitos' })).toBeVisible();
    await expect(panel).toContainText('Antigüedad en el grado');
    await panel.locator('.panel__footer').getByRole('button', { name: 'Cerrar' }).click();
    await expect(panel).toHaveCount(0);
  });
});

test.describe('orden de ascenso', () => {
  test.describe.configure({ mode: 'serial' });

  let persona: { id: string; cedula: string };
  let ordenUrl = '';
  const numero = `E2E ORD ${sufijo()}`;

  test.beforeAll(async () => {
    const a = await apiAdmin();
    persona = await crearSubalternoEnBase(a, 'E.T.A.', 'Ascenso E2E');
    await a.dispose();
  });

  test('la nueva orden recalcula la elegibilidad al cambiar la fecha y se registra por excepción', async ({ page }) => {
    await page.goto('/ascensos-y-retiros/ordenes/nueva');
    await expect(page.getByRole('heading', { name: 'Registrar orden de ascenso' })).toBeVisible();

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('Completá el N.º de orden o la resolución.')).toBeVisible();

    await page.locator('#fecha').fill(ayer());
    await page.locator('#numero').fill(numero);
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await elegirEnSelect(page, page.getByRole('button', { name: 'Seleccione personal' }), persona.cedula);

    const fila = page.locator('article.funcionario', { hasText: persona.cedula });
    await expect(fila).toBeVisible();
    await expect(fila.locator('.funcionario__destino')).toHaveText('Sgto. 1°');
    await expect(fila.locator('.badge')).toHaveText('Bloqueado');
    // Con la fecha de hoy ya tiene la antigüedad: solo le faltan edad y cursos.
    await expect(fila.locator('.bloqueo__chips')).not.toContainText('Antigüedad en el grado');

    const revisar = page.getByRole('button', { name: 'Revisar y confirmar' });
    await expect(revisar).toBeDisabled();
    await expect(page.getByText('Falta el motivo de la excepción de 1 funcionario.')).toBeVisible();

    // Entró el 2020-03-01: al 2021-01-01 lleva 10 meses y le falta antigüedad.
    const fecha = fila.locator('.funcionario__fecha input');
    const reevaluada = page.waitForResponse(
      (r) => r.url().includes(`/api/ascensos/elegibilidad/${persona.id}`) && r.url().includes('2021-01-01'),
    );
    await fecha.fill('2021-01-01');
    await fecha.dispatchEvent('change');
    await reevaluada;
    await expect(fila.locator('.bloqueo__chips')).toContainText('Antigüedad en el grado');
    await expect(fila.locator('.bloqueo__chips')).toContainText('10 meses de 2 años');

    await fecha.fill(ayer());
    await fecha.dispatchEvent('change');
    await expect(fila.locator('.bloqueo__chips')).not.toContainText('Antigüedad en el grado');

    await fila.locator(`#motivo-${persona.id}`).fill('Excepción de prueba E2E');
    await expect(revisar).toBeEnabled();
    await revisar.click();

    const confirmacion = page.locator('ul.confirmacion li');
    await expect(confirmacion).toHaveCount(1);
    await expect(confirmacion).toContainText('Sgto. → Sgto. 1°');
    await expect(confirmacion).toContainText('por excepción');

    await page.getByRole('button', { name: 'Registrar la orden' }).click();
    await expect(page).toHaveURL(/\/ascensos-y-retiros\/ordenes\/\d+$/, { timeout: 15_000 });
    ordenUrl = page.url();

    await expect(page.getByRole('heading', { name: numero })).toContainText('Vigente');
    await expect(page.getByText('1 funcionarios · 1 por excepción')).toBeVisible();
    const ascenso = page.locator('tbody tr', { hasText: persona.cedula });
    await expect(ascenso).toContainText('Sgto. → Sgto. 1°');
    await expect(ascenso).toContainText('Por excepción');

    await ascenso.getByRole('button', { name: /Ver detalle de/ }).click();
    await expect(page.getByText('Motivo de la excepción: Excepción de prueba E2E')).toBeVisible();

    const a = await apiAdmin();
    expect((await elegibilidad(a, persona.id)).grado_actual.denominacion).toBe('Sgto. 1°');
    await a.dispose();
  });

  test('la orden aparece en el listado y abre su detalle', async ({ page }) => {
    test.skip(!ordenUrl, 'Depende de la orden del test anterior.');
    await page.goto('/ascensos-y-retiros/ordenes');
    await expect(page.getByRole('heading', { name: 'Ascensos registrados' })).toBeVisible();

    await page.getByLabel('Buscar por N.º de orden').fill(numero);
    const fila = page.locator('tbody tr', { hasText: numero });
    await expect(fila).toHaveCount(1, { timeout: 10_000 });
    await expect(fila).toContainText('1 de 1');
    await expect(fila.locator('.badge--green')).toHaveText('Vigente');

    await fila.getByRole('link', { name: 'Ver detalle' }).click();
    await expect(page).toHaveURL(ordenUrl);
    await expect(page.getByRole('heading', { name: numero })).toBeVisible();
  });

  test('anular el ascenso devuelve a la persona a su grado', async ({ page }) => {
    test.skip(!ordenUrl, 'Depende de la orden del test anterior.');
    await page.goto(ordenUrl);
    const ascenso = page.locator('tbody tr', { hasText: persona.cedula });
    await ascenso.getByRole('button', { name: 'Anular' }).click();

    const modal = page.getByRole('dialog', { name: 'Anular el ascenso' });
    await expect(modal).toContainText('vuelve a Sgto.');
    await modal.locator('textarea').fill('Anulado por el test E2E');
    const anulado = page.waitForResponse((r) => r.url().includes('/anular') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Anular', exact: true }).click();
    expect((await anulado).ok()).toBeTruthy();

    await expect(modal).toHaveCount(0);
    await expect(ascenso.locator('.badge')).toHaveText('Anulado');
    await expect(ascenso.getByRole('button', { name: 'Anular' })).toHaveCount(0);

    const a = await apiAdmin();
    const ev = await elegibilidad(a, persona.id);
    expect(ev.grado_actual.denominacion).toBe('Sgto.');
    expect(ev.grado_destino?.denominacion).toBe('Sgto. 1°');
    await a.dispose();
  });

  // Falla: con su único ascenso anulado, la orden sigue figurando "Vigente".
  test.fixme('la orden con todos sus ascensos anulados figura anulada', async ({ page }) => {
    await page.goto(ordenUrl);
    await expect(page.getByRole('heading', { name: numero })).toContainText('Anulada');
  });
});

test('anular la orden completa revierte a todos sus funcionarios', async ({ page }) => {
  const a = await apiAdmin();
  const p1 = await crearSubalternoEnBase(a, 'E.T.A.', 'Orden Completa E2E');
  const p2 = await crearSubalternoEnBase(a, 'E.T.A.', 'Orden Completa E2E');
  const numero = `E2E ORD ${sufijo()}`;
  const res = await a.post('/api/ascensos/ordenes', {
    data: {
      numero_orden: numero,
      fecha_orden: ayer(),
      funcionarios: [p1, p2].map((p) => ({ persona_id: Number(p.id), motivo_excepcion: 'Excepción de prueba E2E' })),
    },
  });
  expect(res.ok(), `crear orden respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  const orden = await datos<{ id: string }>(res);

  await page.goto(`/ascensos-y-retiros/ordenes/${orden.id}`);
  await page.getByRole('button', { name: 'Anular orden completa' }).click();
  const modal = page.getByRole('dialog', { name: 'Anular la orden completa' });
  await expect(modal).toContainText('Se van a revertir 2 ascensos.');
  await modal.locator('textarea').fill('Orden anulada por el test E2E');
  await modal.getByRole('button', { name: 'Anular', exact: true }).click();

  // Con otros specs corriendo, la anulación espera su turno en el lock de la derecha.
  await expect(page.getByRole('heading', { name: numero })).toContainText('Anulada', { timeout: 30_000 });
  await expect(page.getByText('Orden anulada por el test E2E')).toBeVisible();
  await expect(page.locator('tbody .badge', { hasText: 'Anulado' })).toHaveCount(2);

  for (const p of [p1, p2]) expect((await elegibilidad(a, p.id)).grado_actual.denominacion).toBe('Sgto.');
  await a.dispose();
});

// Falla: al anular, la persona queda al final de su grado en la derecha en vez de recuperar su lugar.
test.fixme('anular un ascenso le devuelve su lugar en la derecha', async () => {
  const a = await apiAdmin();
  const primero = await crearSubalternoEnBase(a, 'E.T.A.', 'Derecha E2E');
  const segundo = await crearSubalternoEnBase(a, 'E.T.A.', 'Derecha E2E');
  const { grado_actual } = await elegibilidad(a, primero.id);
  const antes = (await derechaEnGrado(a, grado_actual.id, primero.id))!;
  expect(antes).toBeLessThan((await derechaEnGrado(a, grado_actual.id, segundo.id))!);

  const { ascensoId } = await crearOrdenPorApi(a, primero.id, `E2E ORD ${sufijo()}`);
  await anularAscensoPorApi(a, ascensoId);

  expect(await derechaEnGrado(a, grado_actual.id, primero.id)).toBeLessThan(
    (await derechaEnGrado(a, grado_actual.id, segundo.id))!,
  );
  await a.dispose();
});

test.describe('reglas de ascenso', () => {
  test('se ven por escalafón y el editor se abre y se cancela sin guardar', async ({ page }) => {
    await page.goto('/ascensos-y-retiros/reglas');
    await expect(page.getByRole('heading', { name: 'Reglas de ascenso' })).toBeVisible();
    await expect(page.locator('.tile', { hasText: 'tramos con regla' })).toBeVisible();

    const subalternos = page.locator('.tab', { hasText: 'Subalternos' });
    if (await subalternos.count()) await subalternos.first().click();

    const tramo = page.locator('details.rule', {
      has: page.locator('summary .path-mini', { hasText: /^\s*Sgto\.\s*→\s*Sgto\. 1°\s*$/ }),
    });
    await expect(tramo).toBeVisible({ timeout: 10_000 });
    await tramo.locator('summary').click();
    await expect(tramo.locator('.section-title')).toHaveText('Cursos y evaluaciones requeridas');

    let guardo = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/ascensos/reglas') && r.method() !== 'GET') guardo = true;
    });
    await tramo.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar regla' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar regla' })).toHaveCount(0);
    expect(guardo).toBe(false);
  });

  test.describe('con un usuario que solo ve ascensos', () => {
    test.use({ storageState: SIN_SESION });

    test.beforeAll(async () => {
      const a = await api();
      await asegurarRol(a, ROL_LECTOR, ['ascensos.ver']);
      await asegurarUsuario(a, LECTOR.username, [ROL_LECTOR]);
      await a.dispose();
    });

    test('entra a pasibles pero no a reglas ni a nueva orden', async ({ page }) => {
      await loginUI(page, LECTOR);
      await expect(page).toHaveURL(/\/ascensos-y-retiros\/pasibles/);

      await page.goto('/ascensos-y-retiros/pasibles');
      await expect(page.getByRole('heading', { name: 'Pasibles de ascenso' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Registrar orden/ })).toHaveCount(0);

      await page.goto('/ascensos-y-retiros/reglas');
      await expect(page).toHaveURL(/\/ascensos-y-retiros\/pasibles/);
      await expect(page.getByRole('heading', { name: 'Reglas de ascenso' })).toHaveCount(0);

      await page.goto('/ascensos-y-retiros/ordenes/nueva');
      await expect(page).toHaveURL(/\/ascensos-y-retiros\/pasibles/);
    });
  });
});
