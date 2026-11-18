import { Page, expect, test } from '@playwright/test';
import { login } from '../fixtures/auth';
import { SIN_SESION, apiAdmin, crearSubalternoEnBase, esperarPerfil } from '../fixtures/personal';

const toast = (page: Page, texto: string | RegExp) => page.locator('.toast__message', { hasText: texto });

// Valor de un campo del legajo en modo lectura.
const campo = (page: Page, label: string) =>
  page
    .locator('.pd__sections .pd__field', { has: page.locator('.pd__label').getByText(label, { exact: true }) })
    .locator('.pd__value');

const pestania = (page: Page, nombre: string) =>
  page.locator('.pd__tabs-bar').getByRole('button', { name: nombre, exact: true });

// PNG válido de 1x1.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const pdf = (texto: string) => Buffer.from(`%PDF-1.4\n% ${texto}\n%%EOF\n`);

async function nuevoSubalterno(apellido: string, base = 'E.T.A.') {
  const api = await apiAdmin();
  const persona = await crearSubalternoEnBase(api, base, apellido);
  await api.dispose();
  return persona;
}

async function abrirPerfil(page: Page, id: string) {
  await page.goto(`/personal/${id}`);
  await esperarPerfil(page);
}

test.describe('editar el perfil', () => {
  test('guarda los cambios y los muestra en el legajo', async ({ page }) => {
    const { id } = await nuevoSubalterno('Perfil Editar');
    await abrirPerfil(page, id);
    await expect(campo(page, 'Teléfono')).toContainText('Sin dato');

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.locator('[formcontrolname=segundo_nombre]').fill('Ramón');
    await page.locator('[formcontrolname=telefono]').fill('099 123 456');
    await page.locator('[formcontrolname=estado_civil]').selectOption('Casado');

    await expect(page.locator('.pd__cambios-badge')).toHaveText('3 cambios sin guardar');
    await expect(page.locator('.pd__antes', { hasText: 'Antes:' })).toHaveCount(3);
    await page.getByRole('button', { name: 'Guardar cambios' }).first().click();

    await expect(toast(page, 'Perfil actualizado correctamente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar perfil' })).toBeVisible();
    await expect(campo(page, 'Teléfono')).toHaveText('099 123 456');
    await expect(campo(page, 'Estado civil')).toHaveText('Casado');
    await expect(campo(page, 'Nombre completo')).toContainText('Ramón');

    // Que se haya guardado en el servidor.
    await page.reload();
    await esperarPerfil(page);
    await expect(campo(page, 'Teléfono')).toHaveText('099 123 456');
  });

  test('un email inválido marca el error y no deja guardar', async ({ page }) => {
    const { id } = await nuevoSubalterno('Perfil Email');
    await abrirPerfil(page, id);

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    const email = page.locator('[formcontrolname=email]');
    await email.fill('no-es-un-mail');
    await email.blur();

    await expect(page.locator('.pd__edit-error', { hasText: 'Email inválido' })).toBeVisible();
    await expect(page.locator('.pd__ed-footer-msg')).toContainText('1 campo con error');
    await page.getByRole('button', { name: 'Guardar cambios' }).first().click();

    await expect(toast(page, 'Perfil actualizado correctamente')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Editar a / })).toBeVisible();
  });

  test('no acepta la cédula de otra persona', async ({ page }) => {
    const { id } = await nuevoSubalterno('Perfil Cedula');
    const otra = await nuevoSubalterno('Perfil Cedula Otra');
    await abrirPerfil(page, id);

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.locator('[formcontrolname=cedula]').fill(otra.cedula);
    await page.getByRole('button', { name: 'Guardar cambios' }).first().click();

    await expect(page.locator('.pd__edit-error', { hasText: 'Ya existe otro personal con esa cédula' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Editar a / })).toBeVisible();
  });

  test('descartar con cambios pide confirmación y no guarda nada', async ({ page }) => {
    const { id } = await nuevoSubalterno('Perfil Descartar');
    await abrirPerfil(page, id);

    await page.getByRole('button', { name: 'Editar perfil' }).click();
    await page.locator('[formcontrolname=telefono]').fill('2222 3333');
    await page.getByRole('button', { name: 'Descartar' }).first().click();

    const confirmar = page.getByRole('alertdialog', { name: 'Descartar cambios' });
    await expect(confirmar).toContainText('1 cambio sin guardar');
    await confirmar.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(page.locator('[formcontrolname=telefono]')).toHaveValue('2222 3333');

    await page.getByRole('button', { name: 'Descartar' }).first().click();
    await confirmar.getByRole('button', { name: 'Descartar' }).click();

    await expect(page.getByRole('button', { name: 'Editar perfil' })).toBeVisible();
    await expect(campo(page, 'Teléfono')).toContainText('Sin dato');
  });
});

