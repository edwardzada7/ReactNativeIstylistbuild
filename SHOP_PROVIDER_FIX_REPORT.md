# iStylist Shop/Provider Bug Fix Report (Feb 2026)

Scope: mobile repository only (`/app`). Railway is offline right now, so
Paystack/Railway-only endpoints could not be exercised live. All findings
below were verified either by (a) direct static/logic tracing of this
repo's code, or (b) live read-only queries against the real Supabase
database (Supabase itself is up; only Railway is down), which let me
confirm/deny real column names without guessing.

---

## TASK 1 — Customer Shop checkout creates no order (root cause found & fixed)

**Root cause:** `POST /payments/paystack/shop/initialize` builds the Paystack
`callback_url` from `payload.redirect_url`, but the frontend
(`shopService.initializePaystackCheckout`) sends the field as `callback_url`,
not `redirect_url`. `PaystackShopInitializeInput` had no `callback_url`
field, so Pydantic silently dropped it and `payload.redirect_url` was always
`None`. Paystack then falls back to whatever generic callback is configured
on the Paystack account dashboard instead of the app's WebView intercept URL
(`REDIRECT_URL` in `cart.tsx`), so `handleShouldStartLoad` never matches the
return URL and `verifyPaystackCheckout` (which runs `finalize_shop_order_stock`
and finalizes the order) never fires. The order row itself IS created (as
`pending`) before payment, but is never finalized/verified — from a
business standpoint this presents exactly as "no order".

**File changed:** `backend/server.py`
- Added `callback_url: Optional[str] = None` to `PaystackShopInitializeInput`.
- `initialize_paystack_shop_checkout` now builds Paystack's `callback_url`
  from `payload.redirect_url or payload.callback_url`.

**Validation performed:** `python3 -m py_compile backend/server.py` passes.
Traced the full path (`create_order` → `initialize_paystack_shop_checkout` →
webview redirect intercept in `cart.tsx` → `verify_paystack_shop_checkout` →
`_finalize_verified_shop_order` → `finalize_shop_order_stock` RPC) and
confirmed `order_id`/`order_items` are preserved and reused throughout, no
duplicate-order creation, and the frontend only shows `success` after the
backend actually confirms the order (all already correct — this one field
was the only break in the chain).

**Testable without Railway?** No — this endpoint is proxied through
Railway/Paystack; a live Paystack test cannot run while Railway is offline.
Fully fixed at the code level; needs a live retest once Railway is back up.

---

## TASK 2 — Provider Shop Referral not working (root cause found & fixed)

**Root cause (in addition to Task 1 blocking `_finalize_verified_shop_order`
from ever running):** the ownership-exclusion check inside
`_create_provider_shop_referrals_for_order` (and the identical check in
`_create_shop_commissions_for_order`) queries
`provider_inventory_listings?product_listing_id=eq.{id}&select=provider_inventory_id`.
Verified live against Supabase that the real column is **`inventory_id`**,
not `provider_inventory_id` — the query returned
`{"code":"42703", "message":"column provider_inventory_listings.provider_inventory_id does not exist"}`.
Since the code treats any non-200 response as "can't verify ownership,
skip this item" (`continue`), **every single order item hit this error and
was skipped**, so the referral function never got as far as actually
inserting into `platform_referral_earnings` for ANY item, ever — not just
provider-owned ones.

Also found the same wrong column name used when *linking* a "Buy for My
Shop" listing back to its source inventory in `list_provider_inventory`
(`POST /provider/inventory/list`), which would have made that insert fail
too.

Verified the referral logic ITSELF (reward type/value sourced from the
`platform_referral_settings` row, not hardcoded; idempotency check against
existing `platform_referral_earnings` rows; correctly skips "Buy for My
Shop" / provider-owned inventory; never invoked for a provider purchasing
their own inventory) is already correct and needed no changes — it just
never got reached.

