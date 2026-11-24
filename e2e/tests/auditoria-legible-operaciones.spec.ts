import { APIRequestContext, APIResponse, Page, expect, test } from '@playwright/test';
import { crearSubalternoEnBase } from '../fixtures/personal';
import { crearMision, crearConvocatoria } from '../fixtures/misiones';
import { inscripcionesDe } from '../fixtures/cursos';
import { haceDias, reincorporar } from '../fixtures/retiros';
import { crearComisionPorApi, crearOrdenPorApi, derechaEnGrado } from '../fixtures/ascensos';
import { api, datos } from '../fixtures/usuarios';

type Registro = {
  id: string;
  accion: string;
  contexto: string;
  entidad: string | null;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
  resumen: string | null;
  nombres: Record<string, string>;
};
type Item = { id: number | string; denominacion: string; codigo?: string };

// Etiqueta con la que la pantalla muestra cada acción en el filtro.
const ETIQUETA_ACCION: Record<string, string> = {
  CREAR: 'Creó',
  ACTUALIZAR: 'Modificó',
  ELIMINAR: 'Eliminó',
  'ascenso.registrar': 'Registró un ascenso',
  'ascenso.anular': 'Anuló un ascenso',
  'orden_ascenso.anular': 'Anuló una orden de ascenso',
  'retiro.anular': 'Anuló un retiro',
  'reincorporacion.anular': 'Anuló una reincorporación',
  'regla_ascenso.desactivar': 'Desactivó una regla de ascenso',
  'derecha.reordenar': 'Reordenó la derecha',
};

// Etiquetas del modal que tienen que mostrar un nombre, nunca un número.
const ETIQUETAS_DE_NOMBRE = new Set([
  'Persona', 'Personas', 'Curso', 'Misión', 'Convocatoria', 'Comisión', 'Grado', 'Grado anterior', 'Grado nuevo',
  'Grado de origen', 'Grado de destino', 'Sub-unidad', 'Unidad', 'Usuario', 'Módulos', 'Funcionarios', 'Motivo de baja',
  'Mision', 'Comando',
]);

const TEXTO_TECNICO = [/\(id\)/i, /\bundefined\b/, /\bnull\b/, /\[object Object\]/, /service.?request/i, /service.?response/i];

