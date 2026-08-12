import apiService from './api';
import { Conversation } from '../types';

export interface ChatMessage {
  id: number;
  booking_id: number;
  sender_auth_id: string;
  receiver_auth_id: string;
  message: string;
  read: boolean;
  created_at: string;
  read_at?: string;
}

export interface ChatParticipants {
  customer_auth_id: string;
  provider_auth_id: string;
}

export interface BookingChatResponse {
  messages: ChatMessage[];
  participants: ChatParticipants;
}

/**
 * Chat service using booking-based endpoints to match web implementation.
 * Chat is tied to bookings - customers can only chat with providers they have booked,
 * and providers can only chat with customers who have booked them.
 */
export const chatService = {
  /**
   * Get all conversations (bookings with chat) for the current user.
   * This queries bookings where the user is a participant and has chat messages.
   * Only includes bookings that are not canceled or declined (matching web behavior).
   */
  async getConversations(): Promise<Conversation[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];

    try {
      // Get bookings where user is participant
      const bookings = await apiService.get(`/bookings?auth_id=${authId}`);

      if (!bookings || bookings.length === 0) return [];

      // Filter out canceled/declined bookings (matching web behavior)
      const activeBookings = bookings.filter(
        (booking: any) => booking.status !== 'canceled' && booking.status !== 'declined'
      );

      // For each booking, check if there are chat messages and get conversation details
      const conversations: Conversation[] = [];
      
      for (const booking of activeBookings) {
        try {
          const chatData: BookingChatResponse = await apiService.get(
            `/bookings/${booking.id}/chat?auth_id=${authId}&limit=1`
          );

          if (chatData.messages && chatData.messages.length > 0) {
            const providerAuthId = booking.provider_auth_id || booking.stylist_auth_id;
            const customerAuthId = booking.customer_auth_id;
            
            // Determine counterpart
            const counterpartAuthId = authId === customerAuthId ? providerAuthId : customerAuthId;
            
            // Get unread count for this booking
            const unreadCount = chatData.messages.filter(
              (msg: ChatMessage) => msg.receiver_auth_id === authId && !msg.read
            ).length;

            // Fetch counterpart's actual name and profile image from the database
            let counterpartName = 'Unknown';
            let counterpartProfileImageUrl: string | null = null;
            try {
              // First try to get as provider (stylist)
              const stylistProfile = await apiService.get(`/stylists/by-auth/${counterpartAuthId}`).catch(() => null);
              if (stylistProfile) {
                // Provider: prioritize business_name, then salon_name, then user name
                counterpartName = stylistProfile?.business_name || stylistProfile?.salon_name || stylistProfile?.name || 'Unknown';
                counterpartProfileImageUrl = stylistProfile?.profile_image_url || null;
              } else {
                // Fallback to user table for customers
                const userProfile = await apiService.get(`/users/by-auth/${counterpartAuthId}`);
                counterpartName = userProfile?.name || userProfile?.full_name || 'Unknown';
                counterpartProfileImageUrl = userProfile?.profile_image_url || null;
              }
            } catch (profileErr) {
              console.warn(`[chat] failed to load profile for ${counterpartAuthId}`, profileErr);
            }

            conversations.push({
              id: booking.id,
              booking_id: booking.id,
              counterpart_auth_id: counterpartAuthId,
              counterpart_name: counterpartName,
              counterpart_profile_image_url: counterpartProfileImageUrl,
              last_message: chatData.messages[0],
              unread_count: unreadCount,
            });
          }
        } catch (err) {
          // Skip bookings without chat or with errors
          console.warn(`[chat] failed to load chat for booking ${booking.id}`, err);
        }
      }

      // Sort by latest message
      return conversations.sort((a, b) => 
        new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
      );
    } catch (err) {
      console.error('[chat] failed to load conversations', err);
      return [];
    }
  },

  /**
   * Get chat thread for a specific booking.
   */
  async getThread(bookingId: number): Promise<ChatMessage[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];

    try {
      const chatData: BookingChatResponse = await apiService.get(
        `/bookings/${bookingId}/chat?auth_id=${authId}`
      );
      
      // Mark as read
      try {
        await apiService.post(`/bookings/${bookingId}/chat/mark-read`, { auth_id: authId });
      } catch (markErr) {
        console.warn('[chat] failed to mark as read', markErr);
      }

      return chatData.messages || [];
    } catch (err) {
      console.error('[chat] failed to load thread', err);
      return [];
    }
  },

  /**
   * Send a chat message for a booking.
   */
  async sendMessage(bookingId: number, message: string): Promise<ChatMessage> {
    const authId = await apiService.getAuthId();
    if (!authId) {
      throw new Error('Not authenticated');
    }

    return await apiService.post(`/bookings/${bookingId}/chat`, {
      auth_id: authId,
      message,
    });
  },

  /**
   * Get total unread count across all bookings.
   */
  async getUnreadCount(): Promise<number> {
    const authId = await apiService.getAuthId();
    if (!authId) return 0;

    try {
      const result = await apiService.get(`/chat/unread-count?auth_id=${authId}`);
      return result.unread_count || 0;
    } catch (err) {
      console.error('[chat] failed to get unread count', err);
      return 0;
    }
  },
};
