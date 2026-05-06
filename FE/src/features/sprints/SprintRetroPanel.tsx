import { useState, useCallback, useEffect } from 'react';
import { retroApi } from '@/api/retro';
import { wikiApi } from '@/api/wiki';
import type { Sprint, Issue, SprintRetro, SprintRetroEdit } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  sprint: Sprint;
  issues: Issue[];
  projectId: string;
  memberNames: Record<string, string>;
  onClose: () => void;
}

type Phase = 'summary' | 'loading' | 'retro' | 'saving' | 'saved' | 'error';

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   '#1D9E75',
  medium: '#FF991F',
  low:    '#DE350B',
};

const CONFIDENCE_BG: Record<string, string> = {
  high:   '#E3FCEF',
  medium: '#FFFAE6',
  low:    '#FFEBE6',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, items, editKey, editing, onEdit }: {
  title: string;
  items: string[];
  editKey: keyof SprintRetroEdit;
  editing: SprintRetroEdit | null;
  onEdit: (key: keyof SprintRetroEdit, value: string[]) => void;
}) {
  if (!editing) {
    // Read-only view
    if (items.length === 0) return null;
    return (
      <div style={{
        background: 'var(--bb-tbl-wrap-bg)',
        border: '1px solid var(--bb-tbl-wrap-border)',
        borderRadius: 10, padding: '14px 18px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bb-text-muted)', marginBottom: 10 }}>
          {title}
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--bb-text-primary)', lineHeight: 1.5 }}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Editable: textarea with one item per line
  const value = editing[editKey] as string[];
  return (
    <div style={{
      background: 'var(--bb-tbl-wrap-bg)',
      border: '1px solid var(--bb-tbl-wrap-border)',
      borderRadius: 10, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bb-text-muted)', marginBottom: 8 }}>
        {title}
      </div>
      <textarea
        value={value.join('\n')}
        onChange={(e) => onEdit(editKey, e.target.value.split('\n'))}
        rows={Math.max(2, value.length + 1)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bb-surface)', color: 'var(--bb-text-primary)',
          border: '1px solid var(--bb-border)', borderRadius: 7,
          padding: '8px 10px', fontSize: 13, lineHeight: 1.5,
          resize: 'vertical', outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#4C9AFF')}
        onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--bb-border)')}
      />
      <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', marginTop: 4 }}>One item per line</div>
    </div>
  );
}

function SummaryCard({ summary, editing, onEdit }: {
  summary: string;
  editing: SprintRetroEdit | null;
  onEdit: (key: keyof SprintRetroEdit, value: string) => void;
}) {
  if (!editing) {
    return (
      <div style={{
        background: 'var(--bb-tbl-wrap-bg)',
        border: '1px solid var(--bb-tbl-wrap-border)',
        borderRadius: 10, padding: '14px 18px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bb-text-muted)', marginBottom: 8 }}>
          Sprint Summary
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--bb-text-primary)', lineHeight: 1.6 }}>{summary}</p>
      </div>
    );
  }
  return (
    <div style={{
      background: 'var(--bb-tbl-wrap-bg)',
      border: '1px solid var(--bb-tbl-wrap-border)',
      borderRadius: 10, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bb-text-muted)', marginBottom: 8 }}>
        Sprint Summary
      </div>
      <textarea
        value={editing.summary}
        onChange={(e) => onEdit('summary', e.target.value)}
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bb-surface)', color: 'var(--bb-text-primary)',
          border: '1px solid var(--bb-border)', borderRadius: 7,
          padding: '8px 10px', fontSize: 13, lineHeight: 1.6,
          resize: 'vertical', outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#4C9AFF')}
        onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--bb-border)')}
      />
    </div>
  );
}

// ─── Sprint completion stats (shown before AI generation) ─────────────────────

