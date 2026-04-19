import { useState, useEffect, useRef } from 'react';
import {
  useUsers,
  useUpdateUserRole,
  useCreateUser,
  useDeleteUser,
} from '@/features/users/useUsers';
import useAppStore from '@/store/useAppStore';
import type { Role, User } from '@/types';

/* ─────────────────── helpers ─────────────────── */

const ROLES: Role[] = ['admin', 'pm', 'developer', 'viewer'];
type Filter = 'all' | Role;
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Admin',     value: 'admin'     },
  { label: 'PM',        value: 'pm'        },
  { label: 'Developer', value: 'developer' },
  { label: 'Viewer',    value: 'viewer'    },
];

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
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function roleCls(role: Role) {
  const map: Record<Role, string> = {
    admin:     'bb-role-badge bb-role-admin',
    pm:        'bb-role-badge bb-role-pm',
    developer: 'bb-role-badge bb-role-developer',
    viewer:    'bb-role-badge bb-role-viewer',
  };
  return map[role] ?? 'bb-role-badge bb-role-viewer';
}

function roleLabel(role: Role) {
  const map: Record<Role, string> = {
    admin: 'Admin', pm: 'PM', developer: 'Developer', viewer: 'Viewer',
  };
  return map[role] ?? role;
}

/* ─────────────────── toast hook ─────────────────── */

function useToast() {
  const [state, setState] = useState({ msg: '', visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ msg, visible: true });
    timerRef.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), 3000);
  }

  return { toastMsg: state.msg, toastVisible: state.visible, showToast: show };
}

/* ─────────────────── page ─────────────────── */

