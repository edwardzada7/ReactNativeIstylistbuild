import apiService from './api';
import { Report } from '../types';

export const supportService = {
  // Create support ticket. Real production contract (verified via direct
  // API probe): POST /support/tickets requires { name, email, category,
  // subject, message } - NOT { subject, description, category }. There is
  // no GET /support/tickets/me or GET /support/tickets/{id} on the
  // production API (both 404) - this is a contact-form-style endpoint
  // only, not a full ticket-thread system, so getMyTickets/getTicket below
  // are intentionally not exposed to the UI.
  async createTicket(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
    category: string;
  }): Promise<{ status?: string; message?: string }> {
    return await apiService.post('/support/tickets', data);
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