import { Locator, expect } from '@playwright/test';

// Mismos nombres que usa el calendario del app-date-input.
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
];

const partes = (iso: string) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return { anio, mes: mes - 1, dia };
};

// Abre el calendario en el mes de la fecha y devuelve el día
async function abrirEn(campo: Locator, iso: string): Promise<Locator> {
  const { anio, mes, dia } = partes(iso);
  const panel = campo.locator('.appdate__panel');
  const titulo = panel.locator('.appdate__mes');

  if (!(await panel.isVisible())) await campo.locator('.appdate__control').click();
  await expect(panel).toBeVisible();

  const [nombre, anioVisible] = (await titulo.innerText()).trim().split(' ');
  let saltos = (anio - Number(anioVisible)) * 12 + (mes - MESES.indexOf(nombre.toLowerCase()));
  for (; saltos >= 12; saltos -= 12) await panel.getByRole('button', { name: 'Año siguiente' }).click();
  for (; saltos <= -12; saltos += 12) await panel.getByRole('button', { name: 'Año anterior' }).click();
  for (; saltos > 0; saltos--) await panel.getByRole('button', { name: 'Mes siguiente' }).click();
  for (; saltos < 0; saltos++) await panel.getByRole('button', { name: 'Mes anterior' }).click();

  const nombreMes = MESES[mes][0].toUpperCase() + MESES[mes].slice(1);
  await expect(titulo).toHaveText(`${nombreMes} ${anio}`);
  return panel.getByRole('button', { name: `${dia} de ${MESES[mes]} de ${anio}`, exact: true });
}

// Elige `aaaa-mm-dd` en un app-date-input como un usuario; con '' lo vacía.
export async function llenarFecha(campo: Locator, iso: string): Promise<void> {
  if (!iso) {
    const quitar = campo.locator('.appdate__quitar');
    if (await quitar.count()) await quitar.click();
    await expect(campo.locator('.appdate__valor')).toHaveCount(0);
    return;
  }
  await (await abrirEn(campo, iso)).click();
  await expect(campo.locator('.appdate__panel')).toBeHidden();
  await esperarFecha(campo, iso);
}

// Verifica que el calendario no deja elegir ese día y lo cierra.
export async function esperarFechaBloqueada(campo: Locator, iso: string): Promise<void> {
  await expect(await abrirEn(campo, iso)).toBeDisabled();
  await campo.locator('.appdate__control').click();
  await expect(campo.locator('.appdate__panel')).toBeHidden();
}

// El app-date-input muestra la fecha en dd/mm/aaaa.
export async function esperarFecha(campo: Locator, iso: string): Promise<void> {
  const { anio, mes, dia } = partes(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  await expect(campo.locator('.appdate__valor')).toHaveText(`${dos(dia)}/${dos(mes + 1)}/${anio}`);
}
