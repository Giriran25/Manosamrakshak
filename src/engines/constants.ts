import type { CaseEventType, CaseStage, RiskBand } from '@/types';

/**
 * PROTOTYPE HEURISTICS - not clinically validated, not calibrated against
 * outcome data. Every number in this file is a transparent, hand-set weight
 * chosen so that the prototype's behaviour is explainable and repeatable.
 *
 * PRODUCTION DIRECTION (future): these weights are replaced by a gradient
 * boosted model trained against a declared label (a >=5 point PHQ-9 rise or a
 * counsellor-confirmed escalation within 14 days), wrapped in a conformal
 * predictor for the confidence interval, with SHAP local attributions
 * replacing the fixed contribution table below.
 */

/** Fusion weights. Must total exactly 100. */
export const FUSION_WEIGHTS = {
  caseContext: 25,
  baselineDeviation: 25,
  trend: 20,
  text: 15,
  behaviour: 10,
  voice: 5,
} as const;

export type FusionKey = keyof typeof FUSION_WEIGHTS;

export const RISK_BANDS: Array<{ band: RiskBand; min: number; max: number }> = [
  { band: 'stable', min: 0, max: 29 },
  { band: 'watch', min: 30, max: 49 },
  { band: 'elevated', min: 50, max: 69 },
  { band: 'high', min: 70, max: 100 },
];

export const bandFor = (score: number): RiskBand =>
  RISK_BANDS.find((b) => score >= b.min && score <= b.max)?.band ?? 'stable';

/** Number of valid interactions required before a personal baseline is fixed. */
export const BASELINE_MIN_INTERACTIONS = 3;

/** Counsellor daily review capacity. The queue is ranked, then capped. */
export const ALERT_BUDGET = 20;

/** Default decay constant, in days, for past case events. */
export const CASE_EVENT_DECAY_DAYS = 14;

/**
 * Some case events are not moments, they are conditions. Relief that has not
 * arrived is still not arriving; an accused released on bail is still at
 * liberty. Decaying those the way a single hearing date decays would
 * systematically under-read the cases that matter most, so they are given a
 * decay constant long enough to behave as a standing condition until a
 * counter-event (a relief instalment, a stage change) offsets them.
 */
export const CASE_EVENT_DECAY_OVERRIDES: Partial<Record<CaseEventType, number>> = {
  relief_delayed: 3650,
  chargesheet_pending: 3650,
  accused_released_on_bail: 3650,
  protection_requested: 3650,
  witness_intimidation_reported: 45,
};

/** Anticipation window, in days, for scheduled future case events. */
export const CASE_EVENT_ANTICIPATION_DAYS = 14;

/**
 * Stream A base weights. Statutory notes name the provision that makes the
 * event a predictable, calendar-driven stressor.
 */
export const CASE_EVENT_WEIGHTS: Record<CaseEventType, number> = {
  fir_registered: 6,
  relief_due: 8,
  relief_delayed: 22,
  relief_instalment_received: -10,
  chargesheet_pending: 18,
  chargesheet_filed: -8,
  bail_hearing_scheduled: 30,
  accused_released_on_bail: 25,
  hearing_scheduled: 12,
  hearing_postponed: 16,
  repeated_adjournment: 22,
  witness_intimidation_reported: 38,
  trial_commenced: 14,
  acquittal: 34,
  protection_requested: 20,
  rehabilitation_started: -12,
};

export const CASE_EVENT_LABELS: Record<CaseEventType, string> = {
  fir_registered: 'FIR registered',
  relief_due: 'Immediate relief due',
  relief_delayed: 'Immediate relief overdue',
  relief_instalment_received: 'Relief instalment received',
  chargesheet_pending: 'Chargesheet pending',
  chargesheet_filed: 'Chargesheet filed',
  bail_hearing_scheduled: 'Bail hearing scheduled',
  accused_released_on_bail: 'Accused released on bail',
  hearing_scheduled: 'Hearing scheduled',
  hearing_postponed: 'Hearing postponed',
  repeated_adjournment: 'Repeated adjournment',
  witness_intimidation_reported: 'Witness intimidation reported',
  trial_commenced: 'Trial commenced',
  acquittal: 'Acquittal / discharge',
  protection_requested: 'Protection requested',
  rehabilitation_started: 'Rehabilitation started',
};

/** Events that describe a scheduled future obligation rather than a past fact. */
export const FORWARD_LOOKING_EVENTS: CaseEventType[] = [
  'bail_hearing_scheduled',
  'hearing_scheduled',
  'relief_due',
];

export const CASE_STAGE_BASELINE: Record<CaseStage, number> = {
  fir: 2,
  investigation: 4,
  chargesheet: 6,
  trial: 10,
  post_trial: 6,
  rehabilitation: 0,
};

export const CASE_STAGE_LABELS: Record<CaseStage, string> = {
  fir: 'FIR registered',
  investigation: 'Investigation',
  chargesheet: 'Chargesheet',
  trial: 'Trial',
  post_trial: 'Post-trial',
  rehabilitation: 'Rehabilitation',
};

export const CASE_STAGE_ORDER: CaseStage[] = [
  'fir',
  'investigation',
  'chargesheet',
  'trial',
  'post_trial',
  'rehabilitation',
];

/** Floor applied to the case-context stream so a quiet docket is not zero. */
export const CASE_CONTEXT_FLOOR = 12;

/** The case-context stream never reads as literally absent. */
export const CASE_CONTEXT_MIN = 5;

export const CONFIDENCE_HISTORY_TARGET = 6;
