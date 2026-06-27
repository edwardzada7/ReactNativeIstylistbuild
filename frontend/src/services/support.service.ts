import apiService from './api';
import { SupportTicket, Report, PaginatedResponse } from '../types';

export const supportService = {
  // Create support ticket
  async createTicket(data: {
    subject: string;
    description: string;
    category: string;
  }): Promise<SupportTicket> {
    return await apiService.post<SupportTicket>('/support/tickets', data);
  },

  // Get user tickets
  async getMyTickets(params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<SupportTicket>> {
    return await apiService.get<PaginatedResponse<SupportTicket>>('/support/tickets/me', {
      params,
    });
  },

  // Get ticket by ID
  async getTicket(id: string): Promise<SupportTicket> {
    return await apiService.get<SupportTicket>(`/support/tickets/${id}`);
  },

  // Report user/content
  async createReport(data: {
    reported_id: string;
    type: 'user' | 'post' | 'review';
    reason: string;
    description: string;
  }): Promise<Report> {
    return await apiService.post<Report>('/reports', data);
  },
};

export const kycService = {
  // Submit KYC documents
  async submitKYC(data: {
    document_type: string;
    document_number: string;
    document_image: string;
    selfie_image: string;
  }): Promise<any> {
    return await apiService.post('/kyc/submit', data);
  },

  // Get KYC status
  async getKYCStatus(): Promise<any> {
    return await apiService.get('/kyc/status');
  },
};