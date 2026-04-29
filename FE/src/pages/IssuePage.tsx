import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';

/**
 * Deep-link handler: /projects/:projectId/issues/:ticketId
 * Fetches the issue by ticket key (e.g. BB-12) then redirects to the
 * kanban board with the modal open via ?issue= query param.
 */
export default function IssuePage() {
  const { projectId, ticketId } = useParams<{ projectId: string; ticketId: string }>();
  const navigate = useNavigate();

  const { data: issue, isError } = useQuery({
    queryKey: ['issue', ticketId],
    queryFn: () => issuesApi.getById(ticketId!),
    enabled: !!ticketId,
    retry: false,
  });

  useEffect(() => {
    if (issue) {
      navigate(`/projects/${projectId}/kanban?issue=${issue.id}`, { replace: true });
    }
  }, [issue, projectId, navigate]);

  if (isError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 12,
      }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-text-primary)' }}>
          Ticket {ticketId} not found
        </p>
        <button
          onClick={() => navigate(`/projects/${projectId}/kanban`, { replace: true })}
          style={{
            fontSize: 13, color: '#E75026', background: 'none', border: 'none',
            cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Back to board
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--bb-text-muted)', fontSize: 13,
    }}>
      Loading {ticketId}…
    </div>
  );
}
