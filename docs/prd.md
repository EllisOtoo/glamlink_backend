# Beauty Booking Platform — Phase 1 PRD (Non‑Technical)

**Version:** 1.1  
**Date:** 2025‑10‑19  
**Owner:** James & Product Team  
**Audience:** Founders/Owners, Product & Project Managers, UI/UX, Engineering, QA, Operations

---

## 1) Executive Summary

**Vision**  
Enable beauty vendors in Ghana (and later other African markets) to run a modern booking business: accept deposits, reduce no‑shows, manage schedules, and build trust through verified profiles and reviews.

**Strategy**  
Phase 1 focuses on **Vendor‑Tools‑First**: a compact vendor toolkit plus public vendor pages reached via **smart booking links** that vendors share on Instagram/WhatsApp and in‑salon QR codes. Once there’s enough verified supply and reviews, Phase 2 selectively enables customer discovery (browse/search).

**MVP Outcome**  
A vendor can go from zero to first paid booking within **7 days** using our app, with automated reminders and clear policies that minimize no‑shows.

---

## 2) Objectives & Success Metrics (Phase 1)

- **Activation:** ≥40% of onboarded vendors complete ≥1 paid booking within 7 days.
- **Reliability:** No‑show rate ≤5% (with deposits + reminders).
- **Liquidity:** ≥3 bookings per active vendor per week in target areas.
- **Trust:** ≥35% of completed appointments receive a review.
- **Delight:** App store rating ≥4.5 after first 100 ratings (stretch).

**Guardrails / Non‑Goals (Phase 1)**  
No open marketplace browse/search; no multi‑staff scheduling; no complex loyalty programs. We bias for speed, clarity, and adoption.

---

## 3) Users & Roles

**Customer**  
Books and pays a deposit, receives reminders, reschedules/cancels within policy, and leaves reviews.

**Vendor**  
Creates services and availability, shares booking links/QR, collects deposits, manages appointments, runs simple promos, responds to reviews, and views basic analytics.

**Admin/Ops**  
Verifies vendors (KYC), handles disputes/refunds, manages categories/areas, toggles feature flags by city/area, oversees KPIs.

### Permissions (Plain‑English)

| Capability                     | Customer | Vendor                 | Admin/Ops |
| ------------------------------ | -------- | ---------------------- | --------- |
| Sign up / log in               | ✓        | ✓                      | ✓         |
| Create & manage services       |          | ✓                      |           |
| Manage availability & calendar |          | ✓                      |           |
| Generate promo links / QR      |          | ✓                      |           |
| Book & pay deposit             | ✓        |                        |           |
| Reschedule / cancel            | ✓        | ✓ (approve per policy) |           |
| Write review / reply           | ✓ /      | ✓                      |
| Verify vendors & refunds       |          |                        | ✓         |
| Configure areas/flags          |          |                        | ✓         |

---

## 4) Markets & Assumptions (Ghana, Phase 1)

- Mobile Money is common; deposits materially reduce no‑shows.
- Instagram/WhatsApp are primary discovery and booking channels for beauty services.
- Trust signals (verified badge, reviews, visible policies) drive conversion.
- Data protection compliance is required (register as a data controller; obtain user consent; honor deletion requests).

---

## 5) Scope & Phasing

**Included in Phase 1**  
Vendor onboarding & KYC, service catalog & pricing, availability & scheduling, smart booking links (discounts, limits, attribution), deposits at booking, reminders & rescheduling, reviews & replies, vendor analytics (lite), public vendor page, customer “Connect to my stylist” flow (scan QR / enter @handle or code), and admin basics (KYC, disputes/refunds, featured vendors).

**Out of Scope (Phase 2+)**  
Open marketplace browse/search, ranking & promoted listings, multi‑staff/location scheduling.

---

## 6) User Journeys

### A) Vendor → First Paid Booking

1. Install app → sign up → accept terms
2. Submit KYC (basic business details + ID)
3. Create **≥3 services** (name, price, duration, buffer)
4. Set weekly availability & exceptions
5. Connect payments
6. Generate **smart link** + QR → share on IG/WhatsApp/in‑salon
7. Customer books & pays deposit → reminders scheduled
8. Service completed → review request → vendor reply (optional)

**Success:** First paid booking within 7 days of onboarding.

### B) Customer (No Link) → Connect to Stylist → Book

1. Install app → phone OTP → allow notifications
2. Home options: **“I have a stylist”** (primary) or **“I’m looking for one”** (secondary)
3. Connect to stylist via **Scan QR**, **Enter @handle**, or **Enter 6‑digit code**
4. View vendor page → pick service & time → pay deposit
5. Receive reminders → attend → leave review

