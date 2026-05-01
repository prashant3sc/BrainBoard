import { useState, useMemo, useEffect } from 'react';
import type { WikiPage } from '@/types';

interface Props {
  pages: WikiPage[];
  selectedPageId: string | null;
  onSelect: (page: WikiPage) => void;
  onCreatePage: (parentId: string | null) => void;
  onDeletePage: (id: string) => void;
  canCreate: boolean;
  canDelete: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}
    >
      <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="11" cy="7" r="1.2" fill="currentColor"/>
    </svg>
  );
}

function PageIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

export function WikiSidebar({ pages, selectedPageId, onSelect, onCreatePage, onDeletePage, canCreate, canDelete }: Props) {
  const [search, setSearch]         = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());

  const topLevelPages = useMemo(() => pages.filter((p) => p.parentId === null), [pages]);

  const filteredPages = search.trim()
    ? pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  function getChildren(pageId: string) {
    return pages.filter((p) => p.parentId === pageId);
  }

  function toggleCollapse(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleMenu(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpenId((prev) => (prev === id ? null : id));
  }

  function handleAddSubpage(parentId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpenId(null);
    onCreatePage(parentId);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpenId(null);
    onDeletePage(id);
  }

  useEffect(() => {
    if (!menuOpenId) return;
    function onDown() { setMenuOpenId(null); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpenId]);

  return (
    <div className="wks-sidebar">
      {/* Header */}
      <div className="wks-header">
        <span className="wks-header-title">Pages</span>
        {canCreate && (
          <button className="wks-new-top-btn" onClick={() => onCreatePage(null)} title="New page">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            New page
          </button>
        )}
      </div>

      {/* Search */}
      <div className="wks-search-wrap">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: 'var(--bb-text-muted)' }}>
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          className="wks-search-input"
          placeholder="Find a page…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="wks-search-clear" onClick={() => setSearch('')}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Tree body */}
      <div className="wks-body">
        {filteredPages ? (
          filteredPages.length > 0 ? (
            filteredPages.map((page) => (
              <div
                key={page.id}
                className={`wks-item ${selectedPageId === page.id ? 'wks-item-active' : ''}`}
                onClick={() => onSelect(page)}
              >
                <span className="wks-item-icon"><PageIcon /></span>
                <span className="wks-item-label">{page.title}</span>
              </div>
            ))
          ) : (
            <div className="wks-empty">No pages match "{search}"</div>
          )
        ) : (
          topLevelPages.map((page) => {
            const children   = getChildren(page.id);
            const isOpen     = !collapsed.has(page.id);
            const isSelected = selectedPageId === page.id;
            const isMenuOpen = menuOpenId === page.id;

            return (
              <div key={page.id} className="wks-group">
                {/* Parent row */}
                <div
                  className={`wks-item wks-item-parent ${isSelected ? 'wks-item-active' : ''}`}
                  onClick={() => onSelect(page)}
                >
                  {/* Chevron */}
                  {children.length > 0 ? (
                    <button className="wks-chevron-btn" onClick={(e) => toggleCollapse(page.id, e)}>
                      <ChevronIcon open={isOpen} />
                    </button>
                  ) : (
                    <span className="wks-chevron-placeholder" />
                  )}

                  <span className="wks-item-icon">
                    {page.icon ? <span style={{ fontSize: 13 }}>{page.icon}</span> : <PageIcon />}
                  </span>
                  <span className="wks-item-label">{page.title}</span>

                  {(canCreate || canDelete) && (
                    <button
                      className="wks-dots-btn"
                      onClick={(e) => toggleMenu(page.id, e)}
                      title="Options"
                    >
                      <DotsIcon />
                    </button>
                  )}

                  {isMenuOpen && (
                    <div className="wks-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                      {canCreate && (
                        <button className="wks-dropdown-item" onClick={(e) => handleAddSubpage(page.id, e)}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                          </svg>
                          Add subpage
                        </button>
                      )}
                      {canDelete && (
                        <button className="wks-dropdown-item wks-dropdown-danger" onClick={(e) => handleDelete(page.id, e)}>
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path d="M2 4h10M5 4V2.5h4V4M6 6.5v4M8 6.5v4M3 4l.7 7.5h6.6L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Delete page
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Children */}
                {children.length > 0 && isOpen && (
                  <div className="wks-children">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className={`wks-item wks-item-child ${selectedPageId === child.id ? 'wks-item-active' : ''}`}
                        onClick={() => onSelect(child)}
                      >
                        <span className="wks-child-line" />
                        <span className="wks-item-icon">
                          {child.icon ? <span style={{ fontSize: 12 }}>{child.icon}</span> : <PageIcon />}
                        </span>
                        <span className="wks-item-label">{child.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {topLevelPages.length === 0 && !filteredPages && (
          <div className="wks-empty">No pages yet. Create your first page.</div>
        )}
      </div>
    </div>
  );
}
