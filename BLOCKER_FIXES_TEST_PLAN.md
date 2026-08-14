# Manual Test Plan - Blocker Fixes

## BLOCKER 1: Provider Account Type (Individual/Business)

### Root Cause: MISSING BACKEND ENDPOINTS

**Exact Issue:**
- Frontend `profile.tsx` line 237 calls: `GET /api/users/by-auth/{auth_id}`
- Frontend `profile.tsx` line 257 calls: `PATCH /api/users/by-auth/{auth_id}` with `{ account_type: newType }`
- **Backend had NO implementation** of these endpoints
- Database `users` table was missing the `account_type` column

**Data Flow That Was Broken:**
```
User clicks "Business" button
  ↓
profile.tsx calls PATCH /users/by-auth/{auth_id} 
  ↓
ERROR: "Failed to update account type" (404 or 422 or proxy timeout)
  ↓
account_type never persists to Supabase
  ↓
On next login, app reloads, account_type still shows "individual"
```

### Fix Applied

**1. Backend Endpoints Added (backend/server.py lines 993-1157):**

```python
@api_router.get("/users/by-auth/{auth_id}")
# Returns: { id, auth_id, email, name, account_type, ... }

@api_router.patch("/users/by-auth/{auth_id}")
# Accepts: { account_type: "individual" | "business", ... other optional fields }
# Validates: auth token matches auth_id (can only update own profile)
# Returns: Updated user object from Supabase
```

**2. Database Column Added (backend/supabase/add_account_type_column.sql):**
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_type text 
  DEFAULT 'individual' CHECK (account_type IN ('individual', 'business'));
```

### Manual Test Steps for Account Type

**Prerequisites:**
- Provider is logged in
- Navigate to Provider Profile screen

**Test Case 1: Load Current Account Type**
1. Open Provider Profile screen
2. Look for "Account Type" section with "Individual" and "Business" buttons
3. **Expected:** Current selection should display (default: "Individual")
4. Check browser console/logs for: `GET /api/users/by-auth/{auth_id}` returns 200

**Test Case 2: Switch to Business**
1. From Provider Profile screen
2. Click "Business" button
3. Wait for success alert: "Account type updated to business"
4. **Expected:** Button changes to highlighted/active state for "Business"
5. Check browser logs: `PATCH /api/users/by-auth/{auth_id}` with `{ account_type: "business" }` returns 200

**Test Case 3: Persist After Navigation**
1. From step 2, after selecting Business
2. Navigate away (e.g., click menu item, go to Services)
3. Navigate back to Profile screen
4. **Expected:** Account type still shows "Business" (NOT reset to "Individual")
5. Verify via browser logs: GET request shows account_type: "business"

**Test Case 4: Persist After Logout/Login**
1. From step 2, after selecting Business
2. Logout (from profile menu or settings)
3. Login again with same provider account
4. Navigate to Profile screen
5. **Expected:** Account type still shows "Business"
6. Check Supabase directly: query `SELECT account_type FROM users WHERE auth_id = '{auth_id}'` returns "business"

**Test Case 5: Switch Back to Individual**
1. From step 2 (Business is selected)
2. Click "Individual" button
3. Wait for success alert
4. **Expected:** Button changes to highlighted state for "Individual"
5. Repeat Test Case 3 steps to confirm persistence

---

## BLOCKER 2: Mobile Shop Paystack Checkout "field required"

### Root Cause: ITEMS FIELD WAS OPTIONAL BUT ALWAYS REQUIRED

**Exact Issue:**
The Paystack checkout model had a validation contract mismatch:

```python
# BEFORE (WRONG):
class PaystackShopInitializeInput(BaseModel):
    amount: float           # Required
    email: str              # Required
    items: Optional[List[OrderItemInput]] = None  # ← OPTIONAL (Wrong!)
    ...
```

**Problem:**
- Frontend ALWAYS sends items (from cart)
- But model said items was OPTIONAL
- If items was somehow missing from request, Pydantic wouldn't error
- But later code would fail with business logic error "No checkout items provided"
- Created ambiguity: is items supposed to be required or optional?
- User saw "field required" error

**Data Flow That Was Broken:**
```
User adds products to cart
  ↓
User clicks "Checkout"
  ↓
cart.tsx builds request: { amount, email, items, ... }
  ↓
Sent to POST /api/payments/paystack/shop/initialize
  ↓
Pydantic validation: items is Optional, so if missing → no error, just use None
  ↓
Backend code: if not items: raise "No checkout items provided"
  ↓
ERROR: "field required" or "No checkout items provided"
  ↓
User sees: "Could not start checkout. Please try again."
```

### Fix Applied

**Changed Model (backend/server.py line 140):**

```python
# AFTER (CORRECT):
class PaystackShopInitializeInput(BaseModel):
    amount: float
    email: str
    items: List[OrderItemInput] = Field(min_length=1)  # ← Now REQUIRED and non-empty
    ...
