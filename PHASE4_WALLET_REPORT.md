# Phase 4 – Wallet + Flutterwave + Escrow + Transactions

BUILD ONLY. Verified via `npx tsc --noEmit` (0 errors), ESLint (0 issues on all
new/changed files), and a Metro bundle restart (1460 modules, compiled
cleanly). No Playwright/browser automation, no test accounts/bookings created.

All endpoints below were confirmed by directly inspecting the real production
API (`https://mongo-supabase-api.emergent.host/api`) with read-only GET probes
and empty-body POST probes (which only trigger validation errors, never
create records) before writing any code. **No backend changes. No invented
endpoints.**

---

## 1. Files modified/created

**New:**
- `src/services/wallet.service.ts` (rewritten) - real wallet/transaction/topup calls
- `src/utils/walletHelpers.ts` - transaction type metadata, payment-status deriver, static Nigerian bank list
- `src/components/wallet/TransactionList.tsx` - shared search/filter/list/details-modal UI
- `app/(tabs)/wallet.tsx` - Customer Wallet screen
- `app/wallet/topup.tsx` - Flutterwave top-up (WebView Inline Checkout)
- `app/(provider)/wallet.tsx` - Provider Wallet screen
- `app/(provider)/withdraw.tsx` - Provider Withdrawal form

**Modified:**
- `src/types/index.ts` - real Wallet/Transaction/WithdrawRequest/BookingPaymentStatus shapes, added `platform_fee_amount` to Booking
- `src/utils/normalize.ts` - map `platform_fee_amount`
- `app/(tabs)/_layout.tsx` - swapped Feed tab → Wallet tab (Feed route kept, hidden from tab bar)
- `app/(tabs)/bookings.tsx` - payment status badge, "Pay Now" action for unpaid bookings
- `app/(provider)/bookings.tsx` - read-only payment status badge
- `app/(provider)/dashboard.tsx` - Wallet/Withdraw quick actions wired up; fixed a duplicated "Pending Payout" stat to be a real derived value
- `app/booking/[providerId].tsx` - booking now actually pays from wallet (or reports insufficient balance) instead of the old "payment coming in next phase" placeholder

---

## 2. APIs consumed (all real, confirmed via direct probe)

| Endpoint | Use |
|---|---|
| `GET /api/wallets` | Wallet balance (fetched in full, matched by `user_auth_id` client-side - no per-user filter exists server-side) |
| `GET /api/wallet/transactions?auth_id=` | Real transaction history (type, direction, amount, status, reference, booking_id) |
| `POST /api/wallets/{id}/topup?amount=` | Credits wallet after a successful Flutterwave payment |
| `POST /api/bookings/{id}/pay-with-wallet` | Pays a booking from wallet balance (already existed from Phase 3) |
| `POST /api/bookings`, `PUT /api/bookings/{id}` | Booking creation/status (existing) |
| Flutterwave Inline Checkout (`checkout.flutterwave.com/v3.js`) | Client-side payment collection using the existing public key (Card, Bank Transfer, USSD, Mobile Money) |

`POST /api/webhooks/flutterwave` was confirmed to exist (signature-protected, 401 on bad signature) - this is Flutterwave's server-to-server callback and is **not called by the app**; it's the backend's own authoritative crediting path. The app's `topup` call is the client-facing complement so the balance reflects immediately.

---

## 3. Features completed

- **Customer Wallet tab**: current balance, pending escrow, available balance, total spent (all computed from real wallet + transaction data), search + type filters, tap-to-view transaction details, "Top Up" entry point.
- **Flutterwave top-up**: real Inline Checkout via WebView (Card/Bank Transfer/USSD/Mobile Money) using the existing public key; success/failed/cancelled states; credits the wallet via the confirmed `topup` endpoint on success.
- **Provider Wallet**: available/withdrawable balance, pending/completed/total earnings (derived from real bookings, net of `platform_fee_amount` when present), monthly earnings breakdown, withdrawal history, full transaction history.
- **Provider Withdrawal form**: amount (validated against real balance), bank picker (static list of real Nigerian bank names - no bank-list API exists), account number/name. Submitting shows a clear "Coming Soon" message per your instruction (2a) since no backend endpoint exists yet.
- **Escrow/payment status**: derived client-side from real booking status + matching wallet transactions (Awaiting Payment / Paid / In Escrow / Completed / Released / Refunded / Cancelled) - shown as a badge on both customer and provider booking cards.
- **Real booking payment flow**: creating a booking now attempts payment from wallet immediately; if the balance is insufficient, the customer is guided to top up and pay later from Bookings ("Pay Now" button, which re-checks balance and calls `pay-with-wallet`).

---

## 4. Remaining backend limitations (confirmed, not fixable from the frontend)

- **No withdrawal-request creation endpoint** exists on the production API (20+ route name variations tested, all 404). The UI is fully built and validated; submission surfaces a "Coming Soon" message instead of pretending to succeed.
- **No bank-list endpoint** - the bank picker uses a static reference list of real Nigerian bank names.
- **No dedicated escrow or payment-status field** on bookings - status is derived client-side from real data, which is accurate but requires both the booking and wallet-transactions to be loaded together to reach full precision (falls back to a booking-status-only estimate when transactions aren't available).
- **Reviews endpoint (Phase 3.2 finding, still applies)** requires a provider's Supabase UUID which isn't always resolvable if they have no availability configured.

---

## 5. Manual Expo testing checklist

- [ ] Customer → Wallet tab (replacing Feed) → balance/stats load, search & filter transactions, tap a transaction → details modal shows Reference/Date/Time/Amount/Status/Type/Description.
- [ ] Customer → Wallet → Top Up → enter an amount → complete/cancel/fail the Flutterwave checkout → verify success updates balance, cancel/fail show the right screens, never crashes.
- [ ] Customer → create a new booking → if wallet has enough balance, booking should show "Confirmed & Paid"; if not, shows "Payment Needed" with a Top Up button.
- [ ] Customer → Bookings tab → a pending, unpaid booking shows a "Pay Now" button and an "Awaiting Payment" badge; tapping Pay Now (with sufficient balance) pays and updates the badge.
- [ ] Provider → Dashboard → Wallet quick action opens the real Provider Wallet screen (balances, earnings, monthly breakdown, withdrawal + transaction history).
- [ ] Provider → Dashboard → Withdraw quick action → fill form → Submit → see the "Coming Soon" message (expected - no backend endpoint yet).
- [ ] Provider → Bookings tab → each booking shows a payment status badge.

**Note**: Flutterwave's WebView checkout requires a real device/Expo Go network connection to `checkout.flutterwave.com` - it will not render without internet access, and since it uses the real public key, any completed test payment will be a real (small) transaction depending on which mode (test/live) that key is configured for.
