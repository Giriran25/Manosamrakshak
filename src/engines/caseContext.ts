import type { CaseEvent, CaseStage } from '@/types';
import { clamp, daysBetween, round } from '@/lib/math';
import {
  CASE_CONTEXT_FLOOR,
  CASE_CONTEXT_MIN,
  CASE_EVENT_ANTICIPATION_DAYS,
  CASE_EVENT_DECAY_DAYS,
  CASE_EVENT_DECAY_OVERRIDES,
  CASE_EVENT_WEIGHTS,
  CASE_STAGE_BASELINE,
  FORWARD_LOOKING_EVENTS,
} from './constants';

/**
 * Stream A - case-event risk. The differentiator.
 *
 * Distress for a victim under protective legislation is largely produced by
 * the case process itself: relief that does not arrive, the accused released
 * on bail, hearings that are adjourned again. Those are calendar events with a
 * known direction and a known lead time, so this stream can raise risk BEFORE
 * any language signal exists - and it is explainable by construction.
 */

export interface EventContribution {
  event: CaseEvent;
  points: number;
  daysOffset: number;
  kind: 'past' | 'upcoming';
}

export interface CaseContextResult {
  signal: number;
  contributions: EventContribution[];
  topContribution: EventContribution | null;
  upcoming: EventContribution[];
}

export const computeCaseContext = (
  events: CaseEvent[],
  stage: CaseStage,
  nowIso: string,
): CaseContextResult => {
  const contributions: EventContribution[] = events.map((event) => {
    const offset = daysBetween(event.occurredAt, nowIso); // positive = in the past
    const base = CASE_EVENT_WEIGHTS[event.type];
    const isFuture = offset < 0;
    const forwardLooking = FORWARD_LOOKING_EVENTS.includes(event.type);

    let points: number;
    if (isFuture && forwardLooking) {
      const daysUntil = Math.abs(offset);
      // Anticipatory: weight rises as the date approaches, zero beyond the window.
      const proximity = 1 - Math.min(1, daysUntil / CASE_EVENT_ANTICIPATION_DAYS);
      points = base * proximity * 0.9;
    } else if (isFuture) {
      points = 0;
    } else {
      const decayDays = CASE_EVENT_DECAY_OVERRIDES[event.type] ?? CASE_EVENT_DECAY_DAYS;
      points = base * Math.exp(-offset / decayDays);
    }

    return {
      event,
      points: round(points, 2),
      daysOffset: round(offset, 1),
      kind: isFuture ? 'upcoming' : 'past',
    };
  });

  const total = contributions.reduce((a, c) => a + c.points, 0);
  const signal = Math.round(
    clamp(CASE_CONTEXT_FLOOR + total + CASE_STAGE_BASELINE[stage], CASE_CONTEXT_MIN, 100),
  );

  const ranked = [...contributions].sort((a, b) => b.points - a.points);

  return {
    signal,
    contributions: ranked,
    topContribution: ranked.length > 0 && ranked[0].points > 0 ? ranked[0] : null,
    upcoming: contributions
      .filter((c) => c.kind === 'upcoming' && c.points > 0)
      .sort((a, b) => Math.abs(a.daysOffset) - Math.abs(b.daysOffset)),
  };
};

/** Counterfactual used in the explanation panel: what the score would be without one event. */
export const contextWithoutEvent = (
  events: CaseEvent[],
  stage: CaseStage,
  nowIso: string,
  excludeEventId: string,
): number => computeCaseContext(events.filter((e) => e.id !== excludeEventId), stage, nowIso).signal;
