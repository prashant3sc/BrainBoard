import { useEffect, useRef, useState } from 'react';

interface Props {
  /** True when dashboard data has loaded — triggers the exit animation */
  ready: boolean;
  /** Called after the exit animation finishes — use to unmount */
  onDone: () => void;
}

const MIN_DISPLAY_MS = 900; // always show at least this long so animation feels complete

/**
 * Full-screen splash shown from login-click until dashboard data is ready.
 * - Stays visible until `ready` prop becomes true (data-driven, not timer-driven).
 * - Enforces a minimum display time so the animation never flashes.
 * - Progress bar fills to ~75% while waiting, then jumps to 100% when ready.
 */
export function LoginSplash({ ready, onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'finish' | 'exit' | 'done'>('enter');

  const readyFired   = useRef(false);
  const minTimerDone = useRef(false);

  // After MIN_DISPLAY_MS, mark min time as done. If ready already fired, exit.
  useEffect(() => {
    const t = setTimeout(() => {
      minTimerDone.current = true;
      if (readyFired.current) startFinish();
    }, MIN_DISPLAY_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transition enter → hold after the logo settle animation (400ms)
  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => p === 'enter' ? 'hold' : p), 400);
    return () => clearTimeout(t);
  }, []);

  // When ready fires, start finish (respecting min time)
  useEffect(() => {
    if (!ready) return;
    readyFired.current = true;
    if (minTimerDone.current) startFinish();
    // else: the MIN_DISPLAY_MS timer above will call startFinish when it fires
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function startFinish() {
    setPhase('finish');
    setTimeout(() => {
      setPhase('exit');
      setTimeout(() => { setPhase('done'); onDone(); }, 400);
    }, 300);
  }

  if (phase === 'done') return null;

  return (
    <div className={`bb-splash-overlay${phase === 'exit' ? ' bb-splash-out' : ''}`}>

      {/* Single centered content block — rings sit behind the icon inside this block */}
      <div className={`bb-splash-logo${phase !== 'enter' ? ' bb-splash-logo-hold' : ''}`}>

        {/* Icon wrapper — soft pulsing glow behind icon */}
        <div className="bb-splash-icon-wrap">
          <div className="bb-splash-glow" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            width="72"
            height="72"
            aria-hidden="true"
            style={{ position: 'relative', zIndex: 1 }}
          >
            <rect x="1"  y="7"  width="8" height="8" rx="2"   fill="#E75026" className="bb-splash-rect bb-splash-rect-1"/>
            <rect x="11" y="7"  width="8" height="8" rx="2"   fill="#E75026" className="bb-splash-rect bb-splash-rect-2"/>
            <rect x="21" y="7"  width="5" height="8" rx="1.5" fill="#E75026" opacity="0.35" className="bb-splash-rect bb-splash-rect-3"/>
            <rect x="1"  y="17" width="8" height="5" rx="1.5" fill="#E75026" opacity="0.5"  className="bb-splash-rect bb-splash-rect-4"/>
            <rect x="11" y="17" width="8" height="5" rx="1.5" fill="#E75026" opacity="0.35" className="bb-splash-rect bb-splash-rect-5"/>
            <rect x="21" y="17" width="5" height="5" rx="1.5" fill="#E75026" opacity="0.6"  className="bb-splash-rect bb-splash-rect-6"/>
            <line x1="24" y1="7" x2="27" y2="4" stroke="#E75026" strokeWidth="1.2" opacity="0.5" />
            <circle cx="28" cy="3.5" r="3.5" fill="#E75026" />
            <circle cx="28" cy="3.5" r="2"   fill="white" />
            <circle cx="28" cy="3.5" r="1"   fill="#E75026" />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="bb-splash-wordmark">
          <span className="bb-splash-word-brain">Brain</span><span className="bb-splash-word-board">Board</span>
        </div>

        {/* Tagline */}
        <div className="bb-splash-tagline">Your team's workspace</div>

        {/* Progress bar — inside the logo block so it aligns with the content */}
        <div className="bb-splash-bar-wrap">
          <div className={[
            'bb-splash-bar',
            phase === 'hold'                          ? 'bb-splash-bar-loading' : '',
            phase === 'finish' || phase === 'exit'    ? 'bb-splash-bar-done'    : '',
          ].join(' ')} />
        </div>
      </div>
    </div>
  );
}
