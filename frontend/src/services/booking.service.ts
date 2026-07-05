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
  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    const raw = await apiService.post<any>('/bookings', data);
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

  async payWithWallet(id: string): Promise<Booking> {
    const raw = await apiService.post<any>(`/bookings/${id}/pay-with-wallet`);
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