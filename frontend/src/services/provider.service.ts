import apiService from './api';
import { supabase } from '../lib/supabase';
import { peopleService } from './people.service';
import {
  Provider,
  Category,
  Service,
  Review,
  ProviderAvailability,
  CatalogSubService,
  DayAvailability,
  StaffMember,
} from '../types';
import {
  normalizeProvider,
  normalizeService,
  normalizeReview,
  deriveCategories,
} from '../utils/normalize';
import { getAllSubServicesCatalog } from '../constants/serviceCatalog';
import { normalizeSlots, normalizeTime, normalizeTimeOr, validateTimeRange } from '../utils/time';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  // `reviews` covers GET /providers/{auth_id}/reviews, whose real shape is
  // { reviews: [...], avg_rating, total_reviews } - NOT a bare array. This
  // was previously missing here, so provider reviews always normalized to
  // an empty list even when the API had real data (falls through to the
  // final `[]` fallback since none of the other keys exist on that shape).
  return raw?.data || raw?.providers || raw?.services || raw?.categories || raw?.reviews || raw?.results || [];
};

// The availability API only accepts day_of_week 0-6 ("Input should be less than
// or equal to 6"), i.e. JavaScript's getDay() convention: Sunday=0, Monday=1 ...
// Saturday=6. Sunday used to be sent as 7, which made every save that had
// Sunday switched on fail. Older rows may still carry 7 for Sunday, so reads
// accept both (see SUNDAY_ALIASES).
const DAY_NAME_TO_NUMBER: Record<DayAvailability['day'], number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
const SUNDAY_ALIASES = [0, 7];
const ALL_DAY_NAMES: DayAvailability['day'][] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Provider routes (availability, slots, staff) need the numeric user id. Links from
// bookings, rebook buttons and notifications can carry the auth UUID instead.
const numericProviderIdCache = new Map<string, string>();
async function toNumericProviderId(providerId: string): Promise<string> {
  const raw = String(providerId ?? '').trim();
  if (/^\d+$/.test(raw)) return raw;
  const cached = numericProviderIdCache.get(raw);
  if (cached) return cached;
  const stylist = await apiService.get<any>(`/stylists/by-auth/${encodeURIComponent(raw)}`);
  const resolved = String(stylist?.user_id ?? '');
  if (!/^\d+$/.test(resolved)) throw Object.assign(new Error('Provider not found'), { friendlyMessage: 'Provider not found.' });
  numericProviderIdCache.set(raw, resolved);
  return resolved;
}

