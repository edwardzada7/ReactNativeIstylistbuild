-- Guarded migration for profile-images storage bucket, RLS policies, and table columns
-- This migration:
-- 1. Creates the bucket if it doesn't exist
-- 2. Adds profile_image_url columns to users and stylists tables
-- 3. Creates proper Storage RLS policies for authenticated users
-- It supports both providers/<auth_id>/ and customers/<auth_id>/ paths

-- ============================================================================
-- PART 1: Add profile_image_url columns to users and stylists tables
-- ============================================================================

-- Add profile_image_url column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Add profile_image_url column to stylists table
ALTER TABLE stylists
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- ============================================================================
-- PART 2: Create the profile-images bucket if it doesn't exist
-- ============================================================================
-- Note: bucket creation may require admin privileges; this may need to be run manually via Supabase dashboard
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('profile-images', 'profile-images', true, 2097152, ARRAY['image/jpeg', 'image/jpg', 'image/png'])
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Bucket creation failed (may require manual creation via Supabase dashboard): %', SQLERRM;
END $$;

-- ============================================================================
-- PART 3: Enable RLS on storage.objects (if not already enabled)
-- ============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: Drop existing policies if they exist (to ensure clean state)
-- ============================================================================
DROP POLICY IF EXISTS "profile_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_delete_authenticated" ON storage.objects;

-- ============================================================================
-- PART 5: Create new Storage RLS policies
-- ============================================================================

-- Policy: Allow public SELECT on profile-images bucket
-- This allows anyone to view profile images via getPublicUrl()
CREATE POLICY "profile_images_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-images');

-- Policy: Allow authenticated users to INSERT their own profile images
-- Users can only upload to their own folder: providers/<auth.uid()>/ or customers/<auth.uid()>/
CREATE POLICY "profile_images_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (
      -- Provider path: providers/<auth_id>/filename
      (name ~ '^providers/' || auth.uid()::text || '/')
      OR
      -- Customer path: customers/<auth_id>/filename
      (name ~ '^customers/' || auth.uid()::text || '/')
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
      (name ~ '^providers/' || auth.uid()::text || '/')
      OR
      -- Customer path: customers/<auth_id>/filename
      (name ~ '^customers/' || auth.uid()::text || '/')
    )
  )
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (
      -- Provider path: providers/<auth_id>/filename
      (name ~ '^providers/' || auth.uid()::text || '/')
      OR
      -- Customer path: customers/<auth_id>/filename
      (name ~ '^customers/' || auth.uid()::text || '/')
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
      (name ~ '^providers/' || auth.uid()::text || '/')
      OR
      -- Customer path: customers/<auth_id>/filename
      (name ~ '^customers/' || auth.uid()::text || '/')
    )
  );

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
