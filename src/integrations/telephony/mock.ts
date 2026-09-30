import type { Digit } from './stateMachine';
import type { InboundCall, TelephonyProvider } from './types';

/**
 * The provider used when telephony is not configured.
 *
 * It never claims a call was placed. The browser console posts into the same
 * server-side state machine a real call would drive, which is what makes the
 * test console worth having: the flow being demonstrated is the real flow,
 * minus the carrier.
 */
export const createMockTelephonyProvider = (): TelephonyProvider => ({
  name: 'test-console',
  configured: false,
  supportsSpeech: false,
  inboundNumber: null,

  async startCall() {
    return {
      ok: false,
      providerCallId: null,
      error: 'Telephony is not connected, so no call was placed.',
    };
  },

  verifyWebhook() {
    return { ok: true };
  },

  parseWebhook(params): InboundCall | null {
    if (!params.CallSid) return null;
    return {
      providerCallId: params.CallSid,
      from: params.From ?? 'test-console',
      to: params.To ?? 'test-service',
      digit: (params.Digits as Digit | undefined) ?? null,
      speech: null,
      receivedAt: new Date().toISOString(),
    };
  },

  renderPrompt({ prompt }) {
    // The console consumes JSON; a configured provider renders its own markup.
    return {
      contentType: 'application/json',
      body: JSON.stringify({
        state: prompt.state,
        say: prompt.say,
        expectsInput: prompt.expectsInput,
        accepts: prompt.accepts,
        hangUp: prompt.hangUp,
      }),
    };
  },
});