export function UserManagementPage() {
  const { data: users = [], isLoading, isError } = useUsers();
  const { mutate: updateRole } = useUpdateUserRole();
  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: deleteUser } = useDeleteUser();
  const { togglePalette } = useAppStore();
  const { toastMsg, toastVisible, showToast } = useToast();

  /* filters */
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  /* remove modal */
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  /* add user modal */
  const [addOpen, setAddOpen] = useState(false);
  const [fname,      setFname]      = useState('');
  const [lname,      setLname]      = useState('');
  const [email,      setEmail]      = useState('');
  const [role,       setRole]       = useState<Role | ''>('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [errors,     setErrors]     = useState<Record<string, boolean>>({});
  const fnameRef              = useRef<HTMLInputElement>(null);

  /* focus first field when modal opens */
  useEffect(() => {
    if (addOpen) setTimeout(() => fnameRef.current?.focus(), 80);
  }, [addOpen]);

  /* close modals on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAddOpen(false);
        setFname(''); setLname(''); setEmail(''); setRole(''); setPassword(''); setErrors({});
        setRemoveTarget(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* derived data */
  const q        = search.toLowerCase();
  const filtered = users.filter((u) => {
    const matchRole   = activeFilter === 'all' || u.role === activeFilter;
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const stats = {
    total:   users.length,
    admins:  users.filter((u) => u.role === 'admin').length,
    devs:    users.filter((u) => u.role === 'developer').length,
    viewers: users.filter((u) => u.role === 'viewer').length,
  };

  /* live preview for add-user modal */
  const previewInitials = ((fname[0] ?? '') + (lname[0] ?? '')).toUpperCase() || '?';
  const previewName     = [fname, lname].filter(Boolean).join(' ') || '—';
  const previewEmail    = email || '—';
  const showPreview     = !!(fname || lname || email);

  /* handlers */
  function handleRoleChange(userId: string, newRole: Role) {
    updateRole({ id: userId, role: newRole });
    const u = users.find((x) => x.id === userId);
    showToast(`Role updated to ${roleLabel(newRole)}${u ? ` for ${u.name.split(' ')[0]}` : ''}`);
  }

  function resetForm() {
    setFname(''); setLname(''); setEmail('');
    setRole(''); setPassword(''); setShowPass(false); setErrors({});
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, boolean> = {};
    if (!fname.trim())    errs.fname    = true;
    if (!lname.trim())    errs.lname    = true;
    if (!email.trim())    errs.email    = true;
    if (!role)            errs.role     = true;
    if (!password.trim()) errs.password = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    createUser(
      { first_name: fname.trim(), last_name: lname.trim(), email: email.trim(), role: role as Role, password: password.trim() },
      {
        onSuccess: (u) => {
          setAddOpen(false);
          resetForm();
          showToast(`Invite sent to ${u.name}`);
        },
      },
    );
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    const name = removeTarget.name;
    deleteUser(removeTarget.id, {
      onSuccess: () => showToast(`${name} removed from workspace`),
    });
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
          <span style={{ fontSize: 13, color: 'var(--bb-bc-root)' }}>Workspace</span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-sep)', margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-bc-current)' }}>Users</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <span style={{ fontSize: 13, color: 'var(--bb-search-text)', userSelect: 'none' }}>Search users…</span>
            <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bb-search-text)', background: 'none', border: 'none' }}>⌘K</kbd>
          </div>

          <button
            onClick={() => { resetForm(); setAddOpen(true); }}
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
            Add User
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '28px 32px', background: 'var(--bb-content-bg)', minHeight: 'calc(100vh - 57px)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--bb-page-title)', letterSpacing: '-0.4px' }}>
            User Management
          </div>
          <div style={{ fontSize: 13, color: 'var(--bb-page-subtitle)', marginTop: 3 }}>
            {users.length} member{users.length !== 1 ? 's' : ''} in this workspace
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <StatCard label="Total members" value={stats.total} sub="across workspace" />
          <StatCard
            label="Admins" value={stats.admins}
            valueColor="#E75026"
            sub={<><DotIcon color="#E75026" /> Full access</>}
          />
          <StatCard
            label="Developers" value={stats.devs}
            valueColor="#006644"
            sub={<><DotIcon color="#ABF5D1" /> Active builders</>}
          />
          <StatCard
            label="Viewers" value={stats.viewers}
            valueColor="var(--bb-stat-sub)"
            sub={<><DotIcon color="var(--bb-tbl-row-border)" /> Read-only access</>}
          />
        </div>

        {/* ── Filter row ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`bb-filter-btn${activeFilter === f.value ? ' bb-filter-active' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--bb-tbl-search-bg)',
            border: '1px solid var(--bb-tbl-search-border)',
            borderRadius: 6, padding: '6px 12px', width: 200,
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="var(--bb-tbl-search-ph)" strokeWidth="1.4" />
              <path d="M10 10l2.5 2.5" stroke="var(--bb-tbl-search-ph)" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              className="bb-tbl-search-input"
              placeholder="Filter by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Table ── */}
        {isLoading ? (
          <SkeletonTable />
        ) : isError ? (
          <p style={{ fontSize: 13, color: 'var(--bb-error-color)' }}>Failed to load users.</p>
        ) : (
          <div style={{
            background: 'var(--bb-tbl-wrap-bg)',
            border: '1px solid var(--bb-tbl-wrap-border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['User', 'Email', 'Role', 'Change Role', 'Actions'].map((h, i) => (
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
                      width: ['28%','26%','14%','18%','14%'][i],
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  filtered.map((user, idx) => {
                    const col = avatarColor(idx);
                    return (
                      <UserRow
                        key={user.id}
                        user={user}
                        avatarBg={col.bg}
                        avatarText={col.text}
                        onRoleChange={handleRoleChange}
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

      {/* ── Add User Modal ── */}
      {addOpen && (
        <ModalOverlay onClose={() => { setAddOpen(false); resetForm(); }}>
          <div
            className="bb-modal-animate"
            style={{
              background: 'var(--bb-modal-bg)',
              borderRadius: 12,
              width: '100%', maxWidth: 480,
              boxShadow: '0 20px 48px rgba(23,43,77,.18)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
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
                    <circle cx="8" cy="5" r="3" fill="#E75026" />
                    <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#E75026" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M13 6v4M11 8h4" stroke="#E75026" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-modal-title)', letterSpacing: '-0.2px' }}>
                  Add new user
                </span>
              </div>
              <button
                onClick={() => { setAddOpen(false); resetForm(); }}
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
            </div>

            {/* Modal body */}
            <form onSubmit={handleAddSubmit}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 15 }}>

                {/* Live preview */}
                {showPreview && (
                  <div style={{
                    background: 'var(--bb-invite-preview-bg)',
                    border: '1px solid var(--bb-invite-preview-bdr)',
                    borderRadius: 8, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#E75026', color: '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600, flexShrink: 0,
                    }}>
                      {previewInitials}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-invite-name)' }}>{previewName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--bb-invite-email-color)', fontFamily: 'monospace' }}>{previewEmail}</div>
                    </div>
                  </div>
                )}

                {/* First + Last name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="First name" required error={errors.fname}>
                    <input
                      ref={fnameRef}
                      className={`bb-modal-input${errors.fname ? ' bb-modal-input-error' : ''}`}
                      placeholder="Priya"
                      value={fname}
                      onChange={(e) => { setFname(e.target.value); setErrors((p) => ({ ...p, fname: false })); }}
                    />
                  </Field>
                  <Field label="Last name" required error={errors.lname}>
                    <input
                      className={`bb-modal-input${errors.lname ? ' bb-modal-input-error' : ''}`}
                      placeholder="Sharma"
                      value={lname}
                      onChange={(e) => { setLname(e.target.value); setErrors((p) => ({ ...p, lname: false })); }}
                    />
                  </Field>
                </div>

                {/* Work email */}
                <Field label="Work email" required error={errors.email} hint="An invite will be sent to this address">
                  <input
                    type="email"
                    autoComplete="off"
                    className={`bb-modal-input${errors.email ? ' bb-modal-input-error' : ''}`}
                    placeholder="priya.sharma@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: false })); }}
                  />
                </Field>

                {/* Role */}
                <Field label="Role" required error={errors.role}>
                  <select
                    className={`bb-modal-input bb-modal-select${errors.role ? ' bb-modal-input-error' : ''}`}
                    value={role}
                    onChange={(e) => { setRole(e.target.value as Role); setErrors((p) => ({ ...p, role: false })); }}
                  >
                    <option value="">Select role</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                </Field>

                {/* Password */}
                <Field label="Password" required error={errors.password}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`bb-modal-input${errors.password ? ' bb-modal-input-error' : ''}`}
                      placeholder="Set a password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: false })); }}
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--bb-text-muted)', display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPass ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </Field>
              </div>

              {/* Modal footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--bb-modal-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11.5, color: 'var(--bb-modal-footer-hint)' }}>
                  Fields marked <span style={{ color: '#DE350B' }}>*</span> are required
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setAddOpen(false); resetForm(); }}
                    style={{
                      padding: '7px 16px', borderRadius: 6,
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
                    type="submit"
                    disabled={isCreating}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 18px', borderRadius: 6, border: 'none',
                      background: '#E75026', color: '#FFFFFF',
                      fontSize: 13, fontWeight: 500,
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: isCreating ? 0.6 : 1,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!isCreating) e.currentTarget.style.background = '#C73D16'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#E75026'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {isCreating ? 'Creating…' : 'Create user'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ── Remove Confirm Modal ── */}
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
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                  stroke="var(--bb-remove-icon-color)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-remove-title)', marginBottom: 6 }}>
              Remove {removeTarget.name}?
            </div>
            <div style={{ fontSize: 13, color: 'var(--bb-remove-desc)', lineHeight: 1.55, marginBottom: 20 }}>
              This will revoke {removeTarget.name.split(' ')[0]}'s access immediately.{' '}
              This action cannot be undone.
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
        background: 'rgba(23,43,77,.48)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function StatCard({
  label, value, valueColor, sub,
}: {
  label: string;
  value: number;
  valueColor?: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="bb-stat-card">
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--bb-stat-label)', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: valueColor ?? 'var(--bb-stat-value)', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--bb-stat-sub)', marginTop: 2, display: 'flex', alignItems: 'center' }}>
        {sub}
      </div>
    </div>
  );
}

