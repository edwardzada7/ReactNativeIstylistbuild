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
    target_id: string;
    target_type: 'POST' | 'PRODUCT';
    reason: string;
    description?: string;
    reporter?: { name?: string; email?: string; auth_id?: string };
  }): Promise<Report> {
    if (data.target_type === 'PRODUCT') {
      // The production API has no product-report route (it answered "Not Found"),
      // so product reports go to the support-ticket queue that moderators read.
      const reporterAuthId = data.reporter?.auth_id || (await apiService.getAuthId());
      await apiService.post('/support/tickets', {
        name: data.reporter?.name || 'App User',
        // The ticket API requires a valid email address.
        email: data.reporter?.email || 'no-email@istylist.app',
        category: 'abuse_report',
        subject: `Product report: ${data.reason}`,
        message: [
          `Reported product id: ${data.target_id}`,
          `Reported by (auth id): ${reporterAuthId || 'unknown'}`,
          `Reason: ${data.reason}`,
          (data.description || '').trim() ? `Details: ${(data.description || '').trim()}` : '',
        ].filter(Boolean).join('\n'),
      });
      return { status: 'received' } as unknown as Report;
    }
    return await apiService.post<Report>('/reports', data);
  },

  // Report a person (e.g. abusive chat messages). The production API has no
  // user-report endpoint, so this goes through the verified support-ticket
  // endpoint under the "abuse_report" category, where moderators will see it.
  async reportUser(data: {
    target_auth_id: string;
    reason: string;
    description?: string;
    reporter: { name?: string; email?: string; auth_id?: string };
  }): Promise<{ status?: string; message?: string }> {
    const details = (data.description || '').trim();
    return await apiService.post('/support/tickets', {
      name: data.reporter.name || 'App User',
      email: data.reporter.email || '',
      category: 'abuse_report',
      subject: `User report: ${data.reason}`,
      message: [
        `Reported user (auth id): ${data.target_auth_id}`,
        `Reported by (auth id): ${data.reporter.auth_id || 'unknown'}`,
        `Reason: ${data.reason}`,
        details ? `Details: ${details}` : '',
      ].filter(Boolean).join('\n'),
    });
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