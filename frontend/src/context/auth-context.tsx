import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { clearTokens, setTokens } from '@/api/client';
import * as authApi from '@/api/endpoints/auth';
import type { AuthUser } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: authApi.RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (accessToken: string, refreshToken: string, user?: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setSession = (nextAccessToken: string, nextRefreshToken: string, nextUser: AuthUser | null = null): void => {
    setTokens(nextAccessToken, nextRefreshToken);
    setAccessToken(nextAccessToken);
    setUser(nextUser);
  };

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      setSession(response.accessToken, response.refreshToken, response.user ?? null);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: authApi.RegisterRequest): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authApi.register(input);
      setSession(response.accessToken, response.refreshToken, response.user ?? null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      setUser(null);
      setAccessToken(null);
      setIsLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, isLoading, login, register, logout, setSession }),
    [user, accessToken, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
