"""
Regression + bug reproduction tests against the EXTERNAL Railway backend
(NOT the local /app/backend/server.py) + Supabase Auth, per review_request.
Covers BUG 1,2 (regression) and BUG 3,4,5,6,7 (investigation) from iStylist.
"""
import os
import time
import requests
import pytest

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or "https://gvmomyoeokauuixsydiu.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bW9teW9lb2thdXVpeHN5ZGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDQxMTksImV4cCI6MjA4MTc4MDExOX0.RWD9j4dKIcgZ_An6pM4sLgyRPc1j7A6vx1QRm2nrLw0"
API_BASE = "https://updatedistylistbeauty-marketplace-production.up.railway.app/api"

CUSTOMER_EMAIL = "ofni25umhs@maildax.me"
CUSTOMER_PASSWORD = "Youtube90@"
PROVIDER_EMAIL = "fipafor373@donumart.com"
PROVIDER_PASSWORD = "Youtube90@"


def supabase_login(email, password):
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    resp = requests.post(url, json={"email": email, "password": password}, headers={
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }, timeout=30)
    return resp


@pytest.fixture(scope="module")
def customer_session():
    resp = supabase_login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    if resp.status_code != 200:
        pytest.skip(f"Customer login failed: {resp.status_code} {resp.text}")
    data = resp.json()
    return {"token": data["access_token"], "auth_id": data["user"]["id"]}


@pytest.fixture(scope="module")
def provider_session():
    resp = supabase_login(PROVIDER_EMAIL, PROVIDER_PASSWORD)
    if resp.status_code != 200:
        pytest.skip(f"Provider login failed: {resp.status_code} {resp.text}")
    data = resp.json()
    return {"token": data["access_token"], "auth_id": data["user"]["id"]}


def auth_headers(session):
    return {"Authorization": f"Bearer {session['token']}", "Content-Type": "application/json"}


class TestBug1And8FeedAuthor:
    """BUG 1/8 regression: feed post author name should be real name, not 'Stylist'/'iStylist'."""

    def test_feed_posts_have_provider_info(self, customer_session):
        resp = requests.get(f"{API_BASE}/feed/posts", params={"page": 1, "per_page": 20}, headers=auth_headers(customer_session), timeout=30)
        assert resp.status_code == 200, f"feed/posts failed: {resp.status_code} {resp.text}"
        data = resp.json()
        posts = data.get("posts") or data.get("data") or []
        print(f"[BUG1] feed posts count: {len(posts)}")
        if posts:
            sample = posts[0]
            print(f"[BUG1] sample post keys: {list(sample.keys())}")
            print(f"[BUG1] sample provider field: {sample.get('provider')}, user field: {sample.get('user')}")


