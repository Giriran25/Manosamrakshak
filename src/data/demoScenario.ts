import type {
  CaseEvent,
  CaseEventType,
  CaseRecord,
  CaseStage,
  Channel,
  ConsentState,
  DemoUser,
  EmotionTag,
  IdentityRecord,
  InteractionEvent,
  VoiceFeatures,
} from '@/types';
import { addDays } from '@/lib/math';
import { compositeRawDistress } from '@/engines/signals';
import { assessCase } from '@/engines/pipeline';
import { createSeededRandom, DEMO_SEED } from './seededRandom';

/**
 * SYNTHETIC DEMO COHORT.
 *
 * Every case here is simulated. The individuals do not exist. What is real is
 * the temporal structure: the case-event calendar follows the statutory
 * deadlines that drive a protective-legislation case (immediate relief within
 * days of the FIR, chargesheet timelines, notice of bail proceedings), so the
 * SHAPE of the stressor timeline is authentic even though the person is not.
 *
 * No public dataset used anywhere in this prototype contains data about
 * victims of atrocities, and none is described that way. Public stress-language
 * corpora would serve only as a general stress-language benchmark for the
 * linguistic stream.
 *
 * The demo clock is fixed. Every date below is derived from DEMO_NOW so the
 * charts, the queue order and the scores are identical on every run.
 */
export const DEMO_NOW = '2026-04-14T10:00:00.000Z';

const D = (daysAgo: number): string => addDays(DEMO_NOW, -daysAgo);

export const DISTRICTS = [
  { id: 'dist-01', name: 'Kalaburagi' },
  { id: 'dist-02', name: 'Raichur' },
] as const;

const consent = (passiveAnalysis = true): ConsentState => ({
  chat: true,
  voice: true,
  ivrs: true,
  sms: true,
  passiveAnalysis,
  updatedAt: D(120),
});

const STATUTORY_NOTES: Partial<Record<CaseEventType, string>> = {
  relief_due: 'immediate relief timeline under the Rules',
  relief_delayed: 'immediate relief timeline breached',
  chargesheet_pending: 'investigation timeline',
  bail_hearing_scheduled: 'victim right to notice of bail proceedings',
  accused_released_on_bail: 'protection duty engaged',
  witness_intimidation_reported: 'protection duty engaged',
  repeated_adjournment: 'speedy trial provision',
};

let eventSeq = 0;
const ev = (
  caseId: string,
  type: CaseEventType,
  daysAgo: number,
  detail?: string,
): CaseEvent => {
  eventSeq += 1;
  return {
    id: `ce-${eventSeq.toString().padStart(3, '0')}`,
    caseId,
    type,
    occurredAt: D(daysAgo),
    statutoryNote: STATUTORY_NOTES[type],
    detail,
  };
};

const voiceFeatures = (
  pauseRatio: number,
  energyVariation: number,
  speakingRatio: number,
): VoiceFeatures => ({
  durationMs: 42_000,
  meanEnergy: 0.36,
  energyVariation,
  pauseRatio,
  speakingRatio,
});

interface SyntheticInteractionSpec {
  caseId: string;
  channel: Channel;
  daysAgo: number;
  text: number;
  behaviour: number;
  voice: number | null;
  emotion: EmotionTag;
  latencyMs: number;
  textLength: number;
  completion?: InteractionEvent['completion'];
}

let interactionSeq = 0;

/**
 * Builds a persisted interaction with its signal features already extracted -
 * which is how a real record looks, because features are computed at ingest
 * and the raw audio is discarded at that point.
 */
const synthetic = (spec: SyntheticInteractionSpec): InteractionEvent => {
  interactionSeq += 1;
  return {
    id: `ie-syn-${interactionSeq.toString().padStart(3, '0')}`,
    caseId: spec.caseId,
    channel: spec.channel,
    startedAt: D(spec.daysAgo),
    completedAt: D(spec.daysAgo),
    completion: spec.completion ?? 'complete',
    responses: [],
    latencyMs: spec.latencyMs,
    textLength: spec.textLength,
    voice:
      spec.voice === null
        ? undefined
        : voiceFeatures(0.18 + spec.voice / 400, 0.3 - spec.voice / 600, 0.72 - spec.voice / 700),
    extractedSignals: {
      textDistress: spec.text,
      behaviourDistress: spec.behaviour,
      voiceSignal: spec.voice,
      compositeRaw: compositeRawDistress(spec.text, spec.behaviour, spec.voice),
      emotion: spec.emotion,
      crisisFlag: false,
      crisisCategory: null,
    },
    confidence: 82,
    isSynthetic: true,
  };
};

