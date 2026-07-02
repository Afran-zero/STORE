import { useMutation, useQuery, useQueryClient } from '@/lib/query-helpers';
import {
  getAssignment,
  listRecentAssignments,
  upsertAssignment,
  type DailyAssignment,
  type UpsertAssignmentRequest,
} from '@/api/endpoints/assignments';
import { assignmentKeys } from '@/api/queryKeys';

export function useAssignment(storeId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: assignmentKeys.daily(storeId ?? '', date ?? ''),
    queryFn: () => getAssignment(storeId as string, date as string),
    enabled: Boolean(storeId && date),
  });
}

export function useRecentAssignments(storeId: string | undefined) {
  return useQuery({
    queryKey: assignmentKeys.recent(storeId ?? ''),
    queryFn: () => listRecentAssignments(storeId as string),
    enabled: Boolean(storeId),
  });
}

export function useUpsertAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertAssignmentRequest) => upsertAssignment(input),
    onSuccess: (data: DailyAssignment) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.daily(data.storeId, data.date) });
      qc.invalidateQueries({ queryKey: assignmentKeys.recent(data.storeId) });
    },
  });
}