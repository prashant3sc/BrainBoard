import { useState } from 'react';
import { useCreateProject } from '../useProjects';
import { useApplyProjectTemplate, useTemplates } from '@/features/templates/useTemplates';
import { TemplatePicker } from '@/features/templates/TemplatePicker';
import useAuthStore from '@/store/useAuthStore';
import type { WorkflowTemplate, ProjectTemplateConfig } from '@/types';

interface Props {
  isOpen:  boolean;
  onClose: () => void;
}

type Step = 'pick' | 'form';

function deriveKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [step,           setStep]           = useState<Step>('pick');
  const [selectedTpl,    setSelectedTpl]    = useState<WorkflowTemplate | null>(null);
  const [name,           setName]           = useState('');
  const [description,    setDescription]    = useState('');
  const [key,            setKey]            = useState('');
  const [keyTouched,     setKeyTouched]     = useState(false);

  const user                         = useAuthStore((s) => s.user);
  const { mutate: createProject, isPending, error } = useCreateProject();
  const { mutate: applyTemplate, isPending: applying } = useApplyProjectTemplate();
  const { data: projectTemplates = [], isLoading: tplLoading } = useTemplates('project');

  if (!isOpen) return null;

  function reset() {
    setStep('pick');
    setSelectedTpl(null);
    setName('');
    setDescription('');
    setKey('');
    setKeyTouched(false);
  }

  function handleClose() { reset(); onClose(); }

  function handleTemplatePicked(tpl: WorkflowTemplate | null) {
    setSelectedTpl(tpl);
  }

  function handleNext() {
    setStep('form');
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!keyTouched) setKey(deriveKey(val));
  }

  function handleKeyChange(val: string) {
    setKeyTouched(true);
    setKey(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !key) return;
    createProject(
      { name, description, key, ownerId: user.id, memberIds: [user.id], isArchived: false },
      {
        onSuccess: (project) => {
          if (selectedTpl) {
            applyTemplate(
              { projectId: project.id, templateId: selectedTpl.id },
              { onSettled: () => { reset(); onClose(); } },
            );
          } else {
            reset();
            onClose();
          }
        },
      },
    );
  }

  const keyValid   = /^[A-Z0-9]{1,6}$/.test(key);
  const serverError = (error as any)?.response?.data?.key?.[0] ?? null;
  const isBusy     = isPending || applying;

  // ── Step 1: template picker ───────────────────────────────────────────────
  if (step === 'pick') {
    const cfg = selectedTpl?.config as ProjectTemplateConfig | undefined;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={handleClose}
      >
        <div
          className="bb-modal-animate"
          style={{
            background:   'var(--bb-modal-bg)',
            border:       '1px solid var(--bb-modal-border)',
            borderRadius: 14,
            width: '100%', maxWidth: 680,
            maxHeight: '88vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 64px rgba(0,0,0,.22)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '22px 28px 16px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--bb-modal-title)', margin: '0 0 4px' }}>
              New Project
            </h2>
            <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', margin: 0 }}>
              Choose a template to pre-configure labels, wiki pages, and compliance rules — or start blank.
            </p>
          </div>

          {/* Template grid */}
          <div style={{ overflowY: 'auto', padding: '0 28px 16px', flex: 1 }}>
            <TemplatePicker
              templates={projectTemplates}
              selectedId={selectedTpl?.id ?? null}
              onSelect={handleTemplatePicked}
              showSkip={true}
              skipLabel="Blank Project"
              isLoading={tplLoading}
            />
          </div>

          {/* Template preview strip */}
          {selectedTpl && cfg && (
            <div style={{
              margin: '0 28px 12px',
              padding: '10px 14px',
              background: 'var(--bb-surface-raised, #F4F5F7)',
              borderRadius: 8,
              border: '1px solid var(--bb-border)',
              fontSize: 12.5, color: 'var(--bb-text-secondary)',
              display: 'flex', gap: 20, flexWrap: 'wrap',
            }}>
              {cfg.labels?.length > 0 && (
                <span>🏷 <strong>{cfg.labels.length}</strong> labels</span>
              )}
              {cfg.wiki_pages?.length > 0 && (
                <span>📄 <strong>{cfg.wiki_pages.length}</strong> wiki pages</span>
              )}
              {cfg.compliance_templates?.length > 0 && (
                <span>🔒 <strong>{cfg.compliance_templates.length}</strong> compliance checks</span>
              )}
              {cfg.sprint_defaults?.duration_weeks && (
                <span>⏱ <strong>{cfg.sprint_defaults.duration_weeks}w</strong> sprints</span>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{
            padding: '14px 28px',
            borderTop: '1px solid var(--bb-modal-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'var(--bb-modal-cancel-bg)', border: '1px solid var(--bb-modal-cancel-border)',
                color: 'var(--bb-modal-cancel-color)', borderRadius: 6, padding: '7px 16px',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                background: '#E75026', color: '#fff', border: 'none',
                borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {selectedTpl ? `Use "${selectedTpl.name}" →` : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: project details form ──────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleClose}
    >
      <div
        className="bb-modal-animate"
        style={{
          background: 'var(--bb-modal-bg)',
          border:     '1px solid var(--bb-modal-border)',
          borderRadius: 12, width: '100%', maxWidth: 440,
          padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with back + template badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setStep('pick')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--bb-text-muted)', padding: '2px 4px', borderRadius: 4,
              display: 'flex', alignItems: 'center',
            }}
            title="Back to templates"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-modal-title)', margin: 0, flex: 1 }}>
            New Project
          </h2>
          {selectedTpl && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#DEEBFF', color: '#0747A6',
            }}>
              {selectedTpl.icon} {selectedTpl.name}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)' }}>Name *</label>
            <input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Client Portal v3"
              className="bb-modal-input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Ticket Prefix *
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-muted)', background: 'var(--bb-bg-input)', border: '1px solid var(--bb-border)', borderRadius: 4, padding: '1px 6px' }}>
                e.g. BB, SHOP, API
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                required
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="BB"
                maxLength={6}
                className="bb-modal-input"
                style={{
                  textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                  borderColor: serverError ? '#DE350B' : (!keyTouched || keyValid) ? undefined : '#DE350B',
                }}
              />
              {key && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: '#E75026', opacity: 0.8 }}>
                  → {key}-1, {key}-2, …
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: serverError ? '#DE350B' : 'var(--bb-text-muted)', margin: 0 }}>
              {serverError ?? 'Uppercase letters and numbers only, max 6 chars. Cannot be changed after creation.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)' }}>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="bb-modal-input"
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'var(--bb-modal-cancel-bg)', border: '1px solid var(--bb-modal-cancel-border)',
                color: 'var(--bb-modal-cancel-color)', borderRadius: 6, padding: '7px 16px',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy || !keyValid}
              style={{
                background: '#E75026', color: '#FFFFFF', border: 'none',
                borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600,
                cursor: (isBusy || !keyValid) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: (isBusy || !keyValid) ? 0.6 : 1,
              }}
            >
              {isBusy ? (applying ? 'Applying template…' : 'Creating…') : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
