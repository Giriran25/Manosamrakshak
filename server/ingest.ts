import { createHash, randomUUID } from 'node:crypto';
import type { Assessment, Channel, InteractionEvent, InteractionResponse, VoiceFeatures } from '@/types';
import { baselineVoiceSamples, computeBaseline } from '@/engines/baseline';
import { normalizeInteraction } from '@/engines/normalize';
import { appendInteraction, getCase, SERVER_NOW } from './state';
import { persistInteraction, type PersistenceOutcome } from './persistence';
import { broadcastIngestSequence } from './events';

/**
 * The single ingest path.
 *
 * Every real channel - chat, voice, an inbound SMS, a keypad call - arrives
 * here, is normalized into the one InteractionEvent shape, scored by the
 * shared domain engine, persisted where a database is configured, and
 * broadcast to the dashboard. There is no per-channel scoring anywhere in this
 * system.
 */

export interface IngestInput {
  caseId: string;
  channel: Channel;
  responses: InteractionResponse[];
  voice?: VoiceFeatures;
  skipped?: number;
  startedAt?: string;
  /** Real traffic is false; a demo or fallback interaction is true. */
  isSynthetic?: boolean;
  /**
   * Stable across retries. A provider that redelivers the same message, or a
   * browser that retries a failed request, must not create a second check-in.
   */
  idempotencyKey?: string;
}

export interface IngestResult {
  ok: true;
  duplicate: boolean;
  event: InteractionEvent;
  assessment: Assessment;
  trajectory: number[];
  persistence: PersistenceOutcome;
}

export interface IngestFailure {
  ok: false;
  reason: string;
}

/** A deterministic key when the caller did not supply one. */
const derivedKey = (input: IngestInput): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        caseId: input.caseId,
        channel: input.channel,
        responses: input.responses,
        voice: input.voice ?? null,
      }),
    )
    .digest('hex')
    .slice(0, 32);

export const ingest = async (input: IngestInput): Promise<IngestResult | IngestFailure> => {
  const state = getCase(input.caseId);
  if (!state) return { ok: false, reason: 'unknown case' };

  const idempotencyKey = input.idempotencyKey ?? derivedKey(input);
  const baseline = computeBaseline(input.caseId, state.interactions);
  const startedAt = input.startedAt ?? SERVER_NOW();

  const event = normalizeInteraction({
    id: `ie-${randomUUID().slice(0, 12)}`,
    caseId: input.caseId,
    channel: input.channel,
    startedAt,
    completedAt: SERVER_NOW(),
    responses: input.responses,
    voice: input.voice,
    skipped: input.skipped ?? 0,
    missedCheckins: state.record.missedCheckins,
    baseline,
    baselineVoiceSamples: baselineVoiceSamples(state.interactions),
    passiveAnalysis: state.record.consent.passiveAnalysis,
    isSynthetic: input.isSynthetic ?? false,
  });

  const appended = appendInteraction(input.caseId, event, idempotencyKey);
  if (!appended) return { ok: false, reason: 'unknown case' };

  if (appended.duplicate) {
    return {
      ok: true,
      duplicate: true,
      event,
      assessment: appended.assessment,
      trajectory: appended.trajectory,
      persistence: { ok: true, skipped: true, reason: 'duplicate delivery ignored' },
    };
  }

  // Persistence is best-effort: the interaction is already scored, so a
  // database failure must not lose it or break the demo.
  const persistence = await persistInteraction(event, appended.assessment);

  broadcastIngestSequence({
    caseId: input.caseId,
    channel: input.channel,
    band: appended.assessment.band,
    recommendation: appended.assessment.recommendation.kind,
    safetyOverride: appended.assessment.safetyOverride,
  });

  return {
    ok: true,
    duplicate: false,
    event,
    assessment: appended.assessment,
    trajectory: appended.trajectory,
    persistence,
  };
};
