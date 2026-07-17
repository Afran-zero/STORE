import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { SyncEvent } from './types';

/**
 * Pure lookup from a SyncEvent to the query key prefixes that must be
 * invalidated. Mobile screens currently inline their query keys (see
 * mobile/src/screens/**) rather than using a shared factory module, so this
 * targets the same prefixes already in use there (e.g. ['attendance'],
 * ['sales'], ['store-inventory']) — React Query invalidates by prefix match,
 * so a top-level key here covers every more-specific key derived from it.
 * See specs/001-realtime-data-sync/contracts/entity-query-key-map.md.
 */
export function resolveInvalidations(event: SyncEvent): QueryKey[] {
  switch (event.entity) {
    case 'storeInventory':
      return [['store-inventory'], ['store-needs-today'], ['store-low-stock']];
    case 'inventory':
      return [['store-needs-today'], ['store-low-stock']];
    case 'sale':
      return [['sales'], ['allocations']];
    case 'recipe':
      return [['recipes'], ['recipe', event.recordId]];
    case 'attendance':
      return [['attendance']];
    case 'ticket':
      return [['tickets']];
    case 'store':
      return [['store', event.storeId ?? event.recordId]];
    case 'allocation':
      return [['allocations']];
    case 'assignment':
      return [['allocations']];
    case 'food':
      return [['sales']];
    case 'user':
      return [];
    default:
      return [];
  }
}

export function applySyncEvent(queryClient: QueryClient, event: SyncEvent): void {
  for (const key of resolveInvalidations(event)) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
