import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeService, ActiveThemes, SeasonTheme } from '../services/theme.service';

const CHOICE_KEY = '@istylist_season_choice'; // auto | default | <theme key>
const FX_KEY = '@istylist_season_fx';
const CACHE_KEY = '@istylist_season_cache';
const REFRESH_MS = 6 * 60 * 60 * 1000;

interface Ctx {
  theme: SeasonTheme | null;
  themes: SeasonTheme[];
  choice: string;
  setChoice: (v: string) => void;
  effectsOn: boolean;
  setEffectsOn: (v: boolean) => void;
}

const SeasonCtx = createContext<Ctx>({
  theme: null, themes: [], choice: 'auto', setChoice: () => {}, effectsOn: true, setEffectsOn: () => {},
});

export const useSeasonTheme = () => useContext(SeasonCtx);

export const SeasonThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [server, setServer] = useState<ActiveThemes>({ active: null, themes: [] });
  const [choice, setChoiceState] = useState('auto');
  const [effectsOn, setEffectsState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, fx, cache] = await Promise.all([
          AsyncStorage.getItem(CHOICE_KEY), AsyncStorage.getItem(FX_KEY), AsyncStorage.getItem(CACHE_KEY),
        ]);
        if (c) setChoiceState(c);
        if (fx === '0') setEffectsState(false);
        if (cache) setServer(JSON.parse(cache));
      } catch { /* ignore */ }
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await themeService.active();
      setServer(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch { /* keep cached */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const theme = useMemo(() => {
    if (choice === 'default') return null;
    if (choice === 'auto') return server.active;
    return server.themes.find((t) => t.key === choice) || server.active;
  }, [choice, server]);

  const setChoice = useCallback((v: string) => { setChoiceState(v); void AsyncStorage.setItem(CHOICE_KEY, v); }, []);
  const setEffectsOn = useCallback((v: boolean) => { setEffectsState(v); void AsyncStorage.setItem(FX_KEY, v ? '1' : '0'); }, []);

  const value = useMemo(
    () => ({ theme, themes: server.themes, choice, setChoice, effectsOn, setEffectsOn }),
    [theme, server.themes, choice, setChoice, effectsOn, setEffectsOn],
  );
  return <SeasonCtx.Provider value={value}>{children}</SeasonCtx.Provider>;
};
