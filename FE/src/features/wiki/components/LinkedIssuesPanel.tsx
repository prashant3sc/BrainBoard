import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWikiLinks, useWikiHistory, useLinkTicket, useUnlinkTicket } from '@/features/wiki/useWiki';
import { issuesApi } from '@/api/issues';
import { useUsers } from '@/features/users/useUsers';
import { useRBAC } from '@/hooks/useRBAC';
import type { Issue, WikiPage, TocItem } from '@/types';

export type PanelTab = 'issues' | 'history' | 'info';

interface Props {
  page: WikiPage;
  allPages: WikiPage[];
  projectId: string;
  initialTab?: PanelTab;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'In Review',
  done:        'Done',
};
const STATUS_CLASS: Record<string, string> = {
  todo:        'lip-status--todo',
  in_progress: 'lip-status--progress',
  review:      'lip-status--review',
  done:        'lip-status--done',
};
const PRIORITY_DOT: Record<string, string> = {
  critical: '#E75026',
  high:     '#F97316',
  medium:   '#3B82F6',
  low:      '',
};
const TYPE_CLASS: Record<string, string> = {
  task:    'lip-type--task',
  bug:     'lip-type--bug',
  story:   'lip-type--story',
  subtask: 'lip-type--subtask',
};

function avatarColor(str: string): string {
  const palette = ['#7C3AED', '#10B981', '#3B82F6', '#F59E0B', '#E75026'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function extractToc(html: string): TocItem[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const items: TocItem[] = [];
  let idx = 0;
  div.querySelectorAll('h2, h3').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (text) items.push({ level: parseInt(el.tagName[1]), text, id: `toc-${idx++}` });
  });
  return items;
}

const PANEL_TITLE: Record<PanelTab, string> = {
  issues:  'Linked issues',
  history: 'History',
  info:    'Page info',
};

