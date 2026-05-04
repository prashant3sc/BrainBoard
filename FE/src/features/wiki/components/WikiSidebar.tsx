import { useState, useMemo, useEffect, useCallback } from 'react';
import type { WikiPage } from '@/types';

interface Props {
  pages: WikiPage[];
  selectedPageId: string | null;
  onSelect: (page: WikiPage) => void;
  onCreatePage: (parentId: string | null) => void;
  onDeletePage: (id: string) => void;
  canCreate: boolean;
  canDelete: boolean;
  collapsed: boolean;
  favIds: string[];
  onFavChange: (ids: string[]) => void;
}

/* ── Icons ── */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}
    >
      <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function PageIcon({ active }: { active?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="12" rx="1.5" stroke={active ? '#E75026' : 'currentColor'} strokeWidth="1.3"/>
      <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke={active ? '#E75026' : 'currentColor'} strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 4.5V7l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 1.5l1.55 3.14 3.46.5-2.5 2.44.59 3.44L7 9.27l-3.1 1.75.59-3.44L2 5.14l3.46-.5L7 1.5z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
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
function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: 'var(--bb-text-muted)' }}>
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

const RECENT_KEY  = 'wks_recent_pages';
const FAV_KEY     = 'wks_fav_pages';
const MAX_RECENT  = 5;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function saveRecent(ids: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}
function loadFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'); } catch { return []; }
}
function saveFavs(ids: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

export function WikiSidebar({
  pages, selectedPageId, onSelect, onCreatePage, onDeletePage,
  canCreate, canDelete, collapsed, favIds, onFavChange,
}: Props) {
  const [tab,        setTab]      = useState<'pages' | 'favs'>('pages');
  const [search,     setSearch]   = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [recentIds,  setRecentIds]  = useState<string[]>(loadRecent);

  /* Track recently viewed */
  useEffect(() => {
    if (!selectedPageId) return;
    setRecentIds((prev) => {
      const next = [selectedPageId, ...prev.filter((id) => id !== selectedPageId)].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, [selectedPageId]);

  /* Close menu on outside click */
  useEffect(() => {
    if (!menuOpenId) return;
    const h = () => setMenuOpenId(null);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpenId]);

  const topLevel = useMemo(() => pages.filter((p) => p.parentId === null), [pages]);
  const getChildren = useCallback((id: string) => pages.filter((p) => p.parentId === id), [pages]);

  const filteredPages = search.trim()
    ? pages.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  const recentPages = useMemo(
    () => recentIds.map((id) => pages.find((p) => p.id === id)).filter(Boolean) as WikiPage[],
    [recentIds, pages],
  );

  const favPages = useMemo(
    () => favIds.map((id) => pages.find((p) => p.id === id)).filter(Boolean) as WikiPage[],
    [favIds, pages],
  );

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = favIds.includes(id) ? favIds.filter((f) => f !== id) : [...favIds, id];
    saveFavs(next);
    onFavChange(next);
  }

  /* ── Collapsed: empty strip (header lives in topbar) ── */
  if (collapsed) {
    return <div className="wks-sidebar wks-sidebar--collapsed" />;
  }

  /* ── Row renderers ── */
  function renderRow(page: WikiPage, depth = 0) {
    const children  = getChildren(page.id);
    const isOpen    = openGroups.has(page.id);
    const isActive  = selectedPageId === page.id;
    const isFav     = favIds.includes(page.id);
    const isMenu    = menuOpenId === page.id;

    return (
      <div key={page.id} className="wks-group">
        <div
          className={`wks-item${isActive ? ' wks-item-active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelect(page)}
        >
          {/* Chevron or spacer */}
          {children.length > 0 ? (
            <button
              className="wks-chevron-btn"
              onClick={(e) => { e.stopPropagation(); toggleGroup(page.id); }}
            >
              <ChevronIcon open={isOpen} />
            </button>
          ) : (
            <span className="wks-chevron-placeholder" />
          )}

          <span className="wks-item-icon">
            {page.icon
              ? <span style={{ fontSize: depth > 0 ? 12 : 13 }}>{page.icon}</span>
              : <PageIcon active={isActive} />}
          </span>

          <span className="wks-item-label">{page.title}</span>

          {/* Fav + dots — visible on hover / active */}
          <span className="wks-item-actions">
            <button
              className="wks-action-btn"
              onClick={(e) => toggleFav(page.id, e)}
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              style={{ color: isFav ? '#E75026' : undefined }}
            >
              <StarIcon filled={isFav} />
            </button>
            {(canCreate || canDelete) && (
              <button
                className="wks-action-btn"
                onClick={(e) => { e.stopPropagation(); setMenuOpenId((p) => p === page.id ? null : page.id); }}
                title="Options"
              >
                <DotsIcon />
              </button>
            )}
          </span>

          {isMenu && (
            <div className="wks-dropdown" onMouseDown={(e) => e.stopPropagation()}>
              {canCreate && (
                <button className="wks-dropdown-item" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); onCreatePage(page.id); }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  Add subpage
                </button>
              )}
              {canDelete && (
                <button className="wks-dropdown-item wks-dropdown-danger" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); onDeletePage(page.id); }}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M2 4h10M5 4V2.5h4V4M6 6.5v4M8 6.5v4M3 4l.7 7.5h6.6L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delete page
                </button>
              )}
            </div>
          )}
        </div>

        {children.length > 0 && isOpen && children.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="wks-sidebar">

      {/* ── Tabs ── */}
      <div className="wks-tabs">
        <button className={`wks-tab${tab === 'pages' ? ' wks-tab-active' : ''}`} onClick={() => setTab('pages')}>
          Pages
        </button>
        <button className={`wks-tab${tab === 'favs' ? ' wks-tab-active' : ''}`} onClick={() => setTab('favs')}>
          Favorites
        </button>
      </div>

      {/* ── Search + New ── */}
      <div className="wks-toolbar">
        <div className="wks-search-wrap">
          <SearchIcon />
          <input
            className="wks-search-input"
            placeholder="Search pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="wks-search-kbd">⌘K</span>
          {search && (
            <button className="wks-search-clear" onClick={() => setSearch('')}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        {canCreate && (
          <button className="wks-new-btn" onClick={() => onCreatePage(null)} title="New page">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="wks-body">

        {/* Search results */}
        {filteredPages ? (
          filteredPages.length > 0 ? (
            filteredPages.map((p) => (
              <div
                key={p.id}
                className={`wks-item${selectedPageId === p.id ? ' wks-item-active' : ''}`}
                onClick={() => onSelect(p)}
              >
                <span className="wks-chevron-placeholder" />
                <span className="wks-item-icon"><PageIcon active={selectedPageId === p.id} /></span>
                <span className="wks-item-label">{p.title}</span>
              </div>
            ))
          ) : (
            <div className="wks-empty">No pages match "{search}"</div>
          )

        ) : tab === 'favs' ? (
          /* Favorites tab */
          favPages.length > 0 ? (
            favPages.map((p) => (
              <div key={p.id} className={`wks-item${selectedPageId === p.id ? ' wks-item-active' : ''}`} onClick={() => onSelect(p)}>
                <span className="wks-chevron-placeholder" />
                <span className="wks-item-icon" style={{ color: '#E75026' }}><StarIcon filled /></span>
                <span className="wks-item-label">{p.title}</span>
              </div>
            ))
          ) : (
            <div className="wks-empty">No favorites yet.<br/>Star a page to add it here.</div>
          )

        ) : (
          /* Pages tab */
          <>
            {/* Recent */}
            {recentPages.length > 0 && (
              <div className="wks-section">
                <div className="wks-section-label">Recent</div>
                {recentPages.map((p) => (
                  <div
                    key={p.id}
                    className={`wks-item wks-item-recent${selectedPageId === p.id ? ' wks-item-active' : ''}`}
                    onClick={() => onSelect(p)}
                  >
                    <span className="wks-recent-icon"><ClockIcon /></span>
                    <span className="wks-item-label">{p.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tree */}
            <div className="wks-section">
              <div className="wks-section-label">Overview</div>
              {topLevel.length > 0
                ? topLevel.map((p) => renderRow(p))
                : <div className="wks-empty">No pages yet.</div>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
