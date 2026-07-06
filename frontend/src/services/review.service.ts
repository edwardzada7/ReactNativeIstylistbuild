import apiService from './api';
import { Review, CreateReviewRequest } from '../types';
import { normalizeReview } from '../utils/normalize';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.data || raw?.reviews || [];
};

export const reviewService = {
  // Write a review for a completed booking.
  // Real production contract (verified via direct API probe): `auth_id` of the
  // reviewer must be sent as a QUERY param (not body); body only needs
  // booking_id + rating + optional comment. Previously `auth_id` was missing
  // entirely, which made every review submission fail with a 422 whose
  // `detail` is an array - the raw (pre-fix) api.ts interceptor passed that
  // array straight into Alert.alert() downstream, which crashed the app.
  async createReview(data: CreateReviewRequest): Promise<Review> {
    const authId = await apiService.getAuthId();
    const raw = await apiService.post<any>(
      '/reviews',
      {
        booking_id: data.booking_id,
        provider_id: data.provider_id,
        rating: data.rating,
        comment: data.comment,
      },
      authId ? { params: { auth_id: authId } } : undefined
    );
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
