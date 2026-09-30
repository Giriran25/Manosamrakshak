import { describe, expect, it } from 'vitest';
import { advance, createSession, PROMPTS } from './telephony/stateMachine';
import { parseSmsReply, SMS_PROMPT } from './sms/types';
import { createMockSmsProvider } from './sms/mock';
import { createMockTelephonyProvider } from './telephony/mock';
import {
  extractVoiceFeatures,
  silenceThreshold,
  toVoiceFeatures,
  describeVoice,
  SAMPLE_VOICE_FEATURES,
} from './voice/features';
import { resolveChannelStatus, UNAVAILABLE_CAPABILITIES, type Capabilities } from './channels';
import { twilioSignature, verifyTwilioSignature } from '../../server/integrations/signature';

const CLIENT_ALL = { microphone: true, mediaRecorder: true, speechRecognition: true };
const CLIENT_NONE = { microphone: false, mediaRecorder: false, speechRecognition: false };

const configured: Capabilities = {
  server: true,
  database: 'connected',
  sms: { configured: true, provider: 'twilio' },
  telephony: { configured: true, provider: 'twilio' },
  asr: { configured: false, provider: null },
  inboundNumber: '+15550001111',
  checkedAt: '2026-04-14T10:00:00.000Z',
};

describe('voice feature extraction', () => {
  it('measures speech and silence from real frame data', () => {
    // Half the frames loud, half near-silent: a clear speech-and-pause pattern.
    const rms = [...Array(50).fill(0.4), ...Array(50).fill(0.002)];
    const zcr = [...Array(50).fill(0.12), ...Array(50).fill(0.01)];
    const features = extractVoiceFeatures({ rms, zcr, durationMs: 5000 });

    expect(features.frames).toBe(100);
    expect(features.speakingRatio).toBeGreaterThan(0.4);
    expect(features.speakingRatio).toBeLessThan(0.6);
    expect(features.pauseRatio).toBeCloseTo(1 - features.speakingRatio, 5);
    expect(features.meanEnergy).toBeGreaterThan(0);
    expect(features.zeroCrossingRate).toBeGreaterThan(0);
    expect(features.speechRuns).toBe(1);
  });

  it('counts distinct speech runs rather than total loud frames', () => {
    const rms = [0.4, 0.4, 0.001, 0.001, 0.4, 0.001, 0.4, 0.4];
    const zcr = rms.map(() => 0.1);
    expect(extractVoiceFeatures({ rms, zcr, durationMs: 800 }).speechRuns).toBe(3);
  });

  it('reports silence for an empty or silent recording', () => {
    const empty = extractVoiceFeatures({ rms: [], zcr: [], durationMs: 0 });
    expect(empty.speakingRatio).toBe(0);
    expect(empty.pauseRatio).toBe(1);

    const silent = extractVoiceFeatures({
      rms: Array(40).fill(0.0005),
      zcr: Array(40).fill(0.001),
      durationMs: 2000,
    });
    expect(silent.speakingRatio).toBe(0);
  });

  it('derives its silence threshold from the recording, with a floor', () => {
    expect(silenceThreshold(Array(20).fill(0.0001))).toBe(0.012);
    expect(silenceThreshold([0.01, 0.02, 0.9])).toBeGreaterThan(0.012);
  });

  it('hands the domain engine exactly the five fields it consumes', () => {
    const features = toVoiceFeatures(SAMPLE_VOICE_FEATURES);
    expect(Object.keys(features).sort()).toEqual(
      ['durationMs', 'energyVariation', 'meanEnergy', 'pauseRatio', 'speakingRatio'].sort(),
    );
  });

  it('describes a reading in plain language without feature names', () => {
    const described = describeVoice(SAMPLE_VOICE_FEATURES)
      .map((row) => `${row.label} ${row.value}`)
      .join(' ');
    expect(described).not.toMatch(/rms|zero.?crossing|energy variation/i);
    expect(described).toMatch(/Voice activity|Speaking pattern/);
  });
});

