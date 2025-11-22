# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the NestJS entrypoint (`main.ts`), the root module (`app.module.ts`), and feature scaffolding (`app.controller.ts`, `app.service.ts`). Place new modules in subdirectories under `src/` with accompanying controllers and providers.
- `test/` hosts end-to-end specs and `jest-e2e.json`. Keep integration helpers here so the production bundle stays lean.
- Build artifacts land in `dist/` after `pnpm build`; this directory is transient and should not be versioned.
- Repo-level configs (`nest-cli.json`, `tsconfig*.json`, `eslint.config.mjs`) define path aliases, compilation targets, and linting rules—update them in tandem when introducing new libraries or aliases.

## Build, Test, and Development Commands
- `pnpm install` – install dependencies respecting the checked-in lockfile.
- `pnpm start:dev` – run the API with live reload via `nest start --watch`.
- `pnpm build` – emit a production-ready bundle to `dist/`.
- `pnpm start:prod` – execute the transpiled build locally for smoke tests.
- `pnpm lint` / `pnpm format` – autofix lint issues and apply Prettier formatting before committing.

## Coding Style & Naming Conventions
- TypeScript sources use Prettier defaults: two-space indentation, double quotes only when required, and semicolons enabled.
- Follow NestJS naming: modules end with `Module`, controllers with `Controller`, providers/services with `Service`. Use `PascalCase` for classes and decorators, `camelCase` for variables and functions, and `SCREAMING_SNAKE_CASE` for constants.
- Keep public APIs strongly typed and favor dependency injection via constructor parameters to align with Nest patterns.

## Testing Guidelines
- Unit specs live alongside implementation in `src/` with the `.spec.ts` suffix; Jest auto-discovers them using `testRegex`.
- Run `pnpm test` for the full suite, `pnpm test:watch` while iterating, and `pnpm test:cov` before PRs to confirm coverage remains stable.
- End-to-end tests reside in `test/` and run via `pnpm test:e2e`; ensure they seed and clean their own data to stay repeatable.

## Commit & Pull Request Guidelines
- Write imperative, present-tense commit messages (`Add booking module`, not `Added`), mirroring the existing history. Group related changes in a single commit when practical.
- Before opening a PR, confirm lint and tests pass. Provide a concise summary, reference related issues, and include request/response samples or screenshots for API or contract changes.
- Flag configuration or migration steps in the PR description so reviewers can validate the setup locally without guesswork.
