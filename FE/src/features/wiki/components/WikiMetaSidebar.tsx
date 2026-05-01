import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WikiPage, TocItem, Issue } from '@/types';
import { useWikiHistory, useWikiLinks, useLinkTicket, useUnlinkTicket } from '@/features/wiki/useWiki';
import { issuesApi } from '@/api/issues';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import { useRBAC } from '@/hooks/useRBAC';

interface Props {
  page: WikiPage;
  allPages: WikiPage[];
  projectId: string;
}

function extractToc(html: string): TocItem[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const items: TocItem[] = [];
  let idx = 0;
  tempDiv.querySelectorAll('h2, h3').forEach((el) => {
    const level = parseInt(el.tagName[1]);
    const text = el.textContent ?? '';
    if (text.trim()) {
      items.push({ level, text: text.trim(), id: `toc-${idx++}` });
    }
  });
  return items;
}



function issueEmoji(type: 'bug' | 'story' | 'task') {
  if (type === 'bug') return '🐛';
  if (type === 'story') return '📖';
  return '✅';
}

export function WikiMetaSidebar({ page, allPages, projectId }: Props) {
  const { can } = useRBAC();
  const [activeToc,      setActiveToc]      = useState<string | null>(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkSearch,     setLinkSearch]     = useState('');
  const [selectedIssue,  setSelectedIssue]  = useState<Issue | null>(null);
  const [modalOpen,      setModalOpen]      = useState(false);

  const toc = useMemo(() => extractToc(page.content), [page.content, page.id]);

  const { data: history     = [] } = useWikiHistory(page.id);
  const { data: linkedItems = [] } = useWikiLinks(page.id);
  const { data: allIssues   = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn:  () => issuesApi.getAll(projectId),
    enabled:  !!projectId,
  });
  const { mutate: linkTicket,   isPending: linking   } = useLinkTicket();
  const { mutate: unlinkTicket, isPending: unlinking } = useUnlinkTicket();

  const linkedIssueIds = new Set(linkedItems.map((l) => l.issue.id));
  const pickableIssues = allIssues.filter(
    (i) => !linkedIssueIds.has(i.id) &&
      (!linkSearch.trim() || i.title.toLowerCase().includes(linkSearch.toLowerCase()))
  );

  const relatedPages = useMemo(
    () => (page.relatedPageIds ?? []).map((id) => allPages.find((p) => p.id === id)).filter(Boolean) as WikiPage[],
    [page.relatedPageIds, allPages],
  );

  const createdAt = page.createdAt
    ? new Date(page.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const updatedAt = new Date(page.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="wiki-meta-sidebar">
      {/* Table of Contents */}
      {toc.length > 0 && (
        <div className="ds-section">
          <span className="ds-label">Table of contents</span>
          <div className="toc-list">
            {toc.map((item) => (
              <div
                key={item.id}
                className={`toc-item ${item.level === 3 ? 'toc-sub' : ''} ${activeToc === item.id ? 'toc-active' : ''}`}
                onClick={() => setActiveToc(item.id)}
              >
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contributors */}
      {page.contributors && page.contributors.length > 0 && (
        <div className="ds-section">
          <span className="ds-label">Contributors</span>
          <div className="ds-people">
            {page.contributors.map((c, i) => (
              <div className="ds-person" key={i}>
                <div className={`ds-avatar ${c.colorClass}`}>{c.initials}</div>
                <div>
                  <div className="ds-name">{c.name}</div>
                  <div className="ds-role-text">{c.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Version history */}
      {history.length > 0 && (
        <div className="ds-section">
          <span className="ds-label">Version history</span>
          <div className="version-list">
            {history.map((v, i) => (
              <div className="version-item" key={v.id}>
                <div className={`version-dot ${i === 0 ? 'latest' : ''}`} />
                <div className="version-info">
                  v{v.version_number} — {v.title}
                  <div style={{ fontSize: 10, color: 'var(--bb-text-muted)', marginTop: 1 }}>
                    {new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {i === 0 && <span className="version-tag">Latest</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked issues */}
      <div className="ds-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="ds-label" style={{ margin: 0 }}>Linked issues</span>
          {can('editWikiPage') && (
            <button
              className="wiki-link-btn"
              onClick={() => { setLinkPickerOpen((v) => !v); setLinkSearch(''); }}
            >
              {linkPickerOpen ? '✕ Cancel' : '+ Link issue'}
            </button>
          )}
        </div>

        {/* Issue picker dropdown */}
        {linkPickerOpen && (
          <div className="wiki-link-picker">
            <input
              autoFocus
              className="wiki-link-search"
              placeholder="Search issues…"
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
            />
            <div className="wiki-link-list">
              {pickableIssues.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--bb-text-muted)' }}>
                  {linkSearch ? 'No matches' : 'All issues already linked'}
                </div>
              )}
              {pickableIssues.map((i) => (
                <button
                  key={i.id}
                  className="wiki-link-pick-item"
                  disabled={linking}
                  onClick={() => {
                    linkTicket({ pageId: page.id, issueId: i.id }, {
                      onSuccess: () => setLinkPickerOpen(false),
                    });
                  }}
                >
                  <span>{issueEmoji((i.issueType ?? 'task') as 'bug' | 'story' | 'task')}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{i.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linked issue rows */}
        {linkedItems.length === 0 && !linkPickerOpen && (
          <div style={{ fontSize: 12, color: 'var(--bb-text-muted)', fontStyle: 'italic' }}>No linked issues yet.</div>
        )}
        <div className="ds-related">
          {linkedItems.map((link) => {
            const fullIssue = allIssues.find((i) => i.id === link.issue.id);
            return (
              <div className="ds-link wiki-linked-issue-row" key={link.id}>
                <span>{issueEmoji((link.issue.issueType ?? 'task') as 'bug' | 'story' | 'task')}</span>
                <button
                  className="wiki-issue-title-btn"
                  title="View issue"
                  onClick={() => {
                    if (fullIssue) { setSelectedIssue(fullIssue); setModalOpen(true); }
                  }}
                >
                  {link.issue.title}
                </button>
                {can('editWikiPage') && (
                  <button
                    className="wiki-unlink-btn"
                    disabled={unlinking}
                    title="Unlink"
                    onClick={() => unlinkTicket({ pageId: page.id, issueId: link.issue.id })}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Issue detail modal — opened when a linked issue is clicked */}
      <IssueModal
        issue={selectedIssue}
        isOpen={modalOpen}
        projectId={projectId}
        onClose={() => { setModalOpen(false); setSelectedIssue(null); }}
        onNavigate={(issue) => { setSelectedIssue(issue); setModalOpen(true); }}
      />

      {/* Related pages */}
      {relatedPages.length > 0 && (
        <div className="ds-section">
          <span className="ds-label">Related pages</span>
          <div className="ds-related">
            {relatedPages.map((p) => (
              <div className="ds-link" key={p.id}>
                <span style={{ fontSize: 11 }}>{p.icon ?? '📄'}</span>
                {p.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page info */}
      <div className="ds-section">
        <span className="ds-label">Page info</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="ds-value">Created: {createdAt}</div>
          <div className="ds-value">Last edit: {updatedAt}</div>
          {page.viewCount !== undefined && (
            <div className="ds-value">Views: {page.viewCount} this week</div>
          )}
          {page.commentCount !== undefined && (
            <div className="ds-value">Comments: {page.commentCount}</div>
          )}
        </div>
      </div>
    </div>
  );
}