class TestBug3Booking:
    """BUG 3: Confirm Booking does not create a booking."""

    def test_wallet_balance(self, customer_session):
        resp = requests.get(f"{API_BASE}/wallets", headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG3] GET /wallets -> {resp.status_code} {resp.text}")
        assert resp.status_code in (200, 404), f"Unexpected wallets status {resp.status_code}: {resp.text}"

    def test_providers_with_services(self, customer_session):
        resp = requests.get(f"{API_BASE}/providers/with-services", headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG3] GET /providers/with-services -> {resp.status_code}")
        assert resp.status_code == 200, f"{resp.status_code} {resp.text}"
        providers = resp.json()
        providers = providers.get("data") if isinstance(providers, dict) else providers
        assert providers, "No providers returned - cannot test booking"
        pytest.provider_sample = providers[0]
        print(f"[BUG3] sample provider: {providers[0].get('id')}, services: {len(providers[0].get('services', []))}")

    def test_create_booking_and_pay_with_wallet(self, customer_session):
        # fetch a provider with services
        resp = requests.get(f"{API_BASE}/providers/with-services", headers=auth_headers(customer_session), timeout=30)
        assert resp.status_code == 200
        providers = resp.json()
        providers = providers.get("data") if isinstance(providers, dict) else providers
        provider = next((p for p in providers if p.get("services")), None)
        if not provider:
            pytest.skip("No provider with services found to test booking")
        service = provider["services"][0]
        provider_id = provider.get("id")
        service_id = service.get("id")
        from datetime import datetime, timedelta
        booking_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        payload = {
            "providerId": str(provider_id),
            "serviceId": str(service_id),
            "bookingDate": booking_date,
            "timeSlot": "10:00",
            "amount": service.get("price"),
            "scheduledAt": f"{booking_date}T10:00:00Z",
            "totalAmount": service.get("price"),
            "notes": "TEST booking from automated test",
            "paymentMethod": "WALLET",
            "provider_id": provider_id,
            "customer_auth_id": customer_session["auth_id"],
            "booking_date": booking_date,
            "booking_time": "10:00",
            "service_ids": [service_id],
            "service_duration_minutes": service.get("duration", 30),
            "status": "pending_payment",
        }
        resp = requests.post(f"{API_BASE}/bookings", json=payload, headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG3] POST /bookings -> {resp.status_code} {resp.text[:1500]}")
        if resp.status_code not in (200, 201):
            pytest.fail(f"Booking creation failed: {resp.status_code} {resp.text}")
        booking = resp.json()
        booking_id = booking.get("id")
        assert booking_id, f"No booking id in response: {booking}"

        pay_resp = requests.post(
            f"{API_BASE}/bookings/{booking_id}/pay-with-wallet",
            json={"auth_id": customer_session["auth_id"]},
            headers=auth_headers(customer_session), timeout=30,
        )
        print(f"[BUG3] POST /bookings/{booking_id}/pay-with-wallet -> {pay_resp.status_code} {pay_resp.text[:1500]}")


class TestBug4AskAboutProduct:
    """BUG 4: Ask about Product / Ask a Question buttons - test createInquiry endpoint directly."""

    def test_create_inquiry_with_provider(self, customer_session, provider_session):
        payload = {"provider_auth_id": provider_session["auth_id"]}
        resp = requests.post(f"{API_BASE}/conversations/inquiry", json=payload, headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG4] POST /conversations/inquiry (provider only) -> {resp.status_code} {resp.text[:1500]}")
        assert resp.status_code in (200, 201), f"{resp.status_code} {resp.text}"
        data = resp.json()
        conv_id = data.get("id") or data.get("conversation_id") or (data.get("conversation") or {}).get("id")
        assert conv_id, f"No conversation id returned: {data}"

    def test_create_inquiry_with_product(self, customer_session):
        # Get a product first
        resp = requests.get(f"{API_BASE}/products", params={"page": 1, "per_page": 5}, headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG4] GET /products -> {resp.status_code}")
        if resp.status_code != 200:
            pytest.skip(f"Could not list products: {resp.status_code} {resp.text}")
        data = resp.json()
        products = data.get("products") or data.get("data") or (data if isinstance(data, list) else [])
        if not products:
            pytest.skip("No products found")
        product = products[0]
        stylist_auth_id = product.get("stylist_auth_id")
        print(f"[BUG4] sample product: id={product.get('id')} stylist_auth_id={stylist_auth_id}")
        if not stylist_auth_id:
            pytest.fail(f"Product missing stylist_auth_id field - this would cause the button to silently no-op! product={product}")
        payload = {"provider_auth_id": stylist_auth_id, "product_id": product.get("id"), "product_name": product.get("name")}
        resp = requests.post(f"{API_BASE}/conversations/inquiry", json=payload, headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG4] POST /conversations/inquiry (with product) -> {resp.status_code} {resp.text[:1500]}")


