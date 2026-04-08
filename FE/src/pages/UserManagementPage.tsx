import { useState } from 'react';
import { mockUsers } from '@/mocks/users';
import { UserTable } from '@/features/users/components/UserTable';
import { useRBAC } from '@/hooks/useRBAC';
import type { Role } from '@/types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function UserManagementPage() {
  const [users, setUsers] = useState(mockUsers);
  const { isAdmin } = useRBAC();

  function handleRoleChange(userId: string, newRole: Role) {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">{users.length} members in this workspace</p>
      </div>

      {USE_MOCK && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Changes are local only in demo mode — role updates won't persist on refresh.
        </div>
      )}

      <UserTable users={users} onRoleChange={handleRoleChange} canEdit={isAdmin()} />
    </div>
  );
}

export default UserManagementPage;
