# Repository Guidelines

## Project Structure & Module Organization
Application code lives in `src/`, with `main.ts` bootstrapping NestJS and feature modules grouped in subdirectories alongside their controllers and services. End-to-end specs and helpers sit under `test/`, while generated bundles land in `dist/` after builds and should never be committed. Use the `prisma/` directory for schema and migration assets, and keep supplemental architecture notes in `docs/`.

## Build, Test, and Development Commands
Run `pnpm install` to sync dependencies with the lockfile. Use `pnpm start:dev` for hot-reload development, and `pnpm build` plus `pnpm start:prod` to validate the compiled output in `dist/`. Execute `pnpm lint` and `pnpm format` before committing to catch style regressions, and reach for `pnpm prisma migrate dev` when evolving the database schema.

## Coding Style & Naming Conventions
TypeScript files follow Prettier defaults: two-space indentation, trailing semicolons, and double quotes only when required. Match Nest patterns by suffixing classes with `Module`, `Controller`, or `Service`, and keep variables in `camelCase` with constants in `SCREAMING_SNAKE_CASE`. Rely on dependency injection through constructor parameters and annotate public APIs with explicit types.

## Testing Guidelines
Jest powers the suite. Place unit specs beside their implementations with the `.spec.ts` suffix, and run `pnpm test` or `pnpm test:watch` while iterating. Use `pnpm test:e2e` to execute the specs in `test/`, ensuring they seed and clean data so the pipeline stays deterministic. Target stable coverage by running `pnpm test:cov` ahead of pull requests.

## Commit & Pull Request Guidelines
Write imperative, present-tense commits (e.g., `Add booking module`) and group related changes together. Before opening a PR, confirm lint, unit, and e2e tests pass, then summarize changes, reference related issues, and attach request/response samples or screenshots for API updates. Highlight migration or configuration steps so reviewers can reproduce your environment without guesswork.

## Security & Configuration Tips
Never commit secrets or local `.env` files; prefer environment variables or secret stores. Update `nest-cli.json`, `tsconfig*.json`, and `eslint.config.mjs` in tandem when adding path aliases or new tooling. Use feature flags for risky releases, and audit Prisma migrations to ensure destructive operations are intentional.
