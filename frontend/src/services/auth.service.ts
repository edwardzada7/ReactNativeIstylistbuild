import apiService from './api';
import { AuthResponse, LoginRequest, SignupRequest, OTPRequest, User } from '../types';

export const authService = {
  // Login
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return await apiService.post<AuthResponse>('/auth/login', credentials);
  },

  // Signup
  async signup(data: SignupRequest): Promise<AuthResponse> {
    return await apiService.post<AuthResponse>('/auth/signup', data);
  },

  // Verify OTP
  async verifyOTP(data: OTPRequest): Promise<AuthResponse> {
    return await apiService.post<AuthResponse>('/auth/verify-otp', data);
  },

  // Resend OTP
  async resendOTP(email: string): Promise<void> {
    return await apiService.post('/auth/resend-otp', { email });
  },

  // Forgot Password
  async forgotPassword(email: string): Promise<void> {
    return await apiService.post('/auth/forgot-password', { email });
  },

  // Reset Password
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    return await apiService.post('/auth/reset-password', {
      email,
      code,
      new_password: newPassword,
    });
  },

  // Get current user
  async getCurrentUser(): Promise<User> {
    return await apiService.get<User>('/auth/me');
  },

  // Logout
  async logout(): Promise<void> {
    await apiService.post('/auth/logout');
    await apiService.clearTokens();
  },

  // Refresh token
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return await apiService.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken });
  },
};