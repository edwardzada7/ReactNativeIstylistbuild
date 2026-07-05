import apiService from './api';
import { Provider, Category, Service, Review, ProviderAvailability } from '../types';
import {
  normalizeProvider,
  normalizeService,
  normalizeReview,
  deriveCategories,
} from '../utils/normalize';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.data || raw?.providers || raw?.services || raw?.results || [];
};

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

  // Full services catalog (used to derive categories client-side, since the
  // production API has no dedicated /categories endpoint).
  async getCatalogServices(): Promise<Service[]> {
    const raw = await apiService.get<any>('/catalog/services');
    return asList(raw).map(normalizeService);
  },

  async getCategories(): Promise<Category[]> {
    const services = await this.getCatalogServices();
    return deriveCategories(services);
  },

  async getProviderReviews(providerId: string): Promise<Review[]> {
    const raw = await apiService.get<any>(`/providers/${providerId}/reviews`);
    return asList(raw).map(normalizeReview);
  },

  async getAvailableSlots(providerId: string, date?: string): Promise<string[]> {
    const raw = await apiService.get<any>(`/providers/${providerId}/available-slots`, {
      params: date ? { date } : undefined,
    });
    if (Array.isArray(raw)) return raw;
    return raw?.slots || raw?.data || [];
  },

  // NOTE: the API quick-reference only documents the write side of this
  // (`POST /api/providers/{id}/availability`, used during provider
  // onboarding). There is no documented GET for reading back the current
  // schedule, so this best-effort reads it from the same path - if that 404s,
  // callers should fall back to a sensible default schedule.
  async getProviderAvailability(providerId: string): Promise<ProviderAvailability | null> {
    try {
      const raw = await apiService.get<any>(`/providers/${providerId}/availability`);
      if (!raw) return null;
      return {
        days: raw.days || raw.availability || [],
        blocked_dates: raw.blocked_dates || [],
      };
    } catch {
      return null;
    }
  },

  async setProviderAvailability(
    providerId: string,
    availability: ProviderAvailability
  ): Promise<void> {
    await apiService.post(`/providers/${providerId}/availability`, {
      availability: availability.days,
      blocked_dates: availability.blocked_dates,
    });
  },

  // Add a new service to a provider's catalog. Documented in the onboarding
  // workflow as `POST /api/provider-services`.
  async createProviderService(data: {
    provider_id: string;
    name: string;
    description?: string;
    price: number;
    duration_minutes: number;
    in_store?: boolean;
    home_service?: boolean;
  }): Promise<Service> {
    const raw = await apiService.post<any>('/provider-services', data);
    return normalizeService(raw);
  },
};
