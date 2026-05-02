interface Props {
  /** Show the full "view only" banner (non-admin on archived project) */
  viewOnly?: boolean;
}

/**
 * Sticky banner shown at the top of every project page when the project
 * is archived.
 *
 * - Admin sees a neutral info banner (can still act).
 * - PM / Developer / Viewer sees a "view only" warning banner.
 */
export function ArchivedBanner({ viewOnly = false }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 20px',
      background: viewOnly ? 'var(--bb-err-bg, #FFF0EE)' : '#FFFAE6',
      borderBottom: `1px solid ${viewOnly ? 'var(--bb-err-border, #FFBDAD)' : '#FFE380'}`,
      fontSize: 13,
      color: viewOnly ? 'var(--bb-err-text, #BF2600)' : '#7A5800',
      flexShrink: 0,
    }}>
      {/* Icon */}
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M2 4h12v1.5L8 9 2 5.5V4z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
        />
        <rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      </svg>

      <span>
        <strong>Archived project</strong>
        {viewOnly
          ? ' — this project is read-only. Contact an admin to unarchive it.'
          : ' — you have full access as an admin.'}
      </span>
    </div>
  );
}
