-- Transactional finalization for customer Shop orders and Buy for My Shop.
-- Uses the existing Shop tables; apply through the Supabase SQL editor before deployment.

create or replace function public.finalize_shop_order_stock(p_order_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  item_row record;
  listing_row public.product_listings%rowtype;
  product_row public.products%rowtype;
begin
  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Shop order not found' using errcode = 'P0001';
  end if;

  if order_row.payment_status = 'verified' then
    return false;
  end if;

  for item_row in
    select * from public.order_items where order_id = p_order_id order by id
  loop
    if item_row.listing_id is not null then
      select l.* into listing_row
      from public.product_listings l
      join public.products p on p.id = l.product_id and p.approved = true
      join public.shop_sellers s on s.id = l.seller_id
        and coalesce(s.is_active, true) = true
        and lower(coalesce(s.status, 'active')) not in ('inactive', 'suspended')
      where l.id = item_row.listing_id
        and l.product_id = item_row.product_id
        and lower(coalesce(l.status, '')) = 'active'
      for update;

      if not found or coalesce(listing_row.stock, 0) < item_row.quantity then
        raise exception 'Seller listing stock changed' using errcode = 'P0001';
      end if;

      update public.product_listings
      set stock = stock - item_row.quantity
      where id = listing_row.id;
    else
      select * into product_row
      from public.products
      where id = item_row.product_id
      for update;

      if not found or coalesce(product_row.stock, 0) < item_row.quantity then
        raise exception 'Product stock changed' using errcode = 'P0001';
      end if;

      update public.products
      set stock = stock - item_row.quantity
      where id = item_row.product_id;
    end if;
  end loop;

  update public.orders
  set payment_status = 'verified', status = 'pending'
  where id = p_order_id;
  return true;
end;
$$;

grant execute on function public.finalize_shop_order_stock(bigint) to service_role;

create or replace function public.finalize_provider_purchase(
  p_purchase_order_item_id bigint,
  p_provider_auth_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.provider_purchase_order_items%rowtype;
  order_row public.provider_purchase_orders%rowtype;
  listing_row public.product_listings%rowtype;
  existing_inventory_id bigint;
begin
  select i.* into item_row
  from public.provider_purchase_order_items i
  where i.id = p_purchase_order_item_id
  for update;

  if not found then
    raise exception 'Provider purchase item not found' using errcode = 'P0001';
  end if;

  select o.* into order_row
  from public.provider_purchase_orders o
  where o.id = item_row.purchase_order_id
    and o.provider_auth_id::text = p_provider_auth_id
  for update;

  if not found then
    raise exception 'Provider purchase ownership check failed' using errcode = 'P0001';
  end if;

  select id into existing_inventory_id
  from public.provider_inventory
  where purchase_order_item_id = p_purchase_order_item_id
    and provider_auth_id::text = p_provider_auth_id
  limit 1;

  if found or order_row.payment_status = 'verified' then
    update public.provider_purchase_orders
    set status = 'completed', payment_status = 'verified'
    where id = order_row.id;
    return jsonb_build_object('inventory_created', false, 'already_finalized', true);
  end if;

  select * into listing_row
  from public.product_listings
  where id = item_row.listing_id
  for update;

  if not found
     or lower(coalesce(listing_row.status, '')) <> 'active'
     or coalesce(listing_row.stock, 0) < item_row.quantity then
    raise exception 'Source listing stock changed' using errcode = 'P0001';
  end if;

  update public.product_listings
  set stock = stock - item_row.quantity
  where id = listing_row.id;

  insert into public.provider_inventory (
    provider_auth_id,
    product_id,
    source_listing_id,
    quantity,
    reserved_quantity,
    purchase_order_item_id
  ) values (
    p_provider_auth_id::uuid,
    item_row.product_id,
    item_row.listing_id,
    item_row.quantity,
    0,
    p_purchase_order_item_id
  );

  update public.provider_purchase_orders
  set status = 'completed', payment_status = 'verified'
  where id = order_row.id;

  return jsonb_build_object('inventory_created', true, 'already_finalized', false);
end;
$$;

grant execute on function public.finalize_provider_purchase(bigint, text) to service_role;
