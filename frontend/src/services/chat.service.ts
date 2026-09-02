import apiService from './api';
import { Conversation } from '../types';

export interface InvoiceDraft {
  conversation_id: number;
  customer_auth_id: string;
  provider_auth_id: string;
  invoice_type: 'service' | 'product';
  amount: number;
  service_date?: string;
  service_time?: string;
  location?: string;
  service_type?: string;
  staff_id?: number;
  note?: string;
  items: Array<{ service_id?: number; product_id?: number; quantity: number }>;
}

export interface ChatMessage {
  id: number;
  booking_id?: number;
  conversation_id?: number;
  sender_auth_id: string;
  receiver_auth_id: string;
  message: string;
  content?: string;
  type?: 'TEXT' | 'IMAGE' | 'LOCATION' | 'CUSTOM_INVOICE' | 'PROVIDER_RECOMMENDATION' | 'SYSTEM_ALERT';
  message_type?: 'TEXT' | 'IMAGE' | 'LOCATION' | 'CUSTOM_INVOICE' | 'PROVIDER_RECOMMENDATION' | 'SYSTEM_ALERT';
  is_masked?: boolean;
  location_data?: { latitude: number; longitude: number; addressName?: string | null } | null;
  invoice_data?: {
    amount: number;
    invoice_id?: number;
    invoice_type?: 'service' | 'product';
    serviceDetails?: string;
    service?: string;
    date?: string;
    time?: string;
    location?: string;
    staff?: string;
    items?: Array<{ product_id: number; quantity: number; name?: string; price?: number; image?: string | null; stylist_auth_id?: string }>;
    platformFee?: number;
    netPayout?: number;
    status?: string;
    paymentReference?: string | null;
  } | null;
  recommendation_data?: {
    recommendation_id?: number;
    recommended_provider_auth_id: string;
    provider_id?: string;
    provider_name?: string;
    provider_image?: string | null;
    provider_bio?: string | null;
    provider_category?: string | null;
    message?: string;
  } | null;
  read: boolean;
  is_read?: boolean;
  created_at: string;
  read_at?: string;
}

export interface LocationMessagePayload {
  conversationId: number;
  type: 'LOCATION';
  content: string;
  latitude: number;
  longitude: number;
  addressName?: string;
}

export interface ChatParticipants {
  customer_auth_id: string;
  provider_auth_id: string;
}

export interface BookingChatResponse {
  messages: ChatMessage[];
  participants: ChatParticipants;
}