// ---------------------------------------------------------------------------
// VC-2291 - the scripted hero case.
//
// Trajectory 35 - 41 - 48 - 61 - 73 - 83, with the current assessment
// computed live by the engine from the inputs below. It lands on 88, HIGH,
// DETERIORATING, HIGH confidence, and is frozen so nothing performed live
// during a demo can move it.
// ---------------------------------------------------------------------------
const HERO = 'VC-2291';

const heroSpecs: SyntheticInteractionSpec[] = [
  { caseId: HERO, channel: 'chat', daysAgo: 90, text: 34, behaviour: 38, voice: 32, emotion: 'anxious', latencyMs: 9_000, textLength: 120 },
  { caseId: HERO, channel: 'ivrs', daysAgo: 76, text: 40, behaviour: 40, voice: 40, emotion: 'anxious', latencyMs: 11_000, textLength: 90 },
  { caseId: HERO, channel: 'chat', daysAgo: 62, text: 44, behaviour: 45, voice: 42, emotion: 'sad', latencyMs: 12_000, textLength: 105 },
  { caseId: HERO, channel: 'chat', daysAgo: 45, text: 58, behaviour: 55, voice: 52, emotion: 'overwhelmed', latencyMs: 13_000, textLength: 96 },
  { caseId: HERO, channel: 'voice', daysAgo: 31, text: 70, behaviour: 64, voice: 60, emotion: 'anxious', latencyMs: 15_000, textLength: 70 },
  { caseId: HERO, channel: 'chat', daysAgo: 16, text: 80, behaviour: 70, voice: 66, emotion: 'fearful', latencyMs: 16_000, textLength: 58 },
  {
    caseId: HERO,
    channel: 'ivrs',
    daysAgo: 3,
    // The paralinguistic reading sits a little below the language and
    // engagement readings here, which is realistic for a short IVRS call and
    // is why cross-signal agreement - and therefore confidence - is 91 rather
    // than near-perfect. Voice is the noisiest stream, which is exactly why it
    // carries the least weight and can never set the band on its own.
    text: 90,
    behaviour: 76,
    voice: 60,
    emotion: 'fearful',
    latencyMs: 17_600,
    textLength: 42,
    completion: 'partial',
  },
];

const heroInteractions: InteractionEvent[] = heroSpecs.map(synthetic);

const heroEvents: CaseEvent[] = [
  ev(HERO, 'fir_registered', 96),
  ev(HERO, 'relief_due', 89),
  ev(HERO, 'relief_delayed', 58, 'First instalment of immediate relief not received'),
  ev(HERO, 'chargesheet_filed', 44),
  ev(HERO, 'hearing_postponed', 31),
  ev(HERO, 'repeated_adjournment', 17, 'Third adjournment on the same issue'),
  ev(HERO, 'accused_released_on_bail', 9, 'Accused resident in the same ward'),
  ev(HERO, 'bail_hearing_scheduled', -4, 'Next bail-related listing'),
];

// ---------------------------------------------------------------------------
// The other named cases, each present to make one point in the demo.
// ---------------------------------------------------------------------------
const STABLE = 'VC-1001';
const AMBIGUOUS = 'VC-1004';
const IMPROVING = 'VC-1006';
const VICTIM_CASE = 'VC-3007';

const stableInteractions = [
  { caseId: STABLE, channel: 'chat' as Channel, daysAgo: 84, text: 28, behaviour: 28, voice: 30, emotion: 'neutral' as EmotionTag, latencyMs: 8_000, textLength: 110 },
  { caseId: STABLE, channel: 'sms' as Channel, daysAgo: 56, text: 26, behaviour: 26, voice: null, emotion: 'neutral' as EmotionTag, latencyMs: 7_400, textLength: 40 },
  { caseId: STABLE, channel: 'chat' as Channel, daysAgo: 28, text: 30, behaviour: 30, voice: 30, emotion: 'neutral' as EmotionTag, latencyMs: 8_600, textLength: 104 },
  { caseId: STABLE, channel: 'chat' as Channel, daysAgo: 12, text: 24, behaviour: 26, voice: 28, emotion: 'improving' as EmotionTag, latencyMs: 8_100, textLength: 118 },
  { caseId: STABLE, channel: 'chat' as Channel, daysAgo: 4, text: 22, behaviour: 24, voice: 26, emotion: 'improving' as EmotionTag, latencyMs: 7_900, textLength: 122 },
].map(synthetic);

