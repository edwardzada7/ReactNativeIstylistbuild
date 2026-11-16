-- iStylist migration #4: service invoices ("Invoice failed - Something went wrong").
-- Safe to run more than once. Run in Supabase Dashboard -> SQL Editor.
--
-- Service invoices are saved with payment_provider = 'flutterwave' (product
-- invoices use 'paystack'), status 'pending', service_date/service_time.
-- A CHECK constraint on invoices / invoice_items that only allows the older
-- values rejects the insert, and the backend reports it as a generic error.
-- This replaces those checks with ones that accept every value the backend writes.

BEGIN;

-- 1) Drop restrictive CHECK constraints on the invoice tables.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE con.contype = 'c'
       AND ns.nspname = 'public'
       AND rel.relname IN ('invoices', 'invoice_items')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.relname, c.conname);
  END LOOP;
END $$;

-- 2) Re-add safe checks that match what the backend writes.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IS NULL OR lower(invoice_type) IN ('service', 'product'));

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_payment_provider_check
  CHECK (payment_provider IS NULL OR lower(payment_provider) IN ('paystack', 'flutterwave', 'wallet'));

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_quantity_check
  CHECK (quantity IS NULL OR quantity >= 1);

-- 3) service_date / service_time arrive as text ("2026-09-12" / "14:45").
--    If they were created as other types, make sure they accept those values.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='invoices'
               AND column_name='service_time' AND data_type NOT IN ('text', 'character varying', 'time without time zone')) THEN
    ALTER TABLE public.invoices ALTER COLUMN service_time TYPE text USING service_time::text;
  END IF;
END $$;

-- 4) Foreign keys from invoice_items.service_id / staff columns that point at
--    tables the service ids don't come from would also block the insert.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.contype = 'f'
       AND rel.relname = 'invoice_items'
       AND att.attname = 'service_id'
       AND con.confrelid <> 'public.services'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.invoice_items DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

COMMIT;
