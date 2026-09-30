import type {
  BaselineProfile,
  Channel,
  InteractionEvent,
  InteractionResponse,
  VoiceFeatures,
} from '@/types';
import { clamp, median } from '@/lib/math';
import { nextId } from '@/lib/id';
import { buildSignalFeatures } from './signals';

/**
 * The normalization boundary.
 *
 * Chat, voice, IVRS and SMS are four very different surfaces. Everything
 * downstream - baseline, trend, fusion, confidence, explanation - operates on
 * the single InteractionEvent shape produced here, which is why adding a fifth
 * channel later is a connector change rather than a model change.
 */

export interface ChannelPayload {
  caseId: string;
  channel: Channel;
  startedAt: string;
  completedAt: string;
  responses: InteractionResponse[];
  voice?: VoiceFeatures;
  /** Prompts the person did not answer. */
  skipped: number;
  missedCheckins: number;
  baseline: BaselineProfile;
  baselineVoiceSamples?: VoiceFeatures[];
  /** Passive analysis consent. When withdrawn, language and voice are not scored. */
  passiveAnalysis: boolean;
  /**
   * Supplied by the server so that an id is stable across a provider retry.
   * Omitted in the browser, where the local counter is enough.
   */
  id?: string;
  /**
   * False for a real interaction on a real channel; true for a demo or
   * fallback interaction. The distinction is carried all the way to the
   * dashboard so a fallback is never read as real traffic.
   */
  isSynthetic?: boolean;
}

/** Per-interaction signal-quality confidence, distinct from case-level confidence. */
const interactionConfidence = (
  responses: InteractionResponse[],
  skipped: number,
  hasVoice: boolean,
  hasFreeText: boolean,
): number => {
  const answered = responses.filter((r) => r.value !== null || (r.freeText ?? '').length > 0).length;
  const coverage = responses.length === 0 ? 0 : answered / responses.length;
  return Math.round(
    clamp(40 + coverage * 40 + (hasFreeText ? 10 : 0) + (hasVoice ? 10 : 0) - skipped * 6),
  );
};

export const normalizeInteraction = (payload: ChannelPayload): InteractionEvent => {
  const latencies = payload.responses.map((r) => r.latencyMs).filter((n) => n > 0);
  const textLength = payload.responses.reduce((a, r) => a + (r.freeText ?? '').length, 0);
  const answered = payload.responses.filter(
    (r) => r.value !== null || (r.freeText ?? '').length > 0,
  ).length;

  const completion: InteractionEvent['completion'] =
    answered === 0 ? 'abandoned' : answered < payload.responses.length ? 'partial' : 'complete';

  const signals = buildSignalFeatures({
    responses: payload.passiveAnalysis
      ? payload.responses
      : // Consent withdrawn: structured answers still count, free text is not analysed.
        payload.responses.map(({ freeText: _freeText, ...rest }) => rest),
    behaviour: {
      missedCheckins: payload.missedCheckins,
      latencyMs: latencies.length > 0 ? median(latencies) : 0,
      baselineLatencyMs: payload.baseline.latencyMs,
      textLength,
      baselineTextLength: payload.baseline.textLength,
      completion,
    },
    voice: payload.passiveAnalysis ? payload.voice : undefined,
    voiceBaseline: payload.baseline.voice,
    voiceBaselineSamples: payload.baselineVoiceSamples,
  });

  return {
    id: payload.id ?? nextId('ie'),
    caseId: payload.caseId,
    channel: payload.channel,
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    completion,
    responses: payload.responses,
    latencyMs: latencies.length > 0 ? Math.round(median(latencies)) : 0,
    textLength,
    voice: payload.voice,
    extractedSignals: signals,
    confidence: interactionConfidence(
      payload.responses,
      payload.skipped,
      Boolean(payload.voice),
      textLength > 0,
    ),
    isSynthetic: payload.isSynthetic ?? false,
  };
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  chat: 'Chat',
  voice: 'Voice',
  ivrs: 'IVRS',
  sms: 'SMS',
};
