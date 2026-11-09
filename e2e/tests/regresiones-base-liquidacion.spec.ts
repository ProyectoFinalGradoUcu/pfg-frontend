import { APIRequestContext, expect, request, test } from '@playwright/test';
import { login } from '../fixtures/auth';
import { SIN_SESION, apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';

const DEMO_PASSWORD = 'FAUdemo1!';
const OPERADOR_CAL = { username: 'operador.cal@fau.mil.uy', password: DEMO_PASSWORD };
const CONSULTA_CG = { username: 'consulta.cg@fau.mil.uy', password: DEMO_PASSWORD };

type Envoltorio<T> = { service_response: { service_data: T } };

async function apiComo(usuario: { username: string; password: string }): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: test.info().project.use.baseURL });
  const res = await api.post('/api/auth/sign-in', { data: usuario });
  expect(res.ok(), `login de ${usuario.username} respondió ${res.status()}`).toBeTruthy();
  return api;
}

test.describe('regresiones de la base de liquidación', () => {
  test.use({ storageState: SIN_SESION });

  test('el Operador de Personal de la demo puede ver y cargar horas de vuelo', async () => {
    const api = await apiComo(OPERADOR_CAL);
    const res = await api.get('/api/vuelos/periodos');
    expect(res.status(), 'GET /vuelos/periodos con operador.cal').toBe(200);
    await api.dispose();
  });

  test('el usuario de Consulta de la demo puede ver las horas de vuelo', async () => {
    const api = await apiComo(CONSULTA_CG);
    const res = await api.get('/api/vuelos/periodos');
    expect(res.status(), 'GET /vuelos/periodos con consulta.cg').toBe(200);
    await api.dispose();
  });

  test('el Operador de Personal ve Vuelos en el menú', async ({ page }) => {
    await login(page, OPERADOR_CAL);
    await expect(page.locator('app-sidebar').getByText('Vuelos', { exact: true })).toBeVisible();
  });

  test('la demo trae al personal ordenado en la derecha', async () => {
    const api = await apiAdmin();
    // Solo las cédulas del seed: las altas de otros e2e ya reciben derecha.
    const res = await api.get('/api/configuracion-derecha/personal');
    expect(res.ok()).toBeTruthy();
    const personal = ((await res.json()) as Envoltorio<{ cedula: string; derecha: number | null }[]>)
      .service_response.service_data;
    const delSeed = personal.filter((p) => p.cedula.startsWith('6000') && p.derecha !== null);
    expect(delSeed.length, 'personas del seed con derecha').toBeGreaterThan(0);
    await api.dispose();
  });

  test('la previa del retiro nombra la base que se cierra y no el comando', async () => {
    const api = await apiAdmin();
    const { id } = await crearSubalternoEnBase(api, 'E.T.A.', 'Previa Retiro');

    const res = await api.get(`/api/retiros/previa/${id}?fecha_retiro=2026-12-01`);
    expect(res.ok(), `previa respondió ${res.status()}`).toBeTruthy();
    const previa = ((await res.json()) as Envoltorio<{ destino_vigente: unknown }>).service_response.service_data;

    expect(JSON.stringify(previa.destino_vigente)).toContain('E.T.A.');
    await api.dispose();
  });
});