### C) Reschedule / Cancel

- Reschedule from upcoming appointment within policy window.
- If late, show forfeiture of deposit clearly before confirming.
- Update reminders accordingly.

### D) Admin Dispute / Refund

- Review case details; pick outcome (full/partial/no refund) per policy; notify both parties; log decision rationale.

---

## 7) Experience Principles

- **WhatsApp‑native flow:** short steps, clear summaries, one‑tap actions.
- **Money clarity:** always show deposit %, fees, and refund rules before payment.
- **Trust upfront:** verified badges, portfolio photos, real reviews, response times.
- **Low friction:** default to earliest sensible slots; prevent overlaps with buffers.
- **Consistent tone:** warm, direct, and respectful.

---

## 8) Feature Requirements (Product‑Level)

> Each feature lists what the user should be able to do and **acceptance criteria (AC)** phrased in outcome terms. Technical implementation is intentionally omitted here.

### 8.1 Authentication & Accounts

- Sign in with phone (OTP) or email/password.
- Maintain a signed‑in session; simple profile management.  
  **AC:** Users can sign in within 60 seconds; lockouts/rate limits protect from abuse; clear error messaging.

### 8.2 Vendor KYC & Profile

- Submit basic business details and ID; display verified status on approval.
- Editable profile: name, bio, categories, location/area, portfolio photos.  
  **AC:** Only verified vendors can accept payments and be findable by handle/code; changes reflect within the session.

### 8.3 Services & Pricing

- Create/edit/archive services with price, duration, and buffer time.  
  **AC:** Validation prevents unrealistic values; customers always see current pricing.

### 8.4 Availability & Scheduling

- Set weekly hours and one‑off exceptions (off days, extended hours).
- System prevents double‑booking and respects buffers between services.  
  **AC:** Next 30 days of slots reflect rules and exceptions; editing availability updates visible slots promptly.

### 8.5 Smart Booking Links & QR

- Create shareable links with optional preselected service, discount, caps/expiry, and channel tagging (IG/WA/QR).
- Auto‑generated QR for in‑salon use.  
  **AC:** Links open the correct vendor/service with promo applied; expired/used‑up links show a friendly message and default to the vendor page.

### 8.6 Public Vendor Page (Web + In‑App View)

- Show vendor name/badge/area, portfolio, services, policies, ratings/reviews, and earliest available slots.
- Prominent **Book now** call‑to‑action.  
  **AC:** Page loads quickly; checkout shows deposit and policy clearly; sharing shows a rich preview in social apps.

### 8.7 Booking & Payment

- Customer selects service & time, reviews summary, and pays a **deposit** or full amount (per vendor setting).
- Booking is confirmed only after successful payment; customer gets a confirmation screen and message.  
  **AC:** Customers always see the financial impact of policies before paying; confirmed bookings appear on both customer and vendor calendars.

### 8.8 Reminders, Rescheduling & Cancellations

- Automated reminders before the appointment; easy reschedule/cancel within policy.  
  **AC:** Messages arrive at appropriate times; rescheduling is one‑tap from the reminder or app; policies are enforced consistently.

### 8.9 Reviews & Replies

- Post‑service review (stars + optional text/photos); vendor can reply once.  
  **AC:** Only customers with a completed appointment can review; average rating and responses display clearly.

### 8.10 Vendor Analytics (Lite)

- View clicks → bookings → conversion, revenue, average discount, no‑show rate, top services; breakdown by channel.  
  **AC:** Metrics are understandable at a glance; export basic report if needed.

### 8.11 Customer App (Direct Install without Link)

- Home “Connect to your stylist” with Scan QR / Enter @handle / 6‑digit code; alternative: waitlist or invite your stylist.  
  **AC:** Exact‑match connect works reliably; failed attempts are throttled with helpful feedback.

### 8.12 Admin Console

- Review & approve KYC; manage disputes/refunds; manage categories/areas; toggle discovery by area; feature selected vendors.  
  **AC:** Every admin action leaves a traceable record; customer/vendor communications are clear and consistent.

---

## 9) Business Rules (Phase 1)

- **Deposits:** vendor‑configurable (typically 10–30%).
- **Cancellation windows:** vendor‑configurable (e.g., free reschedule ≥24h; late cancellations forfeit deposit).
- **No‑shows:** vendor‑marked; no automatic refunds; may affect vendor reliability signals.
- **Discount links:** enforce usage caps, per‑user limits, and start/end dates; discounts are non‑stackable.
- **Eligibility:** only verified vendors can accept payments and be reachable by handle/code.
- **Reviews:** only after completion; one review per appointment; vendor may reply once.

