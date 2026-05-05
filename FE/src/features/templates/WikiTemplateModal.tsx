import { useTemplates } from './useTemplates';
import { TemplatePicker } from './TemplatePicker';
import type { WorkflowTemplate, WikiTemplateConfig } from '@/types';
import { useState } from 'react';

interface Props {
  projectId: string;
  onSelect:  (title: string, content: string) => void;
  onBlank:   () => void;
  onClose:   () => void;
}

export function WikiTemplateModal({ projectId, onSelect, onBlank, onClose }: Props) {
  const [picked, setPicked] = useState<WorkflowTemplate | null>(null);
  const { data: templates = [], isLoading } = useTemplates('wiki', projectId);

  function handleConfirm() {
    if (!picked) {
      onBlank();
    } else {
      const cfg = picked.config as WikiTemplateConfig;
      onSelect(cfg.title ?? picked.name, cfg.content ?? '');
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bb-modal-animate"
        style={{
          background: 'var(--bb-modal-bg)',
          border:     '1px solid var(--bb-modal-border)',
          borderRadius: 14,
          width: '100%', maxWidth: 640,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--bb-modal-title)', margin: 0 }}>
              New Page from Template
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--bb-text-muted)', marginTop: 3 }}>
              Pick a template to prefill your page with structure and content.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-muted)', padding: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Template grid */}
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          <TemplatePicker
            templates={templates}
            selectedId={picked?.id ?? null}
            onSelect={(tpl) => setPicked(tpl)}
            showSkip={true}
            skipLabel="Blank Page"
            isLoading={isLoading}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--bb-modal-border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bb-modal-cancel-bg)', border: '1px solid var(--bb-modal-cancel-border)',
              color: 'var(--bb-modal-cancel-color)', borderRadius: 6, padding: '7px 16px',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              background: '#E75026', color: '#fff', border: 'none',
              borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {picked ? `Use "${picked.name}"` : 'Create Blank Page'}
          </button>
        </div>
      </div>
    </div>
  );
}
