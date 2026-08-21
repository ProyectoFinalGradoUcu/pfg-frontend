import { chromium, FullConfig } from '@playwright/test';
import { login, ADMIN_STORAGE_STATE } from '../fixtures/auth';

/**
 * Hace login una vez por corrida y persiste las cookies de sesión en disco.
 * El auth de la app es por cookie (el JWT no pasa por localStorage), así que
 * el storageState alcanza para que los specs arranquen autenticados.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) {
    throw new Error('baseURL no está configurado en playwright.config.ts');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  try {
    await login(page);
    await page.context().storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
