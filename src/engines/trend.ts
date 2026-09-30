import type { TrendState } from '@/types';
import { clamp, leastSquaresSlope, mad, mean, round } from '@/lib/math';

/**
 * TrendEngine.
 *
 * A single bad day is not a deterioration. This engine looks for direction
 * (slope), repetition (persistence) and a sustained shift (a CUSUM change
 * point) across the recent trajectory.
 *
 * PRODUCTION DIRECTION: the same three quantities, computed over an irregular
 * time index rather than a check-in index, with a properly parameterised CUSUM
 * and a state-space smoother.
 */

const WINDOW = 5;
/** A step must rise by at least this much to count towards persistence, so a
 * two-point wobble is not read as a run of deterioration. */
const PERSISTENCE_STEP = 3;

export interface TrendResult {
  slope: number;
  persistence: number;
  changePointIndex: number | null;
  signal: number;
  movingAverage: number;
  state: TrendState;
}

export const computeTrend = (
  trajectory: number[],
  baseline: number | null,
): TrendResult => {
  const window = trajectory.slice(-WINDOW);
  const latest = trajectory.length > 0 ? trajectory[trajectory.length - 1] : 0;

  const slope = round(leastSquaresSlope(window), 2);

  let persistence = 0;
  for (let i = trajectory.length - 1; i > 0; i -= 1) {
    if (trajectory[i] - trajectory[i - 1] >= PERSISTENCE_STEP) persistence += 1;
    else break;
  }

  // CUSUM over deviation from the personal baseline; flags the first index at
  // which the accumulated shift exceeds a robust threshold.
  let changePointIndex: number | null = null;
  if (baseline !== null && trajectory.length >= 3) {
    const threshold = 1.5 * Math.max(8, mad(trajectory));
    let cusum = 0;
    for (let i = 0; i < trajectory.length; i += 1) {
      cusum = Math.max(0, cusum + (trajectory[i] - baseline));
      if (cusum > threshold) {
        changePointIndex = i;
        break;
      }
    }
  }

  const signal = Math.round(clamp(38 + 4.5 * slope + 4 * persistence));
  const movingAverage = Math.round(mean(window));
  const lastThree = trajectory.slice(-3);

  let state: TrendState;
  if (slope >= 13 || (persistence >= 3 && slope >= 11)) state = 'rapid_deterioration';
  else if (latest >= 70 && persistence >= 2) state = 'deteriorating';
  else if (latest >= 70 && lastThree.length === 3 && mean(lastThree) >= 70) state = 'persistent_high';
  else if (slope >= 3) state = 'deteriorating';
  else if (slope <= -3) state = 'improving';
  else if (Math.abs(slope) < 3 && latest >= 50) state = 'watch';
  else state = 'stable';

  return { slope, persistence, changePointIndex, signal, movingAverage, state };
};

export const TREND_LABELS: Record<TrendState, string> = {
  stable: 'Stable',
  improving: 'Improving',
  watch: 'Watch',
  deteriorating: 'Deteriorating',
  rapid_deterioration: 'Rapid deterioration',
  persistent_high: 'Persistent high',
};

export const TREND_DESCRIPTIONS: Record<TrendState, string> = {
  stable: 'No sustained movement away from this person’s usual range.',
  improving: 'The trajectory has been moving downward across recent check-ins.',
  watch: 'Elevated but not yet moving. Worth watching rather than acting on.',
  deteriorating: 'A sustained upward movement across consecutive check-ins.',
  rapid_deterioration: 'A steep upward movement over a short number of check-ins.',
  persistent_high: 'Held at a high level across recent check-ins without recovery.',
};
