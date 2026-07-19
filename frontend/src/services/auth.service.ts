import { supabase } from '../lib/supabase';
import apiService from './api';
import { User } from '../types';

// UI shows 'provider'; the production `users` table stores 'stylist'.
const ROLE_TO_BACKEND: Record<string, string> = {
  provider: 'stylist',
  customer: 'customer',
};
const ROLE_FROM_BACKEND: Record<string, 'customer' | 'provider' | 'admin'> = {
  stylist: 'provider',
  provider: 'provider', // defensive: some accounts may already store 'provider' literally
  customer: 'customer',
  user: 'customer',
  admin: 'admin',
};

export function mapProfile(raw: any): User {
  return {
    id: String(raw?.id ?? ''),
    auth_id: raw?.auth_id ?? '',
    email: raw?.email ?? '',
    full_name: raw?.name ?? raw?.full_name ?? '',
    name: raw?.name,
    phone: raw?.phone ?? undefined,
    role: ROLE_FROM_BACKEND[raw?.role] || 'customer',
    role_raw: raw?.role,
    is_verified: !!raw?.phone_verified,
    phone_verified: raw?.phone_verified,
    profile_completed: raw?.profile_completed,
    country: raw?.country,
    city: raw?.city,
    gender: raw?.gender,
    account_type: raw?.account_type,
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
  };
}

// Ensures a provider always has a matching `stylists` row (needed for
// Portfolio, since stylists.portfolio is the official field per the Phase 3
// backend audit). RLS-verified: a provider can insert/upsert their own row
// (auth.uid() = auth_id on the new row). `ignoreDuplicates: true` makes
// this a pure "create if missing" - it will NEVER touch an existing row's
// portfolio/bio/rating on subsequent logins.
async function ensureStylistRow(userId: string, authId: string) {
  try {
    const { error } = await supabase
      .from('stylists')
      .upsert({ user_id: Number(userId), auth_id: authId }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error) console.warn('[ensureStylistRow] upsert failed:', error.message);
  } catch (err) {
    console.warn('[ensureStylistRow] unexpected error:', err);
  }
}

export const authService = {
  /**
   * Fetches the business-API profile for a Supabase auth user, creating it
   * on first login/signup if it doesn't exist yet (production API returns
   * 404 in that case).
   */
  async ensureProfile(authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }): Promise<User> {
    try {
      const profile = await apiService.get(`/users/by-auth/${authUser.id}`);
      const mapped = mapProfile(profile);
      if (mapped.role === 'provider') await ensureStylistRow(mapped.id, authUser.id);
      return mapped;
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;

      const meta = authUser.user_metadata || {};
      const backendRole = ROLE_TO_BACKEND[meta.role] || meta.role || 'customer';
      const created = await apiService.post('/users', {
        auth_id: authUser.id,
        name: meta.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        phone: meta.phone || undefined,
        role: backendRole,
      });
      const mapped = mapProfile(created);
      if (mapped.role === 'provider') await ensureStylistRow(mapped.id, authUser.id);
      return mapped;
    }
  },

  // Login
  async login({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Signup - stores full_name/phone/role in Supabase user_metadata so the
  // profile can be created later (immediately, or after OTP verification)
  // without needing to re-collect the form data.
  async signup({
    email,
    password,
    full_name,
    phone,
    role,
  }: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role } },
    });
    if (error) throw error;
    return data; // data.session is null if email confirmation is required
  },

  // Verify OTP (email confirmation code sent on signup)
  async verifyOTP({ email, code }: { email: string; code: string }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    });
    if (error) throw error;
    return data;
  },

  // Resend signup confirmation OTP
  async resendOTP(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  // Forgot Password - sends a Supabase recovery email
  async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  // Verify a password-recovery OTP and set a new password
  async resetPassword(email: string, code: string, newPassword: string) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (verifyError) throw verifyError;

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
  },

  // Change password while already logged in (re-verifies the current
  // password via a real sign-in call first, then updates via Supabase's
  // own supabase.auth.updateUser - same underlying call resetPassword()
  // already uses below, just without the OTP step since the user is
  // already authenticated). No new/custom backend endpoint involved.
  async changePassword(email: string, currentPassword: string, newPassword: string) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) throw verifyError;

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
  },

  // Get current Supabase session
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  // Logout
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
