import type { BaselineProfile, InteractionEvent, VoiceFeatures } from '@/types';
import { clamp, daysBetween, median } from '@/lib/math';
import { BASELINE_MIN_INTERACTIONS } from './constants';

/**
 * BaselineEngine.
 *
 * The central idea of the product: the comparison is always within-person.
 * A score of 62 means nothing on its own; 62 against a personal baseline of 30
 * is a different case from 62 against a baseline of 58.
 *
 * The baseline is a robust median over the person's FIRST valid interactions
 * and is deliberately not a trailing window - a trailing baseline would drift
 * upward during a deterioration and hide exactly the change we need to see.
 */

const isValid = (e: InteractionEvent): boolean =>
  e.completion !== 'abandoned' && e.extractedSignals.compositeRaw !== null;

export const computeBaseline = (
  caseId: string,
  interactions: InteractionEvent[],
  pinnedDistress?: number,
): BaselineProfile => {
  const ordered = [...interactions]
    .filter(isValid)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (ordered.length < BASELINE_MIN_INTERACTIONS) {
    return {
      caseId,
      status: 'establishing',
      interactionsUsed: ordered.length,
      distress: null,
      latencyMs: null,
      textLength: null,
      checkinGapDays: null,
      voice: null,
      updatedAt: null,
    };
  }

  const first = ordered.slice(0, BASELINE_MIN_INTERACTIONS);
  const gaps: number[] = [];
  for (let i = 1; i < first.length; i += 1) {
    gaps.push(daysBetween(first[i - 1].startedAt, first[i].startedAt));
  }

  const voiceSamples = first.map((e) => e.voice).filter((v): v is VoiceFeatures => Boolean(v));
  const voice: VoiceFeatures | null =
    voiceSamples.length === 0
      ? null
      : {
          durationMs: median(voiceSamples.map((v) => v.durationMs)),
          meanEnergy: median(voiceSamples.map((v) => v.meanEnergy)),
          energyVariation: median(voiceSamples.map((v) => v.energyVariation)),
          pauseRatio: median(voiceSamples.map((v) => v.pauseRatio)),
          speakingRatio: median(voiceSamples.map((v) => v.speakingRatio)),
        };

  return {
    caseId,
    status: 'established',
    interactionsUsed: first.length,
    distress:
      pinnedDistress ?? Math.round(median(first.map((e) => e.extractedSignals.compositeRaw ?? 0))),
    latencyMs: Math.round(median(first.map((e) => e.latencyMs))),
    textLength: Math.round(median(first.map((e) => e.textLength))),
    checkinGapDays: gaps.length > 0 ? Math.round(median(gaps)) : null,
    voice,
    updatedAt: first[first.length - 1].startedAt,
  };
};

export const baselineVoiceSamples = (interactions: InteractionEvent[]): VoiceFeatures[] =>
  [...interactions]
    .filter(isValid)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(0, BASELINE_MIN_INTERACTIONS)
    .map((e) => e.voice)
    .filter((v): v is VoiceFeatures => Boolean(v));

export interface DeviationResult {
  deviation: number | null;
  signal: number | null;
}

/** Deviation, in raw distress points, of the latest observation from baseline. */
export const computeDeviation = (
  baseline: BaselineProfile,
  latestComposite: number | null,
): DeviationResult => {
  if (baseline.distress === null || latestComposite === null) {
    return { deviation: null, signal: null };
  }
  const deviation = latestComposite - baseline.distress;
  // Anchored at 38 so "no movement from baseline" reads as a low signal rather
  // than a mid-scale one, and a genuine within-person rise has room to show.
  return { deviation, signal: Math.round(clamp(38 + 0.95 * deviation)) };
};
