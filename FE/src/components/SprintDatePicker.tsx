import { useState } from 'react';
import type { Sprint } from '@/types';

interface Props {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  existingSprints: Sprint[];
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseISO(s: string): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function firstDayOfMonth(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}

function isoCompare(a: string, b: string) {
  if (!a || !b) return 0;
  return a < b ? -1 : a > b ? 1 : 0;
}

interface MonthGridProps {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  hoverDate: string;
  existingSprints: Sprint[];
  onDayClick: (iso: string) => void;
  onDayHover: (iso: string, el: HTMLElement | null) => void;
  onDayLeave: () => void;
}

function MonthGrid({ year, month, startDate, endDate, hoverDate, existingSprints, onDayClick, onDayHover, onDayLeave }: MonthGridProps) {
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  // Build occupied map
  const occupied: Record<string, string> = {}; // iso -> sprint name
  for (const sp of existingSprints) {
    if (!sp.startDate || !sp.endDate || sp.status === 'completed') continue;
    const start = parseISO(sp.startDate)!;
    const end   = parseISO(sp.endDate)!;
    // iterate days in this sprint range that fall in this month
    const startD = new Date(start.y, start.m, start.d);
    const endD   = new Date(end.y, end.m, end.d);
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
      occupied[iso] = sp.name;
    }
  }

  // Determine effective range end for hover preview
  const rangeEnd = endDate || (startDate && hoverDate && hoverDate >= startDate ? hoverDate : '');

  const cells: JSX.Element[] = [];

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e${i}`} />);
  }

  for (let d = 1; d <= days; d++) {
    const iso = toISO(year, month, d);
    const isStart    = iso === startDate;
    const isEnd      = iso === endDate;
    const isOccupied = !!occupied[iso];
    const occupiedBy = occupied[iso];
    const today      = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const isToday    = iso === today;

    // In selected range
    const inRange = startDate && rangeEnd && iso > startDate && iso < rangeEnd;
    // Is it a range endpoint
    const isEndpoint = isStart || isEnd;

    let bg = 'transparent';
    let color = 'var(--bb-text-primary)';
    let fontWeight: number | string = 400;
    let borderRadius = '6px';
    let border = 'none';

    if (isOccupied) {
      bg = '#FFF3E0';
      color = '#E75026';
      fontWeight = 600;
      borderRadius = '0px';
    }
    if (inRange) {
      bg = 'rgba(231,80,38,0.12)';
      borderRadius = '0px';
    }
    if (isEndpoint && (startDate && rangeEnd)) {
      bg = '#E75026';
      color = '#fff';
      fontWeight = 700;
      borderRadius = isStart ? '6px 0 0 6px' : '0 6px 6px 0';
    }
    if (isEndpoint && startDate && !rangeEnd) {
      bg = '#E75026';
      color = '#fff';
      fontWeight = 700;
      borderRadius = '6px';
    }
    if (isToday && !isEndpoint) {
      border = '1px solid #E75026';
    }

    cells.push(
      <div
        key={iso}
        onClick={() => !isOccupied && onDayClick(iso)}
        onMouseEnter={(e) => onDayHover(iso, isOccupied ? e.currentTarget : null)}
        onMouseLeave={onDayLeave}
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          cursor: isOccupied ? 'not-allowed' : 'pointer',
          background: bg,
          color,
          fontWeight,
          borderRadius,
          border,
          boxSizing: 'border-box',
          userSelect: 'none',
          opacity: isOccupied ? 0.9 : 1,
          position: 'relative',
        }}
        title={isOccupied ? occupiedBy : undefined}
      >
        {d}
        {isOccupied && (
          <span style={{
            position: 'absolute',
            bottom: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#E75026',
          }} />
        )}
      </div>
    );
  }

  return (
    <div style={{ width: 224 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', textAlign: 'center', marginBottom: 8 }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-muted)', textAlign: 'center', paddingBottom: 4 }}>
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

export function SprintDatePicker({ startDate, endDate, onStartChange, onEndChange, existingSprints }: Props) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState('');
  const [tooltip,   setTooltip]   = useState<{ x: number; y: number; name: string } | null>(null);

  // Second month
  const month2 = viewMonth === 11 ? 0 : viewMonth + 1;
  const year2  = viewMonth === 11 ? viewYear + 1 : viewYear;

  function handleDayClick(iso: string) {
    if (!startDate || (startDate && endDate)) {
      onStartChange(iso);
      onEndChange('');
    } else {
      if (isoCompare(iso, startDate) < 0) {
        onStartChange(iso);
        onEndChange(startDate);
      } else {
        onEndChange(iso);
      }
    }
  }

  function handleDayHover(iso: string, el: HTMLElement | null) {
    setHoverDate(iso);
    if (el) {
      const rect = el.getBoundingClientRect();
      const sp = existingSprints.find(
        (s) => s.startDate && s.endDate && s.status !== 'completed' && iso >= s.startDate && iso <= s.endDate
      );
      if (sp) {
        setTooltip({ x: rect.left + rect.width / 2, y: rect.top, name: sp.name });
      }
    } else {
      setTooltip(null);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const hasOccupied = existingSprints.some((s) => s.startDate && s.endDate && s.status !== 'completed');

  return (
    <div style={{ position: 'relative' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--bb-border)', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, color: 'var(--bb-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--bb-border)', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, color: 'var(--bb-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      {/* Two months side by side */}
      <div style={{ display: 'flex', gap: 24 }}>
        <MonthGrid
          year={viewYear} month={viewMonth}
          startDate={startDate} endDate={endDate} hoverDate={hoverDate}
          existingSprints={existingSprints}
          onDayClick={handleDayClick}
          onDayHover={handleDayHover}
          onDayLeave={() => { setHoverDate(''); setTooltip(null); }}
        />
        <MonthGrid
          year={year2} month={month2}
          startDate={startDate} endDate={endDate} hoverDate={hoverDate}
          existingSprints={existingSprints}
          onDayClick={handleDayClick}
          onDayHover={handleDayHover}
          onDayLeave={() => { setHoverDate(''); setTooltip(null); }}
        />
      </div>

      {/* Legend */}
      {hasOccupied && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#FFF3E0', border: '1px solid #E75026', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--bb-text-muted)' }}>Dates occupied by an existing sprint — hover to see name</span>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y - 6,
          transform: 'translate(-50%, -100%)',
          background: '#172B4D',
          color: '#fff',
          fontSize: 11,
          fontWeight: 500,
          padding: '4px 10px',
          borderRadius: 5,
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          {tooltip.name}
          <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #172B4D' }} />
        </div>
      )}
    </div>
  );
}