test.describe('familiares', () => {
  test('agrega un familiar, abre su detalle y lo quita', async ({ page }) => {
    const { id } = await nuevoSubalterno('Familiar Titular');
    const familiar = await nuevoSubalterno('Familiar Hermano');
    await abrirPerfil(page, id);

    await pestania(page, 'Información familiar').click();
    await expect(page.getByText('Este funcionario no tiene familiares registrados.')).toBeVisible();
    await page.getByRole('button', { name: 'Agregar familiar' }).click();

    await page.getByPlaceholder('Buscar familiar por cédula o nombre').fill(familiar.cedula);
    await page.locator('.pd__familiar-add-item', { hasText: familiar.cedula }).click();
    const confirmacion = page.locator('.pd__familiar-add-confirm');
    await expect(confirmacion).toContainText(familiar.cedula);
    await confirmacion.locator('select').selectOption('Hermano/a');
    await confirmacion.getByRole('button', { name: 'Agregar', exact: true }).click();

    await expect(toast(page, 'Familiar agregado correctamente')).toBeVisible();
    const tarjeta = page.locator('.pd__familiar-card', { hasText: familiar.cedula });
    await expect(tarjeta).toContainText('Hermano/a');

    await page.reload();
    await esperarPerfil(page);
    await pestania(page, 'Información familiar').click();
    await expect(tarjeta).toContainText('Familiar Hermano');

    await tarjeta.click();
    const detalle = page.locator('app-familiar-detalle-modal');
    await expect(detalle.getByRole('heading', { name: /Familiar Hermano/ })).toBeVisible();
    await expect(detalle).toContainText(familiar.cedula);
    await expect(detalle).toContainText('Militar');
    await detalle.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await expect(detalle).toHaveCount(0);

    await tarjeta.getByRole('button', { name: 'Quitar familiar' }).click();
    await page.getByRole('alertdialog', { name: 'Quitar familiar' }).getByRole('button', { name: 'Quitar' }).click();

    await expect(toast(page, 'Familiar quitado correctamente')).toBeVisible();
    await expect(page.getByText('Este funcionario no tiene familiares registrados.')).toBeVisible();
  });
});

test.describe('cambio de situación', () => {
  test('licencia sin goce y vuelta a actividad', async ({ page }) => {
    const { id } = await nuevoSubalterno('Situacion Licencia');
    await abrirPerfil(page, id);

    const situacion = page.locator('.pd__aside .pd__situacion');
    await expect(situacion).toHaveText('Personal Subalterno en actividad.');

    await page.locator('.pd__aside').getByRole('button', { name: 'Cambiar situación' }).click();
    const modal = page.locator('app-cambiar-situacion-modal');
    // Liquidación no tiene No Disponible para subalternos.
    await expect(modal.getByRole('radio')).toHaveCount(1);
    await modal.getByText('Licencia sin goce de sueldo').click();
    await expect(modal.getByText('Liquidación deja de pagarle desde el próximo cálculo.')).toBeVisible();

    await modal.getByRole('button', { name: 'Confirmar cambio' }).click();
    await expect(modal.getByText('Indicá el número de orden o la resolución.')).toBeVisible();

    await modal.getByLabel('N° de orden').fill('O.D. licencia e2e');
    await modal.getByRole('button', { name: 'Confirmar cambio' }).click();

    await expect(toast(page, /^Situación cambiada a /)).toBeVisible();
    await expect(modal).toHaveCount(0);
    await expect(situacion).not.toHaveText('Personal Subalterno en actividad.');

    // Desde la licencia solo se puede volver, y ya viene elegido.
    await page.locator('.pd__aside').getByRole('button', { name: 'Cambiar situación' }).click();
    await expect(modal.getByRole('radio', { name: /Volver a actividad/ })).toBeChecked();
    await modal.getByLabel('Resolución').fill('B.O. vuelta e2e');
    await modal.getByRole('button', { name: 'Confirmar cambio' }).click();

    await expect(modal).toHaveCount(0);
    await expect(situacion).toHaveText('Personal Subalterno en actividad.');
  });
});

