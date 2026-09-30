import type { Channel } from '@/types';

/**
 * The honesty model for channels.
 *
 * Every channel reports one of these states and the UI renders exactly what it
 * reports. A fallback is never presented as real: if a provider is not
 * configured, the screen says so and says what it is doing instead.
 */
export type ChannelState =
  | 'real'
  | 'connected'
  | 'processing'
  | 'fallback'
  | 'unavailable'
  | 'error';

export interface ChannelStatus {
  state: ChannelState;
  /** Short label rendered in the badge, e.g. "Live voice" or "Voice demo mode". */
  label: string;
  /** One sentence explaining why it is in this state. */
  detail: string;
}

/** What the server reports about itself. Never contains secrets. */
export interface Capabilities {
  /** The API server answered. */
  server: boolean;
  /** A configured database is reachable. */
  database: 'connected' | 'not_configured' | 'error';
  /** An SMS provider is configured server-side. */
  sms: { configured: boolean; provider: string | null };
  /** A telephony provider is configured server-side. */
  telephony: { configured: boolean; provider: string | null };
  /** Server-side speech-to-text is configured. */
  asr: { configured: boolean; provider: string | null };
  /** The public number a demo SMS/call would come from, if configured. */
  inboundNumber: string | null;
  checkedAt: string;
}

export const UNAVAILABLE_CAPABILITIES: Capabilities = {
  server: false,
  database: 'not_configured',
  sms: { configured: false, provider: null },
  telephony: { configured: false, provider: null },
  asr: { configured: false, provider: null },
  inboundNumber: null,
  checkedAt: '1970-01-01T00:00:00.000Z',
};

/** Browser capabilities, resolved in the client only. */
export interface ClientCapabilities {
  microphone: boolean;
  mediaRecorder: boolean;
  speechRecognition: boolean;
}

export type AppMode = 'demo' | 'live';

/**
 * The single place that decides what each channel badge says, so the four
 * channel screens cannot drift apart from each other or from the truth.
 */
export const resolveChannelStatus = (
  channel: Channel,
  mode: AppMode,
  capabilities: Capabilities,
  client: ClientCapabilities,
): ChannelStatus => {
  if (channel === 'chat') {
    if (mode === 'demo') {
      return {
        state: 'fallback',
        label: 'Chat demo mode',
        detail:
          'Your answers are processed by the real engine in this browser, but nothing is persisted beyond this session.',
      };
    }
    return capabilities.server
      ? {
          state: 'real',
          label: 'Live chat',
          detail:
            'Answers are sent to the API, scored by the domain engine and persisted, then pushed to the counsellor queue.',
        }
      : {
          state: 'fallback',
          label: 'Chat, local processing',
          detail:
            'The API server is not running, so answers are scored in this browser and held in session only.',
        };
  }

  if (channel === 'voice') {
    if (!client.microphone || !client.mediaRecorder) {
      return {
        state: 'fallback',
        label: 'Voice demo mode',
        detail:
          'This browser does not expose microphone capture, so a fixed sample reading is used instead.',
      };
    }
    return {
      state: 'real',
      label: 'Live voice',
      detail: client.speechRecognition
        ? 'Real microphone capture with on-device transcription. Measures are extracted in this browser and the recording is discarded.'
        : 'Real microphone capture. Measures are extracted in this browser and the recording is discarded. Transcription is unavailable in this browser.',
    };
  }

  if (channel === 'sms') {
    if (!capabilities.sms.configured) {
      return {
        state: 'fallback',
        label: 'SMS demo mode',
        detail:
          'No SMS provider is configured, so the thread below is a browser simulation. Configure a provider to receive real replies.',
      };
    }
    return {
      state: 'connected',
      label: 'Live SMS',
      detail: `Connected through ${capabilities.sms.provider}. A real reply to ${
        capabilities.inboundNumber ?? 'the configured number'
      } arrives through the webhook and appears in the queue.`,
    };
  }

  if (!capabilities.telephony.configured) {
    return {
      state: 'fallback',
      label: 'IVRS test console',
      detail:
        'Telephony is not connected. The console below drives the same server-side state machine a real call would, without placing a call.',
    };
  }
  return {
    state: 'connected',
    label: 'Live IVRS',
    detail: `Connected through ${capabilities.telephony.provider}. A real call is answered by the server-side state machine and its answers enter the same pipeline.`,
  };
};

export const STATE_TONE: Record<ChannelState, string> = {
  real: 'border-teal-500/30 bg-teal-500/10 text-teal-600',
  connected: 'border-teal-500/30 bg-teal-500/10 text-teal-600',
  processing: 'border-lav-200 bg-lav-200/25 text-lav-500',
  fallback: 'border-band-watch/30 bg-band-watch/10 text-band-watch',
  unavailable: 'border-line bg-ivory-100 text-ink-400',
  error: 'border-band-high/30 bg-band-high/10 text-band-high',
};
