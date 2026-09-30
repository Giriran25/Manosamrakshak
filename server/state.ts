import type { Assessment, CaseEvent, CaseRecord, InteractionEvent } from '@/types';
import { assessCase } from '@/engines/pipeline';
import { DEMO_NOW, DEMO_SCENARIO } from '@/data/demoScenario';

/**
 * Server-side case state.
 *
 * Seeded from the same deterministic scenario the client uses, then extended by
 * real interactions as they arrive. The domain engine is imported directly -
 * there is exactly one implementation of baseline, trend, fusion, confidence
 * and explanation in this repository, and both the browser and the server call
 * it.
 *
 * The demo clock is deliberately the system clock for the prototype: a live
 * interaction is stamped with the same reference time as the seeded history, so
 * a real check-in taken on stage sits in the same time frame as the scenario
 * around it rather than five months after it.
 */

export const SERVER_NOW = (): string => DEMO_NOW;

interface CaseState {
  record: CaseRecord;
  events: CaseEvent[];
  interactions: InteractionEvent[];
  priorTrajectory: number[];
}

const cases = new Map<string, CaseState>();

/** Interaction ids already ingested, so a provider retry cannot duplicate one. */
const seenIdempotencyKeys = new Map<string, string>();

const seed = (): void => {
  cases.clear();
  seenIdempotencyKeys.clear();
  for (const record of DEMO_SCENARIO.cases) {
    cases.set(record.caseId, {
      record: { ...record },
      events: DEMO_SCENARIO.events.filter((e) => e.caseId === record.caseId),
      interactions: DEMO_SCENARIO.interactions.filter((e) => e.caseId === record.caseId),
      priorTrajectory: [...(DEMO_SCENARIO.priorTrajectories[record.caseId] ?? [])],
    });
  }
};

seed();

export const resetState = (): void => seed();

export const getCase = (caseId: string): CaseState | undefined => cases.get(caseId);

export const listCaseIds = (): string[] => [...cases.keys()];

export const assess = (caseId: string): Assessment | null => {
  const state = cases.get(caseId);
  if (!state) return null;
  return assessCase({
    caseRecord: state.record,
    events: state.events,
    interactions: state.interactions,
    priorTrajectory: state.priorTrajectory,
    nowIso: SERVER_NOW(),
  }).assessment;
};

export interface AppendResult {
  assessment: Assessment;
  trajectory: number[];
  duplicate: boolean;
}

/**
 * Appends a real interaction and re-scores the case.
 *
 * A frozen case is the prepared demo scenario: the interaction is still
 * recorded and still visible, but the scripted assessment is computed from the
 * synthetic interactions only, so nothing performed live can move it.
 */
export const appendInteraction = (
  caseId: string,
  event: InteractionEvent,
  idempotencyKey: string,
): AppendResult | null => {
  const state = cases.get(caseId);
  if (!state) return null;

  const existingId = seenIdempotencyKeys.get(idempotencyKey);
  if (existingId) {
    const result = assessCase({
      caseRecord: state.record,
      events: state.events,
      interactions: state.interactions,
      priorTrajectory: state.priorTrajectory,
      nowIso: SERVER_NOW(),
    });
    return { assessment: result.assessment, trajectory: result.trajectory, duplicate: true };
  }

  const previous = assess(caseId);
  if (!state.record.frozen && previous) {
    state.priorTrajectory = [...state.priorTrajectory, previous.distressScore];
  }

  state.interactions = [...state.interactions, event];
  state.record = { ...state.record, lastInteractionAt: event.startedAt };
  seenIdempotencyKeys.set(idempotencyKey, event.id);

  const result = assessCase({
    caseRecord: state.record,
    events: state.events,
    interactions: state.interactions,
    priorTrajectory: state.priorTrajectory,
    nowIso: SERVER_NOW(),
  });

  return { assessment: result.assessment, trajectory: result.trajectory, duplicate: false };
};

/** Routes an inbound phone number to a case. Demo registration only. */
export const caseForPhone = (phone: string, demoPhone: string | null, demoCaseId: string): string | null => {
  if (demoPhone && normalizePhone(phone) === normalizePhone(demoPhone)) return demoCaseId;
  return null;
};

export const normalizePhone = (value: string): string => value.replace(/[^\d]/g, '').slice(-10);
