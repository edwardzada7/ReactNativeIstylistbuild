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

## Session — Jun 2026: repo reconnect / build health
- Recreated missing /app/frontend/.env (API base URL, Supabase URL/anon key, Paystack public key, packager vars for this preview).
- Added app/(admin)/_layout.tsx (fixes "No route named (admin)" warning).
- Verified: Metro bundles web/iOS/Android; login, signup, forgot-password screens and validation work (iteration_2).
- Open: Railway CORS blocks web-preview origin (native Expo Go unaffected); guest -> /(tabs) redirected to /login (decide guest browsing); minor RN warnings (shadow*, pointerEvents, stray text node in a View).

## Session — Jun 2026: guest browsing + screenshot bug fixes (not auto-tested, user tests manually)
- Guest browsing: (tabs) no longer protected; Bookings/Wallet/Profile/Messages/Notifications show GuestPrompt (src/components/common/GuestGate.tsx) for guests; Book/Ask/Consult/Like/Report/product inquiry send guests to login; login has "Continue as guest"; home skips auth-only calls for guests.
- Chat "conversation_type is required": booking chats no longer call /conversations/{id}/mark-read (backend only accepts inquiry/consultation); shared chats pass the type.
- Crash "Cannot read property 'toString' of null": null route params (provider business_name, counterpart_name) now coerced to strings.
- "Input should be a valid integer": provider profile resolves auth UUIDs to numeric user_id via /stylists/by-auth before /full-profile.
- Provider profile: removed duplicate star, hide empty "₦" price range, staff photo uses ProfileAvatar instead of via.placeholder.
- Provider bookings: fixed clipped filter chips; resolves real customer names via /users/by-auth when backend returns "Customer"; hidden stray "messages" tab in provider tab bar.

## Session — Jun 2026 (3): Ask-a-question, guest banner, names, rebook (user tests manually; no automated tests per user)
- Ask a Question: full-profile has no auth_id → provider.user_id was empty → push to "/chat/" (Unmatched route). Now resolved via GET /stylists/{user_id}.auth_id (src/services/people.service.ts).
- Recommend provider: resolves recommended_provider_auth_id to stylist auth UUID.
- Service invoice "Could not load services": stylists PK is user_id (no id column) — fixed client-side.
- Feed comments "User": resolves author names; customer names on provider dashboard/bookings/booking detail; shared-chat counterpart names.
- Guest sign-up banner on provider profile; "Book Again" on completed/cancelled bookings + Home "Book Again" strip.
- BACKEND/DB (not fixable from app): invoices table lacks amount, location, service_type, staff_id columns → POST /invoices 502 ("Something went wrong"). Service invoice validation also queries stylists.id and provider_services.provider_id which don't exist.

## Session — Jun 2026 (4) (no automated tests per user)
- SQL migration: /app/supabase/migrations/20260601_fix_invoices_orders_avatars.sql (invoices/invoice_items columns, stylists.id & provider_services.provider_id generated aliases, orders RLS select, stylists public read, own-profile update policies, public_profiles view).
- Booking chat Unmatched Route: bookings' provider id is the auth UUID (provider_id / stylist_auth_id); normalized provider_auth_id; chat list skips threads without counterpart; guards on chat buttons.
- Avatars/names: people.service stylist directory (stylists.profile_image_url via Supabase) applied to home/search providers, provider profile, feed posts, chat list, customer bookings; invalidated on profile photo upload.
- Product review: auth_id query param (create/update/delete). Report post: reporter_auth_id + backend reason enum + lowercase target_type.
- Home: duplicate star & lone ₦ removed (home/search); Rebook reminder card (src/components/booking/RebookReminder.tsx, 21+ days, dismissible).

## Session — Jun 2026 (5) (no automated tests per user)
- Speed: chat list loads booking chats in parallel (was sequential); people lookups use one cached stylist directory (5 min) with fast path; enrichment runs in background; in-memory stale-while-revalidate cache (src/utils/screenCache.ts) for Home, Shop, customer Bookings, provider Dashboard/Bookings, Messages; dashboard requests parallelized.
- Staff save 500: backend /staff is JSON-only → photo uploaded to Supabase storage profile-images/staff/<auth>/..., then JSON with photo_url.
- Chat list avatars use ProfileAvatar (no via.placeholder "150x150").
- Android text clipping: global Text patch (src/utils/androidTextFix.ts: fontFamily sans-serif + textBreakStrategy simple), provider booking action buttons centered.
- SQL migration updated (::text casts, staff photo storage policies).

## Session — Jun 2026 (6) (no automated tests per user)
- Cross-account stale messages: screenCache + people cache cleared on login/logout/SIGNED_OUT.
- Ratings: RatingStars component (5 stars + "4.5 (12 reviews)") on Home, Search, provider profile, own profile; SQL trigger keeps stylists.rating + review_count in sync from reviews; directory merges them.
- Verified tick: VerifiedBadge on Home, Search, Feed, Messages, Bookings, Book Again, provider profile (from stylists.is_verified).
- Referral earnings: read platform_referral_earnings directly (backend has no provider route) + RLS policy.
- Service invoice: backend checks empty provider_services; migration #2 replaces it with a view over services.
- Migration #2: /app/supabase/migrations/20260602_ratings_referrals_service_invoice.sql

## Session — Jun 2026 (7) (no automated tests per user)
- Product invoice 502: invoice_items.unit_price/total_price NOT NULL but backend never sends them → migration #3 trigger fills from product/service price; invoices.order_id added.
- Shop orders empty: checkout writes shop_orders/shop_order_items, app read "orders" → app now reads shop_orders (+legacy orders); provider orders via shop_order_items⋈products(stylist_auth_id); RLS in migration #3.
- Ratings 0: app now uses GET /providers/{auth_id}/reviews (avg_rating,total_reviews) for Home/Search cards, provider profile, dashboard, own profile (works without migration #2).
- Provider feed header: owns top inset; embedded Feed skips top edge. Dashboard greeting single line.
- Migration #3: /app/supabase/migrations/20260603_product_invoices_shop_orders.sql

## Session — Jun 2026 (8) (no automated tests per user)
- Rebook reminder NaN weeks: robust visit date parsing (scheduled_at / date+time / booking_date / created_at).
- Search categories: chips fixed height (no stretching); top-level categories match providers via catalog (category → services → sub-services) using primary_category/primary_service.
- Shop reviews: reviewer_name / reviewer photo (people directory) mapped to UI fields; avg_rating/total_reviews mapped to summary.
- Speed: provider profile cached per id (instant revisit), rating lookup capped at 1.2s.
