-- ============================================================================
-- Add account_type column to users table for Individual/Business selection
-- ============================================================================
-- This migration adds support for providers to select their account type:
-- - 'individual': Single provider account
-- - 'business': Multi-staff eligible account (future feature)
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'individual' CHECK (account_type IN ('individual', 'business'));

ALTER TABLE public.stylists
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'individual' CHECK (account_type IN ('individual', 'business'));

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS users_account_type_idx ON public.users(account_type);
CREATE INDEX IF NOT EXISTS stylists_account_type_idx ON public.stylists(account_type);

-- ============================================================================
-- Rollback notes (if needed):
--   ALTER TABLE public.users DROP COLUMN IF EXISTS account_type;
--   ALTER TABLE public.stylists DROP COLUMN IF EXISTS account_type;
--   DROP INDEX IF EXISTS users_account_type_idx;
--   DROP INDEX IF EXISTS stylists_account_type_idx;
-- ============================================================================
