import { Page, expect, request, test } from '@playwright/test';
import { SIN_SESION } from '../fixtures/personal';
import { E2E_PASSWORD, api, asegurarRol, asegurarUsuario, datos, loginUI, usuarioE2E, filaConEmail } from '../fixtures/usuarios';

const SESION = usuarioE2E('sesion');
const VISOR = usuarioE2E('visor');

test.describe.configure({ mode: 'serial' });

async function elegir(page: Page, placeholder: string, opcion: string) {
  const sel = page.locator('app-select', { has: page.locator('.appsel__placeholder', { hasText: placeholder }) });
  await sel.locator('.appsel__control').click();
  const buscar = sel.locator('.appsel__search input');
  if (await buscar.count()) await buscar.fill(opcion);
  await sel.getByRole('option', { name: opcion, exact: true }).click();
}

const filas = (page: Page) => page.locator('.aud__table tbody tr');

// ───────────────────────────────── Auditoría ─────────────────────────────────
test.describe('auditoría', () => {
  test.beforeAll(async () => {
    const a = await api();
    await asegurarRol(a, 'E2E Sesion', ['personas.ver', 'auditoria.ver']);
    await asegurarUsuario(a, SESION.username, ['E2E Sesion']);
    await a.dispose();
    // Login y logout no se auditan: con un LOGIN_FALLIDO el usuario tiene al menos un evento.
    const ctx = await request.newContext({ baseURL: test.info().project.use.baseURL });
    await ctx.post('/api/auth/sign-in', { data: { username: SESION.username, password: 'Incorrecta123!' } });
    await ctx.dispose();
    const b = await api(SESION);
    await b.dispose();
  });

  test('lista eventos paginados, más nuevos primero', async ({ page }) => {
    await page.goto('/auditoria');
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible();
    await expect(filas(page).first()).toBeVisible();
    await expect(filas(page)).toHaveCount(20);
    const primera = await filas(page).first().textContent();
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(filas(page).first()).not.toHaveText(primera!);
  });

  test('filtrar por usuario y acción', async ({ page }) => {
    await page.goto('/auditoria');
    await expect(filas(page).first()).toBeVisible();
    await elegir(page, 'Usuario', SESION.username);
    await expect(filas(page).first()).toContainText(SESION.username);
    for (const t of await filas(page).allTextContents()) expect(t).toContain(SESION.username);

    await elegir(page, 'Acción', 'LOGIN_FALLIDO');
    await expect(filas(page).first()).toContainText('LOGIN_FALLIDO');
    for (const f of await filas(page).all()) {
      await expect(f.locator('td').nth(2)).toHaveText(/^\s*LOGIN_FALLIDO\s*$/);
      await expect(f.locator('td').nth(3)).toContainText('Autenticación');
    }
  });

  test('rango de fechas sin eventos muestra el vacío y Borrar filtros lo restablece', async ({ page }) => {
    await page.goto('/auditoria');
    await expect(filas(page).first()).toBeVisible();
    // Igual que el front: la API toma YYYY-MM-DD en hora de Uruguay.
    const vacia = await datos<{ total: number }>(
      await page.request.get('/api/auditoria?page=1&pageSize=1&desde=2099-01-01&hasta=2099-01-02'),
    );
    expect(vacia.total).toBe(0);
    const res = await page.request.get('/api/auditoria?page=1&pageSize=1&desde=2026-11-16&hasta=2026-11-10');
    expect(res.status(), 'rango invertido').toBeLessThan(500);

    await elegir(page, 'Contexto', 'Autenticación');
    await expect(page.getByRole('button', { name: 'Borrar filtros' })).toBeEnabled();
    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(page.getByRole('button', { name: 'Borrar filtros' })).toBeDisabled();
    await expect(filas(page)).toHaveCount(20);
  });

  test('el detalle abre, muestra datos técnicos y cierra', async ({ page }) => {
    await page.goto('/auditoria');
    await elegir(page, 'Contexto', 'Usuarios');
    const ver = page.locator('.aud__table').getByRole('button', { name: 'Ver' }).first();
    await expect(ver).toBeVisible();
    await ver.click();
    await expect(page.getByRole('heading', { name: 'Detalle del evento' })).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Ver datos técnicos' });
    if (await toggle.count()) {
      await toggle.click();
      await expect(page.locator('.aud__modal pre.aud__detalle')).toBeVisible();
    }
    // Las contraseñas nunca se ven en claro.
    await expect(page.locator('.aud__modal')).not.toContainText(E2E_PASSWORD);
    await page.locator('.aud__modal-close').click();
    await expect(page.getByRole('heading', { name: 'Detalle del evento' })).toHaveCount(0);
  });

  test('un LOGIN_FALLIDO queda registrado', async ({ page }) => {
    const r = await page.request.post('/api/auth/sign-in', { data: { username: SESION.username, password: 'Incorrecta123!' } });
    expect(r.status()).toBe(401);
    // Un login correcto resetea el contador de intentos.
    const b = await api(SESION);
    await b.dispose();
    await page.goto('/auditoria');
    await elegir(page, 'Acción', 'LOGIN_FALLIDO');
    await expect(filaConEmail(filas(page), page, SESION.username).first()).toBeVisible();
  });

  test.describe('con usuario que tiene auditoria.ver', () => {
    test.use({ storageState: SIN_SESION });
    test('entra desde el menú', async ({ page }) => {
      await loginUI(page, VISOR);
      await expect(page).toHaveURL(/\/auditoria/);
      await page.goto('/usuarios-y-roles');
      await page.locator('app-sidebar').getByText('Auditoría').click();
      await expect(page).toHaveURL(/\/auditoria/);
      await expect(filas(page).first()).toBeVisible();
    });
  });
});

