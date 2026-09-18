-- Add only fields used by the existing shop/feed clients. This migration is
-- rerunnable and preserves existing rows and existing RLS policies.

-- Shop order data submitted by mobile checkout.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

CREATE INDEX IF NOT EXISTS orders_customer_payment_reference_idx
  ON public.orders (customer_auth_id, payment_reference);

-- Reviews optionally identify the purchase that produced them.
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS order_id bigint,
  ADD COLUMN IF NOT EXISTS item_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_order_id_fkey'
  ) THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_item_id_fkey'
  ) THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES public.order_items(id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS product_reviews_order_id_idx
  ON public.product_reviews (order_id);

CREATE INDEX IF NOT EXISTS product_reviews_item_id_idx
  ON public.product_reviews (item_id);

-- Keep the existing post model and distinguish short video media without
-- changing or invalidating existing photo posts.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS video_duration_seconds numeric(5,2);

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_media_type_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('photo', 'video'));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_video_duration_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_video_duration_check
  CHECK (video_duration_seconds IS NULL OR (video_duration_seconds > 0 AND video_duration_seconds <= 10));

CREATE INDEX IF NOT EXISTS posts_media_type_idx
  ON public.posts (media_type);