const stableEvents: CaseEvent[] = [
  ev(STABLE, 'fir_registered', 140),
  ev(STABLE, 'chargesheet_filed', 40),
  ev(STABLE, 'relief_instalment_received', 30),
];

const ambiguousInteractions = [
  { caseId: AMBIGUOUS, channel: 'chat' as Channel, daysAgo: 19, text: 74, behaviour: 34, voice: null, emotion: 'hopeless' as EmotionTag, latencyMs: 9_200, textLength: 210 },
  { caseId: AMBIGUOUS, channel: 'chat' as Channel, daysAgo: 5, text: 88, behaviour: 32, voice: null, emotion: 'hopeless' as EmotionTag, latencyMs: 8_800, textLength: 240 },
].map(synthetic);

const ambiguousEvents: CaseEvent[] = [
  ev(AMBIGUOUS, 'fir_registered', 40),
  ev(AMBIGUOUS, 'relief_delayed', 26),
  ev(AMBIGUOUS, 'chargesheet_pending', 12),
];

const improvingInteractions = [
  { caseId: IMPROVING, channel: 'chat' as Channel, daysAgo: 70, text: 70, behaviour: 62, voice: 60, emotion: 'overwhelmed' as EmotionTag, latencyMs: 14_000, textLength: 80 },
  { caseId: IMPROVING, channel: 'voice' as Channel, daysAgo: 52, text: 64, behaviour: 58, voice: 56, emotion: 'sad' as EmotionTag, latencyMs: 12_500, textLength: 76 },
  { caseId: IMPROVING, channel: 'chat' as Channel, daysAgo: 34, text: 56, behaviour: 50, voice: 50, emotion: 'sad' as EmotionTag, latencyMs: 11_000, textLength: 92 },
  { caseId: IMPROVING, channel: 'chat' as Channel, daysAgo: 18, text: 46, behaviour: 42, voice: 44, emotion: 'improving' as EmotionTag, latencyMs: 10_200, textLength: 118 },
  { caseId: IMPROVING, channel: 'chat' as Channel, daysAgo: 6, text: 38, behaviour: 36, voice: 40, emotion: 'improving' as EmotionTag, latencyMs: 9_600, textLength: 132 },
].map(synthetic);

const improvingEvents: CaseEvent[] = [
  ev(IMPROVING, 'fir_registered', 200),
  ev(IMPROVING, 'chargesheet_filed', 150),
  ev(IMPROVING, 'trial_commenced', 60),
  ev(IMPROVING, 'relief_instalment_received', 20),
  ev(IMPROVING, 'rehabilitation_started', 12),
];

/**
 * The case behind the victim demo login. It sits one check-in short of a
 * personal baseline on purpose: a live check-in during the demo establishes
 * the baseline on screen, which is the clearest way to show what the baseline
 * actually is - and it keeps the scripted hero case untouched.
 */
const victimInteractions = [
  { caseId: VICTIM_CASE, channel: 'chat' as Channel, daysAgo: 21, text: 40, behaviour: 36, voice: null, emotion: 'anxious' as EmotionTag, latencyMs: 10_400, textLength: 96 },
  { caseId: VICTIM_CASE, channel: 'sms' as Channel, daysAgo: 8, text: 50, behaviour: 44, voice: null, emotion: 'anxious' as EmotionTag, latencyMs: 12_000, textLength: 44 },
].map(synthetic);

const victimEvents: CaseEvent[] = [
  ev(VICTIM_CASE, 'fir_registered', 34),
  ev(VICTIM_CASE, 'chargesheet_pending', 10),
  ev(VICTIM_CASE, 'relief_due', -3, 'Second instalment due at chargesheet stage'),
];

// ---------------------------------------------------------------------------
// Seeded filler cohort, so the district view and the queue look like real work.
// ---------------------------------------------------------------------------
const rand = createSeededRandom(DEMO_SEED);

const FILLER_STAGES: CaseStage[] = ['fir', 'investigation', 'chargesheet', 'trial', 'post_trial'];
const FILLER_EMOTIONS: EmotionTag[] = ['neutral', 'anxious', 'sad', 'exhausted', 'lonely', 'improving'];
const FILLER_EVENT_POOL: CaseEventType[] = [
  'chargesheet_pending',
  'hearing_scheduled',
  'hearing_postponed',
  'relief_instalment_received',
  'relief_delayed',
  'repeated_adjournment',
  'protection_requested',
];

