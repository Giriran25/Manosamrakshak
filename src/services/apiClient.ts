import type { Assessment, Channel, InteractionEvent, InteractionResponse, VoiceFeatures } from '@/types';
import {
  UNAVAILABLE_CAPABILITIES,
  type Capabilities,
  type ClientCapabilities,
} from '@/integrations/channels';

/**
 * The client side of the API.
 *
 * Everything here degrades: if the server is not running, capability discovery
 * returns "no server" and the application keeps working entirely in the
 * browser. That is what makes the demo safe without making it dishonest - the
 * badge says which of the two is happening.
 */

const configuredApiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const API_BASE = configuredApiBase && /^https?:\/\//i.test(configuredApiBase)
  ? configuredApiBase
  : configuredApiBase
    ? `https://${configuredApiBase}`
    : '';

const url = (path: string): string => `${API_BASE}${path}`;

/** One retry on a transient failure. The idempotency key makes it safe. */
const fetchWithRetry = async (
  input: string,
  init: RequestInit,
  attempts = 2,
): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      // A 5xx is worth one retry; a 4xx is the caller's problem and is returned.
      if (response.status >= 500 && attempt < attempts - 1) continue;
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('request failed');
};

export const fetchCapabilities = async (): Promise<Capabilities> => {
  try {
    const response = await fetch(url('/api/capabilities'), {
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return { ...UNAVAILABLE_CAPABILITIES, checkedAt: new Date().toISOString() };
    return (await response.json()) as Capabilities;
  } catch {
    // No server, or it did not answer in time. Local processing it is.
    return { ...UNAVAILABLE_CAPABILITIES, checkedAt: new Date().toISOString() };
  }
};

/** What this browser can actually do, resolved without asking for permission. */
export const resolveClientCapabilities = (): ClientCapabilities => {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const win = typeof window === 'undefined' ? undefined : window;
  return {
    microphone: Boolean(nav?.mediaDevices?.getUserMedia) && typeof win?.AudioContext !== 'undefined',
    mediaRecorder: typeof win !== 'undefined' && typeof win.MediaRecorder !== 'undefined',
    speechRecognition:
      typeof win !== 'undefined' &&
      ('SpeechRecognition' in win || 'webkitSpeechRecognition' in win),
  };
};

export interface IngestRequest {
  caseId: string;
  channel: Channel;
  responses: InteractionResponse[];
  voice?: VoiceFeatures;
  skipped?: number;
  isSynthetic?: boolean;
  idempotencyKey: string;
}

export interface IngestResponse {
  ok: true;
  duplicate: boolean;
  event: InteractionEvent;
  assessment: Assessment;
  trajectory: number[];
  persisted: boolean;
  persistence: { ok: boolean; reason?: string; skipped?: boolean };
}

export type IngestOutcome =
  | { ok: true; result: IngestResponse }
  | { ok: false; reason: string; retryable: boolean };

export const postInteraction = async (request: IngestRequest): Promise<IngestOutcome> => {
  try {
    const response = await fetchWithRetry(url('/api/interactions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Carried so that a retry - ours or the browser's - cannot create a
        // second check-in for the same answers.
        'Idempotency-Key': request.idempotencyKey,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        reason: detail.error ?? `The server rejected the check-in (HTTP ${response.status}).`,
        retryable: response.status >= 500,
      };
    }

    return { ok: true, result: (await response.json()) as IngestResponse };
  } catch {
    return {
      ok: false,
      reason: 'The server could not be reached, so the check-in was processed in this browser.',
      retryable: true,
    };
  }
};

/** Optional server-side transcription. Returns null whenever it is unavailable. */
export const postTranscription = async (
  audio: Blob,
): Promise<{ transcript: string | null; reason?: string }> => {
  try {
    const response = await fetch(url('/api/voice/transcribe'), {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'application/octet-stream' },
      body: audio,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await response.json()) as { transcript?: string | null; reason?: string };
    return { transcript: json.transcript ?? null, reason: json.reason };
  } catch {
    return { transcript: null, reason: 'Transcription service unreachable.' };
  }
};

export interface IvrsSessionView {
  callId: string;
  caseId: string;
  state: string;
  responses: InteractionResponse[];
  presses: Array<{ digit: string; at: string; state: string }>;
  counsellorRequested: boolean;
  interactionId: string | null;
}

export interface IvrsPrompt {
  state: string;
  say: string;
  expectsInput: boolean;
  accepts: string[];
  hangUp: boolean;
}

export const startIvrsConsoleCall = async (
  caseId: string,
): Promise<{ ok: boolean; session?: IvrsSessionView; prompt?: IvrsPrompt; reason?: string }> => {
  try {
    const response = await fetch(url('/api/ivrs/console'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId }),
    });
    const json = (await response.json()) as {
      ok?: boolean;
      session?: IvrsSessionView;
      prompt?: IvrsPrompt;
      reason?: string;
    };
    return { ok: response.ok && Boolean(json.ok), ...json };
  } catch {
    return { ok: false, reason: 'The API server could not be reached.' };
  }
};

