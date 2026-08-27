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
  displayName?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  avatarUrl?: string | null;
  profileImage?: string | null;
  profile_image_url?: string | null;
  role: 'customer' | 'provider' | 'admin';
  role_raw?: string;
  is_verified: boolean;
  phone_verified?: boolean;
  profile_completed?: boolean;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  location?: string | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_urls?: string[] | null;
  stylist_auth_id?: string;
  approved?: boolean;
  category?: string | null;
  main_category?: string | null;
  subcategory?: string | null;
  featured_collection?: string | null;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  status?: string;
  created_at?: string;
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
  location_address?: string | null;
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
  profile_image_url?: string | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
  user?: {
    avatarUrl?: string | null;
    profileImage?: string | null;
    isKycVerified?: boolean;
  };
  businessName?: string;
  ratingCount?: number;
  avgRating?: number;
  reviewsCount?: number;
  isVerified?: boolean;
  isKycVerified?: boolean;
  firstName?: string;
  lastName?: string;
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
  duration_minutes?: number; // alternative field name
  category?: string;
  is_active: boolean;
  in_store?: boolean;
  home_service?: boolean;
}

export interface StaffAvailabilityDay {
  day_of_week: number;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface StaffMember {
  id: string;
  business_auth_id?: string;
  name: string;
  role?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  is_active: boolean;
  display_order?: number;
  service_ids?: number[];
  weekly?: StaffAvailabilityDay[];
  created_at?: string;
  updated_at?: string;
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
  customer_name?: string;
  customer_profile_image_url?: string | null;
  customer_address?: string | null;
  provider_avatar?: string;
  service?: Service;
  provider?: Provider;
  customer?: User;
  scheduled_at: string; // ISO datetime (derived for backward compatibility)
  date: string; // derived, YYYY-MM-DD - sourced from booking_date when present
  time: string; // derived, e.g. "10:00" - sourced from booking_time when present
  total_duration?: number; // minutes, matches web's booking.total_duration
  services?: BookingServiceLine[]; // real `services` array from the booking response
  status: string; // GROUND TRUTH (web STATUS_CONFIG): pending_payment | pending | confirmed | completed | canceled | declined | no_show_pending | user_no_show | provider_no_show | disputed
  total_amount: number;
  platform_fee_amount?: number;
  payment_status?: string;
  location?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface BookingServiceLine {
  service_id?: string | number;
  service_name: string;
  duration_minutes?: number;
  price?: number;
}

// GROUND TRUTH (Phase 6 - verified against production web app source,
// frontend/src/screens/ProviderProfileScreen.jsx handleConfirmBooking):
// the real create-booking payload is NOT { provider_id, service_id,
// scheduled_at } - it is:
export interface CreateBookingRequest {
  provider_id?: number;
  providerId?: number | string;
  customer_id?: string | number;
  customer_auth_id?: string;
  booking_date?: string; // "YYYY-MM-DD"
  booking_time?: string; // raw slot string returned by available-slots, e.g. "10:00"
  service_ids?: number[]; // array, even for a single service
  service_id?: number | string;
  serviceId?: number | string;
  staffId?: string | number | null;
  scheduledAt?: string;
  totalAmount?: number;
  paymentMethod?: string;
  service_duration_minutes?: number;
  notes?: string;
  status?: string; // web sends "pending_payment" explicitly
  staff_id?: string; // only included when a specific staff member was picked
}

// Wallet Types
// Production shape confirmed via direct API probe:
//   GET /api/wallets -> [{ id, user_auth_id, balance }, ...] (no per-user filter
//   param exists server-side, so the app fetches all and matches by auth_id).
export interface Wallet {
  id: string;
  user_auth_id: string;
  balance: number;
}

// GET /api/wallet/transactions?auth_id={uuid} real shape (confirmed via probe):
//   { id, type, direction, amount, description, created_at, booking_id,
//     reference, status, raw_type }
// `type`/`status` are kept as open strings (not a strict union) because only
// "WITHDRAWAL" was directly observed in production data - other types
// (BOOKING_PAYMENT, TOPUP, REFUND, ESCROW_HOLD, ESCROW_RELEASE, ADJUSTMENT,
// PLATFORM_CREDIT) are handled defensively in the UI so an unexpected/new
// value never crashes the app, it just falls back to a generic label.
export interface Transaction {
  id: string;
  type: string;
  direction: 'CREDIT' | 'DEBIT' | string;
  amount: number;
  description: string;
  created_at: string;
  booking_id: string | null;
  reference: string;
  status: string;
}

export interface WithdrawRequest {
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  currency?: string;
  user_id?: string;
}

// Derived client-side (the production API has no dedicated payment_status /
// escrow field on bookings) from real booking.status + matching wallet
// transactions filtered by booking_id.
export type BookingPaymentStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'escrow'
  | 'completed'
  | 'released'
  | 'refunded'
  | 'cancelled';

// Feed Types
export interface Post {
  id: string;
  user_id: string;
  user?: User;
  content?: string;
  caption?: string;
  images?: string[];
  image_url?: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  liked_by_me?: boolean;
  is_active?: boolean;
  approved?: boolean;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  status?: string;
  provider_auth_id?: string;
  provider?: {
    id: string;
    auth_id?: string;
    avatarUrl?: string | null;
    profileImage?: string | null;
    businessName?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    display_name?: string;
    business_name?: string;
    full_name?: string;
    photo_url?: string;
    profile_image_url?: string | null;
    avatar?: string;
  };
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
  comment?: string;
  review_text?: string;
  images?: string[];
}

export interface ProductReview {
  id: number;
  product_id: number;
  user_id: string;
  user_full_name: string;
  user_avatar?: string | null;
  rating: number;
  review_text: string;
  created_at: string;
  verified_purchase: boolean;
}

export interface ProductReviewsResponse {
  reviews: ProductReview[];
  average_rating: number;
  review_count: number;
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

// Message Types - Booking-based chat to match web implementation
export interface Conversation {
  id: number; // booking_id
  booking_id: number;
  counterpart_auth_id: string;
  counterpart_name?: string;
  counterpart_profile_image_url?: string | null;
  provider?: {
    avatarUrl?: string | null;
    profileImage?: string | null;
    businessName?: string;
    firstName?: string;
    lastName?: string;
  };
  user?: {
    avatarUrl?: string | null;
  };
  last_message: ChatMessage;
  unread_count: number;
}

export interface ChatMessage {
  id: number;
  booking_id: number;
  sender_auth_id: string;
  receiver_auth_id: string;
  message: string;
  message_type?: 'TEXT' | 'IMAGE' | 'LOCATION' | 'CUSTOM_INVOICE' | 'SYSTEM_ALERT';
  is_masked?: boolean;
  original_content?: string | null;
  location_data?: {
    latitude: number;
    longitude: number;
    addressName?: string | null;
  } | null;
  invoice_data?: {
    amount: number;
    serviceDetails?: string;
    platformFee?: number;
    netPayout?: number;
    status?: string;
    paymentReference?: string | null;
  } | null;
  read: boolean;
  is_read?: boolean;
  created_at: string;
  read_at?: string;
}

export interface ChatParticipants {
  customer_auth_id: string;
  provider_auth_id: string;
}

// Legacy Message interface for backward compatibility
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
  target_id?: string;
  target_type?: 'POST' | 'PRODUCT';
  reported_id?: string;
  reported_user?: User;
  type?: 'user' | 'post' | 'review';
  reason: string;
  description?: string;
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