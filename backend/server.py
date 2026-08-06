from fastapi import FastAPI, APIRouter, Header, HTTPException, Path, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
from pathlib import Path as PathlibPath
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import json
from datetime import datetime


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


class CreateOrderInput(BaseModel):
    items: List[OrderItemInput]
    payment_reference: Optional[str] = None
    payment_status: Optional[str] = None
    subtotal: Optional[float] = None
    delivery_fee: Optional[float] = None
    total_amount: Optional[float] = None
    customer_name: Optional[str] = None
    provider_auth_id: Optional[str] = None
    order_status: Optional[str] = None


class UpdateOrderStatusInput(BaseModel):
    status: str


class ProductReviewCreateInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default='')


class ProductReviewUpdateInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default='')


class PaystackShopInitializeInput(BaseModel):
    amount: float
    email: str
    items: Optional[List[OrderItemInput]] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    redirect_url: Optional[str] = None
    currency: Optional[str] = 'NGN'


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


def _create_pending_shop_order(auth_id: str, reference: str, items: List[OrderItemInput], products: dict, provider_auth_id: Optional[str], customer_name: Optional[str], subtotal: float, total_amount: float, delivery_fee: float = 0.0):
    order_payload = {
        "customer_auth_id": auth_id,
        "status": "pending",
        "total_amount": round(total_amount, 2),
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(delivery_fee, 2),
        "payment_status": "pending",
        "payment_reference": reference,
        "created_at": datetime.utcnow().isoformat(),
    }
    if provider_auth_id:
        order_payload["provider_auth_id"] = provider_auth_id
    if customer_name:
        order_payload["customer_name"] = customer_name

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


def _finalize_verified_shop_order(order_id: int, auth_id: str, items: List[OrderItemInput], products: dict, provider_auth_id: Optional[str], customer_name: Optional[str], subtotal: float, total_amount: float, delivery_fee: float = 0.0):
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
    user_meta = user.get("user_metadata") or {}
    full_name = user_meta.get("full_name") or user_meta.get("name") or user.get("email") or "Customer"
    avatar = user_meta.get("avatar_url") or user_meta.get("avatar") or None
    verified_purchase = await _user_has_purchased_product(auth_id, product_id)

    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/product_reviews?product_id=eq.{product_id}&user_id=eq.{auth_id}&select=id",
        headers=_supabase_headers(),
        timeout=10,
    )
    if existing_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not check existing review")
    existing_reviews = existing_resp.json() or []

    review_payload = {
        "product_id": product_id,
        "user_id": auth_id,
        "user_full_name": full_name,
        "user_avatar": avatar,
        "rating": payload.rating,
        "review_text": payload.review_text,
        "created_at": datetime.utcnow().isoformat(),
        "verified_purchase": verified_purchase,
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
    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/product_reviews?id=eq.{review_id}&product_id=eq.{product_id}&user_id=eq.{auth_id}&select=id",
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
            "rating": payload.rating,
            "review_text": payload.review_text,
            "updated_at": datetime.utcnow().isoformat(),
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

    validation = _validate_shop_checkout_items(payload.items or [], payload.amount)
    amount_kobo = int(round(float(payload.amount) * 100))
    if amount_kobo <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")

    reference = f"shop_{uuid.uuid4().hex[:12]}"
    _create_pending_shop_order(
        auth_id=auth_id,
        reference=reference,
        items=payload.items or [],
        products=validation["products"],
        provider_auth_id=validation["provider_auth_id"],
        customer_name=payload.name or payload.email or auth_id,
        subtotal=validation["subtotal"],
        total_amount=validation["total"],
    )

    paystack_payload = {
        "email": payload.email,
        "amount": amount_kobo,
        "reference": reference,
        "currency": (payload.currency or 'NGN').upper(),
        "callback_url": payload.redirect_url,
        "metadata": {
            "name": payload.name or '',
            "phone": payload.phone or '',
            "purpose": 'shop_checkout',
            "items": [item.dict() for item in (payload.items or [])],
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

    parsed_items = []
    if items:
        try:
            parsed_items = json.loads(items)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail='Invalid checkout items') from exc
    if not parsed_items:
        raise HTTPException(status_code=400, detail='No checkout items provided')

    normalized_items = [OrderItemInput(product_id=item['product_id'], quantity=item['quantity']) for item in parsed_items]
    validation = _validate_shop_checkout_items(normalized_items, amount=amount)

    existing_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/orders?payment_reference=eq.{reference}&select=id,payment_reference,payment_status",
        headers=_supabase_headers(),
        timeout=10,
    )
    if existing_resp.status_code == 200 and existing_resp.json():
        existing_order = existing_resp.json()[0]
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

    if existing_resp.status_code == 200 and existing_resp.json():
        existing_order = existing_resp.json()[0]
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
    message: str
    booking_id: Optional[int] = None


@api_router.post("/chat/messages")
def send_chat_message(payload: SendMessageInput, authorization: Optional[str] = Header(None)):
    """Privileged chat send. RLS blocks a direct client insert into `chats`
    (verified 42501). Reuses the existing `chats` table as-is."""
    auth_id = _verify_supabase_user(authorization)
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/chats",
        headers=_supabase_headers(),
        json={
            "sender_auth_id": auth_id,
            "receiver_auth_id": payload.receiver_auth_id,
            "message": payload.message,
            "booking_id": payload.booking_id,
        },
        timeout=10,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Could not send message")
    return resp.json()[0]


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
