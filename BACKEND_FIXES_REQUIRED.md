# Backend fixes needed on your OTHER repo (UpdatedistylistBeauty-Marketplace)

These 2 fixes live in your separate backend repo that's deployed to Railway
(https://github.com/edwardzada7/UpdatedistylistBeauty-Marketplace), which I
don't have push access to. Everything below was verified live against your
real Supabase database before being written up.

## 1. Booking creation fails (500 "column users.moderation_status does not exist")

Root cause: `backend/server.py`'s `create_booking` queries a `moderation_status`
column on `users` that was never actually added to your database - the
migration file `backend/migrations/phase11_moderation.sql` exists in your repo
but was never run.

**Fix:** Run this in Supabase Dashboard → SQL Editor (takes 30 seconds, no
code change needed):

```sql
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (moderation_status IN ('active', 'suspended', 'deactivated')),
    ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
    ADD COLUMN IF NOT EXISTS moderation_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderation_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_moderation_status ON users(moderation_status);

CREATE TABLE IF NOT EXISTS admin_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_identifier TEXT NOT NULL,
    affected_account_type VARCHAR(20) NOT NULL,
    affected_account_auth_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_account ON admin_logs(affected_account_auth_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
```

## 2. "Ask a Question" / "Ask About Product" (502 error) + ALL inquiry/consultation chat messages broken

Root cause (verified live via curl against your Supabase project): your real
`conversations` table column is `conversation_type`, not `type`. Your real
`chats` table has `read` + a `metadata` jsonb column - there is no `is_read`,
`location_data`, or `invoice_data` column. But `backend/consultation_routes.py`
queries/inserts using the wrong names everywhere, so every call to
`/conversations/inquiry`, `/conversations/{id}/messages`,
`/conversations/unread-count`, and `/conversations/{id}/mark-read` fails.

**Fix:** Apply the patch below to `backend/consultation_routes.py` in that
repo, commit, and push (Railway will auto-deploy).

```diff
--- a/backend/consultation_routes.py
+++ b/backend/consultation_routes.py
@@ -181,10 +181,10 @@ def _provider_info(auth_id: str) -> dict:


 def _conversation(customer_auth_id: str, provider_auth_id: str, conversation_type: str) -> dict:
-    rows = _request("GET", "conversations", params={"customer_auth_id": f"eq.{customer_auth_id}", "provider_auth_id": f"eq.{provider_auth_id}", "type": f"eq.{conversation_type}", "select": "*", "limit": "1"})
+    rows = _request("GET", "conversations", params={"customer_auth_id": f"eq.{customer_auth_id}", "provider_auth_id": f"eq.{provider_auth_id}", "conversation_type": f"eq.{conversation_type}", "select": "*", "limit": "1"})
     if rows:
         return rows[0]
-    created = _request("POST", "conversations", json={"customer_auth_id": customer_auth_id, "provider_auth_id": provider_auth_id, "type": conversation_type})
+    created = _request("POST", "conversations", json={"customer_auth_id": customer_auth_id, "provider_auth_id": provider_auth_id, "conversation_type": conversation_type})
     return created[0]


@@ -196,6 +196,29 @@ def _consultation_eligibility(provider_auth_id: str) -> dict:
     return {"eligible": bool(active and setting.get("enabled") is True), "specialty": (active or {}).get("specialty") or setting.get("specialty"), "consultation_fee": setting.get("consultation_fee"), "currency": setting.get("currency") or "NGN"}


+def _chat_metadata_payload(location_data: Optional[Dict[str, Any]] = None, invoice_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
+    """The `chats` table has no separate location_data/invoice_data columns -
+    they live inside the `metadata` jsonb column instead."""
+    metadata: Dict[str, Any] = {}
+    if location_data is not None:
+        metadata["location_data"] = location_data
+    if invoice_data is not None:
+        metadata["invoice_data"] = invoice_data
+    return metadata
+
+
+def _normalize_chat_row(row: dict) -> dict:
+    """Expose metadata.location_data/invoice_data and `read` as top-level
+    fields for backward compatibility with API consumers."""
+    if not row:
+        return row
+    metadata = row.get("metadata") or {}
+    row["is_read"] = row.get("read", False)
+    row.setdefault("location_data", metadata.get("location_data"))
+    row.setdefault("invoice_data", metadata.get("invoice_data"))
+    return row
+
+
 def send_shared_chat_message(conversation_id: int, auth_id: str, message: str, message_type: str = "text", location_data: Optional[Dict[str, Any]] = None, invoice_data: Optional[Dict[str, Any]] = None, recommendation_data: Optional[Dict[str, Any]] = None) -> dict:
     """Send a typed message through the existing generic chat endpoint."""
     conversation = _participant(conversation_id, auth_id)
@@ -203,7 +226,7 @@ def send_shared_chat_message(conversation_id: int, auth_id: str, message: str, m
     allowed_types = {"text", "image", "invoice", "provider_recommendation", "system"}
     if message_type not in allowed_types:
         raise HTTPException(status_code=400, detail="Unsupported message type")
-    if conversation.get("type") == "consultation" and not _request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"}):
+    if conversation.get("conversation_type") == "consultation" and not _request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"}):
         raise HTTPException(status_code=403, detail="Consultation payment is required before chatting")
     receiver = conversation["provider_auth_id"] if auth_id == conversation["customer_auth_id"] else conversation["customer_auth_id"]
     content = message.strip()
@@ -214,7 +237,8 @@ def send_shared_chat_message(conversation_id: int, auth_id: str, message: str, m
             raise HTTPException(status_code=400, detail="A valid different provider is required")
         recommendation_row = _request("POST", "provider_recommendations", json={"conversation_id": conversation_id, "sender_auth_id": auth_id, "recommended_provider_auth_id": recommended, "message": content})
         content = json.dumps({**recommendation, "recommendation_id": recommendation_row[0].get("id"), "message": content})
-    return _request("POST", "chats", json={"conversation_id": conversation_id, "sender_auth_id": auth_id, "receiver_auth_id": receiver, "message": content, "message_type": message_type, "location_data": location_data, "invoice_data": invoice_data, "is_read": False, "read": False})[0]
+    data = {"conversation_id": conversation_id, "sender_auth_id": auth_id, "receiver_auth_id": receiver, "message": content, "message_type": message_type, "metadata": _chat_metadata_payload(location_data, invoice_data), "read": False}
+    return _normalize_chat_row(_request("POST", "chats", json=data)[0])


 def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
@@ -277,7 +301,7 @@ def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
             raise HTTPException(status_code=403, detail="That product does not belong to this provider")
         conversation = _conversation(customer, payload.provider_auth_id, "inquiry")
         if payload.product_id is not None:
-            _request("POST", "chats", json={"conversation_id": conversation["id"], "sender_auth_id": customer, "receiver_auth_id": payload.provider_auth_id, "message": f"Product inquiry: {payload.product_name or f'Product #{payload.product_id}'} (product ID {payload.product_id})", "message_type": "text", "is_read": False, "read": False})
+            _request("POST", "chats", json={"conversation_id": conversation["id"], "sender_auth_id": customer, "receiver_auth_id": payload.provider_auth_id, "message": f"Product inquiry: {payload.product_name or f'Product #{payload.product_id}'} (product ID {payload.product_id})", "message_type": "text", "read": False})
         return conversation

     @api_router.get("/conversations")
@@ -286,7 +310,7 @@ def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
         rows = _request("GET", "conversations", params={"or": f"(customer_auth_id.eq.{auth_id},provider_auth_id.eq.{auth_id})", "select": "*", "order": "updated_at.desc"})
         for row in rows:
             messages = _request("GET", "chats", params={"conversation_id": f"eq.{row['id']}", "select": "*", "order": "created_at.desc", "limit": "1"})
-            row["last_message"] = messages[0] if messages else None
+            row["last_message"] = _normalize_chat_row(messages[0]) if messages else None
         return rows

     @api_router.post("/consultations")
@@ -320,7 +344,8 @@ def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
     def get_messages(conversation_id: int, authorization: Optional[str] = Header(None)):
         auth_id = _current_auth_id(authorization)
         conversation = _participant(conversation_id, auth_id)
-        return {"conversation": conversation, "messages": _request("GET", "chats", params={"conversation_id": f"eq.{conversation_id}", "select": "*", "order": "created_at.asc"})}
+        messages = _request("GET", "chats", params={"conversation_id": f"eq.{conversation_id}", "select": "*", "order": "created_at.asc"})
+        return {"conversation": conversation, "messages": [_normalize_chat_row(m) for m in messages]}

     @api_router.post("/conversations/{conversation_id}/messages")
     def send_message(conversation_id: int, payload: SendConversationMessageInput, authorization: Optional[str] = Header(None)):
@@ -329,7 +354,7 @@ def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
         message_type = _normalize_shared_message_type(payload.message_type)
         if message_type not in {"text", "image", "invoice", "provider_recommendation", "system"}:
             raise HTTPException(status_code=400, detail="Unsupported message type")
-        if conversation.get("type") == "consultation" and not _request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"}):
+        if conversation.get("conversation_type") == "consultation" and not _request("GET", "consultations", params={"conversation_id": f"eq.{conversation_id}", "status": "eq.active", "select": "id", "limit": "1"}):
             raise HTTPException(status_code=403, detail="Consultation payment is required before chatting")
         receiver = conversation["provider_auth_id"] if auth_id == conversation["customer_auth_id"] else conversation["customer_auth_id"]
         message = payload.message.strip()
@@ -340,13 +365,13 @@ def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
                 raise HTTPException(status_code=400, detail="A valid different provider is required")
             recommendation_row = _request("POST", "provider_recommendations", json={"conversation_id": conversation_id, "sender_auth_id": auth_id, "recommended_provider_auth_id": recommended, "message": message})
             message = json.dumps({**recommendation, "recommendation_id": recommendation_row[0].get("id"), "message": message})
-        data = {"conversation_id": conversation_id, "sender_auth_id": auth_id, "receiver_auth_id": receiver, "message": message, "message_type": message_type, "location_data": payload.location_data, "invoice_data": payload.invoice_data, "is_read": False, "read": False}
-        return _request("POST", "chats", json=data)[0]
+        data = {"conversation_id": conversation_id, "sender_auth_id": auth_id, "receiver_auth_id": receiver, "message": message, "message_type": message_type, "metadata": _chat_metadata_payload(payload.location_data, payload.invoice_data), "read": False}
+        return _normalize_chat_row(_request("POST", "chats", json=data)[0])

     @api_router.get("/conversations/unread-count")
     def unread_count(authorization: Optional[str] = Header(None)):
         auth_id = _current_auth_id(authorization)
-        rows = _request("GET", "chats", params={"receiver_auth_id": f"eq.{auth_id}", "is_read": "eq.false", "select": "id"})
+        rows = _request("GET", "chats", params={"receiver_auth_id": f"eq.{auth_id}", "read": "eq.false", "select": "id"})
         return {"unreadCount": len(rows)}

     @api_router.post("/conversations/{conversation_id}/mark-read")
@@ -355,7 +380,7 @@ def register_consultation_routes(api_router: APIRouter, supabase: Any) -> None:
         if conversation_type not in ("inquiry", "consultation"):
             raise HTTPException(status_code=400, detail="conversation_type is required")
         _participant(conversation_id, auth_id)
-        updated = _request("PATCH", "chats", params={"conversation_id": f"eq.{conversation_id}", "receiver_auth_id": f"eq.{auth_id}", "is_read": "eq.false"}, json={"is_read": True, "read": True, "read_at": datetime.utcnow().isoformat()})
+        updated = _request("PATCH", "chats", params={"conversation_id": f"eq.{conversation_id}", "receiver_auth_id": f"eq.{auth_id}", "read": "eq.false"}, json={"read": True, "read_at": datetime.utcnow().isoformat()})
         return {"conversationId": conversation_id, "clearedCount": len(updated)}

     @api_router.post("/invoices")
```

You can apply this with `git apply` from the repo root, or just paste the
diffed lines by hand - it's the same file, only these functions change.
