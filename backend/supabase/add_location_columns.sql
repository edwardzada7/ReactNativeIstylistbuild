-- Guarded location migration for the current location/profile phase.
-- Only adds the columns when they are missing, and does not drop or rename anything.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_address text;

ALTER TABLE public.stylists
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_address text;
