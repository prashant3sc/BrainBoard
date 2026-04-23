import type { AnalyzeIssueResponse, RecommendedUser } from '@/api/ai';

interface Props {
  result: AnalyzeIssueResponse;
  onApplyPoints: (points: number) => void;
  onApplyAssignee: (user: RecommendedUser) => void;
  onClose: () => void;
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  frontend:       { bg: '#EFF6FF', text: '#1D4ED8' },
  backend:        { bg: '#F0FDF4', text: '#15803D' },
  tester:         { bg: '#FFFBEB', text: '#B45309' },
  'ai engineer':  { bg: '#F5F3FF', text: '#6D28D9' },
  devops:         { bg: '#FEF2F2', text: '#B91C1C' },
  bug:            { bg: '#FEF2F2', text: '#DC2626' },
  feature:        { bg: '#F0FDF4', text: '#16A34A' },
  api:            { bg: '#EFF6FF', text: '#2563EB' },
  urgent:         { bg: '#FFF7ED', text: '#EA580C' },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role.toLowerCase()] ?? { bg: '#F3F4F6', text: '#374151' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, textTransform: 'capitalize',
    }}>
      {role}
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.5px',
    }}>
      {initials}
    </div>
  );
}

export function AIAnalysisPanel({ result, onApplyPoints, onApplyAssignee, onClose }: Props) {
  const { analysis, recommended_user } = result;
  const pts = Math.round(analysis.story_points * 10) / 10;

  return (
    <div style={{
      border: '1px solid #E0E7FF', borderRadius: 10, background: '#FAFBFF',
      overflow: 'hidden', marginTop: 8,
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z"
              fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>
            AI Analysis
          </span>
        </div>
        <button
          type="button" onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            color: 'rgba(255,255,255,0.8)', lineHeight: 1, display: 'flex' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Story Points */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Story Points Estimate
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#4F46E5', lineHeight: 1 }}>{pts}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>pts</span>
            </div>
            <button
              type="button"
              onClick={() => onApplyPoints(pts)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1.5px solid #6366F1',
                background: 'white', color: '#4F46E5', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Apply points
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.5 }}>
            {analysis.justification}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E5E7EB' }} />

        {/* Required Roles / Labels */}
        {analysis.required_roles.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Required Roles
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {analysis.required_roles.map((r) => <RoleBadge key={r} role={r} />)}
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: '#E5E7EB' }} />

        {/* Recommended Assignee */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Recommended Assignee
          </div>

          {recommended_user ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 8, background: '#F0FDF4',
              border: '1px solid #BBF7D0', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <UserAvatar name={recommended_user.name} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {recommended_user.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>
                    {recommended_user.role}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onApplyAssignee(recommended_user)}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: '#16A34A', color: 'white', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                Assign
              </button>
            </div>
          ) : (
            <div style={{
              padding: '8px 10px', borderRadius: 8, background: '#F9FAFB',
              border: '1px solid #E5E7EB', fontSize: 12, color: '#9CA3AF',
              fontStyle: 'italic',
            }}>
              {analysis.recommended_team['Assigned To'] !== 'Unassigned'
                ? `"${analysis.recommended_team['Assigned To']}" — not a member of this project`
                : 'No matching assignee found in project members'}
            </div>
          )}
        </div>

        {/* Reasoning */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Reasoning
          </div>
          <p style={{ fontSize: 11.5, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
            {analysis.capacity_analysis}
          </p>
        </div>

      </div>
    </div>
  );
}
