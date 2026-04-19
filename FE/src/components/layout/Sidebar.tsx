import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import useAuthStore from '@/store/useAuthStore';
import useAppStore from '@/store/useAppStore';
import { useRBAC } from '@/hooks/useRBAC';
import { authApi } from '@/api/auth';
import { ProfileModal } from './ProfileModal';

/* ── Logo (matches the browser tab favicon) ── */
function BBLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      {/* Kanban tiles row 1 */}
      <rect x="1"  y="7"  width="8" height="8" rx="2"   fill="#E75026"/>
      <rect x="11" y="7"  width="8" height="8" rx="2"   fill="#E75026"/>
      <rect x="21" y="7"  width="5" height="8" rx="1.5" fill="#E75026" opacity="0.35"/>
      {/* Kanban tiles row 2 */}
      <rect x="1"  y="17" width="8" height="5" rx="1.5" fill="#E75026" opacity="0.5"/>
      <rect x="11" y="17" width="8" height="5" rx="1.5" fill="#E75026" opacity="0.35"/>
      <rect x="21" y="17" width="5" height="5" rx="1.5" fill="#E75026" opacity="0.6"/>
      {/* Connector line */}
      <line x1="24" y1="7" x2="27" y2="4" stroke="#E75026" strokeWidth="1.2" opacity="0.5"/>
      {/* Neural node */}
      <circle cx="28" cy="3.5" r="3.5" fill="#E75026"/>
      <circle cx="28" cy="3.5" r="2"   fill="white"/>
      <circle cx="28" cy="3.5" r="1"   fill="#E75026"/>
    </svg>
  );
}

/* ── Nav Icons ── */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="7" y="4" width="4" height="11" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="13" y="7" width="2" height="8" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function WikiIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <path d="M2 3h12M2 7h8M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function BacklogIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2.5" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="1" y="11.5" width="10" height="2.5" rx="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="5" r="3" fill="currentColor" />
      <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <path
        d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <path d="M2 12L6 7l3 3 2.5-4L14 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const user        = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);

  const [profileOpen, setProfileOpen] = useState(false);

  async function logout() {
    await authApi.logout().catch(() => {/* ignore – clear local state regardless */});
    logoutStore();
  }
  const { can } = useRBAC();
  const { projectId } = useParams();
  const { theme, toggleTheme } = useAppStore();

  const backlogHref   = projectId ? `/projects/${projectId}/backlog`   : null;
  const kanbanHref    = projectId ? `/projects/${projectId}/kanban`    : null;
  const wikiHref      = projectId ? `/projects/${projectId}/wiki`      : null;
  const settingsHref  = projectId ? `/projects/${projectId}/settings`  : null;

  return (
    <aside
      className="flex h-full flex-col"
      style={{
        width: 232,
        minWidth: 232,
        background: 'var(--bb-sidebar-bg)',
        borderRight: '1px solid var(--bb-sidebar-border)',
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--bb-sidebar-border)',
      }}>
        <BBLogo />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-sidebar-logo-text)', letterSpacing: '-0.3px' }}>
          BrainBoard
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Workspace section */}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--bb-nav-label)', textTransform: 'uppercase', padding: '8px 10px 4px',
        }}>
          Workspace
        </span>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
        >
          <span className="bb-nav-icon"><DashboardIcon /></span>
          Dashboard
        </NavLink>

        {backlogHref ? (
          <NavLink
            to={backlogHref}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
          >
            <span className="bb-nav-icon"><BacklogIcon /></span>
            Backlog
          </NavLink>
        ) : (
          <div className="bb-nav-item bb-nav-disabled bb-tooltip-host">
            <span className="bb-nav-icon"><BacklogIcon /></span>
            Backlog
            <span className="bb-tooltip">Open a project first</span>
          </div>
        )}

        {kanbanHref ? (
          <NavLink
            to={kanbanHref}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
          >
            <span className="bb-nav-icon"><KanbanIcon /></span>
            Kanban
          </NavLink>
        ) : (
          <div className="bb-nav-item bb-nav-disabled bb-tooltip-host">
            <span className="bb-nav-icon"><KanbanIcon /></span>
            Kanban
            <span className="bb-tooltip">Open a project first</span>
          </div>
        )}

        {wikiHref ? (
          <NavLink
            to={wikiHref}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
          >
            <span className="bb-nav-icon"><WikiIcon /></span>
            Wiki
          </NavLink>
        ) : (
          <div className="bb-nav-item bb-nav-disabled bb-tooltip-host">
            <span className="bb-nav-icon"><WikiIcon /></span>
            Wiki
            <span className="bb-tooltip">Open a project first</span>
          </div>
        )}

        {can('manageUsers') && (
          <NavLink
            to="/users"
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
          >
            <span className="bb-nav-icon"><UsersIcon /></span>
            Users
          </NavLink>
        )}

        {can('manageProjectMembers') && (
          settingsHref ? (
            <NavLink
              to={settingsHref}
              className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            >
              <span className="bb-nav-icon"><SettingsIcon /></span>
              Settings
            </NavLink>
          ) : (
            <div className="bb-nav-item bb-nav-disabled bb-tooltip-host">
              <span className="bb-nav-icon"><SettingsIcon /></span>
              Settings
              <span className="bb-tooltip">Open a project first</span>
            </div>
          )
        )}

        {/* Reports section */}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--bb-nav-label)', textTransform: 'uppercase', padding: '8px 10px 4px', marginTop: 8,
        }}>
          Reports
        </span>

        <div className="bb-nav-item">
          <span className="bb-nav-icon"><AnalyticsIcon /></span>
          Analytics
          <span style={{
            marginLeft: 'auto',
            background: 'var(--bb-nav-badge-bg)',
            color: 'var(--bb-nav-badge-color)',
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
          }}>
            New
          </span>
        </div>
      </nav>

      {/* ── Footer ── */}
      {user && (
        <div style={{ borderTop: '1px solid var(--bb-footer-border)', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* Avatar button → opens profile modal */}
            <button
              className="bb-avatar-btn"
              onClick={() => setProfileOpen(true)}
              title="View profile"
            >
              {getInitials(user.name)}
              <span className="bb-avatar-btn-ring" />
            </button>

            {/* User info (also clickable) */}
            <button
              className="bb-user-info-btn"
              onClick={() => setProfileOpen(true)}
            >
              <span className="bb-user-info-name">{user.name}</span>
              <span className="bb-user-info-role">{user.role}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="bb-sidebar-btn"
              style={{ padding: '4px 6px' }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="bb-sidebar-btn"
              style={{ padding: '4px 8px', fontSize: 11 }}
              title="Log out"
            >
              Out
            </button>
          </div>
        </div>
      )}

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
