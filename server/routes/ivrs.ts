import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Digit, IvrsSession } from '@/integrations/telephony/stateMachine';
import { advance, createSession, PROMPTS } from '@/integrations/telephony/stateMachine';
import { config, isTelephonyConfigured } from '../config';
import { telephonyProvider } from '../integrations/telephonyProvider';
import { ingest } from '../ingest';
import { caseForPhone } from '../state';
import { broadcast } from '../events';
import {
  absoluteUrl,
  clientKey,
  logLine,
  parseForm,
  parseJson,
  rateLimit,
  readRawBody,
  sendJson,
  sendText,
} from '../http';

/**
 * The IVRS call route.
 *
 * A real call is a series of independent provider requests, so the state lives
 * here and not in a browser component: each request loads the session by call
 * id, advances the machine by one digit, saves it, and renders the next prompt
 * as provider markup. The browser test console posts to the same handler with
 * the same payload shape, which is why the console demonstrates the real flow.
 */

const sessions = new Map<string, IvrsSession>();
const SESSION_TTL_MS = 30 * 60_000;

/**
 * Call bookkeeping runs on the wall clock, not the demo clock.
 *
 * The demo clock is the reference time for scoring, so that a live check-in
 * sits in the same time frame as the seeded history. A live call, though,
 * happens now: its session expiry and the gap between a prompt and a keypress
 * are real elapsed time, which is also what makes the latency measurement
 * genuine.
 */
const callClock = (): string => new Date().toISOString();

/** Drops sessions from calls that were never hung up. */
const sweep = (): void => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [callId, session] of sessions) {
    if (new Date(session.lastPromptAt).getTime() < cutoff) sessions.delete(callId);
  }
};

export const activeSessions = (): IvrsSession[] => {
  sweep();
  return [...sessions.values()];
};

export const resetSessions = (): void => sessions.clear();

/** Finishes a call by turning its collected answers into one interaction. */
const completeSession = async (session: IvrsSession): Promise<void> => {
  if (session.interactionId || session.responses.length === 0) return;

  const result = await ingest({
    caseId: session.caseId,
    channel: 'ivrs',
    responses: session.responses,
    // A call answered through a configured carrier is real traffic; the same
    // flow driven from the test console is not, and says so.
    isSynthetic: !isTelephonyConfigured(),
    // The provider's call id makes a redelivered final request harmless.
    idempotencyKey: `ivrs:${session.callId}`,
  });

  if (result.ok) {
    session.interactionId = result.event.id;
    logLine(
      `ivrs ingest ${result.duplicate ? 'duplicate ignored' : 'recorded'} for ${session.caseId}`,
    );
  } else {
    logLine(`ivrs ingest failed: ${result.reason}`);
  }
};

export const handleIvrsWebhook = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const limit = rateLimit(clientKey(req, 'ivrs'), 120);
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

  const contentType = String(req.headers['content-type'] ?? '');
  const params = contentType.includes('application/json')
    ? (parseJson<Record<string, string>>(raw) ?? {})
    : parseForm(raw);

  const provider = telephonyProvider();

  const verification = provider.verifyWebhook({
    rawBody: raw,
    headers: req.headers,
    url: absoluteUrl(req),
    params,
  });
  if (!verification.ok) {
    logLine(`ivrs webhook rejected: ${verification.reason ?? 'unverified'}`);
    sendJson(res, 403, { error: 'signature verification failed' });
    return;
  }

  const inbound = provider.parseWebhook(params);
  if (!inbound) {
    sendJson(res, 400, { error: 'malformed payload' });
    return;
  }

  sweep();
  let session = sessions.get(inbound.providerCallId);

  if (!session) {
    // A caller is matched to a case by the number they are calling from. An
    // explicit case reference is accepted only from the test console, which is
    // not reachable once a provider is configured.
    const routed =
      caseForPhone(inbound.from, config.demoPhone, config.demoCaseId) ??
      (!isTelephonyConfigured() && params.caseId ? params.caseId : null);

    if (!routed) {
      logLine('ivrs webhook: caller not registered for any case');
      const rendered = provider.renderPrompt({
        prompt: {
          state: 'complete',
          say: 'This number is not registered for a support check-in. Goodbye.',
          expectsInput: false,
          accepts: [],
          hangUp: true,
        },
        actionUrl: `${config.publicUrl}/api/ivrs/voice`,
      });
      sendText(res, 200, rendered.contentType, rendered.body);
      return;
    }

    session = createSession(inbound.providerCallId, routed, callClock());
    sessions.set(session.callId, session);
    broadcast({
      kind: 'call_state',
      caseId: session.caseId,
      channel: 'ivrs',
      at: new Date().toISOString(),
      detail: 'Call connected',
    });
  }

  // A digit, or nothing - in which case the current prompt is replayed.
  const digit: Digit | null =
    inbound.digit ?? (inbound.speech ? speechToDigit(inbound.speech) : null);

  if (digit) {
    const result = advance(session, digit, callClock());
    sessions.set(session.callId, result.session);
    session = result.session;

    if (result.completedNow) {
      await completeSession(session);
    }
    if (session.counsellorRequested) {
      broadcast({
        kind: 'call_state',
        caseId: session.caseId,
        channel: 'ivrs',
        at: new Date().toISOString(),
        detail: 'Counsellor requested on the call',
      });
    }

    const rendered = provider.renderPrompt({
      prompt: result.prompt,
      actionUrl: `${config.publicUrl}/api/ivrs/voice`,
    });
    sendText(res, 200, rendered.contentType, rendered.body);
    return;
  }

  const rendered = provider.renderPrompt({
    prompt: PROMPTS[session.state],
    actionUrl: `${config.publicUrl}/api/ivrs/voice`,
  });
  sendText(res, 200, rendered.contentType, rendered.body);
};