test.describe('documentos', () => {
  test('carga un PDF, edita la descripción y lo elimina', async ({ page }) => {
    const { id, cedula } = await nuevoSubalterno('Documentos Carga');
    await abrirPerfil(page, id);
    await pestania(page, 'Documentos').click();
    await expect(page.getByText('Este funcionario no tiene documentos cargados.')).toBeVisible();

    await page.getByRole('button', { name: 'Cargar documento' }).click();
    const modal = page.locator('app-cargar-documento-modal');
    await modal.locator('input[type=file]').setInputFiles({
      name: 'constancia.pdf',
      mimeType: 'application/pdf',
      buffer: pdf(`constancia ${cedula}`),
    });
    await expect(modal.locator('.carga__nombre')).toHaveText('constancia.pdf');
    await modal.getByPlaceholder('ej: Cédula, frente y dorso').fill('Constancia de domicilio');
    await modal.getByRole('button', { name: 'Subir' }).click();

    await expect(toast(page, 'Documento cargado')).toBeVisible();
    await expect(modal).toHaveCount(0);
    // Por el nombre del archivo, que no cambia al editar.
    const item = page.locator('.docs__item', { hasText: 'constancia.pdf' });
    await expect(item).toContainText('Constancia de domicilio');

    await item.locator('.docs__resumen').click();
    await expect(item.locator('.docs__detalle')).toContainText('PDF');
    await expect(item.locator('.docs__detalle')).toContainText('admin@fau.mil.uy');

    await item.getByRole('button', { name: 'Editar descripción de «Constancia de domicilio»' }).click();
    await item.getByLabel('Descripción').fill('Constancia de domicilio 2026');
    await item.getByRole('button', { name: 'Guardar' }).click();
    await expect(toast(page, 'Descripción actualizada')).toBeVisible();

    await expect(item).toContainText('Constancia de domicilio 2026');
    await item.getByRole('button', { name: 'Eliminar «Constancia de domicilio 2026»' }).click();
    const confirmar = page.locator('.modal__card', { has: page.getByRole('heading', { name: 'Eliminar documento' }) });
    await expect(confirmar).toContainText('No se puede recuperar.');
    await confirmar.getByRole('button', { name: 'Eliminar' }).click();

    await expect(toast(page, 'Documento eliminado')).toBeVisible();
    await expect(page.getByText('Este funcionario no tiene documentos cargados.')).toBeVisible();
  });

  test('el mismo archivo con otro nombre se rechaza como repetido', async ({ page }) => {
    const { id, cedula } = await nuevoSubalterno('Documentos Repetido');
    await abrirPerfil(page, id);
    await pestania(page, 'Documentos').click();

    const contenido = pdf(`repetido ${cedula}`);
    const modal = page.locator('app-cargar-documento-modal');
    await page.getByRole('button', { name: 'Cargar documento' }).click();
    await modal.locator('input[type=file]').setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: contenido });
    await modal.getByRole('button', { name: 'Subir' }).click();
    await expect(toast(page, 'Documento cargado')).toBeVisible();

    await page.getByRole('button', { name: 'Cargar documento' }).click();
    await modal.locator('input[type=file]').setInputFiles({ name: 'copia.pdf', mimeType: 'application/pdf', buffer: contenido });
    await modal.getByRole('button', { name: 'Subir' }).click();

    await expect(modal.getByRole('alert')).toContainText('Este archivo ya está cargado para el funcionario');
    await expect(modal.locator('.carga__existente')).toContainText('original.pdf');
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.docs__item')).toHaveCount(1);
  });

  test('un archivo que no es PDF ni imagen no se deja subir', async ({ page }) => {
    const { id } = await nuevoSubalterno('Documentos Tipo');
    await abrirPerfil(page, id);
    await pestania(page, 'Documentos').click();

    await page.getByRole('button', { name: 'Cargar documento' }).click();
    const modal = page.locator('app-cargar-documento-modal');
    await modal.locator('input[type=file]').setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('no es un pdf'),
    });

    await expect(modal.getByRole('alert')).toHaveText('Tipo de archivo no permitido. Solo PDF, JPG o PNG.');
    await expect(modal.getByRole('button', { name: 'Subir' })).toBeDisabled();
  });
});

