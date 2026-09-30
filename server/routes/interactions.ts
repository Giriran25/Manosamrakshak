import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Channel, InteractionResponse, VoiceFeatures } from '@/types';
import { ingest } from '../ingest';
import { assess, getCase } from '../state';
import { clientKey, logLine, parseJson, rateLimit, readRawBody, sendJson } from '../http';

/**
 * Browser-originated real interactions: chat and voice.
 *
 * Neither needs any external credential. The browser collects the answers or
 * records the microphone, extracts the voice measures locally, and posts the
 * result here; the server normalizes, scores through the shared engine,
 * persists where a database is configured, and pushes the change to every
 * connected dashboard.
 */

interface IngestBody {
  caseId?: string;
  channel?: Channel;
  responses?: InteractionResponse[];
  voice?: VoiceFeatures;
  skipped?: number;
  startedAt?: string;
  isSynthetic?: boolean;
}

const VALID_CHANNELS: Channel[] = ['chat', 'voice', 'ivrs', 'sms'];

const validate = (body: IngestBody): string | null => {
  if (!body.caseId || typeof body.caseId !== 'string') return 'caseId is required';
  if (!body.channel || !VALID_CHANNELS.includes(body.channel)) return 'channel is invalid';
  if (!Array.isArray(body.responses)) return 'responses must be an array';
  if (body.responses.length > 12) return 'too many responses';
  for (const response of body.responses) {
    if (typeof response.questionId !== 'string') return 'response.questionId is invalid';
    if (response.value !== null && typeof response.value !== 'number') {
      return 'response.value is invalid';
    }
    if (response.value !== null && (response.value < 1 || response.value > 5)) {
      return 'response.value out of range';
    }
    if (response.freeText !== undefined && typeof response.freeText !== 'string') {
      return 'response.freeText is invalid';
    }
    if ((response.freeText?.length ?? 0) > 4000) return 'response.freeText too long';
    if (typeof response.latencyMs !== 'number' || response.latencyMs < 0) {
      return 'response.latencyMs is invalid';
    }
  }
  if (body.voice) {
    const keys: Array<keyof VoiceFeatures> = [
      'durationMs',
      'meanEnergy',
      'energyVariation',
      'pauseRatio',
      'speakingRatio',
    ];
    for (const key of keys) {
      if (typeof body.voice[key] !== 'number' || Number.isNaN(body.voice[key])) {
        return `voice.${key} is invalid`;
      }
    }
  }
  return null;
};

export const handleCreateInteraction = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const limit = rateLimit(clientKey(req, 'interactions'), 60);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    sendJson(res, 429, { error: 'rate limited' });
    return;
  }

  let raw: string;
  try {
    raw = await readRawBody(req);
  } catch {
    sendJson(res, 413, { error: 'payload too large' });
    return;
  }

  const body = parseJson<IngestBody>(raw);
  if (!body) {
    sendJson(res, 400, { error: 'malformed JSON' });
    return;
  }

  const invalid = validate(body);
  if (invalid) {
    sendJson(res, 422, { error: invalid });
    return;
  }

  const header = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(header) ? header[0] : header;

  const result = await ingest({
    caseId: body.caseId as string,
    channel: body.channel as Channel,
    responses: body.responses as InteractionResponse[],
    voice: body.voice,
    skipped: body.skipped,
    startedAt: body.startedAt,
    isSynthetic: body.isSynthetic ?? false,
    idempotencyKey,
  });

  if (!result.ok) {
    sendJson(res, 404, { error: result.reason });
    return;
  }

  // The free text is never logged, only the outcome of scoring it.
  logLine(
    `${body.channel} ingest ${result.duplicate ? 'duplicate ignored' : 'recorded'} for ${body.caseId}, band ${result.assessment.band}`,
  );

  sendJson(res, result.duplicate ? 200 : 201, {
    ok: true,
    duplicate: result.duplicate,
    event: result.event,
    assessment: result.assessment,
    trajectory: result.trajectory,
    persisted: result.persistence.ok && !('skipped' in result.persistence && result.persistence.skipped),
    persistence: result.persistence,
  });
};

/** The current server-side assessment for one case. Used to reconcile the client. */
export const handleGetCase = (_req: IncomingMessage, res: ServerResponse, caseId: string): void => {
  const state = getCase(caseId);
  if (!state) {
    sendJson(res, 404, { error: 'unknown case' });
    return;
  }
  sendJson(res, 200, {
    caseId,
    assessment: assess(caseId),
    interactions: state.interactions.length,
    lastInteractionAt: state.record.lastInteractionAt,
    frozen: state.record.frozen,
  });
};
