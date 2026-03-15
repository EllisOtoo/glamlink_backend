# GlamLink API

NestJS service that powers the GlamLink booking platform. The current focus is establishing the infrastructure we need for the next phase: PostgreSQL persistence with Prisma and a Docker-based local environment.

## Getting Started

```bash
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` if you are not using the docker compose defaults.

Configure Firebase admin credentials if you plan to accept Firebase-authenticated traffic from the mobile app:

```bash
# .env
FIREBASE_PROJECT_ID="glamlink-prod"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@glamlink-prod.iam.gserviceaccount.com"
# Copy the PEM private key and replace literal newlines with \n sequences
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Notification-related environment flags:

```bash
# Disable Expo push delivery until the mobile apps are live
ENABLE_PUSH_NOTIFICATIONS="false"

# Enable automated WhatsApp booking reminders
ENABLE_WHATSAPP_BOOKING_REMINDERS="true"

# Reminder templates approved in Meta
WHATSAPP_BOOKING_REMINDER_24H_TEMPLATE="appointment_reminder_bookikeke"
WHATSAPP_BOOKING_REMINDER_2H_TEMPLATE="appointment_reminder_bookikeke"
WHATSAPP_VENDOR_BOOKING_ALERT_TEMPLATE="vendor_booking_alert_bookikeke"

# Optional overrides for reminder timing
BOOKING_REMINDER_24H_HOURS_AHEAD="24"
BOOKING_REMINDER_2H_HOURS_AHEAD="2"
```

The API now runs a reminder job every 15 minutes. It sends staged WhatsApp reminders for confirmed bookings that are within the configured windows and have not already received that stage.

For manual triggering, admins can still call:

```bash
POST /jobs/reminders/run
{
  "stage": "all"
}
```

Supported `stage` values are `all`, `24h`, and `2h`.

### Local Development Options

#### Option 1: Database Only (Recommended for Development)

Run PostgreSQL in Docker and the NestJS app locally:

```bash
docker compose up db -d
pnpm start:dev
```

This starts:

- `glamlink-db`: PostgreSQL 16 with the `glamlink` database (running in container).
- NestJS API: running locally via `pnpm start:dev`, connecting to the DB at `localhost:5432`.

#### Option 2: Full Docker Stack

Run both services in Docker:

```bash
docker compose up --build
```

This starts:

- `glamlink-db`: PostgreSQL 16 with the `glamlink` database.
- `glamlink-api`: the NestJS service built from this project (containerized).

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

## Authentication

- Email OTP is still supported via `POST /auth/request-otp` and `POST /auth/verify-otp`.
- Mobile clients using Firebase Auth can exchange a Firebase ID token for a GlamLink API session token via `POST /auth/firebase-login` with body `{ "idToken": "<firebase-id-token>" }`. The response mirrors the OTP login flow and returns the server-issued session token used for subsequent authenticated requests.

## Next Steps

- Flesh out Prisma models for services, bookings, reviews, and payments.
- Implement vendor onboarding flows and REST modules that map to the PRD.
- Add health checks and CI automation for migrations/tests.

## Gift Cards

- Purchase: `POST /public/gift-cards` with `vendorId`, `amountPesewas`, purchaser + optional recipient details; returns a Paystack checkout payload. Card activates after Paystack success and emails the recipient/purchaser.
- Lookup: `GET /public/gift-cards/:code?email=<recipient-or-purchaser-email>` to view balance/status.
- Booking: `giftCardCode` is supported on public/manual booking creation. The card applies to the deposit first, then any remaining balance. If it covers the deposit fully, the booking is auto-confirmed; unused balances stay on the card. Cancelled bookings auto-refund any gift card redemptions.
