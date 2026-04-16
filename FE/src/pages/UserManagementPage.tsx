import { UserTable } from '@/features/users/components/UserTable';
import { useUsers, useUpdateUserRole } from '@/features/users/useUsers';
import { useRBAC } from '@/hooks/useRBAC';
import type { Role } from '@/types';

export function UserManagementPage() {
  const { data: users = [], isLoading, isError } = useUsers();
  const { mutate: updateRole } = useUpdateUserRole();
  const { isAdmin } = useRBAC();

  function handleRoleChange(userId: string, newRole: Role) {
    updateRole({ id: userId, role: newRole });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-red-600">Failed to load users. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">{users.length} members in this workspace</p>
      </div>

      <UserTable users={users} onRoleChange={handleRoleChange} canEdit={isAdmin()} />
    </div>
  );
}

export default UserManagementPage;
