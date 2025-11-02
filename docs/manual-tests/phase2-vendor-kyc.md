# Phase 2 Manual Test Script — Vendor Onboarding & KYC

## Prerequisites
- Completed Phase 1 (OTP auth) and have a vendor user token.
- Run migrations: `pnpm prisma migrate dev`.
- Start backend with SMTP/MailHog ready: `pnpm start:dev`.
- Create/identify a user with role `VENDOR` via Phase 1 flow.

## Vendor Profile Setup
1. `GET /vendors/me` (with vendor token) ⇒ expect `200` and `null` body or draft profile.
2. `PUT /vendors/me` with payload containing `businessName`, `handle`, `contactEmail`, `phoneNumber`, and optional bio/location.
   - Expect `200` with updated profile.
   - Re-issue request with same handle to confirm idempotent update.
3. `POST /vendors/me/documents` with sample metadata (type `ID_CARD`, storage key placeholder).
   - Expect `201` (implicitly via Nest default) returning stored document metadata.

## Submission Flow
1. `POST /vendors/me/submit`.
   - Expect `200` with status `PENDING_REVIEW` and `kycSubmittedAt` populated.
   - Call `GET /vendors/me` to confirm status change and status history entry.
2. `GET /vendors/me/verified-check` while status is pending.
   - Expect `403 Vendor account must be verified`.

## Admin Review
1. Authenticate as admin (set user role to `ADMIN`).
2. `GET /admin/vendors/{vendorId}` for the pending vendor.
   - Expect profile with documents and status history.
3. `POST /admin/vendors/{vendorId}/approve` with optional `note`.
   - Expect `200` with status `VERIFIED`, `verifiedAt` populated, and history entry note.
4. Retry `GET /vendors/me/verified-check` — should return `{ "status": "VERIFIED" }`.
5. Attempt `POST /admin/vendors/{vendorId}/reject` on a verified vendor.
   - Expect `400` because only pending vendors can be rejected.

## Rejection Path (Optional)
1. Create a second vendor, submit, then call `POST /admin/vendors/{id}/reject` with reason text.
2. Verify `GET /vendors/me` shows status `REJECTED`, `rejectionReason`, and history entry.
3. Update profile (e.g., tweak handle) and resubmit to ensure transition back to `PENDING_REVIEW` works.

## Data Integrity & Audit
- Check `VendorStatusHistory` table to ensure each transition captured with the reviewing admin ID.
- Confirm `kycSubmittedAt` updates on each submission and `reviewedById` tracks the admin for approvals/rejections.

Record test outputs and API payloads in QA sheet before advancing to Phase 3.
