import apiService from './api';
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
  p?.profile_image_url || p?.avatar_url || p?.avatarUrl || p?.profileImage || p?.profile_image || null;

const isPlaceholderName = (name?: string | null) =>
  !name || ['customer', 'user', 'anonymous', 'provider'].includes(String(name).trim().toLowerCase());

/** Looks up a person's display name / photo by Supabase auth id (cached per session). */
function getByAuthId(authId?: string | null): Promise<PersonSummary | null> {
  const key = String(authId ?? '').trim();
  if (!key) return Promise.resolve(null);
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const stylist = await apiService.get<any>(`/stylists/by-auth/${key}`).catch(() => null);
        const user = await apiService.get<any>(`/users/by-auth/${key}`).catch(() => null);
        if (!stylist && !user) return null;
        return { name: displayName(stylist) || displayName(user), avatar: avatarOf(stylist) || avatarOf(user) };
      })()
    );
  }
  return cache.get(key)!;
}

/** The provider's Supabase auth id from its numeric user id (stylists PK). */
async function getProviderAuthId(userId?: string | number | null): Promise<string | null> {
  const id = String(userId ?? '').trim();
  if (!/^\d+$/.test(id)) return id || null;
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

export const peopleService = { getByAuthId, getProviderAuthId, enrichBookingCustomers, isPlaceholderName };
