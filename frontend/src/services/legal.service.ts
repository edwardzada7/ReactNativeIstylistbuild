import apiService from './api';

export interface LegalPage {
  id: number;
  slug: string;
  title: string;
  content: string;
}

/**
 * Legal Pages (Phase 3A). Both endpoints already exist and work on the
 * production API (verified via direct probe: GET /api/legal/terms -> 200,
 * GET /api/legal/privacy -> 200, backed by the real `legal_pages` table).
 * No backend work needed - just wiring the frontend to consume them.
 */
export const legalService = {
  async getTerms(): Promise<LegalPage> {
    return await apiService.get<LegalPage>('/legal/terms');
  },
  async getPrivacy(): Promise<LegalPage> {
    return await apiService.get<LegalPage>('/legal/privacy');
  },
};
