import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/theme';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof Colors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_THEME_STORAGE_KEY = '@istylist_theme_mode';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = user?.auth_id ? `@istylist_theme_mode:${user.auth_id}` : DEFAULT_THEME_STORAGE_KEY;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(storageKey);
        if (savedMode === 'dark' || savedMode === 'light') {
          setMode(savedMode);
        } else {
          setMode('light');
        }
      } catch (error) {
        console.error('[ThemeContext] Failed to load theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    loadTheme();
  }, [storageKey]);

  const saveTheme = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(storageKey, newMode);
    } catch (error) {
      console.error('[ThemeContext] Failed to save theme:', error);
    }
  };

  const toggleTheme = () => {
    const newMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    saveTheme(newMode);
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    saveTheme(newMode);
  };

  // Get colors based on current mode
  const colors = mode === 'dark' ? {
    ...Colors,
    background: Colors.dark.background,
    surface: Colors.dark.surface,
    surfaceLight: Colors.dark.surfaceLight,
    text: Colors.dark.text,
    textSecondary: Colors.dark.textSecondary,
    border: Colors.dark.border,
  } : {
    ...Colors,
    background: Colors.light.background,
    surface: Colors.light.surface,
    surfaceLight: Colors.light.surfaceLight,
    text: Colors.light.text,
    textSecondary: Colors.light.textSecondary,
    border: Colors.light.border,
  };

  // Don't render children until theme is loaded to prevent flash
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors,
        isDark: mode === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