test.describe('foto', () => {
  test('carga la foto, se ve en el perfil y se puede quitar', async ({ page }) => {
    const { id } = await nuevoSubalterno('Foto Carga');
    await abrirPerfil(page, id);

    const cabecera = page.locator('.pd__header-card');
    await expect(cabecera.locator('.foto__iniciales')).toBeVisible();
    await cabecera.getByRole('button', { name: 'Cargar foto' }).click();

    const modal = page.getByRole('dialog', { name: 'Foto del funcionario' });
    await expect(modal.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await modal.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
    await expect(modal.getByAltText('Vista previa')).toBeVisible();
    await modal.getByRole('button', { name: 'Guardar' }).click();

    await expect(toast(page, 'Foto actualizada')).toBeVisible();
    await expect(modal).toHaveCount(0);
    await expect(cabecera.locator('img.foto__img')).toBeVisible();

    await page.reload();
    await esperarPerfil(page);
    await expect(cabecera.locator('img.foto__img')).toBeVisible();

    await cabecera.getByRole('button', { name: 'Cambiar foto' }).click();
    await modal.getByRole('button', { name: 'Quitar foto' }).click();
    await page.getByRole('alertdialog', { name: 'Quitar foto' }).getByRole('button', { name: 'Quitar' }).click();

    await expect(toast(page, 'Foto quitada')).toBeVisible();
    await expect(cabecera.locator('.foto__iniciales')).toBeVisible();
  });

  test('un GIF no se acepta', async ({ page }) => {
    const { id } = await nuevoSubalterno('Foto Tipo');
    await abrirPerfil(page, id);

    await page.locator('.pd__header-card').getByRole('button', { name: 'Cargar foto' }).click();
    const modal = page.getByRole('dialog', { name: 'Foto del funcionario' });
    await modal.locator('input[type=file]').setInputFiles({
      name: 'foto.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('GIF89a'),
    });

    await expect(modal.getByRole('alert')).toHaveText('Solo se aceptan imágenes JPG o PNG.');
    await expect(modal.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

test.describe('pestañas', () => {
  test('un alta nueva muestra su destino y el resto vacío', async ({ page }) => {
    const { id } = await nuevoSubalterno('Pestanias Vacias');
    await abrirPerfil(page, id);

    await page.locator('.pd__destino-actual').getByRole('button', { name: 'Ver historial de destinos' }).click();
    const destino = page.locator('.pd__destino-card');
    await expect(destino).toHaveCount(1);
    await expect(destino).toContainText('E.T.A.');
    await expect(destino).toContainText('Vigente');

    await pestania(page, 'Historial militar').click();
    await expect(page.getByRole('heading', { name: 'Situación de ascenso' })).toBeVisible();
    await expect(page.locator('.pd__ascenso-tramo')).toContainText('Sgto.');

    await pestania(page, 'Cursos').click();
    await expect(page.getByText('No hay cursos registrados.')).toBeVisible();
    await pestania(page, 'Misiones').click();
    await expect(page.getByText('No hay misiones registradas.')).toBeVisible();
    await pestania(page, 'Comisiones').click();
    await expect(page.getByText('No hay comisiones registradas para esta persona.')).toBeVisible();
  });
});

test.describe('con el usuario de consulta', () => {
  test.use({ storageState: SIN_SESION });

  test('ve el perfil pero no puede editar, cargar foto ni documentos', async ({ page }) => {
    // Este usuario solo ve D.C.G. y BANDA.
    const { id } = await nuevoSubalterno('Perfil Consulta', 'D.C.G.');
    await login(page, { username: 'consulta.cg@fau.mil.uy', password: 'FAUdemo1!' });
    await page.goto(`/personal/${id}`);

    await expect(page.locator('.pd__name')).toContainText('Perfil Consulta');
    await expect(page.getByRole('button', { name: 'Editar perfil' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cargar foto' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cambiar situación' })).toHaveCount(0);

    await pestania(page, 'Documentos').click();
    await expect(page.getByText('Este funcionario no tiene documentos cargados.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cargar documento' })).toHaveCount(0);
  });
});
