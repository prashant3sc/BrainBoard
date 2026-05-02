import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useDeleteProject, useUpdateProject, useArchiveProject } from '@/features/projects/useProjects';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { AiPulse } from '@/features/projects/components/AiPulse';
import { CreateProjectModal } from '@/features/projects/components/CreateProjectModal';
import { useRBAC } from '@/hooks/useRBAC';
import useAppStore from '@/store/useAppStore';
import type { Project } from '@/types';

type Tab = 'active' | 'archived';

/* ── inline toast ── */
function useToast() {
  const [state, setState] = useState({ msg: '', visible: false, isError: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function show(msg: string, isError = false) {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, visible: true, isError });
    timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), 3500);
  }
  return { toastMsg: state.msg, toastVisible: state.visible, toastIsError: state.isError, showToast: show };
}

export function DashboardPage() {
  const { data: activeProjects = [], isLoading: loadingActive, isError: errorActive } = useProjects(false);
  const { data: archivedProjects = [], isLoading: loadingArchived, isError: errorArchived } = useProjects(true);
  const isLoading = loadingActive || loadingArchived;
  const isError   = errorActive || errorArchived;
  const { mutate: deleteProject }                     = useDeleteProject();
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();
  const { mutate: archiveProject }                    = useArchiveProject();

  const [tab, setTab]                             = useState<Tab>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pulseState, setPulseState]               = useState<{ project: Project; index: number } | null>(null);
  const [deleteTarget, setDeleteTarget]           = useState<Project | null>(null);
  const [editTarget, setEditTarget]               = useState<Project | null>(null);
  const [editName, setEditName]                   = useState('');
  const [editDesc, setEditDesc]                   = useState('');

  const { can } = useRBAC();
  const { togglePalette, showLoginSplash, signalSplashReady } = useAppStore();
  const navigate    = useNavigate();
  const canManage   = can('manageProjectMembers'); // admin + pm
  const { toastMsg, toastVisible, toastIsError, showToast } = useToast();

  // Tell the login splash to exit once dashboard data has finished loading
  useEffect(() => {
    if (showLoginSplash && !isLoading) {
      signalSplashReady();
    }
  }, [showLoginSplash, isLoading]);

  function handleProjectClick(project: Project) {
    if (!project.isArchived) navigate(`/projects/${project.id}/kanban`);
  }

  function handlePulse(project: Project, index: number) {
    setPulseState((prev) => prev?.project.id === project.id ? null : { project, index });
  }

  function openEdit(project: Project) {
    setEditTarget(project);
    setEditName(project.name);
    setEditDesc(project.description);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !editName.trim()) return;
    updateProject(
      { id: editTarget.id, name: editName.trim(), description: editDesc.trim() },
      {
        onSuccess: () => { setEditTarget(null); showToast('Project updated'); },
        onError: (err: Error) => showToast(err.message || 'Failed to update project', true),
      },
    );
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteProject(deleteTarget.id, {
      onSuccess: () => { setDeleteTarget(null); showToast('Project deleted'); },
      onError: (err: Error) => { setDeleteTarget(null); showToast(err.message || 'Failed to delete project', true); },
    });
  }

  function handleArchive(project: Project) {
    const next = !project.isArchived;
    archiveProject({ id: project.id, isArchived: next }, {
      onSuccess: () => showToast(next ? 'Project archived' : 'Project restored'),
      onError: (err: Error) => showToast(err.message || 'Permission denied', true),
    });
  }

  const displayed     = tab === 'active' ? activeProjects : archivedProjects;
  const activeCount   = activeProjects.length;
  const archivedCount = archivedProjects.length;

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
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-bc-current)' }}>Projects</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            role="button" tabIndex={0}
            onClick={togglePalette}
            onKeyDown={(e) => e.key === 'Enter' && togglePalette()}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'var(--bb-search-bg)', border: '1px solid var(--bb-search-border)',
              borderRadius: 6, padding: '6px 12px', width: 200, cursor: 'text',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="var(--bb-search-text)" strokeWidth="1.4" />
              <path d="M10 10l2.5 2.5" stroke="var(--bb-search-text)" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--bb-search-text)', userSelect: 'none' }}>Search projects…</span>
            <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bb-search-text)', background: 'none', border: 'none' }}>⌘K</kbd>
          </div>

          {can('createProject') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#E75026', color: '#FFFFFF', border: 'none',
                padding: '8px 16px', borderRadius: 6, fontSize: 13.5, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#C73D16')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#E75026')}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New Project
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="bb-dash-enter" style={{ padding: '28px 32px', flex: 1, background: 'var(--bb-content-bg)', minHeight: 'calc(100vh - 57px)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--bb-page-title)', letterSpacing: '-0.4px' }}>Projects</div>
          <div style={{ fontSize: 13, color: 'var(--bb-page-subtitle)', marginTop: 3 }}>
            {activeCount} active · {archivedCount} archived
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--bb-tbl-wrap-border)', marginBottom: 22 }}>
          {(['active', 'archived'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#E75026' : 'var(--bb-page-subtitle)',
                borderBottom: tab === t ? '2px solid #E75026' : '2px solid transparent',
                marginBottom: -1, fontFamily: 'inherit', textTransform: 'capitalize',
                transition: 'color 0.1s',
              }}
            >
              {t === 'active' ? `Active (${activeCount})` : `Archived (${archivedCount})`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ background: 'var(--bb-skeleton-card-bg)', border: '1px solid var(--bb-card-border)', borderRadius: 10, padding: 20, minHeight: 178 }}>
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 8, height: 36, width: 36, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 14, width: '60%', marginBottom: 8 }} />
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 12, width: '90%', marginBottom: 4 }} />
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 12, width: '70%' }} />
              </div>
            ))}
          </div>
        )}

        {isError && <p style={{ fontSize: 13, color: 'var(--bb-error-color)' }}>Failed to load projects.</p>}

        {!isLoading && !isError && (
          <div className="bb-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {displayed.map((project, i) => (
              <div
                key={project.id}
                className="bb-dash-card-enter"
                style={{ '--card-i': i } as React.CSSProperties}
              >
                <ProjectCard
                  project={project}
                  onClick={handleProjectClick}
                  onPulse={handlePulse}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onArchive={handleArchive}
                  canManage={canManage}
                  index={i}
                  isPulseActive={pulseState?.project.id === project.id}
                />
              </div>
            ))}

            {/* Create card — only on active tab */}
            {tab === 'active' && can('createProject') && (
              <div
                role="button" tabIndex={0}
                onClick={() => setIsCreateModalOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setIsCreateModalOpen(true)}
                className="bb-new-project-card"
                style={{
                  background: 'var(--bb-new-card-bg)', border: '1.5px dashed var(--bb-new-card-border)',
                  borderRadius: 10, padding: 20, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, minHeight: 178, transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div className="bb-new-icon" style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--bb-new-icon-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: 'var(--bb-new-icon-color)', lineHeight: 1,
                }}>+</div>
                <span className="bb-new-label" style={{ fontSize: 12.5, color: 'var(--bb-new-label-color)', fontWeight: 500 }}>
                  Create new project
                </span>
              </div>
            )}

            {displayed.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', color: 'var(--bb-page-subtitle)', fontSize: 13 }}>
                {tab === 'active' ? 'No active projects.' : 'No archived projects.'}
              </div>
            )}
          </div>
        )}

        {pulseState && (
          <AiPulse project={pulseState.project} projectIndex={pulseState.index} onClose={() => setPulseState(null)} />
        )}
      </div>

      <CreateProjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* ── Edit Modal ── */}
      {editTarget && (
        <ModalOverlay onClose={() => setEditTarget(null)}>
          <div
            className="bb-modal-animate"
            style={{ background: 'var(--bb-modal-bg)', borderRadius: 12, width: '100%', maxWidth: 460, boxShadow: '0 20px 48px rgba(23,43,77,.18)', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--bb-modal-border)' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-modal-title)' }}>Edit project</span>
              <button onClick={() => setEditTarget(null)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--bb-modal-cancel-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--bb-field-label)' }}>Project name <span style={{ color: '#DE350B' }}>*</span></label>
                  <input className="bb-modal-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project name" required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--bb-field-label)' }}>Description</label>
                  <textarea className="bb-modal-input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Short description…" rows={3} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--bb-modal-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setEditTarget(null)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--bb-modal-cancel-border)', background: 'var(--bb-modal-cancel-bg)', color: 'var(--bb-modal-cancel-color)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button type="submit" disabled={isUpdating || !editName.trim()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: '#E75026', color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: isUpdating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isUpdating ? 0.6 : 1 }}>
                  {isUpdating ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div
            className="bb-modal-animate"
            style={{ background: 'var(--bb-modal-bg)', borderRadius: 12, width: '100%', maxWidth: 400, padding: 28, boxShadow: '0 20px 48px rgba(23,43,77,.18)', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bb-remove-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="var(--bb-remove-icon-color)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-remove-title)', marginBottom: 6 }}>Delete "{deleteTarget.name}"?</div>
            <div style={{ fontSize: 13, color: 'var(--bb-remove-desc)', lineHeight: 1.55, marginBottom: 20 }}>
              This will permanently delete the project and all its issues, wiki pages, and members. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--bb-modal-cancel-border)', background: 'var(--bb-modal-cancel-bg)', color: 'var(--bb-modal-cancel-color)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleDeleteConfirm} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#DE350B', color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, delete</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Toast ── */}
      <div className={`bb-toast${toastVisible ? ' bb-toast-show' : ''}`} style={toastIsError ? { background: '#FFF0EE', borderColor: '#FFBDAD' } : {}}>
        {toastIsError ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="#DE350B" />
            <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="#006644" />
            <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span style={toastIsError ? { color: '#DE350B' } : {}}>{toastMsg}</span>
      </div>
    </>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(23,43,77,.48)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

export default DashboardPage;
