import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://updatedistylistbeauty-marketplace-production.up.railway.app/api';

// Pulls a readable reason out of whatever error body the server sent: FastAPI
// `detail` (string | array of { msg } | object), `message`, `error`, `errors`,
// or a bare string body. Always returns a short plain string (or '') so it is
// safe to pass straight into Alert.alert. Previously anything other than a
// string/array `detail` collapsed to the useless "Request failed.".
function extractServerMessage(data: any): string {
  const toText = (value: any): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      return value
        .map((item) => toText(typeof item === 'object' && item ? item.msg ?? item.message ?? item.error : item))
        .filter(Boolean)
        // FastAPI repeats the same message once per invalid field - show it once.
        .filter((text, index, all) => all.indexOf(text) === index)
        .join(', ');
    }
    if (typeof value === 'object') {
      return toText(value.msg ?? value.message ?? value.error ?? value.detail ?? value.reason);
    }
    return String(value);
  };
  // Gateways (Railway, nginx) sometimes answer with an HTML error page - not user-readable.
  if (typeof data === 'string' && /^\s*</.test(data)) return '';
  const text = toText(data?.detail) || toText(data?.message) || toText(data?.error) || toText(data?.errors) || toText(data);
  // Strip pydantic's "Value error, " prefix and keep alerts a sane length.
  const cleaned = text.replace(/Value error,\s*/gi, '').trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

// The production business-logic API is a separate service from Supabase
// Auth. Authentication (signup/login/session/refresh) is handled entirely
// by Supabase (see src/lib/supabase.ts and src/services/auth.service.ts).
// This client's only job is to attach the current Supabase access token to
// every request so the backend can identify the caller, and to surface
// network/API errors consistently.
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
        } else {
          const status = error.response.status;
          const reason = extractServerMessage(error.response.data);
          if (status >= 500) {
            // Keep the friendly wording, but include the server's own reason when it
            // gave one, so "Something went wrong" is no longer a dead end.
            error.friendlyMessage = reason
              ? `Something went wrong on our end (${reason}). Please try again shortly.`
              : 'Something went wrong on our end. Please try again shortly.';
          } else {
            error.friendlyMessage = reason || `Request failed (${status}).`;
          }
          console.warn('[api] request failed', {
            method: error.config?.method,
            url: error.config?.url,
            status,
            data: error.response.data,
          });
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

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
