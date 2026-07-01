import NetInfo from '@react-native-community/netinfo';

import { apiClient } from '@/api/client';
import { enqueueItem, listQueueItems } from '@/db/offlineQueue';
import type { QueueItem } from '@/types/models';

let isSyncing = false;

async function processItem(item: QueueItem): Promise<void> {
  const payload = JSON.parse(item.payload) as Record<string, unknown>;

  if (item.type === 'SALE') {
    await apiClient.post('/api/v1/sales', payload);
    return;
  }

  if (item.type === 'STOCK_RETURN') {
    await apiClient.post('/api/v1/inventory/return', payload);
    return;
  }

  if (item.type === 'TICKET') {
    await apiClient.post('/api/v1/tickets', payload);
  }
}

export async function syncQueue(): Promise<void> {
  if (isSyncing) {
    return;
  }

  const connection = await NetInfo.fetch();
  if (!connection.isConnected) {
    return;
  }

  isSyncing = true;
  try {
    const items = await listQueueItems();
    for (const item of items) {
      if (item.status !== 'PENDING' && item.status !== 'FAILED') {
        continue;
      }

      try {
        await processItem(item);
      } catch {
        // Lightweight v1: item persistence is kept in SQLite, while the UI layer can surface sync retries later.
        // The queue item remains for manual retry or future status updates.
      }
    }
  } finally {
    isSyncing = false;
  }
}

export async function queueSale(payload: Record<string, unknown>): Promise<void> {
  await enqueueItem({
    type: 'SALE',
    payload: JSON.stringify(payload),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    retryCount: 0,
    errorMessage: null,
  });
}
