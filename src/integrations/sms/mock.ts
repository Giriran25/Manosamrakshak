import type { InboundSms, SmsProvider } from './types';

/**
 * The provider used when none is configured.
 *
 * It does not send anything and says so. Its only job is to keep the shape of
 * the system identical whether or not credentials exist, so the demo path and
 * the real path run the same code above this line.
 */
export const createMockSmsProvider = (): SmsProvider => ({
  name: 'demo',
  configured: false,
  inboundNumber: null,

  async sendMessage() {
    return {
      ok: false,
      providerMessageId: null,
      error: 'No SMS provider is configured, so no message was sent.',
    };
  },

  // Nothing to verify: the simulated console posts directly and is only ever
  // accepted as a demo interaction.
  verifyWebhook() {
    return { ok: true };
  },

  parseWebhook(params): InboundSms | null {
    if (!params.Body) return null;
    return {
      providerMessageId: params.MessageSid ?? `demo-${Date.now()}`,
      from: params.From ?? 'demo-handset',
      to: params.To ?? 'demo-service',
      body: params.Body,
      receivedAt: new Date().toISOString(),
    };
  },

  replyBody(text) {
    return { contentType: 'application/json', body: JSON.stringify({ reply: text }) };
  },
});
