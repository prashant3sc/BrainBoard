import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const PS = 2;

/* ── Column definitions ── */
const COLUMNS = [
  { x: 3,  width: 8, phase: 0   },
  { x: 14, width: 8, phase: 1.1 },
  { x: 25, width: 8, phase: 2.2 },
];
const COL_Y      = 5;
const COL_HEIGHT = 22;

/* ── Pixel-art Z patterns ── */
const LARGE_Z  = [[1,1,1,1],[0,0,1,0],[1,1,1,1]];
const MEDIUM_Z = [[1,1,1],[0,1,0],[1,1,1]];
const SMALL_Z  = [[1,1],[1,1]];

const ZZZDEFS = [
  { pattern: LARGE_Z,  baseY: 18, phase: 0,   xPos: 35 },
  { pattern: MEDIUM_Z, baseY: 13, phase: 2.1, xPos: 38 },
  { pattern: SMALL_Z,  baseY: 8,  phase: 4.2, xPos: 40 },
];

function SleepingKanbanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    let rafId: number;

    function drawColumns() {
      COLUMNS.forEach((col) => {
        const breath      = 0.3 + 0.2 * Math.sin(t * 0.025 + col.phase);
        const strokeAlpha = Math.min(1, breath + 0.35);
        const fillAlpha   = breath * 0.45;

        ctx.strokeStyle = `rgba(99,115,140,${strokeAlpha})`;
        ctx.lineWidth   = 1.5;

        /* Rounded column outline */
        ctx.beginPath();
        ctx.roundRect(col.x * PS, COL_Y * PS, col.width * PS, COL_HEIGHT * PS, 3);
        ctx.stroke();

        /* Rounded card placeholders */
        ctx.fillStyle = `rgba(99,115,140,${fillAlpha})`;
        const cardW = col.width * PS - 6;
        const cardH = PS * 4;
        const cardX = col.x * PS + 3;

        ctx.beginPath();
        ctx.roundRect(cardX, 7  * PS, cardW, cardH, 2);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(cardX, 14 * PS, cardW, cardH, 2);
        ctx.fill();
      });
    }

    function drawZzz() {
      ZZZDEFS.forEach((z) => {
        const rise  = (t * 0.012 + z.phase) % 14;
        const drawY = z.baseY - rise;

        let alpha: number;
        if (rise < 2)       alpha = (rise / 2) * 0.85;
        else if (rise > 10) alpha = ((14 - rise) / 4) * 0.85;
        else                alpha = 0.85;

        ctx.fillStyle = `rgba(231,80,38,${alpha})`;

        z.pattern.forEach((row, dy) => {
          row.forEach((px, dx) => {
            if (px) ctx.fillRect((z.xPos + dx) * PS, (drawY + dy) * PS, PS, PS);
          });
        });
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawColumns();
      drawZzz();
      t++;
      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={90}
      height={66}
      style={{ imageRendering: 'pixelated', display: 'block', margin: '0 auto' }}
    />
  );
}

/* ── Empty state shell ── */
interface Props {
  projectId: string;
}

export function KanbanEmptyState({ projectId }: Props) {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minHeight: 300,
    }}>
      <div style={{ marginBottom: 16 }}>
        <SleepingKanbanCanvas />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--bb-text-primary, #253858)', margin: '0 0 6px', textAlign: 'center' }}>
        No active sprint
      </h3>

      <p style={{ fontSize: 12, color: 'var(--bb-text-secondary, #6B778C)', margin: 0, textAlign: 'center' }}>
        Go to Backlog to start a sprint.
      </p>

      <button
        onClick={() => navigate(`/projects/${projectId}/backlog`)}
        style={{
          marginTop: 12,
          background: '#E75026',
          color: '#ffffff',
          border: 'none',
          borderRadius: 8,
          padding: '7px 18px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c73d17'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#E75026'; }}
      >
        Start sprint
      </button>
    </div>
  );
}
