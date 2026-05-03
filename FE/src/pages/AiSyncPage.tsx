import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';

const DOC_LABELS: Record<string, string> = {
  issues:     'Issues',
  wiki_pages: 'Wiki Pages',
  users:      'Users',
  projects:   'Projects',
  sprints:    'Sprints',
};

function StatusBadge({ inSync }: { inSync: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      background: inSync ? '#E3FCEF' : '#FFEBE6',
      color:      inSync ? '#006644' : '#DE350B',
      border:     `1px solid ${inSync ? '#ABF5D1' : '#FFBDAD'}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: inSync ? '#36B37E' : '#DE350B',
        flexShrink: 0,
      }} />
      {inSync ? 'In Sync' : 'Out of Sync'}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bb-bg-card)', border: '1.5px solid var(--bb-border)',
      borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--bb-text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export default function AiSyncPage() {
  const qc = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const { data, isLoading, isError, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['ai', 'sync-status'],
    queryFn: aiApi.syncStatus,
    enabled: false,   // never auto-fetch — only runs when refetch() is called explicitly
  });

  const { mutate: triggerSync, isPending: isSyncing } = useMutation({
    mutationFn: () => aiApi.sync() as Promise<{ message?: string }>,
    onSuccess: (res: any) => {
      setSyncMsg(res?.message ?? 'Sync complete.');
      qc.invalidateQueries({ queryKey: ['ai', 'sync-status'] });
      setTimeout(() => setSyncMsg(null), 5000);
    },
    onError: () => {
      setSyncMsg('Sync failed. Check AI service.');
      setTimeout(() => setSyncMsg(null), 5000);
    },
  });

  const isInSync = data?.in_sync ?? false;

  // Doc types from postgres keys (excludes chroma-only keys like total_documents)
  const docTypes = data ? Object.keys(data.postgres) : [];

  const totalPg     = docTypes.reduce((s, k) => s + (data?.postgres[k] ?? 0), 0);
  const totalChroma = data?.chroma.total_documents ?? docTypes.reduce((s, k) => s + (data?.chroma[k] ?? 0), 0);
  const outOfSyncCount = docTypes.filter(k => (data?.postgres[k] ?? 0) !== (data?.chroma[k] ?? 0)).length;

  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 780, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--bb-text-primary)', margin: 0 }}>
            AI Sync Status
          </h1>
          <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', marginTop: 4 }}>
            Compares PostgreSQL records with ChromaDB embeddings. Admin only.
          </p>
        </div>
        {data && <StatusBadge inSync={isInSync} />}
      </div>

      {/* Out of sync banner */}
      {data && !isInSync && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#FFEBE6', border: '1px solid #FFBDAD',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        }}>
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="6.5" stroke="#DE350B" strokeWidth="1.4"/>
            <path d="M8 5v4M8 11v.5" stroke="#DE350B" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, color: '#DE350B', fontWeight: 500 }}>
            ChromaDB is out of sync with PostgreSQL. {outOfSyncCount} collection{outOfSyncCount !== 1 ? 's' : ''} need reconciliation. Click "Sync Now" to fix.
          </span>
        </div>
      )}

      {/* Sync button + Check Status + last checked */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => triggerSync()}
          disabled={isSyncing}
          style={{
            background: '#E75026', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 20px', fontSize: 13,
            fontWeight: 600, cursor: isSyncing ? 'not-allowed' : 'pointer',
            opacity: isSyncing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 7,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { if (!isSyncing) e.currentTarget.style.background = '#C73D16'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#E75026'; }}
        >
          {isSyncing ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                <path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Syncing…
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M13 8A5 5 0 1 1 8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 1v3l2-1.5L8 1z" fill="#fff"/>
              </svg>
              Sync Now
            </>
          )}
        </button>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            background: 'var(--bb-bg-card)', color: 'var(--bb-text-primary)',
            border: '1.5px solid var(--bb-border)',
            borderRadius: 8, padding: '9px 20px', fontSize: 13,
            fontWeight: 600, cursor: isFetching ? 'not-allowed' : 'pointer',
            opacity: isFetching ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 7,
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { if (!isFetching) e.currentTarget.style.background = 'var(--bb-bg-input)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bb-bg-card)'; }}
        >
          {isFetching ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="8" cy="8" r="6" stroke="var(--bb-border)" strokeWidth="2"/>
                <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--bb-text-primary)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Checking…
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Check Status
            </>
          )}
        </button>

        {lastChecked && (
          <span style={{ fontSize: 12, color: 'var(--bb-text-muted)' }}>
            Last checked: {lastChecked}
          </span>
        )}

        {syncMsg && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: syncMsg.includes('failed') ? '#DE350B' : '#006644',
          }}>
            {syncMsg}
          </span>
        )}
      </div>

      {/* Loading / error states */}
      {isLoading && (
        <div style={{ color: 'var(--bb-text-muted)', fontSize: 13 }}>Loading sync status…</div>
      )}

      {isError && (
        <div style={{
          background: '#FFEBE6', border: '1px solid #FFBDAD',
          borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#DE350B',
        }}>
          Could not reach AI service. Make sure the AI layer is running on port 8001.
        </div>
      )}

      {data && (
        <>
          {/* Summary stat cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="PostgreSQL Total" value={totalPg} sub="records across all types" />
            <StatCard label="ChromaDB Total" value={totalChroma} sub="embedded documents" />
            <StatCard
              label="Gap"
              value={totalPg - totalChroma}
              sub={isInSync ? 'fully reconciled' : 'records not yet embedded'}
            />
            <StatCard
              label="Collections Out of Sync"
              value={outOfSyncCount}
              sub={`of ${docTypes.length} collections`}
            />
          </div>

          {/* Per-collection table */}
          <div style={{
            background: 'var(--bb-bg-card)', border: '1.5px solid var(--bb-border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bb-border)' }}>
                  {['Collection', 'PostgreSQL', 'ChromaDB', 'Gap', 'Status'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: 'var(--bb-text-muted)',
                      background: 'var(--bb-bg-input)', textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docTypes.map((type, i) => {
                  const pg     = data.postgres[type] ?? 0;
                  const chroma = data.chroma[type] ?? 0;
                  const diff   = pg - chroma;
                  const synced = diff === 0;
                  return (
                    <tr key={type} style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--bb-border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bb-bg-input)',
                    }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>
                        {DOC_LABELS[type] ?? type}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                        {pg}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                        {chroma}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: synced ? '#36B37E' : '#DE350B' }}>
                        {synced ? '—' : `+${diff}`}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge inSync={synced} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
