# Bug Fix Report — Phase 3.1

| # | Issue | File | Fix | Status |
|---|-------|------|-----|--------|
| 1 | Customer Profile showed hardcoded/fake provider metrics (Rating 4.8, Reviews 8) | `app/(tabs)/profile.tsx` | Replaced with live counts from `GET /api/bookings?role=customer` (Total/Upcoming/Completed) | Fixed |
| 2 | Profile menu items were dead taps (`console.log` only, no UI feedback) | `app/(tabs)/profile.tsx` | Added `Alert.alert('Coming soon', ...)` for every unbuilt destination | Fixed |
| 3 | Providers could type any arbitrary service name, breaking catalog consistency | `app/(provider)/services.tsx` | New 2-step "pick from catalog → set price/duration" flow; name field now locked | Fixed |
| 4 | No duplicate-prevention when adding services | `app/(provider)/services.tsx` | Catalog picker filters out services the provider already added | Fixed |
| 5 | `npx tsc` failed with a ref-callback type error | `app/(auth)/verify-otp.tsx` | Changed ref callback to not return a value | Fixed |

## Verification method (per your BUILD ONLY instruction)
- `npx tsc --noEmit` → **0 errors** (previously 1 error, see #5).
- ESLint on both changed files → **0 issues**.
- Metro bundler restarted → compiled 1398 modules with no red-box/runtime errors in logs.
- No Playwright/browser automation was run. Please validate manually via Expo Go.

## Items reviewed and found already working (no action taken)
- Search-without-category-tap, real service names on provider profile/booking screens,
  Calendar button routing, and general try/catch + loading/empty states across
  Home/Search/Bookings/Dashboard screens. Details in `PHASE3_1_REPORT.md`.
