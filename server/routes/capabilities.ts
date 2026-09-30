import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Capabilities } from '@/integrations/channels';
import { config, isAsrConfigured } from '../config';
import { smsProvider } from '../integrations/smsProvider';
import { telephonyProvider } from '../integrations/telephonyProvider';
import { checkDatabase } from '../persistence';
import { sendJson } from '../http';

/**
 * What the server will admit to.
 *
 * Booleans and provider names only. No account id, no token, no endpoint, no
 * key - the browser learns whether a capability exists, never what it is
 * configured with.
 */
export const buildCapabilities = async (): Promise<Capabilities> => {
  const sms = smsProvider();
  const telephony = telephonyProvider();

  return {
    server: true,
    database: await checkDatabase(),
    sms: { configured: sms.configured, provider: sms.configured ? sms.name : null },
    telephony: {
      configured: telephony.configured,
      provider: telephony.configured ? telephony.name : null,
    },
    asr: {
      configured: isAsrConfigured(),
      provider: isAsrConfigured() ? config.asr.provider : null,
    },
    // Safe to publish: it is the number a person is asked to text or call.
    inboundNumber: sms.inboundNumber ?? telephony.inboundNumber,
    checkedAt: new Date().toISOString(),
  };
};

export const handleCapabilities = async (
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  sendJson(res, 200, await buildCapabilities());
};
