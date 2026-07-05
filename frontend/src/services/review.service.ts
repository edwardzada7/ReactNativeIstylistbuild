import apiService from './api';
import { Review, CreateReviewRequest } from '../types';
import { normalizeReview } from '../utils/normalize';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.data || raw?.reviews || [];
};

export const reviewService = {
  // Write a review for a completed booking.
  async createReview(data: CreateReviewRequest): Promise<Review> {
    const raw = await apiService.post<any>('/reviews', data);
    return normalizeReview(raw);
  },

  // Reviews written by the current customer.
  async getMyReviews(): Promise<Review[]> {
    const raw = await apiService.get<any>('/reviews/me');
    return asList(raw).map(normalizeReview);
  },

  // Reviews received by a provider (also used by provider profile screen).
  async getProviderReviews(providerId: string): Promise<Review[]> {
    const raw = await apiService.get<any>(`/providers/${providerId}/reviews`);
    return asList(raw).map(normalizeReview);
  },
};
