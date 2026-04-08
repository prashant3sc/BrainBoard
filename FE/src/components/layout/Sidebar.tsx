import { NavLink, useParams } from 'react-router-dom';
import useAuthStore from '@/store/useAuthStore';
import { useRBAC } from '@/hooks/useRBAC';

const ROLE_BADGE: Record<string, string> = {
  admin:     'bg-red-100 text-red-700',
  pm:        'bg-blue-100 text-blue-700',
  developer: 'bg-green-100 text-green-700',
  viewer:    'bg-gray-100 text-gray-600',
};

const linkBase =
  'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors';
const linkActive =
  'block rounded-md px-3 py-2 text-sm font-medium bg-indigo-50 text-indigo-700 font-semibold';

export default function Sidebar() {
  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { can } = useRBAC();
  const { projectId } = useParams();

  const kanbanHref = projectId
    ? `/projects/${projectId}/kanban`
    : '/dashboard';
  const wikiHref = projectId
    ? `/projects/${projectId}/wiki`
    : '/dashboard';

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-100">
        <span className="text-lg font-bold text-indigo-600">Jira 2.0</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => (isActive ? linkActive : linkBase)}
        >
          Dashboard
        </NavLink>

        <NavLink
          to={kanbanHref}
          className={({ isActive }) => (isActive ? linkActive : linkBase)}
        >
          Kanban
        </NavLink>

        <NavLink
          to={wikiHref}
          className={({ isActive }) => (isActive ? linkActive : linkBase)}
        >
          Wiki
        </NavLink>

        {can('manageUsers') && (
          <NavLink
            to="/users"
            className={({ isActive }) => (isActive ? linkActive : linkBase)}
          >
            Users
          </NavLink>
        )}
      </nav>

      {/* User info + logout */}
      {user && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
            <span
              className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[user.role] ?? ROLE_BADGE.viewer}`}
            >
              {user.role}
            </span>
          </div>
          <button
            onClick={logout}
            className="w-full rounded-md border border-gray-200 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </aside>
  );
}
