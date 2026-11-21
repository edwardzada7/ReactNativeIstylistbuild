import { supabase } from '../lib/supabase';

/**
 * Uploads photos/videos to Supabase Storage (bucket `media`, see phase30 SQL) and returns the
 * public URL. Rows then store a short URL instead of a multi-megabyte base64 string, which is
 * what made the feed and shop slow to load.
 */
const BUCKET = 'media';
export const MAX_PHOTOS = 5;
const isRemote = (u: string) => /^https?:\/\//i.test(u);

export const mediaService = {
  isRemote,

  /** Uploads one local file (file:// or content:// URI). Remote URLs are returned unchanged. */
  async upload(uri: string, ownerAuthId: string, folder: 'posts' | 'products', kind: 'image' | 'video' = 'image'): Promise<string> {
    if (isRemote(uri)) return uri;
    const ext = kind === 'video' ? 'mp4' : 'jpg';
    const contentType = kind === 'video' ? 'video/mp4' : 'image/jpeg';
    const path = `${ownerAuthId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = await (await fetch(uri)).arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message || 'Upload failed');
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },

  async uploadMany(uris: string[], ownerAuthId: string, folder: 'posts' | 'products'): Promise<string[]> {
    return Promise.all(uris.map((u) => mediaService.upload(u, ownerAuthId, folder, 'image')));
  },
};
