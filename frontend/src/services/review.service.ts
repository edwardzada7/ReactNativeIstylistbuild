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

  // Reviews written by the current customer. Real contract (verified via
  // direct API probe): GET /reviews/me requires BOTH `auth_id` and `role`
  // as query params (422 "Field required" otherwise) - previously called
  // with no params at all, so this always 422'd and silently resolved to
  // an empty list via the .catch(() => []) callers use, meaning "already
  // reviewed" bookings kept showing the "Leave a Review" button forever.
  async getMyReviews(): Promise<Review[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];
    const raw = await apiService.get<any>('/reviews/me', { params: { auth_id: authId, role: 'customer' } });
    return asList(raw).map(normalizeReview);
  },

  // NOTE: provider-received reviews are served by
  // providerService.getProviderReviews() (src/services/provider.service.ts),
  // which correctly resolves the provider's Supabase auth UUID first (the
  // real /providers/{auth_id}/reviews contract requires a UUID, not the
  // numeric provider_id). Intentionally not duplicated here.
};
