import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth.service';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Prevents overlapping ensureProfile calls (e.g. INITIAL_SESSION + a
  // near-simultaneous TOKEN_REFRESHED event) from racing each other.
  const hydratingRef = useRef<Promise<void> | null>(null);

  const hydrateFromSession = async (nextSession: Session | null): Promise<User | null> => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setUser(null);
      return null;
    }
    try {
      const profile = await authService.ensureProfile(nextSession.user);
      setUser(profile);
      return profile;
    } catch (error) {
      // Web parity (frontend/src/contexts/AuthContext.jsx loadUser/
      // ensureUserExists): the production web app NEVER blocks sign-in on
      // a backend profile-fetch/create failure - it only logs the error
      // and falls back to the Supabase auth user's own metadata (role,
      // full_name) so the session the customer/provider already has with
      // Supabase is never wasted. Mirrored here instead of throwing.
      console.error('[auth] failed to load/create profile, using session fallback:', error);
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
      };
      setUser(fallbackProfile);
      return fallbackProfile;
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await hydrateFromSession(data.session);
      } catch (error) {
        // Never leave the app wedged on the splash/loading screen if the
        // initial session read fails (e.g. corrupt stored session, storage
        // adapter error). Surface the error and fall through as signed-out.
        console.error('[auth] initial session load failed:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Fire-and-forget: keep the listener callback itself synchronous.
      const run = async () => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          return;
        }
        await hydrateFromSession(nextSession);
      };
      // hydrateFromSession handles its own errors, but this promise is never
      // awaited by anyone - guard against an unhandled rejection regardless.
      hydratingRef.current = run().catch((error) => {
        console.error('[auth] auth-state change handling failed:', error);
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
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
      setSession(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    return hydrateFromSession(data.session);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
