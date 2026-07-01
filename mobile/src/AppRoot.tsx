import { useEffect } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SyncStatusProvider } from '@/context/SyncStatusContext';
import { RootNavigator } from '@/navigation/RootNavigator';

function AppShell(): JSX.Element {
  const { hydrate, theme } = useAuth();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <NavigationContainer theme={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootNavigator />
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export function AppRoot(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncStatusProvider>
          <AppShell />
        </SyncStatusProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
