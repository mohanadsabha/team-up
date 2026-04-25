# Repository Guidelines

## Project Context

- Product/domain overview is documented in `README.md`. Keep this file focused on implementation behavior for coding agents.

## Architecture & Module Boundaries

- Entry points: `src/server.ts` starts the process/server; `src/app.ts` wires middleware, routes, and global error handling.
- Feature modules live in `src/modules/<feature>/` and follow: `*.controller.ts`, `*.route.ts`, `*.interface.ts`.
- Shared infrastructure lives in `src/config/`, `src/middleware/`, `src/utils/`, and `src/types/`.
- Templates live in `src/templates/` (`.pug`), copied to `dist/` during build.
- Data model changes belong in `prisma/schema.prisma`; generated SQL migrations must be committed in `prisma/migrations/`.

## Build & Verification

- `npm install`: install dependencies.
- `npm run dev`: run API in watch mode (`tsx watch src/server.ts`).
- `npm run type-check`: run TypeScript checks without emitting.
- `npm run build`: clean `dist/`, compile TypeScript, copy template/json assets.
- `npm start`: run compiled server from `dist/server.js`.
- `npm run format`: run Prettier on `src/**/*.ts`.
- Prisma workflow: `npx prisma migrate dev` then `npx prisma generate`.
- There is no configured test runner yet; minimum validation is `npm run type-check`, `npm run build`, and manual endpoint smoke testing.

## Conventions

- TypeScript is strict; keep public module APIs explicitly typed.
- Prettier style: 2-space indentation, double quotes, trailing commas where valid.
- Naming: `PascalCase` for classes/types, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants.
- File names are lowercase and descriptive (for example `auth.controller.ts`, `error.middleware.ts`, `jwt.util.ts`).
- API responses follow the existing shape used in controllers (`success`, `message`, and payload fields).

## Agent-Critical Gotchas

- Environment variables are required; see `src/types/environment.d.ts` for the expected keys.
- `src/config/dotenv.ts` currently reads from `./.env`. If environment loading changes, keep docs/code aligned.
- Express v5 note: `req.query` is made writable in `src/app.ts`; do not remove unless query handling is refactored.
- Prisma client output is generated under `src/generated/prisma/` (non-default path); avoid importing from other generated locations.
- Keep runtime artifacts and secrets out of git (`dist/`, database/JWT/email/cloud credentials).

## PR Expectations

- Keep commits small and focused, with imperative commit messages.
- Include schema and migration changes in the same PR when changing Prisma models.
- For behavior changes, include verification steps and request/response examples in the PR description.
