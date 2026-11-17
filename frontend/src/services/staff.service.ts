import apiService from './api';
import { supabase } from '../lib/supabase';
import { StaffMember, StaffAvailabilityDay } from '../types';
import { normalizeSlots, normalizeTime, normalizeTimeOr, validateTimeRange } from '../utils/time';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.staff || raw?.data || raw?.results || [];
};

// Times arrive from Postgres as "HH:MM:SS"; the API only accepts "HH:MM" back.
const normalizeWeekly = (weekly: any): StaffAvailabilityDay[] =>
  (Array.isArray(weekly) ? weekly : []).map((day: any) => ({
    ...day,
    day_of_week: Number(day.day_of_week),
    is_available: day.is_available !== undefined ? !!day.is_available : day.is_active !== false,
    start_time: normalizeTime(day.start_time) ?? day.start_time ?? null,
    end_time: normalizeTime(day.end_time) ?? day.end_time ?? null,
  }));

const toStaff = (raw: any): StaffMember => ({
  ...raw,
  id: String(raw.id),
  is_active: !!raw.is_active,
  service_ids: Array.isArray(raw.service_ids) ? raw.service_ids.map(Number) : [],
  weekly: normalizeWeekly(raw.weekly),
});

// The backend /staff endpoints only accept JSON (StaffCreate / StaffUpdate with
// photo_url). Photos are uploaded to Supabase storage first, same bucket as
// profile photos, and the public URL is sent as photo_url.
async function uploadStaffPhoto(authId: string, uri?: string): Promise<string | undefined> {
  if (!uri || /^https?:\/\//.test(uri)) return uri || undefined;
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
    throw Object.assign(new Error('Image too large'), { friendlyMessage: 'Please choose an image smaller than 5 MB.' });
  }
  const path = `staff/${authId}/staff-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('profile-images').upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw Object.assign(error, { friendlyMessage: 'Could not upload the photo. Please try again.' });
  return supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl;
}

export const staffService = {
    async createMultipart(authId: string, payload: { name: string; role: string; bio: string; service_ids: number[]; photoUri?: string; is_active?: boolean }): Promise<StaffMember> {
      const photo_url = await uploadStaffPhoto(authId, payload.photoUri);
      const raw = await apiService.post<any>('/staff', {
        name: payload.name,
        role: payload.role || null,
        bio: payload.bio || null,
        service_ids: payload.service_ids || [],
        is_active: payload.is_active ?? true,
        ...(photo_url ? { photo_url } : {}),
      }, { params: { auth_id: authId } });
      return toStaff(raw);
    },

    async updateMultipart(staffId: string, authId: string, payload: { name: string; role: string; bio: string; service_ids: number[]; photoUri?: string; is_active?: boolean }): Promise<StaffMember> {
      const photo_url = await uploadStaffPhoto(authId, payload.photoUri);
      const raw = await apiService.put<any>(`/staff/${staffId}`, {
        name: payload.name,
        role: payload.role || null,
        bio: payload.bio || null,
        // Visibility toggle must be sent, otherwise "Visible to customers" never saves.
        ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
        ...(photo_url ? { photo_url } : {}),
      }, { params: { auth_id: authId } });
      return toStaff(raw);
    },
  async listMine(authId: string, includeInactive = true): Promise<StaffMember[]> {
    const raw = await apiService.get<any>('/staff/me', {
      params: { auth_id: authId, include_inactive: includeInactive },
    });
    const list = asList(raw);
    return list.map((item: any) => ({
      ...item,
      id: String(item.id),
      is_active: !!item.is_active,
      service_ids: Array.isArray(item.service_ids) ? item.service_ids.map(Number) : [],
      weekly: Array.isArray(item.weekly) ? item.weekly : [],
    }));
  },

  async create(authId: string, payload: Partial<StaffMember> & { service_ids?: number[] }): Promise<StaffMember> {
    const raw = await apiService.post<any>('/staff', {
      ...payload,
      service_ids: payload.service_ids || [],
    }, {
      params: { auth_id: authId },
    });
    return {
      ...raw,
      id: String(raw.id),
      is_active: !!raw.is_active,
      service_ids: Array.isArray(raw.service_ids) ? raw.service_ids.map(Number) : [],
      weekly: Array.isArray(raw.weekly) ? raw.weekly : [],
    };
  },

  async update(staffId: string, authId: string, payload: Partial<StaffMember>): Promise<StaffMember> {
    const raw = await apiService.put<any>(`/staff/${staffId}`, {
      ...payload,
      is_active: payload.is_active,
    }, {
      params: { auth_id: authId },
    });
    return {
      ...raw,
      id: String(raw.id),
      is_active: !!raw.is_active,
      service_ids: Array.isArray(raw.service_ids) ? raw.service_ids.map(Number) : [],
      weekly: Array.isArray(raw.weekly) ? raw.weekly : [],
    };
  },

  async remove(staffId: string, authId: string, hard = false): Promise<void> {
    await apiService.delete(`/staff/${staffId}`, {
      params: { auth_id: authId, hard },
    });
  },

  async setServices(staffId: string, authId: string, serviceIds: number[]): Promise<number[]> {
    const raw = await apiService.put<any>(`/staff/${staffId}/services`, { service_ids: serviceIds }, {
      params: { auth_id: authId },
    });
    return Array.isArray(raw?.service_ids) ? raw.service_ids.map(Number) : [];
  },

  // The backend rejects every row whose times are not strict 24h "HH:MM" with
  // "Value error, Time must be in HH:MM format" (once per field, so a full week
  // produced 14 identical errors). Stored schedules come back as "HH:MM:SS", and
  // the whole week was re-sent as-is, so saving always failed. Every row is now
  // normalized here, and a genuinely bad value is reported by day instead.
  async setAvailability(staffId: string, authId: string, weekly: StaffAvailabilityDay[]): Promise<StaffAvailabilityDay[]> {
    const payload = weekly.map((day) => {
      const label = DAY_LABELS[day.day_of_week] ?? `Day ${day.day_of_week}`;
      if (day.is_available) {
        const problem = validateTimeRange(label, day.start_time, day.end_time);
        if (problem) throw Object.assign(new Error(problem), { friendlyMessage: problem });
      }
      return {
        day_of_week: day.day_of_week,
        is_available: !!day.is_available,
        start_time: normalizeTimeOr(day.start_time, '09:00'),
        end_time: normalizeTimeOr(day.end_time, '17:00'),
      };
    });
    const raw = await apiService.put<any>(`/staff/${staffId}/availability`, { weekly: payload }, {
      params: { auth_id: authId },
    });
    return Array.isArray(raw?.weekly) ? normalizeWeekly(raw.weekly) : [];
  },

  async get(staffId: string): Promise<StaffMember> {
    const raw = await apiService.get<any>(`/staff/${staffId}`);
    return toStaff(raw);
  },

  async getAvailableSlots(staffId: string, date: string, serviceDuration: number): Promise<string[]> {
    const raw = await apiService.get<any>(`/staff/${staffId}/available-slots`, {
      params: { date, service_duration: serviceDuration },
    });
    return normalizeSlots(raw);
  },
};

export default staffService;
