# iStylist Beauty Marketplace — PRD / Session Log

## Original problem statement
Import existing GitHub project (React Native Expo app) and set it up for
debugging/building. Frontend .env provided pointing to:
- Backend: https://updatedistylistbeauty-marketplace-production.up.railway.app/api (Railway, live)
- Supabase: https://gvmomyoeokauuixsydiu.supabase.co
- Flutterwave + Paystack test keys

User later explicitly reported 8 concrete bugs and asked to fix them, not add
new features. User prefers manual testing; platform policy still requires
automated verification for reported bugs.

## Architecture discovered
- **Two separate GitHub repos**, not one:
  1. `edwardzada7/ReactNativeIstylistbuild` — the Expo mobile frontend (this
     is what's loaded in this workspace at /app). Also contains an
     experimental local FastAPI "bridge" backend in /app/backend that is
     **NOT** what's deployed to Railway (confirmed: different root response,
     none of its error strings exist on live Railway).
  2. `edwardzada7/UpdatedistylistBeauty-Marketplace` — the REAL backend
     (FastAPI) actually deployed to Railway, auto-deploys on git push. Not
     part of this workspace; cloned temporarily to /tmp for investigation.
- Data layer: Supabase Postgres, accessed via Supabase REST (PostgREST) using
  the service_role key from the backend.

## Bugs reported by user (Feb 2026) — status
1. ✅ Feed post shows generic "Stylist" name instead of real provider/user name
   — FIXED (frontend: `/app/frontend/app/(tabs)/feed.tsx`, wrong camelCase
   field names `businessName`/`displayName` used instead of the real
   `business_name`/`display_name`/`full_name`).
2. ✅ Share location in chat not sending — FIXED (frontend:
   `chat.service.ts` + `chat/[counterpartAuthId].tsx`). For inquiry/
   consultation chats, location was sent as plain `message_type=text`,
   which triggers the backend's anti-contact-leak sanitizer (matches
   "google.com" as a blocked domain) and replaces the whole message with a
   masked placeholder. Added `sendLocationMessage()` that explicitly sets
   `message_type=location` + `location_data`.
3. ✅ Share photo in chat fails ("String should have at most 4000
   characters") — FIXED (frontend). Was sending a full base64-encoded image
   as the `message` field, which always exceeds Railway's 4000-char Pydantic
   limit on that field. Now uploads to the existing Supabase Storage bucket
   `profile-images` (reusing the existing RLS policy path
   `customers/<auth_id>/...` / `providers/<auth_id>/...`) and sends only the
   short public URL as the message.
4. ✅ Feed comments return "not found" after commenting — FIXED (frontend:
   `feed.service.ts` `addComment`). Backend expects the commenter's
   `auth_id` as a **query param** (`?auth_id=...`), but the code was sending
   `author_auth_id` in the JSON body instead — always 401. Verified fix
   live via curl (real 201 response with comment + author_name).
5. ⏳ "Ask a Question" / "Ask About Product" do nothing (502 "Could not
   access conversations") — ROOT CAUSE FOUND, fix written, **not yet
   deployed** (lives in the separate backend repo, no push access). The
   `conversations` table's real column is `conversation_type`, not `type`;
   the `chats` table has `read` + a `metadata` jsonb column, not
   `is_read`/`location_data`/`invoice_data`. This broke essentially the
   entire inquiry/consultation chat feature (create_inquiry, send_message,
   get_messages, list_conversations, unread_count, mark_read). Verified
   live via curl against the real Supabase project. Full corrected code
   diff written to `/app/BACKEND_FIXES_REQUIRED.md`.
6. ⏳ Confirm Booking not creating booking (500 "column
   users.moderation_status does not exist") — ROOT CAUSE FOUND: an existing
   migration (`migrations/phase11_moderation.sql` in the backend repo) that
   adds this column was never run against the live Supabase DB. SQL given
   to user in `/app/BACKEND_FIXES_REQUIRED.md`.
7. ❓ Provider/user profile photos not updating across all avatars —
   INCONCLUSIVE. `ProfileAvatar` already applies cache-busting on mount, and
   each new upload gets a unique file path (timestamped), so it's not simple
   URL caching. Needs a concrete repro (which provider/photo, which screens)
   to pin down further; not fully diagnosed yet.
8. ✅ Feed posts show generic name instead of provider name — same root
   cause/fix as #1.

## What's been implemented this session (Feb 2026)
- `/app/frontend/.env` updated to match user's real Railway + Supabase
  config exactly.
- `/app/frontend/app/(tabs)/feed.tsx` — post author name fix.
- `/app/frontend/src/services/chat.service.ts` — added `sendLocationMessage`.
- `/app/frontend/app/chat/[counterpartAuthId].tsx` — location share fix,
  photo share now uploads to Supabase Storage instead of base64.
- `/app/frontend/src/services/feed.service.ts` — comment auth_id now sent as
  query param.
- `/app/BACKEND_FIXES_REQUIRED.md` — SQL migration + full code patch for the
  2 bugs that live in the separate backend repo (no push access to it).

## Known limitation
This workspace only has push/edit access to `ReactNativeIstylistbuild`
(frontend). The actual Railway-deployed backend lives in
`UpdatedistylistBeauty-Marketplace`, a separate repo — user declined to
share a push token, so those 2 fixes are documented but not yet applied.

## Session 3 (Feb 2026) — Shop/Provider fixes (Railway offline, mobile repo only)
Full report: `/app/SHOP_PROVIDER_FIX_REPORT.md`. Summary:
- FIXED: Shop checkout callback_url/redirect_url field mismatch blocking
  order finalization (backend/server.py).
- FIXED: `provider_inventory_listings.provider_inventory_id` → real column
  `inventory_id` (×3 call sites) — this was silently skipping ALL Provider
  Shop Referral creation for every order item (backend/server.py).
- FIXED: Provider order retrieval only found orders where this provider was
  the *first* seller; added `GET /provider/shop-orders` for correct
  multi-seller attribution (backend/server.py + shop.service.ts).
- FIXED: Staff avatar upload multipart Content-Type override breaking the
  FormData boundary (staff.service.ts).
- NOT FOUND: Product reviews — schema + logic verified correct; no bug
  found in this repo's code (likely just Railway being offline).
- NOT FIXED (unconfirmed column name, did not want to guess):
  `provider_inventory_listings.quantity` / `provider_inventory.
  quantity_allocated_to_listings` used by "Buy for My Shop" resale listing
  endpoint.
- Everything above except the referral column-name fix requires Railway
  back online (or wherever EXPO_PUBLIC_API_BASE_URL actually points) to
  verify live end-to-end.

## Prioritized backlog / next steps
- P0: User runs the SQL migration in Supabase (see below) — fixes booking.
- P0: User (or a future session with push access) applies the
  `consultation_routes.py` patch to the backend repo — fixes Ask a
  Question/About Product + all inquiry/consultation chat messaging.
- P1: Get a concrete repro for bug #7 (profile photo sync) — which
  screen(s), whose photo, before/after.
- P2: Consider moving feed post images (`create-post.tsx`) to Supabase
  Storage too instead of base64 in `image_url`, for consistency/performance
  (not reported broken, but same anti-pattern as the chat photo bug).
