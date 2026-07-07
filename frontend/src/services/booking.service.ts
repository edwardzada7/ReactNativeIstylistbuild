import apiService from './api';
import { Booking, CreateBookingRequest } from '../types';
import { normalizeBooking } from '../utils/normalize';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.data || raw?.bookings || raw?.results || [];
};

export const bookingService = {
  // Create booking. GROUND TRUTH (Phase 6 - verified against production
  // web app source, frontend/src/screens/ProviderProfileScreen.jsx
  // handleConfirmBooking): the real payload is provider_id (int),
  // customer_id, customer_auth_id, booking_date ("YYYY-MM-DD"),
  // booking_time (raw slot string), service_ids (array, even for a single
  // service), service_duration_minutes, notes, status ("pending_payment"),
  // and an optional staff_id - NOT { provider_id, service_id,
  // scheduled_at } as previously assumed.
  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    const raw = await apiService.post<any>('/bookings', {
      ...data,
      provider_id: Number(data.provider_id),
      service_ids: (data.service_ids || []).map((id) => Number(id)),
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

  async getBooking(id: string, role?: 'customer' | 'provider'): Promise<Booking> {
    const raw = await apiService.get<any>(`/bookings/${id}`, { params: role ? { role } : undefined });
    return normalizeBooking(raw);
  },

  // GROUND TRUTH (Phase 6.1 - verified against production web app source,
  // frontend/src/services/api.js `bookingsAPI.updateStatus` +
  // frontend/src/screens/BookingDetailsScreen.jsx handleStatusUpdate):
  //   PUT /bookings/{id}?status={status}&role={role}&auth_id={authId}
  // NO request body at all - status/role/auth_id are all query params.
  // Sending `{status}` as a JSON body (as this previously did) is exactly
  // why the backend replied "field required" - it never received the
  // query params it actually requires.
  // Real status values (confirmed from web's STATUS_CONFIG): pending_payment,
  // pending, confirmed, completed, canceled, declined, no_show_pending,
  // user_no_show, provider_no_show, disputed. NOT "cancelled"/"rejected".
  async updateBookingStatus(
    id: string,
    status: string,
    role: 'customer' | 'provider',
    authId: string
  ): Promise<Booking> {
    const raw = await apiService.put<any>(`/bookings/${id}`, undefined, {
      params: { status, role, auth_id: authId },
    });
    return normalizeBooking(raw);
  },

  // Customer or provider cancel - both use status "canceled" (single L,
  // matching the real backend value) via the same updateStatus contract.
  async cancelBooking(id: string, role: 'customer' | 'provider', authId: string): Promise<Booking> {
    return this.updateBookingStatus(id, 'canceled', role, authId);
  },

  // Provider accepts a pending booking.
  async acceptBooking(id: string, authId: string): Promise<Booking> {
    return this.updateBookingStatus(id, 'confirmed', 'provider', authId);
  },

  // Provider rejects a pending booking - real status value is "declined",
  // not "rejected".
  async declineBooking(id: string, authId: string): Promise<Booking> {
    return this.updateBookingStatus(id, 'declined', 'provider', authId);
  },

  // Provider marks an accepted booking as done.
  async completeBooking(id: string, authId: string): Promise<Booking> {
    return this.updateBookingStatus(id, 'completed', 'provider', authId);
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