const unico = () => Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function ok<T = unknown>(res: APIResponse, que: string): Promise<T> {
  expect(res.ok(), `${que} respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  const txt = await res.text();
  if (!txt) return undefined as T;
  const json = JSON.parse(txt);
  return (json?.service_response?.service_data ?? json) as T;
}

const sr = (data: unknown) => ({ data: { service_request: data } });

async function ultimoId(a: APIRequestContext): Promise<number> {
  const r = await datos<{ items: Registro[] }>(await a.get('/api/auditoria?page=1&pageSize=1'));
  return Number(r.items[0]?.id ?? 0);
}

// Espera el evento que dejó la operación
async function eventoDespuesDe(
  a: APIRequestContext,
  marca: number,
  filtro: { contexto: string; accion: string; entidad?: string },
  extra: (r: Registro) => boolean = () => true,
): Promise<Registro> {
  const q = new URLSearchParams({ page: '1', pageSize: '50', contexto: filtro.contexto, accion: filtro.accion });
  if (filtro.entidad) q.set('entidad', filtro.entidad);
  let encontrado: Registro | undefined;
  await expect
    .poll(
      async () => {
        const r = await datos<{ items: Registro[] }>(await a.get(`/api/auditoria?${q}`));
        encontrado = r.items.filter((x) => Number(x.id) > marca && extra(x)).at(-1);
        return !!encontrado;
      },
      { message: `no apareció el evento ${JSON.stringify(filtro)}`, timeout: 15_000 },
    )
    .toBe(true);
  return encontrado!;
}

async function elegir(page: Page, placeholder: string, opcion: string) {
  const sel = page.locator('app-select', { has: page.locator('.appsel__placeholder', { hasText: placeholder }) });
  await sel.locator('.appsel__control').click();
  const buscar = sel.locator('.appsel__search input');
  if (await buscar.count()) await buscar.fill(opcion);
  await sel.getByRole('option', { name: opcion, exact: true }).click();
}

type Esperado = {
  // Lo que tiene que decir la columna Descripción.
  frase: string | RegExp;
  // Textos que tienen que estar en el cuerpo del modal.
  modal?: (string | RegExp)[];
  // Sección que tiene que aparecer
  seccion?: string;
};

// Filtra, busca la fila del evento y revisa el modal
async function verificarEnPantalla(page: Page, reg: Registro, esperado: Esperado): Promise<string> {
  expect.soft(reg.resumen, `resumen del evento ${reg.id}`).toBeTruthy();
  const resumen = reg.resumen ?? '';
  if (typeof esperado.frase === 'string') expect.soft(resumen).toBe(esperado.frase);
  else expect.soft(resumen).toMatch(esperado.frase);
  for (const t of TEXTO_TECNICO) expect.soft(resumen, `descripción con texto técnico ${t}`).not.toMatch(t);
  expect.soft(resumen, 'descripción con el fallback acción · entidad').not.toContain(' · ');

  await page.goto('/auditoria');
  await expect(page.locator('.aud__table tbody tr').first()).toBeVisible();
  await elegir(page, 'Contexto', reg.contexto);
  await elegir(page, 'Acción', ETIQUETA_ACCION[reg.accion] ?? reg.accion);

  // Con varias filas iguales se elige por la posición en la API
  const q = new URLSearchParams({ page: '1', pageSize: '20', contexto: reg.contexto, accion: reg.accion });
  const lista = await datos<{ items: Registro[] }>(await page.request.get(`/api/auditoria?${q}`));
  const indice = Math.max(0, lista.items.filter((x) => x.resumen === reg.resumen).findIndex((x) => x.id === reg.id));
  const celda = page.locator('td.aud__resumen').filter({ hasText: new RegExp(`^\\s*${esc(resumen)}\\s*$`) }).nth(indice);
  await expect(celda, `fila "${resumen}" en la tabla`).toBeVisible({ timeout: 15_000 });
  const fila = celda.locator('xpath=..');
  await expect.soft(fila.locator('td').nth(3)).toHaveText(reg.contexto);

  await fila.getByRole('button', { name: 'Ver' }).click();
  const modal = page.locator('.aud__modal');
  await expect(modal.getByRole('heading', { name: 'Detalle del evento' })).toBeVisible();
  await expect.soft(modal.locator('.aud__modal-resumen')).toHaveText(resumen);

  const cuerpo = modal.locator('.aud__modal-body');
  const titulos = (await cuerpo.locator('.aud__seccion-titulo').allTextContents()).map((t) => t.trim());
  if (esperado.seccion) expect.soft(titulos, `secciones del modal`).toContain(esperado.seccion);
  // En una edición o una baja no se creó nada.
  if (reg.accion !== 'CREAR' && reg.accion !== 'ascenso.registrar') {
    expect.soft(titulos, `"Registro creado" en un evento ${reg.accion}`).not.toContain('Registro creado');
  }
  const etiquetas = (await cuerpo.locator('dt').allTextContents()).map((t) => t.trim());
  const valores = (await cuerpo.locator('dd').allTextContents()).map((t) => t.trim());
  const texto = await cuerpo.innerText();
  for (const t of esperado.modal ?? []) {
    if (typeof t === 'string') expect.soft(texto, `modal sin "${t}"`).toContain(t);
    else expect.soft(texto, `modal sin ${t}`).toMatch(t);
  }
  for (const t of TEXTO_TECNICO) expect.soft(texto, `modal con texto técnico ${t}`).not.toMatch(t);
  for (const e of etiquetas) expect.soft(e, 'etiqueta técnica en el modal').not.toMatch(/^(Id|Identificador)$|_id$/);
  etiquetas.forEach((e, i) => {
    if (ETIQUETAS_DE_NOMBRE.has(e)) expect.soft(valores[i], `"${e}" muestra un número en vez del nombre`).not.toMatch(/^\d+$/);
    expect.soft(valores[i] ?? '', `"${e}" muestra JSON crudo`).not.toMatch(/^[[{]"/);
  });

  // Los datos técnicos siguen disponibles y son el JSON del evento.
  await modal.getByRole('button', { name: 'Ver datos técnicos' }).click();
  const pre = modal.locator('pre.aud__detalle');
  await expect(pre).toBeVisible();
  expect.soft(JSON.parse(await pre.innerText())).toEqual(reg.detalle);

  const salida = `[${reg.accion} · ${reg.contexto}] ${resumen}\n${texto.replace('Ver datos técnicos', '').replace(/\n+/g, ' | ')}`;
  console.log(salida);
  await modal.locator('.aud__modal-close').click();
  return texto;
}

async function catalogo(a: APIRequestContext, url: string): Promise<Item[]> {
  return ok<Item[]>(await a.get(url), url);
}

let A: APIRequestContext;
test.beforeAll(async () => {
  A = await api();
});
test.afterAll(async () => {
  await A?.dispose();
});
// Cada test hace varias operaciones
test.beforeEach(() => test.setTimeout(180_000));

// ───────────────────────────────── Misiones ─────────────────────────────────
test.describe('misiones', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  const s = unico();
  const nombre = `E2E AudLeg ${s}`;
  let misionId = '';
  let convId = '';
  let conv2Id = '';
  let uno: { id: string }, dos: { id: string };
  const nombrePersona = (x: string) => `Sgto. Test AudMis ${s} ${x}`;
  const convNombre = `${nombre} (orden ORD-${s})`;

  test.beforeAll(async () => {
    uno = await crearSubalternoEnBase(A, 'E.T.A.', `AudMis ${s} Uno`);
    dos = await crearSubalternoEnBase(A, 'E.T.A.', `AudMis ${s} Dos`);
  });
  test.afterAll(async () => {
    if (misionId) await A.delete(`/api/misiones/${misionId}`);
  });

  test('crear y editar misión', async ({ page }) => {
    let marca = await ultimoId(A);
    misionId = String((await crearMision(A, { nombre_mision: nombre, pais: 'Chipre' })).id);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'CREAR', entidad: 'Misión' });
    await verificarEnPantalla(page, reg, { frase: `Creó la misión ${nombre}`, modal: ['Chipre'] });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/misiones/${misionId}`, sr({ pais: 'Líbano', resolucion_cje: `RES-${s}` })), 'editar misión');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ACTUALIZAR', entidad: 'Misión' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó la misión ${nombre}`,
      seccion: 'Cambios',
      modal: ['País', 'Chipre → Líbano', `— → RES-${s}`],
    });
  });

  test('crear y editar convocatoria', async ({ page }) => {
    let marca = await ultimoId(A);
    convId = String((await crearConvocatoria(A, misionId, { numero_orden: `ORD-${s}`, fecha_salida: haceDias(20) })).id);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'CREAR', entidad: 'Convocatoria' });
    await verificarEnPantalla(page, reg, { frase: new RegExp(`^Creó la convocatoria ${esc(convNombre)}$`), modal: [`ORD-${s}`] });
    conv2Id = String((await crearConvocatoria(A, misionId, { numero_orden: `FIN-${s}` })).id);

    marca = await ultimoId(A);
    await ok(
      await A.patch(`/api/misiones/${misionId}/convocatorias/${convId}`, sr({ observaciones: 'Obs editada', boletin: `BOL-${s}` })),
      'editar convocatoria',
    );
    reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ACTUALIZAR', entidad: 'Convocatoria' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó la convocatoria ${convNombre}`,
      seccion: 'Cambios',
      modal: ['Observaciones', '— → Obs editada', `— → BOL-${s}`],
    });
  });

  test('asignar, editar y quitar funcionarios', async ({ page }) => {
    let marca = await ultimoId(A);
    await ok(
      await A.post(
        `/api/misiones/${misionId}/convocatorias/${convId}/funcionarios`,
        sr({ funcionarios: [uno, dos].map((p) => ({ persona_id: Number(p.id), numero_orden: `ORD-${s}` })) }),
      ),
      'asignar funcionarios',
    );
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'CREAR', entidad: 'Asignación a misión' });
    await verificarEnPantalla(page, reg, {
      frase: `Asignó a ${nombrePersona('Uno')} y ${nombrePersona('Dos')} a la convocatoria ${convNombre}`,
    });

    marca = await ultimoId(A);
    await ok(
      await A.patch(`/api/misiones/${misionId}/convocatorias/${convId}/funcionarios/${dos.id}`, sr({ observaciones: 'Obs personal' })),
      'editar funcionario',
    );
    reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ACTUALIZAR', entidad: 'Asignación a misión' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Modificó la asignación a misión de ${esc(nombrePersona('Dos'))}`),
      seccion: 'Cambios',
      modal: ['— → Obs personal'],
    });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/misiones/${misionId}/convocatorias/${convId}/funcionarios/${uno.id}`), 'quitar funcionario');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ELIMINAR', entidad: 'Asignación a misión' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Eliminó la asignación a misión de ${esc(nombrePersona('Uno'))}`),
      seccion: 'Registro eliminado',
      modal: [nombrePersona('Uno'), convNombre],
    });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/misiones/${misionId}/convocatorias/${convId}/funcionarios`), 'quitar a todos');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ELIMINAR', entidad: 'Asignación a misión' });
    await verificarEnPantalla(page, reg, {
      frase: `Quitó a todos los funcionarios de la convocatoria ${convNombre}`,
      seccion: 'Registro eliminado',
      modal: [nombrePersona('Dos')],
    });
  });

  test('borrar convocatoria y misión', async ({ page }) => {
    let marca = await ultimoId(A);
    await ok(await A.delete(`/api/misiones/${misionId}/convocatorias/${convId}`), 'borrar convocatoria');
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ELIMINAR', entidad: 'Convocatoria' });
    await verificarEnPantalla(page, reg, {
      frase: `Eliminó la convocatoria ${convNombre}`,
      seccion: 'Registro eliminado',
      modal: [`ORD-${s}`, 'Obs editada'],
    });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/misiones/${misionId}`), 'borrar misión');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Misiones', accion: 'ELIMINAR', entidad: 'Misión' });
    misionId = '';
    await verificarEnPantalla(page, reg, {
      frase: `Eliminó la misión ${nombre}`,
      seccion: 'Registro eliminado',
      modal: ['Líbano', `FIN-${s}`],
    });
    expect(conv2Id).toBeTruthy();
  });
});