---

## 10) Quality & Service Expectations (Non‑Functional)

- **Availability:** service generally available throughout the month (target ≥99.5%).
- **Performance:** pages and core actions feel fast on common mobile networks; booking flow completes in under ~60 seconds under normal conditions.
- **Scalability:** can handle seasonal peaks (e.g., December) without loss of confirmations or reminders.
- **Accessibility:** readable text, large tap targets, and color‑contrast mindful UI.
- **Localization:** currency in GHS, dates/times in Africa/Accra, copy tailored for Ghana.

---

## 11) Measurement & Insights

**Key questions**

- Are vendors reaching first paid booking within a week?
- Where do link clicks come from (IG, WA, QR), and how do they convert?
- What % of bookings reschedule/cancel and at what times?
- Are review coverage and ratings improving trust and conversion?

**Funnel examples**

- Vendor: onboard → services added → availability set → link shared → first paid booking.
- Customer: view vendor page → start checkout → payment success → review submitted.

---

## 12) Release Plan (90 Days)

**Sprint 1:** Foundations — onboarding & KYC, services & availability, public vendor page skeleton, basic booking (unpaid).  
**Sprint 2:** Smart links & QR, paid bookings with deposit, confirmation & success flow.  
**Sprint 3:** Reminders & rescheduling, reviews & replies, vendor analytics (lite).  
**Sprint 4:** Admin console (KYC, disputes/refunds), polish, seed initial vendors, launch.

**Launch readiness**

- ≥20 verified vendors live, ≥50 end‑to‑end paid bookings in test/prod, stable reminders, helpful error rates and support playbooks.

---

## 13) QA Approach (Representative)

- **Sign‑in:** expired/incorrect codes, lockout and messaging.
- **Availability:** overlapping rules, buffers, and exception days.
- **Booking & payment:** double submits, slot races, clear money copy.
- **Smart links:** expired or exhausted promos, caps, and friendly fallbacks.
- **Reminders:** send timing, reschedule flows, cancellation policy messaging.
- **Reviews:** only after completion; spam/abuse prevention.
- **Admin:** permission gating and action history present.

---

## 14) Go‑to‑Market Snapshot (Phase 1)

- **Invite‑your‑stylist:** customers earn small credits when stylists activate and complete first booking; stylists get fee‑free week.
- **Creators:** micro‑influencers receive unique links; rewards tied to completed bookings.
- **In‑salon assets:** QR table tents and mirror stickers with stylist handle and booking instructions.
- **Seasonality:** early‑bird deposits for holiday periods (e.g., December).

---

## 15) Risks & Mitigations

- **Payment issues:** clear statuses and recovery paths; manual support playbook.
- **Reminder deliverability:** multi‑channel (primary + fallback) and resend logic.
- **Adoption stall:** strong invite flows and vendor incentives; targeted onboarding in dense areas.
- **Fraud/abuse:** KYC gating; reviews only post‑completion; policy transparency.

---

## 16) Open Questions

- Category‑specific default deposits (e.g., braids vs. makeup)?
- Standard vs. vendor‑custom cancellation windows?
- Who bears platform fees (vendor vs. customer line item)?
- Initial neighborhoods for curated discovery cards (if any) before full marketplace?

---

## Appendix A — Sample Copy

- **Deposit banner:** “Reserve this slot with a **30% deposit**. Fully refundable if you cancel **24+ hours** before your appointment.”
- **Late cancel modal:** “This cancellation is within **24 hours**. Your **30% deposit won’t be refunded**. Continue?”
- **Review prompt:** “How did it go with **{Vendor}** today? Your rating helps others.”

## Appendix B — Notification Templates (Draft)

- **Confirmation:** “You’re booked for **{Service}** with **{Vendor}** on **{Date} {Time}**. Need to change it? Tap to reschedule.”
- **Reminder:** “Reminder: **{Service}** tomorrow at **{Time}**. See details: {link}.”
- **Review:** “Rate your experience with **{Vendor}** (takes 10 seconds).”

## Appendix C — Acceptance Criteria Checklist (Per Feature)

- [ ] Empty, loading, error, and success states designed
- [ ] Copy finalized (especially money & policy text)
- [ ] Edge cases listed and tested (reschedule, late cancel, no‑show)
- [ ] Analytics events defined (for funnels above)
- [ ] Admin visibility and action history confirmed
- [ ] Support playbook updated for this feature