function DotIcon({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7,
      borderRadius: '50%', background: color, marginRight: 5, flexShrink: 0,
    }} />
  );
}

function Field({
  label, required, error, hint, children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--bb-field-label)' }}>
        {label}
        {required && <span style={{ color: '#DE350B', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--bb-field-hint)', marginTop: 2 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#DE350B', marginTop: 2 }}>This field is required</div>}
    </div>
  );
}

function UserRow({
  user, avatarBg, avatarText, onRoleChange, onRemove,
}: {
  user: User;
  avatarBg: string;
  avatarText: string;
  onRoleChange: (id: string, role: Role) => void;
  onRemove: () => void;
}) {
  return (
    <tr
      style={{ borderBottom: '1px solid var(--bb-tbl-row-border)', transition: 'background 0.1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-tbl-row-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* User cell */}
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
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--bb-u-name)' }}>{user.name}</div>
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

      {/* Role badge */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <span className={roleCls(user.role)}>{roleLabel(user.role)}</span>
      </td>

      {/* Change role */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <select
          className="bb-role-select"
          value={user.role}
          onChange={(e) => onRoleChange(user.id, e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
      </td>

      {/* Actions */}
      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
        <button className="bb-action-btn bb-action-danger" onClick={onRemove}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Remove
        </button>
      </td>
    </tr>
  );
}

function EmptyState() {
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
        No users found
      </div>
      <div style={{ fontSize: 13, color: 'var(--bb-page-subtitle)' }}>
        Try a different search or filter
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div style={{ background: 'var(--bb-skeleton-card-bg)', border: '1px solid var(--bb-card-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '11px 20px', background: 'var(--bb-tbl-head-bg)', borderBottom: '1px solid var(--bb-tbl-wrap-border)' }}>
        <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 10, width: '40%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--bb-tbl-row-border)',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bb-skeleton-stripe-bg)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 12, width: '30%', marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 10, width: '45%', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default UserManagementPage;
