import apiService from './api';

export interface SponsoredItem {
  promotion_id: number | string;
  type: 'profile' | 'service' | 'product' | 'post';
  target_id: string;
  provider_id: number;
  provider_name?: string;
  title?: string;
  image?: string | null;
  price?: number | null;
  city?: string | null;
  is_pro?: boolean;
}

let proCache: { at: number; ids: Set<string> } | null = null;

export const promoService = {
  /** Providers with an active Pro plan (public list that drives the PRO badge). Cached for 5 minutes. */
  async getProIds(): Promise<Set<string>> {
    if (proCache && Date.now() - proCache.at < 5 * 60 * 1000) return proCache.ids;
    try {
      const res = await apiService.get<any>('/promo/pro-providers');
      const ids = new Set<string>((res?.auth_ids || []).map(String));
      proCache = { at: Date.now(), ids };
      return ids;
    } catch {
      return proCache?.ids || new Set<string>();
    }
  },

  async getSponsored(types: string, limit = 6, areaId?: number | null): Promise<SponsoredItem[]> {
    try {
      const qs = `types=${encodeURIComponent(types)}&limit=${limit}${areaId ? `&area_id=${areaId}` : ''}`;
      const res = await apiService.get<any>(`/promo/sponsored?${qs}`);
      return Array.isArray(res?.items) ? res.items : [];
    } catch {
      return [];
    }
  },

  /** Boosted posts (full post objects) to mix into the feed. */
  async getSponsoredPosts(limit = 3): Promise<any[]> {
    try {
      const res = await apiService.get<any>(`/feed/sponsored?limit=${limit}`);
      return Array.isArray(res?.posts) ? res.posts : [];
    } catch {
      return [];
    }
  },
};
