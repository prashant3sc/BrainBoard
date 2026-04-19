import { useState, useMemo, useRef, useEffect } from 'react';
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

export function WikiSidebar({ pages, selectedPageId, onSelect, onCreatePage, onDeletePage, canCreate, canDelete }: Props) {
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const topLevelPages = useMemo(() => pages.filter((p) => p.parentId === null), [pages]);

  const filteredPages = search.trim()
    ? pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  function getChildren(pageId: string) {
    return pages.filter((p) => p.parentId === pageId);
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

  /* close menu on outside click */
  useEffect(() => {
    if (!menuOpenId) return;
    function onDown() { setMenuOpenId(null); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpenId]);

  return (
    <div className="wiki-tree">
      <div className="wiki-tree-header">
        <div className="wiki-tree-title">Pages</div>
        <div className="wiki-search">
          <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>🔍</span>
          <input
            className="wiki-search-input"
            placeholder="Find a page…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="wiki-tree-body">
        {filteredPages ? (
          filteredPages.length > 0 ? (
            filteredPages.map((page) => (
              <div
                key={page.id}
                className={`tree-item ${selectedPageId === page.id ? 'active' : ''}`}
                onClick={() => onSelect(page)}
              >
                <span className="tree-item-icon">{page.icon ?? '📄'}</span>
                {page.title}
              </div>
            ))
          ) : (
            <p style={{ padding: '12px 8px', fontSize: 12, color: 'var(--bb-text-muted)' }}>
              No pages found.
            </p>
          )
        ) : (
          topLevelPages.map((page) => {
            const children = getChildren(page.id);
            const isMenuOpen = menuOpenId === page.id;

            return (
              <div key={page.id}>
                {/* Parent page row */}
                <div
                  className={`tree-item tree-item-with-menu ${selectedPageId === page.id ? 'active' : ''}`}
                  onClick={() => onSelect(page)}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                >
                  <span className="tree-item-icon">{page.icon ?? '📄'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {page.title}
                  </span>

                  {(canCreate || canDelete) && (
                    <button
                      className="tree-item-menu-btn"
                      onClick={(e) => toggleMenu(page.id, e)}
                      title="More options"
                    >
                      ···
                    </button>
                  )}

                  {isMenuOpen && (
                    <div
                      className="tree-item-dropdown"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {canCreate && (
                        <button
                          className="tree-item-dropdown-option"
                          onClick={(e) => handleAddSubpage(page.id, e)}
                        >
                          <span>📄</span> Add subpage
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="tree-item-dropdown-option tree-item-dropdown-danger"
                          onClick={(e) => handleDelete(page.id, e)}
                        >
                          <span>🗑️</span> Delete page
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Children */}
                {children.length > 0 && (
                  <div className="tree-sub">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className={`tree-item ${selectedPageId === child.id ? 'active' : ''}`}
                        onClick={() => onSelect(child)}
                      >
                        <span className="tree-item-icon">{child.icon ?? '📄'}</span>
                        {child.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {canCreate && (
          <button
            className="tree-new-btn"
            onClick={() => onCreatePage(null)}
          >
            <span>+</span> New page
          </button>
        )}
      </div>
    </div>
  );
}
