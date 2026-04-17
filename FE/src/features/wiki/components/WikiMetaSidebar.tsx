import { useState, useMemo } from 'react';
import type { WikiPage, TocItem } from '@/types';

interface Props {
  page: WikiPage;
  allPages: WikiPage[];
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

function issueDot(type: 'bug' | 'story' | 'task') {
  if (type === 'bug') return 'var(--error, #BF2600)';
  if (type === 'story') return 'var(--info, #0747A6)';
  return 'var(--success, #006644)';
}

function issueEmoji(type: 'bug' | 'story' | 'task') {
  if (type === 'bug') return '🐛';
  if (type === 'story') return '📖';
  return '✅';
}

export function WikiMetaSidebar({ page, allPages }: Props) {
  const [activeToc, setActiveToc] = useState<string | null>(null);

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
      {page.versions && page.versions.length > 0 && (
        <div className="ds-section">
          <span className="ds-label">Version history</span>
          <div className="version-list">
            {page.versions.map((v, i) => (
              <div className="version-item" key={i}>
                <div className={`version-dot ${v.isLatest ? 'latest' : ''}`} />
                <div className="version-info">
                  {v.label} — {v.ago}
                  {v.isLatest && <span className="version-tag">Latest</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked issues */}
      {page.linkedIssues && page.linkedIssues.length > 0 && (
        <div className="ds-section">
          <span className="ds-label">Linked issues</span>
          <div className="ds-related">
            {page.linkedIssues.map((issue) => (
              <div className="ds-link" key={issue.id}>
                <span>{issueEmoji(issue.type)}</span>
                {issue.id} — {issue.title}
              </div>
            ))}
          </div>
        </div>
      )}

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
