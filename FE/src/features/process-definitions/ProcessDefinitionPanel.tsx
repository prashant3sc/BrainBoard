import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchedProcessDefinitions } from '@/features/wiki/useProcessDefinitions';
import type { ProcessCategory, TriggerContext, IssueType } from '@/types';

interface Props {
  projectId: string;
  context: TriggerContext;
  issueType?: IssueType | null;
  /** Compact single-line variant for tight spaces (e.g. modals). Default: false */
  compact?: boolean;
}

const CATEGORY_LABELS: Record<ProcessCategory, string> = {
  process:   'Process',
  standard:  'Standard',
  runbook:   'Runbook',
  checklist: 'Checklist',
};

const CATEGORY_ICON: Record<ProcessCategory, string> = {
  process:   '⚙',
  standard:  '📐',
  runbook:   '📋',
  checklist: '✅',
};

const CONTEXT_LABEL: Record<TriggerContext, string> = {
  issue_creation:    'For this issue type',
  issue_view:        'Relevant process',
  sprint_completion: 'Before closing this sprint',
  release_task:      'Release guidance',
  incident:          'Incident process',
  bug:               'Bug process',
  pr_review:         'Review policy',
  definition_of_done:'Definition of Done',
};

export function ProcessDefinitionPanel({ projectId, context, issueType, compact = false }: Props) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const { data: definitions = [], isLoading, isError } = useMatchedProcessDefinitions(
    projectId,
    context,
    issueType,
  );

  if (isLoading) return null;
  if (isError || definitions.length === 0) return null;

  const label = CONTEXT_LABEL[context] ?? 'Relevant process';

  function openWikiPage(wikiPageId: string) {
    navigate(`/projects/${projectId}/wiki?page=${wikiPageId}`);
  }

  if (compact) {
    return (
      <div className="pd-panel pd-panel--compact">
        <div className="pd-compact-header">
          <span className="pd-compact-label">{label}</span>
          <div className="pd-compact-list">
            {definitions.map((pd) => (
              <button
                key={pd.id}
                className="pd-compact-link"
                onClick={() => openWikiPage(pd.wikiPageId)}
                title={pd.shortDescription || pd.wikiPageTitle}
              >
                <span className="pd-compact-icon">{CATEGORY_ICON[pd.category]}</span>
                {pd.wikiPageTitle}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-panel">
      <button
        className="pd-panel-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="pd-panel-label">{label}</span>
        <svg
          className={`pd-chevron${collapsed ? '' : ' pd-chevron--open'}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {!collapsed && (
        <div className="pd-panel-body">
          {definitions.map((pd) => (
            <div key={pd.id} className="pd-card">
              <div className="pd-card-header">
                <span className="pd-category-badge">
                  {CATEGORY_ICON[pd.category]} {CATEGORY_LABELS[pd.category]}
                </span>
                <button
                  className="pd-open-btn"
                  onClick={() => openWikiPage(pd.wikiPageId)}
                >
                  View
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 3 }}>
                    <path d="M2 8l6-6M4 2h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pd-card-title">{pd.wikiPageTitle}</div>
              {pd.shortDescription && (
                <div className="pd-card-desc">{pd.shortDescription}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
