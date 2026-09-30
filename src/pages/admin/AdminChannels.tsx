import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Mic, Phone, RefreshCw, Send, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useCapabilities } from '@/hooks/useChannels';
import { placeTestCall, sendTestSms } from '@/services/apiClient';
import { extractVoiceFeatures } from '@/integrations/voice/features';
import { ChannelStatusRow } from '@/components/common/ChannelStatus';
import { Eyebrow } from '@/components/common/Primitives';
import { DisclosureSection, Rise } from '@/components/common/Editorial';
import { LiveActivity } from '@/components/counsellor/LiveActivity';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

type TestKey = 'microphone' | 'sms' | 'telephony' | 'chat' | 'database';

interface TestResult {
  ok: boolean;
  note: string;
}

/**
 * Channel test panel.
 *
 * One place to find out what is actually connected before a demo. Every test
 * here does the real thing: opens the microphone, asks the provider to send,
 * asks the provider to dial, posts a check-in through the API. A test that
 * cannot run says why rather than reporting a false success, and no credential
 * is ever displayed.
 */
export const AdminChannels = () => {
  useCapabilities();
  const capabilities = useAppStore((s) => s.capabilities);
  const client = useAppStore((s) => s.client);
  const refresh = useAppStore((s) => s.refreshCapabilities);
  const submit = useAppStore((s) => s.submitInteraction);
  const mode = useAppStore((s) => s.mode);
  const cases = useAppStore((s) => s.cases);

  const [results, setResults] = useState<Partial<Record<TestKey, TestResult>>>({});
  const [running, setRunning] = useState<TestKey | null>(null);

  const record = (key: TestKey, result: TestResult) =>
    setResults((current) => ({ ...current, [key]: result }));

  /** Opens the microphone, measures two seconds, reports what it measured. */
  const testMicrophone = async () => {
    setRunning('microphone');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const rms: number[] = [];
      const zcr: number[] = [];

      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          let crossings = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            sum += buffer[i] * buffer[i];
            if (i > 0 && ((buffer[i] >= 0 && buffer[i - 1] < 0) || (buffer[i] < 0 && buffer[i - 1] >= 0))) {
              crossings += 1;
            }
          }
          rms.push(Math.sqrt(sum / buffer.length));
          zcr.push(crossings / buffer.length);
        }, 50);
        window.setTimeout(() => {
          window.clearInterval(timer);
          resolve();
        }, 2000);
      });

      stream.getTracks().forEach((track) => track.stop());
      void context.close();

      const features = extractVoiceFeatures({ rms, zcr, durationMs: 2000 });
      record('microphone', {
        ok: true,
        note: `Captured ${features.frames} frames. Mean energy ${features.meanEnergy.toFixed(3)}, speaking ratio ${features.speakingRatio.toFixed(2)}. The audio was discarded.`,
      });
    } catch {
      record('microphone', {
        ok: false,
        note: 'Microphone permission was not granted, or no input device is available.',
      });
    }
    setRunning(null);
  };

  const testSms = async () => {
    setRunning('sms');
    const result = await sendTestSms();
    record('sms', {
      ok: result.ok,
      note: result.ok
        ? `Prompt accepted by ${result.provider}. Reply from the handset to complete the round trip.`
        : (result.reason ?? 'The send was refused.'),
    });
    setRunning(null);
  };

  const testTelephony = async () => {
    setRunning('telephony');
    const result = await placeTestCall();
    record('telephony', {
      ok: result.ok,
      note: result.ok
        ? `The provider accepted the call and returned id ${result.callId ?? 'unknown'}.`
        : (result.reason ?? 'The call was refused.'),
    });
    setRunning(null);
  };

  /** Posts a genuine check-in so the whole pipeline can be exercised. */
  const testChat = async () => {
    setRunning('chat');
    const target = cases.find((c) => !c.frozen) ?? cases[0];
    if (!target) {
      record('chat', { ok: false, note: 'No case is loaded to test against.' });
      setRunning(null);
      return;
    }
    const outcome = await submit({
      caseId: target.caseId,
      channel: 'chat',
      responses: [
        {
          questionId: 'q1-feeling',
          value: 3,
          freeText: 'Channel test from the admin panel.',
          latencyMs: 4000,
        },
      ],
      skipped: 0,
    });
    record('chat', {
      ok: Boolean(outcome.event),
      note: `${outcome.note} Case ${target.caseId}, route ${outcome.route}.`,
    });
    setRunning(null);
  };

  const testDatabase = async () => {
    setRunning('database');
    await refresh();
    const state = useAppStore.getState().capabilities.database;
    record('database', {
      ok: state === 'connected',
      note:
        state === 'connected'
          ? 'The database answered. Real interactions are being written to it.'
          : state === 'not_configured'
            ? 'No database is configured. Interactions are held in server memory and in this session.'
            : 'A database is configured but did not answer.',
    });
    setRunning(null);
  };

  const TESTS: Array<{
    key: TestKey;
    label: string;
    icon: typeof Mic;
    detail: string;
    run: () => Promise<void>;
    available: boolean;
    unavailableNote: string;
  }> = [
    {
      key: 'microphone',
      label: 'Test the microphone',
      icon: Mic,
      detail: 'Opens the microphone for two seconds and reports the measures it extracted.',
      run: testMicrophone,
      available: client.microphone,
      unavailableNote: 'This browser does not expose microphone capture.',
    },
    {
      key: 'chat',
      label: 'Send a test check-in',
      icon: Send,
      detail: 'Posts a real interaction through the full pipeline and reports where it landed.',
      run: testChat,
      available: true,
      unavailableNote: '',
    },
    {
      key: 'sms',
      label: 'Send a test SMS',
      icon: Send,
      detail: 'Asks the configured provider to send the check-in prompt to the registered handset.',
      run: testSms,
      available: capabilities.sms.configured,
      unavailableNote: 'No SMS provider is configured on the server.',
    },
    {
      key: 'telephony',
      label: 'Place a test call',
      icon: Phone,
      detail: 'Asks the configured provider to dial the registered handset and run the call flow.',
      run: testTelephony,
      available: capabilities.telephony.configured,
      unavailableNote: 'Telephony is not connected on the server.',
    },
    {
      key: 'database',
      label: 'Test the database',
      icon: RefreshCw,
      detail: 'Re-reads the server capabilities and reports whether the database answered.',
      run: testDatabase,
      available: capabilities.server,
      unavailableNote: 'The API server is not reachable.',
    },
  ];

  return (
    <div className="space-y-11 pb-4">
      <header>
        <Rise>
          <Eyebrow>Channels</Eyebrow>
          <h1 className="mt-2 max-w-[26ch] text-display-md text-ink-900">
            What is actually connected
          </h1>
          <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-500">
            Current mode: <span className="text-ink-900">{mode}</span>. Chat and voice need no
            external credential and work as soon as the page loads. SMS and telephony become live
            when a provider is configured on the server, and say so here until then.
          </p>
        </Rise>
      </header>

      <DisclosureSection index="01" label="Channel status">
        <ChannelStatusRow />
      </DisclosureSection>

      <DisclosureSection index="02" label="Server" title="Reported capabilities">
        <dl className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['API server', capabilities.server ? 'reachable' : 'not reachable'],
            ['Database', capabilities.database.replace('_', ' ')],
            ['SMS provider', capabilities.sms.provider ?? 'not configured'],
            ['Telephony provider', capabilities.telephony.provider ?? 'not configured'],
            ['Server transcription', capabilities.asr.provider ?? 'not configured'],
            ['Inbound number', capabilities.inboundNumber ?? 'not configured'],
            ['Browser microphone', client.microphone ? 'available' : 'unavailable'],
            ['Browser recording', client.mediaRecorder ? 'available' : 'unavailable'],
            ['Browser transcription', client.speechRecognition ? 'available' : 'unavailable'],
          ].map(([label, value]) => (
            <div key={label} className="bg-paper px-4 py-3.5">
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">{label}</dt>
              <dd className="mt-1 font-mono text-[13px] text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
          Provider names and connection states only. No account identifier, token, endpoint or key
          is exposed to the browser.
        </p>
      </DisclosureSection>

      <DisclosureSection index="03" label="Tests" title="Run the real thing">
        <ul className="grid gap-3 lg:grid-cols-2">
          {TESTS.map((test) => {
            const result = results[test.key];
            return (
              <li
                key={test.key}
                className="flex flex-col rounded-3xl border border-line bg-paper px-5 py-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ivory-100">
                    <test.icon aria-hidden className="h-4 w-4 text-ink-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] text-ink-900">{test.label}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-400">{test.detail}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-[13px]"
                    onClick={() => void test.run()}
                    disabled={!test.available || running !== null}
                  >
                    {running === test.key ? 'Running' : 'Run'}
                  </button>
                  {!test.available ? (
                    <p className="text-[12px] text-band-watch">{test.unavailableNote}</p>
                  ) : null}
                </div>

                {result ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className={cn(
                      'mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed',
                      result.ok
                        ? 'bg-teal-500/[0.08] text-ink-700'
                        : 'bg-band-watch/10 text-ink-700',
                    )}
                  >
                    {result.ok ? (
                      <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                    ) : (
                      <X aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-band-watch" />
                    )}
                    <span>{result.note}</span>
                  </motion.div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </DisclosureSection>

      <DisclosureSection index="04" label="Activity">
        <LiveActivity />
      </DisclosureSection>
    </div>
  );
};
