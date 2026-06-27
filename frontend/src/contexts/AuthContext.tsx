import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth.service';
import { apiService } from '../services/api';
import { User, LoginRequest, SignupRequest, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  signup: (data: SignupRequest) => Promise<AuthResponse>;
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await apiService.getAuthToken();
      if (token) {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await apiService.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await authService.login(credentials);
    await apiService.setAuthToken(response.access_token, response.refresh_token);
    setUser(response.user);
    return response;
  };

  const signup = async (data: SignupRequest): Promise<AuthResponse> => {
    const response = await authService.signup(data);
    await apiService.setAuthToken(response.access_token, response.refresh_token);
    setUser(response.user);
    return response;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await apiService.clearTokens();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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