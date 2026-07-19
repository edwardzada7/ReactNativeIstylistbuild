import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8001/api';

// This app's OWN local backend (this repo's backend/server.py) is reached
// via the platform's standard ingress rule: any request to `<current
// host>/api/*` is routed to the service on port 8001, on every
// environment (dev preview or a real deployment) - not a hardcoded
// URL/port, just the documented convention for this app. Used ONLY for
// the 2 privileged Shop/Chat writes that Supabase RLS blocks directly;
// everything else keeps using API_BASE_URL (the external production API)
// or the Supabase client directly.
const getLocalApiBase = (): string => {
  if (Platform.OS === 'web') return '/api';
  const hostUri = (Constants.expoConfig as any)?.hostUri || (Constants as any).expoGoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `https://${host}/api`;
  }
  return 'http://localhost:8001/api';
};

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
        // CRITICAL: `error.friendlyMessage` must ALWAYS end up a string. FastAPI
        // returns validation errors as `detail: [{ loc, msg, type }, ...]` (an
        // array) or, for other errors, `detail` as an object. Passing anything
        // other than a string into `Alert.alert(title, message)` throws a
        // native-side type error that crashes the app immediately (this was the
        // root cause of the Submit Review and Save Availability crashes - both
        // endpoints returned a 422 with an array `detail`). Always reduce to a
        // safe string here so no caller can ever crash on this.
        if (!error.response) {
          error.friendlyMessage = 'Network error. Please check your connection and try again.';
        } else if (error.response.status >= 500) {
          error.friendlyMessage = 'Something went wrong on our end. Please try again shortly.';
        } else {
          const detail = error.response.data?.detail ?? error.response.data?.message;
          if (typeof detail === 'string' && detail.trim()) {
            error.friendlyMessage = detail;
          } else if (Array.isArray(detail)) {
            const messages = detail
              .map((d: any) => (typeof d === 'string' ? d : d?.msg))
              .filter(Boolean);
            error.friendlyMessage = messages.length > 0 ? messages.join(', ') : 'Request failed.';
          } else if (detail && typeof detail === 'object') {
            error.friendlyMessage = detail.msg || 'Request failed.';
          } else {
            error.friendlyMessage = 'Request failed.';
          }
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

// Minimal second client for the 2 privileged local endpoints (Shop order
// creation, Chat message sending). Same auth-token interceptor pattern as
// the main client, just a different base URL.
class LocalApiService {
  private client: AxiosInstance;
  constructor() {
    this.client = axios.create({ baseURL: getLocalApiBase(), timeout: 15000 });
    this.client.interceptors.request.use(async (config) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }
  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }
}
export const localApiService = new LocalApiService();
