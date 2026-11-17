import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { elegir } from '../fixtures/misiones';
import { apiAdmin, crearSubalternoEnBase } from '../fixtures/personal';
import { crearRetiro } from '../fixtures/retiros';

const filas = (page: Page) => page.locator('tr.personal-page__row--clickable');
const buscador = (page: Page) => page.getByLabel('Buscar por nombre o cédula');
const resumen = (page: Page) => page.locator('.personal-page__summary');

// Apellido al azar para encontrar solo a las personas del test.
function marca(): string {
  return Array.from({ length: 7 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
}

async function conApi<T>(fn: (api: APIRequestContext) => Promise<T>): Promise<T> {
  const api = await apiAdmin();
  try {
    return await fn(api);
  } finally {
    await api.dispose();
  }
}

async function buscar(page: Page, texto: string, cantidad: number) {
  await buscador(page).fill(texto);
  await expect(resumen(page)).toHaveText(`Mostrando ${cantidad} registros`, { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/personal');
  await expect(filas(page).first()).toBeVisible({ timeout: 15_000 });
});

test.describe('buscador', () => {
  test('encuentra sin tildes, por varias palabras y por cédula', async ({ page }) => {
    const m = marca();
    const { cedula } = await conApi((api) => crearSubalternoEnBase(api, 'E.T.A.', `Búsqueda ${m}`));

    await buscar(page, `busqueda ${m}`, 1);
    await expect(filas(page)).toContainText(cedula);
    await expect(page).toHaveURL(new RegExp(`[?&]q=busqueda(\\+|%20)${m}`));

    await buscar(page, `${m} test`, 1);
    await buscar(page, cedula, 1);
    await expect(filas(page)).toContainText(`Búsqueda ${m}`);

    await buscar(page, `${m}zzz`, 0);
    await expect(page.getByText('No hay personal que coincida con los filtros')).toBeVisible();
  });
});

test.describe('paginación', () => {
  test('pagina de a 10 y la página queda en la URL', async ({ page }) => {
    const m = marca();
    await conApi(async (api) => {
      for (let i = 0; i < 11; i++) await crearSubalternoEnBase(api, 'E.T.A.', `Pagina ${m}`);
    });

    await buscar(page, m, 11);
    await expect(filas(page)).toHaveCount(10);
    await expect(page.locator('.paginator__range')).toHaveText(/Mostrando 1–10\s+de 11/);

    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(filas(page)).toHaveCount(1);
    await expect(page).toHaveURL(/[?&]page=2/);

    await page.reload();
    await expect(filas(page)).toHaveCount(1, { timeout: 15_000 });
    await expect(buscador(page)).toHaveValue(m);
    await page.getByRole('button', { name: 'Página anterior' }).click();
    await expect(filas(page)).toHaveCount(10);
  });
});

test.describe('filtros', () => {
  test('destino y categoría se combinan y Borrar filtros los limpia', async ({ page }) => {
    const m = marca();
    await conApi(async (api) => {
      await crearSubalternoEnBase(api, 'E.T.A.', `Filtro ${m}`);
      await crearSubalternoEnBase(api, 'E.M.A.', `Filtro ${m}`);
    });
    await buscar(page, m, 2);

    const selects = page.locator('.personal-page__filters-row > app-select');
    await elegir(page, selects.nth(1), 'E.M.A. (C.A.P.)', 'E.M.A.');
    await page.keyboard.press('Escape');
    await expect(resumen(page)).toHaveText('Mostrando 1 registros');
    await expect(filas(page)).toContainText('E.M.A.');

    await elegir(page, selects.nth(0), 'Solo oficiales');
    await expect(resumen(page)).toHaveText('Mostrando 0 registros');
    await elegir(page, selects.nth(0), 'Solo subalternos');
    await expect(resumen(page)).toHaveText('Mostrando 1 registros');

    await page.getByRole('button', { name: 'Borrar filtros' }).click();
    await expect(buscador(page)).toHaveValue('');
    await buscar(page, m, 2);
  });

  test('los retirados aparecen solo con Incluir retirados', async ({ page }) => {
    const m = marca();
    await conApi(async (api) => {
      await crearSubalternoEnBase(api, 'E.T.A.', `Retirados ${m}`);
      await crearRetiro(api, `Retirados ${m}`);
    });
    await buscar(page, m, 1);

    await page.getByRole('button', { name: 'Más filtros: derecha, numor, estado y retirados' }).click();
    await page.getByText('Incluir retirados').click();
    await expect(resumen(page)).toHaveText('Mostrando 2 registros');
    await expect(filas(page).locator('.personal-page__badge--retirado')).toHaveCount(1);
    await expect(page).toHaveURL(/[?&]retirados=1/);
  });
});

test.describe('orden y navegación', () => {
  test('el encabezado Nombre ordena por apellido en las dos direcciones', async ({ page }) => {
    const m = marca();
    await conApi(async (api) => {
      for (const letra of ['B', 'C', 'A']) await crearSubalternoEnBase(api, 'E.T.A.', `Orden ${m} ${letra}`);
    });
    await buscar(page, m, 3);

    const encabezado = page.getByRole('columnheader', { name: /Nombre/ });
    await encabezado.getByRole('button').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'ascending');
    await expect(filas(page).locator('td:first-child')).toContainText([`${m} A`, `${m} B`, `${m} C`]);

    await encabezado.getByRole('button').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'descending');
    await expect(filas(page).locator('td:first-child')).toContainText([`${m} C`, `${m} B`, `${m} A`]);
  });

  test('la fila abre el perfil y Editar abre el editor', async ({ page }) => {
    const m = marca();
    const { id } = await conApi((api) => crearSubalternoEnBase(api, 'E.T.A.', `Navegar ${m}`));
    await buscar(page, m, 1);

    await filas(page).first().click();
    await expect(page).toHaveURL(new RegExp(`/personal/${id}$`));
    await expect(page.locator('h1.pd__name')).toContainText(`Navegar ${m}`);

    await page.goBack();
    await expect(resumen(page)).toHaveText('Mostrando 1 registros', { timeout: 10_000 });
    await filas(page).first().getByRole('button', { name: 'Acciones' }).click();
    await page.locator('.personal-page__menu').getByRole('button', { name: 'Editar' }).click();

    await expect(page).toHaveURL(new RegExp(`/personal/${id}\\?editar=1`));
    await expect(page.getByRole('heading', { name: /^Editar a / })).toBeVisible();
  });
});
