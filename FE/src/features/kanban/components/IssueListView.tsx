import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useRBAC } from '@/hooks/useRBAC';
import { useAvailability } from '@/hooks/useAvailability';
import type { Issue, IssueStatus, ProjectMember } from '@/types';
import { KANBAN_COLUMNS } from './KanbanBoard';

interface Props {
  issues:         Issue[];
  members:        ProjectMember[];
  isLoading:      boolean;
  searchQuery:    string;
  assigneeFilter: string[];
  projectId:      string;
  onIssueClick:   (issue: Issue) => void;
  isWriteLocked?: boolean;
  onAddIssue?:    (status: IssueStatus) => void;
}

/* ── Colour helpers ── */
const PALETTE = [
  { bg: '#E3FCEF', text: '#006644' }, { bg: '#FFAB8F', text: '#7A1F08' },
  { bg: '#B3D4FF', text: '#0747A6' }, { bg: '#ABF5D1', text: '#006644' },
  { bg: '#EAE6FF', text: '#403294' }, { bg: '#FFF0B3', text: '#7A5200' },
  { bg: '#FFE2E2', text: '#8B0000' }, { bg: '#D3F1FF', text: '#003566' },
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}
function isOverdue(iso: string) { return new Date(iso) < new Date(); }

const STATUS_META: Record<IssueStatus, { dot: string; label: string }> = {
  todo:        { dot: '#97A0AF', label: 'To Do'       },
  in_progress: { dot: '#0065FF', label: 'In Progress' },
  review:      { dot: '#FF8B00', label: 'In Review'   },
  done:        { dot: '#00875A', label: 'Done'        },
};

const PRIORITY_STYLE: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  critical: { dot: '#DE350B', bg: '#FFEBE6', text: '#DE350B', label: 'Critical' },
  high:     { dot: '#FF6B4A', bg: '#FFF0EB', text: '#BF3A1E', label: 'High'     },
  medium:   { dot: '#0065FF', bg: '#E8F0FF', text: '#0052CC', label: 'Medium'   },
  low:      { dot: '#97A0AF', bg: '#F4F5F7', text: '#5E6C84', label: 'Low'      },
};

/* ── Icons ── */
function DragHandleIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
      {[0, 5].map((cx) =>
        [2, 7, 12].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx + 1.5} cy={cy} r="1.4" fill="currentColor" />
        ))
      )}
    </svg>
  );
}
function SubtaskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3.25 5.5v1.5a2 2 0 0 0 2 2h1.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1.5 1.5h9a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H4l-2.5 2V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}
function WikiIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 2h8M2 5h8M2 8h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="10" cy="9.5" r="1.5" fill="currentColor"/>
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 5h10M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d={up ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="7" cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="7" cy="11" r="1.2" fill="currentColor"/>
    </svg>
  );
}

