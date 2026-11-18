import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import { borrarCursoSiExiste, crearAlumno, cursoPorNombre, inscripcionesDe } from '../fixtures/cursos';

const uid = Date.now().toString(36);
const CURSO = `E2E Curso ${uid}`;
const INSTITUCION = `E2E Escuela ${uid}`;
// Fechas pasadas: el botón "Cargar resultado" aparece recién cuando el curso terminó.
const INICIO = '2026-01-05';
const FIN = '2026-02-20';

type Alumno = { id: string; cedula: string; nombre: string };
let api: APIRequestContext;
let individual: Alumno;
let masivo: Alumno;
let baja: Alumno;

const modal = (page: Page) => page.locator('.modal__card');
const toast = (page: Page, texto: string) => page.locator('.toast__message', { hasText: texto });

async function abrirCatalogo(page: Page, filtro = CURSO): Promise<Locator> {
  await page.goto('/cursos/catalogo');
  await expect(page.getByRole('heading', { name: 'Catálogo de Cursos' })).toBeVisible();
  await page.getByPlaceholder('Nombre del curso...').fill(filtro);
  const fila = page.locator('.cursos__table tbody tr', { hasText: filtro });
  await expect(fila).toHaveCount(1, { timeout: 10_000 });
  return fila;
}

async function accion(page: Page, fila: Locator, nombre: string) {
  await fila.getByRole('button', { name: 'Acciones' }).click();
  await page.locator('.cursos__dropdown-item', { hasText: nombre }).click();
}

async function elegirPersonas(page: Page, nombres: string[]) {
  const control = modal(page).locator('app-select[formcontrolname=persona_ids] .appsel__control');
  await control.click();
  const panel = page.locator('.appsel__dropdown');
  for (const nombre of nombres) {
    await panel.getByPlaceholder('Buscar...').fill(nombre);
    await panel.locator('.appsel__option', { hasText: nombre }).click();
  }
  await control.click();
  await expect(panel).toHaveCount(0);
}

async function filtrarInscripciones(page: Page, cedula: string): Promise<Locator> {
  await page.goto('/cursos/inscripciones');
  await expect(page.getByRole('heading', { name: 'Inscripciones' })).toBeVisible();
  await page.getByPlaceholder('Filtrar por cédula...').fill(cedula);
  const filas = page.locator('.cursos__table tbody tr');
  await expect(filas.filter({ hasText: CURSO })).toHaveCount(1, { timeout: 10_000 });
  await expect(filas).toHaveCount(1);
  return filas.first();
}

