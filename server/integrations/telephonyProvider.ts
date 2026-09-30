import type { Digit } from '@/integrations/telephony/stateMachine';
import type { InboundCall, TelephonyProvider } from '@/integrations/telephony/types';
import { createMockTelephonyProvider } from '@/integrations/telephony/mock';
import { config, isTelephonyConfigured } from '../config';
import { verifyTwilioSignature, escapeXml } from './signature';

/**
 * The real telephony provider.
 *
 * Implemented against the Twilio-compatible voice API: an outbound call is
 * created with an answer URL, the provider fetches that URL, and the server
 * replies with markup that speaks a line and gathers a digit. Each gather posts
 * back, the state machine advances by one step, and the next prompt is
 * rendered. Speech input is offered only when the deployment has been
 * configured for it.
 */
const createTwilioTelephonyProvider = (): TelephonyProvider => {
  const accountId = config.telephony.accountId as string;
  const authSecret = config.telephony.authSecret as string;
  const fromNumber = config.telephony.fromNumber;

  return {
    name: config.telephony.provider ?? 'twilio',
    configured: true,
    supportsSpeech: config.telephony.speechEnabled,
    inboundNumber: fromNumber,

    async startCall({ to, answerUrl }) {
      if (!fromNumber) {
        return { ok: false, providerCallId: null, error: 'No outbound number is configured.' };
      }
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountId}/Calls.json`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountId}:${authSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, From: fromNumber, Url: answerUrl, Method: 'POST' }),
        });
        if (!response.ok) {
          return {
            ok: false,
            providerCallId: null,
            error: `Provider rejected the call (HTTP ${response.status}).`,
          };
        }
        const json = (await response.json()) as { sid?: string };
        return { ok: true, providerCallId: json.sid ?? null };
      } catch {
        return { ok: false, providerCallId: null, error: 'Provider unreachable.' };
      }
    },

    verifyWebhook({ headers, url, params }) {
      if (config.telephony.skipVerification) {
        return { ok: true, reason: 'verification disabled by configuration' };
      }
      return verifyTwilioSignature({
        authToken: authSecret,
        url,
        params,
        header: headers['x-twilio-signature'],
      });
    },

    parseWebhook(params): InboundCall | null {
      if (!params.CallSid) return null;
      const digits = params.Digits?.trim();
      return {
        providerCallId: params.CallSid,
        from: params.From ?? 'unknown',
        to: params.To ?? fromNumber ?? 'unknown',
        digit: digits && /^[1-5]$/.test(digits) ? (digits as Digit) : null,
        speech: config.telephony.speechEnabled ? (params.SpeechResult ?? null) : null,
        receivedAt: new Date().toISOString(),
      };
    },

    renderPrompt({ prompt, actionUrl }) {
      const say = `<Say voice="alice">${escapeXml(prompt.say)}</Say>`;
      const body = prompt.expectsInput
        ? `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="${
            config.telephony.speechEnabled ? 'dtmf speech' : 'dtmf'
          }" numDigits="1" timeout="8" action="${escapeXml(actionUrl)}" method="POST">${say}</Gather><Redirect method="POST">${escapeXml(actionUrl)}</Redirect></Response>`
        : `<?xml version="1.0" encoding="UTF-8"?><Response>${say}${
            prompt.hangUp ? '<Hangup/>' : `<Redirect method="POST">${escapeXml(actionUrl)}</Redirect>`
          }</Response>`;
      return { contentType: 'text/xml', body };
    },
  };
};

let cached: TelephonyProvider | null = null;

export const telephonyProvider = (): TelephonyProvider => {
  if (!cached) {
    cached = isTelephonyConfigured()
      ? createTwilioTelephonyProvider()
      : createMockTelephonyProvider();
  }
  return cached;
};
