import { useEffect } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
// 1. Import GestureHandlerRootView and StyleSheet
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

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
    // 2. Wrap the absolute outer boundary with GestureHandlerRootView and give it flex: 1
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SyncStatusProvider>
            <AppShell />
          </SyncStatusProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// 3. Define the styles to force full height/width on web browsers
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});