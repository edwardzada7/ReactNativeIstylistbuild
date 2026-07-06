// User Types
// `id` is the numeric profile id from the production business API (table `users`).
// `auth_id` is the Supabase Auth user UUID - the canonical cross-service identifier.
// `role` is normalized to the UI-facing 'customer' | 'provider' | 'admin' even though
// the production backend stores 'customer' | 'stylist' | 'user' | 'admin'.
export interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  name?: string;
  phone?: string;
  avatar?: string;
  role: 'customer' | 'provider' | 'admin';
  role_raw?: string;
  is_verified: boolean;
  phone_verified?: boolean;
  profile_completed?: boolean;
  country?: string | null;
  city?: string | null;
  gender?: string | null;
  account_type?: string;
  created_at?: string;
  updated_at?: string;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'customer' | 'provider';
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: User;
  expires_in?: number;
}

export interface OTPRequest {
  email: string;
  code: string;
}

// Provider Types
export interface Provider {
  id: string;
  user_id: string;
  business_name: string;
  bio: string;
  category_id: string;
  category?: Category | string;
  rating: number;
  review_count: number;
  price_range: string;
  location: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  services: Service[];
  is_verified: boolean;
  is_available: boolean;
  response_time?: string;
  completion_rate?: number;
  created_at: string;
  avatar?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  provider_count?: number;
}

// Service Types
export interface Service {
  id: string;
  provider_id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in minutes
  category?: string;
  is_active: boolean;
  in_store?: boolean;
  home_service?: boolean;
}

// Catalog sub-service (production `/api/catalog/sub-services`): the actual
// bookable service templates (e.g. "Haircut", "Box Braids") that providers
// pick from when adding a service. Distinct from `Service` because creating
// a provider-service needs the raw catalog slugs (sub_service_id, service_id,
// category_id), not just a display name.
export interface CatalogSubService {
  id: string; // sub_service_id slug, e.g. "haircut"
  name: string;
  default_duration: number;
  default_price: number;
  service_id: string; // parent service-type slug, e.g. "barbers"
  service_name: string;
  category_id: string; // category slug, e.g. "beauty-grooming"
  category_name: string;
  requires_verification: boolean;
}

// Booking Types
export interface Booking {
  id: string;
  customer_id: string;
  customer_auth_id?: string;
  provider_id: string;
  provider_auth_id?: string;
  service_id: string;
  service_name: string;
  provider_name: string;
  provider_avatar?: string;
  service?: Service;
  provider?: Provider;
  customer?: User;
  scheduled_at: string; // ISO datetime
  date: string; // derived, YYYY-MM-DD
  time: string; // derived, e.g. "10:00 AM"
  status: string; // pending | confirmed | arrived | completed | cancelled | rejected | no_show (backend-driven, kept loose)
  total_amount: number;
  payment_status?: string;
  location?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateBookingRequest {
  provider_id: string;
  service_id: string;
  scheduled_at: string;
  notes?: string;
}

// Wallet Types
export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  escrow_balance: number;
  pending_balance: number;
  currency: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'credit' | 'debit' | 'escrow' | 'release' | 'refund' | 'withdrawal';
  amount: number;
  description: string;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface WithdrawRequest {
  amount: number;
  bank_account: string;
  bank_code: string;
}

// Feed Types
export interface Post {
  id: string;
  user_id: string;
  user?: User;
  content: string;
  images?: string[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user?: User;
  content: string;
  created_at: string;
}

// Review Types
export interface Review {
  id: string;
  booking_id: string;
  provider_id: string;
  customer_id: string;
  customer?: User;
  customer_name?: string;
  rating: number;
  comment: string;
  images?: string[];
  created_at: string;
}

export interface CreateReviewRequest {
  booking_id: string;
  provider_id?: string;
  rating: number;
  comment: string;
  images?: string[];
}

// Availability Types
export interface DayAvailability {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  is_open: boolean;
  open_time: string; // "09:00"
  close_time: string; // "18:00"
}

export interface ProviderAvailability {
  days: DayAvailability[];
  blocked_dates: string[]; // ["2025-08-25"]
}

// Message Types
export interface Conversation {
  id: string;
  participant_ids: string[];
  participants?: User[];
  last_message?: Message;
  unread_count: number;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: User;
  content: string;
  type: 'text' | 'image' | 'system';
  is_read: boolean;
  created_at: string;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'booking' | 'payment' | 'message' | 'review' | 'system';
  data?: any;
  is_read: boolean;
  created_at: string;
}

// KYC Types
export interface KYCDocument {
  id: string;
  user_id: string;
  document_type: 'id_card' | 'passport' | 'drivers_license' | 'business_registration';
  document_number: string;
  document_image: string;
  selfie_image?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  submitted_at: string;
  verified_at?: string;
}

// Support Types
export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: 'general' | 'payment' | 'booking' | 'technical' | 'account';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

// Report Types
export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reported_user?: User;
  type: 'user' | 'post' | 'review';
  reason: string;
  description: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
}

// Admin Types
export interface PlatformStats {
  total_users: number;
  total_providers: number;
  total_bookings: number;
  total_revenue: number;
  pending_kyc: number;
  pending_withdrawals: number;
  active_disputes: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}