interface FillerCase {
  record: CaseRecord;
  events: CaseEvent[];
  interactions: InteractionEvent[];
  priorTrajectory: number[];
}

const buildFillerCases = (): FillerCase[] => {
  const out: FillerCase[] = [];
  for (let i = 0; i < 12; i += 1) {
    const caseId = `VC-1${(101 + i * 7).toString().padStart(3, '0')}`;
    const districtIndex = i >= 10 ? 1 : 0;
    const district = DISTRICTS[districtIndex];
    const stage = FILLER_STAGES[Math.floor(rand() * FILLER_STAGES.length)];
    const level = 22 + Math.floor(rand() * 52);
    const drift = Math.floor(rand() * 9) - 3;
    const count = 3 + Math.floor(rand() * 3);

    const interactions: InteractionEvent[] = [];
    for (let k = 0; k < count; k += 1) {
      const daysAgo = 74 - k * 16;
      const text = Math.max(12, Math.min(94, level + drift * k + Math.floor(rand() * 7) - 3));
      const behaviour = Math.max(12, Math.min(92, text - 6 + Math.floor(rand() * 7) - 3));
      const voice = k % 2 === 0 ? Math.max(12, Math.min(90, text - 8)) : null;
      interactions.push(
        synthetic({
          caseId,
          channel: (['chat', 'sms', 'ivrs', 'voice'] as Channel[])[Math.floor(rand() * 4)],
          daysAgo,
          text,
          behaviour,
          voice,
          emotion: FILLER_EMOTIONS[Math.floor(rand() * FILLER_EMOTIONS.length)],
          latencyMs: 8_000 + Math.floor(rand() * 7_000),
          textLength: 40 + Math.floor(rand() * 90),
        }),
      );
    }

    const events: CaseEvent[] = [ev(caseId, 'fir_registered', 120 - i * 3)];
    const extra = 1 + Math.floor(rand() * 2);
    for (let e = 0; e < extra; e += 1) {
      events.push(
        ev(caseId, FILLER_EVENT_POOL[Math.floor(rand() * FILLER_EVENT_POOL.length)], 8 + Math.floor(rand() * 40)),
      );
    }

    const record: CaseRecord = {
      id: caseId,
      caseId,
      districtId: district.id,
      districtName: district.name,
      stage,
      openedAt: D(120 - i * 3),
      lastInteractionAt: interactions[interactions.length - 1].startedAt,
      consent: consent(true),
      isSynthetic: true,
      frozen: false,
      missedCheckins: Math.floor(rand() * 2),
    };

    /**
     * Calibration pass: score the filler case once with no history, then lay
     * its trajectory out behind that score. Without this the background rows
     * would show sparklines that do not join up with the score beside them.
     */
    const probe = assessCase({
      caseRecord: record,
      events,
      interactions,
      priorTrajectory: [],
      nowIso: DEMO_NOW,
    }).assessment.distressScore;
    const step = drift > 1 ? 5 : drift < -1 ? -5 : 1;
    const priorTrajectory = [3, 2, 1].map((back) =>
      Math.max(10, Math.min(96, probe - back * step)),
    );

    out.push({ record, events, interactions, priorTrajectory });
  }
  return out;
};

const fillerCases = buildFillerCases();

// ---------------------------------------------------------------------------
// Assembled scenario.
// ---------------------------------------------------------------------------
export interface DemoScenario {
  cases: CaseRecord[];
  events: CaseEvent[];
  interactions: InteractionEvent[];
  priorTrajectories: Record<string, number[]>;
  identities: IdentityRecord[];
}

