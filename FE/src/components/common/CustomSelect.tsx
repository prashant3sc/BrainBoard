import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  /** small coloured dot (hex) */
  dot?: string;
  /** secondary hint shown on the right */
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  /** 'sm' = compact for inline use (table cells), 'md' = default */
  size?: 'sm' | 'md';
  /** Extra class on the outer wrapper */
  className?: string;
}

function ChevronDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
      <path d="M2 4l3.5 3.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
      <path d="M2 6l3 3 5-5" stroke="#E75026" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 4;

export function CustomSelect({
  value, onChange, options, placeholder = 'Select…',
  disabled = false, error = false, size = 'md', className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);
  const isSmall  = size === 'sm';

  /* Calculate fixed menu position from trigger bounding rect */
  const calcMenuStyle = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect   = el.getBoundingClientRect();
    const vpH    = window.innerHeight;
    const spaceB = vpH - rect.bottom - MENU_GAP;
    const spaceT = rect.top - MENU_GAP;

    /* Prefer below; flip up if not enough room */
    const openUp = spaceB < Math.min(MENU_MAX_HEIGHT, options.length * 36 + 8) && spaceT > spaceB;

    if (openUp) {
      setMenuStyle({
        position: 'fixed',
        bottom: vpH - rect.top + MENU_GAP,
        left:   rect.left,
        width:  Math.max(rect.width, 180),
        zIndex: 9999,
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        top:  rect.bottom + MENU_GAP,
        left: rect.left,
        width: Math.max(rect.width, 180),
        zIndex: 9999,
      });
    }
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    calcMenuStyle();

    function onScroll() { calcMenuStyle(); }
    function onResize() { calcMenuStyle(); }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target)) setOpen(false);
    }

    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, calcMenuStyle]);

  const menu = open ? createPortal(
    <div
      className={`csel-menu${isSmall ? ' csel-menu-sm' : ''}`}
      style={menuStyle}
      /* keep menu open when clicking inside it */
      onMouseDown={(e) => e.stopPropagation()}
    >
      {options.map((opt) => (
        <div
          key={opt.value}
          className={`csel-item${opt.value === value ? ' csel-item-sel' : ''}`}
          onClick={() => { onChange(opt.value); setOpen(false); }}
        >
          {opt.dot && <span className="csel-dot" style={{ background: opt.dot }} />}
          <span className="csel-item-label">{opt.label}</span>
          {opt.hint && <span className="csel-item-hint">{opt.hint}</span>}
          {opt.value === value && <CheckIcon />}
        </div>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`csel-wrap ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        className={`csel-trigger${isSmall ? ' csel-trigger-sm' : ''}${error ? ' csel-trigger-error' : ''}${open ? ' csel-trigger-open' : ''}`}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="csel-trigger-inner">
          {selected?.dot && <span className="csel-dot" style={{ background: selected.dot }} />}
          <span className={`csel-value${!selected ? ' csel-placeholder' : ''}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown />
      </button>

      {menu}
    </div>
  );
}
