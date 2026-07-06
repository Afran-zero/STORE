import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { clearTokens, getStoredUser, setStoredUser, setTokens } from '@/lib/tokenStore';
import type { AuthUser } from '@/types/models';

type ThemeMode = 'light' | 'dark';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  theme: ThemeMode;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/tokenStore';

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [theme] = useState<ThemeMode>('light');
  const queryClient = useQueryClient();

  const hydrate = useCallback(async (): Promise<void> => {
    const storedUser = await getStoredUser();
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
      } catch {
        // Corrupted JSON – wipe it so the user isn't stuck.
        await clearTokens().catch(() => undefined);
        setUser(null);
      }
    }
    setIsReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // Backend LoginRequest expects `username` (which it lowercases and matches against
    // either the hardcoded admin username or any user's email).
    const response = await apiClient.post('/api/v1/auth/login', { username: email, password }) as { accessToken: string; refreshToken: string; user?: AuthUser };
    await setTokens(response.accessToken, response.refreshToken);
    if (response.user) {
      await setStoredUser(JSON.stringify(response.user));
      setUser(response.user);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // Best-effort clear: never throw out of logout, otherwise the UI gets stuck
    // in a "busy" state with no feedback. SecureStore.deleteItem can reject on
    // some Android emulator builds when a key was never written.
    await clearTokens().catch(() => undefined);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      theme,
      hydrate,
      login,
      logout,
    }),
    [user, isReady, theme, hydrate, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
