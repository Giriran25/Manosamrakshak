import type { InteractionResponse } from '@/types';

/**
 * SMS provider abstraction.
 *
 * The product is not locked to one provider: a provider supplies these three
 * operations and nothing else, and everything downstream works from the
 * normalized interaction the webhook produces. Credentials are read only on
 * the server.
 */

export interface OutboundSms {
  to: string;
  body: string;
  /** Prevents a retried send from delivering twice. */
  idempotencyKey: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId: string | null;
  error?: string;
}

/** A provider-agnostic view of an inbound message. */
export interface InboundSms {
  providerMessageId: string;
  from: string;
  to: string;
  body: string;
  receivedAt: string;
}

export interface WebhookVerification {
  ok: boolean;
  reason?: string;
}

export interface SmsProvider {
  readonly name: string;
  readonly configured: boolean;
  /** The number a demo reply would be sent to. Null when not configured. */
  readonly inboundNumber: string | null;
  sendMessage(message: OutboundSms): Promise<SendResult>;
  /** Verifies the provider's signature over the raw request. */
  verifyWebhook(input: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
    url: string;
    params: Record<string, string>;
  }): WebhookVerification;
  /** Parses a verified request into the provider-agnostic shape. */
  parseWebhook(params: Record<string, string>): InboundSms | null;
  /** The body a provider expects back, and its content type. */
  replyBody(text: string | null): { contentType: string; body: string };
}

/** The check-in prompt sent out by SMS. One digit is enough to answer it. */
export const SMS_PROMPT =
  'Support check-in: how are you feeling today? Reply 1 for Better, 2 for Difficult, 3 if you need support.';

export interface ParsedSmsReply {
  digit: '1' | '2' | '3' | null;
  /** Structured value on the same 1-5 scale every channel uses. */
  response: InteractionResponse | null;
  requestsCounsellor: boolean;
  /** Free text the person typed instead of, or alongside, a digit. */
  freeText: string | undefined;
  reply: string;
}

/**
 * Parses an inbound reply.
 *
 * Tolerant on purpose: people reply "2", "2 - difficult", "difficult", or a
 * sentence. A digit is preferred; a recognised word is accepted; anything else
 * is kept as free text so the language stream still has something to read.
 */
export const parseSmsReply = (body: string): ParsedSmsReply => {
  const trimmed = body.trim();
  const normalized = trimmed.toLowerCase();

  const digitMatch = /^([123])\b/.exec(normalized);
  let digit: '1' | '2' | '3' | null = digitMatch ? (digitMatch[1] as '1' | '2' | '3') : null;

  if (!digit) {
    if (/\bbetter\b|\bgood\b|\bfine\b/.test(normalized)) digit = '1';
    else if (/\bdifficult\b|\bhard\b|\bbad\b|\bworse\b/.test(normalized)) digit = '2';
    else if (/\bsupport\b|\bhelp\b|\bcounsellor\b|\bcounselor\b/.test(normalized)) digit = '3';
  }

  // Anything beyond the leading digit is genuine free text worth reading.
  const remainder = digitMatch ? trimmed.slice(digitMatch[0].length).replace(/^[\s.,:;-]+/, '') : trimmed;
  const freeText = remainder.length > 0 ? remainder : undefined;

  const value = digit === '1' ? 1 : digit === '2' ? 4 : digit === '3' ? 5 : null;

  return {
    digit,
    response:
      value === null && !freeText
        ? null
        : { questionId: 'q1-feeling', value, freeText, latencyMs: 0 },
    requestsCounsellor: digit === '3',
    freeText,
    reply:
      digit === '3'
        ? 'Thank you. A counsellor has been asked to contact you.'
        : digit
          ? 'Thank you for checking in. Your reply has been recorded for your support team.'
          : 'Thank you. Your message has been recorded for your support team. You can also reply 1, 2 or 3.',
  };
};