function SprintStats({ sprint, issues, memberNames }: {
  sprint: Sprint;
  issues: Issue[];
  memberNames: Record<string, string>;
}) {
  const total    = issues.length;
  const done     = issues.filter((i) => i.status === 'done').length;
  const notDone  = total - done;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const blocked  = issues.filter((i) => i.priority === 'critical' && i.status !== 'done').length;
  const ptsTotal = issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const ptsDone  = issues.filter((i) => i.status === 'done').reduce((s, i) => s + (i.storyPoints ?? 0), 0);

  // Workload per assignee
  const workload: Record<string, { name: string; total: number; done: number }> = {};
  for (const issue of issues) {
    const id   = issue.assigneeId ?? '__unassigned__';
    const name = id === '__unassigned__' ? 'Unassigned' : (memberNames[id] ?? 'Unknown');
    if (!workload[id]) workload[id] = { name, total: 0, done: 0 };
    workload[id].total++;
    if (issue.status === 'done') workload[id].done++;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Done',       value: `${done}/${total}`,    color: '#1D9E75' },
          { label: 'Completion', value: `${pct}%`,             color: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#FF991F' : '#DE350B' },
          { label: 'Story Pts',  value: `${ptsDone}/${ptsTotal}`, color: '#0052CC' },
          { label: 'Carry-fwd',  value: String(notDone),       color: notDone === 0 ? '#1D9E75' : '#FF5630' },
        ].map((c) => (
          <div key={c.label} style={{
            background: 'var(--bb-tbl-wrap-bg)',
            border: '1px solid var(--bb-tbl-wrap-border)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bb-text-muted)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Carry-forward issues */}
      {notDone > 0 && (
        <div style={{
          background: '#FFFAE6', border: '1px solid #FFE380',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#7A5800',
        }}>
          <strong>{notDone} unfinished issue{notDone !== 1 ? 's' : ''}</strong> will carry forward to the next sprint or backlog.
        </div>
      )}

      {/* Blocked */}
      {blocked > 0 && (
        <div style={{
          background: '#FFEBE6', border: '1px solid #FF8F73',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#8B0000',
        }}>
          <strong>{blocked} critical issue{blocked !== 1 ? 's' : ''}</strong> did not complete — may indicate blockers.
        </div>
      )}

      {/* Team workload */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 8 }}>Team Workload</div>
        <div style={{
          background: 'var(--bb-tbl-wrap-bg)',
          border: '1px solid var(--bb-tbl-wrap-border)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          {Object.values(workload).sort((a, b) => b.total - a.total).map((w, i, arr) => (
            <div key={w.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--bb-tbl-row-border)' : 'none',
            }}>
              <span style={{ fontSize: 12, color: 'var(--bb-text-primary)' }}>{w.name}</span>
              <span style={{ fontSize: 12, color: 'var(--bb-text-muted)' }}>
                {w.done}/{w.total} done
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SprintRetroPanel({ sprint, issues, projectId, memberNames, onClose }: Props) {
  const [phase,     setPhase]     = useState<Phase>('summary');
  const [retro,     setRetro]     = useState<SprintRetro | null>(null);
  const [editing,   setEditing]   = useState<SprintRetroEdit | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Try to load an existing saved retro on mount — if found, skip straight to retro view
  useEffect(() => {
    let cancelled = false;
    retroApi.get(sprint.id)
      .then((existing) => {
        if (!cancelled) {
          setRetro(existing);
          setPhase('retro');
        }
      })
      .catch(() => {
        // 404 = no saved retro yet, stay on summary phase
      });
    return () => { cancelled = true; };
  }, [sprint.id]);

  const handleGenerate = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const result = await retroApi.generate(sprint.id);
      setRetro(result);
      setPhase('retro');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to generate retro. Please try again.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [sprint.id]);

  function handleStartEdit() {
    if (!retro) return;
    setEditing({
      summary:           retro.summary,
      wins:              retro.wins,
      bottlenecks:       retro.bottlenecks,
      repeated_blockers: retro.repeated_blockers,
      scope_changes:     retro.scope_changes,
      workload_notes:    retro.workload_notes,
      patterns:          retro.patterns,
      action_items:      retro.action_items,
    });
    setIsEditing(true);
  }

  function handleEditChange(key: keyof SprintRetroEdit, value: string | string[]) {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
  }

  function handleCancelEdit() {
    setEditing(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!retro || !editing) return;
    setPhase('saving');
    try {
      const updated = await retroApi.save(sprint.id, editing);
      setRetro(updated);
      setEditing(null);
      setIsEditing(false);
      setPhase('retro');
      showToast('Retro saved.');
    } catch {
      setPhase('retro');
      showToast('Save failed. Try again.');
    }
  }

  async function handleCopyToWiki() {
    if (!retro) return;
    const content = buildWikiContent(retro);
    try {
      await wikiApi.create({
        title:     `Retro: ${retro.sprint_name}`,
        content,
        projectId,
        parentId:  null,
        section:   'Engineering',
        tags:      ['retro', 'sprint'],
      });
      showToast('Copied to wiki.');
    } catch {
      showToast('Failed to create wiki page.');
    }
  }

  async function handleSaveAsNote() {
    if (!retro) return;
    const editsToSave = editing ?? {
      summary:           retro.summary,
      wins:              retro.wins,
      bottlenecks:       retro.bottlenecks,
      repeated_blockers: retro.repeated_blockers,
      scope_changes:     retro.scope_changes,
      workload_notes:    retro.workload_notes,
      patterns:          retro.patterns,
      action_items:      retro.action_items,
    };
    setPhase('saving');
    try {
      const updated = await retroApi.save(sprint.id, editsToSave);
      setRetro(updated);
      setEditing(null);
      setIsEditing(false);
      setPhase('retro');
      showToast('Retro note saved.');
    } catch {
      setPhase('retro');
      showToast('Save failed. Try again.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(9, 30, 66, 0.35)',
          zIndex: 200,
        }}
        onClick={phase !== 'loading' && phase !== 'saving' ? onClose : undefined}
      />

      {/* Slide-over panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 560,
        background: 'var(--bb-modal-bg, var(--bb-surface))',
        borderLeft: '1px solid var(--bb-modal-border, var(--bb-border))',
        boxShadow: '-24px 0 48px rgba(9, 30, 66, 0.15)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        overflowY: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--bb-modal-border, var(--bb-border))',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#0052CC',
                background: '#DEEBFF', borderRadius: 20, padding: '2px 10px',
              }}>
                AI Sprint Retro
              </span>
              {retro && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: CONFIDENCE_COLOR[retro.confidence] ?? '#888',
                  background: CONFIDENCE_BG[retro.confidence] ?? '#F4F5F7',
                  borderRadius: 20, padding: '2px 8px',
                }}>
                  {retro.confidence} confidence
                </span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bb-text-primary)' }}>
              {sprint.name}
            </div>
            {sprint.goal && (
              <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginTop: 2 }}>
                Goal: {sprint.goal}
              </div>
            )}
          </div>
          <button
            onClick={phase !== 'loading' && phase !== 'saving' ? onClose : undefined}
            disabled={phase === 'loading' || phase === 'saving'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--bb-text-muted)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-hover-bg, #F4F5F7)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* SUMMARY phase */}
          {phase === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SprintStats sprint={sprint} issues={issues} memberNames={memberNames} />
              <p style={{ margin: 0, fontSize: 13, color: 'var(--bb-text-secondary)', lineHeight: 1.6 }}>
                Generate an AI retrospective to get a structured analysis of this sprint — wins, bottlenecks, patterns, and action items based on real ticket data.
              </p>
              <button
                onClick={handleGenerate}
                style={{
                  width: '100%', padding: '12px 20px',
                  background: '#E75026', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '-0.1px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#C73D16')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#E75026')}
              >
                Generate AI Retro
              </button>
            </div>
          )}

          {/* LOADING phase */}
          {phase === 'loading' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 18, height: '100%', minHeight: 280,
            }}>
              <div style={{
                width: 44, height: 44,
                border: '3px solid var(--bb-tbl-wrap-border)',
                borderTopColor: '#E75026',
                borderRadius: '50%',
                animation: 'bb-spin 0.9s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 4 }}>
                  Reviewing sprint activity…
                </div>
                <div style={{ fontSize: 12, color: 'var(--bb-text-muted)' }}>
                  Analysing {issues.length} issue{issues.length !== 1 ? 's' : ''} to build your retrospective
                </div>
              </div>
            </div>
          )}

          {/* ERROR phase */}
          {phase === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: '#FFEBE6', border: '1px solid #FF8F73',
                borderRadius: 10, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#DE350B', marginBottom: 4 }}>
                  Generation failed
                </div>
                <div style={{ fontSize: 12, color: '#7A0000' }}>{errorMsg}</div>
              </div>
              <button
                onClick={handleGenerate}
                style={{
                  padding: '10px 18px', background: '#0052CC', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* RETRO / SAVING / SAVED phases */}
          {(phase === 'retro' || phase === 'saving' || phase === 'saved') && retro && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Confidence note */}
              {retro.confidence_reason && (
                <div style={{ fontSize: 12, color: 'var(--bb-text-muted)', fontStyle: 'italic' }}>
                  {retro.confidence_reason}
                </div>
              )}

              <SummaryCard
                summary={retro.summary}
                editing={isEditing ? editing : null}
                onEdit={(_, v) => handleEditChange('summary', v as string)}
              />
              <SectionCard title="Wins" items={isEditing ? (editing?.wins ?? []) : retro.wins} editKey="wins" editing={isEditing ? editing : null} onEdit={handleEditChange} />
              <SectionCard title="Bottlenecks" items={isEditing ? (editing?.bottlenecks ?? []) : retro.bottlenecks} editKey="bottlenecks" editing={isEditing ? editing : null} onEdit={handleEditChange} />
              <SectionCard title="Repeated Blockers" items={isEditing ? (editing?.repeated_blockers ?? []) : retro.repeated_blockers} editKey="repeated_blockers" editing={isEditing ? editing : null} onEdit={handleEditChange} />
              <SectionCard title="Scope Changes" items={isEditing ? (editing?.scope_changes ?? []) : retro.scope_changes} editKey="scope_changes" editing={isEditing ? editing : null} onEdit={handleEditChange} />
              <SectionCard title="Workload Notes" items={isEditing ? (editing?.workload_notes ?? []) : retro.workload_notes} editKey="workload_notes" editing={isEditing ? editing : null} onEdit={handleEditChange} />
              <SectionCard title="Patterns" items={isEditing ? (editing?.patterns ?? []) : retro.patterns} editKey="patterns" editing={isEditing ? editing : null} onEdit={handleEditChange} />
              <SectionCard title="Suggested Action Items" items={isEditing ? (editing?.action_items ?? []) : retro.action_items} editKey="action_items" editing={isEditing ? editing : null} onEdit={handleEditChange} />
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(phase === 'retro' || phase === 'saving' || phase === 'saved') && retro && (
          <div style={{
            padding: '14px 24px 18px',
            borderTop: '1px solid var(--bb-modal-border, var(--bb-border))',
            flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {isEditing ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={phase === 'saving'}
                  style={{
                    flex: 1, padding: '9px 16px',
                    background: '#E75026', color: '#fff', border: 'none',
                    borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: phase === 'saving' ? 0.7 : 1,
                  }}
                >
                  {phase === 'saving' ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={phase === 'saving'}
                  style={{
                    padding: '9px 16px',
                    background: 'var(--bb-tbl-wrap-bg)', color: 'var(--bb-text-secondary)',
                    border: '1px solid var(--bb-tbl-wrap-border)',
                    borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={handleStartEdit}
                  style={secondaryBtn}
                >
                  Edit
                </button>
                <button
                  onClick={handleSaveAsNote}
                  disabled={phase === 'saving'}
                  style={{ ...secondaryBtn, opacity: phase === 'saving' ? 0.7 : 1 }}
                >
                  {phase === 'saving' ? 'Saving…' : 'Save retro note'}
                </button>
                <button
                  onClick={handleCopyToWiki}
                  style={secondaryBtn}
                >
                  Copy to wiki
                </button>
                <button
                  onClick={handleGenerate}
                  style={secondaryBtn}
                >
                  Regenerate
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUMMARY footer: generate button is inside the body */}

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: 80, left: 24, right: 24,
            background: '#172B4D', color: '#fff',
            borderRadius: 8, padding: '10px 16px',
            fontSize: 13, fontWeight: 500, zIndex: 10,
            boxShadow: '0 4px 16px rgba(9,30,66,0.3)',
          }}>
            {toast}
          </div>
        )}
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes bb-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--bb-tbl-wrap-bg)',
  color: 'var(--bb-text-secondary)',
  border: '1px solid var(--bb-tbl-wrap-border)',
  borderRadius: 7, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

function buildWikiContent(retro: SprintRetro): string {
  const lines: string[] = [];
  lines.push(`<h2>Sprint Retro: ${retro.sprint_name}</h2>`);
  lines.push(`<p>${retro.summary}</p>`);

  function section(title: string, items: string[]) {
    if (!items.length) return;
    lines.push(`<h3>${title}</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`);
  }

  section('Wins', retro.wins);
  section('Bottlenecks', retro.bottlenecks);
  section('Repeated Blockers', retro.repeated_blockers);
  section('Scope Changes', retro.scope_changes);
  section('Workload Notes', retro.workload_notes);
  section('Patterns', retro.patterns);
  section('Suggested Action Items', retro.action_items);
  lines.push(`<p><em>AI confidence: ${retro.confidence} — ${retro.confidence_reason}</em></p>`);
  return lines.join('\n');
}
