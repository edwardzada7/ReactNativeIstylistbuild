import apiService from './api';
import { Booking, CreateBookingRequest } from '../types';
import { normalizeBooking } from '../utils/normalize';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.data || raw?.bookings || raw?.results || [];
};

export const bookingService = {
  // Create booking. Documented contract:
  // { provider_id, service_id, scheduled_at: ISO string, notes? }
  // BUG FIX (Phase 5D): provider_id/service_id were sent as JSON strings
  // (e.g. "12"), but the production API validates them as integers and
  // rejects non-int-typed JSON values with "Input should be a valid
  // integer". Cast both to real numbers here so the wire payload always
  // matches the backend's integer contract, matching the web app.
  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    const raw = await apiService.post<any>('/bookings', {
      ...data,
      provider_id: Number(data.provider_id),
      service_id: Number(data.service_id),
    });
    return normalizeBooking(raw);
  },

  // List bookings for the current user (customer sees their bookings,
  // provider sees bookings made against them - the production API scopes
  // this server-side based on the authenticated user).
  async getBookings(params?: { status?: string; role?: 'customer' | 'provider' }): Promise<Booking[]> {
    const raw = await apiService.get<any>('/bookings', { params });
    return asList(raw).map(normalizeBooking);
  },

  async getBooking(id: string): Promise<Booking> {
    const raw = await apiService.get<any>(`/bookings/${id}`);
    return normalizeBooking(raw);
  },

  // Status transitions (confirm / reject / arrived / completed / cancelled)
  // all go through the documented `PUT /api/bookings/{id}` endpoint.
  async updateBookingStatus(id: string, status: string): Promise<Booking> {
    const raw = await apiService.put<any>(`/bookings/${id}`, { status });
    return normalizeBooking(raw);
  },

  async cancelBooking(id: string, reason?: string): Promise<Booking> {
    const raw = await apiService.put<any>(`/bookings/${id}`, {
      status: 'cancelled',
      cancellation_reason: reason,
    });
    return normalizeBooking(raw);
  },

  async rescheduleBooking(id: string, scheduledAt: string): Promise<Booking> {
    const raw = await apiService.put<any>(`/bookings/${id}`, { scheduled_at: scheduledAt });
    return normalizeBooking(raw);
  },

  // GROUND TRUTH (Phase 6 - verified against production web app source,
  // frontend/src/services/api.js `paymentsAPI.payWithWallet`):
  //   POST /bookings/{bookingId}/pay-with-wallet?auth_id={customerAuthId}
  // No request body - only the customer's Supabase auth_id as a query
  // param. (Phase 5D had guessed `amount` as a query param, matching the
  // sibling `topup` endpoint - that guess is now corrected to match the
  // real web app contract exactly.)
  async payWithWallet(id: string, authId: string): Promise<Booking> {
    const raw = await apiService.post<any>(`/bookings/${id}/pay-with-wallet`, undefined, {
      params: { auth_id: authId },
    });
    return normalizeBooking(raw);
  },

  async getBookingChat(id: string): Promise<any[]> {
    const raw = await apiService.get<any>(`/bookings/${id}/chat`);
    return asList(raw);
  },

  async sendBookingChatMessage(id: string, message: string): Promise<any> {
    return apiService.post(`/bookings/${id}/chat`, { message });
  },
};