/** Only ever consulted when the deployment has enabled speech input. */
const speechToDigit = (speech: string): Digit | null => {
  const text = speech.toLowerCase();
  if (/\bone\b|\bbetter\b/.test(text)) return '1';
  if (/\btwo\b/.test(text)) return '2';
  if (/\bthree\b|\bsame\b|\bsomewhat\b/.test(text)) return '3';
  if (/\bfour\b|\bend\b/.test(text)) return '4';
  if (/\bfive\b|\bworse\b|\bnot\b/.test(text)) return '5';
  return null;
};

/** Reports a call's state to the console, so it can observe a real call. */
export const handleIvrsSession = (req: IncomingMessage, res: ServerResponse): void => {
  const url = new URL(req.url ?? '/', config.publicUrl);
  const callId = url.searchParams.get('callId');
  if (callId) {
    const session = sessions.get(callId);
    if (!session) {
      sendJson(res, 404, { error: 'unknown call' });
      return;
    }
    sendJson(res, 200, { session, prompt: PROMPTS[session.state] });
    return;
  }
  sendJson(res, 200, { sessions: activeSessions() });
};

/**
 * Places a real outbound test call. Refuses with a reason when telephony is
 * not connected; the frontend never claims a call happened until the provider
 * has confirmed it.
 */
export const handleIvrsTestCall = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const limit = rateLimit(clientKey(req, 'ivrs-call'), 5);
  if (!limit.ok) {
    sendJson(res, 429, { error: 'rate limited' });
    return;
  }

  const provider = telephonyProvider();
  if (!provider.configured) {
    sendJson(res, 409, {
      ok: false,
      reason: 'Telephony is not connected, so no call was placed.',
    });
    return;
  }
  if (!config.demoPhone) {
    sendJson(res, 409, {
      ok: false,
      reason: 'No demo handset is registered. Set DEMO_PHONE_NUMBER to enable the test call.',
    });
    return;
  }

  const result = await provider.startCall({
    to: config.demoPhone,
    answerUrl: `${config.publicUrl}/api/ivrs/voice`,
  });

  sendJson(res, result.ok ? 200 : 502, {
    ok: result.ok,
    provider: provider.name,
    callId: result.providerCallId,
    reason: result.error,
  });
};

/** Starts a console-driven call. Only available while telephony is unconnected. */
export const handleIvrsConsoleStart = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (isTelephonyConfigured()) {
    sendJson(res, 409, {
      ok: false,
      reason: 'Telephony is connected, so the test console is disabled. Place a real call instead.',
    });
    return;
  }

  const raw = await readRawBody(req).catch(() => '');
  const body = parseJson<{ caseId?: string }>(raw) ?? {};
  const callId = `console-${randomUUID().slice(0, 8)}`;
  const caseId = body.caseId ?? config.demoCaseId;

  const session = createSession(callId, caseId, callClock());
  sessions.set(callId, session);

  broadcast({
    kind: 'call_state',
    caseId,
    channel: 'ivrs',
    at: new Date().toISOString(),
    detail: 'Test console call connected',
  });

  sendJson(res, 200, { ok: true, session, prompt: PROMPTS[session.state] });
};
