from fastapi import Depends, FastAPI, APIRouter, Header, HTTPException, Path, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hmac
import requests
from pathlib import Path as PathlibPath
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import json
from datetime import datetime
from utils.message_sanitizer import MessageType, sanitizeMessagePayload


ROOT_DIR = PathlibPath(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Supabase - used ONLY for the two privileged write endpoints below.
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_BASE_URL = 'https://api.paystack.co'
PRIMARY_BACKEND_URL = 'https://updatedistylistbeauty-marketplace-production.up.railway.app'

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ---------------------------------------------------------------------------
# Phase 3A - minimal privileged Supabase write bridge.
#
# Everything else (Notifications, Legal Pages, Portfolio, Shop reads, Chat
# reads) is done directly from the mobile app against Supabase - verified
# via real RLS testing that authenticated users can safely read/write their
# own rows there. Only these 2 operations are genuinely RLS-blocked for a
# direct client insert (confirmed via curl: both return Postgres error
# 42501 "new row violates row-level security policy"):
#   - orders / order_items (Shop checkout)
#   - chats (sending a message)
# So this backend does NOT re-implement product listing, order history,
# notifications, portfolio, or any other feature that already works via
# direct Supabase access - only the two blocked writes.
# ---------------------------------------------------------------------------

def _verify_supabase_user(authorization: Optional[str]) -> str:
    """Verifies the caller's Supabase access token and returns their auth_id.
    Uses Supabase's own /auth/v1/user endpoint rather than re-implementing
    JWT signature verification - no new auth mechanism invented."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    resp = requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_SERVICE_ROLE_KEY},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return resp.json()["id"]


def _require_admin_key(admin_key: Optional[str] = Header(None, alias="X-ADMIN-KEY")) -> None:
    """Authorize Admin Web requests using the configured shared secret."""
    configured_key = os.environ.get("ADMIN_DASH_KEY", "")
    if not configured_key or not admin_key or not hmac.compare_digest(admin_key, configured_key):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")


def _supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


class OrderItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class PaystackCartItemInput(BaseModel):
    productId: int
    quantity: int = Field(gt=0)
    price: float


class CreateOrderInput(BaseModel):
    items: List[OrderItemInput] = Field(..., min_items=1)
    payment_reference: Optional[str] = None
    payment_status: Optional[str] = None
    subtotal: Optional[float] = None
    delivery_fee: Optional[float] = None
    total_amount: Optional[float] = None
    customer_name: Optional[str] = None
    provider_auth_id: Optional[str] = None
    order_status: Optional[str] = None
    payment_method: Optional[str] = None
    delivery_address: Optional[str] = None
    currency: Optional[str] = 'NGN'


class UpdateOrderStatusInput(BaseModel):
    status: str


class ProductReviewCreateInput(BaseModel):
    product_id: Optional[int] = None
    productId: Optional[int] = None
    order_id: Optional[int] = None
    item_id: Optional[int] = None
    user_id: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default='')
    comment: Optional[str] = None


class ProductReviewUpdateInput(BaseModel):
    product_id: Optional[int] = None
    productId: Optional[int] = None
    order_id: Optional[int] = None
    item_id: Optional[int] = None
    user_id: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default='')
    comment: Optional[str] = None


class BookingCreateInput(BaseModel):
    providerId: Optional[int] = None
    serviceId: Optional[int] = None
    scheduledAt: Optional[str] = None
    totalAmount: Optional[float] = None
    total_amount: Optional[float] = None
    paymentMethod: Optional[str] = None
    payment_method: Optional[str] = None
    provider_id: Optional[int] = None
    service_id: Optional[int] = None
    booking_date: Optional[str] = None
    booking_time: Optional[str] = None
    service_ids: Optional[List[int]] = None
    service_duration_minutes: Optional[int] = None
    customer_id: Optional[str] = None
    customer_auth_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    staff_id: Optional[str] = None

    class Config:
        extra = 'allow'


class PaystackShopInitializeInput(BaseModel):
    amount: float
    email: str
    items: List[OrderItemInput] = Field(default_factory=list)
    cartItems: Optional[List[PaystackCartItemInput]] = None
    totalAmount: Optional[float] = None
    deliveryAddress: Optional[dict] = None
    deliveryAddressId: Optional[str] = None
    paymentMethod: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    redirect_url: Optional[str] = None
    currency: Optional[str] = 'NGN'
    delivery_address: Optional[str] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    ref: Optional[str] = None
    metadata: Optional[dict] = None


@api_router.post("/bookings")
def create_booking(request: Request, payload: BookingCreateInput, authorization: Optional[str] = Header(None)):
    """Validate wallet funds before forwarding booking creation upstream."""
    provider_id = payload.providerId or payload.provider_id
    service_id = payload.serviceId or payload.service_id or (payload.service_ids or [None])[0]
    amount = payload.totalAmount if payload.totalAmount is not None else payload.total_amount
    payment_method = payload.paymentMethod or payload.payment_method
    scheduled_at = payload.scheduledAt or (f'{payload.booking_date}T{payload.booking_time}' if payload.booking_date and payload.booking_time else None)
    if not provider_id or not service_id or not scheduled_at or amount is None or amount <= 0 or not payment_method:
        raise HTTPException(status_code=400, detail="Provider, service, scheduled time, total amount, and payment method are required")

    auth_id = _verify_supabase_user(authorization)
    wallets_resp = requests.get(
        f"{PRIMARY_BACKEND_URL.rstrip('/')}/api/wallets",
        headers=_proxy_request_headers(request),
        timeout=20,
    )
    if wallets_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify wallet balance")
    wallets = wallets_resp.json() or []
    wallet = next((item for item in wallets if item.get('user_auth_id') == auth_id), None)
    if float(wallet.get('balance', 0) if wallet else 0) < float(amount):
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    upstream = requests.post(
        f"{PRIMARY_BACKEND_URL.rstrip('/')}/api/bookings",
        headers=_proxy_request_headers(request),
        json=payload.dict(exclude_none=True),
        timeout=20,
    )
    return _proxy_response(upstream)


def _paystack_headers():
    return {
        'Authorization': f'Bearer {PAYSTACK_SECRET_KEY}',
        'Content-Type': 'application/json',
    }


def _insert_notification(auth_id: str, title: str, message: str, notification_type: str, metadata: Optional[dict] = None):
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/notifications",
            headers=_supabase_headers(),
            json={
                "auth_id": auth_id,
                "title": title,
                "message": message,
                "type": notification_type,
                "metadata": metadata or {},
                "read": False,
                "created_at": datetime.utcnow().isoformat(),
            },
            timeout=10,
        )
    except Exception as exc:
        logger.warning("failed to create notification for %s: %s", auth_id, exc)


def _insert_chat_message(sender_auth_id: str, receiver_auth_id: str, message: str, booking_id: Optional[int] = None):
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/chats",
            headers=_supabase_headers(),
            json={
                "sender_auth_id": sender_auth_id,
                "receiver_auth_id": receiver_auth_id,
                "message": message,
                "booking_id": booking_id,
            },
            timeout=10,
        )
    except Exception as exc:
        logger.warning("failed to create chat message for %s -> %s: %s", sender_auth_id, receiver_auth_id, exc)


def _proxy_request_headers(request: Request):
    excluded = {
        'host',
        'content-length',
        'accept-encoding',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'transfer-encoding',
        'upgrade',
    }
    return {k: v for k, v in request.headers.items() if k.lower() not in excluded}


def _proxy_response(response: requests.Response):
    excluded = {
        'content-encoding',
        'content-length',
        'transfer-encoding',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
    }
    headers = {k: v for k, v in response.headers.items() if k.lower() not in excluded}
    media_type = response.headers.get('Content-Type')
    return Response(content=response.content, status_code=response.status_code, headers=headers, media_type=media_type)


async def _proxy_to_primary(request: Request, upstream_path: str, path_params: Optional[dict] = None):
    path_params = path_params or {}
    formatted_path = upstream_path.format(**path_params)
    if not formatted_path.startswith('/'):
        formatted_path = '/' + formatted_path
    if not formatted_path.startswith('/api'):
        formatted_path = '/api' + formatted_path
    url = PRIMARY_BACKEND_URL.rstrip('/') + formatted_path
    headers = _proxy_request_headers(request)
    try:
        resp = requests.request(
            request.method,
            url,
            headers=headers,
            params=dict(request.query_params),
            data=await request.body(),
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.exception("Primary backend proxy request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to reach primary backend") from exc
    return _proxy_response(resp)


def _make_proxy_endpoint(upstream_path: str, method: str):
    async def proxy_endpoint(request: Request, **path_params):
        return await _proxy_to_primary(request, upstream_path, path_params)
    proxy_endpoint.__name__ = f"proxy_{method}_{upstream_path.lstrip('/').replace('/', '_').replace('{', '').replace('}', '') or 'root'}"
    return proxy_endpoint


def _register_primary_proxy_routes():
    try:
        resp = requests.get(f"{PRIMARY_BACKEND_URL.rstrip('/')}/openapi.json", timeout=20)
        resp.raise_for_status()
        openapi = resp.json()
    except Exception as exc:
        logger.warning("Could not fetch primary backend OpenAPI spec from %s: %s", PRIMARY_BACKEND_URL, exc)
        return

    primary_paths = openapi.get('paths', {}) or {}
    local_paths = {
        route.path[len(api_router.prefix):] if route.path.startswith(api_router.prefix) else route.path
        for route in api_router.routes
    }
    for raw_path, operations in primary_paths.items():
        if not raw_path.startswith('/api'):
            continue
        router_path = raw_path[len('/api'):] or '/'
        if router_path in local_paths:
            continue
        for method_name, operation in operations.items():
            method = method_name.upper()
            if method not in {'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'}:
                continue
            proxy_handler = _make_proxy_endpoint(raw_path, method)
            api_router.add_api_route(
                router_path,
                proxy_handler,
                methods=[method],
                name=proxy_handler.__name__,
                include_in_schema=True,
            )


def _get_supabase_user_details(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    resp = requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_SERVICE_ROLE_KEY},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return resp.json()


async def _user_has_purchased_product(auth_id: str, product_id: int) -> bool:
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/orders?select=id,customer_auth_id,payment_status,status&customer_auth_id=eq.{auth_id}",
            headers=_supabase_headers(),
            timeout=10,
        )
        if response.status_code != 200:
            return False
        orders = response.json() or []
        if not orders:
            return False
        order_ids = ",".join(str(order["id"]) for order in orders if order.get("id"))
        if not order_ids:
            return False
        items_resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/order_items?select=order_id,product_id&order_id=in.({order_ids})",
            headers=_supabase_headers(),
            timeout=10,
        )
        if items_resp.status_code != 200:
            return False
        items = items_resp.json() or []
        purchased = any(item.get("product_id") == product_id for item in items)
        if not purchased:
            return False
        verified_orders = [order for order in orders if order.get("payment_status") == "verified" or order.get("status") in {"delivered", "completed", "confirmed"}]
        return bool(verified_orders)
    except Exception as exc:
        logger.warning("failed to resolve verified purchase for %s/%s: %s", auth_id, product_id, exc)
        return False


def _validate_shop_checkout_items(items: List[OrderItemInput], amount: Optional[float] = None, delivery_fee: float = 0.0):
    if not items:
        raise HTTPException(status_code=400, detail="No checkout items provided")

    product_ids = ",".join(str(item.product_id) for item in items)
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/products?id=in.({product_ids})&select=id,price,stock,name,approved,stylist_auth_id",
        headers=_supabase_headers(),
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify products")
    products = {p["id"]: p for p in resp.json()}

    subtotal = 0.0
    for item in items:
        product = products.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")
        subtotal += float(product["price"]) * item.quantity

    total = round(subtotal + float(delivery_fee or 0.0), 2)
    if amount is not None and round(float(amount), 2) != total:
        raise HTTPException(status_code=400, detail="Order total mismatch")

    provider_auth_id = next((p.get("stylist_auth_id") for p in products.values() if p.get("stylist_auth_id")), None)
    return {
        "products": products,
        "subtotal": round(subtotal, 2),
        "total": total,
        "provider_auth_id": provider_auth_id,
    }


def _delivery_address_value(payload: PaystackShopInitializeInput) -> Optional[str]:
    if payload.delivery_address:
        return payload.delivery_address.strip() or None
    if payload.deliveryAddress:
        return json.dumps(payload.deliveryAddress, separators=(',', ':'))
    return None


def _create_pending_shop_order(auth_id: str, reference: str, items: List[OrderItemInput], products: dict, provider_auth_id: Optional[str], customer_name: Optional[str], subtotal: float, total_amount: float, delivery_fee: float = 0.0, delivery_address: Optional[str] = None, currency: str = 'NGN'):
    order_payload = {
        "customer_auth_id": auth_id,
        "status": "pending",
        "total_amount": round(total_amount, 2),
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "payment_status": "pending",
        "payment_reference": reference,
        "currency": currency.upper(),
        "created_at": datetime.utcnow().isoformat(),
    }
    if provider_auth_id:
        order_payload["provider_auth_id"] = provider_auth_id
    if customer_name:
        order_payload["customer_name"] = customer_name
    if delivery_address:
        order_payload["delivery_address"] = delivery_address

    order_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/orders",
        headers=_supabase_headers(),
        json=order_payload,
        timeout=10,
    )
    if order_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not create pending shop order")

    order = order_resp.json()[0]
    order_items = [
        {
            "order_id": order["id"],
            "product_id": item.product_id,
            "quantity": item.quantity,
            "price": products[item.product_id]["price"],
        }
        for item in items
    ]
    items_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/order_items",
        headers=_supabase_headers(),
        json=order_items,
        timeout=10,
    )
    if items_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Order created but items failed to save")
    return order


def _finalize_verified_shop_order(order_id: int, auth_id: str, items: List[OrderItemInput], products: dict, provider_auth_id: Optional[str], customer_name: Optional[str], subtotal: float, total_amount: float, delivery_fee: float = 0.0, delivery_address: Optional[str] = None, currency: Optional[str] = None):
    update_payload = {
        "payment_status": "verified",
        "status": "pending",
        "total_amount": round(total_amount, 2),
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
    }
    if provider_auth_id:
        update_payload["provider_auth_id"] = provider_auth_id
    if customer_name:
        update_payload["customer_name"] = customer_name
    if delivery_address:
        update_payload["delivery_address"] = delivery_address
    if currency:
        update_payload["currency"] = currency.upper()

    requests.patch(
        f"{SUPABASE_URL}/rest/v1/orders?id=eq.{order_id}",
        headers=_supabase_headers(),
        json=update_payload,
        timeout=10,
    )

    for item in items:
        new_stock = products[item.product_id]["stock"] - item.quantity
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/products?id=eq.{item.product_id}",
            headers=_supabase_headers(),
            json={"stock": new_stock},
            timeout=10,
        )

    provider_ids = sorted({p.get("stylist_auth_id") for p in products.values() if p.get("stylist_auth_id")})
    notification_payload = {
        "order_id": order_id,
        "customer_name": customer_name or "A customer",
        "total_amount": round(total_amount, 2),
        "items_count": len(items),
    }
    for provider_id in provider_ids:
        _insert_notification(
            provider_id,
            "New Shop Order",
            "You have received a new order.",
            "system",
            notification_payload,
        )
        _insert_chat_message(
            auth_id,
            provider_id,
            f"New shop order #{order_id} was placed. Please review.",
            order_id,
        )

    _insert_notification(
        auth_id,
        "Payment Successful",
        "Your order has been placed successfully.",
        "payment",
        notification_payload,
    )


@api_router.get("/shop/products/{product_id}/reviews")
async def get_product_reviews(product_id: int, authorization: Optional[str] = Header(None)):
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/product_reviews?product_id=eq.{product_id}&select=*&order=created_at.desc",
            headers=_supabase_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not load product reviews")
        reviews = resp.json() or []
        average_rating = round(sum(review.get("rating", 0) for review in reviews) / len(reviews), 1) if reviews else 0.0
        return {
            "reviews": reviews,
            "average_rating": average_rating,
            "review_count": len(reviews),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("failed to load product reviews for %s: %s", product_id, exc)
        raise HTTPException(status_code=500, detail="Could not load product reviews") from exc


@api_router.post("/shop/products/{product_id}/reviews")
async def create_product_review(product_id: int, payload: ProductReviewCreateInput, authorization: Optional[str] = Header(None)):
    user = _get_supabase_user_details(authorization)
    auth_id = user["id"]
    safe_product_id = int(payload.product_id or payload.productId or product_id)
    review_text = (payload.review_text or payload.comment or '').strip()
    if not review_text:
        raise HTTPException(status_code=422, detail="Review comment is required")

    user_meta = user.get("user_metadata") or {}
    full_name = user_meta.get("full_name") or user_meta.get("name") or user.get("email") or "Customer"
    avatar = user_meta.get("avatar_url") or user_meta.get("avatar") or None
    verified_purchase = await _user_has_purchased_product(auth_id, safe_product_id)

    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/product_reviews?product_id=eq.{safe_product_id}&user_id=eq.{auth_id}&select=id",
        headers=_supabase_headers(),
        timeout=10,
    )
    if existing_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not check existing review")
    existing_reviews = existing_resp.json() or []

    review_payload = {
        "product_id": safe_product_id,
        "user_id": auth_id,
        "user_full_name": full_name,
        "user_avatar": avatar,
        "rating": int(payload.rating),
        "review_text": review_text,
        "created_at": datetime.utcnow().isoformat(),
        "verified_purchase": verified_purchase,
        **({"order_id": int(payload.order_id)} if payload.order_id is not None else {}),
        **({"item_id": int(payload.item_id)} if payload.item_id is not None else {}),
    }

    if existing_reviews:
        review_id = existing_reviews[0]["id"]
        update_resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/product_reviews?id=eq.{review_id}",
            headers=_supabase_headers(),
            json=review_payload,
            timeout=10,
        )
        if update_resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail="Could not update review")
        return update_resp.json()[0]

    create_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/product_reviews",
        headers=_supabase_headers(),
        json=review_payload,
        timeout=10,
    )
    if create_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not create review")
    return create_resp.json()[0]


@api_router.patch("/shop/products/{product_id}/reviews/{review_id}")
async def update_product_review(product_id: int, review_id: int, payload: ProductReviewUpdateInput, authorization: Optional[str] = Header(None)):
    user = _get_supabase_user_details(authorization)
    auth_id = user["id"]
    safe_product_id = int(payload.product_id or payload.productId or product_id)
    review_text = (payload.review_text or payload.comment or '').strip()
    if not review_text:
        raise HTTPException(status_code=422, detail="Review comment is required")

    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/product_reviews?id=eq.{review_id}&product_id=eq.{safe_product_id}&user_id=eq.{auth_id}&select=id",
        headers=_supabase_headers(),
        timeout=10,
    )
    if existing_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify review ownership")
    if not existing_resp.json():
        raise HTTPException(status_code=404, detail="Review not found")

    update_resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/product_reviews?id=eq.{review_id}",
        headers=_supabase_headers(),
        json={
            "product_id": safe_product_id,
            "user_id": auth_id,
            "rating": int(payload.rating),
            "review_text": review_text,
            "updated_at": datetime.utcnow().isoformat(),
            **({"order_id": int(payload.order_id)} if payload.order_id is not None else {}),
            **({"item_id": int(payload.item_id)} if payload.item_id is not None else {}),
        },
        timeout=10,
    )
    if update_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not update review")
    return update_resp.json()[0]


@api_router.delete("/shop/products/{product_id}/reviews/{review_id}")
async def delete_product_review(product_id: int, review_id: int, authorization: Optional[str] = Header(None)):
    user = _get_supabase_user_details(authorization)
    auth_id = user["id"]
    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/product_reviews?id=eq.{review_id}&product_id=eq.{product_id}&user_id=eq.{auth_id}&select=id",
        headers=_supabase_headers(),
        timeout=10,
    )
    if existing_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify review ownership")
    if not existing_resp.json():
        raise HTTPException(status_code=404, detail="Review not found")

    delete_resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/product_reviews?id=eq.{review_id}",
        headers=_supabase_headers(),
        timeout=10,
    )
    if delete_resp.status_code not in (200, 201, 204):
        raise HTTPException(status_code=502, detail="Could not delete review")
    return {"deleted": True}


@api_router.post("/payments/paystack/shop/initialize")
async def initialize_paystack_shop_checkout(request: Request, payload: PaystackShopInitializeInput, authorization: Optional[str] = Header(None)):
    """Initialize a hosted Paystack checkout for shop purchases only."""
    try:
        raw_body = await request.body()
        logger.info("[paystack-init] incoming body=%s", raw_body.decode('utf-8', errors='replace'))
    except Exception as body_exc:
        logger.exception("[paystack-init] failed to read request body: %s", body_exc)

    logger.info("Initialize payload: %s", payload.dict())
    logger.info("[paystack-init] parsed payload=%s", payload.dict())

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack is not configured")

    try:
        auth_id = _verify_supabase_user(authorization)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[paystack-init] auth verification failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not verify user session") from exc

    checkout_items = list(payload.items or [])
    if not checkout_items and payload.cartItems:
        checkout_items = [OrderItemInput(product_id=item.productId, quantity=item.quantity) for item in payload.cartItems]
    validation = _validate_shop_checkout_items(checkout_items, payload.amount)
    amount_kobo = int(round(float(payload.amount) * 100))
    if amount_kobo <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    reference = payload.reference or payload.ref or f"shop_{uuid.uuid4().hex[:12]}"
    _create_pending_shop_order(
        auth_id=auth_id,
        reference=reference,
        items=checkout_items,
        products=validation["products"],
        provider_auth_id=validation["provider_auth_id"],
        customer_name=payload.name or payload.email or auth_id,
        subtotal=validation["subtotal"],
        total_amount=validation["total"],
        delivery_address=_delivery_address_value(payload),
        currency=payload.currency or 'NGN',
    )

    paystack_payload = {
        "email": payload.email,
        "amount": amount_kobo,
        "reference": reference,
        "currency": (payload.currency or 'NGN').upper(),
        "channels": ["card", "bank", "ussd", "bank_transfer"],
        "callback_url": payload.redirect_url,
        "metadata": {
            "name": payload.name or '',
            "phone": payload.phone or '',
            "delivery_address": (payload.metadata or {}).get('delivery_address') or payload.delivery_address or '',
            "phone_number": (payload.metadata or {}).get('phone_number') or payload.phone or '',
            "purpose": 'shop_checkout',
            "items": [item.dict() for item in checkout_items],
            "custom_fields": (payload.metadata or {}).get('custom_fields', []),
            "cart_items": (payload.metadata or {}).get('cart_items', []),
            "user_id": (payload.metadata or {}).get('user_id') or auth_id,
        },
    }
    logger.info("[paystack-init] outbound payload=%s", paystack_payload)

    try:
        resp = requests.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            headers=_paystack_headers(),
            json=paystack_payload,
            timeout=20,
        )
        logger.info("[paystack-init] paystack response status=%s body=%s", resp.status_code, resp.text[:2000])
    except requests.RequestException as exc:
        logger.exception("[paystack-init] Paystack request exception: %s", exc)
        raise HTTPException(status_code=502, detail=f"Paystack request failed: {exc}") from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Paystack initialization failed: {resp.text[:500]}")

    data = resp.json()
    if not data.get('status'):
        raise HTTPException(status_code=502, detail=data.get('message', 'Paystack initialization failed'))

    transaction_data = data.get('data', {})
    return {
        "status": True,
        "authorization_url": transaction_data.get('authorization_url'),
        "reference": transaction_data.get('reference', reference),
        "message": 'Checkout initialized',
        "order_total": validation["total"],
    }


@api_router.get("/payments/paystack/shop/verify")
def verify_paystack_shop_checkout(
    reference: Optional[str] = None,
    transaction_id: Optional[str] = None,
    amount: Optional[float] = None,
    currency: Optional[str] = None,
    items: Optional[str] = None,
    email: Optional[str] = None,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    provider_auth_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Verify a Paystack transaction and finalize the shop order only when payment succeeds."""
    logger.info(
        "Verify request: reference=%s transaction_id=%s amount=%s items=%s",
        reference,
        transaction_id,
        amount,
        items,
    )

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack is not configured")
    if not reference:
        raise HTTPException(status_code=400, detail="Missing payment reference")

    auth_id = _verify_supabase_user(authorization)

    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/orders?payment_reference=eq.{reference}&select=id,customer_auth_id,payment_reference,payment_status",
        headers=_supabase_headers(),
        timeout=10,
    )
    existing_order = existing_resp.json()[0] if existing_resp.status_code == 200 and existing_resp.json() else None
    if existing_order and existing_order.get("customer_auth_id") != auth_id:
        raise HTTPException(status_code=403, detail="Payment reference does not belong to this user")

    parsed_items = []
    if items:
        try:
            parsed_items = json.loads(items)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail='Invalid checkout items') from exc
    if not parsed_items and existing_order:
        items_resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{existing_order['id']}&select=product_id,quantity",
            headers=_supabase_headers(),
            timeout=10,
        )
        if items_resp.status_code == 200:
            parsed_items = items_resp.json() or []
    if not parsed_items:
        raise HTTPException(status_code=400, detail='No checkout items provided')

    normalized_items = [OrderItemInput(product_id=item['product_id'], quantity=item['quantity']) for item in parsed_items]
    validation = _validate_shop_checkout_items(normalized_items, amount=amount)

    if existing_order:
        if existing_order.get("payment_status") == "verified":
            return {"status": "success", "message": "Payment already verified", "order": existing_order}

    verify_resp = requests.get(
        f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
        headers=_paystack_headers(),
        timeout=20,
    )
    if verify_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify Paystack payment")

    verify_payload = verify_resp.json()
    if not verify_payload.get('status'):
        raise HTTPException(status_code=502, detail=verify_payload.get('message', 'Paystack verification failed'))

    transaction = verify_payload.get('data', {})
    if transaction.get('status') != 'success':
        return {"status": "failed", "message": "Payment was not completed successfully"}

    if transaction.get('reference') != reference:
        raise HTTPException(status_code=400, detail="Reference mismatch")

    expected_amount = int(round(float(amount) * 100)) if amount is not None else None
    if expected_amount is not None and transaction.get('amount') is not None and int(transaction['amount']) != expected_amount:
        raise HTTPException(status_code=400, detail="Amount mismatch")

    if currency and (transaction.get('currency') or '').upper() != currency.upper():
        raise HTTPException(status_code=400, detail="Currency mismatch")

    if existing_order:
        _finalize_verified_shop_order(
            order_id=existing_order["id"],
            auth_id=auth_id,
            items=normalized_items,
            products=validation["products"],
            provider_auth_id=provider_auth_id,
            customer_name=name or email or auth_id,
            subtotal=validation["subtotal"],
            total_amount=validation["total"],
        )
        return {"status": "success", "message": "Payment verified", "order": {"id": existing_order["id"]}}

    order_payload = CreateOrderInput(
        items=normalized_items,
        payment_reference=reference,
        payment_status='verified',
        subtotal=validation["subtotal"],
        delivery_fee=0.0,
        total_amount=validation["total"],
        customer_name=name or email or auth_id,
        provider_auth_id=provider_auth_id,
        order_status='pending',
    )
    return create_order(order_payload, authorization=authorization)


