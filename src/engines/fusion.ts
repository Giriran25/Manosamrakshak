import type { SignalContribution } from '@/types';
import { clamp } from '@/lib/math';
import { FUSION_WEIGHTS, type FusionKey } from './constants';

/**
 * SignalFusionEngine.
 *
 * Transparent weighted fusion of the four streams. When a stream is
 * unavailable its nominal weight is redistributed proportionally across the
 * streams that are present, so the contribution table always sums to 100% and
 * the counsellor is never shown a breakdown with a silent hole in it.
 *
 * PRODUCTION DIRECTION: replaced by a calibrated gradient-boosted model over
 * the same feature groups, with SHAP local attributions in place of fixed
 * weights, and a conformal interval in place of the heuristic confidence.
 */

export type StreamValues = Record<FusionKey, number | null>;

export interface FusionResult {
  score: number;
  contributions: SignalContribution[];
  /** True when voice was the only substantive signal and the score was capped. */
  voiceOnlyCapped: boolean;
}

const KEY_ORDER: FusionKey[] = [
  'caseContext',
  'baselineDeviation',
  'trend',
  'text',
  'behaviour',
  'voice',
];

export const fuseSignals = (values: StreamValues): FusionResult => {
  const available = KEY_ORDER.filter((k) => values[k] !== null);
  const availableWeight = available.reduce((a, k) => a + FUSION_WEIGHTS[k], 0);

  const contributions: SignalContribution[] = KEY_ORDER.map((key) => {
    const value = values[key];
    const isAvailable = value !== null;
    const weightPct =
      isAvailable && availableWeight > 0 ? (FUSION_WEIGHTS[key] / availableWeight) * 100 : 0;
    return {
      key,
      weightPct: Math.round(weightPct * 10) / 10,
      value: value ?? 0,
      weightedPoints: Math.round(((weightPct / 100) * (value ?? 0)) * 10) / 10,
      available: isAvailable,
    };
  });

  let score = Math.round(contributions.reduce((a, c) => a + c.weightedPoints, 0));

  // Hard rule: the paralinguistic stream is supporting evidence only. It can
  // never place a case in the high band by itself.
  const substantive = KEY_ORDER.filter((k) => k !== 'voice').some(
    (k) => (values[k] ?? 0) >= 50 && values[k] !== null,
  );
  const voiceOnlyCapped = !substantive && (values.voice ?? 0) >= 50 && score > 59;
  if (voiceOnlyCapped) score = 59;

  return { score: Math.round(clamp(score)), contributions, voiceOnlyCapped };
};

export const computeEscalationRisk = (
  score: number,
  trendSignal: number,
  caseContextSignal: number,
): number => Math.round(clamp(0.58 * score + 0.27 * trendSignal + 0.15 * caseContextSignal));

export const CONTRIBUTION_LABELS: Record<FusionKey, string> = {
  caseContext: 'Case context',
  baselineDeviation: 'Baseline deviation',
  trend: 'Longitudinal trend',
  text: 'Language',
  behaviour: 'Engagement',
  voice: 'Voice',
};

export const CONTRIBUTION_STREAMS: Record<FusionKey, string> = {
  caseContext: 'Stream A',
  baselineDeviation: 'Derived',
  trend: 'Derived',
  text: 'Stream B',
  behaviour: 'Stream D',
  voice: 'Stream C',
};
