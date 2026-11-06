-- iStylist migration #2: ratings, referral earnings, service invoices.
-- Safe to run more than once. Run in Supabase Dashboard -> SQL Editor.

BEGIN;

-- 1) PROVIDER RATINGS + REVIEW COUNTS -----------------------------------------
-- stylists.rating was never updated when reviews were written, so every card
-- showed 0.0 (0). Keep rating + review_count in sync from public.reviews.
ALTER TABLE public.stylists ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_stylist_rating(p_auth_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_auth_id IS NULL THEN RETURN; END IF;
  UPDATE public.stylists s
     SET rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1)
                              FROM public.reviews r
                             WHERE r.provider_auth_id::text = p_auth_id), 0),
         review_count = (SELECT COUNT(*) FROM public.reviews r
                          WHERE r.provider_auth_id::text = p_auth_id)
   WHERE s.auth_id::text = p_auth_id;
END $$;

CREATE OR REPLACE FUNCTION public.reviews_refresh_stylist_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_stylist_rating(NEW.provider_auth_id::text);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_stylist_rating(OLD.provider_auth_id::text);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_stylist_rating ON public.reviews;
CREATE TRIGGER trg_reviews_refresh_stylist_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_refresh_stylist_rating();

-- Backfill every provider now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT auth_id::text AS auth_id FROM public.stylists WHERE auth_id IS NOT NULL LOOP
    PERFORM public.refresh_stylist_rating(r.auth_id);
  END LOOP;
END $$;

-- 2) REFERRAL EARNINGS (provider screen) ----------------------------------------
-- The backend only exposes /admin/referrals/earnings, so the provider screen
-- reads its own rows directly. Allow each recipient to read their own earnings.
ALTER TABLE public.platform_referral_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_earnings_select_own" ON public.platform_referral_earnings;
CREATE POLICY "referral_earnings_select_own" ON public.platform_referral_earnings
  FOR SELECT TO authenticated
  USING (recipient_auth_id::text = auth.uid()::text);

-- 3) SERVICE INVOICES -------------------------------------------------------------
-- POST /api/invoices checks the service in "provider_services", but the app's
-- services live in "services" (provider_services is empty), so every service
-- invoice failed with "Invoice amount must match the selected service price".
-- Replace the empty table with a read-only view over services.
DO $$
DECLARE c record; rows_in_table bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='provider_services' AND table_type='BASE TABLE') THEN
    EXECUTE 'SELECT COUNT(*) FROM public.provider_services' INTO rows_in_table;
    IF rows_in_table > 0 THEN
      RAISE EXCEPTION 'provider_services has % rows; not replacing it. Contact support before continuing.', rows_in_table;
    END IF;
    -- Drop foreign keys that point at the old table (e.g. invoice_items.service_id).
    FOR c IN
      SELECT con.conname, rel.relname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE con.contype = 'f' AND con.confrelid = 'public.provider_services'::regclass
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.relname, c.conname);
    END LOOP;
    ALTER TABLE public.provider_services RENAME TO provider_services_legacy;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.provider_services AS
  SELECT s.id,
         s.stylist_id,
         s.stylist_id AS provider_id,
         s.id         AS service_id,
         s.name,
         s.price,
         s.duration,
         s.category,
         TRUE         AS is_active
    FROM public.services s;
GRANT SELECT ON public.provider_services TO anon, authenticated, service_role;

COMMIT;
