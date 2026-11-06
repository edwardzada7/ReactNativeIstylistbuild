-- iStylist migration #3: product invoices + shop orders visibility.
-- Safe to run more than once. Run in Supabase Dashboard -> SQL Editor.
-- (Run migration #2 "20260602_ratings_referrals_service_invoice.sql" first if you haven't.)

BEGIN;

-- 1) PRODUCT / SERVICE INVOICES ---------------------------------------------
-- POST /api/invoices inserts invoice_items with only invoice_id, service_id,
-- product_id, quantity. unit_price / total_price are required (NOT NULL) in
-- your table, so the insert failed -> "Something went wrong on our end".
-- Make them optional and fill them automatically from the product/service price.
ALTER TABLE public.invoice_items ALTER COLUMN unit_price  DROP NOT NULL;
ALTER TABLE public.invoice_items ALTER COLUMN total_price DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.invoice_items_fill_prices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity < 1 THEN NEW.quantity := 1; END IF;
  IF NEW.unit_price IS NULL THEN
    IF NEW.product_id IS NOT NULL THEN
      SELECT p.price INTO NEW.unit_price FROM public.products p WHERE p.id = NEW.product_id;
    ELSIF NEW.service_id IS NOT NULL THEN
      SELECT s.price INTO NEW.unit_price FROM public.services s WHERE s.id = NEW.service_id;
    END IF;
  END IF;
  IF NEW.total_price IS NULL AND NEW.unit_price IS NOT NULL THEN
    NEW.total_price := ROUND((NEW.unit_price * NEW.quantity)::numeric, 2);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_items_fill_prices ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_fill_prices
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.invoice_items_fill_prices();

-- complete-product writes order_id on the invoice after checkout.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS order_id integer;

-- Any other required invoice columns the backend never sends get safe defaults.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('invoices', 'invoice_items')
       AND is_nullable = 'NO'
       AND column_default IS NULL
       AND column_name NOT IN ('id', 'invoice_id', 'conversation_id', 'customer_auth_id', 'provider_auth_id', 'invoice_type')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', c.table_name, c.column_name);
  END LOOP;
END $$;

-- 2) SHOP ORDERS ---------------------------------------------------------------
-- Checkout writes to shop_orders / shop_order_items (not "orders"). The app now
-- reads those; let customers see their own orders and sellers see orders that
-- contain their products.
ALTER TABLE public.shop_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_shop_order_seller(p_order_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_order_items i
      JOIN public.products p ON p.id = i.product_id
     WHERE i.order_id = p_order_id
       AND p.stylist_auth_id::text = auth.uid()::text
  );
$$;

DROP POLICY IF EXISTS "shop_orders_select_own" ON public.shop_orders;
CREATE POLICY "shop_orders_select_own" ON public.shop_orders
  FOR SELECT TO authenticated
  USING (customer_auth_id::text = auth.uid()::text OR public.is_shop_order_seller(id));

DROP POLICY IF EXISTS "shop_order_items_select_own" ON public.shop_order_items;
CREATE POLICY "shop_order_items_select_own" ON public.shop_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shop_orders o
             WHERE o.id = shop_order_items.order_id
               AND o.customer_auth_id::text = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.products p
                WHERE p.id = shop_order_items.product_id
                  AND p.stylist_auth_id::text = auth.uid()::text)
  );

-- Products must be readable for the order item join (name / image / seller).
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (true);

COMMIT;
