import apiService from './api';
import { supabase } from '../lib/supabase';
import { Booking } from '../types';

export interface PersonSummary {
  name?: string;
  avatar?: string | null;
}

const cache = new Map<string, Promise<PersonSummary | null>>();

const displayName = (p: any): string | undefined => {
  if (!p) return undefined;
  const full = [p.first_name || p.firstName, p.last_name || p.lastName].filter(Boolean).join(' ').trim();
  return p.business_name || p.businessName || p.name || p.user_name || p.full_name || full || undefined;
};

const avatarOf = (p: any): string | null =>
  p?.profile_image_url || p?.provider_image_url || p?.avatar_url || p?.avatarUrl || p?.profileImage || p?.profile_image || p?.photo_url || null;

const isPlaceholderName = (name?: string | null) =>
  !name || ['customer', 'user', 'anonymous', 'provider', 'stylist'].includes(String(name).trim().toLowerCase());

// ---- Stylist directory (photos live in stylists.profile_image_url) ----------
type StylistRow = { user_id: number; auth_id: string; profile_image_url: string | null; business_name: string | null };
let directory: Promise<Map<string, StylistRow>> | null = null;
let directoryAt = 0;
const DIRECTORY_TTL = 5 * 60_000;

function getStylistDirectory(): Promise<Map<string, StylistRow>> {
  if (!directory || Date.now() - directoryAt > DIRECTORY_TTL) {
    directoryAt = Date.now();
    directory = (async () => {
      const map = new Map<string, StylistRow>();
      const { data } = await supabase.from('stylists').select('user_id,auth_id,profile_image_url,business_name');
      (data || []).forEach((row: any) => {
        if (row.user_id != null) map.set(String(row.user_id), row);
        if (row.auth_id) map.set(String(row.auth_id), row);
      });
      return map;
    })().catch(() => new Map());
  }
  return directory;
}

/** Call after any profile photo / name change so every avatar refreshes. */
function invalidate(authId?: string | null) {
  directory = null;
  if (authId) cache.delete(String(authId));
  else cache.clear();
}

/** Fills provider avatar + business name from the stylist directory. */
async function withProviderAvatars<T extends Record<string, any>>(list: T[], key: (p: T) => any = (p) => p.id): Promise<T[]> {
  const dir = await getStylistDirectory();
  return list.map((p) => {
    const row = dir.get(String(key(p) ?? '')) || (p.user_id ? dir.get(String(p.user_id)) : undefined);
    if (!row) return p;
    const avatar = row.profile_image_url || p.avatarUrl || p.profile_image_url || p.avatar;
    return {
      ...p,
      ...(avatar ? { avatarUrl: avatar, profile_image_url: avatar, profileImage: avatar, avatar } : {}),
      ...(row.auth_id && (!p.user_id || /^\d+$/.test(String(p.user_id))) ? { user_id: row.auth_id } : {}),
    };
  });
}

/** Looks up a person's display name / photo by Supabase auth id (cached per session). */
function getByAuthId(authId?: string | null): Promise<PersonSummary | null> {
  const key = String(authId ?? '').trim();
  if (!key) return Promise.resolve(null);
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const dir = await getStylistDirectory();
        const row = dir.get(key);
        // Fast path: stylist directory (one cached query) already has name + photo.
        if (row?.business_name && row?.profile_image_url) {
          return { name: row.business_name, avatar: row.profile_image_url };
        }
        const [publicProfile, user] = await Promise.all([
          supabase.from('public_profiles').select('*').eq('auth_id', key).maybeSingle().then((r) => r.data, () => null),
          apiService.get<any>(`/users/by-auth/${key}`).catch(() => null),
        ]);
        if (!row && !user && !publicProfile) return null;
        return {
          name: row?.business_name || publicProfile?.business_name || displayName(user) || publicProfile?.name,
          avatar: row?.profile_image_url || avatarOf(publicProfile) || avatarOf(user),
        };
      })()
    );
  }
  return cache.get(key)!;
}

/** The provider's Supabase auth id from its numeric user id (stylists PK). */
async function getProviderAuthId(userId?: string | number | null): Promise<string | null> {
  const id = String(userId ?? '').trim();
  if (!/^\d+$/.test(id)) return id || null;
  const row = (await getStylistDirectory()).get(id);
  if (row?.auth_id) return row.auth_id;
  const stylist = await apiService.get<any>(`/stylists/${id}`).catch(() => null);
  return stylist?.auth_id || stylist?.users?.auth_id || null;
}

/** Replaces backend "Customer" fallbacks with the customer's real name/photo. */
async function enrichBookingCustomers(list: Booking[]): Promise<Booking[]> {
  return Promise.all(
    list.map(async (b) => {
      if (!isPlaceholderName(b.customer_name) && b.customer_profile_image_url) return b;
      const person = await getByAuthId(b.customer_auth_id);
      if (!person) return b;
      return {
        ...b,
        customer_name: isPlaceholderName(b.customer_name) ? person.name || b.customer_name : b.customer_name,
        customer_profile_image_url: b.customer_profile_image_url || person.avatar,
      };
    })
  );
}

/** Fills provider name/photo on customer bookings. */
async function enrichBookingProviders(list: Booking[]): Promise<Booking[]> {
  return Promise.all(
    list.map(async (b) => {
      const authId = b.provider_auth_id || (/^\d+$/.test(String(b.provider_id)) ? null : b.provider_id);
      const person = await getByAuthId(authId || (await getProviderAuthId(b.provider_id)));
      if (!person) return b;
      return {
        ...b,
        provider_name: isPlaceholderName(b.provider_name) ? person.name || b.provider_name : b.provider_name,
        provider_avatar: b.provider_avatar || person.avatar || undefined,
      };
    })
  );
}

export const peopleService = {
  getByAuthId,
  getProviderAuthId,
  enrichBookingCustomers,
  enrichBookingProviders,
  withProviderAvatars,
  invalidate,
  isPlaceholderName,
};