export const pressIvrsDigit = async (input: {
  callId: string;
  caseId: string;
  digit: string;
}): Promise<{ ok: boolean; prompt?: IvrsPrompt; reason?: string }> => {
  try {
    const response = await fetch(url('/api/ivrs/voice'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CallSid: input.callId,
        Digits: input.digit,
        From: 'test-console',
        caseId: input.caseId,
      }),
    });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    return { ok: true, prompt: (await response.json()) as IvrsPrompt };
  } catch {
    return { ok: false, reason: 'The API server could not be reached.' };
  }
};

export const fetchIvrsSession = async (callId: string): Promise<IvrsSessionView | null> => {
  try {
    const response = await fetch(url(`/api/ivrs/session?callId=${encodeURIComponent(callId)}`));
    if (!response.ok) return null;
    const json = (await response.json()) as { session?: IvrsSessionView };
    return json.session ?? null;
  } catch {
    return null;
  }
};

export const placeTestCall = async (): Promise<{ ok: boolean; reason?: string; callId?: string | null }> => {
  try {
    const response = await fetch(url('/api/ivrs/call'), { method: 'POST' });
    return (await response.json()) as { ok: boolean; reason?: string; callId?: string | null };
  } catch {
    return { ok: false, reason: 'The API server could not be reached.' };
  }
};

export const sendTestSms = async (): Promise<{ ok: boolean; reason?: string; provider?: string }> => {
  try {
    const response = await fetch(url('/api/sms/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: `prompt-${Date.now()}` }),
    });
    return (await response.json()) as { ok: boolean; reason?: string; provider?: string };
  } catch {
    return { ok: false, reason: 'The API server could not be reached.' };
  }
};

export interface LiveEvent {
  kind: string;
  caseId: string;
  channel: Channel | null;
  at: string;
  detail: string;
}

/**
 * Live activity.
 *
 * Server-sent events when the API is running, so a check-in taken on one
 * device appears on a counsellor's screen without a refresh. When there is no
 * server, a same-origin BroadcastChannel does the same job across tabs in this
 * browser - still real, just narrower in reach.
 */
export const subscribeToLiveEvents = (
  onEvent: (event: LiveEvent) => void,
  options: { server: boolean },
): (() => void) => {
  if (options.server && typeof EventSource !== 'undefined') {
    const source = new EventSource(url('/api/events'));
    const handler = (message: MessageEvent<string>) => {
      try {
        onEvent(JSON.parse(message.data) as LiveEvent);
      } catch {
        // A malformed frame is ignored rather than breaking the stream.
      }
    };
    source.addEventListener('live', handler as EventListener);
    return () => {
      source.removeEventListener('live', handler as EventListener);
      source.close();
    };
  }

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('manosamrakshak.live');
    const handler = (message: MessageEvent<LiveEvent>) => onEvent(message.data);
    channel.addEventListener('message', handler as EventListener);
    return () => {
      channel.removeEventListener('message', handler as EventListener);
      channel.close();
    };
  }

  return () => undefined;
};

/** Publishes a locally-processed interaction to other tabs when there is no server. */
export const publishLocalEvent = (event: LiveEvent): void => {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel('manosamrakshak.live');
    channel.postMessage(event);
    channel.close();
  } catch {
    // Not available in this context. The in-tab store update still happens.
  }
};