// ───────────────────────────────── Cursos ─────────────────────────────────
test.describe('cursos', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  const s = unico();
  const nombre = `E2E AudLeg Curso ${s}`;
  let cursoId = '';
  let uno: { id: string; cedula: string }, dos: { id: string; cedula: string };
  const nombrePersona = (x: string) => `Sgto. Test AudCur ${s} ${x}`;

  test.beforeAll(async () => {
    uno = await crearSubalternoEnBase(A, 'E.T.A.', `AudCur ${s} Uno`);
    dos = await crearSubalternoEnBase(A, 'E.T.A.', `AudCur ${s} Dos`);
  });
  test.afterAll(async () => {
    if (cursoId) await A.delete(`/api/cursos/${cursoId}`);
  });

  test('crear y editar curso', async ({ page }) => {
    let marca = await ultimoId(A);
    const curso = await ok<{ id: string }>(
      await A.post('/api/cursos', { data: { nombre_curso: nombre, institucion: 'Escuela Uno', es_obligatorio: false } }),
      'crear curso',
    );
    cursoId = String(curso.id);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'CREAR', entidad: 'Curso' });
    await verificarEnPantalla(page, reg, { frase: `Creó el curso ${nombre}`, modal: ['Escuela Uno'] });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/cursos/${cursoId}`, { data: { institucion: 'Escuela Dos', es_obligatorio: true } }), 'editar curso');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'ACTUALIZAR', entidad: 'Curso' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó el curso ${nombre}`,
      seccion: 'Cambios',
      modal: ['Escuela Uno → Escuela Dos', 'Obligatorio', 'No → Sí'],
    });
  });

  test('alta y baja de módulo', async ({ page }) => {
    let marca = await ultimoId(A);
    const mod = await ok<{ id: string }>(
      await A.post(`/api/cursos/${cursoId}/modulos`, { data: { nombre_modulo: `Módulo ${s}`, descripcion: 'Intro' } }),
      'crear módulo',
    );
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'CREAR', entidad: 'Módulo de curso' });
    await verificarEnPantalla(page, reg, { frase: `Creó el módulo de curso Módulo ${s}`, modal: [`Módulo ${s}`] });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/cursos/${cursoId}/modulos/${mod.id}`), 'borrar módulo');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'ELIMINAR', entidad: 'Módulo de curso' });
    await verificarEnPantalla(page, reg, {
      frase: `Eliminó el módulo de curso Módulo ${s}`,
      seccion: 'Registro eliminado',
      modal: [nombre, 'Intro'],
    });
  });

  test('designar, calificar en lote, baja y reactivación', async ({ page }) => {
    let marca = await ultimoId(A);
    await ok(
      await A.post(`/api/cursos/${cursoId}/designaciones`, {
        data: { persona_ids: [Number(uno.id), Number(dos.id)], numero_orden: `ORD-${s}`, fecha_inicio: haceDias(60), fecha_fin: haceDias(5) },
      }),
      'designar',
    );
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'CREAR', entidad: 'Designación de curso' });
    await verificarEnPantalla(page, reg, {
      frase: `Designó a ${nombrePersona('Uno')} y ${nombrePersona('Dos')} al curso ${nombre}`,
    });

    const d1 = (await inscripcionesDe(A, uno.cedula)).find((i) => String(i.curso.id) === cursoId)!;
    const d2 = (await inscripcionesDe(A, dos.cedula)).find((i) => String(i.curso.id) === cursoId)!;
    marca = await ultimoId(A);
    await ok(
      await A.patch(`/api/cursos/${cursoId}/designaciones`, {
        data: {
          resultados: [
            { designacionId: Number(d1.id), aprobado: true, calificacion: 8 },
            { designacionId: Number(d2.id), aprobado: false, observacion: 'Faltó al examen' },
          ],
        },
      }),
      'calificar en lote',
    );
    reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'ACTUALIZAR', entidad: 'Calificación de curso' });
    await verificarEnPantalla(page, reg, {
      frase: `Registró resultados del curso ${nombre}`,
      seccion: 'Cambios',
      modal: [nombrePersona('Uno'), nombrePersona('Dos'), '8', 'Faltó al examen'],
    });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/cursos/${cursoId}/designaciones/${d2.id}/baja`, { data: { motivo: 'Baja de prueba e2e' } }), 'baja');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'ACTUALIZAR', entidad: 'Designación de curso' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Modificó la designación de curso de ${esc(nombrePersona('Dos'))}`),
      seccion: 'Cambios',
      modal: ['No → Sí', '— → Baja de prueba e2e'],
    });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/cursos/${cursoId}/designaciones/${d2.id}/reactivar`), 'reactivar');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'ACTUALIZAR', entidad: 'Designación de curso' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Modificó la designación de curso de ${esc(nombrePersona('Dos'))}`),
      seccion: 'Cambios',
      modal: ['Sí → No'],
    });

    // Mismo test para que el borrado se pruebe igual
    marca = await ultimoId(A);
    await ok(await A.delete(`/api/cursos/${cursoId}`), 'borrar curso');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Cursos', accion: 'ELIMINAR', entidad: 'Curso' });
    cursoId = '';
    await verificarEnPantalla(page, reg, {
      frase: `Eliminó el curso ${nombre}`,
      seccion: 'Registro eliminado',
      modal: ['Escuela Dos'],
    });
  });
});

// ───────────────────────────────── Destinos ─────────────────────────────────
test.describe('destinos', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  const s = unico();
  let persona: { id: string; cedula: string };
  let destinoId = '';
  let base = '';
  const nombrePersona = `Sgto. Test AudDes ${s}`;

  test.beforeAll(async () => {
    persona = await crearSubalternoEnBase(A, 'E.T.A.', `AudDes ${s}`);
  });

  test('registrar un pase, editarlo y borrarlo', async ({ page }) => {
    const bases = await catalogo(A, '/api/catalogos/sub-unidades');
    const otra = bases.find((b) => b.denominacion === 'B.A.I.') ?? bases.find((b) => b.denominacion !== 'E.T.A.')!;
    base = otra.denominacion;

    let marca = await ultimoId(A);
    const res = await A.post(
      '/api/destinos',
      sr({ persona_id: Number(persona.id), sub_unidad_id: Number(otra.id), fecha_inicio: haceDias(10), numero_orden: `OD-${s}` }),
    );
    expect(res.status(), 'pase').toBe(201);
    const destino = await ok<{ id: string }>(res, 'pase');
    destinoId = String(destino.id);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Destinos', accion: 'CREAR', entidad: 'Destino' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`${esc(nombrePersona)}.*${esc(base)}`),
      modal: [base, `OD-${s}`],
    });

    marca = await ultimoId(A);
    await ok(
      await A.patch(`/api/destinos/${destinoId}`, sr({ fecha_inicio: haceDias(8), posicion_destino: 'Jefe de sección' })),
      'editar destino',
    );
    reg = await eventoDespuesDe(A, marca, { contexto: 'Destinos', accion: 'ACTUALIZAR', entidad: 'Destino' });
    const fmt = (iso: string) => iso.split('-').reverse().join('/');
    await verificarEnPantalla(page, reg, {
      frase: `Modificó el destino de ${nombrePersona} en ${base}`,
      seccion: 'Cambios',
      modal: [`${fmt(haceDias(10))} → ${fmt(haceDias(8))}`, '— → Jefe de sección'],
    });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/destinos/${destinoId}`), 'borrar destino');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Destinos', accion: 'ELIMINAR', entidad: 'Destino' });
    await verificarEnPantalla(page, reg, {
      frase: `Eliminó el destino de ${nombrePersona} en ${base}`,
      seccion: 'Registro eliminado',
      modal: [nombrePersona, base, 'Jefe de sección', `OD-${s}`],
    });
  });
});

