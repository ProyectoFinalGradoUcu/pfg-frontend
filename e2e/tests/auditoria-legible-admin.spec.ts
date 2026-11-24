import { APIRequestContext, APIResponse, Locator, Page, expect, request, test } from '@playwright/test';
import { ADMIN_USER } from '../fixtures/auth';
import { cedulaUnica, crearSubalternoEnBase } from '../fixtures/personal';
import { E2E_PASSWORD, asegurarUsuario, datos, usuarioE2E } from '../fixtures/usuarios';

type Campos = Record<string, string>;
type Seccion = { titulo: string | null; campos: Campos };
type Evento = { contexto: string; resumen: string | RegExp; usuario?: string };
type Item = { id: number | string; denominacion: string };

const sufijo = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const filas = (page: Page) => page.locator('.aud__table tbody tr');

// Etiquetas que tienen que mostrar un nombre, nunca un número.
const ETIQUETAS_NOMBRE = new Set([
  'Persona', 'Familiar', 'Rol', 'Roles', 'Usuario', 'Usuarios', 'Grado', 'Escalafón', 'Situación', 'Base', 'Bases',
  'Comando', 'Permiso', 'Permisos', 'Unidad', 'Sub-unidad', 'Régimen', 'Programa', 'Unidad vuelo', 'Período',
]);

async function elegir(page: Page, placeholder: string, opcion: string) {
  const sel = page.locator('app-select', { has: page.locator('.appsel__placeholder', { hasText: placeholder }) });
  await sel.locator('.appsel__control').click();
  const buscar = sel.locator('.appsel__search input');
  if (await buscar.count()) await buscar.fill(opcion);
  await sel.getByRole('option', { name: opcion, exact: true }).click();
}

// La operación tiene que responder 2xx
async function ok(res: APIResponse, que: string): Promise<APIResponse> {
  expect(res.status(), `${que} respondió ${res.status()}: ${await res.text()}`).toBeLessThan(300);
  return res;
}

const textoProhibido = /undefined|\[object Object\]|service[ _]?request|\(id\)/i;

