import type { WorkflowTemplate } from '@/types';

interface Props {
  templates:        WorkflowTemplate[];
  selectedId:       string | null;
  onSelect:         (tpl: WorkflowTemplate | null) => void;
  /** Show a "Skip / Custom" tile at the start */
  showSkip?:        boolean;
  skipLabel?:       string;
  isLoading?:       boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  development: '#DEEBFF',
  mobile:      '#EAE6FF',
  api:         '#E3FCEF',
  security:    '#FFEBE6',
  engineering: '#DEEBFF',
  product:     '#EAE6FF',
  operations:  '#FFF0B3',
  agile:       '#E3FCEF',
};
const CATEGORY_TEXT: Record<string, string> = {
  development: '#0747A6',
  mobile:      '#403294',
  api:         '#006644',
  security:    '#BF2600',
  engineering: '#0747A6',
  product:     '#403294',
  operations:  '#7A5200',
  agile:       '#006644',
};

export function TemplatePicker({ templates, selectedId, onSelect, showSkip = true, skipLabel = 'Blank / Custom', isLoading }: Props) {
  if (isLoading) {
    return <div className="tpl-picker-loading">Loading templates…</div>;
  }

  return (
    <div className="tpl-picker-grid">
      {showSkip && (
        <button
          type="button"
          className={`tpl-card tpl-card-skip${selectedId === null ? ' tpl-card-selected' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="tpl-card-icon">📄</span>
          <span className="tpl-card-name">{skipLabel}</span>
          <span className="tpl-card-desc">Start from scratch</span>
        </button>
      )}

      {templates.map((tpl) => {
        const catBg   = CATEGORY_COLORS[tpl.category] ?? '#F4F5F7';
        const catText = CATEGORY_TEXT[tpl.category]   ?? '#42526E';
        const isSelected = selectedId === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            className={`tpl-card${isSelected ? ' tpl-card-selected' : ''}`}
            onClick={() => onSelect(isSelected ? null : tpl)}
          >
            <span className="tpl-card-icon">{tpl.icon || '📋'}</span>
            <span className="tpl-card-name">{tpl.name}</span>
            <span className="tpl-card-desc">{tpl.description}</span>
            {tpl.category && (
              <span className="tpl-card-cat" style={{ background: catBg, color: catText }}>
                {tpl.category}
              </span>
            )}
            {isSelected && (
              <span className="tpl-card-check">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#E75026"/>
                  <path d="M5 8l2.5 2.5L11 5.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
