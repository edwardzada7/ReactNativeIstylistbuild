# iStylist Mobile - Beauty Services Marketplace (Expo/React Native)

## Original Problem Statement
User provided `.env` credentials (Supabase, Paystack, Flutterwave, Railway backend URL) for an
existing "iStylist" beauty marketplace project and asked to set up the project so development/bug
fixing can start.

Clarification outcome: user has TWO existing GitHub repos:
1. `UpdatedistylistBeauty-Marketplace` - a CRA **web** app (React + Tailwind + Shadcn) + a large
   (10k+ line) FastAPI backend. NOT usable in this Expo-only mobile preview environment.
2. `ReactNativeIstylistbuild` - the actual **Expo/React Native mobile app** (expo-router, SDK 54)
   with a thin FastAPI backend that acts mostly as a privileged Supabase write-bridge + proxy to a
   primary Railway backend. **This is the repo now loaded into `/app`.**

## Architecture
- **Frontend**: Expo Router (SDK 54), React Native 0.81.5, TypeScript, Zustand + React Query,
  `@supabase/supabase-js` for direct reads, Axios for backend calls.
- **Backend** (`/app/backend/server.py`, ~2885 lines): FastAPI. Talks to:
  - **Supabase** directly (service role key) for privileged writes: shop orders/order_items,
    chat messages, product reviews, provider inventory/purchase, referral earnings.
  - **Primary backend** (Railway, `PRIMARY_BACKEND_URL` hardcoded in server.py) - proxies ANY
    endpoint not implemented locally (fetches Railway's `/openapi.json` at startup to auto-register
    proxy routes), and is a **hard dependency** for: booking creation (wallet balance check +
    booking POST), Flutterwave wallet top-up verification.
  - Most reads (notifications, legal pages, portfolio, shop products, chat history) are done
    **directly from the mobile app against Supabase** (RLS-protected), bypassing this backend
    entirely per the architecture comment in server.py.
- **Database**: Supabase Postgres (project `gvmomyoeokauuixsydiu`) - live production data (24
  users, 99 bookings, 226 payments, etc. at time of setup).
- **Auth**: Supabase Auth (email/password).
- **Payments**: Paystack (shop checkout, provider inventory purchase) + Flutterwave (wallet
  top-up, verified via Railway proxy).

## Known Blocker (flagged to user, not yet fixed)
**Railway backend (`updatedistylistbeauty-marketplace-production.up.railway.app`) is OFFLINE**
(confirmed: Railway itself returns "Application not found" - the deployment appears removed, not
just sleeping). This breaks, until Railway is redeployed or these are reimplemented locally:
- Booking creation (`POST /api/bookings` - wallet check + upstream create)
- Flutterwave wallet top-up verification
- Any other endpoint not explicitly defined in the local `server.py` (proxy auto-registration
  fails silently, logged as a warning on startup)

Shop checkout (Paystack), product reviews, provider inventory/purchase, and most direct-Supabase
reads/writes are NOT affected by the Railway outage.

## Environment Setup Done (this session)
- `/app/backend/.env`: MONGO_URL, DB_NAME, CORS_ORIGINS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  PAYSTACK_SECRET_KEY, ADMIN_DASH_KEY, DATABASE_URL, JWT_SECRET, FLW_* - all set from user-provided
  values (only SUPABASE_URL/SERVICE_ROLE_KEY/PAYSTACK_SECRET_KEY/ADMIN_DASH_KEY are actually read by
  `server.py` today).
- `/app/frontend/.env`: `EXPO_PUBLIC_API_BASE_URL` set to **this pod's own domain** + `/api`
  (Railway URL replaced since it's offline), `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`.
- Installed backend Python deps (`pip install -r requirements.txt`) and frontend deps
  (`yarn install`). Confirmed backend responds on `/api/` and frontend renders the Login screen
  correctly on web preview (screenshot verified).
- The old web repo's frontend/backend were fully removed from `/app` (per user's explicit
  instruction) in favor of this mobile repo. An earlier accidental edit to `backend/server.py` was
  reverted via `git checkout` before being replaced by this repo's version.

## Next Action Items (backlog, not yet started)
- User to report specific bugs to fix (this session's job was environment setup only).
- Decide how to handle the offline Railway dependency: (a) user redeploys Railway, or
  (b) reimplement the proxied endpoints (mainly booking creation + wallet) directly against
  Supabase in `/app/backend/server.py`.
- Consider testing sign-up/login end-to-end against the live Supabase project once user confirms
  which flows to prioritize.
