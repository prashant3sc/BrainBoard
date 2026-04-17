import { useState, useMemo } from 'react';
import type { WikiPage } from '@/types';

const SECTION_ICONS: Record<string, string> = {
  Engineering: '🏢',
  Design: '🎨',
  Product: '📦',
  Onboarding: '🤝',
};

const SECTION_ORDER = ['Engineering', 'Design', 'Product', 'Onboarding'];

interface Props {
  pages: WikiPage[];
  selectedPageId: string | null;
  onSelect: (page: WikiPage) => void;
  onCreatePage: (parentId: string | null) => void;
  canCreate: boolean;
}

export function WikiSidebar({ pages, selectedPageId, onSelect, onCreatePage, canCreate }: Props) {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const topLevelPages = useMemo(() => pages.filter((p) => p.parentId === null), [pages]);

  const sections = useMemo(() => {
    const map: Record<string, WikiPage[]> = {};
    for (const p of topLevelPages) {
      const s = p.section ?? 'Other';
      if (!map[s]) map[s] = [];
      map[s].push(p);
    }
    return map;
  }, [topLevelPages]);

  const sectionKeys = useMemo(() => {
    const ordered = SECTION_ORDER.filter((s) => sections[s]?.length > 0);
    for (const s of Object.keys(sections)) {
      if (!ordered.includes(s)) ordered.push(s);
    }
    return ordered;
  }, [sections]);

  const filteredPages = search.trim()
    ? pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  function toggleSection(section: string) {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function getChildren(pageId: string) {
    return pages.filter((p) => p.parentId === pageId);
  }

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
          /* Search results */
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
          /* Grouped by section */
          sectionKeys.map((section) => {
            const sectionPages = sections[section] ?? [];
            const isOpen = !collapsedSections[section];
            return (
              <div className="tree-section" key={section}>
                <div
                  className="tree-section-header"
                  onClick={() => toggleSection(section)}
                >
                  <span className={`tree-chevron ${isOpen ? 'open' : ''}`}>▶</span>
                  {SECTION_ICONS[section] ?? '📁'} {section}
                </div>
                {isOpen && (
                  <div className="tree-children">
                    {sectionPages.map((page) => {
                      const children = getChildren(page.id);
                      return (
                        <div key={page.id}>
                          <div
                            className={`tree-item ${selectedPageId === page.id ? 'active' : ''}`}
                            onClick={() => onSelect(page)}
                          >
                            <span className="tree-item-icon">{page.icon ?? '📄'}</span>
                            {page.title}
                          </div>
                          {children.length > 0 && (
                            <div className="tree-sub">
                              {children.map((child) => (
                                <div
                                  key={child.id}
                                  className={`tree-item ${selectedPageId === child.id ? 'active' : ''}`}
                                  onClick={() => onSelect(child)}
                                >
                                  {child.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