const namedCases: CaseRecord[] = [
  {
    id: HERO,
    caseId: HERO,
    districtId: DISTRICTS[0].id,
    districtName: DISTRICTS[0].name,
    stage: 'trial',
    openedAt: D(96),
    lastInteractionAt: D(3),
    consent: consent(true),
    isSynthetic: true,
    frozen: true,
    missedCheckins: 2,
    notes: 'Accused resident in the same ward. Relief instalment outstanding.',
  },
  {
    id: STABLE,
    caseId: STABLE,
    districtId: DISTRICTS[0].id,
    districtName: DISTRICTS[0].name,
    stage: 'investigation',
    openedAt: D(140),
    lastInteractionAt: D(4),
    consent: consent(true),
    isSynthetic: true,
    frozen: false,
    missedCheckins: 0,
  },
  {
    id: AMBIGUOUS,
    caseId: AMBIGUOUS,
    districtId: DISTRICTS[0].id,
    districtName: DISTRICTS[0].name,
    stage: 'chargesheet',
    openedAt: D(40),
    lastInteractionAt: D(5),
    consent: consent(true),
    isSynthetic: true,
    frozen: false,
    missedCheckins: 0,
    notes: 'Two check-ins only. Language and engagement streams disagree.',
  },
  {
    id: IMPROVING,
    caseId: IMPROVING,
    districtId: DISTRICTS[0].id,
    districtName: DISTRICTS[0].name,
    stage: 'rehabilitation',
    openedAt: D(200),
    lastInteractionAt: D(6),
    consent: consent(true),
    isSynthetic: true,
    frozen: false,
    missedCheckins: 0,
  },
  {
    id: VICTIM_CASE,
    caseId: VICTIM_CASE,
    districtId: DISTRICTS[0].id,
    districtName: DISTRICTS[0].name,
    stage: 'investigation',
    openedAt: D(34),
    lastInteractionAt: D(8),
    consent: consent(true),
    isSynthetic: true,
    frozen: false,
    missedCheckins: 0,
  },
];

export const DEMO_SCENARIO: DemoScenario = {
  cases: [...namedCases, ...fillerCases.map((f) => f.record)],
  events: [
    ...heroEvents,
    ...stableEvents,
    ...ambiguousEvents,
    ...improvingEvents,
    ...victimEvents,
    ...fillerCases.flatMap((f) => f.events),
  ],
  interactions: [
    ...heroInteractions,
    ...stableInteractions,
    ...ambiguousInteractions,
    ...improvingInteractions,
    ...victimInteractions,
    ...fillerCases.flatMap((f) => f.interactions),
  ],
  priorTrajectories: {
    [HERO]: [35, 41, 48, 61, 73, 83],
    [STABLE]: [28, 26, 30, 27],
    [AMBIGUOUS]: [57],
    [IMPROVING]: [52, 45, 38, 30],
    [VICTIM_CASE]: [38, 44],
    ...Object.fromEntries(fillerCases.map((f) => [f.record.caseId, f.priorTrajectory])),
  },
  /**
   * Simulated identity vault. Held separately from every analytics structure
   * above and reachable only through the audited admin request flow. These are
   * invented placeholder records for a synthetic cohort.
   */
  identities: [
    { caseId: HERO, name: 'Synthetic Record A', location: 'Ward 7, Kalaburagi', contact: '+91 90000 41287' },
    { caseId: STABLE, name: 'Synthetic Record B', location: 'Ward 2, Kalaburagi', contact: '+91 90000 55104' },
    { caseId: AMBIGUOUS, name: 'Synthetic Record C', location: 'Ward 11, Kalaburagi', contact: '+91 90000 67720' },
    { caseId: IMPROVING, name: 'Synthetic Record D', location: 'Ward 4, Kalaburagi', contact: '+91 90000 31882' },
    { caseId: VICTIM_CASE, name: 'Synthetic Record E', location: 'Ward 9, Kalaburagi', contact: '+91 90000 77341' },
  ],
};

export const HERO_CASE_ID = HERO;
export const VICTIM_DEMO_CASE_ID = VICTIM_CASE;
export const AMBIGUOUS_CASE_ID = AMBIGUOUS;

/**
 * Demo accounts. Prototype authentication only - a fixed shared password, no
 * tokens, no real credentials and no personal data. Not production auth.
 */
export const DEMO_PASSWORD = 'demo1234';

export const DEMO_USERS: DemoUser[] = [
  {
    username: 'victim',
    role: 'victim',
    displayLabel: 'Case VC-3007',
    districtId: DISTRICTS[0].id,
    caseId: VICTIM_CASE,
  },
  {
    username: 'counsellor',
    role: 'counsellor',
    displayLabel: 'District counsellor, Kalaburagi',
    districtId: DISTRICTS[0].id,
  },
  {
    username: 'admin',
    role: 'admin',
    displayLabel: 'Nodal officer, identity custodian',
    districtId: DISTRICTS[0].id,
  },
];
