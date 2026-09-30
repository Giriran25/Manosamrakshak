import type {
  ConfidenceBreakdown,
  ExplanationFactor,
  InteractionEvent,
  Recommendation,
  RecommendationKind,
  RiskBand,
  SignalContribution,
} from '@/types';
import { CASE_EVENT_LABELS } from './constants';
import type { CaseContextResult } from './caseContext';
import type { TrendResult } from './trend';

/**
 * ExplainabilityEngine.
 *
 * Every statement produced here is filled from a number the engines actually
 * computed. No advanced-sounding vocabulary is used for its own sake: if the
 * code does not do it, the explanation does not say it.
 */

export interface ExplainInput {
  score: number;
  band: RiskBand;
  baseline: number | null;
  deviation: number | null;
  trend: TrendResult;
  caseContext: CaseContextResult;
  contributions: SignalContribution[];
  confidence: ConfidenceBreakdown;
  latest: InteractionEvent | null;
  baselineLatencyMs: number | null;
  baselineTextLength: number | null;
  missedCheckins: number;
  voiceOnlyCapped: boolean;
  safetyCategoryLabel: string | null;
}

const describeDays = (daysOffset: number): string => {
  const abs = Math.abs(Math.round(daysOffset));
  if (daysOffset < 0) return abs === 0 ? 'today' : `in ${abs} day${abs === 1 ? '' : 's'}`;
  if (abs === 0) return 'today';
  return `${abs} day${abs === 1 ? '' : 's'} ago`;
};

export const buildFactors = (input: ExplainInput): ExplanationFactor[] => {
  const raw: Array<{ weight: number; factor: Omit<ExplanationFactor, 'rank'> }> = [];

  if (input.safetyCategoryLabel) {
    raw.push({
      weight: 1000,
      factor: {
        title: 'Safety override triggered',
        detail: `${input.safetyCategoryLabel} detected in a check-in response. Scoring was bypassed and the case was routed for immediate human review.`,
        severity: 'strong',
      },
    });
  }

  if (input.deviation !== null && input.baseline !== null && input.deviation >= 8) {
    raw.push({
      weight: 100 + input.deviation,
      factor: {
        title: 'Distress is above this person’s own baseline',
        detail: `Current observed distress is ${Math.round(input.deviation)} points above the personal baseline of ${input.baseline}, established from this person’s first three check-ins.`,
        severity: input.deviation >= 25 ? 'strong' : 'notable',
      },
    });
  } else if (input.deviation !== null && input.deviation <= -8) {
    raw.push({
      weight: 60,
      factor: {
        title: 'Distress is below this person’s own baseline',
        detail: `Current observed distress is ${Math.abs(Math.round(input.deviation))} points below the personal baseline of ${input.baseline}.`,
        severity: 'info',
      },
    });
  }

  if (input.trend.persistence >= 2) {
    raw.push({
      weight: 90 + input.trend.persistence * 5,
      factor: {
        title: `${input.trend.persistence} consecutive check-ins moving upward`,
        detail: `The recent trajectory is rising at about ${input.trend.slope.toFixed(1)} points per check-in. Repetition, not a single response, is what raised this.`,
        severity: input.trend.persistence >= 3 ? 'strong' : 'notable',
      },
    });
  } else if (input.trend.slope <= -3) {
    raw.push({
      weight: 55,
      factor: {
        title: 'Trajectory is improving',
        detail: `The recent trajectory is falling at about ${Math.abs(input.trend.slope).toFixed(1)} points per check-in.`,
        severity: 'info',
      },
    });
  }

  const top = input.caseContext.topContribution;
  if (top && top.points >= 4) {
    raw.push({
      weight: 80 + top.points,
      factor: {
        title: `Case-stage stressor: ${CASE_EVENT_LABELS[top.event.type]}`,
        detail: `${CASE_EVENT_LABELS[top.event.type]} ${describeDays(top.daysOffset)}${
          top.event.statutoryNote ? ` (${top.event.statutoryNote})` : ''
        }. Contributing ${top.points.toFixed(1)} points to the case-context stream${
          top.kind === 'upcoming' ? ' as an anticipated stressor' : ', decaying with time'
        }.`,
        severity: top.points >= 18 ? 'strong' : 'notable',
      },
    });
  }

  const upcoming = input.caseContext.upcoming[0];
  if (upcoming && upcoming.event.id !== top?.event.id) {
    raw.push({
      weight: 70 + upcoming.points,
      factor: {
        title: `Upcoming: ${CASE_EVENT_LABELS[upcoming.event.type]}`,
        detail: `Scheduled ${describeDays(upcoming.daysOffset)}. Risk is raised ahead of the date rather than after it.`,
        severity: 'notable',
      },
    });
  }

  if (input.latest && input.baselineTextLength && input.latest.textLength > 0) {
    const pct = Math.round((1 - input.latest.textLength / input.baselineTextLength) * 100);
    if (pct >= 25) {
      raw.push({
        weight: 50 + pct / 2,
        factor: {
          title: 'Engagement has reduced',
          detail: `Response length is down ${pct}% against this person’s baseline${
            input.missedCheckins > 0
              ? `, with ${input.missedCheckins} missed scheduled check-in${input.missedCheckins === 1 ? '' : 's'}`
              : ''
          }.`,
          severity: pct >= 50 ? 'strong' : 'notable',
        },
      });
    }
  } else if (input.missedCheckins > 0) {
    raw.push({
      weight: 50 + input.missedCheckins * 6,
      factor: {
        title: 'Missed scheduled check-ins',
        detail: `${input.missedCheckins} scheduled check-in${input.missedCheckins === 1 ? '' : 's'} not completed. Disengagement is treated as a signal, not as missing data.`,
        severity: input.missedCheckins >= 2 ? 'strong' : 'notable',
      },
    });
  }

  if (input.latest && input.baselineLatencyMs) {
    const pct = Math.round((input.latest.latencyMs / input.baselineLatencyMs - 1) * 100);
    if (pct >= 30) {
      raw.push({
        weight: 40 + pct / 4,
        factor: {
          title: 'Response latency increased',
          detail: `Time to answer is ${pct}% longer than this person’s baseline.`,
          severity: 'notable',
        },
      });
    }
  }

  const voice = input.contributions.find((c) => c.key === 'voice');
  if (voice?.available && voice.value >= 60) {
    raw.push({
      weight: 30,
      factor: {
        title: 'Voice measures deviate from personal baseline',
        detail: `Pause ratio and energy variation moved away from this person’s own recorded baseline. Supporting evidence only - voice never sets the band on its own.`,
        severity: 'info',
      },
    });
  }

  if (input.voiceOnlyCapped) {
    raw.push({
      weight: 20,
      factor: {
        title: 'Score capped: voice is supporting evidence only',
        detail: 'No corroborating signal from case context, language or engagement, so the score was capped below the high band.',
        severity: 'info',
      },
    });
  }

  if (input.confidence.band !== 'high') {
    raw.push({
      weight: 25,
      factor: {
        title: 'Confidence is limited',
        detail: `History ${input.confidence.historyPct}%, signal completeness ${input.confidence.completenessPct}%, cross-signal agreement ${input.confidence.agreementPct}%. Overall confidence ${input.confidence.overall}%, so this case is routed for human review rather than alerted.`,
        severity: 'info',
      },
    });
  }

  return raw
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((item, index) => ({ rank: index + 1, ...item.factor }));
};

