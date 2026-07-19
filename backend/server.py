from fastapi import FastAPI, APIRouter, Header, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Supabase - used ONLY for the two privileged write endpoints below.
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

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
        f"{SUPABASE_URL}/rest/v1/products?id=in.({product_ids})&select=id,price,stock,name,approved",
        headers=_supabase_headers(),
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not verify products")
    products = {p["id"]: p for p in resp.json()}

    total = 0.0
    for item in payload.items:
        product = products.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product['name']}")
        total += float(product["price"]) * item.quantity

    order_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/orders",
        headers=_supabase_headers(),
        json={"customer_auth_id": auth_id, "status": "pending", "total_amount": total},
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

    return {"order": order, "items": items_resp.json()}


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
app.include_router(api_router)

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