// ───────────────────────────────── Comisiones ─────────────────────────────────
test.describe('comisiones', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  const s = unico();
  const nombre = `E2E AudLeg Comisión ${s}`;
  let persona: { id: string };
  let comisionId = '';
  const nombrePersona = `Sgto. Test AudCom ${s}`;

  test.beforeAll(async () => {
    persona = await crearSubalternoEnBase(A, 'E.T.A.', `AudCom ${s}`);
  });
  test.afterAll(async () => {
    if (comisionId) await A.patch(`/api/comisiones/${comisionId}`, sr({ vigente: false }));
  });

  test('crear, editar y asignar', async ({ page }) => {
    let marca = await ultimoId(A);
    comisionId = await crearComisionPorApi(A, nombre);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Comisiones', accion: 'CREAR', entidad: 'Comisión' });
    await verificarEnPantalla(page, reg, { frase: `Creó la comisión ${nombre}` });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/comisiones/${comisionId}`, sr({ denominacion: `${nombre} B` })), 'editar comisión');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Comisiones', accion: 'ACTUALIZAR', entidad: 'Comisión' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó la comisión ${nombre} B`,
      seccion: 'Cambios',
      modal: [`${nombre} → ${nombre} B`],
    });

    marca = await ultimoId(A);
    const asig = await ok<{ id: string }>(
      await A.post(
        '/api/comisiones/asignaciones',
        sr({ persona_id: Number(persona.id), comision_id: Number(comisionId), fecha_inicio: haceDias(15), cargo: 'Vocal', numero_orden: `OD-${s}` }),
      ),
      'asignar a comisión',
    );
    reg = await eventoDespuesDe(A, marca, { contexto: 'Comisiones', accion: 'CREAR', entidad: 'Asignación de comisión' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`${esc(nombrePersona)}.*${esc(nombre)} B`),
      modal: ['Vocal'],
    });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/comisiones/asignaciones/${asig.id}`, sr({ cargo: 'Presidente', boletin: `RES-${s}` })), 'editar asignación');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Comisiones', accion: 'ACTUALIZAR', entidad: 'Asignación de comisión' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó la asignación de comisión de ${nombrePersona} en ${nombre} B`,
      seccion: 'Cambios',
      modal: ['Vocal → Presidente', `— → RES-${s}`],
    });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/comisiones/asignaciones/${asig.id}`), 'eliminar asignación');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Comisiones', accion: 'ELIMINAR', entidad: 'Asignación de comisión' });
    await verificarEnPantalla(page, reg, {
      frase: `Eliminó la asignación de comisión de ${nombrePersona} en ${nombre} B`,
      seccion: 'Registro eliminado',
      modal: [nombrePersona, 'Presidente', `OD-${s}`],
    });
  });
});

// ───────────────────────────────── Retiros ─────────────────────────────────
test.describe('retiros', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });
  const s = unico();
  const nombrePersona = `Sgto. Test AudRet ${s}`;
  let persona: { id: string };
  let retiroId = 0;

  test.beforeAll(async () => {
    persona = await crearSubalternoEnBase(A, 'E.T.A.', `AudRet ${s}`);
  });

  test('registrar, corregir, reincorporar y anular', async ({ page }) => {
    const motivos = await catalogo(A, '/api/catalogos/motivos-baja');
    const vol = motivos.find((m) => m.codigo === 'RETIRO_VOL')!;
    const otro = motivos.find((m) => m.codigo !== 'RETIRO_VOL' && m.codigo !== 'FALLECIMIENTO') ?? motivos.find((m) => m !== vol)!;

    let marca = await ultimoId(A);
    const r = await ok<{ id: number }>(
      await A.post('/api/retiros', sr({ persona_id: Number(persona.id), fecha_retiro: haceDias(30), motivo_baja_id: Number(vol.id) })),
      'registrar retiro',
    );
    retiroId = Number(r.id);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Retiros', accion: 'CREAR', entidad: 'Retiro' });
    await verificarEnPantalla(page, reg, { frase: `Creó el retiro de ${nombrePersona}`, modal: [vol.denominacion] });

    marca = await ultimoId(A);
    await ok(await A.patch(`/api/retiros/${retiroId}`, sr({ motivo_baja_id: Number(otro.id), numero_orden: `OD-${s}` })), 'corregir retiro');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Retiros', accion: 'ACTUALIZAR', entidad: 'Retiro' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó el retiro de ${nombrePersona}`,
      seccion: 'Cambios',
      modal: [`${vol.denominacion} → ${otro.denominacion}`, `— → OD-${s}`],
    });

    marca = await ultimoId(A);
    await reincorporar(A, retiroId);
    reg = await eventoDespuesDe(A, marca, { contexto: 'Retiros', accion: 'CREAR', entidad: 'Reincorporación' });
    await verificarEnPantalla(page, reg, { frase: new RegExp(`^Creó la reincorporación de ${esc(nombrePersona)}`) });

    marca = await ultimoId(A);
    await ok(
      await A.delete(`/api/retiros/${retiroId}/reincorporacion`, sr({ motivo_anulacion: 'Reincorporación cargada por error' })),
      'anular reincorporación',
    );
    reg = await eventoDespuesDe(A, marca, { contexto: 'Retiros', accion: 'reincorporacion.anular' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Anuló la reincorporación de ${esc(nombrePersona)}`),
      seccion: 'Datos antes de anular',
    });

    marca = await ultimoId(A);
    await ok(await A.delete(`/api/retiros/${retiroId}`, sr({ motivo_anulacion: 'Retiro cargado por error' })), 'anular retiro');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Retiros', accion: 'retiro.anular' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Anuló el retiro de ${esc(nombrePersona)}`),
      seccion: 'Datos antes de anular',
      modal: [otro.denominacion, `OD-${s}`],
    });
  });
});

