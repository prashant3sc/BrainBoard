import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useRBAC } from '@/hooks/useRBAC';
import { useArchivedProject } from '@/hooks/useArchivedProject';
import { useAvailability } from '@/hooks/useAvailability';
import { ArchivedBanner } from '@/components/common/ArchivedBanner';
import { useActiveSprint } from '@/features/projects/useSprints';
import { KanbanBoard } from '@/features/kanban/components/KanbanBoard';
import { IssueListView } from '@/features/kanban/components/IssueListView';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import { issuesApi } from '@/api/issues';
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
  const { isArchived, isWriteLocked, project } = useArchivedProject(projectId);
  const { getStatus } = useAvailability();

  const [searchQuery,        setSearchQuery]        = useState('');
  const [modalOpen,          setModalOpen]          = useState(false);
  const [viewMode,           setViewMode]           = useState<'board' | 'list'>('board');
  const [assigneeFilter,     setAssigneeFilter]     = useState<string[]>([]);
  const [overflowOpen,       setOverflowOpen]       = useState(false);
  const [overflowPos,        setOverflowPos]        = useState({ top: 0, right: 0 });
  const overflowRef    = useRef<HTMLDivElement>(null);
  const overflowBtnRef = useRef<HTMLDivElement>(null);

  const openOverflow = useCallback(() => {
    if (overflowBtnRef.current) {
      const r = overflowBtnRef.current.getBoundingClientRect();
      setOverflowPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOverflowOpen((v) => !v);
  }, []);
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

  // Deep-link: ?issue=<uuid> — fetch the issue directly so it works for
  // backlog and completed-sprint issues, not just active-sprint issues.
  const deepLinkedIssueId = searchParams.get('issue');
  const { data: deepLinkedIssue } = useQuery({
    queryKey: ['issue', deepLinkedIssueId],
    queryFn: () => issuesApi.getById(deepLinkedIssueId!),
    enabled: !!deepLinkedIssueId,
    staleTime: 0,
  });

  useEffect(() => {
    if (deepLinkedIssue) {
      setSelectedIssue(deepLinkedIssue);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [deepLinkedIssue]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Close overflow panel on outside click */
  useEffect(() => {
    if (!overflowOpen) return;
    function handleClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [overflowOpen]);


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

      {/* ── Archived banner ── */}
      {isArchived && <ArchivedBanner viewOnly={isWriteLocked} />}

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
              const status = getStatus(m.user.id);
              return (
                <div
                  key={m.user.id}
                  style={{
                    position: 'relative',
                    marginLeft: i === 0 ? 0 : -6,
                    zIndex: selected ? members.length + 1 : members.length - i,
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="kb-t-avatar"
                    onClick={() => toggleAssignee(m.user.id)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleAssignee(m.user.id)}
                    title={`${m.user.name} — ${status === 'on_leave' ? 'On leave' : 'Working today'}${selected ? ' (click to remove filter)' : ''}`}
                    style={{
                      background: selected ? `color-mix(in srgb, ${bg} 75%, #000 25%)` : bg,
                      color:      text,
                      cursor:     'pointer',
                      boxShadow:  selected ? `0 2px 6px rgba(0,0,0,0.28)` : undefined,
                      transform:  selected ? 'translateY(-1px)' : undefined,
                      transition: 'background 0.15s, box-shadow 0.15s, transform 0.15s',
                    }}
                  >
                    {getInitials(m.user.name)}
                  </div>
                  <span className={`av-status-dot av-status-dot--${status} kb-t-avatar-dot`} />
                </div>
              );
            })}
            {members.length > 5 && (
              <div ref={overflowRef} style={{ marginLeft: -6, zIndex: 0 }}>
                {/* +N chip */}
                <div
                  ref={overflowBtnRef}
                  role="button"
                  tabIndex={0}
                  className="kb-t-avatar"
                  title={`Show ${members.length - 5} more members`}
                  style={{ background: '#F4F5F7', color: '#42526E', cursor: 'pointer', fontWeight: 700 }}
                  onClick={openOverflow}
                  onKeyDown={(e) => e.key === 'Enter' && openOverflow()}
                >
                  +{members.length - 5}
                </div>

                {/* Overflow dropdown — portalled to body so it floats above the kanban board */}
                {overflowOpen && createPortal(
                  <div
                    style={{
                      position: 'fixed',
                      top: overflowPos.top,
                      right: overflowPos.right,
                      background: 'var(--kb-modal-bg, #fff)',
                      border: '1.5px solid var(--bb-border)',
                      borderRadius: 10,
                      boxShadow: '0 6px 24px rgba(9,30,66,0.18)',
                      padding: '6px 0',
                      minWidth: 192,
                      zIndex: 9999,
                    }}
                    /* prevent outside-click handler firing when clicking inside */
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {members.slice(5).map((m) => {
                      const { bg, text } = memberColor(m.user.id);
                      const selected = assigneeFilter.includes(m.user.id);
                      const status = getStatus(m.user.id);
                      return (
                        <button
                          key={m.user.id}
                          type="button"
                          onClick={() => { toggleAssignee(m.user.id); setOverflowOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            width: '100%', padding: '7px 14px',
                            border: 'none', background: selected ? 'var(--bb-bg-input)' : 'transparent',
                            cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: selected ? `color-mix(in srgb, ${bg} 75%, #000 25%)` : bg,
                            color: text,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            boxShadow: selected ? '0 0 0 2px #E75026' : undefined,
                          }}>
                            {getInitials(m.user.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600,
                              color: 'var(--bb-text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {m.user.name}
                            </div>
                            <div style={{ fontSize: 10, color: status === 'on_leave' ? '#FF8B00' : '#36B37E' }}>
                              {status === 'on_leave' ? 'On leave' : 'Working today'}
                            </div>
                          </div>
                          {selected && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                              <path d="M2 6l3 3 5-5" stroke="#E75026" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>,
                  document.body,
                )}
              </div>
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
          {can('editIssue') && !isWriteLocked && (
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
          isWriteLocked={isWriteLocked}
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
        readOnly={isWriteLocked}
      />
    </div>
  );
}

export default KanbanPage;
