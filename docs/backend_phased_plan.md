# Backend Phased Delivery Plan

Goal: deliver the NestJS backend in progressive slices so product and ops can run quick manual tests before promoting the next feature set. Each phase ends with a focused smoke checklist and clear exit criteria.

## Phase 0 — Foundations
- Scope: project wiring (`AppModule` layout, Prisma schema baseline, environment config, health endpoint) plus CI lint/test workflow.
- Manual tests: `pnpm start:dev`, hit `GET /health`, run `pnpm lint` and `pnpm test`.
- Exit criteria: green CI, shared `.env.example`, and database migrations applied locally.

## Phase 1 — Accounts & Identity
- Scope: user entity, phone/email OTP login, session token guard, role enum (customer/vendor/admin).
- Manual tests: register customer and vendor via API, verify OTP retry limits, call a protected route expecting 401 → 200 with token.
- Exit criteria: auth flows documented in Postman collection, rate limiting toggles validated.

## Phase 2 — Vendor Onboarding & KYC
- Scope: vendor profile module (business details, status), KYC submission flow, admin approval hooks, file storage stubs.
- Manual tests: submit KYC payload, fetch profile reflects `pending` → `verified`, ensure unverified vendor cannot create services.
- Exit criteria: admin toggles work via API, audit trail table captures status transitions.

## Phase 3 — Services & Availability
- Scope: service catalog CRUD, pricing validations, availability calendar, buffer enforcement, calendar projection query.
- Manual tests: create three services, set weekly schedule + exception, fetch availability for next 7 days and confirm gaps.
- Exit criteria: double-booking prevented in DB transaction tests; availability endpoint returns deterministic slots.

## Phase 4 — Booking & Payments
- Scope: booking workflow, deposit calculation, payment intent integration, booking confirmation events.
- Manual tests: walk-through booking with mock payment success/failure, ensure deposit math logged, verify customer/vendor calendar entries.
- Exit criteria: booking status diagram finalized, failed payments roll back inventory, webhooks replayable.

## Phase 5 — Post-Booking Operations
- Scope: reminder scheduling, reschedule/cancel policies, review submission and vendor replies.
- Manual tests: trigger reminder job manually, reschedule inside/outside policy window, submit review only after completion.
- Exit criteria: background job dashboard shows deliveries, policy breaches return correct HTTP codes.

## Phase 6 — Analytics & Admin Console API
- Scope: metrics aggregation pipelines, vendor dashboard endpoints, admin dispute/refund APIs, feature flag toggles.
- Manual tests: backfill metrics job, query analytics slice, simulate dispute resolution round-trip.
- Exit criteria: metrics validated against seed data, admin actions emit audit events, observability dashboards populated.

## Rolling Hardening & Launch Prep
- Non-functional passes: load test booking API, chaos drills on payment retries, security scan (OWASP, dependency audit).
- Sign-off: run end-to-end happy path script from vendor signup to review twice without intervention before launch freeze.
