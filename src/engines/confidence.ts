import type { ConfidenceBand, ConfidenceBreakdown, SignalContribution } from '@/types';
import { clamp01, stdDev } from '@/lib/math';
import { CONFIDENCE_HISTORY_TARGET, FUSION_WEIGHTS } from './constants';

/**
 * ConfidenceEngine.
 *
 * This is what stops the system behaving like a threshold alarm. A high
 * concern with weak evidence is routed to human review, not fired as an alert.
 *
 * PRODUCTION DIRECTION: a conformal predictor or quantile regression gives a
 * genuine prediction interval; this heuristic stands in for it.
 */

export const bandForConfidence = (value: number): ConfidenceBand =>
  value >= 75 ? 'high' : value >= 50 ? 'moderate' : 'low';

export const computeConfidence = (
  validInteractions: number,
  contributions: SignalContribution[],
): ConfidenceBreakdown => {
  const history = clamp01(validInteractions / CONFIDENCE_HISTORY_TARGET);

  const nominalTotal = Object.values(FUSION_WEIGHTS).reduce((a, b) => a + b, 0);
  const presentWeight = contributions
    .filter((c) => c.available)
    .reduce((a, c) => a + FUSION_WEIGHTS[c.key], 0);
  const completeness = clamp01(presentWeight / nominalTotal);

  const presentValues = contributions.filter((c) => c.available).map((c) => c.value);
  const agreement = clamp01(1 - stdDev(presentValues) / 45);

  const overall = Math.round(100 * (0.4 * history + 0.3 * completeness + 0.3 * agreement));

  return {
    historyPct: Math.round(history * 100),
    completenessPct: Math.round(completeness * 100),
    agreementPct: Math.round(agreement * 100),
    overall,
    band: bandForConfidence(overall),
  };
};

export const HISTORY_WORDS = (pct: number): string =>
  pct >= 85 ? 'Strong' : pct >= 50 ? 'Developing' : 'Sparse';

export const AGREEMENT_WORDS = (pct: number): string =>
  pct >= 75 ? 'High' : pct >= 50 ? 'Partial' : 'Signals disagree';

export const CONFIDENCE_LABELS: Record<ConfidenceBand, string> = {
  high: 'High confidence',
  moderate: 'Moderate confidence',
  low: 'Low confidence',
};
