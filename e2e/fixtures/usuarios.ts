import { APIRequestContext, Locator, Page, expect, request, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './auth';

type Credenciales = { username: string; password: string };
type Envoltorio<T> = { service_response: { service_data: T } };
type Rol = { id: string; nombre: string; permisos: { id: string; nombre: string }[] };
type Usuario = { id: string; username: string; estado: string; roles: { id: string; nombre: string }[] };

// Contraseña de los usuarios que crean estos specs.
export const E2E_PASSWORD = 'E2Eclave-2026!';

export const usuarioE2E = (sufijo: string): Credenciales => ({
  username: `e2e-${sufijo}@qa.test`,
  password: E2E_PASSWORD,
});

export async function datos<T>(res: { json(): Promise<unknown> }): Promise<T> {
  return ((await res.json()) as Envoltorio<T>).service_response.service_data;
}

// Sin usuario usa la sesión del admin del globalSetup: cada login suma al rate limit.
export async function api(user?: Credenciales): Promise<APIRequestContext> {
  const baseURL = test.info().project.use.baseURL;
  if (!user) return request.newContext({ baseURL, storageState: ADMIN_STORAGE_STATE });
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/sign-in', { data: user });
  expect(res.ok(), `sign-in ${user.username} respondió ${res.status()}`).toBeTruthy();
  return ctx;
}

export async function rolPorNombre(a: APIRequestContext, nombre: string): Promise<Rol | undefined> {
  const roles = await datos<Rol[]>(await a.get('/api/roles'));
  return roles.find((r) => r.nombre === nombre);
}

// Crea el rol si no existe y le agrega los permisos que le falten.
export async function asegurarRol(a: APIRequestContext, nombre: string, permisos: string[]): Promise<Rol> {
  let rol = await rolPorNombre(a, nombre);
  if (!rol) {
    const res = await a.post('/api/roles', { data: { nombre, descripcion: 'E2E', permisos } });
    expect(res.ok(), `crear rol ${nombre}: ${res.status()} ${await res.text()}`).toBeTruthy();
    return (await rolPorNombre(a, nombre))!;
  }
  const faltan = permisos.filter((p) => !rol!.permisos.some((q) => q.nombre === p));
  for (const nombrePermiso of faltan) {
    const { items } = await datos<{ items: { id: string; nombre: string }[] }>(
      await a.get(`/api/permisos?search=${encodeURIComponent(nombrePermiso)}&pageSize=50`),
    );
    const permiso = items.find((p) => p.nombre === nombrePermiso)!;
    await a.put(`/api/roles/${rol.id}/permisos/${permiso.id}`);
  }
  return faltan.length ? (await rolPorNombre(a, nombre))! : rol;
}

export async function usuarioPorNombre(a: APIRequestContext, username: string): Promise<Usuario | undefined> {
  const r = await datos<{ items: Usuario[] }>(
    await a.get(`/api/usuarios?search=${encodeURIComponent(username)}&pageSize=50`),
  );
  return r.items.find((u) => u.username === username);
}

// Crea el usuario si no existe y lo deja activo.
export async function asegurarUsuario(a: APIRequestContext, username: string, roles: string[]): Promise<Usuario> {
  let u = await usuarioPorNombre(a, username);
  if (!u) {
    const res = await a.post('/api/usuarios', { data: { username, password: E2E_PASSWORD, roles } });
    expect(res.ok(), `crear usuario ${username}: ${res.status()} ${await res.text()}`).toBeTruthy();
    u = (await usuarioPorNombre(a, username))!;
  } else if (u.estado !== 'activo') {
    await a.patch(`/api/usuarios/${u.id}`, { data: { estado: 'activo' } });
  }
  return u;
}

export async function loginUI(page: Page, user: Credenciales, ruta = '/auth/login') {
  await page.goto(ruta);
  await page.getByLabel('Email').fill(user.username);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
}

// Fila con una celda que tiene exactamente ese email.
export function filaConEmail(filas: Locator, page: Page, email: string): Locator {
  return filas.filter({ has: page.getByText(email, { exact: true }) });
}
