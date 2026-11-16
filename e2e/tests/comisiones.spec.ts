import { Page, expect, test } from '@playwright/test';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import { datos } from '../fixtures/usuarios';
import { crearComisionPorApi, elegirEnSelect, retirarPorApi, sufijo } from '../fixtures/ascensos';

type Asignacion = { id: string };

test.describe.configure({ mode: 'default' });

const modal = (page: Page) => page.locator('.comisiones__modal');

async function buscarPersona(page: Page, cedula: string) {
  await page.goto('/comisiones/asignaciones');
  await expect(page.getByRole('heading', { name: 'Asignaciones a comisiones' })).toBeVisible();
  const respuesta = page.waitForResponse((r) => r.url().includes('/api/comisiones/asignaciones?') && r.url().includes(cedula));
  await page.getByLabel('Buscar persona').fill(cedula);
  await respuesta;
}

async function accionDeFila(page: Page, cedula: string, accion: string) {
  await page.locator('tbody tr', { hasText: cedula }).getByRole('button', { name: 'Acciones de asignación' }).click();
  await page.getByRole('menuitem', { name: accion }).click();
}

async function abrirEdicionDeComision(page: Page, nombre: string) {
  await page.goto('/comisiones/catalogo');
  await page.getByLabel('Buscar comisión').fill(nombre);
  const fila = page.locator('tbody tr', { has: page.getByRole('link', { name: nombre, exact: true }) });
  await fila.getByRole('button', { name: 'Acciones de comisión' }).click();
  await page.getByRole('menuitem', { name: 'Editar comisión' }).click();
  await expect(modal(page).getByRole('heading', { name: 'Editar comisión' })).toBeVisible();
  return fila;
}

async function borrarAsignaciones(cedulas: string[]) {
  const a = await apiAdmin();
  for (const cedula of cedulas) {
    const { items } = await datos<{ items: Asignacion[] }>(await a.get(`/api/comisiones/asignaciones?query=${cedula}`));
    for (const item of items) await a.delete(`/api/comisiones/asignaciones/${item.id}`);
  }
  await a.dispose();
}

