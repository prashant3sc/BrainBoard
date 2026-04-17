import { useState, useEffect, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useProject, useAddMember, useRemoveMember } from '@/features/projects/useProjects';
import { useUsers } from '@/features/users/useUsers';
import useAuthStore from '@/store/useAuthStore';
import useAppStore from '@/store/useAppStore';
import type { User, Role } from '@/types';

/* ─── helpers ─── */

const AVATAR_COLORS = [
  { bg: '#FFF3F0', text: '#E75026' },
  { bg: '#DEEBFF', text: '#0747A6' },
  { bg: '#E3FCEF', text: '#006644' },
  { bg: '#EAE6FF', text: '#403294' },
  { bg: '#FFFAE6', text: '#7A5800' },
  { bg: '#FFEBE6', text: '#BF2600' },
];

function avatarColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin', pm: 'PM', developer: 'Developer', viewer: 'Viewer',
};

const ROLE_CLS: Record<Role, string> = {
  admin:     'bb-role-badge bb-role-admin',
  pm:        'bb-role-badge bb-role-pm',
  developer: 'bb-role-badge bb-role-developer',
  viewer:    'bb-role-badge bb-role-viewer',
};

/* ─── toast ─── */

function useToast() {
  const [state, setState] = useState({ msg: '', visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function show(msg: string) {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, visible: true });
    timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), 3000);
  }
  return { toastMsg: state.msg, toastVisible: state.visible, showToast: show };
}

/* ═══════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════ */