```

**Why This Works:**
- Pydantic now VALIDATES upfront that items field exists and has ≥1 item
- Clear error message if items missing: "field required"
- Clear error message if items empty: "ensure this value has at least 1 items"
- No ambiguity about contract
- Backend safely uses `payload.items` without null checks

### Manual Test Steps for Paystack Checkout

**Prerequisites:**
- Customer is logged in
- Customer profile has valid email
- Shop has products available
- Navigate to Shop, add products to cart

**Test Case 1: Successful Checkout Initialization**
1. Add 1-2 products to cart
2. Click "Checkout" button
3. **Expected:** Paystack payment page loads
4. Check browser console: no validation errors
5. Network tab: POST `/api/payments/paystack/shop/initialize` returns 200 with authorization_url

**Test Case 2: Request Contains All Required Fields**
1. Before clicking checkout, inspect network
2. Add products to cart
3. Click "Checkout"
4. Intercept the POST request to `/api/payments/paystack/shop/initialize`
5. **Expected:** JSON body contains:
   ```json
   {
     "amount": <number>,
     "email": "<customer@example.com>",
     "items": [
       { "product_id": <int>, "quantity": <int> },
       ...
     ],
     "name": "<customer name>",
     "phone": "<phone or null>",
     "redirect_url": "<url>",
     "currency": "NGN"
   }
   ```

**Test Case 3: Validation Error - Empty Cart**
1. Go to Shop
2. **Do NOT add anything to cart**
3. Click "Checkout"
4. **Expected:** Alert says "Cart Empty" or similar (UI-level check prevents this)
5. Checkout should not proceed

**Test Case 4: Validation Error - Missing Email**
1. Customer profile is missing email
2. Try to checkout with items in cart
3. **Expected:** Alert says "Please complete your profile before paying"
4. Checkout blocked by UI

**Test Case 5: Complete Payment Flow**
1. Add product to cart
2. Click "Checkout" → Paystack page loads
3. Test payment process (use Paystack test credentials)
4. After payment:
   - Either redirects back with success
   - Order should be created in Supabase
   - Cart should be cleared
5. **Expected:** Order appears in user's order history

**Validation Success Criteria:**
- No "field required" errors
- Paystack initializes correctly
- Payment can be made
- Order persists after checkout

---

## Files Changed Summary

### Backend (server.py)
1. **Lines 140-145**: Modified PaystackShopInitializeInput
   - Changed: `items: Optional[List[OrderItemInput]] = None`
   - To: `items: List[OrderItemInput] = Field(min_length=1)`

2. **Lines 639, 644, 668**: Removed `or []` fallbacks
   - Changed: `payload.items or []`
   - To: `payload.items` (safe now because items is required)

3. **Lines 1019-1048**: Added UpdateUserInput model
   - New Pydantic model for PATCH /users/by-auth/{auth_id}
   - Supports partial updates

4. **Lines 1051-1157**: Added two new endpoints
   - GET /users/by-auth/{auth_id}: Fetch user profile
   - PATCH /users/by-auth/{auth_id}: Update user fields (account_type, etc.)

### Database (Supabase)
1. **backend/supabase/add_account_type_column.sql** (NEW FILE)
   - Adds account_type column to users table
   - Adds account_type column to stylists table
   - Default value: 'individual'
   - CHECK constraint: only 'individual' or 'business'

---

## Deployment Checklist

- [ ] Apply SQL migration to Supabase:
  - Run: `backend/supabase/add_account_type_column.sql`
  - Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='account_type';`

- [ ] Deploy updated backend (backend/server.py)
  - Restart backend service
  - Verify endpoints are live: `GET /api/users/by-auth/{test_auth_id}`

- [ ] Test Account Type Flow:
  - Provider logs in
  - Navigate to Profile
  - Select "Business"
  - Verify saves to Supabase
  - Logout/login and verify persists

- [ ] Test Paystack Checkout:
  - Customer adds items to cart
  - Click checkout
  - Verify no "field required" errors
  - Complete payment flow

---

## Debugging Commands

**Check if account_type column exists:**
```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name='users' AND column_name='account_type';
```

**Check account_type values for all users:**
```sql
SELECT auth_id, account_type FROM users LIMIT 10;
```

**Verify endpoint is working:**
```bash
curl -H "Authorization: Bearer <access_token>" \
     https://your-backend/api/users/by-auth/<auth_id>
```

**Test Paystack initialization:**
```bash
curl -X POST https://your-backend/api/payments/paystack/shop/initialize \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "email": "customer@example.com",
    "items": [{"product_id": 1, "quantity": 2}],
    "currency": "NGN"
  }'
```
