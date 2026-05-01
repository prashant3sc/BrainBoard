import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useRBAC } from '@/hooks/useRBAC';
import { useActiveSprint } from '@/features/projects/useSprints';
import { KanbanBoard } from '@/features/kanban/components/KanbanBoard';
import { IssueListView } from '@/features/kanban/components/IssueListView';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import type { Issue } from '@/types';

const PALETTE: { bg: string; text: string }[] = [
  { bg: '#B3D4FF', text: '#0747A6' },
  { bg: '#ABF5D1', text: '#006644' },
  { bg: '#FFAB8F', text: '#7A1F08' },
  { bg: '#EAE6FF', text: '#403294' },
  { bg: '#FFF0B3', text: '#7A5200' },
  { bg: '#FFE2E2', text: '#8B0000' },
];

function memberColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { can } = useRBAC();

  const [searchQuery,        setSearchQuery]        = useState('');
  const [modalOpen,          setModalOpen]          = useState(false);
  const [viewMode,           setViewMode]           = useState<'board' | 'list'>('board');
  const [assigneeFilter,     setAssigneeFilter]     = useState<string[]>([]);
  const { data: members  = [] } = useProjectMembers(projectId ?? '');
  const { data: activeSprintData, isLoading: issuesLoading } = useActiveSprint(projectId ?? '');
  const allIssues = activeSprintData?.issues ?? [];

  function toggleAssignee(userId: string) {
    setAssigneeFilter((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [searchParams, setSearchParams]   = useSearchParams();

  // Deep-link: ?issue=<uuid> opens the modal for that issue
  useEffect(() => {
    const issueId = searchParams.get('issue');
    if (issueId && allIssues.length > 0) {
      const found = allIssues.find((i) => i.id === issueId);
      if (found) {
        setSelectedIssue(found);
        setModalOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, allIssues]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {activeSprintData?.sprint && (
            <span className="kb-project-tag">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="3.5" fill="#E75026"/>
              </svg>
              {activeSprintData.sprint.name}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="kb-topbar-right">
          {/* Member avatar stack — clickable to filter by assignee */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {members.slice(0, 5).map((m, i) => {
              const { bg, text } = memberColor(m.user.id);
              const selected = assigneeFilter.includes(m.user.id);
              return (
                <div
                  key={m.user.id}
                  role="button"
                  tabIndex={0}
                  className="kb-t-avatar"
                  onClick={() => toggleAssignee(m.user.id)}
                  onKeyDown={(e) => e.key === 'Enter' && toggleAssignee(m.user.id)}
                  title={selected ? `Remove ${m.user.name} filter` : `Filter by ${m.user.name}`}
                  style={{
                    background: bg,
                    color:      text,
                    marginLeft: i === 0 ? 0 : -6,
                    zIndex:     selected ? members.length + 1 : members.length - i,
                    cursor:     'pointer',
                    boxShadow:  selected
                      ? `0 0 0 2px var(--bb-content-bg), 0 0 0 4px ${text}`
                      : undefined,
                    transform:  selected ? 'scale(1.15)' : undefined,
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                >
                  {getInitials(m.user.name)}
                </div>
              );
            })}
            {members.length > 5 && (
              <div
                className="kb-t-avatar"
                style={{ background: '#F4F5F7', color: '#42526E', marginLeft: -6, zIndex: 0 }}
                title={`+${members.length - 5} more`}
              >
                +{members.length - 5}
              </div>
            )}
            {/* Clear filter indicator */}
            {assigneeFilter.length > 0 && (
              <button
                onClick={() => setAssigneeFilter([])}
                title="Clear assignee filter"
                style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600,
                  color: '#E75026', background: '#FFF3F0',
                  border: '1px solid #FFD9CC', borderRadius: 20,
                  padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                ✕ {assigneeFilter.length} {assigneeFilter.length === 1 ? 'user' : 'users'}
              </button>
            )}
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
            <button
              className={`kb-view-btn${viewMode === 'board' ? ' kb-view-active' : ''}`}
              title="Board view"
              onClick={() => setViewMode('board')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor"/>
                <rect x="7" y="4" width="4" height="11" rx="1" fill="currentColor"/>
                <rect x="13" y="7" width="2" height="8"  rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={`kb-view-btn${viewMode === 'list' ? ' kb-view-active' : ''}`}
              title="List view"
              onClick={() => setViewMode('list')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Add Card */}
          {can('editIssue') && (
            <button className="kb-btn-primary" onClick={() => openAdd()}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Card
            </button>
          )}
        </div>
      </div>

      {/* ── Board / List ── */}
      {viewMode === 'board' ? (
        <KanbanBoard
          projectId={projectId}
          searchQuery={searchQuery}
          assigneeFilter={assigneeFilter}
          onIssueClick={openEdit}
        />
      ) : (
        <IssueListView
          issues={allIssues}
          members={members}
          isLoading={issuesLoading}
          searchQuery={searchQuery}
          assigneeFilter={assigneeFilter}
          projectId={projectId}
          onIssueClick={openEdit}
        />
      )}

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
