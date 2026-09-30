import type {
  Assessment,
  BaselineProfile,
  CaseEvent,
  CaseRecord,
  InteractionEvent,
} from '@/types';
import { bandFor } from './constants';
import { baselineVoiceSamples, computeBaseline, computeDeviation } from './baseline';
import { computeCaseContext } from './caseContext';
import { computeTrend } from './trend';
import { computeEscalationRisk, fuseSignals, type StreamValues } from './fusion';
import { computeConfidence } from './confidence';
import { buildFactors, buildRecommendation } from './explain';
import { CRISIS_CATEGORY_LABELS } from './safety';

/**
 * RiskEngine - the orchestration layer.
 *
 * Order of operations, which is also the order the product tells its story in:
 *   interactions -> personal baseline -> deviation
 *                -> longitudinal trend
 *                -> case-stage context
 *                -> fusion -> confidence -> explanation -> recommendation
 *
 * The safety override is evaluated separately and takes precedence over all of
 * it. Nothing in here acts: the output is a ranked, explained proposal for a
 * named human.
 */

export interface AssessInput {
  caseRecord: CaseRecord;
  events: CaseEvent[];
  interactions: InteractionEvent[];
  /** Previously persisted scores, oldest first, excluding the one being computed. */
  priorTrajectory: number[];
  nowIso: string;
}

export interface AssessResult {
  assessment: Assessment;
  baselineProfile: BaselineProfile;
  /** Prior scores plus the score just computed - what the chart draws. */
  trajectory: number[];
}

const validInteractions = (interactions: InteractionEvent[]): InteractionEvent[] =>
  [...interactions]
    .filter((e) => e.completion !== 'abandoned')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

export const assessCase = (input: AssessInput): AssessResult => {
  const { caseRecord, events, nowIso } = input;
  const consented = caseRecord.consent.passiveAnalysis;

  /**
   * A frozen case is a scripted demo case. Live channel interactions recorded
   * during a demo are still normalized and stored, but the scripted
   * assessment is computed only from the synthetic interactions so the
   * prepared scenario cannot be disturbed mid-presentation.
   */
  const pool = caseRecord.frozen
    ? input.interactions.filter((e) => e.isSynthetic)
    : input.interactions;

  const ordered = validInteractions(pool);
  const latest = ordered.length > 0 ? ordered[ordered.length - 1] : null;

  const baselineProfile = computeBaseline(caseRecord.caseId, ordered);
  const deviation = computeDeviation(baselineProfile, latest?.extractedSignals.compositeRaw ?? null);
  const trend = computeTrend(input.priorTrajectory, baselineProfile.distress);
  const caseContext = computeCaseContext(events, caseRecord.stage, nowIso);

  const trendAvailable = input.priorTrajectory.length >= 2;

  // Consent withdrawal degrades the system gracefully: the passive streams are
  // dropped from the fusion rather than the person being dropped from support.
  const streams: StreamValues = {
    caseContext: caseContext.signal,
    baselineDeviation: deviation.signal,
    trend: trendAvailable ? trend.signal : null,
    text: consented ? latest?.extractedSignals.textDistress ?? null : null,
    behaviour: consented ? latest?.extractedSignals.behaviourDistress ?? null : null,
    voice: consented ? latest?.extractedSignals.voiceSignal ?? null : null,
  };

  const fusion = fuseSignals(streams);
  const band = bandFor(fusion.score);

  /**
   * Two deviations exist and they are deliberately different things.
   * The fusion stream above uses the deviation of the raw OBSERVATION from the
   * personal baseline, which keeps the score free of circular dependence on
   * itself. The number reported to the counsellor is the deviation of the
   * SCORE from the baseline, because that is the quantity shown next to it on
   * screen and the one a human reads as "how far from usual is this person".
   */
  const reportedDeviation =
    baselineProfile.distress === null ? null : fusion.score - baselineProfile.distress;
  const confidence = computeConfidence(ordered.length, fusion.contributions);

  const safetyOverride = Boolean(latest?.extractedSignals.crisisFlag);
  const safetyCategoryLabel =
    latest?.extractedSignals.crisisCategory
      ? CRISIS_CATEGORY_LABELS[latest.extractedSignals.crisisCategory]
      : null;

  const factors = buildFactors({
    score: fusion.score,
    band,
    baseline: baselineProfile.distress,
    deviation: reportedDeviation,
    trend,
    caseContext,
    contributions: fusion.contributions,
    confidence,
    latest,
    baselineLatencyMs: baselineProfile.latencyMs,
    baselineTextLength: baselineProfile.textLength,
    missedCheckins: caseRecord.missedCheckins,
    voiceOnlyCapped: fusion.voiceOnlyCapped,
    safetyCategoryLabel,
  });

  const assessment: Assessment = {
    caseId: caseRecord.caseId,
    computedAt: nowIso,
    distressScore: fusion.score,
    band,
    escalationRisk14d: computeEscalationRisk(
      fusion.score,
      trendAvailable ? trend.signal : fusion.score,
      caseContext.signal,
    ),
    baseline: baselineProfile.distress,
    deviation: reportedDeviation,
    trend: trendAvailable ? trend.state : 'stable',
    slope: trend.slope,
    persistence: trend.persistence,
    changePointIndex: trend.changePointIndex,
    caseContextSignal: caseContext.signal,
    contributions: fusion.contributions,
    confidence,
    factors,
    recommendation: buildRecommendation(band, confidence, safetyOverride),
    safetyOverride,
    scripted: caseRecord.isSynthetic,
  };

  return {
    assessment,
    baselineProfile,
    trajectory: [...input.priorTrajectory, fusion.score],
  };
};

export { baselineVoiceSamples };

/**
 * Alert-budget ranking. The queue is ordered by how much a human's attention
 * is likely to matter, then capped at the counsellor's real daily capacity -
 * the system is built around limited capacity rather than pretending an
 * unlimited number of alerts is useful.
 */
export const priorityWeight = (assessment: Assessment, followUpOverdueDays: number): number => {
  const bandWeight = { high: 400, elevated: 220, watch: 90, stable: 0 }[assessment.band];
  const confidenceWeight = assessment.confidence.overall * 0.6;
  const trendWeight = {
    rapid_deterioration: 90,
    deteriorating: 70,
    persistent_high: 60,
    watch: 25,
    stable: 0,
    improving: -30,
  }[assessment.trend];
  const deviationWeight = Math.max(0, assessment.deviation ?? 0) * 1.2;
  const contextWeight = assessment.caseContextSignal * 0.3;
  const overdueWeight = Math.max(0, followUpOverdueDays) * 8;
  const safetyWeight = assessment.safetyOverride ? 5000 : 0;

  return (
    safetyWeight +
    bandWeight +
    confidenceWeight +
    trendWeight +
    deviationWeight +
    contextWeight +
    overdueWeight
  );
};