export const providerService = {
  // Browse providers with their services embedded (Home + Search use this).
  async getProvidersWithServices(coords?: { lat: number; lng: number } | null): Promise<Provider[]> {
    const query = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
    const [raw] = await Promise.all([
      apiService.get<any>(`/providers/with-services${query}`),
      peopleService.warmDirectory(), // fetch the photo directory in parallel, not after
    ]);
    const rawList = asList(raw);
    // Newer servers send rating + review_count in this response, so no per-provider /reviews calls are needed.
    const serverRated = rawList.length > 0 && rawList[0]?.review_count !== undefined;
    const list = rawList.map((item: any) => ({ ...normalizeProvider(item), ...(serverRated ? { _ratingsLoaded: true } : {}) }));
    return peopleService.withProviderAvatars(list as any);
  },

  // Full provider profile: bio, services, ratings, portfolio.
  async getProviderFullProfile(providerId: string): Promise<Provider> {
    // full-profile expects the provider's numeric user id. Some links (feed,
    // notifications, recommendations) carry the provider's auth UUID instead,
    // which the backend rejects with "Input should be a valid integer".
    let numericId = String(providerId ?? '').trim();
    if (!/^\d+$/.test(numericId)) {
      const stylist = await apiService.get<any>(`/stylists/by-auth/${encodeURIComponent(numericId)}`);
      numericId = String(stylist?.user_id ?? '');
      if (!/^\d+$/.test(numericId)) throw Object.assign(new Error('Provider not found'), { friendlyMessage: 'Provider not found.' });
    }
    const raw = await apiService.get<any>(`/providers/${numericId}/full-profile`);
    const [withAvatar] = await peopleService.withProviderAvatars([normalizeProvider(raw)], () => numericId);
    // Don't let the rating lookup hold the screen: wait at most 1.2s, it's cached for next time.
    const [withRating] = await Promise.race([
      peopleService.withProviderRatings([withAvatar]).catch(() => [withAvatar]),
      new Promise<Provider[]>((resolve) => setTimeout(() => resolve([withAvatar]), 1200)),
    ]);
    return withRating;
  },

  async getConsultationEligibility(providerAuthId: string): Promise<NonNullable<Provider['consultation']>> {
    return apiService.get(`/providers/${providerAuthId}/consultation-eligibility`);
  },

  async getConsultationSettings(providerAuthId: string): Promise<{
    enabled: boolean;
    consultation_fee?: number | null;
    description?: string | null;
    currency?: string;
    eligible: boolean;
    specialty?: string | null;
  }> {
    return apiService.get(`/providers/${providerAuthId}/consultation-settings`);
  },

  async updateConsultationSettings(providerAuthId: string, data: {
    enabled: boolean;
    consultation_fee?: number;
    description?: string;
    currency?: string;
  }) {
    return apiService.patch(`/providers/${providerAuthId}/consultation-settings`, data);
  },

  async getCertification(providerAuthId: string) {
    return apiService.get<{ status: string; certification: any | null }>(`/providers/${providerAuthId}/certification`);
  },

  async submitCertification(providerAuthId: string, data: {
    specialty: string;
    certification_name: string;
    certificate_url: string;
    expiry_date?: string;
  }) {
    return apiService.post(`/providers/${providerAuthId}/certification`, data);
  },

  // Services offered by one specific provider.
  async getProviderServices(providerId: string): Promise<Service[]> {
    const raw = await apiService.get<any>(`/provider-services/${providerId}`);
    return asList(raw).map(normalizeService);
  },

  // Real Manage Staff contract: public provider staff list is served at
  // `/providers/{provider_id}/staff` and includes active/inactive rows.
  async getProviderStaff(providerId: string, activeOnly = true): Promise<StaffMember[]> {
    const numericId = await toNumericProviderId(providerId);
    const raw = await apiService.get<any>(`/providers/${numericId}/staff`, {
      params: { active_only: activeOnly },
    });
    const list = Array.isArray(raw?.staff) ? raw.staff : asList(raw);
    return list.map((item: any) => ({
      ...item,
      id: String(item.id),
      is_active: !!item.is_active,
      service_ids: Array.isArray(item.service_ids) ? item.service_ids.map(Number) : [],
      weekly: Array.isArray(item.weekly) ? item.weekly : [],
    }));
  },

  // GROUND TRUTH (Phase 6.4 - verified against production web app source,
  // frontend/src/screens/ProviderServicesScreen.jsx): the web app's
  // "Add Service" picker does NOT call any /catalog/* API endpoint at all
  // - it imports a static SERVICE_CATALOG constant. Mirrored exactly here
  // (src/constants/serviceCatalog.ts) instead of relying on a live API
  // call, which is what caused the empty "Select from list" picker.
  async getCatalogSubServices(): Promise<CatalogSubService[]> {
    return getAllSubServicesCatalog();
  },

  async getCategories(): Promise<Category[]> {
    try {
      const raw = await apiService.get<any>('/categories');
      const categories = asList(raw);
      if (categories.length > 0) {
        return categories.map((category: any) => ({
          id: String(category.id ?? category.slug ?? category.name),
          name: category.name ?? category.title ?? category.label ?? 'Category',
          icon: category.icon ?? category.icon_name ?? 'sparkles',
          description: category.description,
          provider_count: category.provider_count ?? category.providers_count,
        }));
      }
    } catch (err) {
      console.warn('[provider-service] global categories unavailable, using catalog fallback', err);
    }
    return deriveCategories(await this.getCatalogSubServices());
  },

  // Resolves a provider's Supabase auth UUID from their numeric provider_id.
  // Verified via direct API probe: `/providers/{id}/reviews` requires the
  // provider's UUID in the path (passing the numeric id throws a Postgres
  // "invalid input syntax for type uuid" error). The UUID isn't exposed on
  // /full-profile or /with-services, but it IS embedded in the availability
  // response's `weekly`/`rules` rows. Best-effort: if a provider has no
  // availability configured yet this can't resolve, and callers fall back
  // to an empty reviews list instead of crashing/erroring.
  async resolveProviderAuthId(providerId: string): Promise<string | null> {
    try {
      const raw = await apiService.get<any>(`/providers/${providerId}/availability`);
      return (
        raw?.weekly?.[0]?.provider_id ||
        raw?.rules?.provider_id ||
        raw?.exceptions?.[0]?.provider_id ||
        null
      );
    } catch {
      return null;
    }
  },

  async getProviderReviews(providerId: string): Promise<Review[]> {
    try {
      const authId = await this.resolveProviderAuthId(providerId);
      const raw = await apiService.get<any>(`/providers/${authId || providerId}/reviews`);
      return asList(raw).map(normalizeReview);
    } catch (err) {
      console.error('[provider-service] failed to load reviews', err);
      return [];
    }
  },

  // Real contract (verified via direct API probe): both `date` (YYYY-MM-DD)
  // and `service_duration` (minutes) are REQUIRED query params - the
  // endpoint returns a 422 otherwise. Both used to be optional/missing here,
  // which meant this call always failed silently and availability never
  // showed up for customers.
  async getAvailableSlots(
    providerId: string,
    date: string,
    durationMinutes: number
  ): Promise<string[]> {
    const numericId = await toNumericProviderId(providerId);
    const raw = await apiService.get<any>(`/providers/${numericId}/available-slots`, {
      params: { date, service_duration: durationMinutes },
    });
    // Accepts string[] as well as { slots | available_slots | times | data } and
    // { time, available } entries, and returns clean "HH:MM" values.
    return normalizeSlots(raw);
  },

  // Real contract (verified via direct API probe): GET returns
  // { weekly: [{ day_of_week: 1-7 (Mon-Sun), start_time, end_time, is_active }],
  //   exceptions: [{ date, is_unavailable, start_time, end_time, note }],
  //   rules: {...} } - not the { days, blocked_dates } shape this used to assume.
  async getProviderAvailability(providerId: string): Promise<ProviderAvailability | null> {
    try {
      const numericId = await toNumericProviderId(providerId);
      const raw = await apiService.get<any>(`/providers/${numericId}/availability`);
      if (!raw) return null;
      const weekly = Array.isArray(raw.weekly) ? raw.weekly : [];
      const byDayNumber = new Map<number, any>(weekly.map((w: any) => [Number(w.day_of_week), w]));
      const days: DayAvailability[] = ALL_DAY_NAMES.map((dayName) => {
        const dayNumber = DAY_NAME_TO_NUMBER[dayName];
        const entry =
          dayName === 'sunday'
            ? SUNDAY_ALIASES.map((n) => byDayNumber.get(n)).find(Boolean)
            : byDayNumber.get(dayNumber);
        return {
          day: dayName,
          // A stored row with is_active=false means the day is switched off.
          is_open: !!entry && entry.is_active !== false,
          open_time: normalizeTimeOr(entry?.start_time, '09:00'),
          close_time: normalizeTimeOr(entry?.end_time, '18:00'),
        };
      });
      const exceptions = Array.isArray(raw.exceptions) ? raw.exceptions : [];
      const blocked_dates = exceptions
        .filter((e: any) => e.is_unavailable)
        .map((e: any) => e.date);
      return { days, blocked_dates };
    } catch {
      return null;
    }
  },

  // Real contract (verified via direct API probe): POST body must be
  // { weekly: [{ day_of_week: 1-7, start_time, end_time, is_active }] } -
  // the previous { availability, blocked_dates } shape returned a 422
  // (missing required `weekly`), and since that 422's `detail` is an array,
  // it crashed the app before the api.ts interceptor fix (see api.ts).
  // NOTE: blocked dates map to a separate `exceptions` resource that isn't
  // documented for writes, so they're read-only here for now (shown from
  // GET, not persisted on Save) rather than guessing an unconfirmed contract.
  async setProviderAvailability(
    providerId: string,
    availability: ProviderAvailability
  ): Promise<void> {
    // Validate and normalize every open day to strict 24h "HH:MM" first, so a
    // typo is reported here (naming the day) rather than as a server error.
    const weekly = availability.days
      .filter((d) => d.is_open)
      .map((d) => {
        const label = d.day.charAt(0).toUpperCase() + d.day.slice(1);
        const problem = validateTimeRange(label, d.open_time, d.close_time);
        if (problem) {
          throw Object.assign(new Error(problem), { friendlyMessage: problem });
        }
        return {
          day_of_week: DAY_NAME_TO_NUMBER[d.day],
          start_time: normalizeTime(d.open_time) as string,
          end_time: normalizeTime(d.close_time) as string,
          is_active: true,
        };
      });
    await apiService.post(`/providers/${providerId}/availability`, { weekly });
  },

  // Add a new service to a provider's catalog.
  // Real contract (verified via direct API probe): required body fields are
  // provider_id, sub_service_id, sub_service_name, service_id, category_id
  // (all sourced from the chosen catalog sub-service) plus price/duration -
  // NOT a free-text `name` field.
  async createProviderService(data: {
    provider_id: string;
    sub_service_id: string;
    sub_service_name: string;
    service_id: string;
    category_id: string;
    description?: string;
    price: number;
    duration_minutes: number;
    in_store?: boolean;
    home_service?: boolean;
  }): Promise<Service> {
    const raw = await apiService.post<any>('/provider-services', data);
    return normalizeService(raw);
  },

  async updateProviderService(
    serviceId: string | number,
    updates: Partial<{
      description: string;
      price: number;
      duration_minutes: number;
      is_active: boolean;
      name: string;
      in_store: boolean;
      home_service: boolean;
    }>
  ): Promise<Service> {
    const raw = await apiService.patch<any>(`/provider-services/${serviceId}`, updates);
    return normalizeService(raw);
  },

  async deleteProviderService(serviceId: string | number): Promise<void> {
    await apiService.delete(`/provider-services/${serviceId}`);
  },

  // --- Portfolio (Phase 3A) ---------------------------------------------
  // Reuses the EXISTING `stylists.portfolio` jsonb column (confirmed via
  // direct DB audit - the official field for this, no new table). Read is
  // public (anon key can read `stylists`, verified via probe - needed so
  // customers can see a provider's portfolio on their profile page). Write
  // is RLS-scoped to the row's own auth_id (verified: a provider can
  // update their own row; a different authenticated user is blocked).
  async getPortfolio(providerAuthId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('stylists')
      .select('portfolio')
      .eq('auth_id', providerAuthId)
      .maybeSingle();
    if (error) throw error;
    return Array.isArray(data?.portfolio) ? data!.portfolio : [];
  },

  // Convenience wrapper for the customer-facing provider profile page,
  // which only has the numeric providerId - mirrors getProviderReviews'
  // existing auth_id-resolution pattern.
  async getProviderPortfolio(providerId: string): Promise<string[]> {
    try {
      const authId = await this.resolveProviderAuthId(providerId);
      if (!authId) return [];
      return await this.getPortfolio(authId);
    } catch (err) {
      console.error('[provider-service] failed to load portfolio', err);
      return [];
    }
  },

  async updatePortfolio(providerAuthId: string, images: string[]): Promise<void> {
    const { error } = await supabase
      .from('stylists')
      .update({ portfolio: images })
      .eq('auth_id', providerAuthId);
    if (error) throw error;
  },
};
