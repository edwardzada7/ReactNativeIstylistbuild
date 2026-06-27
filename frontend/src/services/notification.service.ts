import apiService from './api';
import { Notification, PaginatedResponse } from '../types';

export const notificationService = {
  // Get notifications
  async getNotifications(params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Notification>> {
    return await apiService.get<PaginatedResponse<Notification>>('/notifications', { params });
  },

  // Mark notification as read
  async markAsRead(id: string): Promise<void> {
    return await apiService.post(`/notifications/${id}/read`);
  },

  // Mark all as read
  async markAllAsRead(): Promise<void> {
    return await apiService.post('/notifications/read-all');
  },

  // Get unread count
  async getUnreadCount(): Promise<{ count: number }> {
    return await apiService.get('/notifications/unread-count');
  },

  // Register push notification token
  async registerPushToken(token: string): Promise<void> {
    return await apiService.post('/notifications/register-token', { token });
  },
};