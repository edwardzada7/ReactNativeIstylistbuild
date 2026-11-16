-- iStylist migration #5: order notifications.
-- Safe to run more than once. Run in Supabase Dashboard -> SQL Editor.
-- Customers get an in-app notification when they place an order and every time
-- its status changes; sellers get one when an order with their product comes in.
-- Notifications never block checkout: any insert error is swallowed.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_safe(p_auth_id text, p_title text, p_message text, p_meta jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_auth_id IS NULL THEN RETURN; END IF;
  BEGIN
    INSERT INTO public.notifications (auth_id, type, title, message, read, metadata, created_at)
    VALUES (p_auth_id, 'order', p_title, p_message, false, p_meta, now());
  EXCEPTION WHEN others THEN
    -- e.g. a CHECK on notifications.type: retry with a generic type
    BEGIN
      INSERT INTO public.notifications (auth_id, type, title, message, read, metadata, created_at)
      VALUES (p_auth_id, 'system', p_title, p_message, false, p_meta, now());
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.order_status_label(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(p_status, ''))
    WHEN 'pending'    THEN 'is pending'
    WHEN 'paid'       THEN 'has been paid'
    WHEN 'confirmed'  THEN 'has been accepted'
    WHEN 'processing' THEN 'is being processed'
    WHEN 'shipped'    THEN 'is ready / on its way'
    WHEN 'delivered'  THEN 'has been delivered'
    WHEN 'canceled'   THEN 'was cancelled'
    WHEN 'cancelled'  THEN 'was cancelled'
    WHEN 'returned'   THEN 'was returned'
    ELSE 'was updated to ' || coalesce(p_status, 'a new status')
  END;
$$;

-- Customer: order placed + status changes
CREATE OR REPLACE FUNCTION public.shop_orders_notify_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_safe(NEW.customer_auth_id::text, 'Order placed',
      'Your order #' || NEW.id || ' has been received.',
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_safe(NEW.customer_auth_id::text, 'Order update',
      'Your order #' || NEW.id || ' ' || public.order_status_label(NEW.status) || '.',
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_shop_orders_notify_customer ON public.shop_orders;
CREATE TRIGGER trg_shop_orders_notify_customer
  AFTER INSERT OR UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.shop_orders_notify_customer();

-- Seller: new order containing their product (once per order per seller)
CREATE OR REPLACE FUNCTION public.shop_order_items_notify_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seller text; v_product text;
BEGIN
  SELECT p.stylist_auth_id::text, p.name INTO v_seller, v_product FROM public.products p WHERE p.id = NEW.product_id;
  IF v_seller IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications n
              WHERE n.auth_id::text = v_seller
                AND n.metadata ->> 'order_id' = NEW.order_id::text
                AND n.title = 'New order') THEN
    RETURN NULL;
  END IF;
  PERFORM public.notify_safe(v_seller, 'New order',
    'You have a new order #' || NEW.order_id || ' for ' || coalesce(v_product, 'your product') || '.',
    jsonb_build_object('order_id', NEW.order_id, 'role', 'seller'));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_shop_order_items_notify_seller ON public.shop_order_items;
CREATE TRIGGER trg_shop_order_items_notify_seller
  AFTER INSERT ON public.shop_order_items
  FOR EACH ROW EXECUTE FUNCTION public.shop_order_items_notify_seller();

COMMIT;