class TestBug5FeedComments:
    """BUG 5: Posting a feed comment shows 'not found'."""

    def test_post_comment_flow(self, customer_session):
        resp = requests.get(f"{API_BASE}/feed/posts", params={"page": 1, "per_page": 20}, headers=auth_headers(customer_session), timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        posts = data.get("posts") or data.get("data") or []
        if not posts:
            pytest.skip("No feed posts available to comment on")
        post_id = posts[0].get("id")
        print(f"[BUG5] Using post_id={post_id}")

        get_resp = requests.get(f"{API_BASE}/feed/posts/{post_id}/comments", headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG5] GET /feed/posts/{post_id}/comments -> {get_resp.status_code} {get_resp.text[:1000]}")

        payload = {"author_auth_id": customer_session["auth_id"], "content": "TEST comment from automated test"}
        post_resp = requests.post(f"{API_BASE}/feed/posts/{post_id}/comments", json=payload, headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG5] POST /feed/posts/{post_id}/comments -> {post_resp.status_code} {post_resp.text[:1500]}")
        if post_resp.status_code == 404:
            pytest.fail(f"BUG5 REPRODUCED: 404 Not Found when posting comment. Body: {post_resp.text}")


class TestBug6ChatImage:
    """BUG 6: Sharing a photo in inquiry chat fails with 4000-char limit."""

    def test_send_image_message(self, customer_session, provider_session):
        # create inquiry conversation first
        resp = requests.post(f"{API_BASE}/conversations/inquiry", json={"provider_auth_id": provider_session["auth_id"]}, headers=auth_headers(customer_session), timeout=30)
        if resp.status_code not in (200, 201):
            pytest.skip(f"Could not create inquiry: {resp.status_code} {resp.text}")
        data = resp.json()
        conv_id = data.get("id") or data.get("conversation_id") or (data.get("conversation") or {}).get("id")
        assert conv_id

        # Simulate a base64 image bigger than 4000 chars (typical photo)
        fake_base64_image = "data:image/jpeg;base64," + ("A" * 6000)
        payload = {
            "receiver_auth_id": provider_session["auth_id"],
            "message": fake_base64_image,
            "message_type": "image",
        }
        msg_resp = requests.post(f"{API_BASE}/conversations/{conv_id}/messages", json=payload, headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG6] POST /conversations/{conv_id}/messages (image, {len(fake_base64_image)} chars) -> {msg_resp.status_code} {msg_resp.text[:2000]}")
        if msg_resp.status_code == 422:
            print(f"[BUG6] REPRODUCED: 422 validation error, likely message field max_length=4000. Body: {msg_resp.text}")


class TestBug7AvatarSync:
    """BUG 7: Avatar changes don't propagate to other screens (compare URLs across endpoints)."""

    def test_avatar_url_consistency(self, provider_session, customer_session):
        # provider's own auth_id
        auth_id = provider_session["auth_id"]
        full_profile_resp = requests.get(f"{API_BASE}/providers/{auth_id}/full-profile", headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG7] GET /providers/{{id}}/full-profile -> {full_profile_resp.status_code}")
        with_services_resp = requests.get(f"{API_BASE}/providers/with-services", headers=auth_headers(customer_session), timeout=30)
        print(f"[BUG7] GET /providers/with-services -> {with_services_resp.status_code}")
        if full_profile_resp.status_code == 200 and with_services_resp.status_code == 200:
            fp = full_profile_resp.json()
            ws_list = with_services_resp.json()
            ws_list = ws_list.get("data") if isinstance(ws_list, dict) else ws_list
            match = next((p for p in ws_list if str(p.get("id")) == str(auth_id) or str(p.get("user_id")) == str(auth_id)), None)
            fp_avatar = fp.get("avatarUrl") or fp.get("avatar_url") or fp.get("profileImage") or fp.get("profile_image_url")
            ws_avatar = (match or {}).get("avatarUrl") or (match or {}).get("avatar_url") if match else None
            print(f"[BUG7] full-profile avatar: {fp_avatar}")
            print(f"[BUG7] with-services avatar: {ws_avatar}")
