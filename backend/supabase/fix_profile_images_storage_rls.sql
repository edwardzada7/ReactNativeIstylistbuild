-- ============================================================================
-- Guarded migration to fix profile-images Storage RLS
-- ============================================================================
-- This migration fixes the "new row violates row-level security policy" error
-- when uploading profile images.
--
-- Problem analysis:
-- - Frontend uploads to: providers/<auth_id>/profile.jpg or customers/<auth_id>/profile.jpg
-- - Previous migration used regex matching which may be fragile
-- - Need robust path matching using exact comparison or storage.foldername()
--
-- This migration:
-- 1. Ensures profile-images bucket exists (public)
-- 2. Adds profile_image_url columns if missing
-- 3. Drops old policies (if any)
-- 4. Creates new robust RLS policies using exact path matching
-- 5. Supports upsert: true (SELECT + INSERT + UPDATE + DELETE)
-- ============================================================================

-- ============================================================================
-- PART 1: Add profile_image_url columns to users and stylists tables
-- ============================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

ALTER TABLE public.stylists
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- ============================================================================
-- PART 2: Ensure profile-images bucket exists (public for getPublicUrl support)
-- ============================================================================
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('profile-images', 'profile-images', true, 2097152, ARRAY['image/jpeg', 'image/jpg', 'image/png'])
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png'];
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Bucket creation/update failed (may require manual creation via Supabase dashboard): %', SQLERRM;
END $$;

-- ============================================================================
-- PART 3: Enable RLS on storage.objects
-- ============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: Drop any existing profile-images policies to ensure clean state
-- ============================================================================
DROP POLICY IF EXISTS "profile_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_delete_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_select_authenticated" ON storage.objects;

-- ============================================================================
-- PART 5: Create new robust Storage RLS policies
-- ============================================================================

-- Policy: Allow public SELECT on profile-images bucket
-- This allows anyone to view profile images via getPublicUrl()
CREATE POLICY "profile_images_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-images');

-- Policy: Allow authenticated users to INSERT their own profile images
-- Uses exact path matching for robustness: providers/<auth.uid()>/filename or customers/<auth.uid()>/filename
CREATE POLICY "profile_images_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (
      -- Provider path: providers/<auth_id>/filename
      (storage.foldername(name) = 'providers/' || auth.uid()::text)
      OR
      -- Customer path: customers/<auth_id>/filename
      (storage.foldername(name) = 'customers/' || auth.uid()::text)
    )
  );

-- Policy: Allow authenticated users to UPDATE their own profile images
-- Supports upsert: true by allowing UPDATE on their own folder
CREATE POLICY "profile_images_update_authenticated"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (
      -- Provider path: providers/<auth_id>/filename
      (storage.foldername(name) = 'providers/' || auth.uid()::text)
      OR
      -- Customer path: customers/<auth_id>/filename
      (storage.foldername(name) = 'customers/' || auth.uid()::text)
    )
  )
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (
      -- Provider path: providers/<auth_id>/filename
      (storage.foldername(name) = 'providers/' || auth.uid()::text)
      OR
      -- Customer path: customers/<auth_id>/filename
      (storage.foldername(name) = 'customers/' || auth.uid()::text)
    )
  );

-- Policy: Allow authenticated users to DELETE their own profile images
CREATE POLICY "profile_images_delete_authenticated"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-images'
    AND (
      -- Provider path: providers/<auth_id>/filename
      (storage.foldername(name) = 'providers/' || auth.uid()::text)
      OR
      -- Customer path: customers/<auth_id>/filename
      (storage.foldername(name) = 'customers/' || auth.uid()::text)
    )
  );

-- ============================================================================
-- PART 6: Verification query (run manually to verify policies)
-- ============================================================================
-- SELECT * FROM storage.policies WHERE bucket_id = 'profile-images';
-- SELECT * FROM storage.buckets WHERE id = 'profile-images';

-- ============================================================================
-- Rollback notes (if needed):
--   ALTER TABLE users DROP COLUMN IF EXISTS profile_image_url;
--   ALTER TABLE stylists DROP COLUMN IF EXISTS profile_image_url;
--   DROP POLICY IF EXISTS "profile_images_select_public" ON storage.objects;
--   DROP POLICY IF EXISTS "profile_images_insert_authenticated" ON storage.objects;
--   DROP POLICY IF EXISTS "profile_images_update_authenticated" ON storage.objects;
--   DROP POLICY IF EXISTS "profile_images_delete_authenticated" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'profile-images';
-- ============================================================================
