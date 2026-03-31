# Repository Guidelines

## Project Structure & Module Organization
- `src/server.ts` starts the process and HTTP server; `src/app.ts` registers middleware and routes.
- Put feature code in `src/modules/<feature>/` using the existing pattern: `*.controller.ts`, `*.route.ts`, and `*.interface.ts`.
- Keep shared infrastructure in `src/config/` (dotenv, Prisma, Cloudinary, Multer), `src/middleware/`, `src/utils/`, and `src/types/`.
- Store email/view templates in `src/templates/` (`.pug` files are copied during build).
- Keep data model changes in `prisma/schema.prisma` and commit generated SQL under `prisma/migrations/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: run the API in watch mode with `tsx`.
- `npm run type-check`: run TypeScript checks without emitting files.
- `npm run format`: apply Prettier formatting to `src/**/*.ts`.
- `npm run build`: clean `dist/`, compile TypeScript, and copy template/json assets.
- `npm start`: run the compiled server from `dist/server.js`.
- `npx prisma migrate dev`: create/apply local migrations during schema work.
- `npx prisma generate`: regenerate Prisma client after schema changes.

## Coding Style & Naming Conventions
- Use TypeScript with strict compiler options enabled; keep types explicit for public module APIs.
- Follow Prettier defaults used in the codebase: 2-space indentation, double quotes, trailing commas where valid.
- Use `PascalCase` for classes/types, `camelCase` for variables/functions, and `UPPER_SNAKE_CASE` for constants.
- Keep file names lowercase and descriptive (`auth.controller.ts`, `error.middleware.ts`, `jwt.util.ts`).

## Testing Guidelines
- There is currently no configured `npm test` runner in this repository.
- Minimum pre-PR checks: `npm run type-check`, `npm run build`, and manual endpoint smoke testing.
- Add new tests as `*.test.ts` files (for example, `auth.controller.test.ts`) near the feature they cover.
- For Prisma changes, verify migration SQL and generated client code before opening a PR.

## Commit & Pull Request Guidelines
- Keep commit messages short and imperative, consistent with history (for example, `Initial Project Setup`, `Revise README ...`).
- Keep each commit focused on one concern; include schema and migration files in the same change.
- PRs should include: purpose, affected modules, verification steps run, and linked issue/ticket when available.
- Include request/response examples for API behavior changes and clearly call out breaking changes.

## Security & Configuration Tips
- Environment variables are loaded from `config.env` via `src/config/dotenv.ts`; keep secrets out of git.
- Do not commit runtime artifacts like `dist/` or credentials for database, JWT, email, or cloud providers.
