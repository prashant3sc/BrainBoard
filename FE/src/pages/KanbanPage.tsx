import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import { KanbanBoard } from '@/features/kanban/components/KanbanBoard';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import type { Issue } from '@/types';

/* Avatar colours for the topbar stack (static display) */
const TOP_AVATARS = [
  { initials: 'RV', bg: '#B3D4FF', color: '#0747A6' },
  { initials: 'SI', bg: '#ABF5D1', color: '#006644' },
  { initials: 'PS', bg: '#FFAB8F', color: '#7A1F08' },
];

export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [searchQuery,   setSearchQuery]   = useState('');
  const [modalOpen,     setModalOpen]     = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => projectsApi.getById(projectId!),
    enabled:  !!projectId,
  });

  if (!projectId) {
    return (
      <p style={{ padding: 32, color: 'var(--bb-error-color)', fontSize: 13 }}>
        No project selected.
      </p>
    );
  }

  function openAdd() {
    setSelectedIssue(null);
    setModalOpen(true);
  }

  function openEdit(issue: Issue) {
    setSelectedIssue(issue);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); }

  return (
    <div className="kb-page">

      {/* ── Topbar ── */}
      <div className="kb-topbar">
        {/* Breadcrumb */}
        <div className="kb-topbar-left">
          <span style={{ fontSize: 13, color: 'var(--bb-bc-root)' }}>Workspace</span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-sep)', margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-root)' }}>Projects</span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-sep)', margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-bc-current)' }}>
            {project?.name ?? '…'}
          </span>
          <span className="kb-project-tag">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="3.5" fill="#E75026"/>
            </svg>
            Active
          </span>
        </div>

        {/* Right controls */}
        <div className="kb-topbar-right">
          {/* Avatar stack */}
          <div style={{ display: 'flex' }}>
            {TOP_AVATARS.map((av, i) => (
              <div
                key={av.initials}
                className="kb-t-avatar"
                style={{
                  background:  av.bg,
                  color:       av.color,
                  marginLeft:  i === 0 ? 0 : -6,
                  zIndex:      TOP_AVATARS.length - i,
                }}
                title={av.initials}
              >
                {av.initials}
              </div>
            ))}
          </div>

          {/* Search box */}
          <div className="kb-search-box">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--bb-search-text)' }}/>
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ color: 'var(--bb-search-text)' }}/>
            </svg>
            <input
              className="kb-search-input"
              placeholder="Search cards…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View toggle */}
          <div className="kb-view-toggle">
            <button className="kb-view-btn kb-view-active" title="Board view">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor"/>
                <rect x="7" y="4" width="4" height="11" rx="1" fill="currentColor"/>
                <rect x="13" y="7" width="2" height="8"  rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button className="kb-view-btn" title="List view">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Add Card */}
          <button className="kb-btn-primary" onClick={() => openAdd()}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add Card
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <KanbanBoard
        projectId={projectId}
        searchQuery={searchQuery}
        onIssueClick={openEdit}
      />

      {/* ── Modal (create + edit) ── */}
      <IssueModal
        issue={selectedIssue}
        isOpen={modalOpen}
        projectId={projectId}
        onClose={closeModal}
        onNavigate={openEdit}
      />
    </div>
  );
}

export default KanbanPage;