test.describe('comisiones', () => {
  test.describe.configure({ mode: 'serial' });

  const nombre = `E2E Comisión ${sufijo()}`;
  const editada = `${nombre} editada`;
  let uno: { id: string; cedula: string };
  let dos: { id: string; cedula: string };

  test.beforeAll(async () => {
    const a = await apiAdmin();
    uno = await crearSubalternoEnBase(a, 'E.T.A.', 'Comision E2E');
    dos = await crearSubalternoEnBase(a, 'E.T.A.', 'Comision E2E');
    await a.dispose();
  });

  test.afterAll(async () => {
    await borrarAsignaciones([uno.cedula, dos.cedula]);
  });

  test('crea una comisión y no acepta otra con el mismo nombre', async ({ page }) => {
    await page.goto('/comisiones/catalogo');
    await expect(page.getByRole('heading', { name: 'Catálogo de comisiones' })).toBeVisible();

    await page.getByRole('button', { name: 'Nueva comisión' }).click();
    await modal(page).locator('[formcontrolname=denominacion]').fill(nombre);
    await modal(page).getByRole('button', { name: 'Guardar comisión' }).click();
    await expect(modal(page)).toHaveCount(0);

    await page.getByLabel('Buscar comisión').fill(nombre);
    const fila = page.locator('tbody tr', { has: page.getByRole('link', { name: nombre, exact: true }) });
    await expect(fila).toHaveCount(1);
    await expect(fila.locator('.comisiones__badge')).toHaveText('Vigente');

    await page.getByRole('button', { name: 'Nueva comisión' }).click();
    await modal(page).locator('[formcontrolname=denominacion]').fill(nombre);
    await modal(page).getByRole('button', { name: 'Guardar comisión' }).click();
    await expect(modal(page).locator('.comisiones__error')).toContainText('Ya existe una comisión con ese nombre');
    await modal(page).getByRole('button', { name: 'Cancelar' }).click();
  });

  test('edita el nombre de la comisión', async ({ page }) => {
    await abrirEdicionDeComision(page, nombre);
    await modal(page).locator('[formcontrolname=denominacion]').fill(editada);
    await modal(page).getByRole('button', { name: 'Guardar comisión' }).click();
    await expect(modal(page)).toHaveCount(0);

    await page.getByLabel('Buscar comisión').fill(editada);
    await expect(page.getByRole('link', { name: editada, exact: true })).toBeVisible();
  });

  test('asigna dos personas en lote', async ({ page }) => {
    await page.goto('/comisiones/asignaciones');
    await page.getByRole('button', { name: 'Nueva asignación' }).click();
    const m = modal(page);
    for (const p of [uno, dos]) await elegirEnSelect(page, m.getByRole('button', { name: 'Seleccione personal' }), p.cedula);
    await expect(m.locator('.comisiones__personas-head strong')).toHaveText('2');
    await expect(m.getByText('El cargo se completa después')).toBeVisible();
    await expect(m.locator('[formcontrolname=cargo]')).toBeDisabled();

    await m.getByLabel('Buscar comisión').fill(editada);
    await m.locator('.comisiones__results button', { hasText: editada }).click();
    await m.locator('[formcontrolname=fecha_inicio]').fill('2025-01-10');

    await m.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(m.locator('.comisiones__error')).toHaveText('Ingresá al menos el N.º de orden o el boletín');

    await m.locator('[formcontrolname=numero_orden]').fill('E2E OC 1');
    await m.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(m).toHaveCount(0);

    for (const p of [uno, dos]) {
      await buscarPersona(page, p.cedula);
      const fila = page.locator('tbody tr', { hasText: p.cedula });
      await expect(fila).toHaveCount(1);
      await expect(fila).toContainText(editada);
      await expect(fila).toContainText('2025-01-10');
      await expect(fila).toContainText('Orden: E2E OC 1');
      await expect(fila.locator('.comisiones__badge')).toHaveText('Abierta');
    }
  });

  test('edita el cargo y el boletín de una pertenencia', async ({ page }) => {
    await buscarPersona(page, uno.cedula);
    await accionDeFila(page, uno.cedula, 'Editar');
    const m = modal(page);
    await expect(m.getByRole('heading', { name: 'Editar asignación' })).toBeVisible();
    await m.locator('[formcontrolname=cargo]').fill('Presidente');
    await m.locator('[formcontrolname=boletin]').fill('E2E BOL 7');
    await m.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(m).toHaveCount(0);

    const fila = page.locator('tbody tr', { hasText: uno.cedula });
    await expect(fila).toContainText('Presidente');
    await expect(fila).toContainText('Boletín: E2E BOL 7');
  });

  test('cierra la pertenencia y no la deja cerrar antes de su inicio', async ({ page }) => {
    await buscarPersona(page, uno.cedula);
    await accionDeFila(page, uno.cedula, 'Cerrar pertenencia');
    const m = modal(page);
    await m.locator('input[type=date]').fill('2024-01-01');
    await m.getByRole('button', { name: 'Confirmar' }).click();
    await expect(m.locator('.comisiones__error')).toHaveText('Ingresá una fecha hasta igual o posterior a la fecha desde');

    await m.locator('input[type=date]').fill('2025-06-30');
    await m.getByRole('button', { name: 'Confirmar' }).click();
    await expect(m).toHaveCount(0);

    const fila = page.locator('tbody tr', { hasText: uno.cedula });
    await expect(fila.locator('.comisiones__badge')).toHaveText('Cerrada');
    await expect(fila).toContainText('2025-06-30');
  });

  test('no deja cargar una pertenencia que se solape con otra', async ({ page }) => {
    await page.goto('/comisiones/asignaciones');
    await page.getByRole('button', { name: 'Nueva asignación' }).click();
    const m = modal(page);
    await elegirEnSelect(page, m.getByRole('button', { name: 'Seleccione personal' }), uno.cedula);
    await m.getByLabel('Buscar comisión').fill(editada);
    await m.locator('.comisiones__results button', { hasText: editada }).click();
    await m.locator('[formcontrolname=fecha_inicio]').fill('2025-03-01');
    await m.locator('[formcontrolname=fecha_fin]').fill('2025-04-30');
    await m.locator('[formcontrolname=numero_orden]').fill('E2E OC 2');
    await m.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(m.locator('.comisiones__error')).toContainText('fechas solapadas');
    await m.getByRole('button', { name: 'Cancelar' }).click();

    await buscarPersona(page, uno.cedula);
    await expect(page.locator('tbody tr', { hasText: uno.cedula })).toHaveCount(1);
  });

  test('reabre la pertenencia cerrada', async ({ page }) => {
    await buscarPersona(page, uno.cedula);
    await accionDeFila(page, uno.cedula, 'Reabrir');
    await modal(page).getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal(page)).toHaveCount(0);

    const fila = page.locator('tbody tr', { hasText: uno.cedula });
    await expect(fila.locator('.comisiones__badge')).toHaveText('Abierta');
    await expect(fila).toContainText('Sin fecha de finalización');
  });

  test('elimina una pertenencia del historial', async ({ page }) => {
    await buscarPersona(page, dos.cedula);
    await accionDeFila(page, dos.cedula, 'Eliminar');
    await expect(modal(page)).toContainText('Se eliminará esta pertenencia del historial.');
    await modal(page).getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal(page)).toHaveCount(0);
    await expect(page.locator('tbody tr', { hasText: dos.cedula })).toHaveCount(0);
    await expect(page.getByText('No hay resultados para los filtros seleccionados.')).toBeVisible();
  });

  test('no se inactiva con pertenencias abiertas y sí después de cerrarlas', async ({ page }) => {
    await abrirEdicionDeComision(page, editada);
    await modal(page).getByLabel('Comisión vigente').uncheck();
    await modal(page).getByRole('button', { name: 'Guardar comisión' }).click();
    await expect(modal(page).locator('.comisiones__error')).toHaveText(
      'Cerrá las pertenencias vigentes o futuras antes de inactivar la comisión',
    );
    await modal(page).getByRole('button', { name: 'Cancelar' }).click();

    await buscarPersona(page, uno.cedula);
    await accionDeFila(page, uno.cedula, 'Cerrar pertenencia');
    await modal(page).locator('input[type=date]').fill('2025-06-30');
    await modal(page).getByRole('button', { name: 'Confirmar' }).click();
    await expect(modal(page)).toHaveCount(0);
    // Con la comisión inactiva ya no se ofrece reabrir.
    await expect(page.locator('tbody tr', { hasText: uno.cedula }).locator('.comisiones__badge')).toHaveText('Cerrada');

    const fila = await abrirEdicionDeComision(page, editada);
    await modal(page).getByLabel('Comisión vigente').uncheck();
    await modal(page).getByRole('button', { name: 'Guardar comisión' }).click();
    await expect(modal(page)).toHaveCount(0);
    await expect(fila.locator('.comisiones__badge')).toHaveText('Inactiva');

    await buscarPersona(page, uno.cedula);
    await page.locator('tbody tr', { hasText: uno.cedula }).getByRole('button', { name: 'Acciones de asignación' }).click();
    await expect(page.getByRole('menuitem', { name: 'Editar' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reabrir' })).toHaveCount(0);
  });
});

test.describe('comisiones y retirados', () => {
  let retirado: { id: string; cedula: string };
  let comisionId = '';
  const nombre = `E2E Comisión Retirados ${sufijo()}`;

  test.beforeAll(async () => {
    const a = await apiAdmin();
    retirado = await crearSubalternoEnBase(a, 'E.T.A.', 'Retirado Comision E2E');
    await retirarPorApi(a, retirado.id);
    comisionId = await crearComisionPorApi(a, nombre);
    await a.dispose();
  });

  test.afterAll(async () => {
    const a = await apiAdmin();
    await a.patch(`/api/comisiones/${comisionId}`, { data: { service_request: { vigente: false } } });
    await a.dispose();
  });

  test('un retirado no se ofrece para la asignación y la API lo rechaza', async ({ page }) => {
    await page.goto('/comisiones/asignaciones');
    await page.getByRole('button', { name: 'Nueva asignación' }).click();
    await modal(page).getByRole('button', { name: 'Seleccione personal' }).click();
    await page.locator('.appsel__search input').fill(retirado.cedula);
    await expect(page.locator('.appsel__empty')).toHaveText('No hay personas para agregar con esa búsqueda', {
      timeout: 10_000,
    });
    await expect(page.locator('.appsel__option')).toHaveCount(0);

    const a = await apiAdmin();
    const res = await a.post('/api/comisiones/asignaciones/lote', {
      data: {
        service_request: {
          persona_ids: [Number(retirado.id)],
          comision_id: Number(comisionId),
          fecha_inicio: '2025-01-10',
          numero_orden: 'E2E OC R',
        },
      },
    });
    expect(res.status()).toBe(409);
    expect(await res.text()).toContain('un retirado no puede integrar una comisión');
    await a.dispose();
  });

  // Falla: la regla solo mira si hoy está retirado; acepta pertenencias del período en que lo estuvo.
  test.fixme('un reincorporado no puede tener pertenencias en el período en que estuvo retirado', async () => {
    const a = await apiAdmin();
    const p = await crearSubalternoEnBase(a, 'E.T.A.', 'Reincorporado Comision E2E');
    const retiroId = await retirarPorApi(a, p.id, '2024-06-30');
    const [base] = await datos<{ id: string; denominacion: string }[]>(await a.get('/api/catalogos/sub-unidades'));
    const escalafones = await datos<{ id: string; denominacion: string }[]>(await a.get('/api/catalogos/escalafones'));
    const st = escalafones.find((e) => e.denominacion === '(S.T.)')!;
    const grados = await datos<{ id: string; denominacion: string }[]>(await a.get(`/api/catalogos/grados?escalafon_id=${st.id}`));
    const reinc = await a.post(`/api/retiros/${retiroId}/reincorporacion`, {
      data: {
        service_request: {
          fecha_reincorporacion: '2025-01-01',
          grado_reincorporacion_id: Number(grados.find((g) => g.denominacion === 'Sgto.')!.id),
          sub_unidad_id: Number(base.id),
          numero_orden: 'E2E REINC',
        },
      },
    });
    expect(reinc.ok(), `reincorporación respondió ${reinc.status()}: ${await reinc.text()}`).toBeTruthy();

    const res = await a.post('/api/comisiones/asignaciones', {
      data: {
        service_request: {
          persona_id: Number(p.id),
          comision_id: Number(comisionId),
          fecha_inicio: '2024-08-01',
          fecha_fin: '2024-10-31',
          numero_orden: 'E2E OC R2',
        },
      },
    });
    expect(res.status()).toBe(409);
    await a.dispose();
  });
});
