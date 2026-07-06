# Phase 3.1 – Stabilization & Production Hardening

Session scope: BUILD ONLY (no Playwright/browser automation run per your instruction).
Verification performed: `npx tsc --noEmit` (0 errors) + ESLint (0 issues) + Metro bundle
compiled cleanly (1398 modules, no red-box errors in logs).

## What was changed

### 1. Customer Profile Cleanup (Priority 2) — FIXED
File: `app/(tabs)/profile.tsx`
- Removed hardcoded provider-style stats (`Rating: 4.8`, `Reviews: 8`) that don't apply to
  customer accounts.
- Replaced with **real, live** customer stats pulled from `GET /api/bookings?role=customer`:
  Total Bookings, Upcoming, Completed. Shows a spinner while loading and fails silently
  (stats just don't render) if the API call errors, so the screen never crashes.
- Removed the "Verified Provider" badge block (was a leftover for the wrong role).
- Fixed **dead menu items**: all menu rows (Edit Profile, Wallet, Saved Providers, My Reviews,
  Become a Provider, Help Center, Safety Center, Terms & Privacy, Notifications, App Settings)
  previously called `console.log(...)` and did nothing when tapped — a silent dead-end.
  They now show a clear "Coming soon" alert, matching the pattern already used on the
  Provider profile tab. No more dead taps.
- Logout now wrapped in try/catch so a failed sign-out call can't block navigation back to login.

### 2. Provider Service Catalog Selection (Priority 8) — FIXED
File: `app/(provider)/services.tsx`
- Providers can no longer type an arbitrary service name. Tapping "+" now opens a
  **two-step flow**:
  1. **Choose a Service** — searchable list fetched live from `GET /api/catalog/services`.
     Services the provider has already added are automatically filtered out to prevent
     duplicates.
  2. **Set Price & Duration** — the chosen catalog name is locked (read-only banner);
     provider only enters description (optional), price (₦), and duration.
- Defensive handling: catalog loading spinner, retry button on fetch failure, and an empty
  state when no catalog services remain to add. The "Add Service" button is unreachable
  without a valid catalog selection (`selectedCatalogItem` required).

### 3. Bug Fix — Pre-existing TypeScript Compile Error
File: `app/(auth)/verify-otp.tsx`
- Fixed a ref-callback returning a value (`(ref) => (inputRefs.current[index] = ref)`),
  which TypeScript's `TextInput` ref typing rejects. Changed to a void-returning callback.
  This was blocking a clean `tsc` build.

## Verified as already correct (no changes needed)

- **Search logic (Priority 4)**: `app/(tabs)/search.tsx` already searches live as you type,
  across provider name, category, location, and service names — no need to tap "All" first.
- **Service names (Priority 5)**: Provider profile (`app/provider/[id].tsx`), booking flow, and
  provider services tab all render real `service.name` from the API via `normalizeService()` —
  no generic "Services" placeholder found in the current codebase.
- **Calendar routing (Priority 7)**: The Provider Dashboard's "Calendar" quick action points to
  `/(provider)/bookings`, which is the only bookings/calendar screen that exists — there's no
  separate calendar screen to route to. This is scoped correctly as-is.
- **Crash defensiveness (Priorities 1 & 10)**: Audited `(tabs)/*`, `(provider)/*`,
  `provider/[id].tsx`, and `booking/[providerId].tsx`. All already wrap API calls in
  try/catch, use optional chaining on nullable fields, and show loading/empty/error states.
  `src/utils/normalize.ts` defensively maps inconsistent API field names so the UI never
  renders `undefined`.

## Manual QA checklist for you
- [ ] Login as a **customer** → Profile tab shows real booking counts (not 12/8/4.8).
- [ ] Tap any customer profile menu item → see "Coming soon" alert (no silent dead taps).
- [ ] Login as a **provider** → Services tab → tap "+" → search/select a catalog service →
      enter price/duration → confirm it appears in "My Services" list.
- [ ] Try adding the same catalog service twice → it should no longer appear in the picker
      after the first add.
- [ ] Signup flow → OTP screen → confirm typing digits still auto-advances focus correctly.

## Not in scope this session
- Wallet, Chat, Notifications, Saved Providers, Reviews list, Become-a-Provider flow — all
  intentionally show "Coming soon" and are tracked for a future phase (see `test_result.md`).