// ───────────────────────────────── Ascensos ─────────────────────────────────
test.describe('ascensos', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });
  const s = unico();
  let a1: { id: string }, a2: { id: string }, a3: { id: string };
  const quien = (x: string) => `Test AudAsc ${s} ${x}`;

  test.beforeAll(async () => {
    a1 = await crearSubalternoEnBase(A, 'E.T.A.', `AudAsc ${s} Uno`);
    a2 = await crearSubalternoEnBase(A, 'E.T.A.', `AudAsc ${s} Dos`);
    a3 = await crearSubalternoEnBase(A, 'E.T.A.', `AudAsc ${s} Tres`);
  });

  test('registrar orden y anular un ascenso', async ({ page }) => {
    let marca = await ultimoId(A);
    const orden = await crearOrdenPorApi(A, a1.id, `OA-${s}-1`);
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Ascensos', accion: 'ascenso.registrar' });
    await verificarEnPantalla(page, reg, { frase: `Registró la orden de ascenso OA-${s}-1 con 1 ascenso` });

    marca = await ultimoId(A);
    await ok(await A.post(`/api/ascensos/${orden.ascensoId}/anular`, { data: { motivo: 'Anulado por el test' } }), 'anular ascenso');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Ascensos', accion: 'ascenso.anular' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Anuló el ascenso.*${esc(quien('Uno'))}`),
      seccion: 'Datos antes de anular',
      modal: [quien('Uno'), 'Sgto.', 'Sgto. 1°', `OA-${s}-1`],
    });
  });

  test('anular una orden con dos ascensos', async ({ page }) => {
    let marca = await ultimoId(A);
    const res = await A.post('/api/ascensos/ordenes', {
      data: {
        numero_orden: `OA-${s}-2`,
        fecha_orden: haceDias(1),
        funcionarios: [a2, a3].map((p) => ({ persona_id: Number(p.id), fecha_ascenso: haceDias(1), motivo_excepcion: 'Excepción de prueba E2E' })),
      },
    });
    const orden = await ok<{ id: string }>(res, 'registrar orden de 2');
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Ascensos', accion: 'ascenso.registrar' });
    await verificarEnPantalla(page, reg, { frase: `Registró la orden de ascenso OA-${s}-2 con 2 ascensos` });

    marca = await ultimoId(A);
    await ok(await A.post(`/api/ascensos/ordenes/${orden.id}/anular`, { data: { motivo: 'Orden anulada por el test' } }), 'anular orden');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Ascensos', accion: 'orden_ascenso.anular' });
    await verificarEnPantalla(page, reg, {
      frase: new RegExp(`^Anuló la orden de ascenso OA-${esc(s)}-2`),
      seccion: 'Datos antes de anular',
      modal: [quien('Dos'), quien('Tres'), `OA-${s}-2`],
    });
  });

  test('editar, activar y desactivar una regla', async ({ page }) => {
    // Regla inactiva y sin nadie en el grado, queda como estaba
    type Regla = { id: string; nombre: string; activo: boolean; notas: string | null };
    type Escalera = { grupos: { escalones: { grado_origen: { codigo: string }; funcionarios_en_grado: number; regla: Regla | null }[] }[] };
    const escalera = await ok<Escalera>(await A.get('/api/ascensos/reglas'), 'leer reglas');
    const escalon = escalera.grupos.flatMap((g) => g.escalones).find((e) => e.grado_origen.codigo === 'SDO_2DA');
    const original = escalon?.regla;
    test.skip(!original || original.activo || escalon!.funcionarios_en_grado > 0, 'la regla de soldados está en uso: no la toco');
    const nombre = original!.nombre;

    let marca = await ultimoId(A);
    const editada = await ok<{ id: string }>(
      await A.patch(`/api/ascensos/reglas/${original!.id}`, { data: { notas: `Nota e2e ${s}` } }),
      'editar regla',
    );
    const nuevaId = String(editada?.id ?? '2');
    let reg = await eventoDespuesDe(A, marca, { contexto: 'Reglas de ascenso', accion: 'ACTUALIZAR' });
    await verificarEnPantalla(page, reg, {
      frase: `Modificó la regla de ascenso ${nombre}`,
      seccion: 'Cambios',
      modal: [`→ Nota e2e ${s}`],
    });

    // Se activa, se desactiva y vuelve la nota original
    marca = await ultimoId(A);
    const activar = await A.post(`/api/ascensos/reglas/${nuevaId}/activar`);
    const m2 = await ultimoId(A);
    const desactivar = await A.post(`/api/ascensos/reglas/${nuevaId}/desactivar`);
    const restaurar = await A.patch(`/api/ascensos/reglas/${nuevaId}`, { data: { notas: original!.notas } });
    await ok(activar, 'activar regla');
    await ok(desactivar, 'desactivar regla');
    await ok(restaurar, 'restaurar nota');
    reg = await eventoDespuesDe(A, marca, { contexto: 'Reglas de ascenso', accion: 'ACTUALIZAR' });
    const reg2 = await eventoDespuesDe(A, m2, { contexto: 'Reglas de ascenso', accion: 'regla_ascenso.desactivar' });
    await verificarEnPantalla(page, reg, { frase: `Modificó la regla de ascenso ${nombre}`, seccion: 'Cambios', modal: ['No → Sí'] });
    await verificarEnPantalla(page, reg2, { frase: `Desactivó la regla de ascenso ${nombre}`, seccion: 'Cambios', modal: ['Sí → No'] });
  });
});

