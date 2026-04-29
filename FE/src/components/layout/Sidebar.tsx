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
      <path
        d="M6.5 1.5h3l.5 1.5a4.5 4.5 0 0 1 1.1.65l1.5-.5 1.5 2.6-1.2 1.1a4.6 4.6 0 0 1 0 1.3l1.2 1.1-1.5 2.6-1.5-.5A4.5 4.5 0 0 1 10 12l-.5 1.5h-3L6 12a4.5 4.5 0 0 1-1.1-.65l-1.5.5L2 9.25l1.2-1.1a4.6 4.6 0 0 1 0-1.3L2 5.75l1.5-2.6 1.5.5A4.5 4.5 0 0 1 6 3.5l.5-2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 1v3l2-1.5L8 1z" fill="currentColor"/>
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

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
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
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  }

  async function logout() {
    await authApi.logout().catch(() => {/* ignore – clear local state regardless */});
    logoutStore();
  }
  const { can } = useRBAC();
  const { projectId } = useParams();
  const { theme, toggleTheme } = useAppStore();

  const backlogHref    = projectId ? `/projects/${projectId}/backlog`    : null;
  const kanbanHref     = projectId ? `/projects/${projectId}/kanban`     : null;
  const wikiHref       = projectId ? `/projects/${projectId}/wiki`       : null;
  const analyticsHref  = projectId ? `/projects/${projectId}/analytics`  : null;
  const settingsHref   = projectId ? `/projects/${projectId}/settings`   : null;

  /* ── Collapsed-state style helpers ── */
  const navItemStyle: React.CSSProperties = collapsed
    ? { justifyContent: 'center', padding: '8px 0', gap: 0 }
    : {};

  const hideText: React.CSSProperties = {
    display: 'inline-block',
    maxWidth: collapsed ? 0 : 200,
    opacity: collapsed ? 0 : 1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease, max-width 0.2s ease',
  };

  const hideSectionLabel: React.CSSProperties = {
    maxHeight: collapsed ? 0 : 40,
    opacity: collapsed ? 0 : 1,
    overflow: 'hidden',
    transition: 'opacity 0.15s ease, max-height 0.2s ease',
  };

  return (
    <aside
      className="flex h-full flex-col"
      style={{
        position: 'relative',
        width: collapsed ? 52 : 232,
        minWidth: collapsed ? 52 : 232,
        background: 'var(--bb-sidebar-bg)',
        borderRight: '1px solid var(--bb-sidebar-border)',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'visible',
      }}
    >
      {/* ── Collapse / Expand toggle button ── */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute',
          right: -13,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: '#ffffff',
          border: '1px solid #e0e0de',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          color: '#888888',
          padding: 0,
          transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.background = '#FEF0EB';
          el.style.borderColor = '#E8471C';
          el.style.color = '#E8471C';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background = '#ffffff';
          el.style.borderColor = '#e0e0de';
          el.style.color = '#888888';
        }}
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>

      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        padding: collapsed ? '20px 0 16px' : '20px 20px 16px',
        borderBottom: '1px solid var(--bb-sidebar-border)',
        overflow: 'hidden',
        transition: 'padding 0.2s ease',
      }}>
        <BBLogo />
        <span style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--bb-sidebar-logo-text)',
          letterSpacing: '-0.3px',
          ...hideText,
        }}>
          BrainBoard
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Workspace section label */}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--bb-nav-label)', textTransform: 'uppercase', padding: '8px 10px 4px',
          display: 'block',
          ...hideSectionLabel,
        }}>
          Workspace
        </span>

        <NavLink
          to="/dashboard"
          title={collapsed ? 'Dashboard' : undefined}
          className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
          style={navItemStyle}
        >
          <span className="bb-nav-icon"><DashboardIcon /></span>
          <span style={hideText}>Dashboard</span>
        </NavLink>

        {backlogHref ? (
          <NavLink
            to={backlogHref}
            title={collapsed ? 'Backlog' : undefined}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><BacklogIcon /></span>
            <span style={hideText}>Backlog</span>
          </NavLink>
        ) : (
          <div
            className="bb-nav-item bb-nav-disabled bb-tooltip-host"
            title={collapsed ? 'Backlog' : undefined}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><BacklogIcon /></span>
            <span style={hideText}>Backlog</span>
            {!collapsed && <span className="bb-tooltip">Open a project first</span>}
          </div>
        )}

        {kanbanHref ? (
          <NavLink
            to={kanbanHref}
            title={collapsed ? 'Kanban' : undefined}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><KanbanIcon /></span>
            <span style={hideText}>Kanban</span>
          </NavLink>
        ) : (
          <div
            className="bb-nav-item bb-nav-disabled bb-tooltip-host"
            title={collapsed ? 'Kanban' : undefined}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><KanbanIcon /></span>
            <span style={hideText}>Kanban</span>
            {!collapsed && <span className="bb-tooltip">Open a project first</span>}
          </div>
        )}

        {wikiHref ? (
          <NavLink
            to={wikiHref}
            title={collapsed ? 'Wiki' : undefined}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><WikiIcon /></span>
            <span style={hideText}>Wiki</span>
          </NavLink>
        ) : (
          <div
            className="bb-nav-item bb-nav-disabled bb-tooltip-host"
            title={collapsed ? 'Wiki' : undefined}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><WikiIcon /></span>
            <span style={hideText}>Wiki</span>
            {!collapsed && <span className="bb-tooltip">Open a project first</span>}
          </div>
        )}

        {can('manageUsers') && (
          <NavLink
            to="/users"
            title={collapsed ? 'Users' : undefined}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><UsersIcon /></span>
            <span style={hideText}>Users</span>
          </NavLink>
        )}

        {can('manageProjectMembers') && (
          settingsHref ? (
            <NavLink
              to={settingsHref}
              title={collapsed ? 'Settings' : undefined}
              className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
              style={navItemStyle}
            >
              <span className="bb-nav-icon"><SettingsIcon /></span>
              <span style={hideText}>Settings</span>
            </NavLink>
          ) : (
            <div
              className="bb-nav-item bb-nav-disabled bb-tooltip-host"
              title={collapsed ? 'Settings' : undefined}
              style={navItemStyle}
            >
              <span className="bb-nav-icon"><SettingsIcon /></span>
              <span style={hideText}>Settings</span>
              {!collapsed && <span className="bb-tooltip">Open a project first</span>}
            </div>
          )
        )}

        {/* Reports section label */}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--bb-nav-label)', textTransform: 'uppercase',
          padding: '8px 10px 4px', marginTop: 8,
          display: 'block',
          ...hideSectionLabel,
        }}>
          Reports
        </span>

        {analyticsHref ? (
          <NavLink
            to={analyticsHref}
            title={collapsed ? 'Analytics' : undefined}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><AnalyticsIcon /></span>
            <span style={hideText}>Analytics</span>
            <span style={{
              marginLeft: 'auto',
              background: 'var(--bb-nav-badge-bg)',
              color: 'var(--bb-nav-badge-color)',
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
              ...hideText,
            }}>
              New
            </span>
          </NavLink>
        ) : (
          <div
            className="bb-nav-item bb-nav-disabled bb-tooltip-host"
            title={collapsed ? 'Analytics' : undefined}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><AnalyticsIcon /></span>
            <span style={hideText}>Analytics</span>
            <span style={{
              marginLeft: 'auto',
              background: 'var(--bb-nav-badge-bg)',
              color: 'var(--bb-nav-badge-color)',
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
              ...hideText,
            }}>
              New
            </span>
            {!collapsed && <span className="bb-tooltip">Open a project first</span>}
          </div>
        )}

        {can('manageUsers') && (
          <NavLink
            to="/ai-sync"
            title={collapsed ? 'AI Sync' : undefined}
            className={({ isActive }) => isActive ? 'bb-nav-item bb-nav-active' : 'bb-nav-item'}
            style={navItemStyle}
          >
            <span className="bb-nav-icon"><SyncIcon /></span>
            <span style={hideText}>AI Sync</span>
          </NavLink>
        )}
      </nav>

      {/* ── Footer ── */}
      {user && (
        <div style={{
          borderTop: '1px solid var(--bb-footer-border)',
          padding: collapsed ? '12px 0' : '12px 14px',
          transition: 'padding 0.2s ease',
        }}>
          {collapsed ? (
            /* Collapsed: centered column — avatar, theme toggle, logout */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <button
                className="bb-avatar-btn"
                onClick={() => setProfileOpen(true)}
                title={user.name}
              >
                {getInitials(user.name)}
                <span className="bb-avatar-btn-ring" />
              </button>
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="bb-sidebar-btn"
                style={{ padding: '4px 6px' }}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                onClick={logout}
                className="bb-sidebar-btn"
                style={{ padding: '4px 8px', fontSize: 11 }}
                title="Log out"
              >
                Out
              </button>
            </div>
          ) : (
            /* Expanded: horizontal row */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="bb-avatar-btn"
                onClick={() => setProfileOpen(true)}
                title="View profile"
              >
                {getInitials(user.name)}
                <span className="bb-avatar-btn-ring" />
              </button>
              <button
                className="bb-user-info-btn"
                onClick={() => setProfileOpen(true)}
              >
                <span className="bb-user-info-name">{user.name}</span>
                <span className="bb-user-info-role">{user.role}</span>
              </button>
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="bb-sidebar-btn"
                style={{ padding: '4px 6px' }}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                onClick={logout}
                className="bb-sidebar-btn"
                style={{ padding: '4px 8px', fontSize: 11 }}
                title="Log out"
              >
                Out
              </button>
            </div>
          )}
        </div>
      )}

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
}
