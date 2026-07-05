import apiService from './api';
import { Provider, Category, Service, Review } from '../types';
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
};
