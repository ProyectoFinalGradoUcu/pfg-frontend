import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { Workbook, encabezados, leerWorkbook } from './excel';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Envoltorio<T> = { service_response: { service_data: T } };

export async function leerApi<T>(api: APIRequestContext, url: string): Promise<T> {
  const res = await api.get(url);
  expect(res.ok(), `GET ${url} respondió ${res.status()}`).toBeTruthy();
  return ((await res.json()) as Envoltorio<T>).service_response.service_data;
}

// Hace click en el botón y devuelve la descarga ya leída.
export async function descargar(page: Page, boton: Locator): Promise<{ nombre: string; buffer: Buffer }> {
  const [descarga] = await Promise.all([page.waitForEvent('download'), boton.click()]);
  const ruta = await descarga.path();
  const fs = await import('node:fs/promises');
  return { nombre: descarga.suggestedFilename(), buffer: await fs.readFile(ruta) };
}

// Un .xlsx que exceljs puede abrir, con al menos una hoja y títulos en la primera fila.
export async function esperarXlsxConDatos(buffer: Buffer): Promise<Workbook> {
  const wb = await leerWorkbook(buffer);
  expect(wb.worksheets.length).toBeGreaterThan(0);
  for (const hoja of wb.worksheets) {
    expect(encabezados(wb, hoja.name).filter(Boolean).length, `la hoja "${hoja.name}" no tiene títulos`).toBeGreaterThan(0);
  }
  return wb;
}

// Primer valor de la hoja Listas, en la columna indicada, que matchea.
export function valorDeLista(wb: Workbook, columna: string, patron: RegExp): string {
  const hoja = wb.getWorksheet('Listas');
  const idx = encabezados(wb, 'Listas').indexOf(columna) + 1;
  expect(idx, `no hay columna ${columna} en Listas`).toBeGreaterThan(0);
  const valores: string[] = [];
  hoja.eachRow((fila: { getCell(i: number): { value: unknown } }, n: number) => {
    const v = fila.getCell(idx).value;
    if (n > 1 && v) valores.push(String(v));
  });
  const valor = valores.find((v) => patron.test(v));
  expect(valor, `no hay ${patron} en la lista ${columna}`).toBeTruthy();
  return valor!;
}

// Completa la hoja de datos de una plantilla desde la fila 2 y devuelve el .xlsx.
export async function completarPlantilla(
  wb: Workbook,
  hoja: string,
  filas: Record<string, unknown>[],
): Promise<Buffer> {
  const columna = new Map(encabezados(wb, hoja).map((t, i) => [t, i + 1]));
  const ws = wb.getWorksheet(hoja);
  filas.forEach((valores, i) => {
    const row = ws.getRow(i + 2);
    for (const [titulo, valor] of Object.entries(valores)) {
      expect(columna.has(titulo), `la plantilla no tiene la columna ${titulo}`).toBeTruthy();
      row.getCell(columna.get(titulo)!).value = valor;
    }
    row.commit();
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Abre el modal "Importar" de la pantalla y lo devuelve.
export async function abrirImportar(page: Page, ruta: string): Promise<Locator> {
  await page.goto(ruta);
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Descargá la plantilla')).toBeVisible();
  return modal;
}

export async function elegirArchivo(modal: Locator, nombre: string, buffer: Buffer, mimeType = MIME_XLSX) {
  await modal.locator('input[type=file]').setInputFiles({ name: nombre, mimeType, buffer });
}

// Sube el archivo, lo procesa y espera el resumen.
export async function procesar(modal: Locator, nombre: string, buffer: Buffer): Promise<void> {
  await elegirArchivo(modal, nombre, buffer);
  await modal.getByRole('button', { name: 'Procesar archivo' }).click();
  await expect(modal.locator('.cm-summary')).toBeVisible({ timeout: 30_000 });
}

export async function esperarResumen(modal: Locator, cargados: number, conError: number): Promise<void> {
  await expect(modal.locator('.cm-summary__item--ok .cm-summary__num')).toHaveText(String(cargados));
  await expect(modal.locator('.cm-summary__item--err .cm-summary__num')).toHaveText(String(conError));
  await expect(modal.locator('.cm-summary__item').nth(2).locator('.cm-summary__num')).toHaveText(
    String(cargados + conError),
  );
}

// Retira por API a la persona en esa fecha y devuelve el id del retiro.
export async function retirar(api: APIRequestContext, personaId: string, fecha: string): Promise<number> {
  const [motivo] = await leerApi<{ id: number }[]>(api, '/api/catalogos/motivos-baja');
  const res = await api.post('/api/retiros', {
    data: { service_request: { persona_id: Number(personaId), fecha_retiro: fecha, motivo_baja_id: Number(motivo.id) } },
  });
  expect(res.ok(), `retiro respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as Envoltorio<{ id: number }>).service_response.service_data.id;
}

export function dia(offsetDias: number): string {
  return new Date(Date.now() + offsetDias * 86_400_000).toISOString().slice(0, 10);
}