@api_router.post("/shop/orders")
def create_order(payload: CreateOrderInput, authorization: Optional[str] = Header(None)):
    """Privileged order creation. RLS blocks a direct client insert into
    `orders`/`order_items` (verified 42501). This endpoint verifies the
    caller's real Supabase session, then uses the existing `products`,
    `orders`, and `order_items` tables exactly as-is - no schema changes,
    no new tables."""
    auth_id = _verify_supabase_user(authorization)
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items in order")

    product_ids = ",".join(str(i.product_id) for i in payload.items)
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/products?id=in.({product_ids})&select=id,price,stock,name,approved,stylist_auth_id",
        headers=_supabase_headers(),
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify products")
    products = {p["id"]: p for p in resp.json()}

    subtotal = 0.0
    for item in payload.items:
        product = products.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")
        subtotal += float(product["price"]) * item.quantity

    delivery_fee = float(payload.delivery_fee or 0.0)
    total = float(payload.total_amount if payload.total_amount is not None else subtotal + delivery_fee)
    provider_auth_id = payload.provider_auth_id or next(
        (p.get("stylist_auth_id") for p in products.values() if p.get("stylist_auth_id")),
        None,
    )

    order_payload = {
        "customer_auth_id": auth_id,
        "status": (payload.order_status or "pending").lower(),
        "total_amount": round(total, 2),
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "payment_status": (payload.payment_status or "verified").lower(),
        "created_at": datetime.utcnow().isoformat(),
    }
    if provider_auth_id:
        order_payload["provider_auth_id"] = provider_auth_id
    if payload.payment_reference:
        order_payload["payment_reference"] = payload.payment_reference
    if payload.customer_name:
        order_payload["customer_name"] = payload.customer_name
    if payload.delivery_address:
        order_payload["delivery_address"] = payload.delivery_address.strip()
    if payload.currency:
        order_payload["currency"] = payload.currency.upper()

    order_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/orders",
        headers=_supabase_headers(),
        json=order_payload,
        timeout=10,
    )
    if order_resp.status_code not in (200, 201):
        fallback_payload = {
            "customer_auth_id": auth_id,
            "status": "pending",
            "total_amount": round(total, 2),
            "subtotal": round(subtotal, 2),
            "delivery_fee": round(delivery_fee, 2),
            "created_at": datetime.utcnow().isoformat(),
        }
        order_resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/orders",
            headers=_supabase_headers(),
            json=fallback_payload,
            timeout=10,
        )
    if order_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not create order")
    order = order_resp.json()[0]

    order_items = [
        {
            "order_id": order["id"],
            "product_id": item.product_id,
            "quantity": item.quantity,
            "price": products[item.product_id]["price"],
        }
        for item in payload.items
    ]
    items_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/order_items",
        headers=_supabase_headers(),
        json=order_items,
        timeout=10,
    )
    if items_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Order created but items failed to save")

    for item in payload.items:
        new_stock = products[item.product_id]["stock"] - item.quantity
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/products?id=eq.{item.product_id}",
            headers=_supabase_headers(),
            json={"stock": new_stock},
            timeout=10,
        )

    provider_ids = sorted({p.get("stylist_auth_id") for p in products.values() if p.get("stylist_auth_id")})
    notification_payload = {
        "order_id": order["id"],
        "customer_name": payload.customer_name or "A customer",
        "total_amount": round(total, 2),
        "items_count": len(payload.items),
    }
    for provider_id in provider_ids:
        _insert_notification(
            provider_id,
            "New Shop Order",
            "You have received a new order.",
            "system",
            notification_payload,
        )
        _insert_chat_message(
            auth_id,
            provider_id,
            f"New shop order #{order['id']} was placed. Please review.",
            order["id"],
        )

    _insert_notification(
        auth_id,
        "Payment Successful",
        "Your order has been placed successfully.",
        "payment",
        notification_payload,
    )

    return {"status": "success", "order": order, "items": items_resp.json()}