describe('inbound SMS parsing', () => {
  it('reads a bare digit', () => {
    const parsed = parseSmsReply('2');
    expect(parsed.digit).toBe('2');
    expect(parsed.response?.value).toBe(4);
    expect(parsed.requestsCounsellor).toBe(false);
  });

  it('reads a digit with trailing free text and keeps the text', () => {
    const parsed = parseSmsReply('2 - the hearing was adjourned again');
    expect(parsed.digit).toBe('2');
    expect(parsed.freeText).toBe('the hearing was adjourned again');
    expect(parsed.response?.freeText).toContain('adjourned');
  });

  it('recognises words when no digit was sent', () => {
    expect(parseSmsReply('feeling better today').digit).toBe('1');
    expect(parseSmsReply('things are very difficult').digit).toBe('2');
    expect(parseSmsReply('I need support please').digit).toBe('3');
  });

  it('routes a request for support to a counsellor', () => {
    const parsed = parseSmsReply('3');
    expect(parsed.requestsCounsellor).toBe(true);
    expect(parsed.reply).toMatch(/counsellor/i);
  });

  it('keeps unrecognised text as free text rather than discarding it', () => {
    const parsed = parseSmsReply('they came to my house last night');
    expect(parsed.digit).toBeNull();
    expect(parsed.response?.value).toBeNull();
    expect(parsed.response?.freeText).toContain('came to my house');
  });

  it('returns nothing to score for an empty message', () => {
    expect(parseSmsReply('   ').response).toBeNull();
  });

  it('has a prompt a person can answer with one digit', () => {
    expect(SMS_PROMPT).toMatch(/1/);
    expect(SMS_PROMPT).toMatch(/2/);
    expect(SMS_PROMPT).toMatch(/3/);
  });
});

describe('webhook signature verification', () => {
  const token = 'super-secret-token';
  const url = 'https://example.test/api/sms/webhook';
  const params = { MessageSid: 'SM1', From: '+919000012345', Body: '2' };

  it('accepts a correctly signed request', () => {
    const signature = twilioSignature(token, url, params);
    expect(verifyTwilioSignature({ authToken: token, url, params, header: signature }).ok).toBe(true);
  });

  it('rejects a missing signature', () => {
    expect(verifyTwilioSignature({ authToken: token, url, params, header: undefined }).ok).toBe(
      false,
    );
  });

  it('rejects a tampered body', () => {
    const signature = twilioSignature(token, url, params);
    const tampered = { ...params, Body: '3' };
    expect(
      verifyTwilioSignature({ authToken: token, url, params: tampered, header: signature }).ok,
    ).toBe(false);
  });

  it('rejects a signature computed for a different URL', () => {
    const signature = twilioSignature(token, 'https://elsewhere.test/hook', params);
    expect(verifyTwilioSignature({ authToken: token, url, params, header: signature }).ok).toBe(
      false,
    );
  });

  it('is order independent, because parameters are sorted before signing', () => {
    const a = twilioSignature(token, url, { b: '2', a: '1' });
    const b = twilioSignature(token, url, { a: '1', b: '2' });
    expect(a).toBe(b);
  });
});

