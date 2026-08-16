import apiService from './api';
import { StaffMember, StaffAvailabilityDay } from '../types';

const asList = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  return raw?.staff || raw?.data || raw?.results || [];
};

export const staffService = {
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

  async setAvailability(staffId: string, authId: string, weekly: StaffAvailabilityDay[]): Promise<StaffAvailabilityDay[]> {
    const raw = await apiService.put<any>(`/staff/${staffId}/availability`, { weekly }, {
      params: { auth_id: authId },
    });
    return Array.isArray(raw?.weekly) ? raw.weekly : [];
  },

  async get(staffId: string): Promise<StaffMember> {
    const raw = await apiService.get<any>(`/staff/${staffId}`);
    return {
      ...raw,
      id: String(raw.id),
      is_active: !!raw.is_active,
      service_ids: Array.isArray(raw.service_ids) ? raw.service_ids.map(Number) : [],
      weekly: Array.isArray(raw.weekly) ? raw.weekly : [],
    };
  },

  async getAvailableSlots(staffId: string, date: string, serviceDuration: number): Promise<string[]> {
    const raw = await apiService.get<any>(`/staff/${staffId}/available-slots`, {
      params: { date, service_duration: serviceDuration },
    });
    return Array.isArray(raw) ? raw : raw?.slots || raw?.data || [];
  },
};

export default staffService;