@api_router.patch("/shop/orders/{order_id}")
def update_order_status(order_id: int = Path(..., ge=1), payload: UpdateOrderStatusInput = None, authorization: Optional[str] = Header(None)):
    """Allows a provider to update the order status using the shared orders table."""
    _verify_supabase_user(authorization)
    if not payload:
        raise HTTPException(status_code=400, detail="No status supplied")

    status_value = payload.status.strip().lower()
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/orders?id=eq.{order_id}",
        headers=_supabase_headers(),
        json={"status": status_value},
        timeout=10,
    )
    if resp.status_code not in (200, 201, 204):
        raise HTTPException(status_code=502, detail="Could not update order status")

    try:
        updated = resp.json()[0]
    except Exception:
        updated = {"id": order_id, "status": status_value}
    return {"order": updated}


class SendMessageInput(BaseModel):
    receiver_auth_id: str
    message: str = ''
    booking_id: Optional[int] = None
    conversation_id: Optional[int] = None
    message_type: MessageType = MessageType.TEXT
    location_data: Optional[dict] = None
    invoice_data: Optional[dict] = None
    recommendation_data: Optional[dict] = None


class InquiryInput(BaseModel):
    provider_auth_id: str
    product_id: Optional[int] = None
    product_name: Optional[str] = None


