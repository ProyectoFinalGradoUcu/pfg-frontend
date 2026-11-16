import { APIRequestContext, Locator, expect, test } from '@playwright/test';
import { encabezados, leerWorkbook } from '../fixtures/excel';
import { apiAdmin, cedulaUnica, crearSubalternoEnBase, idPorCedula } from '../fixtures/personal';
import {
  abrirImportar,
  completarPlantilla,
  descargar,
  elegirArchivo,
  esperarResumen,
  leerApi,
  procesar,
  valorDeLista,
} from '../fixtures/reportes';

type Carga = { nombre: string; ruta: string; plantilla: string; archivo: string; hoja: string; columnas: string[] };

const CARGAS: Record<'personal' | 'cursos' | 'misiones' | 'destinos', Carga> = {
  personal: {
    nombre: 'Personal',
    ruta: '/personal',
    plantilla: '/api/personas/plantilla',
    archivo: 'plantilla_personal.xlsx',
    hoja: 'Personal',
    columnas: ['Cédula', 'Primer nombre', 'Primer apellido', 'Tipo de personal', 'Base'],
  },
  cursos: {
    nombre: 'Cursos',
    ruta: '/cursos/inscripciones',
    plantilla: '/api/cursos/carga-masiva/plantilla',
    archivo: 'plantilla_historial_cursos.xlsx',
    hoja: 'Historial de cursos',
    columnas: ['Cédula', 'Curso', 'Resultado', 'Calificación'],
  },
  misiones: {
    nombre: 'Misiones',
    ruta: '/misiones/catalogo',
    plantilla: '/api/misiones/carga-masiva/plantilla',
    archivo: 'plantilla_misiones.xlsx',
    hoja: 'Participantes',
    columnas: ['Misión', 'Cédula', 'Fecha de salida', 'Fecha de llegada'],
  },
  destinos: {
    nombre: 'Destinos',
    ruta: '/destinos/asignaciones',
    plantilla: '/api/destinos/carga-masiva/plantilla',
    archivo: 'plantilla_destinos.xlsx',
    hoja: 'Destinos',
    columnas: ['Cédula', 'Destino', 'Fecha de inicio', 'Fecha de fin'],
  },
};

const unico = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const fecha = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia));
// Empieza con 6: cedulaUnica() usa el 7, así que no existe.
const cedulaInexistente = () => cedulaUnica().replace(/^7/, '6');

async function plantilla(api: APIRequestContext, carga: Carga) {
  const res = await api.get(carga.plantilla);
  expect(res.ok(), `plantilla ${carga.nombre} respondió ${res.status()}`).toBeTruthy();
  return leerWorkbook(await res.body());
}

function fila(modal: Locator, numero: number): Locator {
  return modal.locator('.cm-table tbody tr').filter({ has: modal.page().locator('td:first-child', { hasText: new RegExp(`^${numero}$`) }) });
}

async function esperarErrorEnFila(modal: Locator, numero: number, mensaje: string | RegExp) {
  await expect(fila(modal, numero).locator('.cm-badge')).toHaveText('Error');
  await expect(fila(modal, numero).locator('.cm-table__msg')).toContainText(mensaje);
}

test.describe('plantillas', () => {
  for (const carga of Object.values(CARGAS)) {
    test(`${carga.nombre}: se descarga la plantilla con sus hojas y títulos`, async ({ page }) => {
      const modal = await abrirImportar(page, carga.ruta);
      const { nombre, buffer } = await descargar(page, modal.getByRole('button', { name: 'Descargar plantilla .xlsx' }));
      expect(nombre).toBe(carga.archivo);

      const wb = await leerWorkbook(buffer);
      const hojas = wb.worksheets.map((w: { name: string }) => w.name);
      expect(hojas).toEqual(expect.arrayContaining([carga.hoja, 'Instrucciones', 'Ejemplo', 'Listas']));
      expect(encabezados(wb, carga.hoja)).toEqual(expect.arrayContaining(carga.columnas));
      await expect(modal.locator('.cm-error')).toHaveCount(0);
    });
  }
});

