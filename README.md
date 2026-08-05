# PfgFrontend

Feature-first Angular base project with lazy-loaded modules and a clean initial skeleton.

## Run locally

```bash
npm install
npm start
```

Then open [http://localhost:4200](http://localhost:4200).

## Project structure

```text
src/app
├── core/               # App-wide services, guards, interceptors, layout shell
├── shared/             # Reusable UI components and helpers
├── features/           # Business domains (lazy loaded)
│   ├── home/
│   ├── auth/
│   └── not-found/
├── app-module.ts
└── app-routing-module.ts
```

## Suggested conventions

- Keep each business area inside `src/app/features/<feature-name>`.
- Give each feature its own routing module and lazy-load it from `app-routing-module.ts`.
- Keep global singletons in `core` (auth service, interceptors, guards).
- Put reusable presentational components in `shared`.
- Keep route pages under `pages/` and reusable feature-specific pieces under `components/`.

## Useful scripts

- `npm start`: start dev server.
- `npm run build`: create production build.
- `npm test`: run unit tests (Vitest).
- `npm run e2e`: run end-to-end tests (Playwright) — see below.

## End-to-end tests (Playwright)

E2E tests drive a real browser against the running stack, so the backend must be
up first. In the `pfg-backend` repo:

```bash
make up
make seed-auth
```

Then, in this repo:

```bash
npm run e2e
npm run e2e:ui
npm run e2e:report
```

Tests authenticate as the seeded admin (`admin@fau.mil.uy`). `e2e/setup/global-setup.ts`
logs in once per run and saves the session cookies to `e2e/.auth/admin.json`
(gitignored), so specs start already authenticated. The app authenticates via
cookie — the JWT never touches localStorage — which is why `storageState` is enough.

Layout:

```text
e2e/
├── fixtures/auth.ts        # credentials + reusable login helper
├── setup/global-setup.ts   # logs in once, persists cookies
└── tests/auth.spec.ts      # login flows
```

Coverage is currently limited to the login flows; `e2e/tests/auth.spec.ts` is the
template to follow when adding feature specs.

The app origin is defined once in `playwright.config.ts` and can be overridden
without touching code:

```bash
E2E_BASE_URL=http://localhost:4300 npm run e2e
```

That single value drives the test `baseURL`, the URL Playwright waits for, and the
`ng serve` port. Note that it is not enough on its own: the backend validates the
origin via CORS (`CORS_ORIGIN` in `pfg-backend/docker-compose.yml`, currently
`http://localhost:4200`). If the two disagree, requests reach the backend but the
browser discards the response and the session cookie, so login fails with no
visible network error.

Note that `npm test` (Vitest) and `npm run e2e` (Playwright) are separate suites.
`e2e/**` is excluded from the `test` target in `angular.json`, and `tsconfig.spec.json`
only includes `src/**`, so Vitest never picks up Playwright specs.

## Next steps

1. Add your first real feature module under `src/app/features`.
2. Add API infrastructure (`core/interceptors`, `core/services`).
3. Add environment-specific config and auth guards.