class ProviderRecommendationInput(BaseModel):
    recommended_provider_auth_id: str
    message: str = ''


class ConsultationInput(BaseModel):
    provider_auth_id: str
    specialty: str
    fee: float = Field(gt=0)
    currency: str = 'NGN'


class ProviderConsultationSettingsInput(BaseModel):
    enabled: bool = False
    consultation_fee: Optional[float] = Field(default=None, gt=0)
    description: Optional[str] = None
    currency: str = 'NGN'


class ProviderCertificationInput(BaseModel):
    specialty: str = Field(min_length=1)
    certification_name: str = Field(min_length=1)
    certificate_url: str = Field(min_length=1)
    expiry_date: Optional[str] = None


class ActivateConsultationInput(BaseModel):
    payment_reference: str
    transaction_id: Optional[str] = None


class InvoiceItemInput(BaseModel):
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    quantity: int = Field(default=1, gt=0)


class CreateInvoiceInput(BaseModel):
    conversation_id: int
    customer_auth_id: str
    provider_auth_id: str
    invoice_type: str
    amount: float = Field(gt=0)
    service_date: Optional[str] = None
    service_time: Optional[str] = None
    location: Optional[str] = None
    service_type: Optional[str] = None
    staff_id: Optional[int] = None
    note: Optional[str] = None
    items: List[InvoiceItemInput] = Field(..., min_items=1)


class PayServiceInvoiceInput(BaseModel):
    payment_reference: str
    transaction_id: Optional[str] = None


class CompleteProductInvoiceInput(BaseModel):
    order_id: int
    payment_reference: Optional[str] = None


def _supabase_request(method: str, table: str, **kwargs):
    response = requests.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=_supabase_headers(),
        timeout=10,
        **kwargs,
    )
    if response.status_code not in (200, 201, 204):
        raise HTTPException(status_code=502, detail=f"Could not access {table}")
    return response.json() if response.content else []


def _conversation_for_invoice(conversation_id: int, auth_id: str):
    rows = _supabase_request("GET", "conversations", params={"id": f"eq.{conversation_id}", "select": "*", "limit": "1"})
    if not rows or auth_id not in (rows[0].get("customer_auth_id"), rows[0].get("provider_auth_id")):
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation")
    return rows[0]


def _mark_invoice_chat(invoice_id: int, status: str, payment_reference: Optional[str] = None):
    rows = _supabase_request("GET", "chats", params={"invoice_data->>invoice_id": f"eq.{invoice_id}", "select": "id,invoice_data"})
    for row in rows:
        data = {**(row.get("invoice_data") or {}), "status": status}
        if payment_reference:
            data["paymentReference"] = payment_reference
        _supabase_request("PATCH", "chats", params={"id": f"eq.{row['id']}"}, json={"invoice_data": data})


