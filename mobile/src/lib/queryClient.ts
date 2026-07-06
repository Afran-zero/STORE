import { AppState, type AppStateStatus, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

// Keep React Query's `focusManager` in sync with the real app foreground state.
// On native we wire it to `AppState`; on web `window.focus`/`visibilitychange`
// already drives it, but we still set up AppState for Expo Web parity.
focusManager.setEventListener((handleFocus) => {
  if (Platform.OS === 'web') {
    // React Query's default web listener already covers focus/visibility, but
    // we register AppState too so web + native behave identically in Expo.
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      handleFocus(state === 'active');
    });
    return () => sub.remove();
  }
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Short enough that an admin action taken on a *different* device shows up
      // on this one within a few seconds once the user comes back to the app.
      // Screen-level queries can override this with their own `refetchInterval`.
      staleTime: 5_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Force-refresh every active query once when the app returns to the foreground.
 * This is the "auto refresh" behavior the worker asked for: they don't have to
 * pull-to-refresh to see what the admin just allocated from another device.
 *
 * We `refetchQueries` (instead of `invalidateQueries`) so the UI updates with
 * fresh data immediately even if `staleTime` hasn't elapsed yet.
 */
let lastForegroundAt = 0;
AppState.addEventListener('change', (state) => {
  if (state !== 'active') return;
  const now = Date.now();
  // Debounce duplicate `active` events that fire in quick succession.
  if (now - lastForegroundAt < 500) return;
  lastForegroundAt = now;
  void queryClient.refetchQueries({
    type: 'active',
    // Skip lightweight polling-only queries (they already refresh themselves).
    fetchStatus: 'idle',
  });
});
