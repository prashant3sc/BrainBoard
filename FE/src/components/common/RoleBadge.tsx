import type { Role } from '@/types';

const ROLE_COLORS: Record<Role, string> = {
  admin:     'bg-purple-100 text-purple-700',
  pm:        'bg-blue-100 text-blue-700',
  developer: 'bg-green-100 text-green-700',
  viewer:    'bg-gray-100 text-gray-600',
};

interface Props {
  role: Role;
}

export function RoleBadge({ role }: Props) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[role]}`}
    >
      {role}
    </span>
  );
}
