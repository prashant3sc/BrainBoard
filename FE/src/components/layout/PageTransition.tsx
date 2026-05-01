import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps page content with a fade+slide-up animation on every route change.
 * Uses a key based on the pathname so the animation reruns on navigation.
 */
export function PageTransition({ children }: Props) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase] = useState<'enter' | 'idle'>('enter');
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    // Swap content and restart enter animation
    setDisplayChildren(children);
    setPhase('enter');

    // After animation completes, settle to idle (no animation class)
    const t = setTimeout(() => setPhase('idle'), 260);
    return () => clearTimeout(t);
  }, [location.pathname, children]);

  // Also animate the very first mount
  useEffect(() => {
    const t = setTimeout(() => setPhase('idle'), 260);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      key={location.pathname}
      className={phase === 'enter' ? 'bb-page-enter' : ''}
    >
      {displayChildren}
    </div>
  );
}
