/**
 * Domain types for the ManoSamRakshak prototype.
 *
 * Vocabulary note: nothing in this system is a clinical construct. A
 * "distress signal" is a triage number used to rank a counsellor's queue. It
 * is never a diagnosis, a severity of illness, or an input to relief,
 * compensation or eligibility decisions.
 */

export type Role = 'victim' | 'counsellor' | 'admin';

export type Channel = 'chat' | 'voice' | 'ivrs' | 'sms';

export type CaseStage =
  | 'fir'
  | 'investigation'
  | 'chargesheet'
  | 'trial'
  | 'post_trial'
  | 'rehabilitation';

export type RiskBand = 'stable' | 'watch' | 'elevated' | 'high';

export type TrendState =
  | 'stable'
  | 'improving'
  | 'watch'
  | 'deteriorating'
  | 'rapid_deterioration'
  | 'persistent_high';

export type ConfidenceBand = 'low' | 'moderate' | 'high';

export type EmotionTag =
  | 'sad'
  | 'fearful'
  | 'anxious'
  | 'overwhelmed'
  | 'angry'
  | 'lonely'
  | 'exhausted'
  | 'hopeless'
  | 'improving'
  | 'neutral'
  | 'uncertain';

export type CaseEventType =
  | 'fir_registered'
  | 'relief_due'
  | 'relief_delayed'
  | 'relief_instalment_received'
  | 'chargesheet_pending'
  | 'chargesheet_filed'
  | 'bail_hearing_scheduled'
  | 'accused_released_on_bail'
  | 'hearing_scheduled'
  | 'hearing_postponed'
  | 'repeated_adjournment'
  | 'witness_intimidation_reported'
  | 'trial_commenced'
  | 'acquittal'
  | 'protection_requested'
  | 'rehabilitation_started';

export type RecommendationKind =
  | 'continue_monitoring'
  | 'scheduled_checkin'
  | 'counsellor_review'
  | 'counsellor_contact_24h'
  | 'human_review_required'
  | 'immediate_human_contact';

export type FollowUpCadence =
  | 'monthly'
  | 'fortnightly'
  | 'weekly'
  | 'within_72h'
  | 'within_48h'
  | 'within_24h';

export type CounsellorActionKind =
  | 'reviewed'
  | 'confirmed_concern'
  | 'dismissed'
  | 'escalated'
  | 'counsellor_requested'
  | 'relief_escalation_requested';

export type EscalationRoute =
  | 'counselling_call'
  | 'medical_referral'
  | 'protection_request'
  | 'relief_escalation'
  | 'legal_aid';

export type AuditActionType =
  | 'session_started'
  | 'safety_override'
  | 'counsellor_action'
  | 'followup_changed'
  | 'identity_access_requested'
  | 'identity_access_granted'
  | 'identity_access_expired'
  | 'consent_changed'
  | 'interaction_recorded'
  | 'data_source_selected';

/** Sub-signal container. All values are 0-100 where higher means more distress. */
export interface SignalFeatures {
  /** Stream B - linguistic. */
  textDistress: number | null;
  /** Stream D - behavioural / engagement. */
  behaviourDistress: number | null;
  /** Stream C - paralinguistic. Supporting evidence only. */
  voiceSignal: number | null;
  /** Observed distress at this single interaction, independent of history. */
  compositeRaw: number | null;
  emotion: EmotionTag;
  crisisFlag: boolean;
  crisisCategory: 'self_harm' | 'threat_to_life' | 'active_intimidation' | null;
}

export interface VoiceFeatures {
  durationMs: number;
  meanEnergy: number;
  energyVariation: number;
  pauseRatio: number;
  speakingRatio: number;
}

export interface InteractionResponse {
  questionId: string;
  /** 1-5 structured answer, where 5 is the most difficult. */
  value: number | null;
  freeText?: string;
  latencyMs: number;
}

/** The single normalized object that every channel produces. */
export interface InteractionEvent {
  id: string;
  caseId: string;
  channel: Channel;
  startedAt: string;
  completedAt: string | null;
  completion: 'complete' | 'partial' | 'abandoned';
  responses: InteractionResponse[];
  /** Median time-to-answer across prompts. */
  latencyMs: number;
  textLength: number;
  voice?: VoiceFeatures;
  extractedSignals: SignalFeatures;
  /** Confidence in this one interaction's signal quality, 0-100. */
  confidence: number;
  isSynthetic: boolean;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  type: CaseEventType;
  occurredAt: string;
  /** Statutory hook, where one exists. Shown verbatim in the timeline. */
  statutoryNote?: string;
  detail?: string;
}

