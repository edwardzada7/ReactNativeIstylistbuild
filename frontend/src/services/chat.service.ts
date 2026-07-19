import { supabase } from '../lib/supabase';
import apiService, { localApiService } from './api';

export interface ChatMessage {
  id: number;
  sender_auth_id: string;
  receiver_auth_id: string;
  message: string;
  booking_id: number | null;
  created_at: string;
}

/**
 * Chat (Phase 3A). Reuses the EXISTING `chats` table exactly as confirmed
 * via the backend audit - no new table. Reads go straight to Supabase
 * (RLS-verified: a user only sees messages where they are sender or
 * receiver). Sending goes through the local backend's
 * `/api/chat/messages` bridge because RLS blocks a direct client insert
 * (verified: Postgres error 42501).
 */
export const chatService = {
  async getThread(counterpartAuthId: string): Promise<ChatMessage[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .or(
        `and(sender_auth_id.eq.${authId},receiver_auth_id.eq.${counterpartAuthId}),and(sender_auth_id.eq.${counterpartAuthId},receiver_auth_id.eq.${authId})`
      )
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async sendMessage(receiverAuthId: string, message: string, bookingId?: number): Promise<ChatMessage> {
    return await localApiService.post('/chat/messages', {
      receiver_auth_id: receiverAuthId,
      message,
      booking_id: bookingId,
    });
  },
};
