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
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signup: (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role: string;
  }) => Promise<{ needsVerification: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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

  const hydrateFromSession = async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setUser(null);
      return;
    }
    try {
      const profile = await authService.ensureProfile(nextSession.user);
      setUser(profile);
    } catch (error) {
      console.error('[auth] failed to load/create profile:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await hydrateFromSession(data.session);
      if (mounted) setIsLoading(false);
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
      hydratingRef.current = run();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const data = await authService.login(credentials);
    await hydrateFromSession(data.session);
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
      await hydrateFromSession(result.session);
      return { needsVerification: false };
    }
    return { needsVerification: true };
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
    await hydrateFromSession(data.session);
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
