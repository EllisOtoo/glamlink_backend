# Phase 1 Manual Test Script — Email OTP Auth

## OTP Request
1. Start the API: `pnpm start:dev`.
   - Check `GET /health` and confirm `checks.email` reports `up` when your SMTP transport verifies successfully.
2. POST `POST /auth/request-otp` with body `{ "email": "new.vendor@example.com" }`.
   - Expect `202 Accepted` and message `OTP sent if email exists.`
   - Retrieve the OTP from the SMTP inbox configured via Nodemailer or, if SMTP is disabled locally, from the server logs (fallback logging remains active).
3. Immediately repeat the request; expect `400` with cooldown message.

## OTP Verification & Session
1. Use the logged OTP to call `POST /auth/verify-otp` with
   ```json
   {
     "email": "new.vendor@example.com",
     "code": "123456",
     "role": "VENDOR"
   }
   ```
2. Confirm response contains a `token`, `expiresAt`, and `user.role` reflecting the stored role.
3. Reuse the same OTP; expect `401 Invalid or expired code`.

## Authenticated Actions
1. Call `GET /auth/me` with header `Authorization: Bearer {token}` from the verification step.
   - Expect `200` with the user profile.
2. Call `POST /auth/logout` with the same header.
   - Expect `204 No Content`.
3. Reuse the token for `GET /auth/me`; expect `401` because the session was revoked.

## Error Handling
1. Submit `POST /auth/verify-otp` with a wrong code; expect `401 Invalid or expired code` and attempt counter increments.
2. Repeat wrong code until limit hit; expect `401 Too many attempts.`
3. Wait 6 minutes and use an expired code; expect `401 Invalid or expired code`.

Document timestamps and payloads in the QA sheet before closing the phase.
