import { APIRequestContext, Page, expect, request, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './auth';

/** Usuarios del seed de demo. Todos menos el admin comparten la contraseña. */
const DEMO_PASSWORD = 'FAUdemo1!';
const demo = (nombre: string) => ({ username: `${nombre}@fau.mil.uy`, password: DEMO_PASSWORD });

export const USUARIOS = {
  jefePersonal: demo('jefe.personal'),
  jefeBai: demo('jefe.bai'),
  supervisorBaiEta: demo('supervisor.bai.eta'),
};

/** Sin sesión: para specs que entran con otro usuario. */
export const SIN_SESION = { cookies: [], origins: [] };

// Arranca en un valor al azar para que dos workers no choquen en el mismo milisegundo.
let secuencia = Math.floor(Math.random() * 100);

/**
 * Cédula de 8 dígitos que empieza con 7. La base es compartida y los tests se
 * vuelven a correr, así que sale del reloj más un contador por proceso.
 */
export function cedulaUnica(): string {
  secuencia = (secuencia + 1) % 100;
  const reloj = Date.now() % 100_000;
  return `7${String(reloj).padStart(5, '0')}${String(secuencia).padStart(2, '0')}`;
}

type Envoltorio<T> = { service_response: { service_data: T } };
type Item = { id: number | string; codigo?: string; denominacion: string };
type Base = Item & { comando: { denominacion: string } };

async function leer<T>(api: APIRequestContext, url: string): Promise<T> {
  const res = await api.get(url);
  expect(res.ok(), `GET ${url} respondió ${res.status()}`).toBeTruthy();
  return ((await res.json()) as Envoltorio<T>).service_response.service_data;
}

/** Contexto HTTP con la sesión del admin, para preparar datos sin pasar por la UI. */
export async function apiAdmin(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: ADMIN_STORAGE_STATE,
  });
}

/** Busca el id de una persona por cédula (el admin ve todo el padrón). */
export async function idPorCedula(api: APIRequestContext, cedula: string): Promise<string> {
  const data = await leer<{ items: { id: string; cedula: string }[] }>(
    api,
    `/api/personas?search=${cedula}&incluir_inactivos=true`,
  );
  const persona = data.items.find((p) => p.cedula === cedula);
  expect(persona, `no se encontró la cédula ${cedula}`).toBeTruthy();
  return String(persona!.id);
}

/**
 * Da de alta por API un subalterno (Sgto. de S.T.) en la base indicada, por ejemplo
 * "E.T.A.", y devuelve su id y cédula.
 */
export async function crearSubalternoEnBase(
  api: APIRequestContext,
  base: string,
  apellido = 'Prueba E2E',
): Promise<{ id: string; cedula: string }> {
  const [bases, escalafones, situaciones, regimenes, programas] = await Promise.all([
    leer<Base[]>(api, '/api/catalogos/sub-unidades'),
    leer<Item[]>(api, '/api/catalogos/escalafones'),
    leer<Item[]>(api, '/api/catalogos/situaciones'),
    leer<Item[]>(api, '/api/catalogos/regimenes'),
    leer<Item[]>(api, '/api/catalogos/programas'),
  ]);
  const escalafon = escalafones.find((e) => e.denominacion === '(S.T.)')!;
  const grados = await leer<Item[]>(api, `/api/catalogos/grados?escalafon_id=${escalafon.id}`);

  const cedula = cedulaUnica();
  const res = await api.post('/api/personas', {
    data: {
      cedula,
      primer_nombre: 'Test',
      primer_apellido: apellido,
      es_civil: false,
      tipo_funcionario: 'subalterno',
      regimen_id: Number(regimenes[0].id),
      programa_id: Number(programas[0].id),
      escalafon_id: Number(escalafon.id),
      grado_id: Number(grados.find((g) => g.denominacion === 'Sgto.')!.id),
      situacion_id: Number(situaciones.find((s) => s.denominacion === 'Personal Subalterno en actividad.')!.id),
      sub_unidad_id: Number(bases.find((b) => b.denominacion === base)!.id),
      fecha_inicio: '2020-03-01',
      tiene_mando: false,
    },
  });
  expect(res.ok(), `alta de ${cedula} respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  return { id: await idPorCedula(api, cedula), cedula };
}

export async function esperarPerfil(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Editar Perfil' })).toBeVisible({ timeout: 15_000 });
}
