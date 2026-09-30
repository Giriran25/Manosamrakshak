import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseSmsReply, SMS_PROMPT } from '@/integrations/sms/types';
import { config, isSmsConfigured } from '../config';
import { smsProvider } from '../integrations/smsProvider';
import { ingest } from '../ingest';
import { caseForPhone } from '../state';
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
 * Inbound SMS.
 *
 * A real reply from a real handset arrives here as a signed provider webhook.
 * It is verified, the sender is matched to a case, the reply is parsed into the
 * same structured answer every other channel produces, and it enters the one
 * ingest path. The provider is answered with the acknowledgement it expects.
 *
 * A provider that redelivers a message must not create a second check-in, so
 * the provider's own message id is used as the idempotency key.
 */
export const handleSmsWebhook = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const limit = rateLimit(clientKey(req, 'sms'), 60);
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

  const provider = smsProvider();

  const verification = provider.verifyWebhook({
    rawBody: raw,
    headers: req.headers,
    url: absoluteUrl(req),
    params,
  });
  if (!verification.ok) {
    // Never echo the payload: it contains a phone number and a message body.
    logLine(`sms webhook rejected: ${verification.reason ?? 'unverified'}`);
    sendJson(res, 403, { error: 'signature verification failed' });
    return;
  }

  const inbound = provider.parseWebhook(params);
  if (!inbound) {
    sendJson(res, 400, { error: 'malformed payload' });
    return;
  }

  const caseId = caseForPhone(inbound.from, config.demoPhone, config.demoCaseId);
  if (!caseId) {
    // An unrecognised sender is answered politely and never routed to a case.
    logLine('sms webhook: sender not registered for any case');
    const reply = provider.replyBody(
      'This number is not registered for a support check-in. No message has been recorded.',
    );
    sendText(res, 200, reply.contentType, reply.body);
    return;
  }

  const parsed = parseSmsReply(inbound.body);
  if (!parsed.response) {
    const reply = provider.replyBody(parsed.reply);
    sendText(res, 200, reply.contentType, reply.body);
    return;
  }

  const result = await ingest({
    caseId,
    channel: 'sms',
    responses: [parsed.response],
    // A real reply from a real handset is real traffic.
    isSynthetic: !isSmsConfigured(),
    idempotencyKey: `sms:${inbound.providerMessageId}`,
  });

  if (!result.ok) {
    logLine(`sms ingest failed: ${result.reason}`);
    const reply = provider.replyBody('Your message could not be recorded. Please try again later.');
    sendText(res, 200, reply.contentType, reply.body);
    return;
  }

  logLine(
    `sms ingest ${result.duplicate ? 'duplicate ignored' : 'recorded'} for ${caseId}, band ${result.assessment.band}`,
  );

  const reply = provider.replyBody(parsed.reply);
  sendText(res, 200, reply.contentType, reply.body);
};

/**
 * Sends the check-in prompt to the registered demo handset. Refuses, with a
 * reason, when no provider is configured - it never pretends to have sent.
 */
export const handleSmsSend = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const limit = rateLimit(clientKey(req, 'sms-send'), 10);
  if (!limit.ok) {
    sendJson(res, 429, { error: 'rate limited' });
    return;
  }

  const provider = smsProvider();
  if (!provider.configured) {
    sendJson(res, 409, {
      ok: false,
      reason: 'No SMS provider is configured, so no message was sent.',
    });
    return;
  }
  if (!config.demoPhone) {
    sendJson(res, 409, {
      ok: false,
      reason: 'No demo handset is registered. Set DEMO_PHONE_NUMBER to enable the test send.',
    });
    return;
  }

  const raw = await readRawBody(req).catch(() => '');
  const body = parseJson<{ idempotencyKey?: string }>(raw) ?? {};

  const result = await provider.sendMessage({
    to: config.demoPhone,
    body: SMS_PROMPT,
    idempotencyKey: body.idempotencyKey ?? `prompt-${Date.now()}`,
  });

  sendJson(res, result.ok ? 200 : 502, {
    ok: result.ok,
    provider: provider.name,
    reason: result.error,
  });
};