test.describe.serial('cursos', () => {
  test.beforeAll(async () => {
    api = await apiAdmin();
    [individual, masivo, baja] = await Promise.all([
      crearAlumno(api, `E2E Individual ${uid}`),
      crearAlumno(api, `E2E Masivo ${uid}`),
      crearAlumno(api, `E2E Baja ${uid}`),
    ]);
  });

  test.afterAll(async () => {
    await borrarCursoSiExiste(api, CURSO);
    await borrarCursoSiExiste(api, `${CURSO} invertido`);
    await api.dispose();
  });

  test('crear curso valida nombre vacío y duplicado', async ({ page }) => {
    await page.goto('/cursos/catalogo');
    await page.getByRole('button', { name: 'Nuevo Curso' }).click();
    const m = modal(page);

    await m.getByRole('button', { name: 'Crear Curso' }).click();
    await expect(m.locator('.modal__error')).toHaveText('Completá todos los campos requeridos');

    await m.locator('input[formcontrolname=nombre_curso]').fill(CURSO);
    await m.locator('input[formcontrolname=institucion]').fill(INSTITUCION);
    await m.getByRole('button', { name: 'Crear Curso' }).click();
    await expect(toast(page, `Curso "${CURSO}" creado correctamente`)).toBeVisible();
    await expect(m).toHaveCount(0);
    await expect(page.locator('.cursos__table tbody tr', { hasText: CURSO })).toHaveCount(1);

    const curso = await cursoPorNombre(api, CURSO);
    expect(curso).toMatchObject({ institucion: INSTITUCION, es_obligatorio: false });

    // Mismo nombre en minúsculas: el back lo rechaza sin distinguir mayúsculas.
    await page.getByRole('button', { name: 'Nuevo Curso' }).click();
    await m.locator('input[formcontrolname=nombre_curso]').fill(CURSO.toLowerCase());
    await m.locator('input[formcontrolname=institucion]').fill(INSTITUCION);
    await m.getByRole('button', { name: 'Crear Curso' }).click();
    await expect(m.locator('.modal__error')).toContainText('Ya existe un curso con nombre');
    await m.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('crear con "Designar ahora" y fechas invertidas no deja el curso creado', async ({ page }) => {
    const nombre = `${CURSO} invertido`;
    await page.goto('/cursos/catalogo');
    await page.getByRole('button', { name: 'Nuevo Curso' }).click();
    const m = modal(page);
    await m.locator('input[formcontrolname=nombre_curso]').fill(nombre);
    await m.locator('input[formcontrolname=institucion]').fill(INSTITUCION);
    await m.getByRole('switch').nth(1).click();
    await m.locator('input[formcontrolname=numero_orden]').fill(`E2E-${uid}`);
    await m.locator('input[formcontrolname=fecha_inicio]').fill(FIN);
    await m.locator('input[formcontrolname=fecha_fin]').fill(INICIO);
    await elegirPersonas(page, [individual.nombre]);
    await m.getByRole('button', { name: 'Crear Curso' }).click();

    await expect(m.locator('.modal__error')).toContainText('fecha de fin');
    expect(await cursoPorNombre(api, nombre)).toBeUndefined();
  });

  test('editar curso: valida nombre vacío y guarda los cambios', async ({ page }) => {
    const fila = await abrirCatalogo(page);
    await accion(page, fila, 'Editar');
    const m = modal(page);
    await expect(m.getByRole('heading', { name: 'Editar Curso' })).toBeVisible();

    await m.locator('input[formcontrolname=nombre_curso]').fill('');
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(m.locator('.modal__error')).toHaveText('Completá todos los campos requeridos');

    await m.locator('input[formcontrolname=nombre_curso]').fill(CURSO);
    await m.locator('input[formcontrolname=institucion]').fill(`${INSTITUCION} editada`);
    await m.getByRole('switch').click();
    await m.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(toast(page, 'Curso actualizado')).toBeVisible();
    await expect(fila).toContainText(`${INSTITUCION} editada`);
    await expect(fila).toContainText('Obligatorio');

    expect(await cursoPorNombre(api, CURSO)).toMatchObject({
      institucion: `${INSTITUCION} editada`,
      es_obligatorio: true,
    });
  });

  test('buscar por nombre e institución filtra el catálogo', async ({ page }) => {
    const fila = await abrirCatalogo(page, uid);
    await expect(fila).toContainText(CURSO);

    await page.getByPlaceholder('Institución...').fill('no-existe-institucion');
    await expect(page.getByText('No se encontraron cursos con esos filtros')).toBeVisible();

    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(page.getByPlaceholder('Nombre del curso...')).toHaveValue('');
    await page.getByPlaceholder('Institución...').fill(`${INSTITUCION} editada`);
    await expect(page.locator('.cursos__table tbody tr')).toHaveCount(1);
    await expect(page.locator('.cursos__table tbody tr')).toContainText(CURSO);
  });

  test('módulos: agregar valida el nombre y los numera en orden', async ({ page }) => {
    const fila = await abrirCatalogo(page);
    await accion(page, fila, 'Módulos');
    const m = modal(page);
    await expect(m.getByText('Este curso no tiene módulos cargados.')).toBeVisible();

    await m.getByRole('button', { name: 'Agregar módulo' }).click();
    await expect(m.locator('.modal__error')).toHaveText('El nombre del módulo es requerido');

    await m.locator('input[formcontrolname=nombre]').fill('E2E Módulo uno');
    await m.locator('input[formcontrolname=descripcion]').fill('Teórico');
    await m.getByRole('button', { name: 'Agregar módulo' }).click();
    const items = m.locator('.cursos__modulo-item');
    await expect(items).toHaveCount(1);
    await expect(m.locator('input[formcontrolname=nombre]')).toHaveValue('');

    await m.locator('input[formcontrolname=nombre]').fill('E2E Módulo dos');
    await m.getByRole('button', { name: 'Agregar módulo' }).click();
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('1E2E Módulo unoTeórico');
    await expect(items.nth(1)).toContainText('2E2E Módulo dos');

    const curso = await cursoPorNombre(api, CURSO);
    expect(curso!.modulos_curso.map((x) => [x.orden_modulo, x.nombre_modulo])).toEqual([
      [1, 'E2E Módulo uno'],
      [2, 'E2E Módulo dos'],
    ]);
  });

  test('designar: valida fechas invertidas y designa a tres personas', async ({ page }) => {
    const fila = await abrirCatalogo(page);
    await accion(page, fila, 'Designar / Dictar');
    const m = modal(page);

    await m.getByRole('button', { name: 'Designar', exact: true }).click();
    await expect(m.locator('.modal__error')).toHaveText('Las fechas de inicio y fin son obligatorias.');

    await m.locator('input[formcontrolname=fecha_inicio]').fill(FIN);
    await m.locator('input[formcontrolname=fecha_fin]').fill(INICIO);
    await m.getByRole('button', { name: 'Designar', exact: true }).click();
    await expect(m.locator('.modal__error')).toHaveText('Debés ingresar al menos el N° de orden o el boletín.');

    await m.locator('input[formcontrolname=numero_orden]').fill(`E2E-${uid}`);
    await m.getByRole('button', { name: 'Designar', exact: true }).click();
    await expect(m.locator('.modal__error')).toHaveText('Seleccioná al menos una persona.');

    await elegirPersonas(page, [individual.nombre, masivo.nombre, baja.nombre]);
    await expect(m.locator('.appsel__value')).toBeVisible();
    await m.getByRole('button', { name: 'Designar', exact: true }).click();
    await expect(m.locator('.modal__error')).toHaveText('La fecha de fin no puede ser anterior a la fecha de inicio');

    await m.locator('input[formcontrolname=fecha_inicio]').fill(INICIO);
    await m.locator('input[formcontrolname=fecha_fin]').fill(FIN);
    await m.getByLabel('1. E2E Módulo uno').check();
    await m.getByRole('button', { name: 'Designar', exact: true }).click();
    await expect(toast(page, 'Designación registrada: 3 persona(s)')).toBeVisible();
    await expect(m).toHaveCount(0);

    for (const alumno of [individual, masivo, baja]) {
      const [insc] = (await inscripcionesDe(api, alumno.cedula)).filter((i) => i.curso.nombre_curso === CURSO);
      expect(insc, `sin inscripción para ${alumno.cedula}`).toMatchObject({
        aprobado: null,
        dado_de_baja: false,
      });
    }
  });

  test('designar encuentra a un Sgto. recién dado de alta', async ({ page }) => {
    const sgto = await crearSubalternoEnBase(api, 'E.T.A.', `E2E Sgto ${uid}`);
    const fila = await abrirCatalogo(page);
    await accion(page, fila, 'Designar / Dictar');
    await modal(page).locator('app-select[formcontrolname=persona_ids] .appsel__control').click();
    await page.locator('.appsel__dropdown').getByPlaceholder('Buscar...').fill(`E2E Sgto ${uid}`);
    await expect(page.locator('.appsel__option', { hasText: `E2E Sgto ${uid}` })).toHaveCount(1);
    expect(sgto.cedula).toBeTruthy();
  });

  test('inscripciones: el filtro por cédula muestra la designación', async ({ page }) => {
    const fila = await filtrarInscripciones(page, individual.cedula);
    await expect(fila).toContainText(individual.nombre);
    await expect(fila).toContainText(individual.cedula);
    await expect(fila).toContainText(`${INSTITUCION} editada`);
    await expect(fila).toContainText('5/1/2026');
    await expect(fila).toContainText('20/2/2026');
    await expect(fila).toContainText('Obligatorio');
    await expect(fila.getByRole('button', { name: 'Cargar resultado' })).toBeVisible();

    await page.getByRole('button', { name: 'Limpiar filtro' }).click();
    await page.getByPlaceholder('Filtrar por cédula...').fill('00000000');
    await expect(page.getByText('No se encontraron cursos para esa cédula')).toBeVisible();
  });

  test('calificar individual: aprobado con nota y observación', async ({ page }) => {
    const fila = await filtrarInscripciones(page, individual.cedula);
    await fila.getByRole('button', { name: 'Cargar resultado' }).click();
    const m = modal(page);
    await expect(m.getByRole('heading', { name: 'Cargar resultado' })).toBeVisible();
    await expect(m.getByRole('button', { name: 'Guardar resultado' })).toBeDisabled();

    await m.getByRole('button', { name: 'Aprobado', exact: true }).click();
    await m.getByPlaceholder('Entre 1 y 10').fill('11');
    await m.getByRole('button', { name: 'Guardar resultado' }).click();
    await expect(m.locator('.modal__error')).toHaveText('La calificación debe ser un número entero entre 1 y 10');

    await m.getByPlaceholder('Entre 1 y 10').fill('8');
    await m.getByPlaceholder('Ej: no alcanzó el mínimo de asistencia').fill('E2E buen desempeño');
    await m.getByRole('button', { name: 'Guardar resultado' }).click();
    await expect(toast(page, 'Resultado registrado correctamente')).toBeVisible();
    await expect(fila.locator('.cursos__calificacion-badge')).toHaveText('Aprobado · 8');
    await expect(fila.getByRole('button', { name: 'Cargar resultado' })).toHaveCount(0);

    const [insc] = (await inscripcionesDe(api, individual.cedula)).filter((i) => i.curso.nombre_curso === CURSO);
    expect(insc).toMatchObject({ aprobado: true, calificacion: 8, observacion: 'E2E buen desempeño' });

    const recargada = await filtrarInscripciones(page, individual.cedula);
    await expect(recargada.locator('.cursos__calificacion-badge')).toHaveText('Aprobado · 8');
    await expect(recargada.locator('.cursos__calificacion-badge')).toHaveAttribute('title', 'E2E buen desempeño');
  });

  test('calificación masiva: exige el resultado y guarda desaprobado con nota', async ({ page }) => {
    await filtrarInscripciones(page, masivo.cedula);
    await page.getByRole('button', { name: /^Calificación masiva/ }).click();
    const m = modal(page);
    await m.locator('select.cursos__cal-masiva-select').selectOption({ label: `${CURSO} — ${INSTITUCION} editada` });

    const fila = m.locator('.cursos__cal-masiva-table tbody tr');
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText(masivo.cedula);

    await fila.getByLabel(`Nota de ${masivo.nombre}`).fill('4');
    await expect(m.locator('.modal__warning')).toContainText('1 fila(s) con nota pero sin aprobado/desaprobado');
    await expect(m.getByRole('button', { name: 'Guardar 0 resultado(s)' })).toBeDisabled();

    await m.getByRole('button', { name: 'Desaprobar todos' }).click();
    await m.getByRole('button', { name: 'Guardar 1 resultado(s)' }).click();
    await expect(toast(page, '1 resultado(s) registrado(s) correctamente')).toBeVisible();
    await expect(m).toHaveCount(0);
    await expect(page.locator('.cursos__table tbody tr .cursos__calificacion-badge')).toHaveText('Desaprobado · 4');

    const [insc] = (await inscripcionesDe(api, masivo.cedula)).filter((i) => i.curso.nombre_curso === CURSO);
    expect(insc).toMatchObject({ aprobado: false, calificacion: 4 });
  });

  test('dar de baja una inscripción, verla en bajas y reactivarla', async ({ page }) => {
    const fila = await filtrarInscripciones(page, baja.cedula);
    await fila.getByRole('button', { name: 'Dar de baja' }).click();
    const m = modal(page);
    await m.getByPlaceholder('Ej: Solicito la baja por confusión al inscribirlo.').fill('abc');
    await m.getByRole('button', { name: 'Confirmar baja' }).click();
    await expect(m.locator('.modal__error')).toHaveText('El motivo es obligatorio (mínimo 5 caracteres).');

    await m.getByPlaceholder('Ej: Solicito la baja por confusión al inscribirlo.').fill('E2E inscripto por error');
    await m.getByRole('button', { name: 'Confirmar baja' }).click();
    await expect(toast(page, `${baja.nombre} fue dado de baja del curso`)).toBeVisible();
    await expect(page.getByText('No se encontraron cursos para esa cédula')).toBeVisible();

    let [insc] = (await inscripcionesDe(api, baja.cedula)).filter((i) => i.curso.nombre_curso === CURSO);
    expect(insc).toMatchObject({ dado_de_baja: true, motivo_baja: 'E2E inscripto por error' });

    await page.getByRole('button', { name: 'Ver bajas' }).click();
    await expect(page.getByRole('button', { name: 'Ocultar bajas' })).toBeVisible();
    const filaBaja = page.locator('.cursos__table tbody tr', { hasText: CURSO });
    await expect(filaBaja.locator('.cursos__baja-badge')).toHaveText('Dado de baja');
    await expect(filaBaja.locator('.cursos__baja-badge')).toHaveAttribute('title', /Motivo: E2E inscripto por error/);
    await expect(filaBaja.getByRole('button', { name: 'Cargar resultado' })).toHaveCount(0);

    page.once('dialog', (d) => d.accept());
    await filaBaja.getByRole('button', { name: 'Reactivar' }).click();
    await expect(toast(page, `Inscripción de ${baja.nombre} reactivada`)).toBeVisible();
    await expect(filaBaja.locator('.cursos__baja-badge')).toHaveCount(0);
    await expect(filaBaja.getByRole('button', { name: 'Dar de baja' })).toBeVisible();

    [insc] = (await inscripcionesDe(api, baja.cedula)).filter((i) => i.curso.nombre_curso === CURSO);
    expect(insc.dado_de_baja).toBe(false);
  });

  test('eliminar el curso lo saca del catálogo y borra sus inscripciones', async ({ page }) => {
    const fila = await abrirCatalogo(page);
    await accion(page, fila, 'Eliminar');
    const m = modal(page);
    await expect(m.getByRole('heading', { name: 'Eliminar curso' })).toBeVisible();
    await m.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(toast(page, `Curso "${CURSO}" eliminado`)).toBeVisible();
    await expect(page.getByText('No se encontraron cursos con esos filtros')).toBeVisible();

    expect(await cursoPorNombre(api, CURSO)).toBeUndefined();
    const restantes = (await inscripcionesDe(api, individual.cedula)).filter((i) => i.curso.nombre_curso === CURSO);
    expect(restantes).toHaveLength(0);
  });
});
