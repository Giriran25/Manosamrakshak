import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Counts a number up to its target once, on mount or when the target changes.
 * Honours the reduced-motion preference by jumping straight to the value.
 */
export const useCountUp = (target: number, durationMs = 900): number => {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / durationMs);
      // Ease out cubic, so the final digits settle rather than snap.
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs, reduced]);

  return value;
};
