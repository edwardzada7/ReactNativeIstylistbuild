import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth.service';
import { User } from '../types';
import { useCartStore } from '../store/cartStore';
import { screenCache } from '../utils/screenCache';
import { peopleService } from '../services/people.service';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isProvider: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User | null>;
  signup: (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role: string;
  }) => Promise<{ needsVerification: boolean; user: User | null }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Last known profile, saved per account so a cold start can show the app straight
// away instead of waiting on a backend round trip (which on a slow connection or a
// sleeping server is what made the app feel stuck on the loading screen). The
// fresh profile still loads in the background and replaces it. AsyncStorage is
// wiped on logout, so one account's profile is never shown to another.
const PROFILE_CACHE_PREFIX = 'istylist_profile_cache_v1_';

const readCachedProfile = async (authId: string): Promise<User | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${PROFILE_CACHE_PREFIX}${authId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    return parsed && parsed.auth_id === authId ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedProfile = async (profile: User): Promise<void> => {
  try {
    if (!profile?.auth_id) return;
    await AsyncStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.auth_id}`, JSON.stringify(profile));
  } catch {
    // Cache is best-effort only.
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  // Shares one in-flight profile load between the startup code and the
  // INITIAL_SESSION auth event, which used to each make the same backend calls.
  const inflightRef = useRef<{ id: string; promise: Promise<User | null> } | null>(null);
  // Prevents overlapping ensureProfile calls (e.g. INITIAL_SESSION + a
  // near-simultaneous TOKEN_REFRESHED event) from racing each other.
  const hydratingRef = useRef<Promise<void> | null>(null);
  const previousCartSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const cartSession = user ? `${user.id}_${user.role}` : null;
    const previousCartSession = previousCartSessionRef.current;
    if (previousCartSession && previousCartSession !== cartSession) {
      useCartStore.getState().clearCart();
    }
    previousCartSessionRef.current = cartSession;
    void useCartStore.getState().setSession(user?.id ?? null, user?.role ?? null);
  }, [user?.id, user?.role]);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleProfileRetry = (retrySession: Session, attempt: number) => {
    if (attempt >= 4) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      if (userRef.current && userRef.current.auth_id !== retrySession.user.id) return;
      try {
        const profile = await authService.ensureProfile(retrySession.user);
        setUser(profile);
        void writeCachedProfile(profile);
      } catch {
        scheduleProfileRetry(retrySession, attempt + 1);
      }
    }, 3000 * (attempt + 1));
  };

  const loadProfileForSession = async (nextSession: Session | null): Promise<User | null> => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setUser(null);
      return null;
    }
    try {
      const profile = await authService.ensureProfile(nextSession.user);
      setUser(profile);
      void writeCachedProfile(profile);
      return profile;
    } catch (error) {
      // Web parity (frontend/src/contexts/AuthContext.jsx loadUser/
      // ensureUserExists): the production web app NEVER blocks sign-in on
      // a backend profile-fetch/create failure - it only logs the error
      // and falls back to the Supabase auth user's own metadata (role,
      // full_name) so the session the customer/provider already has with
      // Supabase is never wasted. Mirrored here instead of throwing.
      console.error('[auth] failed to load/create profile, using session fallback:', error);
      // Prefer the last real profile over a metadata guess, so a flaky connection
      // never downgrades a provider to a customer or blanks their name/photo.
      const cachedProfile = userRef.current?.auth_id === nextSession.user.id
        ? userRef.current
        : await readCachedProfile(nextSession.user.id);
      if (cachedProfile) {
        setUser(cachedProfile);
        return cachedProfile;
      }
      const meta = (nextSession.user.user_metadata || {}) as Record<string, any>;
      const fallbackRole: User['role'] =
        meta.role === 'stylist' || meta.role === 'provider' ? 'provider' : 'customer';
      const fallbackProfile: User = {
        id: nextSession.user.id,
        auth_id: nextSession.user.id,
        email: nextSession.user.email || '',
        full_name: meta.full_name || nextSession.user.email?.split('@')[0] || 'User',
        phone: meta.phone,
        role: fallbackRole,
        role_raw: meta.role,
        is_verified: false,
        profile_image_url: undefined,
        latitude: undefined,
        longitude: undefined,
        location_address: undefined,
      };
      setUser(fallbackProfile);
      // The metadata guess can be wrong (it has no role for many accounts), which is how a
      // provider ended up in the customer app. Keep trying for the real profile.
      scheduleProfileRetry(nextSession, 0);
      return fallbackProfile;
    }
  };

  // `shareInflight` lets the startup code and the auth listener reuse one load for
  // the same account. login()/refreshUser() leave it off so they always fetch fresh.
  const hydrateFromSession = (nextSession: Session | null, shareInflight = false): Promise<User | null> => {
    const id = nextSession?.user?.id;
    if (shareInflight && id && inflightRef.current?.id === id) {
      setSession(nextSession);
      return inflightRef.current.promise;
    }
    const promise: Promise<User | null> = loadProfileForSession(nextSession).finally(() => {
      if (inflightRef.current?.promise === promise) inflightRef.current = null;
    });
    if (id) inflightRef.current = { id, promise };
    return promise;
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      // Fast start: if we already know this account's profile, open the app now
      // and refresh the profile in the background.
      const authId = data.session?.user?.id;
      const cached = authId ? await readCachedProfile(authId) : null;
      if (!mounted) return;
      if (data.session && cached) {
        setSession(data.session);
        setUser(cached);
        setIsLoading(false);
        void hydrateFromSession(data.session, true);
        return;
      }

      await hydrateFromSession(data.session, true);
      if (mounted) setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Fire-and-forget: keep the listener callback itself synchronous.
      const run = async () => {
        if (event === 'SIGNED_OUT') {
          screenCache.clear();
          peopleService.invalidate();
          setSession(null);
          setUser(null);
          return;
        }
        // A silent token refresh (roughly hourly) doesn't change who the user is,
        // so don't refetch the profile for it.
        if (event === 'TOKEN_REFRESHED' && nextSession?.user && userRef.current?.auth_id === nextSession.user.id) {
          setSession(nextSession);
          return;
        }
        await hydrateFromSession(nextSession, true);
      };
      hydratingRef.current = run();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    screenCache.clear();
    peopleService.invalidate();
    const data = await authService.login(credentials);
    return hydrateFromSession(data.session);
  };

  const signup = async (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role: string;
  }) => {
    const result = await authService.signup(data);
    if (result.session) {
      const profile = await hydrateFromSession(result.session);
      return { needsVerification: false, user: profile };
    }
    return { needsVerification: true, user: null };
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      useCartStore.getState().clearCart();
      // Drop every per-account in-memory cache so the next account never sees
      // the previous account's messages/bookings/names.
      screenCache.clear();
      peopleService.invalidate();
      try {
        await AsyncStorage.clear();
      } catch (err) {
        console.warn('[auth] AsyncStorage clear failed during logout', err);
      }
      try {
        await SecureStore.deleteItemAsync('istylist_supabase_encryption_key');
      } catch (err) {
        console.warn('[auth] SecureStore clear failed during logout', err);
      }
      setSession(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    return hydrateFromSession(data.session);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        isProvider: user?.role === 'provider',
        login,
        signup,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
