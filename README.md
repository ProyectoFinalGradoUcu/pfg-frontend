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

## Next steps

1. Add your first real feature module under `src/app/features`.
2. Add API infrastructure (`core/interceptors`, `core/services`).
3. Add environment-specific config and auth guards.
