import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import type { User, Role } from '@/types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });
}

/* ── Update role ── */
interface UpdateRoleVars { id: string; role: Role }

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, UpdateRoleVars>({
    mutationFn: ({ id, role }) => usersApi.updateRole(id, role),

    onMutate: async ({ id, role }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previous = queryClient.getQueryData<User[]>(['users']);
      queryClient.setQueryData<User[]>(['users'], (old = []) =>
        old.map((u) => (u.id === id ? { ...u, role } : u)),
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: User[] } | undefined;
      if (ctx?.previous) queryClient.setQueryData(['users'], ctx.previous);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/* ── Create user ── */
interface CreateUserVars { name: string; email: string; role: Role }

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, CreateUserVars>({
    mutationFn: (data) => usersApi.createUser(data),

    onSuccess: (newUser) => {
      queryClient.setQueryData<User[]>(['users'], (old = []) => [...old, newUser]);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/* ── Delete user ── */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => usersApi.deleteUser(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previous = queryClient.getQueryData<User[]>(['users']);
      queryClient.setQueryData<User[]>(['users'], (old = []) =>
        old.filter((u) => u.id !== id),
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: User[] } | undefined;
      if (ctx?.previous) queryClient.setQueryData(['users'], ctx.previous);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