export interface BaselineProfile {
  caseId: string;
  status: 'establishing' | 'established';
  interactionsUsed: number;
  distress: number | null;
  latencyMs: number | null;
  textLength: number | null;
  checkinGapDays: number | null;
  voice: VoiceFeatures | null;
  updatedAt: string | null;
}

export interface RiskScorePoint {
  id: string;
  caseId: string;
  computedAt: string;
  distressScore: number;
  band: RiskBand;
  confidence: number;
}

export interface SignalContribution {
  key: 'caseContext' | 'baselineDeviation' | 'trend' | 'text' | 'behaviour' | 'voice';
  /** Effective weight after redistribution of unavailable streams. */
  weightPct: number;
  value: number;
  weightedPoints: number;
  available: boolean;
}

export interface ExplanationFactor {
  rank: number;
  title: string;
  detail: string;
  severity: 'info' | 'notable' | 'strong';
}

export interface ConfidenceBreakdown {
  historyPct: number;
  completenessPct: number;
  agreementPct: number;
  overall: number;
  band: ConfidenceBand;
}

export interface Recommendation {
  kind: RecommendationKind;
  label: string;
  rationale: string;
}

export interface Assessment {
  caseId: string;
  computedAt: string;
  distressScore: number;
  band: RiskBand;
  escalationRisk14d: number;
  baseline: number | null;
  deviation: number | null;
  trend: TrendState;
  slope: number;
  persistence: number;
  changePointIndex: number | null;
  caseContextSignal: number;
  contributions: SignalContribution[];
  confidence: ConfidenceBreakdown;
  factors: ExplanationFactor[];
  recommendation: Recommendation;
  safetyOverride: boolean;
  /** True when the score is read from the scripted demo trajectory. */
  scripted: boolean;
  priorityRank?: number;
}

export interface ConsentState {
  chat: boolean;
  voice: boolean;
  ivrs: boolean;
  sms: boolean;
  passiveAnalysis: boolean;
  updatedAt: string;
}

export interface CaseRecord {
  id: string;
  /** Pseudonymous docket reference. No identity is stored on the case. */
  caseId: string;
  districtId: string;
  districtName: string;
  stage: CaseStage;
  openedAt: string;
  lastInteractionAt: string | null;
  consent: ConsentState;
  /** Scripted demo cases hold a fixed trajectory so the demo is repeatable. */
  isSynthetic: boolean;
  /** Scripted hero case: the latest score is pinned and never drifts. */
  frozen: boolean;
  /** Scheduled check-ins not completed. Disengagement is a signal, not missing data. */
  missedCheckins: number;
  notes?: string;
}

export interface FollowUp {
  caseId: string;
  cadence: FollowUpCadence;
  dueAt: string;
  changedAt: string;
  changedBy: Role | 'system';
  reason: string;
}

export interface CounsellorAction {
  id: string;
  caseId: string;
  kind: CounsellorActionKind;
  actorRole: Role;
  at: string;
  route?: EscalationRoute;
  /** Clinical/contextual note. Stored against the case, never in the audit log. */
  note?: string;
}

export interface IdentityRecord {
  caseId: string;
  /** Held only in the simulated identity vault, never in analytics views. */
  name: string;
  location: string;
  contact: string;
}

export type IdentityPurpose =
  | 'counselling_outreach'
  | 'protection_request'
  | 'relief_escalation'
  | 'medical_referral';

export interface IdentityAccessRequest {
  id: string;
  caseId: string;
  requestedBy: Role;
  purpose: IdentityPurpose;
  reason: string;
  requestedAt: string;
  expiresAt: string;
  revealedFields: Array<keyof Omit<IdentityRecord, 'caseId'>>;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actorRole: Role | 'system';
  action: AuditActionType;
  subject: string;
  /** Purpose codes and outcomes only. Never free text, PII, audio or transcripts. */
  outcome: string;
}

export interface SessionState {
  role: Role;
  displayLabel: string;
  districtId: string;
  caseId?: string;
  issuedAt: string;
}

export interface DemoUser {
  username: string;
  role: Role;
  displayLabel: string;
  districtId: string;
  caseId?: string;
}
