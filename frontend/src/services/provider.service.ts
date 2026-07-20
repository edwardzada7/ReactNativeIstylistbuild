import apiService from './api';
import { supabase } from '../lib/supabase';
import {
  Provider,
  Category,
  Service,
  Review,
  ProviderAvailability,
  CatalogSubService,
  DayAvailability,
} from '../types';
import {
  normalizeProvider,
  normalizeService,
  normalizeReview,
  deriveCategories,
} from '../utils/normalize';
import { getAllSubServicesCatalog } from '../constants/serviceCatalog';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  // `reviews` covers GET /providers/{auth_id}/reviews, whose real shape is
  // { reviews: [...], avg_rating, total_reviews } - NOT a bare array. This
  // was previously missing here, so provider reviews always normalized to
  // an empty list even when the API had real data (falls through to the
  // final `[]` fallback since none of the other keys exist on that shape).
  return raw?.data || raw?.providers || raw?.services || raw?.reviews || raw?.results || [];
};

const DAY_NAME_TO_NUMBER: Record<DayAvailability['day'], number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};
const ALL_DAY_NAMES: DayAvailability['day'][] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const providerService = {
  // Browse providers with their services embedded (Home + Search use this).
  async getProvidersWithServices(): Promise<Provider[]> {
    const raw = await apiService.get<any>('/providers/with-services');
    return asList(raw).map(normalizeProvider);
  },

  // Full provider profile: bio, services, ratings, portfolio.
  async getProviderFullProfile(providerId: string): Promise<Provider> {
    const raw = await apiService.get<any>(`/providers/${providerId}/full-profile`);
    return normalizeProvider(raw);
  },

  // Services offered by one specific provider.
  async getProviderServices(providerId: string): Promise<Service[]> {
    const raw = await apiService.get<any>(`/provider-services/${providerId}`);
    return asList(raw).map(normalizeService);
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
    const subServices = await this.getCatalogSubServices();
    return deriveCategories(subServices);
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
    const raw = await apiService.get<any>(`/providers/${providerId}/available-slots`, {
      params: { date, service_duration: durationMinutes },
    });
    if (Array.isArray(raw)) return raw;
    return raw?.slots || raw?.data || [];
  },

  // Real contract (verified via direct API probe): GET returns
  // { weekly: [{ day_of_week: 1-7 (Mon-Sun), start_time, end_time, is_active }],
  //   exceptions: [{ date, is_unavailable, start_time, end_time, note }],
  //   rules: {...} } - not the { days, blocked_dates } shape this used to assume.
  async getProviderAvailability(providerId: string): Promise<ProviderAvailability | null> {
    try {
      const raw = await apiService.get<any>(`/providers/${providerId}/availability`);
      if (!raw) return null;
      const weekly = Array.isArray(raw.weekly) ? raw.weekly : [];
      const byDayNumber = new Map<number, any>(weekly.map((w: any) => [w.day_of_week, w]));
      const days: DayAvailability[] = ALL_DAY_NAMES.map((dayName) => {
        const entry = byDayNumber.get(DAY_NAME_TO_NUMBER[dayName]);
        return {
          day: dayName,
          is_open: !!entry,
          open_time: entry?.start_time?.slice(0, 5) || '09:00',
          close_time: entry?.end_time?.slice(0, 5) || '18:00',
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
    const weekly = availability.days
      .filter((d) => d.is_open)
      .map((d) => ({
        day_of_week: DAY_NAME_TO_NUMBER[d.day],
        start_time: d.open_time,
        end_time: d.close_time,
        is_active: true,
      }));
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
