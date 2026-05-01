import type { User, Role } from '@/types';
import { Avatar } from '@/components/common/Avatar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { CustomSelect } from '@/components/common/CustomSelect';

const ROLES: Role[] = ['admin', 'pm', 'developer', 'viewer'];

interface Props {
  users: User[];
  onRoleChange: (userId: string, newRole: Role) => void;
  canEdit: boolean;
}

export function UserTable({ users, onRoleChange, canEdit }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">User</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-left">Role</th>
            {canEdit && <th className="px-4 py-3 text-left">Change Role</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar user={user} size="md" />
                  <span className="font-medium text-gray-900">{user.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">{user.email}</td>
              <td className="px-4 py-3">
                <RoleBadge role={user.role} />
              </td>
              {canEdit && (
                <td className="px-4 py-3" style={{ minWidth: 140 }}>
                  <CustomSelect
                    size="sm"
                    value={user.role}
                    onChange={(v) => onRoleChange(user.id, v as Role)}
                    options={ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
