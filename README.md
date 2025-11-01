# GlamLink API

NestJS service that powers the GlamLink booking platform. The current focus is establishing the infrastructure we need for the next phase: PostgreSQL persistence with Prisma and a Docker-based local environment.

## Getting Started

```bash
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` if you are not using the docker compose defaults.

### Local Development (Docker)

```bash
docker compose up --build
```

This starts:

- `glamlink-db`: PostgreSQL 16 with the `glamlink` database.
- `glamlink-api`: the NestJS service built from this project.

The API listens on `http://localhost:3000` and connects to the Postgres container via the internal network.

### Prisma

Prisma is configured with a global `PrismaService` and an initial `Vendor` model in `prisma/schema.prisma`.

Common commands:

```bash
pnpm prisma:generate   # regenerate the Prisma client after schema changes
pnpm prisma:migrate    # create & apply a new migration (requires a running database)
pnpm prisma:studio     # launch Prisma Studio for inspecting data
```

Run `pnpm prisma:migrate` after bringing up Postgres to create the initial schema.

## Useful Scripts

- `pnpm start:dev` — NestJS in watch mode (requires a local Postgres instance)
- `pnpm lint` — ESLint
- `pnpm test` — Jest unit tests

## Next Steps

- Flesh out Prisma models for services, bookings, reviews, and payments.
- Implement vendor onboarding flows and REST modules that map to the PRD.
- Add health checks and CI automation for migrations/tests.