@api_router.post("/invoices")
def create_invoice(payload: CreateInvoiceInput, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    if payload.invoice_type not in ("service", "product"):
        raise HTTPException(status_code=400, detail="Invoice type must be service or product")
    if auth_id != payload.provider_auth_id:
        raise HTTPException(status_code=403, detail="Only the provider can create this invoice")
    conversation = _conversation_for_invoice(payload.conversation_id, auth_id)
    if conversation.get("provider_auth_id") != payload.provider_auth_id or conversation.get("customer_auth_id") != payload.customer_auth_id:
        raise HTTPException(status_code=403, detail="Invoice participants do not match the conversation")

    provider = _supabase_request("GET", "stylists", params={"auth_id": f"eq.{auth_id}", "select": "id", "limit": "1"})
    provider_id = provider[0]["id"] if provider else None
    if payload.invoice_type == "service":
        if not provider_id or len(payload.items) != 1 or not payload.items[0].service_id:
            raise HTTPException(status_code=400, detail="A provider service is required")
        owned = _supabase_request("GET", "provider_services", params={"id": f"eq.{payload.items[0].service_id}", "provider_id": f"eq.{provider_id}", "is_active": "eq.true", "select": "id,price,duration_minutes"})
        if not owned:
            raise HTTPException(status_code=403, detail="You can only invoice services you offer")
        if abs(float(owned[0].get("price", 0)) - payload.amount) > 0.01:
            raise HTTPException(status_code=400, detail="Invoice amount must match the selected service price")
        slots = requests.get(
            f"{PRIMARY_BACKEND_URL.rstrip('/')}/api/providers/{provider_id}/available-slots",
            params={"date": payload.service_date, "service_duration": 30}, timeout=20,
        )
        if payload.service_date and payload.service_time and slots.status_code == 200 and payload.service_time not in (slots.json() if isinstance(slots.json(), list) else slots.json().get("slots", [])):
            raise HTTPException(status_code=400, detail="That time is not available")
        if payload.staff_id:
            staff_row = _supabase_request("GET", "staff", params={"id": f"eq.{payload.staff_id}", "business_auth_id": f"eq.{auth_id}", "select": "id", "limit": "1"})
            assigned = _supabase_request("GET", "staff_services", params={"staff_id": f"eq.{payload.staff_id}", "service_id": f"eq.{payload.items[0].service_id}", "select": "staff_id", "limit": "1"})
            if not staff_row or not assigned:
                raise HTTPException(status_code=400, detail="That staff member is not assigned to this service")
    else:
        for item in payload.items:
            if not item.product_id:
                raise HTTPException(status_code=400, detail="A product is required")
            owned = _supabase_request("GET", "products", params={"id": f"eq.{item.product_id}", "stylist_auth_id": f"eq.{auth_id}", "select": "id,price,stock"})
            if not owned or owned[0].get("stock", 0) < item.quantity:
                raise HTTPException(status_code=403, detail="You can only invoice products you sell with available stock")
        expected_total = sum(float(_supabase_request("GET", "products", params={"id": f"eq.{item.product_id}", "stylist_auth_id": f"eq.{auth_id}", "select": "price", "limit": "1"})[0]["price"]) * item.quantity for item in payload.items)
        if abs(expected_total - payload.amount) > 0.01:
            raise HTTPException(status_code=400, detail="Invoice amount must match product prices")

    invoice = _supabase_request("POST", "invoices", json={
        "conversation_id": payload.conversation_id, "customer_auth_id": payload.customer_auth_id,
        "provider_auth_id": payload.provider_auth_id, "invoice_type": payload.invoice_type,
        "payment_provider": "flutterwave" if payload.invoice_type == "service" else "paystack",
        "amount": round(payload.amount, 2), "status": "pending", "service_date": payload.service_date,
        "service_time": payload.service_time, "location": payload.location, "service_type": payload.service_type,
        "staff_id": payload.staff_id, "note": payload.note,
    })
    invoice_row = invoice[0]
    item_rows = [{"invoice_id": invoice_row["id"], "service_id": item.service_id, "product_id": item.product_id, "quantity": item.quantity} for item in payload.items]
    _supabase_request("POST", "invoice_items", json=item_rows)
    return {**invoice_row, "items": item_rows}


@api_router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    rows = _supabase_request("GET", "invoices", params={"id": f"eq.{invoice_id}", "select": "*", "limit": "1"})
    if not rows or auth_id not in (rows[0].get("customer_auth_id"), rows[0].get("provider_auth_id")):
        raise HTTPException(status_code=404, detail="Invoice not found")
    items = _supabase_request("GET", "invoice_items", params={"invoice_id": f"eq.{invoice_id}", "select": "*"})
    return {**rows[0], "items": items}


@api_router.post("/invoices/{invoice_id}/pay-service")
def pay_service_invoice(invoice_id: int, payload: PayServiceInvoiceInput, request: Request, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    rows = _supabase_request("GET", "invoices", params={"id": f"eq.{invoice_id}", "invoice_type": "eq.service", "customer_auth_id": f"eq.{auth_id}", "status": "eq.pending", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Pending service invoice not found")
    verification = requests.get(f"{PRIMARY_BACKEND_URL.rstrip('/')}/api/payments/flutterwave/verify", headers=_proxy_request_headers(request), params={"reference": payload.payment_reference, "transaction_id": payload.transaction_id}, timeout=20)
    if verification.status_code != 200 or verification.json().get("status") != "success":
        raise HTTPException(status_code=402, detail="Payment could not be verified")
    invoice = rows[0]
    items = _supabase_request("GET", "invoice_items", params={"invoice_id": f"eq.{invoice_id}", "select": "service_id,quantity", "limit": "1"})
    if not items:
        raise HTTPException(status_code=400, detail="Invoice has no service item")
    service_id = items[0]["service_id"]
    provider = _supabase_request("GET", "stylists", params={"auth_id": f"eq.{invoice['provider_auth_id']}", "select": "id", "limit": "1"})
    if not provider:
        raise HTTPException(status_code=400, detail="Provider profile not found")
    booking_payload = {"provider_id": provider[0]["id"], "customer_auth_id": auth_id, "service_ids": [service_id], "booking_date": invoice.get("service_date"), "booking_time": invoice.get("service_time"), "total_amount": invoice["amount"], "payment_method": "FLUTTERWAVE", "notes": invoice.get("note"), "status": "pending_payment"}
    booking_resp = requests.post(f"{PRIMARY_BACKEND_URL.rstrip('/')}/api/bookings", headers=_proxy_request_headers(request), json=booking_payload, timeout=20)
    if booking_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not create booking")
    booking = booking_resp.json()
    booking_id = booking.get("id") or booking.get("booking", {}).get("id")
    _supabase_request("PATCH", "invoices", params={"id": f"eq.{invoice_id}"}, json={"status": "paid", "payment_reference": payload.payment_reference, "booking_id": booking_id})
    _mark_invoice_chat(invoice_id, "paid", payload.payment_reference)
    return {"invoice": {**invoice, "status": "paid", "payment_reference": payload.payment_reference, "booking_id": booking_id}, "booking": booking}


@api_router.post("/invoices/{invoice_id}/complete-product")
def complete_product_invoice(invoice_id: int, payload: CompleteProductInvoiceInput, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    rows = _supabase_request("GET", "invoices", params={"id": f"eq.{invoice_id}", "invoice_type": "eq.product", "customer_auth_id": f"eq.{auth_id}", "status": "eq.pending", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail="Pending product invoice not found")
    order = _supabase_request("GET", "orders", params={"id": f"eq.{payload.order_id}", "customer_auth_id": f"eq.{auth_id}", "select": "id", "limit": "1"})
    if not order:
        raise HTTPException(status_code=403, detail="Order does not belong to this customer")
    _supabase_request("PATCH", "invoices", params={"id": f"eq.{invoice_id}"}, json={"status": "paid", "payment_reference": payload.payment_reference, "order_id": payload.order_id})
    _mark_invoice_chat(invoice_id, "paid", payload.payment_reference)
    return {"status": "paid", "invoice_id": invoice_id, "order_id": payload.order_id}


@api_router.get("/providers/{provider_auth_id}/consultation-eligibility")
def get_consultation_eligibility(provider_auth_id: str, authorization: Optional[str] = Header(None)):
    _verify_supabase_user(authorization)
    certifications = _supabase_request(
        "GET", "provider_certifications",
        params={
            "provider_auth_id": f"eq.{provider_auth_id}",
            "status": "eq.approved",
            "is_active": "eq.true",
            "select": "*",
        },
    )
    certifications = [certification for certification in certifications if _certification_is_active(certification)]
    settings = _supabase_request(
        "GET", "provider_consultation_settings",
        params={
            "provider_auth_id": f"eq.{provider_auth_id}",
            "enabled": "eq.true",
            "select": "*",
            "limit": "1",
        },
    )
    setting = settings[0] if settings else None
    certification = certifications[0] if certifications else None
    return {
        "eligible": bool(certification and setting),
        "specialty": (certification or {}).get("specialty") or (setting or {}).get("specialty"),
        "consultation_fee": (setting or {}).get("consultation_fee"),
        "currency": (setting or {}).get("currency") or "NGN",
    }


def _certification_is_active(certification: dict) -> bool:
    expiry_date = certification.get("expiry_date")
    if not expiry_date:
        return True
    try:
        return datetime.fromisoformat(str(expiry_date).replace("Z", "+00:00")).date() >= datetime.utcnow().date()
    except ValueError:
        return False


class AdminCertificationRejectionInput(BaseModel):
    rejection_reason: str = Field(min_length=1)


def _admin_certification_status(certification: dict) -> str:
    status = certification.get("status") or certification.get("verification_status") or "pending"
    if status == "approved" and not _certification_is_active(certification):
        return "expired"
    return status


def _admin_provider_info(provider_auth_id: str) -> dict:
    users = _supabase_request(
        "GET",
        "users",
        params={
            "auth_id": f"eq.{provider_auth_id}",
            "select": "*",
            "limit": "1",
        },
    )
    stylists = _supabase_request(
        "GET",
        "stylists",
        params={
            "auth_id": f"eq.{provider_auth_id}",
            "select": "*",
            "limit": "1",
        },
    )
    provider = {**(stylists[0] if stylists else {}), **(users[0] if users else {})}
    return {
        "auth_id": provider_auth_id,
        "name": provider.get("name") or provider.get("full_name"),
        "email": provider.get("email"),
        "profile_image_url": provider.get("profile_image_url") or provider.get("avatar") or provider.get("photo_url"),
        "role": provider.get("role"),
    }


def _admin_certificate_response(certification: dict) -> dict:
    provider_auth_id = certification.get("provider_auth_id")
    provider = _admin_provider_info(provider_auth_id) if provider_auth_id else {}
    status = _admin_certification_status(certification)
    return {
        **certification,
        "provider": provider,
        "provider_auth_id": provider_auth_id,
        "provider_name": provider.get("name") or provider.get("full_name"),
        "provider_profile_image": provider.get("profile_image_url") or provider.get("avatar") or provider.get("photo_url"),
        "verification_status": status,
        "expires_at": certification.get("expires_at") or certification.get("expiry_date"),
    }


@api_router.get("/admin/certifications")
def list_admin_certifications(
    status: Optional[str] = None,
    provider_auth_id: Optional[str] = None,
    search: Optional[str] = None,
    _admin_authorized: None = Depends(_require_admin_key),
):
    rows = _supabase_request(
        "GET",
        "provider_certifications",
        params={"select": "*", "order": "created_at.desc"},
    )
    requested_status = status.strip().lower() if status else None
    search_value = search.strip().lower() if search else None
    result = []
    for row in rows:
        if provider_auth_id and row.get("provider_auth_id") != provider_auth_id:
            continue
        row_status = _admin_certification_status(row)
        if requested_status and row_status != requested_status:
            continue
        item = _admin_certificate_response(row)
        provider_text = " ".join(
            str(item.get("provider", {}).get(field) or "")
            for field in ("name", "full_name", "email", "auth_id")
        ).lower()
        if search_value and search_value not in provider_text and search_value not in str(row.get("specialty") or "").lower():
            continue
        result.append(item)
    return {"certifications": result}


@api_router.get("/admin/certifications/{certification_id}")
def get_admin_certification(certification_id: int, _admin_authorized: None = Depends(_require_admin_key)):
    rows = _supabase_request(
        "GET",
        "provider_certifications",
        params={"id": f"eq.{certification_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"certification": _admin_certificate_response(rows[0])}


def _moderate_admin_certification(certification_id: int, update: dict) -> dict:
    rows = _supabase_request(
        "GET",
        "provider_certifications",
        params={"id": f"eq.{certification_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Certificate not found")
    updated = _supabase_request(
        "PATCH",
        "provider_certifications",
        params={"id": f"eq.{certification_id}"},
        json=update,
    )
    return updated[0] if updated else {**rows[0], **update}


@api_router.post("/admin/certifications/{certification_id}/approve")
def approve_admin_certification(certification_id: int, _admin_authorized: None = Depends(_require_admin_key)):
    certification = _moderate_admin_certification(
        certification_id,
        {
            "status": "approved",
            "verified_at": datetime.utcnow().isoformat(),
            "is_active": True,
        },
    )
    return {"certification": _admin_certificate_response(certification)}


@api_router.post("/admin/certifications/{certification_id}/reject")
def reject_admin_certification(
    certification_id: int,
    payload: AdminCertificationRejectionInput,
    _admin_authorized: None = Depends(_require_admin_key),
):
    rejection_reason = payload.rejection_reason.strip()
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    certification = _moderate_admin_certification(
        certification_id,
        {
            "status": "rejected",
            "rejection_reason": rejection_reason,
            "verified_at": datetime.utcnow().isoformat(),
            "is_active": False,
        },
    )
    return {"certification": _admin_certificate_response(certification)}


def _admin_consultation_response(provider_auth_id: str, certification: Optional[dict], setting: Optional[dict]) -> dict:
    certification = certification or {}
    setting = setting or {}
    certified = (
        _admin_certification_status(certification) == "approved"
        and certification.get("is_active") is True
        and _certification_is_active(certification)
    )
    enabled = setting.get("enabled") is True
    return {
        "provider": _admin_provider_info(provider_auth_id),
        "provider_auth_id": provider_auth_id,
        "specialty": certification.get("specialty") or setting.get("specialty"),
        "certification_name": certification.get("certification_name"),
        "certification_status": _admin_certification_status(certification) if certification else "not_submitted",
        "certification_expiry": certification.get("expires_at") or certification.get("expiry_date"),
        "consultation_enabled": enabled,
        "consultation_fee": setting.get("consultation_fee"),
        "currency": setting.get("currency") or "NGN",
        "description": setting.get("description") or "",
        "eligible": certified and enabled,
    }


@api_router.get("/admin/consultations")
def list_admin_consultations(_admin_authorized: None = Depends(_require_admin_key)):
    settings = _supabase_request(
        "GET", "provider_consultation_settings", params={"select": "*", "order": "updated_at.desc"}
    )
    certification_rows = _supabase_request(
        "GET", "provider_certifications", params={"select": "*", "order": "created_at.desc"}
    )
    certifications = {}
    for row in certification_rows:
        certifications.setdefault(row.get("provider_auth_id"), row)
    return {
        "consultations": [
            _admin_consultation_response(row["provider_auth_id"], certifications.get(row.get("provider_auth_id")), row)
            for row in settings
            if row.get("provider_auth_id")
        ]
    }


@api_router.get("/admin/consultations/{provider_auth_id}")
def get_admin_consultation(provider_auth_id: str, _admin_authorized: None = Depends(_require_admin_key)):
    certifications = _supabase_request(
        "GET",
        "provider_certifications",
        params={"provider_auth_id": f"eq.{provider_auth_id}", "select": "*", "order": "created_at.desc", "limit": "1"},
    )
    settings = _supabase_request(
        "GET",
        "provider_consultation_settings",
        params={"provider_auth_id": f"eq.{provider_auth_id}", "select": "*", "limit": "1"},
    )
    if not certifications and not settings:
        raise HTTPException(status_code=404, detail="Consultation provider not found")
    return {"consultation": _admin_consultation_response(provider_auth_id, certifications[0] if certifications else None, settings[0] if settings else None)}


@api_router.get("/providers/{provider_auth_id}/certification")
def get_provider_certification(provider_auth_id: str, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    if auth_id != provider_auth_id:
        raise HTTPException(status_code=403, detail="You can only view your own certification")
    rows = _supabase_request(
        "GET", "provider_certifications",
        params={"provider_auth_id": f"eq.{auth_id}", "select": "*", "order": "created_at.desc", "limit": "1"},
    )
    certification = rows[0] if rows else None
    if certification and certification.get("status") == "approved" and not _certification_is_active(certification):
        certification = {**certification, "status": "expired"}
    return {"certification": certification, "status": certification.get("status", "not_submitted") if certification else "not_submitted"}


@api_router.post("/providers/{provider_auth_id}/certification")
def submit_provider_certification(provider_auth_id: str, payload: ProviderCertificationInput, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    if auth_id != provider_auth_id:
        raise HTTPException(status_code=403, detail="You can only submit your own certification")
    existing = _supabase_request(
        "GET", "provider_certifications",
        params={"provider_auth_id": f"eq.{auth_id}", "select": "id,status", "order": "created_at.desc", "limit": "1"},
    )
    certification_payload = {
        "provider_auth_id": auth_id,
        "specialty": payload.specialty.strip(),
        "certification_name": payload.certification_name.strip(),
        "certificate_url": payload.certificate_url,
        "expiry_date": payload.expiry_date,
        "status": "pending",
        "rejection_reason": None,
        "verified_by_auth_id": None,
        "verified_at": None,
    }
    if existing and existing[0].get("status") in ("pending", "rejected", "expired"):
        updated = _supabase_request("PATCH", "provider_certifications", params={"id": f"eq.{existing[0]['id']}"}, json=certification_payload)
    elif existing:
        raise HTTPException(status_code=409, detail="Your certificate is already approved and active")
    else:
        updated = _supabase_request("POST", "provider_certifications", json=certification_payload)
    return updated[0] if updated else certification_payload


@api_router.get("/providers/{provider_auth_id}/consultation-settings")
def get_provider_consultation_settings(provider_auth_id: str, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    if auth_id != provider_auth_id:
        raise HTTPException(status_code=403, detail="You can only view your own consultation settings")
    certifications = _supabase_request("GET", "provider_certifications", params={"provider_auth_id": f"eq.{auth_id}", "status": "eq.approved", "is_active": "eq.true", "select": "*", "limit": "1"})
    certifications = [certification for certification in certifications if _certification_is_active(certification)]
    settings = _supabase_request("GET", "provider_consultation_settings", params={"provider_auth_id": f"eq.{auth_id}", "select": "*", "limit": "1"})
    setting = settings[0] if settings else {}
    return {
        "enabled": bool(setting.get("enabled")) if certifications else False,
        "consultation_fee": setting.get("consultation_fee"),
        "description": setting.get("description") or "",
        "currency": setting.get("currency") or "NGN",
        "eligible": bool(certifications),
        "specialty": certifications[0].get("specialty") if certifications else None,
    }


@api_router.patch("/providers/{provider_auth_id}/consultation-settings")
def update_provider_consultation_settings(provider_auth_id: str, payload: ProviderConsultationSettingsInput, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    if auth_id != provider_auth_id:
        raise HTTPException(status_code=403, detail="You can only update your own consultation settings")
    certifications = _supabase_request("GET", "provider_certifications", params={"provider_auth_id": f"eq.{auth_id}", "status": "eq.approved", "is_active": "eq.true", "select": "*", "limit": "1"})
    certifications = [certification for certification in certifications if _certification_is_active(certification)]
    if payload.enabled and not certifications:
        raise HTTPException(status_code=403, detail="An approved professional certification is required")
    if payload.enabled and payload.consultation_fee is None:
        raise HTTPException(status_code=400, detail="A consultation fee is required when enabled")
    settings = _supabase_request("GET", "provider_consultation_settings", params={"provider_auth_id": f"eq.{auth_id}", "select": "id", "limit": "1"})
    setting_payload = {
        "provider_auth_id": auth_id,
        "enabled": payload.enabled,
        "consultation_fee": payload.consultation_fee,
        "description": (payload.description or "").strip() or None,
        "currency": (payload.currency or "NGN").upper(),
    }
    updated = (_supabase_request("PATCH", "provider_consultation_settings", params={"id": f"eq.{settings[0]['id']}"}, json=setting_payload)
               if settings else _supabase_request("POST", "provider_consultation_settings", json=setting_payload))
    return {**(updated[0] if updated else setting_payload), "eligible": bool(certifications), "specialty": certifications[0].get("specialty") if certifications else None}


def _create_conversation(customer_auth_id: str, provider_auth_id: str, conversation_type: str):
    existing = _supabase_request(
        "GET", "conversations",
        params={
            "customer_auth_id": f"eq.{customer_auth_id}",
            "provider_auth_id": f"eq.{provider_auth_id}",
            "type": f"eq.{conversation_type}",
            "select": "*",
            "limit": "1",
        },
    )
    if existing:
        return existing[0]
    created = _supabase_request(
        "POST", "conversations",
        json={
            "customer_auth_id": customer_auth_id,
            "provider_auth_id": provider_auth_id,
            "type": conversation_type,
        },
    )
    return created[0]


@api_router.post("/conversations/inquiry")
def create_inquiry(payload: InquiryInput, authorization: Optional[str] = Header(None)):
    customer_auth_id = _verify_supabase_user(authorization)
    provider = _supabase_request(
        "GET", "stylists",
        params={"auth_id": f"eq.{payload.provider_auth_id}", "select": "auth_id", "limit": "1"},
    )
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if payload.product_id is not None:
        products = _supabase_request(
            "GET", "products",
            params={
                "id": f"eq.{payload.product_id}",
                "stylist_auth_id": f"eq.{payload.provider_auth_id}",
                "select": "id,name,stylist_auth_id",
                "limit": "1",
            },
        )
        if not products:
            raise HTTPException(status_code=403, detail="That product does not belong to this provider")

    existing = _supabase_request(
        "GET", "conversations",
        params={
            "customer_auth_id": f"eq.{customer_auth_id}",
            "provider_auth_id": f"eq.{payload.provider_auth_id}",
            "type": "eq.inquiry",
            "select": "*",
            "limit": "1",
        },
    )
    if existing:
        return existing[0]

    conversation = _create_conversation(customer_auth_id, payload.provider_auth_id, "inquiry")
    if payload.product_id is not None:
        product_label = payload.product_name or f"Product #{payload.product_id}"
        _supabase_request(
            "POST", "chats",
            json={
                "conversation_id": conversation["id"],
                "sender_auth_id": customer_auth_id,
                "receiver_auth_id": payload.provider_auth_id,
                "message": f"Product inquiry: {product_label} (product ID {payload.product_id})",
                "message_type": MessageType.TEXT.value,
                "is_read": False,
            },
        )
    return conversation


@api_router.get("/conversations")
def list_conversations(authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    rows = _supabase_request(
        "GET", "conversations",
        params={
            "or": f"(customer_auth_id.eq.{auth_id},provider_auth_id.eq.{auth_id})",
            "select": "*",
            "order": "updated_at.desc",
        },
    )
    result = []
    for row in rows:
        messages = _supabase_request(
            "GET", "chats",
            params={"conversation_id": f"eq.{row['id']}", "select": "*", "order": "created_at.desc", "limit": "1"},
        )
        result.append({**row, "last_message": messages[0] if messages else None, "unread_count": 0})
    return result


@api_router.post("/consultations")
def create_consultation(payload: ConsultationInput, authorization: Optional[str] = Header(None)):
    customer_auth_id = _verify_supabase_user(authorization)
    eligibility = get_consultation_eligibility(payload.provider_auth_id, authorization)
    if not eligibility["eligible"]:
        raise HTTPException(status_code=403, detail="This provider is not eligible for consultation")
    conversation = _create_conversation(customer_auth_id, payload.provider_auth_id, "consultation")
    created = _supabase_request(
        "POST", "consultations",
        json={
            "conversation_id": conversation["id"],
            "customer_auth_id": customer_auth_id,
            "provider_auth_id": payload.provider_auth_id,
            "specialty": payload.specialty,
            "fee": payload.fee,
            "currency": payload.currency,
            "payment_provider": "flutterwave",
            "payment_status": "pending",
            "status": "pending",
        },
    )
    return {"conversation": conversation, "consultation": created[0]}


@api_router.post("/consultations/{consultation_id}/activate")
def activate_consultation(consultation_id: int, payload: ActivateConsultationInput, request: Request, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    verification = requests.get(
        f"{PRIMARY_BACKEND_URL.rstrip('/')}/api/payments/flutterwave/verify",
        headers=_proxy_request_headers(request),
        params={"reference": payload.payment_reference, "transaction_id": payload.transaction_id},
        timeout=20,
    )
    if verification.status_code != 200 or verification.json().get("status") != "success":
        raise HTTPException(status_code=402, detail="Payment could not be verified")
    rows = _supabase_request(
        "GET", "consultations",
        params={"id": f"eq.{consultation_id}", "customer_auth_id": f"eq.{auth_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Consultation not found")
    now = datetime.utcnow().isoformat()
    updated = _supabase_request(
        "PATCH", "consultations",
        params={"id": f"eq.{consultation_id}"},
        json={
            "payment_status": "paid",
            "payment_reference": payload.payment_reference,
            "status": "active",
            "paid_at": now,
            "activated_at": now,
        },
    )
    return updated[0] if updated else {**rows[0], "status": "active", "payment_status": "paid"}


@api_router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: int, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    conversation = _supabase_request("GET", "conversations", params={"id": f"eq.{conversation_id}", "select": "*", "limit": "1"})
    if not conversation or auth_id not in (conversation[0].get("customer_auth_id"), conversation[0].get("provider_auth_id")):
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation")
    messages = _supabase_request("GET", "chats", params={"conversation_id": f"eq.{conversation_id}", "select": "*", "order": "created_at.asc"})
    return {"conversation": conversation[0], "messages": messages}


@api_router.post("/conversations/{conversation_id}/messages")
def send_conversation_message(conversation_id: int, payload: SendMessageInput, authorization: Optional[str] = Header(None)):
    auth_id = _verify_supabase_user(authorization)
    conversation = _supabase_request("GET", "conversations", params={"id": f"eq.{conversation_id}", "select": "*", "limit": "1"})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    row = conversation[0]
    if auth_id not in (row.get("customer_auth_id"), row.get("provider_auth_id")):
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation")
    if row.get("type") == "consultation":
        consultation = _supabase_request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"})
        if not consultation:
            raise HTTPException(status_code=403, detail="Consultation payment is required before chatting")
    receiver = row["provider_auth_id"] if auth_id == row["customer_auth_id"] else row["customer_auth_id"]
    if payload.message_type == MessageType.PROVIDER_RECOMMENDATION:
        recommendation = payload.recommendation_data or {}
        recommended_provider_auth_id = recommendation.get("recommended_provider_auth_id")
        if not recommended_provider_auth_id or recommended_provider_auth_id == auth_id:
            raise HTTPException(status_code=400, detail="You cannot recommend yourself")
        recommendation_row = _supabase_request(
            "POST", "provider_recommendations",
            json={
                "conversation_id": conversation_id,
                "sender_auth_id": auth_id,
                "recommended_provider_auth_id": recommended_provider_auth_id,
                "message": payload.message.strip(),
            },
        )[0]
        message = json.dumps({
            **recommendation,
            "recommendation_id": recommendation_row.get("id"),
            "message": payload.message.strip(),
        })
    if payload.message_type == MessageType.TEXT:
        sanitized = sanitizeMessagePayload(payload.message)
        message = sanitized["content"]
        is_masked = sanitized["is_masked"]
        original_content = sanitized["original_content"]
    elif payload.message_type != MessageType.PROVIDER_RECOMMENDATION:
        message, is_masked, original_content = payload.message, False, None
    else:
        is_masked, original_content = False, None
    return _supabase_request(
        "POST", "chats",
        json={
            "conversation_id": conversation_id,
            "sender_auth_id": auth_id,
            "receiver_auth_id": receiver,
            "message": message,
            "message_type": payload.message_type.value,
            "is_masked": is_masked,
            "original_content": original_content,
            "is_read": False,
        },
    )[0]


def _chat_row(sender_auth_id: str, payload: SendMessageInput, message: str, is_masked: bool = False, original_content: Optional[str] = None):
    return {
        "sender_auth_id": sender_auth_id,
        "receiver_auth_id": payload.receiver_auth_id,
        "message": message,
        "booking_id": payload.booking_id,
        "is_masked": is_masked,
        "original_content": original_content,
        "message_type": payload.message_type.value,
        "location_data": payload.location_data,
        "invoice_data": payload.invoice_data,
    }


@api_router.post("/chat/messages")
def send_chat_message(payload: SendMessageInput, authorization: Optional[str] = Header(None)):
    """Privileged chat send. RLS blocks a direct client insert into `chats`
    (verified 42501). Reuses the existing `chats` table as-is."""
    auth_id = _verify_supabase_user(authorization)
    if payload.message_type == MessageType.TEXT:
        sanitized = sanitizeMessagePayload(payload.message)
        message = sanitized["content"]
        is_masked = sanitized["is_masked"]
        original_content = sanitized["original_content"]
    else:
        message = payload.message
        is_masked = False
        original_content = None

    if payload.message_type == MessageType.CUSTOM_INVOICE and payload.invoice_data:
        amount = float(payload.invoice_data.get("amount", 0))
        payload.invoice_data = {
            **payload.invoice_data,
            "platformFee": round(amount * 0.07, 2),
            "netPayout": round(amount * 0.93, 2),
        }

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/chats",
        headers=_supabase_headers(),
        json=_chat_row(auth_id, payload, message, is_masked, original_content),
        timeout=10,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not send message")
    result = resp.json()[0]

    if is_masked:
        alert = requests.post(
            f"{SUPABASE_URL}/rest/v1/chats",
            headers=_supabase_headers(),
            json=_chat_row(
                auth_id,
                payload,
                "Protection notice: contact and payment details were masked. Keep payments in-app for protection.",
            ) | {"message_type": MessageType.SYSTEM_ALERT.value},
            timeout=10,
        )
        if alert.status_code not in (200, 201):
            logger.warning("failed to append chat protection alert: %s", alert.status_code)

    return result


@api_router.get("/conversations/unread-count")
def get_conversations_unread_count(authorization: Optional[str] = Header(None)):
    """Return the caller's unread chat count using the indexed receiver/read fields."""
    auth_id = _verify_supabase_user(authorization)
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/chats?receiver_auth_id=eq.{auth_id}&is_read=eq.false&select=id",
        headers={**_supabase_headers(), "Prefer": "count=exact"},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch unread message count")
    content_range = resp.headers.get("content-range", "*/0")
    try:
        unread_count = int(content_range.rsplit("/", 1)[1])
    except (ValueError, IndexError):
        unread_count = len(resp.json())
    return {"unreadCount": unread_count}


@api_router.post("/conversations/{conversation_id}/mark-read")
def mark_conversation_read(conversation_id: int, authorization: Optional[str] = Header(None)):
    """Mark unread messages in a booking conversation read for the current user."""
    auth_id = _verify_supabase_user(authorization)
    now = datetime.utcnow().isoformat()
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/chats?booking_id=eq.{conversation_id}&receiver_auth_id=eq.{auth_id}&is_read=eq.false",
        headers=_supabase_headers(),
        json={"is_read": True, "read": True, "read_at": now},
        timeout=10,
    )
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=502, detail="Could not mark conversation read")
    return {"conversationId": conversation_id, "readAt": now, "clearedCount": len(resp.json()) if resp.content else 0}


# ============================================================================
# User Profile Management - GET and PATCH /users/by-auth/{auth_id}
# ============================================================================

@api_router.get("/users/by-auth/{auth_id}")
def get_user_by_auth_id(auth_id: str):
    """Fetch user profile by auth_id from the users table in Supabase.
    This is the primary endpoint for loading user profile on app startup."""
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/users?auth_id=eq.{auth_id}&select=*",
            headers=_supabase_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not fetch user from database")
        
        users = resp.json()
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        
        return users[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[get_user_by_auth_id] failed to fetch user: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


class UpdateUserInput(BaseModel):
    account_type: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    location_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    profile_completed: Optional[bool] = None


@api_router.patch("/users/by-auth/{auth_id}")
def update_user_by_auth_id(auth_id: str, payload: UpdateUserInput, authorization: Optional[str] = Header(None)):
    """Update user profile fields by auth_id.
    Currently handles account_type updates for Individual/Business selection.
    Requires authentication token to verify ownership."""
    try:
        # Verify that the requester is updating their own profile
        requesting_auth_id = _verify_supabase_user(authorization)
        if requesting_auth_id != auth_id:
            raise HTTPException(status_code=403, detail="Unauthorized: can only update own profile")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[update_user_by_auth_id] auth verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc
    
    # Build update payload with only non-None fields
    update_data = {}
    if payload.account_type is not None:
        if payload.account_type not in ('individual', 'business'):
            raise HTTPException(status_code=400, detail="Invalid account_type: must be 'individual' or 'business'")
        update_data['account_type'] = payload.account_type
    
    if payload.name is not None:
        update_data['name'] = payload.name
    if payload.email is not None:
        update_data['email'] = payload.email
    if payload.phone is not None:
        update_data['phone'] = payload.phone
    if payload.gender is not None:
        update_data['gender'] = payload.gender
    if payload.country is not None:
        update_data['country'] = payload.country
    if payload.city is not None:
        update_data['city'] = payload.city
    if payload.state is not None:
        update_data['state'] = payload.state
    if payload.location_address is not None:
        update_data['location_address'] = payload.location_address
    if payload.latitude is not None:
        update_data['latitude'] = payload.latitude
    if payload.longitude is not None:
        update_data['longitude'] = payload.longitude
    if payload.profile_completed is not None:
        update_data['profile_completed'] = payload.profile_completed
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        # Update in Supabase users table
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/users?auth_id=eq.{auth_id}",
            headers=_supabase_headers(),
            json=update_data,
            timeout=10,
        )

        if resp.status_code not in (200, 201, 204):
            logger.error("[update_user_by_auth_id] update failed: status=%s body=%s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Could not update user profile")

        if payload.account_type is not None:
            stylist_resp = requests.patch(
                f"{SUPABASE_URL}/rest/v1/stylists?auth_id=eq.{auth_id}",
                headers=_supabase_headers(),
                json={"account_type": payload.account_type},
                timeout=10,
            )
            if stylist_resp.status_code not in (200, 201, 204):
                logger.warning("[update_user_by_auth_id] stylist account_type sync failed: status=%s body=%s", stylist_resp.status_code, stylist_resp.text)

        # Return the updated user
        fetch_resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/users?auth_id=eq.{auth_id}&select=*",
            headers=_supabase_headers(),
            timeout=10,
        )
        if fetch_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not fetch updated user")
        
        users = fetch_resp.json()
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        
        return users[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[update_user_by_auth_id] failed to update user: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@api_router.delete("/users/by-auth/{auth_id}")
def delete_user_by_auth_id(auth_id: str, authorization: Optional[str] = Header(None)):
    """Delete the authenticated user's profile and Supabase auth record."""
    try:
        requesting_auth_id = _verify_supabase_user(authorization)
        if requesting_auth_id != auth_id:
            raise HTTPException(status_code=403, detail="Unauthorized: can only delete own account")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[delete_user_by_auth_id] auth verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc

    try:
        delete_user_resp = requests.delete(
            f"{SUPABASE_URL}/rest/v1/users?auth_id=eq.{auth_id}",
            headers=_supabase_headers(),
            timeout=10,
        )
        if delete_user_resp.status_code not in (200, 201, 204):
            logger.error("[delete_user_by_auth_id] users delete failed: status=%s body=%s", delete_user_resp.status_code, delete_user_resp.text)
            raise HTTPException(status_code=502, detail="Could not delete profile")

        admin_delete_resp = requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{auth_id}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if admin_delete_resp.status_code not in (200, 201, 202, 204):
            logger.warning("[delete_user_by_auth_id] auth user delete failed: status=%s body=%s", admin_delete_resp.status_code, admin_delete_resp.text)

        return {"status": "deleted", "auth_id": auth_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[delete_user_by_auth_id] failed to delete user: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


# Include the router in the main app
@app.on_event('startup')
async def startup_register_proxy_routes():
    _register_primary_proxy_routes()

app.include_router(api_router)

@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    body_text = ""
    try:
        body_bytes = await request.body()
        body_text = body_bytes.decode('utf-8', errors='replace')
    except Exception as body_exc:
        logger.exception("[paystack-init] failed to read body for validation failure: %s", body_exc)

    formatted_errors = []
    for error in exc.errors():
        loc = list(error.get("loc", []))
        formatted_errors.append({
            "loc": loc,
            "msg": "Field required" if error.get("type") == "missing" else error.get("msg"),
            "type": error.get("type"),
            "input": error.get("input"),
        })

    logger.error("[paystack-init] validation failed method=%s path=%s body=%s errors=%s", request.method, request.url.path, body_text or '<empty>', formatted_errors)
    return JSONResponse(status_code=422, content={"detail": formatted_errors})

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
