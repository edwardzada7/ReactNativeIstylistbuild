-- User blocking.
--
-- Required by Apple App Store Review Guideline 1.2 and Google Play's
-- user-generated-content policy: apps with posts, comments or chat must let a
-- person block abusive users.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is safe to run more than once.
--
-- How it is used:
--   * The mobile app reads/writes this table directly with the signed-in user's
--     session, so row level security below limits every person to their OWN rows.
--   * A blocked person cannot read the table, so they are never told they were blocked.
--   * The API gateway (backend/server.py) uses the service role to refuse chat
--     messages between two people when either has blocked the other.

create table if not exists public.user_blocks (
  id bigint generated always as identity primary key,
  blocker_auth_id uuid not null references auth.users(id) on delete cascade,
  blocked_auth_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_auth_id <> blocked_auth_id),
  constraint user_blocks_unique_pair unique (blocker_auth_id, blocked_auth_id)
);

-- "Has anyone blocked this person?" lookups used by the gateway.
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_auth_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users read their own blocks" on public.user_blocks;
create policy "Users read their own blocks"
  on public.user_blocks for select
  to authenticated
  using (blocker_auth_id = auth.uid());

drop policy if exists "Users create their own blocks" on public.user_blocks;
create policy "Users create their own blocks"
  on public.user_blocks for insert
  to authenticated
  with check (blocker_auth_id = auth.uid());

drop policy if exists "Users remove their own blocks" on public.user_blocks;
create policy "Users remove their own blocks"
  on public.user_blocks for delete
  to authenticated
  using (blocker_auth_id = auth.uid());

grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
