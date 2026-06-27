// User Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar?: string;
  role: 'customer' | 'provider' | 'admin';
  is_verified: boolean;
  created_at: string;
  updated_at: string;
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
  category?: Category;
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
}

// Booking Types
export interface Booking {
  id: string;
  customer_id: string;
  provider_id: string;
  service_id: string;
  service?: Service;
  provider?: Provider;
  customer?: User;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'refunded' | 'escrowed';
  location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingRequest {
  provider_id: string;
  service_id: string;
  date: string;
  time: string;
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
  rating: number;
  comment: string;
  images?: string[];
  created_at: string;
}

export interface CreateReviewRequest {
  booking_id: string;
  rating: number;
  comment: string;
  images?: string[];
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