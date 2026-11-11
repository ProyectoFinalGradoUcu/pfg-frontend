import path from 'node:path';

/**
 * exceljs no es dependencia del frontend: si no está instalado acá se toma el
 * del backend, que vive al lado (PFG/pfg-backend/backend).
 */
const EXCELJS_DEL_BACKEND = path.resolve(__dirname, '../../../pfg-backend/backend/node_modules/exceljs');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Workbook = any;

export function nuevoWorkbook(): Workbook {
  let exceljs;
  try {
    exceljs = require('exceljs');
  } catch {
    try {
      exceljs = require(EXCELJS_DEL_BACKEND);
    } catch {
      throw new Error(`No se encontró exceljs ni en el frontend ni en ${EXCELJS_DEL_BACKEND}`);
    }
  }
  return new exceljs.Workbook();
}

export async function leerWorkbook(buffer: Buffer): Promise<Workbook> {
  const wb = nuevoWorkbook();
  await wb.xlsx.load(buffer);
  return wb;
}

/** Títulos de la primera fila de una hoja, sin la marca de obligatoria. */
export function encabezados(wb: Workbook, hoja: string): string[] {
  const titulos: string[] = [];
  wb.getWorksheet(hoja).getRow(1).eachCell((cell: { value: unknown }) => {
    titulos.push(String(cell.value).replace(/\s*\*$/, ''));
  });
  return titulos;
}
