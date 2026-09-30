import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook signature verification.
 *
 * Implements the scheme used by Twilio-compatible providers: HMAC-SHA1 over
 * the full request URL with every POST parameter appended in sorted key order,
 * base64 encoded, compared in constant time. This is real verification, not a
 * placeholder - an unsigned or mis-signed request is rejected.
 */

export const twilioSignature = (
  authToken: string,
  url: string,
  params: Record<string, string>,
): string => {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken).update(Buffer.from(payload, 'utf8')).digest('base64');
};

export const verifyTwilioSignature = (input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  header: string | string[] | undefined;
}): { ok: boolean; reason?: string } => {
  const provided = Array.isArray(input.header) ? input.header[0] : input.header;
  if (!provided) return { ok: false, reason: 'signature header missing' };

  const expected = twilioSignature(input.authToken, input.url, input.params);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return { ok: false, reason: 'signature mismatch' };
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'signature mismatch' };
};

/** Escapes text before it is placed inside provider XML markup. */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