// ───────────────────────────────── Derecha ─────────────────────────────────
test.describe('derecha', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  const s = unico();

  test('reordenar dos funcionarios de prueba', async ({ page }) => {
    // Solo se mueven dos altas propias
    const p1 = await crearSubalternoEnBase(A, 'E.T.A.', `AudDer ${s} Uno`);
    const p2 = await crearSubalternoEnBase(A, 'E.T.A.', `AudDer ${s} Dos`);
    const escalafones = await catalogo(A, '/api/catalogos/escalafones');
    const st = escalafones.find((e) => e.denominacion === '(S.T.)')!;
    const grados = await catalogo(A, `/api/catalogos/grados?escalafon_id=${st.id}`);
    const sgto = grados.find((g) => g.denominacion === 'Sgto.')!;
    // La API pide la posición dentro del grado
    type Fila = { persona_id: string; posicion_grado: number };
    const posicion = async (id: string) => {
      const g = await ok<{ items: Fila[] }>(await A.get(`/api/configuracion-derecha/grados/${sgto.id}`), 'derecha del grado');
      return g.items.find((i) => i.persona_id === id)?.posicion_grado;
    };
    const d1 = await posicion(p1.id);
    const d2 = await posicion(p2.id);
    test.skip(d1 === undefined || d2 === undefined || d2 !== d1 + 1, `las altas no quedaron contiguas en la derecha (${d1}, ${d2})`);
    const derechaAntes = await derechaEnGrado(A, String(sgto.id), p1.id);

    const marca = await ultimoId(A);
    await ok(
      await A.patch('/api/configuracion-derecha/reordenar', {
        data: { grado_id: Number(sgto.id), persona_id: Number(p2.id), posicion: d1, motivo: `Prueba e2e ${s}` },
      }),
      'reordenar derecha',
    );
    const reg = await eventoDespuesDe(A, marca, { contexto: 'Derecha', accion: 'derecha.reordenar' });
    await verificarEnPantalla(page, reg, {
      frase: `Reordenó la derecha de Sgto.: 2 funcionarios cambiaron de posición. Motivo: Prueba e2e ${s}`,
    });
    // Alcanza con que Dos quede delante de Uno
    expect(await posicion(p2.id)).toBeLessThan((await posicion(p1.id))!);
    expect(reg.detalle?.['body']).toMatchObject({ persona_id: Number(p2.id) });
    expect(derechaAntes).toBeDefined();
  });
});
