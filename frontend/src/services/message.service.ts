import apiService from './api';
import { Conversation, Message, PaginatedResponse } from '../types';

export const messageService = {
  // Get conversations
  async getConversations(params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Conversation>> {
    return await apiService.get<PaginatedResponse<Conversation>>('/messages/conversations', {
      params,
    });
  },

  // Get or create conversation
  async getOrCreateConversation(participantId: string): Promise<Conversation> {
    return await apiService.post<Conversation>('/messages/conversations', {
      participant_id: participantId,
    });
  },

  // Get messages
  async getMessages(
    conversationId: string,
    params?: { page?: number; per_page?: number }
  ): Promise<PaginatedResponse<Message>> {
    return await apiService.get<PaginatedResponse<Message>>(
      `/messages/conversations/${conversationId}/messages`,
      { params }
    );
  },

  // Send message
  async sendMessage(
    conversationId: string,
    content: string,
    type: 'text' | 'image' = 'text'
  ): Promise<Message> {
    return await apiService.post<Message>(
      `/messages/conversations/${conversationId}/messages`,
      { content, type }
    );
  },

  // Mark messages as read
  async markAsRead(conversationId: string): Promise<void> {
    return await apiService.post(`/messages/conversations/${conversationId}/read`);
  },
};