import apiService from './api';

export interface TicketType {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  remaining: number | null;
  max_per_order: number;
  is_active: boolean;
  on_sale: boolean;
  sold_out: boolean;
}

export interface EventItem {
  id: number;
  title: string;
  description?: string | null;
  banner_url?: string | null;
  venue?: string | null;
  address?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status: 'published' | 'canceled' | string;
  is_featured: boolean;
  is_official: boolean;
  organizer_name: string;
  ticket_types: TicketType[];
  min_price: number;
  is_free: boolean;
  my_ticket_count?: number;
}

export interface EventQuote {
  unit_price: number;
  quantity: number;
  subtotal: number;
  service_fee: number;
  total: number;
}

export interface MyTicket {
  id: number;
  event_id: number;
  pin: string;
  status: 'valid' | 'used' | 'refund_due' | 'canceled' | string;
  used_at?: string | null;
  ticket_type?: string;
  event_title?: string;
  event_starts_at?: string;
  event_venue?: string | null;
  qr_svg?: string | null;
}

export interface ScanResult {
  result: 'valid' | 'used' | 'canceled' | 'wrong_event' | 'invalid';
  message: string;
  holder?: string;
  ticket_type?: string;
  used_at?: string | null;
  total?: number;
  checked_in?: number;
}

export interface ScannerSession {
  event_id: number;
  event_title: string;
  starts_at?: string;
  label?: string;
  total: number;
  checked_in: number;
}

export const eventsService = {
  async list(): Promise<EventItem[]> {
    const res = await apiService.get<any>('/events');
    return Array.isArray(res?.events) ? res.events : [];
  },
  async get(id: number | string): Promise<EventItem> {
    return apiService.get<EventItem>(`/events/${id}`);
  },
  async quote(id: number, ticketTypeId: number, quantity: number): Promise<EventQuote> {
    return apiService.get<EventQuote>(`/events/${id}/quote?ticket_type_id=${ticketTypeId}&quantity=${quantity}`);
  },
  async checkout(
    id: number,
    body: { ticket_type_id: number; quantity: number; email?: string; redirect_url?: string },
  ): Promise<{ status: 'free' | 'pending'; authorization_url?: string; reference: string; ticket_count?: number }> {
    return apiService.post(`/events/${id}/checkout`, body);
  },
  async verify(reference: string): Promise<{ status: string; message?: string }> {
    return apiService.get(`/events/orders/verify?reference=${encodeURIComponent(reference)}`);
  },
  async myTickets(): Promise<MyTicket[]> {
    const res = await apiService.get<any>('/events/my-tickets');
    return Array.isArray(res?.tickets) ? res.tickets : [];
  },
  async scannerLogin(accessCode: string): Promise<ScannerSession> {
    const res = await apiService.post<any>('/events/scanner/login', { access_code: accessCode });
    return { ...res, event_title: res.event_title };
  },
  async scan(accessCode: string, code: string, eventId: number): Promise<ScanResult> {
    return apiService.post(
      '/events/scanner/scan',
      { code, event_id: eventId },
      { headers: { 'X-SCANNER-CODE': accessCode } },
    );
  },
};

export const formatEventDate = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};