const RECOMMENDATION_LABELS: Record<RecommendationKind, string> = {
  continue_monitoring: 'Continue monitoring',
  scheduled_checkin: 'Keep the scheduled check-in',
  counsellor_review: 'Counsellor review within 48 hours',
  counsellor_contact_24h: 'Counsellor alert recommended - contact within 24 hours',
  human_review_required: 'Human review required',
  immediate_human_contact: 'Immediate human contact',
};

export const buildRecommendation = (
  band: RiskBand,
  confidence: ConfidenceBreakdown,
  safetyOverride: boolean,
): Recommendation => {
  let kind: RecommendationKind;
  let rationale: string;

  if (safetyOverride) {
    kind = 'immediate_human_contact';
    rationale =
      'An explicit crisis statement bypasses scoring entirely. This route does not depend on the score or the confidence.';
  } else if (band === 'high' && confidence.band === 'high') {
    kind = 'counsellor_contact_24h';
    rationale = `High concern with ${confidence.overall}% confidence across the available streams.`;
  } else if (band === 'high') {
    kind = 'human_review_required';
    rationale = `High concern, but confidence is only ${confidence.overall}%. An uncertain case is demoted to review rather than fired as an alert.`;
  } else if (band === 'elevated' && confidence.overall >= 50) {
    kind = 'counsellor_review';
    rationale = 'Elevated concern with adequate supporting evidence.';
  } else if (band === 'elevated') {
    kind = 'human_review_required';
    rationale = `Elevated concern with only ${confidence.overall}% confidence. Routed to review.`;
  } else if (band === 'watch') {
    kind = 'scheduled_checkin';
    rationale = 'Above the usual range but not moving. Watch rather than act.';
  } else {
    kind = 'continue_monitoring';
    rationale = 'Within this person’s usual range across the available streams.';
  }

  return { kind, label: RECOMMENDATION_LABELS[kind], rationale };
};