**Files changed:** `backend/server.py`
- `_create_shop_commissions_for_order`: `select=provider_inventory_id` →
  `select=inventory_id`, and the corresponding `.get(...)` key.
- `_create_provider_shop_referrals_for_order`: same fix.
- `list_provider_inventory`: insert payload key `provider_inventory_id` →
  `inventory_id`.

**Validation performed:** Verified the real column name live via
`GET {SUPABASE_URL}/rest/v1/provider_inventory_listings?select=inventory_id`
(200 OK) vs `...select=provider_inventory_id` (400, column does not exist).
`python3 -m py_compile` passes.

**Remaining known issue (not fixed — could not verify a safe value, so I
did not guess):** `list_provider_inventory` also reads/writes a `quantity`
field on `provider_inventory_listings` and `quantity_allocated_to_listings`
on `provider_inventory` — neither column name could be confirmed to exist
(both return 42703 for every name I tried). I did not have a reliable way
to discover the correct name without risking a wrong guess, and this is one
level removed from the referral bug itself (it affects only the "list
purchased inventory for resale" endpoint, not order verification or
referral creation). Recommend checking the actual
`provider_inventory`/`provider_inventory_listings` migration for the
correct quantity-tracking column name.

**Testable without Railway?** The column-name fix is independently
correct/verifiable via direct Supabase queries (done above) and does not
depend on Railway. Full end-to-end (checkout → referral appears in
`platform_referral_earnings`) still depends on Task 1's fix being deployed
and Railway being back up.

---

## TASK 3 — Shop product reviews not working (no code-level bug found)

Traced `POST/PATCH/DELETE/GET /shop/products/{id}/reviews` end to end:
eligibility check (`_user_has_purchased_product`), duplicate handling
(update instead of duplicate insert), rating/text validation, and the
`product_reviews` insert/select payloads. Verified every column referenced
(`product_id, user_id, user_full_name, user_avatar, rating, review_text,
order_id, item_id, verified_purchase, created_at`) against the live
Supabase schema — all exist exactly as the code expects. The frontend
(`shop/[id].tsx`) submission/edit/delete flow also matches the backend
contract.

**No root-cause bug identified in this repo's code.** Given Railway is
currently offline and this is precisely the endpoint the app calls for
reviews, the most likely explanation for "not working" right now is simply
that the backend is unreachable. No file changes made for this task.

**Testable without Railway?** No — recommend re-testing once Railway is
back online; if reviews still fail at that point, capture the exact error
response for a follow-up trace.

---

## TASK 4 — Provider multi-staff avatar does not save (partial fix; rest is Railway-only code)

**Root cause found (frontend):** `staffService.createMultipart` /
`updateMultipart` manually set `headers: { 'Content-Type': 'multipart/form-data' }`
on the axios request. Doing this **without a boundary parameter** overrides
axios/React Native's automatic FormData boundary generation (which only
happens when Content-Type is left unset) and also overrides this API
client's default `Content-Type: application/json` — either way the
multipart body sent to the server was malformed for file parsing.

**File changed:** `frontend/src/services/staff.service.ts`
- Both multipart calls now send `headers: { 'Content-Type': undefined }`
  instead of a boundary-less `multipart/form-data`, letting the RN/axios
  layer generate the correct `multipart/form-data; boundary=...` header
  itself.

Verified `staff.photo_url` (the field the app reads/writes for the avatar)
is the correct real column name in Supabase — not a naming mismatch.

**Not fixed (Railway-only):** `/staff` and `/staff/{id}` (POST/PUT, the
handlers that actually receive the upload and persist `photo_url`) are not
implemented anywhere in this mobile repository — they are proxied entirely
to Railway. I do not have access to that handler's code in this repo, so I
cannot confirm/rule out a server-side cause. This is explicitly a
Railway-dependent unknown.

**Testable without Railway?** No, not fully — the frontend Content-Type fix
is correct and safe on its own, but confirming the avatar actually
persists end-to-end requires the live `/staff` endpoint (Railway). Staff
services/bio/availability/hide flows were not touched (still using their
existing plain-JSON endpoints, unaffected by this change).