export function LinkedIssuesPanel({ page, allPages, projectId, initialTab = 'issues', onClose }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { can } = useRBAC();

  const { data: linkedItems = [] } = useWikiLinks(page.id);
  const { data: allIssues   = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn:  () => issuesApi.getAll(projectId),
    enabled:  !!projectId,
  });
  const { data: history = [] } = useWikiHistory(page.id);
  const { data: users   = [] } = useUsers();

  const { mutate: linkTicket,   isPending: linking   } = useLinkTicket();
  const { mutate: unlinkTicket, isPending: unlinking } = useUnlinkTicket();

  const linkedIds    = new Set(linkedItems.map((l) => l.issue.id));
  const pickable     = allIssues.filter(
    (i) => !linkedIds.has(i.id) &&
      (!search.trim() || i.title.toLowerCase().includes(search.toLowerCase()))
  );
  const linkedIssues = linkedItems
    .map((l) => allIssues.find((i) => i.id === l.issue.id))
    .filter(Boolean) as Issue[];

  const toc = useMemo(() => extractToc(page.content), [page.content, page.id]);
  const relatedPages = useMemo(
    () => (page.relatedPageIds ?? []).map((id) => allPages.find((p) => p.id === id)).filter(Boolean) as WikiPage[],
    [page.relatedPageIds, allPages],
  );

  const createdAt = page.createdAt
    ? new Date(page.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const updatedAt = new Date(page.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="lip-panel">

      {/* Header */}
      <div className="lip-header">
        <span className="lip-title">
          {PANEL_TITLE[initialTab]}
          {initialTab === 'issues' && linkedItems.length > 0 && (
            <span className="lip-count">{linkedItems.length}</span>
          )}
        </span>
        <button className="lip-icon-btn" title="Close" onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Link issue action — fixed above scroll, issues tab only */}
      {initialTab === 'issues' && can('editWikiPage') && (
        <div className="lip-action-bar">
          {pickerOpen ? (
            <div className="lip-picker">
              <input
                autoFocus
                className="lip-picker-input"
                placeholder="Search issues…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="lip-picker-list">
                {pickable.length === 0 && (
                  <div className="lip-picker-empty">
                    {search ? 'No matches' : 'All issues already linked'}
                  </div>
                )}
                {pickable.map((i) => (
                  <button
                    key={i.id}
                    className="lip-picker-item"
                    disabled={linking}
                    onClick={() => {
                      linkTicket({ pageId: page.id, issueId: i.id }, {
                        onSuccess: () => { setPickerOpen(false); setSearch(''); },
                      });
                    }}
                  >
                    <span className="lip-picker-id">{i.ticketId ?? i.sequenceNumber}</span>
                    <span className="lip-picker-title">{i.title}</span>
                  </button>
                ))}
              </div>
              <button className="lip-cancel-btn" onClick={() => { setPickerOpen(false); setSearch(''); }}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="lip-link-btn" onClick={() => setPickerOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Link issue
            </button>
          )}
        </div>
      )}

      {/* Body — scrollable */}
      <div className="lip-body">

        {/* ── Issues ── */}
        {initialTab === 'issues' && (
          <>
            {linkedIssues.length === 0 && !pickerOpen && (
              <div className="lip-empty">No linked issues yet.</div>
            )}

            {linkedIssues.map((issue) => {
              const assignee = users.find((u) => u.id === issue.assigneeId) ?? null;
              const initials = assignee ? userInitials(assignee.name) : null;
              const color    = assignee ? avatarColor(assignee.name) : '#94A3B8';
              return (
                <div className="lip-card" key={issue.id}>
                  <div className="lip-card-top">
                    <div className="lip-card-id">
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{issue.ticketId ?? issue.sequenceNumber ?? issue.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    {assignee && initials && (
                      <div className="lip-avatar" title={assignee.name} style={{ background: color }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  <div className="lip-card-title">{issue.title}</div>

                  <div className="lip-card-footer">
                    <span className={`lip-status ${STATUS_CLASS[issue.status] ?? ''}`}>
                      <span className="lip-status-dot" />
                      {STATUS_LABEL[issue.status] ?? issue.status}
                    </span>
                    <span className="lip-priority-pill">
                      {PRIORITY_DOT[issue.priority] && (
                        <span className="lip-dot" style={{ background: PRIORITY_DOT[issue.priority] }} />
                      )}
                      {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
                    </span>
                    <span className={`lip-type ${TYPE_CLASS[issue.issueType ?? 'task'] ?? ''}`}>
                      {(issue.issueType ?? 'task').charAt(0).toUpperCase() + (issue.issueType ?? 'task').slice(1)}
                    </span>
                  </div>

                  {can('editWikiPage') && (
                    <button
                      className="lip-unlink-btn"
                      disabled={unlinking}
                      onClick={() => unlinkTicket({ pageId: page.id, issueId: issue.id })}
                      title="Unlink"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}

          </>
        )}

        {/* ── History ── */}
        {initialTab === 'history' && (
          <>
            {history.length === 0 && (
              <div className="lip-empty">No version history yet.</div>
            )}
            {history.map((v, i) => (
              <div className="lip-history-item" key={v.id}>
                <div className={`lip-history-dot${i === 0 ? ' latest' : ''}`} />
                <div className="lip-history-info">
                  <div className="lip-history-label">
                    v{v.version_number} — {v.title}
                    {i === 0 && <span className="lip-history-tag">Latest</span>}
                  </div>
                  <div className="lip-history-date">
                    {new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Info ── */}
        {initialTab === 'info' && (
          <>
            <div className="lip-info-section">
              <div className="lip-info-label">Page info</div>
              <div className="lip-info-rows">
                <div className="lip-info-row"><span>Created</span><span>{createdAt}</span></div>
                <div className="lip-info-row"><span>Last edit</span><span>{updatedAt}</span></div>
                {page.viewCount !== undefined && (
                  <div className="lip-info-row"><span>Views</span><span>{page.viewCount} this week</span></div>
                )}
                {page.commentCount !== undefined && (
                  <div className="lip-info-row"><span>Comments</span><span>{page.commentCount}</span></div>
                )}
              </div>
            </div>

            {page.contributors && page.contributors.length > 0 && (
              <div className="lip-info-section">
                <div className="lip-info-label">Contributors</div>
                {page.contributors.map((c, i) => (
                  <div className="lip-contributor" key={i}>
                    <div className={`lip-contributor-avatar ${c.colorClass}`}>{c.initials}</div>
                    <div>
                      <div className="lip-contributor-name">{c.name}</div>
                      <div className="lip-contributor-role">{c.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {toc.length > 0 && (
              <div className="lip-info-section">
                <div className="lip-info-label">Table of contents</div>
                {toc.map((item) => (
                  <div key={item.id} className={`lip-toc-item${item.level === 3 ? ' lip-toc-sub' : ''}`}>
                    {item.text}
                  </div>
                ))}
              </div>
            )}

            {relatedPages.length > 0 && (
              <div className="lip-info-section">
                <div className="lip-info-label">Related pages</div>
                {relatedPages.map((p) => (
                  <div className="lip-related-page" key={p.id}>
                    <span>{p.icon ?? '📄'}</span>
                    <span>{p.title}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