// Busca la fila del evento y abre el modal
async function abrirEvento(page: Page, ev: Evento): Promise<{ fila: string; modal: Locator; secciones: Seccion[] }> {
  const fila = filas(page).filter({ has: page.locator('td.aud__resumen', { hasText: ev.resumen }) }).first();
  // Si el listado falla se reintenta una vez
  for (let intento = 1; ; intento++) {
    await page.goto('/auditoria');
    await expect(filas(page).first()).toBeVisible();
    await elegir(page, 'Usuario', ev.usuario ?? ADMIN_USER.username);
    await elegir(page, 'Contexto', ev.contexto);
    const error = page.getByText('No se pudieron cargar los eventos');
    await expect(fila.or(error).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
    if (intento >= 2 || !(await error.count())) break;
    test.info().annotations.push({ type: 'reintento', description: `falló el listado de ${ev.contexto}` });
  }
  await expect(fila, `no aparece la fila "${ev.resumen}" en ${ev.contexto}`).toBeVisible({ timeout: 15_000 });

  const descripcion = (await fila.locator('td.aud__resumen').innerText()).trim();
  expect.soft(descripcion, 'descripción vacía').not.toBe('');
  expect.soft(descripcion, 'descripción con texto técnico').not.toMatch(/undefined|null|\[object|_id\b|\bid\b|service/i);
  const textoFila = (await fila.locator('td').allInnerTexts()).map((t) => t.trim()).join(' | ');

  const ver = fila.getByRole('button', { name: 'Ver' });
  const modal = page.locator('.aud__modal');
  if (!(await ver.count())) return { fila: textoFila, modal, secciones: [] };
  await ver.click();
  await expect(page.getByRole('heading', { name: 'Detalle del evento' })).toBeVisible();
  await expect(modal.locator('.aud__modal-resumen')).toHaveText(descripcion);

  const secciones = await leerSecciones(modal);
  revisarSecciones(secciones);

  // Los datos técnicos siguen mostrando el JSON crudo.
  await modal.getByRole('button', { name: 'Ver datos técnicos' }).click();
  const pre = modal.locator('pre.aud__detalle');
  await expect(pre).toBeVisible();
  const json = (await pre.textContent()) ?? '';
  expect(() => JSON.parse(json), 'el JSON técnico no parsea').not.toThrow();
  await modal.getByRole('button', { name: 'Ocultar datos técnicos' }).click();

  console.log(`\n[${ev.contexto}] FILA: ${textoFila}\nMODAL: ${JSON.stringify(secciones)}`);
  return { fila: textoFila, modal, secciones };
}

async function cerrar(page: Page) {
  await page.locator('.aud__modal-close').click();
  await expect(page.getByRole('heading', { name: 'Detalle del evento' })).toHaveCount(0);
}

// Cada sección con sus campos directos, sin los anidados.
async function leerSecciones(modal: Locator): Promise<Seccion[]> {
  return modal.locator('.aud__modal-body .aud__seccion').evaluateAll((nodos) =>
    nodos.map((n) => {
      const titulo = n.querySelector(':scope > .aud__seccion-titulo')?.textContent?.trim() ?? null;
      const campos: Record<string, string> = {};
      const dts = Array.from(n.querySelectorAll(':scope > dl > dt'));
      for (const dt of dts) {
        const dd = dt.nextElementSibling;
        campos[dt.textContent?.trim() ?? ''] = dd?.textContent?.trim() ?? '';
      }
      return { titulo, campos };
    }),
  );
}

function revisarSecciones(secciones: Seccion[]) {
  for (const s of secciones) {
    expect.soft(s.titulo ?? '', `título técnico: ${s.titulo}`).not.toMatch(textoProhibido);
    for (const [etiqueta, valor] of Object.entries(s.campos)) {
      const donde = `${s.titulo ?? '(sin título)'} > ${etiqueta}: ${valor}`;
      expect.soft(etiqueta, `etiqueta técnica en ${donde}`).not.toMatch(/^(id|identificador)$|_id\b|\(id\)|service/i);
      expect.soft(valor, `valor técnico en ${donde}`).not.toMatch(textoProhibido);
      expect.soft(valor, `valor vacío técnico en ${donde}`).not.toMatch(/^(null|undefined)$/);
      expect.soft(valor, `objeto crudo en ${donde}`).not.toMatch(/^[{[].*[}\]]$/);
      if (ETIQUETAS_NOMBRE.has(etiqueta)) {
        expect.soft(valor, `número suelto en lugar de nombre en ${donde}`).not.toMatch(/^\d+(\s*(,|→)\s*\d+)*$/);
      }
    }
  }
}

const seccion = (secciones: Seccion[], titulo: string): Campos =>
  secciones.find((s) => s.titulo === titulo)?.campos ?? {};

async function leer<T>(a: APIRequestContext, url: string): Promise<T> {
  return datos<T>(await ok(await a.get(url), `GET ${url}`));
}

// PDF mínimo válido para la validación de contenido.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
);

test.describe('auditoría legible', () => {
  test('personas: alta, edición, legajo, familiar, documento y baja', async ({ page }) => {
    test.setTimeout(240_000);
    const s = sufijo();
    const apellido = `Aud${s}`;
    const a = page.request;

    let personaId = '';
    let cedula = '';
    await test.step('alta de persona', async () => {
      ({ id: personaId, cedula } = await crearSubalternoEnBase(a, 'E.T.A.', apellido));
      const { secciones } = await abrirEvento(page, { contexto: 'Personas', resumen: `Creó la persona Sgto. Test ${apellido}` });
      const creado = seccion(secciones, 'Datos enviados');
      expect.soft(creado['Cédula']).toBe(cedula);
      expect.soft(creado['Grado'] ?? creado['Grado id'], 'el grado del alta se ve como nombre').toBe('Sgto.');
      await cerrar(page);
    });

    await test.step('edición con teléfono y grado', async () => {
      const grados = await leer<Item[]>(a, '/api/catalogos/grados');
      const sgto1 = grados.find((g) => g.denominacion === 'Sgto. 1°')!;
      await ok(await a.patch(`/api/personas/${personaId}`, { data: { telefono: '099 111 222', grado_id: Number(sgto1.id) } }), 'editar persona');
      const { secciones } = await abrirEvento(page, { contexto: 'Personas', resumen: `Modificó la persona Sgto. 1° Test ${apellido}` });
      const cambios = seccion(secciones, 'Cambios');
      expect.soft(cambios['Teléfono']).toBe('— → 099 111 222');
      expect.soft(cambios['Grado']).toBe('Sgto. → Sgto. 1°');
      // Cambiar el grado también mueve la derecha y el numor
      const extra = Object.keys(cambios).filter((k) => !['Grado', 'Teléfono', 'Derecha', 'Numor'].includes(k));
      expect.soft(extra, 'solo los campos tocados').toEqual([]);
      await cerrar(page);
    });

    await test.step('legajo militar', async () => {
      await ok(
        await a.put(`/api/personas/${personaId}/legajo-militar`, {
          data: { nivel_educativo: 'BACHILLERATO', numero_orden_egreso_eta: `OD ${s}` },
        }),
        'guardar legajo',
      );
      const { secciones } = await abrirEvento(page, { contexto: 'Legajo militar', resumen: `legajo militar de Sgto. 1° Test ${apellido}` });
      const cambios = seccion(secciones, 'Cambios');
      expect.soft(cambios['Nivel educativo'], 'nivel educativo legible').toBe('— → Bachillerato');
      expect.soft(Object.keys(cambios).join(' ')).toContain('orden');
      await cerrar(page);
    });

    // Un civil necesita un familiar militar
    const apellidoFam = `Fam${s}`;
    const { id: familiarId, cedula: cedulaFam } = await crearSubalternoEnBase(a, 'E.T.A.', apellidoFam);

    await test.step('vincular y desvincular familiar', async () => {
      await ok(await a.post(`/api/personas/${personaId}/familiares`, { data: { cedula: cedulaFam, tipo_relacion: 'Hermano' } }), 'vincular familiar');
      let ev = await abrirEvento(page, { contexto: 'Personas', resumen: new RegExp(`Vinculó a .*${apellidoFam}.* como familiar de .*${apellido}`) });
      expect.soft(ev.fila).not.toContain(`${familiarId}`);
      await cerrar(page);

      await ok(await a.delete(`/api/personas/${personaId}/familiares/${familiarId}`), 'desvincular familiar');
      ev = await abrirEvento(page, { contexto: 'Personas', resumen: new RegExp(`Desvinculó a .*${apellidoFam}.* como familiar`) });
      const quitado = ev.secciones.find((x) => /Registro eliminado|Datos anteriores/.test(x.titulo ?? ''))?.campos ?? {};
      expect.soft(quitado['Tipo de relación'], 'foto del vínculo quitado').toBe('Hermano');
      await cerrar(page);
    });

    await test.step('subir y borrar documento', async () => {
      const archivo = `aud-${s}.pdf`;
      const res = await ok(
        await a.post(`/api/personas/${personaId}/documentos`, {
          multipart: { archivo: { name: archivo, mimeType: 'application/pdf', buffer: PDF }, descripcion: `Doc ${s}` },
        }),
        'subir documento',
      );
      const doc = await datos<{ id: string | number }>(res);
      let ev = await abrirEvento(page, { contexto: 'Personas', resumen: new RegExp(`Adjuntó .*documento.*${archivo.replace('.', '\\.')}`) });
      await cerrar(page);

      await ok(await a.delete(`/api/personas/${personaId}/documentos/${doc.id}`), 'borrar documento');
      ev = await abrirEvento(page, { contexto: 'Personas', resumen: new RegExp(`Eliminó .*documento.*${archivo.replace('.', '\\.')}`) });
      const borrado = seccion(ev.secciones, 'Registro eliminado');
      expect.soft(borrado['Archivo']).toBe(archivo);
      expect.soft(borrado['Descripción']).toBe(`Doc ${s}`);
      expect.soft(borrado['Persona']).toContain(apellido);
      await cerrar(page);
    });

    // Un subalterno nuevo no se puede borrar, se prueba con un civil
    await test.step('borrado de persona', async () => {
      const cedulaCiv = cedulaUnica();
      const apellidoCiv = `Civ${s}`;
      const alta = await ok(
        await a.post('/api/personas', {
          data: {
            cedula: cedulaCiv, primer_nombre: 'Test', primer_apellido: apellidoCiv, es_civil: true, telefono: '098 765 432',
            familiares: [{ cedula, tipo_relacion: 'Hijo' }],
          },
        }),
        'alta de civil',
      );
      // El listado no trae civiles, el id sale de la respuesta
      const civilId = String((await datos<{ id: string | number }>(alta)).id);
      await ok(await a.delete(`/api/personas/${personaId}/familiares/${civilId}`), 'desvincular civil');
      await ok(await a.delete(`/api/subalternos/${civilId}`), 'borrar persona');
      const { secciones } = await abrirEvento(page, { contexto: 'Subalternos', resumen: new RegExp(`Eliminó .*${apellidoCiv}`) });
      const borrado = seccion(secciones, 'Registro eliminado');
      expect.soft(borrado['Cédula']).toBe(cedulaCiv);
      expect.soft(borrado['Primer apellido']).toBe(apellidoCiv);
      expect.soft(borrado['Teléfono']).toBe('098 765 432');
      expect.soft(borrado['Personal civil']).toBe('Sí');
      await cerrar(page);
    });
  });

  test('usuarios y roles', async ({ page }) => {
    test.setTimeout(240_000);
    const s = sufijo();
    const a = page.request;
    const rol = `E2E Aud ${s}`;
    const rol2 = `${rol} v2`;
    // Usuario fijo porque la baja es lógica
    const usuario = usuarioE2E('audleg').username;

    let rolId = '';
    await test.step('crear rol', async () => {
      await ok(await a.post('/api/roles', { data: { nombre: rol, descripcion: 'Rol de prueba', permisos: [] } }), 'crear rol');
      const roles = await leer<{ id: string; nombre: string }[]>(a, '/api/roles');
      rolId = String(roles.find((r) => r.nombre === rol)!.id);
      await abrirEvento(page, { contexto: 'Roles', resumen: `Creó el rol ${rol}` });
      await cerrar(page);
    });

    await test.step('editar nombre y descripción', async () => {
      await ok(await a.patch(`/api/roles/${rolId}`, { data: { nombre: rol2, descripcion: 'Rol editado' } }), 'editar rol');
      const { secciones } = await abrirEvento(page, { contexto: 'Roles', resumen: `Modificó el rol ${rol2}` });
      const cambios = seccion(secciones, 'Cambios');
      expect.soft(cambios['Nombre']).toBe(`${rol} → ${rol2}`);
      expect.soft(cambios['Descripción']).toBe('Rol de prueba → Rol editado');
      await cerrar(page);
    });

    await test.step('asignar y quitar permiso', async () => {
      const { items } = await leer<{ items: { id: string; nombre: string; descripcion?: string }[] }>(
        a,
        '/api/permisos?search=personas.ver&pageSize=50',
      );
      const permiso = items.find((p) => p.nombre === 'personas.ver')!;
      await ok(await a.put(`/api/roles/${rolId}/permisos/${permiso.id}`), 'asignar permiso');
      await abrirEvento(page, { contexto: 'Roles', resumen: new RegExp(`Asignó el permiso \\S.* al rol ${rol2}`) });
      await cerrar(page);
      await ok(await a.delete(`/api/roles/${rolId}/permisos/${permiso.id}`), 'quitar permiso');
      await abrirEvento(page, { contexto: 'Roles', resumen: new RegExp(`Quitó el permiso \\S.* del rol ${rol2}`) });
      await cerrar(page);
    });

    let usuarioId = '';
    await test.step('asignar y quitar rol a un usuario', async () => {
      usuarioId = String((await asegurarUsuario(a, usuario, [])).id);
      await ok(await a.patch(`/api/usuarios/${usuarioId}/unidad`, { data: { unidadIds: [] } }), 'sacar bases');
      await ok(await a.post(`/api/usuarios/${usuarioId}/roles/${rolId}`), 'asignar rol');
      await abrirEvento(page, { contexto: 'Usuarios', resumen: `Asignó el rol ${rol2} al usuario ${usuario}` });
      await cerrar(page);
      await ok(await a.delete(`/api/usuarios/${usuarioId}/roles/${rolId}`), 'quitar rol');
      await abrirEvento(page, { contexto: 'Usuarios', resumen: `Quitó el rol ${rol2} del usuario ${usuario}` });
      await cerrar(page);
    });

    await test.step('asignar bases', async () => {
      const bases = await leer<Item[]>(a, '/api/catalogos/sub-unidades');
      const [b1, b2] = bases.filter((b) => b.denominacion === 'E.T.A.' || b.denominacion.startsWith('B.A.')).slice(0, 2);
      await ok(await a.patch(`/api/usuarios/${usuarioId}/unidad`, { data: { unidadIds: [String(b1.id), String(b2.id)] } }), 'asignar bases');
      const { secciones } = await abrirEvento(page, { contexto: 'Usuarios', resumen: `al usuario ${usuario}` });
      const cambios = seccion(secciones, 'Cambios');
      expect.soft(cambios['Bases'] ?? '').toContain('— →');
      expect.soft(cambios['Bases'] ?? '').toContain(b1.denominacion);
      expect.soft(cambios['Bases'] ?? '').toContain(b2.denominacion);
      await cerrar(page);
    });

    await test.step('bloquear y desbloquear usuario', async () => {
      await ok(await a.patch(`/api/usuarios/${usuarioId}`, { data: { estado: 'bloqueado' } }), 'bloquear');
      let ev = await abrirEvento(page, { contexto: 'Usuarios', resumen: `Modificó el usuario ${usuario}` });
      expect.soft(seccion(ev.secciones, 'Cambios')['Estado']).toBe('Activo → Bloqueado');
      await cerrar(page);
      await ok(await a.patch(`/api/usuarios/${usuarioId}`, { data: { estado: 'activo' } }), 'desbloquear');
      ev = await abrirEvento(page, { contexto: 'Usuarios', resumen: `Modificó el usuario ${usuario}` });
      expect.soft(seccion(ev.secciones, 'Cambios')['Estado']).toBe('Bloqueado → Activo');
      await cerrar(page);
    });

    await test.step('eliminar rol', async () => {
      await ok(await a.delete(`/api/roles/${rolId}`), 'eliminar rol');
      const { secciones } = await abrirEvento(page, { contexto: 'Roles', resumen: `Eliminó el rol ${rol2}` });
      const borrado = seccion(secciones, 'Registro eliminado');
      expect.soft(borrado['Nombre']).toBe(rol2);
      expect.soft(borrado['Descripción']).toBe('Rol editado');
      await cerrar(page);
    });

    await test.step('bloquear con baja de usuario', async () => {
      await ok(await a.delete(`/api/usuarios/${usuarioId}`), 'baja usuario');
      const { secciones } = await abrirEvento(page, { contexto: 'Usuarios', resumen: `Eliminó el usuario ${usuario}` });
      expect.soft(seccion(secciones, 'Registro eliminado')['Usuario']).toBe(usuario);
      await cerrar(page);
    });
  });

  test('catálogos: comando y base', async ({ page }) => {
    test.setTimeout(180_000);
    const s = sufijo();
    const a = page.request;
    const comando = `Comando Aud ${s}`;
    const base = `Base Aud ${s}`;

    const resComando = await ok(await a.post('/api/catalogos/unidades', { data: { service_request: { codigo: `CA-${s}`, denominacion: comando } } }), 'crear comando');
    const comandoId = (await datos<{ id: string | number }>(resComando)).id;
    await abrirEvento(page, { contexto: 'Catálogos', resumen: `Creó el comando ${comando}` });
    await cerrar(page);

    await ok(await a.patch(`/api/catalogos/unidades/${comandoId}`, { data: { service_request: { denominacion: `${comando} v2` } } }), 'editar comando');
    let ev = await abrirEvento(page, { contexto: 'Catálogos', resumen: `Modificó el comando ${comando} v2` });
    expect.soft(seccion(ev.secciones, 'Cambios')['Denominación']).toBe(`${comando} → ${comando} v2`);
    await cerrar(page);

    const resBase = await ok(
      await a.post('/api/catalogos/sub-unidades', { data: { service_request: { unidad_id: Number(comandoId), codigo: `BA-${s}`, denominacion: base } } }),
      'crear base',
    );
    const baseId = (await datos<{ id: string | number }>(resBase)).id;
    ev = await abrirEvento(page, { contexto: 'Catálogos', resumen: `Creó la base ${base}` });
    await cerrar(page);

    await ok(await a.patch(`/api/catalogos/sub-unidades/${baseId}`, { data: { service_request: { denominacion: `${base} v2` } } }), 'editar base');
    ev = await abrirEvento(page, { contexto: 'Catálogos', resumen: `Modificó la base ${base} v2` });
    expect.soft(seccion(ev.secciones, 'Cambios')['Denominación']).toBe(`${base} → ${base} v2`);
    await cerrar(page);

    await ok(await a.patch(`/api/catalogos/sub-unidades/${baseId}`, { data: { service_request: { vigente: false } } }), 'baja lógica base');
    ev = await abrirEvento(page, { contexto: 'Catálogos', resumen: `Modificó la base ${base} v2` });
    expect.soft(seccion(ev.secciones, 'Cambios')['Vigente']).toBe('Sí → No');
    await cerrar(page);

    await ok(await a.patch(`/api/catalogos/unidades/${comandoId}`, { data: { service_request: { vigente: false } } }), 'baja lógica comando');
  });

  test('vuelos: unidad y período', async ({ page }) => {
    test.setTimeout(180_000);
    const s = sufijo();
    const a = page.request;
    const unidad = `Escuadrón Aud ${s}`;

    const resUnidad = await ok(await a.post('/api/vuelos/unidades', { data: { denominacion: unidad } }), 'crear unidad de vuelo');
    const unidadId = (await datos<{ id: string | number }>(resUnidad)).id;
    await abrirEvento(page, { contexto: 'Vuelos', resumen: `Creó la unidad de vuelo ${unidad}` });
    await cerrar(page);

    await ok(await a.patch(`/api/vuelos/unidades/${unidadId}`, { data: { denominacion: `${unidad} v2` } }), 'editar unidad de vuelo');
    let ev = await abrirEvento(page, { contexto: 'Vuelos', resumen: `Modificó la unidad de vuelo ${unidad} v2` });
    expect.soft(seccion(ev.secciones, 'Cambios')['Denominación']).toBe(`${unidad} → ${unidad} v2`);
    await cerrar(page);
    await ok(await a.patch(`/api/vuelos/unidades/${unidadId}`, { data: { vigente: false } }), 'baja unidad de vuelo');

    // Año lejano para no chocar con períodos reales.
    const anio = 2900 + Math.floor(Math.random() * 99);
    const numero = 1 + Math.floor(Math.random() * 4);
    const resPeriodo = await a.post('/api/vuelos/periodos', { data: { anio, numero } });
    test.skip(resPeriodo.status() === 409, `el período ${numero}/${anio} ya existía`);
    await ok(resPeriodo, 'crear período');
    const periodoId = (await datos<{ id: string | number }>(resPeriodo)).id;
    ev = await abrirEvento(page, { contexto: 'Vuelos', resumen: new RegExp(`Creó el período de vuelo .*${anio}`) });
    await cerrar(page);

    await ok(await a.patch(`/api/vuelos/periodos/${periodoId}`, { data: { cerrado: true } }), 'cerrar período');
    ev = await abrirEvento(page, { contexto: 'Vuelos', resumen: new RegExp(`Modificó el período de vuelo .*${anio}`) });
    expect.soft(seccion(ev.secciones, 'Cambios')['Cerrado']).toBe('No → Sí');
    await cerrar(page);

    await ok(await a.delete(`/api/vuelos/periodos/${periodoId}`), 'borrar período');
    ev = await abrirEvento(page, { contexto: 'Vuelos', resumen: new RegExp(`Eliminó el período de vuelo .*${anio}`) });
    expect.soft(seccion(ev.secciones, 'Registro eliminado')['Periodo'] ?? seccion(ev.secciones, 'Registro eliminado')['Período']).toContain(String(anio));
    await cerrar(page);
  });

  test('autenticación con usuario propio', async ({ page }) => {
    test.setTimeout(120_000);
    const user = usuarioE2E('audauth');
    const a = page.request;
    await asegurarUsuario(a, user.username, []);

    const ctx = await request.newContext({ baseURL: test.info().project.use.baseURL });
    const fallido = await ctx.post('/api/auth/sign-in', { data: { username: user.username, password: 'Incorrecta123!' } });
    expect(fallido.status()).toBe(401);
    await ok(await ctx.post('/api/auth/sign-in', { data: user }), 'login');
    await ok(
      await ctx.post('/api/auth/change-password', { data: { passwordActual: user.password, passwordNueva: `${E2E_PASSWORD}x` } }),
      'cambiar contraseña',
    );
    await ctx.dispose();
    // Vuelve a la clave original para la próxima corrida.
    const ctx2 = await request.newContext({ baseURL: test.info().project.use.baseURL });
    await ok(await ctx2.post('/api/auth/sign-in', { data: { username: user.username, password: `${E2E_PASSWORD}x` } }), 'login nueva');
    await ok(
      await ctx2.post('/api/auth/change-password', { data: { passwordActual: `${E2E_PASSWORD}x`, passwordNueva: E2E_PASSWORD } }),
      'restaurar contraseña',
    );
    await ctx2.dispose();

    await abrirEvento(page, {
      contexto: 'Autenticación',
      usuario: user.username,
      resumen: `Intento fallido de inicio de sesión con el usuario ${user.username}`,
    });
    if (await page.locator('.aud__modal').count()) await cerrar(page);
    await abrirEvento(page, { contexto: 'Autenticación', usuario: user.username, resumen: 'Cambió su contraseña' });
    if (await page.locator('.aud__modal').count()) await cerrar(page);

    // Limpieza: queda bloqueado.
    const r = await leer<{ items: { id: string; username: string }[] }>(a, `/api/usuarios?search=${encodeURIComponent(user.username)}&pageSize=50`);
    await ok(await a.delete(`/api/usuarios/${r.items.find((u) => u.username === user.username)!.id}`), 'baja usuario');
  });
});
