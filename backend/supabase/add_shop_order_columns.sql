-- Add the missing Shop order columns required by the mobile checkout flow.
-- This preserves existing data and only adds columns that are absent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS provider_auth_id uuid,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'failed', 'refunded', 'cancelled')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS orders_customer_auth_id_idx
  ON public.orders (customer_auth_id);

CREATE INDEX IF NOT EXISTS orders_provider_auth_id_idx
  ON public.orders (provider_auth_id);

CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON public.orders (payment_reference);
