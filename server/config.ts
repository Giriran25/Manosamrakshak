/**
 * Server-only configuration.
 *
 * Every value here is read from the process environment and none of it is ever
 * sent to the browser. The client learns only whether a capability is
 * configured, never what it is configured with - see buildCapabilities().
 */

const read = (key: string): string | null => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : null;
};

export interface ServerConfig {
  port: number;
  /** Public base URL of this server, needed for provider callbacks. */
  publicUrl: string;
  allowedOrigins: string[];
  sms: {
    provider: string | null;
    accountId: string | null;
    authSecret: string | null;
    fromNumber: string | null;
    /** Skip signature verification. Only for local testing. */
    skipVerification: boolean;
  };
  telephony: {
    provider: string | null;
    accountId: string | null;
    authSecret: string | null;
    fromNumber: string | null;
    skipVerification: boolean;
    /** Whether the provider is set up to return speech as well as digits. */
    speechEnabled: boolean;
  };
  asr: {
    provider: string | null;
    endpoint: string | null;
    apiKey: string | null;
  };
  supabase: {
    url: string | null;
    serviceRoleKey: string | null;
  };
  /** Phone number registered for the demo case, so an inbound SMS can be routed. */
  demoPhone: string | null;
  demoCaseId: string;
}

export const config: ServerConfig = {
  port: Number(read('PORT') ?? 8787),
  publicUrl: read('PUBLIC_URL') ?? `http://localhost:${read('PORT') ?? 8787}`,
  allowedOrigins: (read('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  sms: {
    provider: read('SMS_PROVIDER'),
    accountId: read('SMS_ACCOUNT_ID'),
    authSecret: read('SMS_AUTH_SECRET'),
    fromNumber: read('SMS_FROM_NUMBER'),
    skipVerification: read('SMS_SKIP_VERIFICATION') === 'true',
  },
  telephony: {
    provider: read('TELEPHONY_PROVIDER'),
    accountId: read('TELEPHONY_ACCOUNT_ID'),
    authSecret: read('TELEPHONY_AUTH_SECRET'),
    fromNumber: read('TELEPHONY_FROM_NUMBER'),
    skipVerification: read('TELEPHONY_SKIP_VERIFICATION') === 'true',
    speechEnabled: read('TELEPHONY_SPEECH_ENABLED') === 'true',
  },
  asr: {
    provider: read('ASR_PROVIDER'),
    endpoint: read('ASR_ENDPOINT'),
    apiKey: read('ASR_API_KEY'),
  },
  supabase: {
    url: read('SUPABASE_URL') ?? read('VITE_SUPABASE_URL'),
    serviceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),
  },
  demoPhone: read('DEMO_PHONE_NUMBER'),
  demoCaseId: read('DEMO_CASE_ID') ?? 'VC-3007',
};

export const isSmsConfigured = (): boolean =>
  Boolean(config.sms.provider && config.sms.accountId && config.sms.authSecret && config.sms.fromNumber);

export const isTelephonyConfigured = (): boolean =>
  Boolean(config.telephony.provider && config.telephony.accountId && config.telephony.authSecret);

export const isAsrConfigured = (): boolean =>
  Boolean(config.asr.provider && config.asr.endpoint && config.asr.apiKey);

export const isDatabaseConfigured = (): boolean =>
  Boolean(config.supabase.url && config.supabase.serviceRoleKey);
