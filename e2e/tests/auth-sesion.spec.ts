import { expect, test } from '@playwright/test';
import { SIN_SESION } from '../fixtures/personal';
import { api, asegurarRol, asegurarUsuario, datos, loginUI, rolPorNombre, usuarioE2E } from '../fixtures/usuarios';

const LECTOR = usuarioE2E('lector');
const SESION = usuarioE2E('sesion');
const BLOQ = usuarioE2E('bloq');
const ROL_LECTOR = 'E2E Lector';
const ROL_SESION = 'E2E Sesion';

test.describe.configure({ mode: 'serial' });

test.describe('auth: login / logout / sesión expirada', () => {
  test.use({ storageState: SIN_SESION });

  test.beforeAll(async () => {
    const a = await api();
    await asegurarRol(a, ROL_LECTOR, ['personas.ver']);
    await asegurarRol(a, ROL_SESION, ['personas.ver', 'auditoria.ver']);
    await asegurarUsuario(a, LECTOR.username, [ROL_LECTOR]);
    await asegurarUsuario(a, SESION.username, [ROL_SESION]);
    const b = await asegurarUsuario(a, BLOQ.username, [ROL_LECTOR]);
    const res = await a.patch(`/api/usuarios/${b.id}`, { data: { estado: 'bloqueado' } });
    expect(res.ok(), `bloquear: ${res.status()} ${await res.text()}`).toBeTruthy();
    await a.dispose();
  });

  test('el formulario vacío no envía nada', async ({ page }) => {
    let pedidos = 0;
    page.on('request', (r) => r.url().includes('/auth/sign-in') && pedidos++);
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await page.getByLabel('Email').fill('no-es-un-mail');
    await page.getByLabel('Contraseña').fill('123');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(pedidos).toBe(0);
  });

  test('login con returnUrl vuelve a la ruta pedida', async ({ page }) => {
    await page.goto('/personal');
    await expect(page).toHaveURL(/returnUrl=%2Fpersonal/);
    await page.getByLabel('Email').fill(LECTOR.username);
    await page.getByLabel('Contraseña').fill(LECTOR.password);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page).toHaveURL(/\/personal(\?|$)/);
  });

  test('con sesión, /auth/login manda al dashboard', async ({ page }) => {
    await loginUI(page, LECTOR);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('un usuario sin permiso de la sección vuelve al dashboard', async ({ page }) => {
    await loginUI(page, LECTOR);
    await expect(page).toHaveURL(/\/dashboard/);
    for (const ruta of ['/auditoria', '/usuarios-y-roles', '/personal/configuracion-derecha']) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/dashboard/);
    }
  });

  test('usuario bloqueado ve el motivo', async ({ page }) => {
    await loginUI(page, BLOQ);
    await expect(page.getByRole('alert')).toHaveText(/Usuario bloqueado|inactivo/);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('cerrar sesión: vuelve al login, protege rutas y el token viejo ya no sirve', async ({ page, context }) => {
    await loginUI(page, SESION);
    await expect(page).toHaveURL(/\/dashboard/);
    const viejo = (await context.cookies()).find((c) => c.name === 'auth_token');
    expect(viejo, 'cookie auth_token').toBeTruthy();

    await page.getByRole('button', { name: 'Cerrar Sesión' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    expect((await context.cookies()).find((c) => c.name === 'auth_token')).toBeFalsy();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fdashboard/);

    // El token anterior ya no sirve.
    const res = await page.request.get('/api/auth/me', { headers: { cookie: `auth_token=${viejo!.value}` } });
    expect(res.status()).toBe(401);
  });

  test('sesión expirada por cambio de permisos: redirige al login con el motivo', async ({ page }) => {
    await loginUI(page, SESION);
    await expect(page).toHaveURL(/\/dashboard/);

    // Sacarle un permiso al rol invalida las sesiones de quienes lo tienen.
    const a = await api();
    const rol = (await rolPorNombre(a, ROL_SESION))!;
    const permiso = rol.permisos.find((p) => p.nombre === 'auditoria.ver')!;
    const res = await a.delete(`/api/roles/${rol.id}/permisos/${permiso.id}`);
    expect(res.ok(), `quitar permiso: ${res.status()}`).toBeTruthy();

    try {
      // Sin recargar: la próxima request da 401 y el interceptor manda al login.
      await page.locator('app-sidebar .sidebar__item--trigger', { hasText: 'Personal' }).click();
      await page.locator('app-sidebar .sidebar__sub-item').first().click();
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
      await expect(page.getByRole('status')).toContainText(/sesión/i);
    } finally {
      // Se devuelve el permiso para poder volver a correrlo.
      await a.put(`/api/roles/${rol.id}/permisos/${permiso.id}`);
      await a.dispose();
    }
  });

  test('cookie borrada en caliente: la próxima request lleva al login', async ({ page, context }) => {
    await loginUI(page, LECTOR);
    await expect(page).toHaveURL(/\/dashboard/);
    await context.clearCookies();
    // Sin recargar: el front cree que hay sesión y el backend no.
    await page.locator('app-sidebar .sidebar__item--trigger', { hasText: 'Personal' }).click();
    await page.locator('app-sidebar .sidebar__sub-item').first().click();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
  });

  test('olvidé mi contraseña es accesible desde el login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test('404 sin sesión no manda al login y con sesión se ve dentro del layout', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');
    await expect(page).toHaveURL(/ruta-que-no-existe/);
    await expect(page.locator('app-sidebar')).toHaveCount(0);

    await loginUI(page, LECTOR);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/otra-ruta-inexistente');
    await expect(page).toHaveURL(/otra-ruta-inexistente/);
    await expect(page.locator('app-sidebar')).toBeVisible();
  });

  test('el login corta al 11.º intento del minuto para el mismo usuario', async ({ request }) => {
    // Usuario inexistente y distinto en cada corrida: no bloquea ninguna cuenta.
    const username = `e2e-noexiste-${Date.now()}@qa.test`;
    const codigos: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await request.post('/api/auth/sign-in', { data: { username, password: 'Nada12345!' } });
      codigos.push(r.status());
    }
    expect(codigos.slice(0, 10).every((c) => c === 401), codigos.join(',')).toBe(true);
    expect(codigos[10]).toBe(429);

    // Otro usuario desde la misma IP puede seguir entrando.
    const otro = await request.post('/api/auth/sign-in', {
      data: { username: `e2e-otro-${Date.now()}@qa.test`, password: 'Nada12345!' },
    });
    expect(otro.status()).toBe(401);
  });
});