test.describe('archivos que no sirven', () => {
  test('un archivo que no es .xlsx se rechaza antes de subirlo', async ({ page }) => {
    const modal = await abrirImportar(page, CARGAS.cursos.ruta);
    await elegirArchivo(modal, 'datos.csv', Buffer.from('a,b\n1,2'), 'text/csv');
    await expect(modal.locator('.cm-error')).toHaveText('El archivo tiene que ser un Excel .xlsx (usá la plantilla).');
    await expect(modal.getByRole('button', { name: 'Procesar archivo' })).toBeDisabled();
  });

  test('la plantilla sin filas avisa que no hay datos', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.cursos);
    await api.dispose();

    const modal = await abrirImportar(page, CARGAS.cursos.ruta);
    await elegirArchivo(modal, 'vacia.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
    await modal.getByRole('button', { name: 'Procesar archivo' }).click();
    await expect(modal.locator('.cm-error')).toContainText('no tiene datos');
    await expect(modal.locator('.cm-summary')).toHaveCount(0);
  });

  // Falla: el backend responde un "Validation failed (... expected type is ...)" en inglés y contradictorio.
  test.fixme('un .xlsx corrupto da un error entendible en español', async ({ page }) => {
    const modal = await abrirImportar(page, CARGAS.cursos.ruta);
    await elegirArchivo(modal, 'corrupto.xlsx', Buffer.from('esto no es un excel'));
    await modal.getByRole('button', { name: 'Procesar archivo' }).click();
    await expect(modal.locator('.cm-error')).toBeVisible();
    await expect(modal.locator('.cm-error')).not.toContainText('Validation failed');
    await expect(modal.locator('.cm-error')).toContainText(/Excel/);
  });
});

