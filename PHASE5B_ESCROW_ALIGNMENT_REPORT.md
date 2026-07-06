# Phase 5B – Wallet → Escrow Booking Flow Alignment Report

**Scope:** Mobile client (Expo/React Native) only. No backend, database, Supabase
schema, or API endpoint was created, modified, or migrated. Every change below
re-wires the existing mobile screens to call **only endpoints that already
exist** on the production API (the same backend the web app uses).

---

## 1. Files Modified

| File | What changed |
|---|---|
| `app/booking/[providerId].tsx` | Booking Summary now shows Wallet Balance, Escrow Amount, and a protection message. Primary button renamed **"Confirm & Pay from Wallet" → "Confirm Booking"**. Wallet balance is checked *before* creating the booking (not after). If insufficient, the booking is **not created** — an inline "Your wallet balance is insufficient" panel (Current Balance / Required / Shortfall) with a **Top Up Wallet** button is shown instead. On refocus after Top Up, if the balance is now sufficient, the exact same booking is auto-completed (created + paid from wallet) with no re-selection of service/date/time. |
| `app/(tabs)/bookings.tsx` | "Pay Now" button renamed to **"Pay from Wallet"** (same underlying wallet-only logic — this was already wallet-based, only the label was misleading). Added focus-refresh (wallet + bookings refetch every time the tab regains focus). Added defensive `no_show` / `disputed` status color + tab bucket so these (if the backend ever returns them) remain visible instead of disappearing. Raw status text now formatted via `formatStatusLabel` (e.g. `no_show` → "No Show") instead of raw snake_case. |
| `app/(provider)/bookings.tsx` | Added focus-refresh. Added defensive `no_show` / `disputed` handling (color + "Cancelled" filter bucket). Status text formatted via `formatStatusLabel`. |
| `app/(provider)/dashboard.tsx` | Added focus-refresh so stats (Total Earnings, Pending Payout, Completed Services) reflect the latest booking/wallet state whenever the provider returns to this screen. |
| `app/(tabs)/wallet.tsx` | Added focus-refresh (balance + transactions refetch on every focus). |
| `app/(provider)/wallet.tsx` | Added focus-refresh. **"Pending Earnings" renamed to "In Escrow"** (same booking-derived projection, clearer wording that the money is locked). **"Completed Earnings" renamed to "Released Earnings" and now computed from real `ESCROW_RELEASE` wallet transactions** (previously it was a client-side guess from `status === 'completed'` bookings — now it reads the actual production ledger, which is *more* accurate, not a local calculation). Added a one-line explainer: "Money from new bookings stays locked in escrow and only moves into your wallet once the service is marked completed and released." Fixed a missing `useMemo` dependency (`transactions`). |
| `src/utils/walletHelpers.ts` | Added `formatStatusLabel()` — a pure display formatter (snake_case → Title Case) for whatever raw `status` string the backend returns. Does not invent any new status values. |

No other files were touched. No backend code, `.env` URLs, or database logic were modified.

---

## 2. Endpoints Reused (all pre-existing, confirmed already in use by Phase 4)

