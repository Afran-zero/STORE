import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { syncQueue } from '@/db/syncEngine';

interface SyncStatusState {
  isOnline: boolean;
  isSyncing: boolean;
  retrySync: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusState | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
      if (state.isConnected) {
        void syncQueue();
      }
    });

    const interval = setInterval(() => {
      if (isOnline) {
        void syncQueue();
      }
    }, 60_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isOnline]);

  const retrySync = async (): Promise<void> => {
    setIsSyncing(true);
    try {
      await syncQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  const value = useMemo<SyncStatusState>(() => ({ isOnline, isSyncing, retrySync }), [isOnline, isSyncing]);

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatusState {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within SyncStatusProvider');
  }
  return context;
}