// ─────────────────────────── Configuración de derecha ────────────────────────
test.describe('configuración de derecha y numor', () => {
  type P = { persona_id: string; cedula: string; nombre: string; grado: string; grado_id: string; derecha: number | null };

  test('carga, filtra por texto y por grado, y limpia', async ({ page }) => {
    await page.goto('/personal/configuracion-derecha');
    await expect(page.getByRole('heading', { name: 'Configuración de derecha y numor' })).toBeVisible();
    const tabla = page.locator('.cdp__tabla tbody tr');
    await expect(tabla.first()).not.toContainText('Cargando');
    await expect(tabla).toHaveCount(10);

    const personal = await datos<P[]>(await page.request.get('/api/configuracion-derecha/personal'));
    const alguien = personal.find((p) => p.derecha !== null)!;
    await page.getByRole('searchbox', { name: 'Buscar por nombre o cédula' }).fill(alguien.cedula);
    await expect(tabla).toHaveCount(1);
    await expect(tabla.first()).toContainText(alguien.cedula);

    await page.getByRole('searchbox', { name: 'Buscar por nombre o cédula' }).fill('zzzz-sin-resultado');
    await expect(tabla.first()).toHaveText(/Ningún funcionario coincide/);
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(tabla).toHaveCount(10);
  });

  test('editar una derecha previsualiza el impacto y Descartar no guarda nada', async ({ page }) => {
    await page.goto('/personal/configuracion-derecha');
    const personal = await datos<P[]>(await page.request.get('/api/configuracion-derecha/personal'));
    // Un grado con al menos 2 personas con derecha, para poder correr a alguien.
    const porGrado = new Map<string, P[]>();
    for (const p of personal) if (p.derecha !== null) porGrado.set(p.grado_id, [...(porGrado.get(p.grado_id) ?? []), p]);
    const grupo = [...porGrado.values()].find((g) => g.length >= 2)!;
    grupo.sort((x, y) => x.derecha! - y.derecha!);
    const [primero, segundo] = grupo;

    await page.getByRole('searchbox', { name: 'Buscar por nombre o cédula' }).fill(segundo.cedula);
    const input = page.getByRole('spinbutton', { name: `Derecha de ${segundo.nombre}` });
    await input.fill(String(primero.derecha));
    await input.press('Enter');

    await expect(page.getByText('1 cambio pendiente')).toBeVisible();
    await expect(page.locator('.impacto__total b')).toHaveText(/^[1-9]\d*$/, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByText('cambio pendiente')).toHaveCount(0);

    const despues = await datos<P[]>(await page.request.get('/api/configuracion-derecha/personal'));
    expect(despues.find((p) => p.persona_id === segundo.persona_id)!.derecha).toBe(segundo.derecha);
  });

  test('un valor fuera del rango del grado muestra error y no queda pendiente', async ({ page }) => {
    await page.goto('/personal/configuracion-derecha');
    const personal = await datos<P[]>(await page.request.get('/api/configuracion-derecha/personal'));
    const alguien = personal.find((p) => p.derecha !== null)!;
    await page.getByRole('searchbox', { name: 'Buscar por nombre o cédula' }).fill(alguien.cedula);
    const input = page.getByRole('spinbutton', { name: `Derecha de ${alguien.nombre}` });
    await input.fill('999999');
    await input.press('Enter');
    await expect(page.locator('.cdp__error')).toContainText(/va de \d+ a \d+/);
    await expect(input).toHaveValue(String(alguien.derecha));
    await expect(page.getByText('cambio pendiente')).toHaveCount(0);
  });

  test.describe('sin derecha.gestionar', () => {
    test.use({ storageState: SIN_SESION });
    test('no ve Configuración en el menú ni la API de cambios', async ({ page }) => {
      await loginUI(page, VISOR);
      await expect(page).toHaveURL(/\/auditoria/);
      await page.goto('/personal/configuracion-derecha');
      await expect(page).toHaveURL(/\/auditoria/);
      const r = await page.request.patch('/api/configuracion-derecha/cambios', { data: { cambios: [] } });
      expect(r.status()).toBe(403);
    });
  });
});
