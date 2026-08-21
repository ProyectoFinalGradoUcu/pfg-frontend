import { defineConfig, devices } from '@playwright/test';

/**
 * Origen de la app bajo test. Único lugar del repo donde vive el host/puerto:
 * de acá salen el baseURL de los tests, la URL que espera el webServer y el
 * puerto del ng serve.
 *
 * El backend valida el origen por CORS (CORS_ORIGIN en el docker-compose.yml de pfg-backend).
 * Si no coincide, el request llega al backend pero el browser descarta la
 * respuesta y la cookie de sesión, y el login falla sin error de red visible.
 */
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const PORT = new URL(BASE_URL).port || '4200';

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/setup/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'html',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    storageState: 'e2e/.auth/admin.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