/* ── Row context menu ── */
function IssueMenu({ onOpen, onClose }: { onOpen: () => void; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="lv-menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button className="lv-menu-btn" onClick={() => setOpen((v) => !v)} title="More options">
        <DotsIcon />
      </button>
      {open && (
        <div className="lv-menu-dropdown">
          <button className="lv-menu-option" onClick={() => { onOpen(); setOpen(false); }}>
            Open issue
          </button>
          {onClose && (
            <button className="lv-menu-option lv-menu-option--danger" onClick={() => { onClose(); setOpen(false); }}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
export function IssueListView({
  issues, members, isLoading, searchQuery, assigneeFilter,
  projectId, onIssueClick, isWriteLocked = false, onAddIssue,
}: Props) {
  const qc = useQueryClient();
  const { can } = useRBAC();
  const { getStatus } = useAvailability();

  /* Local issues for optimistic DnD updates */
  const [local, setLocal] = useState<Issue[]>(issues);
  useEffect(() => { setLocal(issues); }, [issues]);

  /* Collapsed groups */
  const [collapsed, setCollapsed] = useState<Set<IssueStatus>>(new Set());
  function toggleGroup(id: IssueStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* Filtering */
  const q = searchQuery.trim().toLowerCase();
  const afterSearch = q
    ? local.filter((i) => i.title.toLowerCase().includes(q) || (i.ticketId ?? '').toLowerCase().includes(q))
    : local;
  const filtered = assigneeFilter.length > 0
    ? afterSearch.filter((i) => i.assigneeId && assigneeFilter.includes(i.assigneeId))
    : afterSearch;

  /* Drag-and-drop */
  function onDragEnd(result: DropResult) {
    if (!can('moveIssue') || isWriteLocked) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as IssueStatus;
    const oldStatus = source.droppableId as IssueStatus;

    setLocal((prev) => prev.map((i) => i.id === draggableId ? { ...i, status: newStatus } : i));

    if (newStatus !== oldStatus) {
      issuesApi.update(draggableId, { status: newStatus })
        .catch(() => qc.invalidateQueries({ queryKey: ['issues', projectId] }));
    }
  }

  if (isLoading) {
    return (
      <div className="lv-wrap">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="lv-skeleton" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="lv-wrap">
        <div className="lv-empty">No issues found.</div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="lv-wrap">
        {KANBAN_COLUMNS.map((col) => {
          const group  = filtered.filter((i) => i.status === col.id);
          const meta   = STATUS_META[col.id];
          const isOpen = !collapsed.has(col.id);

          const statusClass = col.id === 'in_progress' ? 'inprog' : col.id === 'review' ? 'review' : col.id === 'done' ? 'done' : 'todo';
          return (
            <div key={col.id} className={`lv-group lv-group--${statusClass}`}>
              {/* ── Group header ── */}
              <div className="lv-group-header">
                <div className="lv-group-header-left">
                  <span className="lv-group-dot" style={{ background: meta.dot }} />
                  <span className="lv-group-title">{meta.label}</span>
                  <span className="lv-group-count">{group.length}</span>
                </div>
                <div className="lv-group-header-right">
                  <button
                    className="lv-group-btn"
                    onClick={() => toggleGroup(col.id)}
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronIcon up={isOpen} />
                  </button>
                  {onAddIssue && (
                    <button
                      className="lv-group-btn"
                      onClick={() => onAddIssue(col.id)}
                      title={`Add issue to ${meta.label}`}
                    >
                      <PlusIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Droppable rows ── */}
              {isOpen && (
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`lv-droppable${snapshot.isDraggingOver ? ' lv-droppable--over' : ''}`}
                    >
                      {group.length === 0 && !snapshot.isDraggingOver && (
                        <div className="lv-group-empty">No issues</div>
                      )}

                      {group.map((issue, index) => {
                        const prio    = PRIORITY_STYLE[issue.priority];
                        const overdue = issue.due && issue.status !== 'done' && isOverdue(issue.due);
                        const shortId = issue.ticketId ?? `#${issue.id.slice(0, 6).toUpperCase()}`;
                        const assignee = members.find((m) => m.user.id === issue.assigneeId)?.user;
                        const { bg: avBg, text: avText } = assignee ? avatarColor(assignee.id) : { bg: '#F4F5F7', text: '#97A0AF' };

                        return (
                          <Draggable key={issue.id} draggableId={issue.id} index={index}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={`lv-row${snap.isDragging ? ' lv-row--dragging' : ''}`}
                                onClick={() => onIssueClick(issue)}
                              >
                                {/* Drag handle */}
                                <div
                                  {...prov.dragHandleProps}
                                  className="lv-drag-handle"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DragHandleIcon />
                                </div>

                                {/* Ticket ID */}
                                <span className="lv-ticket-id">{shortId}</span>

                                {/* Title + meta */}
                                <div className="lv-title-block">
                                  <span className="lv-title">{issue.title}</span>
                                  <div className="lv-meta">
                                    <span className="lv-meta-item">
                                      <SubtaskIcon />
                                      {issue.subtaskCount ?? 0} subtask{(issue.subtaskCount ?? 0) !== 1 ? 's' : ''}
                                    </span>
                                    <span className="lv-meta-item">
                                      <CommentIcon />
                                      {issue.commentCount ?? 0} comment{(issue.commentCount ?? 0) !== 1 ? 's' : ''}
                                    </span>
                                    {issue.wikiLinked && (
                                      <span className="lv-meta-item lv-meta-wiki">
                                        <WikiIcon />
                                        Wiki linked
                                      </span>
                                    )}
                                    {issue.due && (
                                      <span className={`lv-meta-item${overdue ? ' lv-meta-overdue' : ''}`}>
                                        <CalendarIcon />
                                        {formatDate(issue.due)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Priority pill */}
                                <div className="lv-priority-col">
                                  <span
                                    className="lv-priority-pill"
                                    style={{ background: prio?.bg, color: prio?.text }}
                                  >
                                    <span className="lv-priority-dot" style={{ background: prio?.dot }} />
                                    {prio?.label ?? issue.priority}
                                  </span>
                                </div>

                                {/* Assignee */}
                                <div className="lv-assignee">
                                  {assignee ? (
                                    <>
                                      <div className="lv-avatar-wrap">
                                        <div className="lv-assignee-avatar" style={{ background: avBg, color: avText }}>
                                          {getInitials(assignee.name)}
                                        </div>
                                        <span
                                          className={`av-status-dot av-status-dot--${getStatus(assignee.id)}`}
                                          title={getStatus(assignee.id) === 'on_leave' ? 'On leave' : 'Working today'}
                                        />
                                      </div>
                                      <span className="lv-assignee-name">{assignee.name}</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="lv-assignee-avatar lv-assignee-avatar--empty">
                                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                          <circle cx="7" cy="5" r="2.8" stroke="currentColor" strokeWidth="1.3"/>
                                          <path d="M1.5 12.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                        </svg>
                                      </div>
                                      <span className="lv-unassigned">Unassigned</span>
                                    </>
                                  )}
                                </div>

                                {/* Three-dot menu */}
                                <IssueMenu onOpen={() => onIssueClick(issue)} />
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