export default function ProjectSettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const { togglePalette } = useAppStore();
  const { toastMsg, toastVisible, showToast } = useToast();

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: allUsers = [], isLoading: usersLoading } = useUsers();
  const { mutate: addMember,    isPending: adding   } = useAddMember();
  const { mutate: removeMember, isPending: removing } = useRemoveMember();

  const [addOpen,       setAddOpen]       = useState(false);
  const [removeTarget,  setRemoveTarget]  = useState<User | null>(null);
  const [search,        setSearch]        = useState('');
  const [addSearch,     setAddSearch]     = useState('');
  const addSearchRef = useRef<HTMLInputElement>(null);

  /* focus search when add modal opens */
  useEffect(() => {
    if (addOpen) setTimeout(() => addSearchRef.current?.focus(), 80);
  }, [addOpen]);

  /* Escape → close modals */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setAddOpen(false); setRemoveTarget(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isLoading = projectLoading || usersLoading;

  /* derive member list */
  const memberIds   = project?.memberIds ?? [];
  const members     = allUsers.filter((u) => memberIds.includes(u.id));
  const nonMembers  = allUsers.filter((u) => !memberIds.includes(u.id));

  /* filter existing members by search */
  const q = search.toLowerCase();
  const visibleMembers = q
    ? members.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
    : members;

  /* filter non-members by add-search */
  const aq = addSearch.toLowerCase();
  const visibleNonMembers = aq
    ? nonMembers.filter(
        (u) => u.name.toLowerCase().includes(aq) || u.email.toLowerCase().includes(aq),
      )
    : nonMembers;

  function handleAdd(user: User) {
    addMember(
      { projectId, userId: user.id },
      {
        onSuccess: () => {
          showToast(`${user.name.split(' ')[0]} added to project`);
          setAddSearch('');
        },
      },
    );
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    const name = removeTarget.name;
    removeMember(
      { projectId, userId: removeTarget.id },
      {
        onSuccess: () => showToast(`${name.split(' ')[0]} removed from project`),
      },
    );
    setRemoveTarget(null);
  }

  /* ── render ── */
  return (
    <>
      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
        background: 'var(--bb-topbar-bg)',
        borderBottom: '1px solid var(--bb-topbar-border)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NavLink
            to="/dashboard"
            style={{ fontSize: 13, color: 'var(--bb-bc-root)', textDecoration: 'none' }}
          >
            Projects
          </NavLink>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-sep)', margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-root)' }}>
            {project?.name ?? '…'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-sep)', margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-bc-current)' }}>
            Settings
          </span>
        </div>

        {/* Search → AI palette */}
        <div
          role="button" tabIndex={0}
          onClick={togglePalette}
          onKeyDown={(e) => e.key === 'Enter' && togglePalette()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--bb-search-bg)',
            border: '1px solid var(--bb-search-border)',
            borderRadius: 6, padding: '6px 12px', width: 200, cursor: 'text',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="var(--bb-search-text)" strokeWidth="1.4" />
            <path d="M10 10l2.5 2.5" stroke="var(--bb-search-text)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--bb-search-text)', userSelect: 'none' }}>Search…</span>
          <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bb-search-text)', background: 'none', border: 'none' }}>⌘K</kbd>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '28px 32px', background: 'var(--bb-content-bg)', minHeight: 'calc(100vh - 57px)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--bb-page-title)', letterSpacing: '-0.4px' }}>
            Project Settings
          </div>
          <div style={{ fontSize: 13, color: 'var(--bb-page-subtitle)', marginTop: 3 }}>
            {project?.name ?? ''}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex', gap: 2,
          borderBottom: '1px solid var(--bb-tbl-wrap-border)',
          marginBottom: 24,
        }}>
          {/* Members tab — active */}
          <div style={{
            padding: '8px 16px',
            fontSize: 13, fontWeight: 600,
            color: '#E75026',
            borderBottom: '2px solid #E75026',
            marginBottom: -1,
            cursor: 'default',
          }}>
            Members
          </div>
          {/* General tab — coming soon */}
          <div style={{
            padding: '8px 16px',
            fontSize: 13,
            color: 'var(--bb-page-subtitle)',
            cursor: 'default',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            General
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: 'var(--bb-nav-badge-bg)',
              color: 'var(--bb-nav-badge-color)',
              padding: '1px 6px', borderRadius: 10,
            }}>
              Soon
            </span>
          </div>
        </div>

        {/* ── Members section ── */}
        <div>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-page-title)' }}>
                Project Members
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--bb-page-subtitle)', marginTop: 2 }}>
                {isLoading ? '…' : `${members.length} member${members.length !== 1 ? 's' : ''} with access to this project`}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Search filter */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--bb-tbl-search-bg)',
                border: '1px solid var(--bb-tbl-search-border)',
                borderRadius: 6, padding: '6px 12px', width: 190,
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="var(--bb-tbl-search-ph)" strokeWidth="1.4" />
                  <path d="M10 10l2.5 2.5" stroke="var(--bb-tbl-search-ph)" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  className="bb-tbl-search-input"
                  placeholder="Filter members…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Add member button */}
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#E75026', color: '#FFFFFF', border: 'none',
                  padding: '8px 16px', borderRadius: 6,
                  fontSize: 13.5, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#C73D16')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#E75026')}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add Member
              </button>
            </div>
          </div>

          {/* ── Members table ── */}
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <div style={{
              background: 'var(--bb-tbl-wrap-bg)',
              border: '1px solid var(--bb-tbl-wrap-border)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Member', 'Email', 'Workspace Role', 'Project Access', 'Actions'].map((h, i) => (
                      <th key={h} style={{
                        padding: '11px 20px',
                        fontSize: 11, fontWeight: 600,
                        letterSpacing: '0.08em',
                        color: 'var(--bb-tbl-head-color)',
                        textTransform: 'uppercase',
                        textAlign: 'left',
                        background: 'var(--bb-tbl-head-bg)',
                        borderBottom: '1px solid var(--bb-tbl-wrap-border)',
                        whiteSpace: 'nowrap',
                        width: ['28%', '26%', '16%', '16%', '14%'][i],
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyMembers hasSearch={!!q} />
                      </td>
                    </tr>
                  ) : (
                    visibleMembers.map((user, idx) => {
                      const col       = avatarColor(idx);
                      const isOwner   = user.id === project?.ownerId;
                      const isSelf    = user.id === currentUser?.id;
                      const canRemove = !isOwner && !isSelf;
                      return (
                        <MemberRow
                          key={user.id}
                          user={user}
                          avatarBg={col.bg}
                          avatarText={col.text}
                          isOwner={isOwner}
                          canRemove={canRemove}
                          removing={removing}
                          onRemove={() => setRemoveTarget(user)}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══ Add Member Modal ══ */}
      {addOpen && (
        <ModalOverlay onClose={() => { setAddOpen(false); setAddSearch(''); }}>
          <div
            className="bb-modal-animate"
            style={{
              background: 'var(--bb-modal-bg)',
              borderRadius: 12, width: '100%', maxWidth: 460,
              boxShadow: '0 20px 48px rgba(23,43,77,.18)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--bb-modal-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: 'var(--bb-avatar-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <circle cx="6" cy="5" r="3" fill="#E75026" />
                    <path d="M1 14c0-3.314 2.686-5 5-5" stroke="#E75026" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M12 8v4M10 10h4" stroke="#E75026" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-modal-title)', letterSpacing: '-0.2px' }}>
                    Add member
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--bb-page-subtitle)', marginTop: 1 }}>
                    {project?.name}
                  </div>
                </div>
              </div>
              <CloseBtn onClick={() => { setAddOpen(false); setAddSearch(''); }} />
            </div>

            {/* Search input */}
            <div style={{ padding: '16px 24px 8px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bb-tbl-search-bg)',
                border: '1px solid var(--bb-tbl-search-border)',
                borderRadius: 7, padding: '8px 12px',
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="var(--bb-tbl-search-ph)" strokeWidth="1.4" />
                  <path d="M10 10l2.5 2.5" stroke="var(--bb-tbl-search-ph)" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  ref={addSearchRef}
                  className="bb-tbl-search-input"
                  placeholder="Search workspace users…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* User list */}
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 12px 16px' }}>
              {visibleNonMembers.length === 0 ? (
                <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--bb-page-subtitle)', fontSize: 13 }}>
                  {nonMembers.length === 0
                    ? 'All workspace users are already in this project.'
                    : 'No users match your search.'}
                </div>
              ) : (
                visibleNonMembers.map((user, idx) => {
                  const col = avatarColor(idx);
                  return (
                    <button
                      key={user.id}
                      disabled={adding}
                      onClick={() => handleAdd(user)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 8, border: 'none',
                        background: 'none', cursor: adding ? 'not-allowed' : 'pointer',
                        textAlign: 'left', fontFamily: 'inherit',
                        transition: 'background 0.1s',
                        opacity: adding ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => { if (!adding) e.currentTarget.style.background = 'var(--bb-tbl-row-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: col.bg, color: col.text,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600,
                      }}>
                        {initials(user.name)}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--bb-u-name)' }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--bb-u-email)', fontFamily: 'monospace', marginTop: 1 }}>
                          {user.email}
                        </div>
                      </div>
                      {/* Role badge */}
                      <span className={ROLE_CLS[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </span>
                      {/* Add icon */}
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: '#E75026', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                          <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--bb-modal-border)',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => { setAddOpen(false); setAddSearch(''); }}
                style={{
                  padding: '7px 18px', borderRadius: 6,
                  border: '1px solid var(--bb-modal-cancel-border)',
                  background: 'var(--bb-modal-cancel-bg)',
                  color: 'var(--bb-modal-cancel-color)',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-bg)')}
              >
                Done
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ══ Remove Confirm Modal ══ */}
      {removeTarget && (
        <ModalOverlay onClose={() => setRemoveTarget(null)}>
          <div
            className="bb-modal-animate"
            style={{
              background: 'var(--bb-modal-bg)',
              borderRadius: 12, width: '100%', maxWidth: 400,
              padding: 28,
              boxShadow: '0 20px 48px rgba(23,43,77,.18)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--bb-remove-icon-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="7" r="4" stroke="var(--bb-remove-icon-color)" strokeWidth="1.8" />
                <path d="M3 20c0-3.866 2.686-7 6-7" stroke="var(--bb-remove-icon-color)" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M17 13l-4 4 4 4M13 17h8" stroke="var(--bb-remove-icon-color)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-remove-title)', marginBottom: 6 }}>
              Remove {removeTarget.name}?
            </div>
            <div style={{ fontSize: 13, color: 'var(--bb-remove-desc)', lineHeight: 1.55, marginBottom: 20 }}>
              {removeTarget.name.split(' ')[0]} will lose access to this project immediately.
              Their workspace account will not be affected.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setRemoveTarget(null)}
                style={{
                  padding: '8px 20px', borderRadius: 6,
                  border: '1px solid var(--bb-modal-cancel-border)',
                  background: 'var(--bb-modal-cancel-bg)',
                  color: 'var(--bb-modal-cancel-color)',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-bg)')}
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveConfirm}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: '#DE350B', color: '#FFFFFF',
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#BF2600')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#DE350B')}
              >
                Yes, remove
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Toast ── */}
      <div className={`bb-toast${toastVisible ? ' bb-toast-show' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" fill="#006644" />
          <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{toastMsg}</span>
      </div>
    </>
  );
}

/* ─────────────────── sub-components ─────────────────── */

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(23,43,77,.48)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 6, border: 'none',
        background: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--bb-modal-cancel-color)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-hover-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function MemberRow({
  user, avatarBg, avatarText, isOwner, canRemove, removing, onRemove,
}: {
  user: User;
  avatarBg: string;
  avatarText: string;
  isOwner: boolean;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <tr
      style={{ borderBottom: '1px solid var(--bb-tbl-row-border)', transition: 'background 0.1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-tbl-row-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name + avatar */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: avatarBg, color: avatarText,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}>
            {initials(user.name)}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--bb-u-name)', display: 'flex', alignItems: 'center', gap: 7 }}>
              {user.name}
              {isOwner && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                  background: '#DEEBFF', color: '#0747A6', letterSpacing: '0.04em',
                }}>
                  OWNER
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--bb-u-sub)', fontFamily: 'monospace', marginTop: 1 }}>
              {user.email.split('@')[1] ?? ''}
            </div>
          </div>
        </div>
      </td>

      {/* Email */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <span style={{ fontSize: 13, color: 'var(--bb-u-email)', fontFamily: 'monospace' }}>
          {user.email}
        </span>
      </td>

      {/* Workspace role badge */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <span className={ROLE_CLS[user.role]}>{ROLE_LABELS[user.role]}</span>
      </td>

      {/* Project access */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#00875A', flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, color: 'var(--bb-u-name)' }}>Active member</span>
        </div>
      </td>

      {/* Actions */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        {canRemove ? (
          <button
            className="bb-action-btn bb-action-danger"
            disabled={removing}
            onClick={onRemove}
            style={{ opacity: removing ? 0.5 : 1 }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Remove
          </button>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--bb-page-subtitle)' }}>
            {isOwner ? '—' : 'You'}
          </span>
        )}
      </td>
    </tr>
  );
}

function EmptyMembers({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--bb-avatar-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" fill="#FFAB8F" />
          <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#FFAB8F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--bb-page-title)', marginBottom: 4 }}>
        {hasSearch ? 'No members match your search' : 'No members yet'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--bb-page-subtitle)' }}>
        {hasSearch ? 'Try a different search term' : 'Click "Add Member" to invite people to this project'}
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div style={{ background: 'var(--bb-tbl-wrap-bg)', border: '1px solid var(--bb-tbl-wrap-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '11px 20px', background: 'var(--bb-tbl-head-bg)', borderBottom: '1px solid var(--bb-tbl-wrap-border)' }}>
        <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 10, width: '40%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--bb-tbl-row-border)' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bb-skeleton-stripe-bg)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 12, width: '28%', marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 10, width: '42%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