describe('IVRS state machine', () => {
  const at = (seconds: number): string => new Date(1_700_000_000_000 + seconds * 1000).toISOString();

  it('walks the intro and three questions to completion', () => {
    let session = createSession('call-1', 'VC-3007', at(0));
    expect(session.state).toBe('intro');

    let result = advance(session, '1', at(2));
    session = result.session;
    expect(session.state).toBe('question_1');

    result = advance(session, '5', at(6));
    session = result.session;
    expect(session.state).toBe('question_2');
    expect(session.responses[0].value).toBe(5);
    expect(session.responses[0].latencyMs).toBe(4000);

    result = advance(session, '3', at(10));
    session = result.session;
    expect(session.state).toBe('question_3');
    // The "what is difficult" prompt carries context, not a rating.
    expect(session.responses[1].value).toBeNull();

    result = advance(session, '1', at(14));
    session = result.session;
    expect(session.state).toBe('complete');
    expect(result.completedNow).toBe(true);
    expect(session.responses).toHaveLength(3);
  });

  it('replays the prompt on 2 without recording an answer', () => {
    const session = createSession('call-2', 'VC-3007', at(0));
    const result = advance(session, '2', at(1));
    expect(result.session.state).toBe('intro');
    expect(result.session.responses).toHaveLength(0);
    expect(result.prompt.state).toBe('intro');
  });

  it('routes 3 from the menu to a counsellor request and hangs up', () => {
    const session = createSession('call-3', 'VC-3007', at(0));
    const result = advance(session, '3', at(1));
    expect(result.session.state).toBe('request_counsellor');
    expect(result.session.counsellorRequested).toBe(true);
    expect(result.prompt.hangUp).toBe(true);
    expect(result.prompt.say).not.toMatch(/emergency|dispatched|ambulance/i);
  });

  it('ends the call on 4 and does not complete an empty check-in', () => {
    const session = createSession('call-4', 'VC-3007', at(0));
    const result = advance(session, '4', at(1));
    expect(result.session.state).toBe('complete');
    expect(result.completedNow).toBe(false);
  });

  it('ignores a digit the current state does not accept', () => {
    let session = createSession('call-5', 'VC-3007', at(0));
    session = advance(session, '1', at(1)).session;
    session = advance(session, '1', at(2)).session;
    session = advance(session, '1', at(3)).session;
    session = advance(session, '1', at(4)).session;
    expect(session.state).toBe('complete');

    const after = advance(session, '1', at(5));
    expect(after.ignored).toBe(true);
    expect(after.session.state).toBe('complete');
    expect(after.session.responses).toHaveLength(3);
  });

  it('never speaks a prompt that claims an emergency service was contacted', () => {
    for (const prompt of Object.values(PROMPTS)) {
      expect(prompt.say).not.toMatch(/police have been|ambulance|emergency services have/i);
    }
  });
});

describe('fallback providers', () => {
  it('the SMS fallback refuses to send and says so', async () => {
    const provider = createMockSmsProvider();
    expect(provider.configured).toBe(false);
    const result = await provider.sendMessage({ to: '+10000000000', body: 'x', idempotencyKey: 'k' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no sms provider is configured/i);
  });

  it('the telephony fallback refuses to dial and says so', async () => {
    const provider = createMockTelephonyProvider();
    expect(provider.configured).toBe(false);
    expect(provider.supportsSpeech).toBe(false);
    const result = await provider.startCall({ to: '+10000000000', answerUrl: 'http://x/y' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not connected/i);
  });
});

describe('channel status honesty', () => {
  it('calls voice real when the browser can capture', () => {
    const status = resolveChannelStatus('voice', 'live', UNAVAILABLE_CAPABILITIES, CLIENT_ALL);
    expect(status.state).toBe('real');
    expect(status.label).toMatch(/live voice/i);
  });

  it('calls voice a demo fallback when it cannot', () => {
    const status = resolveChannelStatus('voice', 'live', UNAVAILABLE_CAPABILITIES, CLIENT_NONE);
    expect(status.state).toBe('fallback');
    expect(status.label).toMatch(/demo/i);
  });

  it('never calls SMS or IVRS live without a configured provider', () => {
    for (const channel of ['sms', 'ivrs'] as const) {
      const status = resolveChannelStatus(channel, 'live', UNAVAILABLE_CAPABILITIES, CLIENT_ALL);
      expect(status.state).toBe('fallback');
      expect(status.label).not.toMatch(/^live/i);
    }
  });

  it('calls SMS and IVRS connected once a provider is configured', () => {
    expect(resolveChannelStatus('sms', 'live', configured, CLIENT_ALL).label).toMatch(/live sms/i);
    expect(resolveChannelStatus('ivrs', 'live', configured, CLIENT_ALL).label).toMatch(/live ivrs/i);
  });

  it('does not claim chat is live when the server is absent', () => {
    const status = resolveChannelStatus('chat', 'live', UNAVAILABLE_CAPABILITIES, CLIENT_ALL);
    expect(status.state).toBe('fallback');
    expect(status.detail).toMatch(/not running/i);
  });

  it('says demo mode is demo mode even when everything is configured', () => {
    expect(resolveChannelStatus('chat', 'demo', configured, CLIENT_ALL).label).toMatch(/demo/i);
  });
});