test.describe('carga de personal', () => {
  async function filaPersonal(api: APIRequestContext, cedula: string, extra: Record<string, unknown> = {}) {
    const wb = await plantilla(api, CARGAS.personal);
    return {
      wb,
      valores: {
        'Cédula': cedula,
        'Primer nombre': 'Test',
        'Primer apellido': 'Carga Masiva E2E',
        'Tipo de personal': 'Subalterno',
        'Régimen': 'Ley Nueva',
        'Base': valorDeLista(wb, 'Base', /E\.T\.A\./),
        'Programa': 'Programa 300',
        'Situación': 'Personal Subalterno en actividad.',
        'Escalafón': '(S.T.)',
        'Grado': 'Sgto.',
        'Fecha de ingreso': fecha(2021, 4, 1),
        ...extra,
      },
    };
  }

  test('un Excel válido carga todas las filas y quedan en el padrón', async ({ page }) => {
    const api = await apiAdmin();
    const cedulas = [cedulaUnica(), cedulaUnica()];
    const { wb, valores } = await filaPersonal(api, cedulas[0]);
    const archivo = await completarPlantilla(wb, 'Personal', [valores, { ...valores, 'Cédula': cedulas[1] }]);

    const modal = await abrirImportar(page, CARGAS.personal.ruta);
    await procesar(modal, 'personal.xlsx', archivo);
    await esperarResumen(modal, 2, 0);
    await expect(modal.getByLabel('Mostrar solo las filas con error')).toHaveCount(0);
    for (const cedula of cedulas) {
      await expect(modal.locator('.cm-table tbody tr', { hasText: cedula }).locator('.cm-badge')).toHaveText('OK');
    }

    for (const cedula of cedulas) {
      const id = await idPorCedula(api, cedula);
      const destinos = await leerApi<{ sub_unidad: string; activo: boolean }[]>(api, `/api/personas/${id}/destinos`);
      expect(destinos).toEqual([expect.objectContaining({ sub_unidad: 'E.T.A.', activo: true })]);
    }
    await api.dispose();

    await modal.getByRole('button', { name: 'Listo' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('las filas con error muestran el motivo y no se cargan', async ({ page }) => {
    const api = await apiAdmin();
    const sinBase = cedulaUnica();
    const { wb, valores } = await filaPersonal(api, '12-abc');
    const archivo = await completarPlantilla(wb, 'Personal', [
      valores,
      { ...valores, 'Cédula': sinBase, 'Base': '' },
      { ...valores, 'Cédula': cedulaUnica(), 'Tipo de personal': 'Marciano' },
    ]);

    const modal = await abrirImportar(page, CARGAS.personal.ruta);
    await procesar(modal, 'personal-errores.xlsx', archivo);
    await esperarResumen(modal, 0, 3);
    await esperarErrorEnFila(modal, 2, 'no es válida');
    await esperarErrorEnFila(modal, 3, 'Base');
    await esperarErrorEnFila(modal, 4, 'Tipo de personal');
    await expect(modal.getByText('Las filas con error no se cargaron.')).toBeVisible();

    const res = await api.get(`/api/personas?search=${sinBase}&incluir_inactivos=true`);
    expect((await res.json()).service_response.service_data.items).toEqual([]);
    await api.dispose();
  });

  test('un código postal demasiado largo da un error entendible', async ({ page }) => {
    const api = await apiAdmin();
    const { wb, valores } = await filaPersonal(api, cedulaUnica(), { 'Código postal': '123456789012345' });
    const archivo = await completarPlantilla(wb, 'Personal', [valores]);
    await api.dispose();

    const modal = await abrirImportar(page, CARGAS.personal.ruta);
    await procesar(modal, 'personal-cp.xlsx', archivo);
    await esperarErrorEnFila(modal, 2, 'código postal');
    await expect(fila(modal, 2).locator('.cm-table__msg')).not.toContainText('prisma');
  });
});

test.describe('carga de historial de cursos', () => {
  test.describe.configure({ mode: 'serial' });
  const nombreCurso = `E2E Curso Carga ${unico()}`;
  let cursoId = '';
  let persona = { id: '', cedula: '' };

  test.beforeAll(async () => {
    const api = await apiAdmin();
    const res = await api.post('/api/cursos', { data: { nombre_curso: nombreCurso, institucion: 'E2E', es_obligatorio: false } });
    expect(res.ok(), `crear curso respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
    cursoId = (await res.json()).service_response.service_data.id;
    persona = await crearSubalternoEnBase(api, 'E.T.A.', 'Cursos Carga E2E');
    await api.dispose();
  });

  test.afterAll(async () => {
    if (!cursoId) return;
    const api = await apiAdmin();
    await api.delete(`/api/cursos/${cursoId}`);
    await api.dispose();
  });

  test('un Excel válido carga el curso en el historial del funcionario', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.cursos);
    expect(valorDeLista(wb, 'Curso', new RegExp(nombreCurso))).toBe(nombreCurso);
    const archivo = await completarPlantilla(wb, CARGAS.cursos.hoja, [
      {
        'Cédula': persona.cedula,
        'Curso': nombreCurso,
        'Resultado': 'Aprobado',
        'Fecha de inicio': fecha(2019, 3, 1),
        'Fecha de fin': fecha(2019, 11, 30),
        'Calificación': '8',
        'N.º de orden': 'E2E-ORD-1',
      },
    ]);

    const modal = await abrirImportar(page, CARGAS.cursos.ruta);
    await procesar(modal, 'cursos.xlsx', archivo);
    await esperarResumen(modal, 1, 0);
    await expect(fila(modal, 2).locator('.cm-badge')).toHaveText('OK');

    const cursos = await leerApi<{ curso_id: number; aprobado: boolean; calificacion: string; numero_orden: string }[]>(
      api,
      `/api/personas/${persona.id}/cursos`,
    );
    expect(cursos).toEqual([
      expect.objectContaining({ curso_id: Number(cursoId), aprobado: true, calificacion: '8', numero_orden: 'E2E-ORD-1' }),
    ]);
    await api.dispose();
  });

  test('las filas con error muestran el motivo y no se cargan', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.cursos);
    const archivo = await completarPlantilla(wb, CARGAS.cursos.hoja, [
      { 'Cédula': cedulaInexistente(), 'Curso': nombreCurso, 'Resultado': 'Aprobado' },
      { 'Cédula': persona.cedula, 'Curso': `${nombreCurso} que no existe`, 'Resultado': 'Aprobado' },
      { 'Cédula': persona.cedula, 'Curso': nombreCurso, 'Resultado': 'Aprobado', 'Fecha de inicio': fecha(2020, 5, 1), 'Fecha de fin': fecha(2020, 1, 1) },
    ]);

    const modal = await abrirImportar(page, CARGAS.cursos.ruta);
    await procesar(modal, 'cursos-errores.xlsx', archivo);
    await esperarResumen(modal, 0, 3);
    await esperarErrorEnFila(modal, 2, 'No hay ningún funcionario con cédula');
    await esperarErrorEnFila(modal, 3, 'no existe');
    await esperarErrorEnFila(modal, 4, 'La fecha de fin es anterior a la fecha de inicio.');
    await api.dispose();
  });

  // Falla: la calificación es texto libre; en el resto del sistema es un entero de 1 a 10.
  test.fixme('una calificación que no es nota da error en la fila', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.cursos);
    const archivo = await completarPlantilla(wb, CARGAS.cursos.hoja, [
      { 'Cédula': persona.cedula, 'Curso': nombreCurso, 'Resultado': 'Aprobado', 'Calificación': 'Muy bueno' },
    ]);
    await api.dispose();

    const modal = await abrirImportar(page, CARGAS.cursos.ruta);
    await procesar(modal, 'cursos-calificacion.xlsx', archivo);
    await esperarResumen(modal, 0, 1);
    await esperarErrorEnFila(modal, 2, 'Calificación');
  });
});

test.describe('carga de misiones', () => {
  test.describe.configure({ mode: 'serial' });
  const nombreMision = `E2E Mision Carga ${unico()}`;
  let persona = { id: '', cedula: '' };

  test.beforeAll(async () => {
    const api = await apiAdmin();
    persona = await crearSubalternoEnBase(api, 'E.T.A.', 'Misiones Carga E2E');
    await api.dispose();
  });

  test.afterAll(async () => {
    if (!persona.id) return;
    const api = await apiAdmin();
    const misiones = await leerApi<{ mision_id: string; nombre_mision: string }[]>(api, `/api/personas/${persona.id}/misiones`);
    for (const m of misiones.filter((m) => m.nombre_mision.startsWith('E2E Mision Carga'))) {
      await api.delete(`/api/misiones/${m.mision_id}`);
    }
    await api.dispose();
  });

  test('un Excel válido crea la misión con el participante', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.misiones);
    const archivo = await completarPlantilla(wb, CARGAS.misiones.hoja, [
      {
        'Misión': nombreMision,
        'País': 'Uruguay',
        'N.º de orden de la convocatoria': 'E2E-MIS-1',
        'Fecha de salida': fecha(2019, 3, 1),
        'Fecha de llegada': fecha(2019, 9, 30),
        'Cédula': persona.cedula,
      },
    ]);

    const modal = await abrirImportar(page, CARGAS.misiones.ruta);
    await procesar(modal, 'misiones.xlsx', archivo);
    await esperarResumen(modal, 1, 0);
    await expect(fila(modal, 2).locator('.cm-badge')).toHaveText('OK');

    const misiones = await leerApi<object[]>(api, `/api/personas/${persona.id}/misiones`);
    expect(misiones).toEqual([
      expect.objectContaining({
        nombre_mision: nombreMision,
        numero_orden: 'E2E-MIS-1',
        fecha_salida: '2019-03-01',
        fecha_llegada: '2019-09-30',
        finalizada: true,
      }),
    ]);
    await api.dispose();
  });

  test('las filas con error muestran el motivo y no se cargan', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.misiones);
    const base = { 'Misión': nombreMision, 'País': 'Uruguay', 'N.º de orden de la convocatoria': 'E2E-MIS-2' };
    const archivo = await completarPlantilla(wb, CARGAS.misiones.hoja, [
      { ...base, 'Fecha de salida': fecha(2018, 3, 1), 'Fecha de llegada': fecha(2018, 9, 30), 'Cédula': cedulaInexistente() },
      { ...base, 'Fecha de salida': fecha(2018, 9, 30), 'Fecha de llegada': fecha(2018, 3, 1), 'Cédula': persona.cedula },
    ]);

    const modal = await abrirImportar(page, CARGAS.misiones.ruta);
    await procesar(modal, 'misiones-errores.xlsx', archivo);
    await esperarResumen(modal, 0, 2);
    await esperarErrorEnFila(modal, 2, 'No hay ningún funcionario con cédula');
    await esperarErrorEnFila(modal, 3, 'La fecha de llegada es anterior a la de salida.');

    const misiones = await leerApi<{ numero_orden: string }[]>(api, `/api/personas/${persona.id}/misiones`);
    expect(misiones.map((m) => m.numero_orden)).not.toContain('E2E-MIS-2');
    await api.dispose();
  });
});

test.describe('carga de destinos', () => {
  test.describe.configure({ mode: 'serial' });
  let persona = { id: '', cedula: '' };

  test.beforeAll(async () => {
    const api = await apiAdmin();
    persona = await crearSubalternoEnBase(api, 'E.T.A.', 'Destinos Carga E2E');
    await api.dispose();
  });

  test.afterAll(async () => {
    if (!persona.id) return;
    const api = await apiAdmin();
    const destinos = await leerApi<{ id: string; numero_orden: string | null }[]>(api, `/api/personas/${persona.id}/destinos`);
    for (const d of destinos.filter((d) => d.numero_orden?.startsWith('E2E-DES'))) {
      await api.delete(`/api/destinos/${d.id}`);
    }
    await api.dispose();
  });

  test('un Excel válido agrega el destino al historial', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.destinos);
    const archivo = await completarPlantilla(wb, CARGAS.destinos.hoja, [
      {
        'Cédula': persona.cedula,
        'Destino': valorDeLista(wb, 'Destino', /E\.T\.A\./),
        'Fecha de inicio': fecha(2010, 1, 1),
        'Fecha de fin': fecha(2010, 12, 31),
        'N.º de orden': 'E2E-DES-1',
      },
    ]);

    const modal = await abrirImportar(page, CARGAS.destinos.ruta);
    await procesar(modal, 'destinos.xlsx', archivo);
    await esperarResumen(modal, 1, 0);
    await expect(fila(modal, 2).locator('.cm-badge')).toHaveText('OK');

    const destinos = await leerApi<object[]>(api, `/api/personas/${persona.id}/destinos`);
    expect(destinos).toContainEqual(
      expect.objectContaining({
        sub_unidad: 'E.T.A.',
        fecha_inicio: '2010-01-01',
        fecha_fin: '2010-12-31',
        numero_orden: 'E2E-DES-1',
        activo: false,
      }),
    );
    // El destino actual del alta sigue igual.
    expect(destinos).toContainEqual(expect.objectContaining({ fecha_fin: null, activo: true }));
    await api.dispose();
  });

  test('las filas con error muestran el motivo y no se cargan', async ({ page }) => {
    const api = await apiAdmin();
    const wb = await plantilla(api, CARGAS.destinos);
    const archivo = await completarPlantilla(wb, CARGAS.destinos.hoja, [
      { 'Cédula': persona.cedula, 'Destino': 'Destino E2E inexistente', 'Fecha de inicio': fecha(2008, 1, 1), 'N.º de orden': 'E2E-DES-2' },
      {
        'Cédula': persona.cedula,
        'Destino': valorDeLista(wb, 'Destino', /E\.T\.A\./),
        'Fecha de inicio': fecha(2007, 5, 1),
        'Fecha de fin': fecha(2007, 1, 1),
        'N.º de orden': 'E2E-DES-3',
      },
    ]);

    const modal = await abrirImportar(page, CARGAS.destinos.ruta);
    await procesar(modal, 'destinos-errores.xlsx', archivo);
    await esperarResumen(modal, 0, 2);
    await esperarErrorEnFila(modal, 2, 'no existe');
    await esperarErrorEnFila(modal, 3, 'La fecha de fin es anterior a la fecha de inicio.');

    const destinos = await leerApi<{ numero_orden: string | null }[]>(api, `/api/personas/${persona.id}/destinos`);
    expect(destinos.map((d) => d.numero_orden)).not.toContain('E2E-DES-2');
    expect(destinos.map((d) => d.numero_orden)).not.toContain('E2E-DES-3');
    await api.dispose();
  });
});
