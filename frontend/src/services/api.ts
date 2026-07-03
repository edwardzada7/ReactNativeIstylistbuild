import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8001/api';

// The production business-logic API (mongo-supabase-api.emergent.host) is a
// separate service from Supabase Auth. Authentication (signup/login/session/
// refresh) is handled entirely by Supabase (see src/lib/supabase.ts and
// src/services/auth.service.ts). This client's only job is to attach the
// current Supabase access token to every request so the backend can identify
// the caller, and to surface network/API errors consistently.
class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (err) {
          console.warn('[api] failed to attach auth token', err);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Surface a friendlier, consistent error shape for offline/timeout cases.
        if (!error.response) {
          error.friendlyMessage = 'Network error. Please check your connection and try again.';
        } else if (error.response.status >= 500) {
          error.friendlyMessage = 'Something went wrong on our end. Please try again shortly.';
        } else {
          error.friendlyMessage =
            error.response.data?.detail || error.response.data?.message || 'Request failed.';
        }
        return Promise.reject(error);
      }
    );
  }

  /** Returns the current Supabase auth user id (used as `auth_id` by the business API). */
  async getAuthId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