const profileDisplayName = (profile: any): string | undefined => {
  if (!profile) return undefined;
  const fullName = [profile.firstName || profile.first_name, profile.lastName || profile.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return profile.businessName || profile.business_name || profile.salon_name || fullName || profile.name || profile.full_name;
};

/**
 * Chat service using booking-based endpoints to match web implementation.
 * Chat is tied to bookings - customers can only chat with providers they have booked,
 * and providers can only chat with customers who have booked them.
 */
export const chatService = {
  async createInquiry(providerAuthId: string): Promise<{ id: number }> {
    return apiService.post('/conversations/inquiry', { provider_auth_id: providerAuthId });
  },

  async createConsultation(data: { provider_auth_id: string; specialty: string; fee: number; currency: string }) {
    return apiService.post('/consultations', data);
  },

  async activateConsultation(consultationId: number, paymentReference: string, transactionId?: string | null) {
    return apiService.post(`/consultations/${consultationId}/activate`, {
      payment_reference: paymentReference,
      transaction_id: transactionId,
    });
  },

  async getConversationThread(conversationId: number): Promise<{ conversation: any; messages: ChatMessage[] }> {
    return apiService.get(`/conversations/${conversationId}/messages`);
  },

  async sendConversationMessage(conversationId: number, receiverAuthId: string, message: string, messageType: 'TEXT' | 'IMAGE' = 'TEXT') {
    return apiService.post(`/conversations/${conversationId}/messages`, {
      receiver_auth_id: receiverAuthId,
      message,
      message_type: messageType,
    });
  },

  async createInvoice(data: InvoiceDraft) {
    return apiService.post<any>('/invoices', data);
  },

  async getInvoice(invoiceId: number) {
    return apiService.get<any>(`/invoices/${invoiceId}`);
  },

  async sendInvoiceMessage(conversationId: number, receiverAuthId: string, invoiceData: Record<string, any>) {
    return apiService.post('/conversations/' + conversationId + '/messages', {
      receiver_auth_id: receiverAuthId,
      message: invoiceData.invoice_type === 'product' ? 'Product invoice' : 'Service invoice',
      message_type: 'CUSTOM_INVOICE',
      invoice_data: invoiceData,
    });
  },

  async sendProviderRecommendation(conversationId: number, receiverAuthId: string, recommendation: Record<string, any>) {
    return apiService.post('/conversations/' + conversationId + '/messages', {
      receiver_auth_id: receiverAuthId,
      message: recommendation.message || `Recommended provider: ${recommendation.provider_name}`,
      message_type: 'PROVIDER_RECOMMENDATION',
      recommendation_data: recommendation,
    });
  },

  async payServiceInvoice(invoiceId: number, paymentReference: string, transactionId?: string | null) {
    return apiService.post(`/invoices/${invoiceId}/pay-service`, {
      payment_reference: paymentReference,
      transaction_id: transactionId,
    });
  },

  async completeProductInvoice(invoiceId: number, orderId: number, paymentReference?: string | null) {
    return apiService.post(`/invoices/${invoiceId}/complete-product`, {
      order_id: orderId,
      payment_reference: paymentReference,
    });
  },

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

      // Filter out canceled/declined bookings (matching web behavior)
      const activeBookings = (bookings || []).filter(
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
            let counterpartName: string | undefined;
            let counterpartProfileImageUrl: string | null = null;
            let stylistProfile: any = null;
            try {
              // First try to get as provider (stylist)
              stylistProfile = await apiService.get(`/stylists/by-auth/${counterpartAuthId}`).catch(() => null);
              if (stylistProfile) {
                // Provider: prioritize business_name, then salon_name, then user name
                counterpartName = profileDisplayName(stylistProfile);
                counterpartProfileImageUrl =
                  stylistProfile?.avatarUrl ||
                  stylistProfile?.avatar_url ||
                  stylistProfile?.profileImage ||
                  stylistProfile?.profile_image ||
                  stylistProfile?.profile_image_url ||
                  null;
              } else {
                // Fallback to user table for customers
                const userProfile = await apiService.get(`/users/by-auth/${counterpartAuthId}`);
                counterpartName = profileDisplayName(userProfile);
                counterpartProfileImageUrl =
                  userProfile?.avatarUrl ||
                  userProfile?.avatar_url ||
                  userProfile?.profileImage ||
                  userProfile?.profile_image ||
                  userProfile?.profile_image_url ||
                  null;
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
              provider: stylistProfile
                ? {
                    avatarUrl: stylistProfile.avatarUrl || stylistProfile.avatar_url || stylistProfile.profile_image_url,
                    profileImage: stylistProfile.profileImage || stylistProfile.profile_image,
                    businessName: stylistProfile.businessName || stylistProfile.business_name,
                    firstName: stylistProfile.firstName || stylistProfile.first_name,
                    lastName: stylistProfile.lastName || stylistProfile.last_name,
                  }
                : undefined,
              user: stylistProfile
                ? undefined
                : { avatarUrl: counterpartProfileImageUrl },
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
      const shared = await apiService.get<any[]>('/conversations').catch(() => []);
      const sharedConversations: Conversation[] = shared.map((item: any) => ({
        id: Number(item.id),
        conversation_id: Number(item.id),
        conversation_type: item.type,
        counterpart_auth_id: authId === item.customer_auth_id ? item.provider_auth_id : item.customer_auth_id,
        counterpart_name: item.counterpart_name,
        last_message: item.last_message || { id: 0, message: '', read: true, created_at: item.updated_at || new Date().toISOString() },
        unread_count: item.unread_count || 0,
      }));
      return [...conversations, ...sharedConversations].sort((a, b) =>
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
  async getThread(bookingId: number, limit = 25, offset = 0): Promise<ChatMessage[]> {
    const authId = await apiService.getAuthId();
    if (!authId) return [];

    try {
      const chatData: BookingChatResponse = await apiService.get(
        `/bookings/${bookingId}/chat?auth_id=${authId}&limit=${limit}&offset=${offset}`
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
  async sendMessage(
    bookingIdOrPayload: number | LocationMessagePayload,
    message?: string,
    options: Pick<ChatMessage, 'message_type' | 'location_data' | 'invoice_data'> = {}
  ): Promise<ChatMessage> {
    const isLocationPayload = typeof bookingIdOrPayload !== 'number';
    const bookingId = isLocationPayload ? bookingIdOrPayload.conversationId : bookingIdOrPayload;
    const payloadMessage = isLocationPayload ? bookingIdOrPayload.content : message || '';
    const payloadOptions = isLocationPayload
      ? {
          message_type: bookingIdOrPayload.type,
          location_data: {
            latitude: bookingIdOrPayload.latitude,
            longitude: bookingIdOrPayload.longitude,
            addressName: bookingIdOrPayload.addressName,
          },
        }
      : options;
    const authId = await apiService.getAuthId();
    if (!authId) {
      throw new Error('Not authenticated');
    }

    return await apiService.post(`/bookings/${bookingId}/chat`, {
      auth_id: authId,
      message: payloadMessage,
      message_type: payloadOptions.message_type || 'TEXT',
      location_data: payloadOptions.location_data,
      invoice_data: payloadOptions.invoice_data,
    });
  },

  /**
   * Get total unread count across all bookings.
   */
  async getUnreadCount(): Promise<number> {
    const authId = await apiService.getAuthId();
    if (!authId) return 0;

    try {
      const result = await apiService.get('/conversations/unread-count');
      return result.unreadCount ?? result.unread_count ?? 0;
    } catch (err) {
      console.error('[chat] failed to get unread count', err);
      return 0;
    }
  },

  async markRead(bookingId: number): Promise<number> {
    const result = await apiService.post(`/conversations/${bookingId}/mark-read`);
    return result.clearedCount ?? 0;
  },
};