---

## TASK 5 — Cross-check Shop data flow / identifier chain

Verified live against Supabase (no code changes needed, schema already
supports the full chain):
- `product_listings.seller_id`, `product_listings.product_id` — correct.
- `shop_sellers.provider_auth_id` — correct.
- `order_items.product_id`, `order_items.listing_id`, `order_items.seller_id`
  — all exist. Note: `order_items.seller_id` exists as a column but is
  intentionally **not populated** by `create_order` — the code instead
  resolves seller attribution dynamically via
  `order_items.listing_id → product_listings.seller_id → shop_sellers.provider_auth_id`
  at referral/commission/finalization time. This is a deliberate,
  consistent, already-working pattern, not a bug — left as-is per "do not
  change working architecture unnecessarily."
- `orders.customer_auth_id`, `orders.provider_auth_id` — correct.

No identifier substitution bugs found in this chain beyond the
`provider_inventory_listings.inventory_id` issue already fixed under Task 2.

---

## TASK 6 — Provider order display (root cause found & fixed)

**Root cause:** `orders.provider_auth_id` is set (in
`_finalize_verified_shop_order`) to only the *first* seller resolved across
an order's items. A single cart/order can legitimately contain items from
multiple different sellers (multi-seller marketplace). The frontend's
`getProviderOrders` queried `orders` directly with
`.eq("provider_auth_id", providerAuthId)`, which — by both the data model
and Supabase RLS (owner-only reads) — can only ever find orders where this
provider happened to be the *first* seller in that order, silently missing
any order where their item was present but not first.

**Files changed:**
- `backend/server.py`: added `GET /provider/shop-orders`, a privileged
  (service-role) read that resolves this provider's orders correctly via
  `shop_sellers.provider_auth_id → product_listings.seller_id →
  order_items.listing_id` (and `products.stylist_auth_id →
  order_items.product_id` for directly-owned products), returning the
  correct order set with real per-order items attached. This does not
  bypass RLS illegitimately — it uses the same already-established
  service-role bridge pattern this backend already uses for every other
  privileged shop read/write in this file.
- `frontend/src/services/shop.service.ts`: `getProviderOrders` now calls
  this new endpoint instead of a direct (incomplete) Supabase client query,
  keeping the existing per-order `getOrderItems`/customer-name enrichment
  unchanged.

**Validation performed:** `python3 -m py_compile` passes; traced the query
chain manually against the confirmed-correct column names from Task 5.

**Testable without Railway?** No — this is a new endpoint that only exists
in this repo's backend; it must be deployed (to wherever the app's
`EXPO_PUBLIC_API_BASE_URL` actually points) before it can be exercised live.

---

## Files changed (summary)

| File | Tasks | Change |
|---|---|---|
| `backend/server.py` | 1, 2, 6 | `callback_url` field + fallback; `provider_inventory_id`→`inventory_id` (×3); new `GET /provider/shop-orders` endpoint |
| `frontend/src/services/shop.service.ts` | 6 | `getProviderOrders` now calls the new backend endpoint |
| `frontend/src/services/staff.service.ts` | 4 | Removed boundary-less multipart Content-Type override on staff avatar upload |

No schema changes made. No RPC functions redefined (only called
`finalize_shop_order_stock`/existing RPCs by name, unchanged). No
dependencies installed/changed. `package.json`/lockfiles untouched (an
unrelated environment process touched `frontend/yarn.lock`; it was reverted
and is not part of this change set). No unrelated files modified.

## Not tested live (per explicit instruction + Railway being offline)

Per your instruction, no automated end-to-end test was run. All findings
above rely on (a) direct code tracing in this repo, and (b) live read-only
Supabase schema verification (Supabase is up; Railway is not). Please
manually retest in Expo Go once Railway is back online, especially: full
Paystack shop checkout → order visible to both customer and provider →
referral appears in provider's referral earnings.
