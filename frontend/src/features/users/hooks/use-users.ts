import { useMutation, useQuery, useQueryClient } from '@/lib/query-helpers';
import {
  assignUserToStore,
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  toggleUserStatus,
  updateUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserRecord,
} from '@/api/endpoints/users';
import { userKeys } from '@/api/queryKeys';

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => listUsers(),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserRequest) => createUser(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.list() });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserRequest) => updateUser(id, input),
    onSuccess: (user: UserRecord) => {
      qc.invalidateQueries({ queryKey: userKeys.list() });
      qc.setQueryData(userKeys.detail(user.id), user);
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.list() });
    },
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleUserStatus(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.list() });
    },
  });
}

export function useAssignUserToStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, storeId }: { id: string; storeId: string | null }) =>
      assignUserToStore(id, storeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.list() });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      resetUserPassword(id, password),
  });
}