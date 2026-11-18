import { Page, expect, test } from '@playwright/test';
import { SIN_SESION } from '../fixtures/personal';
import { api, asegurarRol, asegurarUsuario, loginUI, rolPorNombre, usuarioE2E, usuarioPorNombre, filaConEmail } from '../fixtures/usuarios';

const LECTOR = usuarioE2E('lector');
const VISOR = usuarioE2E('visor');
const EDIT = usuarioE2E('edit');
const ROL_LECTOR = 'E2E Lector';
const ROL_VISOR = 'E2E Visor';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const a = await api();
  await asegurarRol(a, ROL_LECTOR, ['personas.ver']);
  await asegurarRol(a, ROL_VISOR, ['usuarios.ver', 'roles.ver', 'auditoria.ver']);
  await asegurarUsuario(a, LECTOR.username, [ROL_LECTOR]);
  await asegurarUsuario(a, VISOR.username, [ROL_VISOR]);
  const e = await asegurarUsuario(a, EDIT.username, [ROL_LECTOR]);
  // Para el test de edición: activo y solo con ROL_LECTOR.
  const rolV = (await rolPorNombre(a, ROL_VISOR))!;
  await a.delete(`/api/usuarios/${e.id}/roles/${rolV.id}`);
  await a.dispose();
});

// ─────────────────────────────────── Inicio ──────────────────────────────────
test.describe('inicio', () => {
  test('admin: la raíz y el link viejo al dashboard llevan a Personal', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/personal(\?|$)/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/personal(\?|$)/);
    await expect(page.locator('app-sidebar').getByText('Dashboard')).toHaveCount(0);
  });

  test.describe('con usuarios de permisos acotados', () => {
    test.use({ storageState: SIN_SESION });
    test('con un solo permiso entra a su sección y ve el menú acotado', async ({ page }) => {
      await loginUI(page, LECTOR);
      await expect(page).toHaveURL(/\/personal(\?|$)/);
      await expect(page.locator('app-sidebar').getByText('Auditoría')).toHaveCount(0);
      await expect(page.locator('app-sidebar').getByText('Usuarios y Roles')).toHaveCount(0);
      await expect(page.locator('app-sidebar .sidebar__item--trigger', { hasText: 'Personal' })).toBeVisible();
    });

    test('sin Personal entra a la primera sección que tenga', async ({ page }) => {
      await loginUI(page, VISOR);
      await expect(page).toHaveURL(/\/auditoria/);
    });
  });
});

// ───────────────────────────── Usuarios y roles ──────────────────────────────
async function abrirTab(page: Page, nombre: string) {
  await page.goto('/usuarios-y-roles');
  await page.locator('.ur__tab', { hasText: nombre }).click();
}

async function filaRol(page: Page, nombre: string) {
  const fila = page.locator('.ur__table tbody tr', { has: page.locator('.ur__rol-badge', { hasText: new RegExp(`^\\s*${nombre}\\s*$`) }) });
  // La tabla de roles pagina en el cliente de a 10. Se arranca de una carga limpia.
  await abrirTab(page, 'Roles y Permisos');
  await expect(page.locator('.ur__rol-badge').first()).toBeVisible();
  for (let i = 0; i < 10 && !(await fila.count()); i++) {
    const sig = page.getByRole('button', { name: 'Página siguiente' });
    if (!(await sig.isVisible()) || (await sig.isDisabled())) break;
    await sig.click();
  }
  return fila;
}

