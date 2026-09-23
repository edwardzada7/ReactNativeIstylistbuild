"""
Regression tests for Task 2/3/5 backend fixes in server.py:
- POST /conversations/inquiry (conversation_type column fix)
- POST /conversations/{id}/messages (chats table metadata/read column fix)
- GET /conversations/{id}/messages
- GET /conversations
- GET /conversations/unread-count
- POST /conversations/{id}/mark-read
Also confirms Task 4 (bookings) and Task 6 (feed) remain safely blocked (Railway offline).
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_API_BASE_URL", "").rstrip("/")
SUPABASE_URL = "https://gvmomyoeokauuixsydiu.supabase.co"
ANON_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

PROVIDER_AUTH_ID = "c06b5f78-350e-47de-9a52-05e4edbc23be"  # existing real provider ("Baddest Hub LTD")


def _load_env_file(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')
    return env


FRONTEND_ENV = _load_env_file("/app/frontend/.env")
BACKEND_ENV = _load_env_file("/app/backend/.env")
BASE_URL = BASE_URL or FRONTEND_ENV.get("EXPO_PUBLIC_API_BASE_URL", "").rstrip("/")
ANON_KEY = ANON_KEY or FRONTEND_ENV.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
SERVICE_ROLE_KEY = SERVICE_ROLE_KEY or BACKEND_ENV.get("SUPABASE_SERVICE_ROLE_KEY")


@pytest.fixture(scope="module")
def customer_token():
    """Signs up a fresh disposable customer via Supabase auth, auto-confirms via admin API."""
    ts = int(time.time())
    email = f"test_chatfix_{ts}@mailinator.com"
    password = "TestPass123!"
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    user_id = r.json()["id"]

    # auto-confirm email via service role admin API (sandbox has no real inbox)
    confirm = requests.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers={"apikey": SERVICE_ROLE_KEY, "Authorization": f"Bearer {SERVICE_ROLE_KEY}", "Content-Type": "application/json"},
        json={"email_confirm": True},
        timeout=15,
    )
    assert confirm.status_code == 200, confirm.text

    login = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"token": token, "auth_id": user_id, "email": email}


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestFeedBlocked:
    """Task 6: confirm feed subsystem fails gracefully (Railway offline), not a crash."""

    def test_feed_list_not_found(self, api_client):
        r = api_client.get(f"{BASE_URL}/feed/posts")
        assert r.status_code == 404
        assert "detail" in r.json()

    def test_feed_comment_not_found(self, api_client):
        r = api_client.post(f"{BASE_URL}/feed/posts/1/comments", json={"comment": "hi"})
        assert r.status_code == 404


class TestInquiryChat:
    """Task 2/3/5: create inquiry conversation + send/receive messages."""

    conversation_id = None

    def test_create_inquiry(self, api_client, customer_token):
        r = api_client.post(
            f"{BASE_URL}/conversations/inquiry",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
            json={"provider_auth_id": PROVIDER_AUTH_ID},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert data["customer_auth_id"] == customer_token["auth_id"]
        assert data["provider_auth_id"] == PROVIDER_AUTH_ID
        assert data["conversation_type"] == "inquiry"
        TestInquiryChat.conversation_id = data["id"]

    def test_create_inquiry_with_product(self, api_client, customer_token):
        r = api_client.post(
            f"{BASE_URL}/conversations/inquiry",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
            json={"provider_auth_id": PROVIDER_AUTH_ID, "product_id": 999999, "product_name": "Test Product"},
        )
        # product 999999 doesn't belong to this provider -> should 403, not 500/502
        assert r.status_code in (403, 404), r.text

    def test_send_text_message(self, api_client, customer_token):
        conv_id = TestInquiryChat.conversation_id
        assert conv_id, "conversation was not created in previous test"
        r = api_client.post(
            f"{BASE_URL}/conversations/{conv_id}/messages",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
            json={"receiver_auth_id": PROVIDER_AUTH_ID, "message": "Hello, is this available?", "message_type": "text"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["message"] == "Hello, is this available?"
        assert data["sender_auth_id"] == customer_token["auth_id"]
        assert data["conversation_id"] == conv_id
        assert data["message_type"] in ("text", "TEXT")

    def test_get_conversation_messages(self, api_client, customer_token):
        conv_id = TestInquiryChat.conversation_id
        r = api_client.get(
            f"{BASE_URL}/conversations/{conv_id}/messages",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "messages" in data
        assert len(data["messages"]) >= 1
        assert any(m["message"] == "Hello, is this available?" for m in data["messages"])

    def test_list_conversations_includes_new_one(self, api_client, customer_token):
        r = api_client.get(
            f"{BASE_URL}/conversations",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
        )
        assert r.status_code == 200, r.text
        convs = r.json()
        ids = [c["id"] for c in convs]
        assert TestInquiryChat.conversation_id in ids
        target = next(c for c in convs if c["id"] == TestInquiryChat.conversation_id)
        assert target["last_message"] is not None
        assert target["last_message"]["message"] == "Hello, is this available?"

    def test_unread_count_endpoint_works(self, api_client, customer_token):
        r = api_client.get(
            f"{BASE_URL}/conversations/unread-count",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
        )
        assert r.status_code == 200, r.text
        assert "unreadCount" in r.json()

    def test_mark_read_no_crash(self, api_client, customer_token):
        conv_id = TestInquiryChat.conversation_id
        r = api_client.post(
            f"{BASE_URL}/conversations/{conv_id}/mark-read?conversation_type=inquiry",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
        )
        assert r.status_code == 200, r.text
        assert "clearedCount" in r.json()

    def test_send_image_message(self, api_client, customer_token):
        conv_id = TestInquiryChat.conversation_id
        r = api_client.post(
            f"{BASE_URL}/conversations/{conv_id}/messages",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
            json={"receiver_auth_id": PROVIDER_AUTH_ID, "message": "https://example.com/fake.jpg", "message_type": "image"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["message_type"] in ("image", "IMAGE")


class TestBookingChatBlocked:
    """Task 5(e)/Task 4: confirm booking chat + booking creation fail gracefully (Railway offline)."""

    def test_booking_chat_fails_gracefully(self, api_client, customer_token):
        r = api_client.get(
            f"{BASE_URL}/bookings/999999/chat",
            params={"auth_id": customer_token["auth_id"]},
            headers={"Authorization": f"Bearer {customer_token['token']}"},
        )
        # Should be an error status (404/502/503), not 200 with fake success
        assert r.status_code >= 400, f"expected error, got {r.status_code}: {r.text}"

    def test_booking_creation_fails_gracefully_not_fake_success(self, api_client, customer_token):
        r = api_client.post(
            f"{BASE_URL}/bookings",
            headers={"Authorization": f"Bearer {customer_token['token']}"},
            json={
                "customer_auth_id": customer_token["auth_id"],
                "provider_auth_id": PROVIDER_AUTH_ID,
                "services": [],
                "booking_date": "2026-02-01",
                "booking_time": "10:00",
            },
        )
        assert r.status_code >= 400, f"expected error (Railway offline), got fake success {r.status_code}: {r.text}"
