import { apiService } from './api';

export interface SeasonTheme {
  key: string;
  name: string;
  emoji: string;
  effect: 'snow' | 'hearts' | 'confetti' | 'stars' | null;
  primary: Record<string, string>;
  secondary: Record<string, string>;
  banner_title: string;
  banner_text: string;
}

export interface ActiveThemes {
  active: SeasonTheme | null;
  themes: SeasonTheme[];
}

export const themeService = {
  async active(): Promise<ActiveThemes> {
    const res = await apiService.get<any>('/themes/active');
    return { active: res?.active ?? null, themes: Array.isArray(res?.themes) ? res.themes : [] };
  },
};
