-- Chat Schema Enhancements: Indexes, Content Type, and Extended Message Metadata
-- This migration adds performance optimizations and support for extended message types
-- (TEXT, IMAGE, LOCATION, CUSTOM_INVOICE, SYSTEM_ALERT)

-- ============================================================================
-- 1. ALTER MESSAGE TABLE TO SUPPORT EXTENDED FIELDS AND TYPES
-- ============================================================================

-- Change message content field from VARCHAR to TEXT to support unlimited length
alter table if exists public.chats 
  alter column message set data type text;

-- Add new columns for extended message support
alter table if exists public.chats add column if not exists is_masked boolean default false;
alter table if exists public.chats add column if not exists original_content text;
alter table if exists public.chats add column if not exists message_type varchar(50) default 'TEXT' 
  check (message_type in ('TEXT', 'IMAGE', 'LOCATION', 'CUSTOM_INVOICE', 'SYSTEM_ALERT'));
alter table if exists public.chats add column if not exists location_data jsonb;
alter table if exists public.chats add column if not exists invoice_data jsonb;
alter table if exists public.chats add column if not exists is_read boolean default false;
alter table if exists public.chats add column if not exists read_at timestamptz;

-- Keep the legacy read column and the explicit receipt fields consistent for
-- rows created by older clients.
update public.chats
set is_read = coalesce(is_read, read, false)
where is_read is null;

-- ============================================================================
-- 2. CREATE PERFORMANCE INDEXES ON MESSAGE TABLE
-- ============================================================================

-- Index for fast conversation lookup and sorting by creation date
create index if not exists chats_booking_id_created_at_idx
  on public.chats (booking_id, created_at desc);

-- Index for fast sender lookup (important for filtering sender messages)
create index if not exists chats_sender_auth_id_idx
  on public.chats (sender_auth_id);

-- Index for fast receiver lookup (for unread count queries)
create index if not exists chats_receiver_auth_id_read_idx
  on public.chats (receiver_auth_id, read);

-- Composite index for optimizing "get unread messages for receiver in booking"
create index if not exists chats_receiver_booking_read_idx
  on public.chats (receiver_auth_id, booking_id, read);

-- Index for message creation time (useful for pagination and sorting)
create index if not exists chats_created_at_idx
  on public.chats (created_at desc);

create index if not exists chats_booking_is_read_idx
  on public.chats (booking_id, is_read);

create index if not exists chats_receiver_is_read_idx
  on public.chats (receiver_auth_id, is_read);

-- ============================================================================
-- 3. CREATE PERFORMANCE INDEXES ON CONVERSATION TABLE (if exists)
-- ============================================================================

-- If bookings table exists and is used for conversations, add indexes for chat queries
create index if not exists bookings_customer_auth_id_status_idx
  on public.bookings (customer_auth_id, status);

create index if not exists bookings_provider_auth_id_status_idx
  on public.bookings (provider_auth_id, status);

-- ============================================================================
-- 4. ADD FUNCTION FOR ANTI-LEAK MESSAGE SANITIZATION
-- ============================================================================

-- Create enum for message status
do $$ 
begin
  if not exists (select 1 from pg_type where typname = 'message_status') then
    create type public.message_status as enum ('pending', 'sent', 'delivered', 'read');
  end if;
end
$$;

-- Create function to check if message contains sensitive contact info (Nigerian patterns)
-- This function is called before message insertion to detect and mask sensitive data
create or replace function public.detect_sensitive_content(content text)
returns boolean as $$
begin
  -- Nigerian phone number patterns (080, 081, 090, 070, 091, +234, 234)
  if content ~* '\b(080|081|090|070|091)\d{7}\b' then
    return true;
  end if;
  
  -- Nigerian phone with spaces or +234 prefix
  if content ~* '\+234[0-9\s]{9,}' or content ~* '234[0-9\s]{9,}' then
    return true;
  end if;
  
  -- NUBAN bank account numbers (10 consecutive digits)
  if content ~* '\b\d{10}\b' then
    return true;
  end if;
  
  -- Nigerian bank names
  if content ~* '\b(OPay|Palmpay|Kuda|GTB|Access|Zenith|UBA|First Bank|Sterling)\b' then
    return true;
  end if;
  
  -- External payment keywords
  if content ~* '\b(WhatsApp|call me|pay directly|pay cash|Instagram|Telegram)\b' then
    return true;
  end if;
  
  -- Email-like patterns or domains
  if content ~* '[\w.-]+@[\w.-]+\.\w+' then
    return true;
  end if;
  
  -- @ mentions or .com patterns
  if content ~* '@[\w.-]+' or content ~* '\.\w{2,}' then
    return true;
  end if;
  
  return false;
end;
$$ language plpgsql immutable;

-- ============================================================================
-- 5. COLUMN COMMENTS FOR DOCUMENTATION
-- ============================================================================

comment on column public.chats.is_masked is 'Flag indicating if message content was automatically masked due to sensitive contact information';

comment on column public.chats.original_content is 'Original message content before masking (if is_masked = true)';

comment on column public.chats.message_type is 'Type of message: TEXT, IMAGE, LOCATION, CUSTOM_INVOICE, or SYSTEM_ALERT';

comment on column public.chats.location_data is 'JSON object for LOCATION type messages: {latitude: float, longitude: float, addressName: string}';

comment on column public.chats.invoice_data is 'JSON object for CUSTOM_INVOICE type messages: {amount: decimal, serviceDetails: string, platformFee: decimal, netPayout: decimal, status: string}';

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on function public.detect_sensitive_content(text) to postgres, service_role;

-- ============================================================================
-- Notes:
-- - Message content is now TEXT type, supporting unlimited length
-- - Indexes are optimized for common chat queries: lookup by booking, sender, receiver
-- - New JSON columns support location and invoice metadata
-- - Anti-leak detection function available for backend integration
-- - All indexes use IF NOT EXISTS to prevent errors on re-running migration
-- ============================================================================
