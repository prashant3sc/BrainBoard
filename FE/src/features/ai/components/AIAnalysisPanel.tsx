import type { AnalyzeIssueResponse, RecommendedUser } from '@/api/ai';

interface Props {
  result: AnalyzeIssueResponse;
  onApplyPoints: (points: number) => void;
  onApplyAssignee: (user: RecommendedUser) => void;
  onClose: () => void;
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: '#fff',
    }}>
      {initials}
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    high:   { bg: '#E3FCEF', text: '#006644' },
    medium: { bg: '#FFF8EC', text: '#B7650B' },
    low:    { bg: '#F4F5F7', text: '#6B778C' },
  };
  const c = map[level] ?? map.low;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
      background: c.bg, color: c.text, textTransform: 'uppercase',
    }}>
      {level}
    </span>
  );
}

export function AIAnalysisPanel({ result, onApplyPoints, onApplyAssignee, onClose }: Props) {
  const pts = Math.round(result.story_points.value * 10) / 10;

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
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>AI Analysis</span>
        <button type="button" onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Story Points */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
            Story Points
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#4F46E5' }}>{pts}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>pts</span>
              <ConfidenceBadge level={result.story_points.confidence} />
            </div>
            <button type="button" onClick={() => onApplyPoints(pts)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #6366F1', background: 'white', color: '#4F46E5', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Apply
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.5 }}>
            {result.story_points.reason}
          </p>
        </div>

        <div style={{ height: 1, background: '#E5E7EB' }} />

        {/* Issue Type */}
        {result.issue_type?.value && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>
              Suggested Type
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{result.issue_type.value}</span>
              <ConfidenceBadge level={result.issue_type.confidence} />
            </div>
          </div>
        )}

        <div style={{ height: 1, background: '#E5E7EB' }} />

        {/* Assignee */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
            Recommended Assignee
          </div>
          {result.assignee?.user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <UserAvatar name={result.assignee.user.name} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.assignee.user.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{result.assignee.user.role}</div>
                </div>
              </div>
              <button type="button" onClick={() => onApplyAssignee(result.assignee.user!)}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#16A34A', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Assign
              </button>
            </div>
          ) : (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
              No suitable assignee found in project members
            </div>
          )}
          {result.assignee?.reason && (
            <p style={{ fontSize: 11, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.5 }}>{result.assignee.reason}</p>
          )}
        </div>

      </div>
    </div>
  );
}
