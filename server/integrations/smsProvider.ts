import type { InboundSms, SmsProvider } from '@/integrations/sms/types';
import { createMockSmsProvider } from '@/integrations/sms/mock';
import { config, isSmsConfigured } from '../config';
import { verifyTwilioSignature, escapeXml } from './signature';

/**
 * The real SMS provider.
 *
 * Implemented against the Twilio-compatible HTTP API, which several providers
 * expose: form-encoded POST to a messages endpoint with basic auth, an
 * HMAC-SHA1 signature on inbound webhooks, and TwiML as the reply. Selecting a
 * different provider means adding one more file here - nothing above the
 * SmsProvider interface changes.
 *
 * Credentials are read from the server environment only.
 */
const createTwilioSmsProvider = (): SmsProvider => {
  const accountId = config.sms.accountId as string;
  const authSecret = config.sms.authSecret as string;
  const fromNumber = config.sms.fromNumber as string;

  return {
    name: config.sms.provider ?? 'twilio',
    configured: true,
    inboundNumber: fromNumber,

    async sendMessage(message) {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountId}/Messages.json`;
      const body = new URLSearchParams({
        To: message.to,
        From: fromNumber,
        Body: message.body,
      });

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountId}:${authSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            // The provider treats a repeated key as the same send attempt.
            'I-Twilio-Idempotency-Token': message.idempotencyKey,
          },
          body,
        });

        if (!response.ok) {
          // The provider's error text can echo the message body, so only the
          // status is surfaced or logged.
          return {
            ok: false,
            providerMessageId: null,
            error: `Provider rejected the send (HTTP ${response.status}).`,
          };
        }
        const json = (await response.json()) as { sid?: string };
        return { ok: true, providerMessageId: json.sid ?? null };
      } catch {
        return { ok: false, providerMessageId: null, error: 'Provider unreachable.' };
      }
    },

    verifyWebhook({ headers, url, params }) {
      if (config.sms.skipVerification) {
        return { ok: true, reason: 'verification disabled by configuration' };
      }
      return verifyTwilioSignature({
        authToken: authSecret,
        url,
        params,
        header: headers['x-twilio-signature'],
      });
    },

    parseWebhook(params): InboundSms | null {
      if (!params.Body || !params.From) return null;
      return {
        providerMessageId: params.MessageSid ?? params.SmsMessageSid ?? `sms-${Date.now()}`,
        from: params.From,
        to: params.To ?? fromNumber,
        body: params.Body,
        receivedAt: new Date().toISOString(),
      };
    },

    replyBody(text) {
      const body = text
        ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(text)}</Message></Response>`
        : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
      return { contentType: 'text/xml', body };
    },
  };
};

let cached: SmsProvider | null = null;

export const smsProvider = (): SmsProvider => {
  if (!cached) {
    cached = isSmsConfigured() ? createTwilioSmsProvider() : createMockSmsProvider();
  }
  return cached;
};
