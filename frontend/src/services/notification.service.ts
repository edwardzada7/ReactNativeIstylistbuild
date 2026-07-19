import apiService from './api';
import { supabase } from '../lib/supabase';
import { Notification, PaginatedResponse } from '../types';

const PAGE_SIZE = 20;

const normalize = (row: any): Notification => ({
  id: String(row.id),
  user_id: row.auth_id,
  title: row.title || row.type || 'Notification',
  body: row.message,
  type: row.type || 'system',
  data: row.metadata,
  is_read: !!row.read,
  created_at: row.created_at,
});

/**
 * Notifications (Phase 3A). Uses the Supabase client DIRECTLY against the
 * production `notifications` table - verified via real RLS testing (not
 * just schema inspection) that authenticated users can only read/update
 * their OWN rows (auth_id-scoped policy confirmed with two real test
 * accounts: a customer's own notification was readable/writable by them,
 * and NOT readable/writable by a different authenticated user). No FastAPI
 * route needed for list/mark-read/mark-all-read. `getUnreadCount` reuses
 * the EXISTING working production endpoint (GET
 * /api/notifications/unread-count?auth_id=) rather than re-implementing
 * the same count client-side.
 */
export const notificationService = {
  async getNotifications(page = 1, perPage = PAGE_SIZE): Promise<PaginatedResponse<Notification>> {
    const authId = await apiService.getAuthId();
    if (!authId) return { data: [], total: 0, page, per_page: perPage, total_pages: 0 };

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('auth_id', authId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    const total = count || 0;
    return {
      data: (data || []).map(normalize),
      total,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    };
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllAsRead(): Promise<void> {
    const authId = await apiService.getAuthId();
    if (!authId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('auth_id', authId)
      .eq('read', false);
    if (error) throw error;
  },

  // Real, already-working production endpoint - not re-implemented here.
  async getUnreadCount(): Promise<{ count: number }> {
    const authId = await apiService.getAuthId();
    if (!authId) return { count: 0 };
    const raw = await apiService.get<any>('/notifications/unread-count', { params: { auth_id: authId } });
    return { count: raw?.count ?? raw?.unread_count ?? 0 };
  },

  // Register push notification token
  async registerPushToken(token: string): Promise<void> {
    return await apiService.post('/notifications/register-token', { token });
  },
};