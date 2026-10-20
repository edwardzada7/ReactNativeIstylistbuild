-- iStylist: schema fixes needed by the Railway backend (consultation_routes.py / server.py)
-- Safe to run more than once. Run in Supabase Dashboard -> SQL Editor.

BEGIN;

-- 1) INVOICES -----------------------------------------------------------------
-- POST /api/invoices inserts these columns; they were missing, so every
-- invoice failed with "Something went wrong" (PostgREST 400 -> backend 502).
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount            numeric(12,2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS location          text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS service_type      text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS staff_id          integer;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS note              text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS service_date      date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS service_time      text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_provider  text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS booking_id        integer;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status            text DEFAULT 'pending';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_at        timestamptz DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now();

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS service_id integer;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS product_id integer;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity   integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS invoices_conversation_id_idx ON public.invoices (conversation_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);

-- 2) SERVICE INVOICE LOOKUPS ---------------------------------------------------
-- The backend validates service invoices with
--   stylists?select=id            (stylists has no "id"; its PK is user_id)
--   provider_services?provider_id (the column is called stylist_id)
-- Read-only generated aliases make those queries work without a backend redeploy.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='stylists' AND column_name='id') THEN
    ALTER TABLE public.stylists ADD COLUMN id integer GENERATED ALWAYS AS (user_id) STORED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='provider_services' AND column_name='provider_id') THEN
    ALTER TABLE public.provider_services ADD COLUMN provider_id integer GENERATED ALWAYS AS (stylist_id) STORED;
  END IF;
END $$;

-- 3) MY ORDERS (customer) -------------------------------------------------------
-- The app reads orders/order_items directly with the signed-in Supabase session.
-- Without these SELECT policies RLS returns [] and "My Orders" is always empty.
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated
  USING (customer_auth_id = auth.uid()::text OR provider_auth_id = auth.uid()::text);

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
CREATE POLICY "order_items_select_own" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.customer_auth_id = auth.uid()::text OR o.provider_auth_id = auth.uid()::text)
  ));

-- 4) AVATARS / NAMES --------------------------------------------------------------
-- Provider photos live in stylists.profile_image_url, customer photos in
-- users.profile_image_url. Let the app read public display fields so avatars
-- show everywhere (home, feed, chat, bookings).
DROP POLICY IF EXISTS "stylists_public_read" ON public.stylists;
CREATE POLICY "stylists_public_read" ON public.stylists FOR SELECT USING (true);

-- Users may update their own profile photo (customer profile screen).
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid()::text) WITH CHECK (auth_id = auth.uid()::text);

-- Providers may update their own stylist row (provider profile photo).
DROP POLICY IF EXISTS "stylists_update_own" ON public.stylists;
CREATE POLICY "stylists_update_own" ON public.stylists
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid()::text) WITH CHECK (auth_id = auth.uid()::text);

-- Public, read-only view of names + photos (no email/phone exposed).
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT u.auth_id, u.name, u.profile_image_url,
         s.business_name, s.profile_image_url AS provider_image_url
  FROM public.users u
  LEFT JOIN public.stylists s ON s.auth_id = u.auth_id;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMIT;