| Endpoint | Used for |
|---|---|
| `GET /api/wallets` | Read wallet balance (customer & provider) |
| `GET /api/wallet/transactions?auth_id=` | Transaction history, escrow-hold/release detection |
| `POST /api/wallets/{id}/topup` | Client-facing wallet credit after a successful Flutterwave checkout (webhook `/api/webhooks/flutterwave` remains the backend's authoritative source) |
| `POST /api/bookings` | Create booking |
| `POST /api/bookings/{id}/pay-with-wallet` | Pay a booking from wallet balance → moves funds into escrow |
| `PUT /api/bookings/{id}` | Status transitions (confirm/reject/arrived/completed/cancelled) — provider side |

**No new endpoint was invented.** Everything above was already wired in the codebase before this phase (Phase 4); Phase 5B only changed *when* and *how* the mobile UI calls them, and how results are labeled/displayed.

---

## 3. Booking Flow (as implemented)

```
Customer taps "Book Now"
   → Select Service → Select Date → Select Time
   → Booking Summary shown:
        Service, Provider, Date, Time, Price,
        Wallet Balance, Escrow Amount,
        "Your payment is securely held in escrow until the
         service has been completed."
   → GET /api/wallets checked BEFORE booking is created

   IF walletBalance >= price:
        Button: "Confirm Booking"
        → POST /api/bookings           (create)
        → POST /api/bookings/{id}/pay-with-wallet   (pay + escrow)
        → Booking now PAID (ESCROW), provider sees it via GET /api/bookings

   IF walletBalance < price:
        Booking is NOT created yet.
        Inline panel shown:
           "Your wallet balance is insufficient."
           Current Wallet Balance / Required Amount / Shortfall
           Button: "Top Up Wallet" → /wallet/topup (Flutterwave)
        On successful top-up, customer returns to the booking screen:
           → wallet balance is re-checked on focus
           → if now sufficient, the SAME booking attempt is completed
             automatically (create + pay), no re-selection needed
```

Fallback (rare race condition — balance changed between the check and the
actual pay call): if `pay-with-wallet` still fails after booking creation,
the customer sees "Retry Payment" and "Top Up Wallet" options, and the same
booking (not a duplicate) can be retried from `app/(tabs)/bookings.tsx`
("Pay from Wallet" button on that booking's card).

---

## 4. Wallet Flow

- **Customer wallet** (`app/(tabs)/wallet.tsx`): Current Balance (real,
  authoritative), Pending Escrow (derived from real `ESCROW_HOLD`
  transactions without a matching release/refund), Total Spent, full
  transaction list. Refreshes on every focus.
- **Provider wallet** (`app/(provider)/wallet.tsx`): Available Balance (real,
  authoritative — **never** includes escrowed/unreleased funds), In Escrow
  (booking-derived projection of confirmed/arrived bookings), Released
  Earnings (real `ESCROW_RELEASE` ledger transactions), Withdrawable
  (= Available Balance), monthly earnings chart, withdrawal history.
  Refreshes on every focus.
- **Top Up Wallet** (`app/wallet/topup.tsx`) is the **only** place
  Flutterwave is used. The booking flow never calls Flutterwave directly —
  it only ever debits the existing wallet balance via `pay-with-wallet`.

---

## 5. Escrow Flow

1. Customer pays a booking → `pay-with-wallet` debits the customer wallet
   and (server-side) creates an `ESCROW_HOLD` ledger entry tied to the
   booking.
2. Provider accepts/marks arrived (`PUT /api/bookings/{id}`) — booking
   remains in escrow; provider's wallet balance is **not** touched.
3. Provider marks the booking **completed** — this is the last client
   action available; escrow release into the provider's wallet is assumed
   to happen server-side (see limitation below). The app never credits the
   provider wallet from the client.
4. Once released, the real `ESCROW_RELEASE` transaction appears in
   `GET /api/wallet/transactions` and is reflected in "Released Earnings"
   and the real wallet balance the next time either wallet screen is
   focused or pulled-to-refresh.

---

## 6. Backend Limitations Discovered (documented, NOT worked around with invented endpoints)

- **No client-visible escrow-release-trigger endpoint.** There is no
  documented `POST /bookings/{id}/release-escrow` (or similar) callable from
  the client. Release is assumed to be automatic server-side once a booking
  is marked `completed` (or via an admin/backend job), consistent with "the
  production backend already computes escrow values" per the web platform.
  If release is NOT automatic on the backend, provider payouts will not
  reflect in the wallet balance until whatever backend process performs it
  runs — this is a backend-side behavior, out of scope for a mobile-only
  change.
- **No `/api/notifications` endpoint** (confirmed 404 in Phase 5A) — the
  Notifications screen remains a UI placeholder. "Notify provider after
  booking" / "Notify customer+provider after release" could not be wired to
  a real push/in-app notification feed because none exists yet on the
  production API.
- **No withdrawal-request-creation endpoint** (confirmed in Phase 4 — 20+
  plausible route names all returned 404). The provider Withdraw screen
  still shows a clear "coming soon" message instead of pretending to submit
  a request.
- **No dedicated `payment_status` / `escrow` field on the `Booking` object.**
  All payment/escrow labels (Awaiting Payment, Paid, In Escrow, Completed,
  Released, Refunded, Cancelled) are derived client-side from the real
  `booking.status` + matching `booking_id` wallet transactions — this was
  already the case since Phase 4 and is unchanged; Phase 5B only reused and
  relabeled it consistently.

---

## 7. Validation Performed (per explicit instruction — no Playwright/testing agent)

- `npx tsc --noEmit` → **0 errors**
- ESLint on every modified file → **0 issues**
- Metro bundler (`expo start`) → clean bundle, Web + iOS, no compile errors, across 2 restarts

No automated browser testing, no backend changes, no invented endpoints.