test.describe('usuarios y roles', () => {
  test('el buscador filtra por email y el filtro de estado combina', async ({ page }) => {
    await page.goto('/usuarios-y-roles');
    await expect(page.getByRole('heading', { name: 'Gestión de Usuarios y Roles' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar por nombre o email' }).fill('e2e-');
    const filas = page.locator('.ur__table tbody tr');
    await expect(filaConEmail(filas, page, LECTOR.username)).toHaveCount(1);
    await expect(filas.filter({ hasText: 'admin@fau.mil.uy' })).toHaveCount(0);

    // Estado Bloqueado: el lector (activo) desaparece.
    await page.locator('.ur__filtros app-select').nth(1).locator('.appsel__control').click();
    await page.getByRole('option', { name: 'Bloqueado' }).click();
    await expect(filaConEmail(filas, page, LECTOR.username)).toHaveCount(0);

    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(page.getByRole('textbox', { name: 'Buscar por nombre o email' })).toHaveValue('');
  });

  test('editar usuario: agregar un rol y deshabilitarlo/reactivarlo queda en el servidor', async ({ page }) => {
    await page.goto('/usuarios-y-roles');
    await page.getByRole('textbox', { name: 'Buscar por nombre o email' }).fill(EDIT.username);
    const fila = filaConEmail(page.locator('.ur__table tbody tr'), page, EDIT.username);
    await expect(fila).toHaveCount(1);
    await fila.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Usuario' })).toBeVisible();

    const rolesSel = page.locator('.modal__field').first().locator('app-select');
    await rolesSel.locator('.appsel__control').click();
    await rolesSel.locator('.appsel__search input').fill(ROL_VISOR);
    await rolesSel.getByRole('option', { name: ROL_VISOR }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Usuario' })).toHaveCount(0);
    await expect(fila).toContainText(ROL_VISOR);

    const a = await api();
    let u = (await usuarioPorNombre(a, EDIT.username))!;
    expect(u.roles.map((r) => r.nombre).sort()).toEqual([ROL_LECTOR, ROL_VISOR].sort());

    // Deshabilitar (con confirmación) y reactivar.
    await fila.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Deshabilitar usuario' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deshabilitar' }).click();
    await expect(fila).toContainText('bloqueado');
    u = (await usuarioPorNombre(a, EDIT.username))!;
    expect(u.estado).toBe('bloqueado');

    await fila.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Reactivar usuario' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivar' }).click();
    await expect(fila).toContainText('activo');
    u = (await usuarioPorNombre(a, EDIT.username))!;
    expect(u.estado).toBe('activo');
    await a.dispose();
  });

  test('editar usuario: contraseña corta muestra error y no guarda', async ({ page }) => {
    await page.goto('/usuarios-y-roles');
    await page.getByRole('textbox', { name: 'Buscar por nombre o email' }).fill(EDIT.username);
    await filaConEmail(page.locator('.ur__table tbody tr'), page, EDIT.username).getByRole('button', { name: 'Editar' }).click();
    await page.locator('input[formcontrolname=nuevaPassword]').fill('corta');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.locator('.modal__error')).toHaveText(/al menos 8 caracteres/);
  });

  test('nuevo usuario: email inválido no se envía', async ({ page }) => {
    let enviados = 0;
    page.on('request', (r) => r.method() === 'POST' && /invitaciones|usuarios/.test(r.url()) && enviados++);
    await page.goto('/usuarios-y-roles');
    await page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    await page.locator('input[formcontrolname=username]').fill('no-es-email');
    await page.getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Usuario' })).toBeVisible();
    expect(enviados).toBe(0);
  });

  test('roles: crear, editar permisos, renombrar y eliminar desde la UI', async ({ page }) => {
    const nombre = `E2E RolUI ${Date.now() % 100000}`;
    await abrirTab(page, 'Roles y Permisos');
    await page.getByRole('button', { name: 'Crear rol' }).click();
    await page.locator('input[formcontrolname=nombre]').fill(nombre);
    await page.locator('input[formcontrolname=descripcion]').fill('E2E');
    await page.locator('.modal').getByRole('button', { name: /crear|guardar/i }).last().click();
    await expect(page.locator('.modal')).toHaveCount(0);

    let fila = await filaRol(page, nombre);
    await expect(fila).toHaveCount(1);
    await expect(fila.locator('.ur__count-badge').first()).toHaveText('0');

    // Editar permisos: marcar auditoria.ver.
    await fila.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await page.locator('.ur__dropdown-item', { hasText: 'Editar permisos' }).click();
    await expect(page).toHaveURL(/\/usuarios-y-roles\/roles\/\d+\/permisos/);
    await page.getByPlaceholder('Buscar permiso...').fill('auditoria.ver');
    const check = page.locator('.epr__table tbody tr', { hasText: 'auditoria.ver' }).locator('input[type=checkbox]');
    await expect(check).toHaveCount(1);
    await check.check();
    await expect(check).toBeChecked();
    await page.reload();
    await page.getByPlaceholder('Buscar permiso...').fill('auditoria.ver');
    await expect(page.locator('.epr__table tbody tr', { hasText: 'auditoria.ver' }).locator('input[type=checkbox]')).toBeChecked();

    const a = await api();
    const rol = (await rolPorNombre(a, nombre))!;
    expect(rol.permisos.map((p) => p.nombre)).toEqual(['auditoria.ver']);

    // Renombrar.
    await abrirTab(page, 'Roles y Permisos');
    fila = await filaRol(page, nombre);
    await fila.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await page.locator('.ur__dropdown-item', { hasText: /^\s*Editar\s*$/ }).click();
    await page.locator('input[formcontrolname=descripcion]').fill('E2E editado');
    await page.locator('.modal').getByRole('button', { name: /guardar/i }).last().click();
    await expect(page.locator('.modal')).toHaveCount(0);
    await expect(fila).toContainText('E2E editado');

    // Eliminar (con confirmación).
    await fila.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await page.locator('.ur__dropdown-item', { hasText: 'Eliminar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.locator('.ur__rol-badge', { hasText: nombre })).toHaveCount(0);
    expect(await rolPorNombre(a, nombre)).toBeUndefined();
    await a.dispose();
  });

  test('el rol Administrador no deja tocar sus permisos', async ({ page }) => {
    const a = await api();
    const admin = (await rolPorNombre(a, 'Administrador del sistema'))!;
    await a.dispose();
    await page.goto(`/usuarios-y-roles/roles/${admin.id}/permisos`);
    await expect(page.getByText('tiene todos los permisos y no se pueden modificar')).toBeVisible();
    const checks = page.locator('.epr__table input[type=checkbox]');
    await expect(checks.first()).toBeVisible();
    for (const c of await checks.all()) await expect(c).toBeDisabled();
  });

  test.describe('con solo permisos de lectura', () => {
    test.use({ storageState: SIN_SESION });
    test('ve usuarios y roles pero sin acciones, y no entra a editar permisos', async ({ page }) => {
      await loginUI(page, VISOR);
      await expect(page).toHaveURL(/\/auditoria/);
      await page.goto('/usuarios-y-roles');
      await expect(page.locator('.ur__table tbody tr').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nuevo Usuario' })).toHaveCount(0);
      await expect(page.locator('.ur__table').getByRole('button', { name: 'Editar' })).toHaveCount(0);
      await page.locator('.ur__tab', { hasText: 'Roles y Permisos' }).click();
      await expect(page.getByRole('button', { name: 'Crear rol' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Acciones' })).toHaveCount(0);

      const a = await api();
      const admin = (await rolPorNombre(a, 'Administrador del sistema'))!;
      await a.dispose();
      await page.goto(`/usuarios-y-roles/roles/${admin.id}/permisos`);
      await expect(page).toHaveURL(/\/auditoria/);
    });
  });
});
