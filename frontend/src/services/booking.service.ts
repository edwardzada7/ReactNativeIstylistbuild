import apiService from './api';
import { Booking, CreateBookingRequest, PaginatedResponse } from '../types';

export const bookingService = {
  // Create booking
  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    return await apiService.post<Booking>('/bookings', data);
  },

  // Get user bookings
  async getBookings(params?: {
    status?: string;
    role?: 'customer' | 'provider';
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Booking>> {
    return await apiService.get<PaginatedResponse<Booking>>('/bookings', { params });
  },

  // Get booking by ID
  async getBooking(id: string): Promise<Booking> {
    return await apiService.get<Booking>(`/bookings/${id}`);
  },

  // Update booking status (provider)
  async updateBookingStatus(
    id: string,
    status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  ): Promise<Booking> {
    return await apiService.patch<Booking>(`/bookings/${id}/status`, { status });
  },

  // Cancel booking (customer)
  async cancelBooking(id: string, reason?: string): Promise<Booking> {
    return await apiService.post<Booking>(`/bookings/${id}/cancel`, { reason });
  },

  // Reschedule booking
  async rescheduleBooking(id: string, date: string, time: string): Promise<Booking> {
    return await apiService.post<Booking>(`/bookings/${id}/reschedule`, { date, time });
  },
};