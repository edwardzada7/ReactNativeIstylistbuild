import apiService from './api';
import { Provider, Category, Service, PaginatedResponse } from '../types';

export const providerService = {
  // Get all providers with filters
  async getProviders(params?: {
    category_id?: string;
    search?: string;
    location?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Provider>> {
    return await apiService.get<PaginatedResponse<Provider>>('/providers', { params });
  },

  // Get provider by ID
  async getProvider(id: string): Promise<Provider> {
    return await apiService.get<Provider>(`/providers/${id}`);
  },

  // Get provider services
  async getProviderServices(providerId: string): Promise<Service[]> {
    return await apiService.get<Service[]>(`/providers/${providerId}/services`);
  },

  // Get featured providers
  async getFeaturedProviders(): Promise<Provider[]> {
    return await apiService.get<Provider[]>('/providers/featured');
  },

  // Save/unsave provider
  async toggleSaveProvider(providerId: string): Promise<void> {
    return await apiService.post(`/providers/${providerId}/save`);
  },

  // Get saved providers
  async getSavedProviders(): Promise<Provider[]> {
    return await apiService.get<Provider[]>('/providers/saved');
  },

  // Become a provider
  async becomeProvider(data: {
    business_name: string;
    bio: string;
    category_id: string;
    location: string;
    latitude?: number;
    longitude?: number;
  }): Promise<Provider> {
    return await apiService.post<Provider>('/providers', data);
  },

  // Update provider profile
  async updateProvider(id: string, data: Partial<Provider>): Promise<Provider> {
    return await apiService.put<Provider>(`/providers/${id}`, data);
  },

  // Get categories
  async getCategories(): Promise<Category[]> {
    return await apiService.get<Category[]>('/categories');
  },
};