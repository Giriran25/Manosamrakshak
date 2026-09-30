import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, PhoneOff, Signal } from 'lucide-react';
import { IVRS_FLOW } from '@/integrations/telephony/stateMachine';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  fetchIvrsSession,
  placeTestCall,
  pressIvrsDigit,
  startIvrsConsoleCall,
  type IvrsPrompt,
  type IvrsSessionView,
} from '@/services/apiClient';
import { ChannelStatus } from '@/components/common/ChannelStatus';
import { InlineWarning } from '@/components/common/Primitives';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

const KEY_LABELS: Record<'1' | '2' | '3' | '4' | '5', string> = {
  '1': 'Continue / better',
  '2': 'Repeat question',
  '3': 'Counsellor / about the same',
  '4': 'End call',
  '5': 'Much worse',
};

/**
 * The IVRS console.
 *
 * This is not a mock-up of a call: every keypress here is posted to the same
 * server webhook a carrier would post to, advances the same server-side state
 * machine, and produces a real interaction through the same ingest path. What
 * is missing without a provider is only the carrier leg, and the badge says so.
 *
 * When telephony is configured the console hands over: a real outbound call is
 * placed and this screen becomes an observer of it.
 */
export const IvrsSimulator = ({ caseId }: { caseId: string }) => {
  const { t } = useTranslation();
  const capabilities = useAppStore((s) => s.capabilities);
  const telephonyLive = capabilities.telephony.configured;

  const [session, setSession] = useState<IvrsSessionView | null>(null);
  const [prompt, setPrompt] = useState<IvrsPrompt | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);
  const poll = useRef<number | null>(null);

  const onCall = Boolean(session) && !prompt?.hangUp;

  useEffect(() => {
    if (!onCall) return;
    const timer = window.setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [onCall]);

  // While a real call is in progress the console observes the server session.
  useEffect(() => {
    if (!telephonyLive || !session?.callId) return;
    poll.current = window.setInterval(() => {
      void fetchIvrsSession(session.callId).then((latest) => {
        if (latest) setSession(latest);
      });
    }, 1500);
    return () => {
      if (poll.current !== null) window.clearInterval(poll.current);
    };
  }, [telephonyLive, session?.callId]);

  useEffect(
    () => () => {
      if (poll.current !== null) window.clearInterval(poll.current);
    },
    [],
  );

  const startConsole = async () => {
    setBusy(true);
    setProblem(null);
    setPlaced(null);
    const result = await startIvrsConsoleCall(caseId);
    setBusy(false);
    if (!result.ok || !result.session) {
      setProblem(result.reason ?? 'The call could not be started.');
      return;
    }
    setSession(result.session);
    setPrompt(result.prompt ?? null);
    setSeconds(0);
  };

  const startRealCall = async () => {
    setBusy(true);
    setProblem(null);
    const result = await placeTestCall();
    setBusy(false);
    if (!result.ok) {
      setProblem(result.reason ?? 'The provider did not accept the call.');
      return;
    }
    // Nothing is claimed until the provider confirms a call id.
    setPlaced(result.callId ?? null);
    if (result.callId) {
      const latest = await fetchIvrsSession(result.callId);
      if (latest) setSession(latest);
    }
  };

  const press = async (digit: '1' | '2' | '3' | '4' | '5') => {
    if (!session) return;
    setBusy(true);
    const result = await pressIvrsDigit({ callId: session.callId, caseId, digit });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.reason ?? 'The keypress could not be delivered.');
      return;
    }
    setPrompt(result.prompt ?? null);
    const latest = await fetchIvrsSession(session.callId);
    if (latest) setSession(latest);
  };

  const timer = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const stateIndex = prompt ? IVRS_FLOW.indexOf(prompt.state as (typeof IVRS_FLOW)[number]) : -1;

  return (
    <div className="space-y-5">
      <ChannelStatus channel="ivrs" processing={busy} />

      {!capabilities.server ? (
        <InlineWarning>
          The API server is not running, so the call state machine is unavailable. Start it with{' '}
          <span className="font-mono">npm run server</span> to drive a call from this console.
        </InlineWarning>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {/* The call. */}
        <div className="relative overflow-hidden rounded-3xl bg-forest-900 px-5 py-6 text-sage-100 sm:px-7">
          <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-20" />

          <div className="relative flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-white/45">
              {onCall ? (
                <Signal aria-hidden className="h-3.5 w-3.5 text-teal-400" />
              ) : (
                <PhoneOff aria-hidden className="h-3.5 w-3.5" />
              )}
              {onCall ? 'Connected' : session ? 'Call ended' : 'Not connected'}
            </span>
            <span className="font-mono text-[13px] tabular-nums text-white/70">{timer}</span>
          </div>

          {session ? (
            <p className="relative mt-2 font-mono text-[10.5px] text-white/35">
              call {session.callId} &middot; case {session.caseId}
            </p>
          ) : null}

          <div className="relative mt-6 min-h-[132px]">
            <AnimatePresence mode="wait">
              <motion.p
                key={prompt?.state ?? 'idle'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="max-w-[46ch] font-display text-[20px] leading-[1.4] text-white sm:text-[23px]"
                aria-live="polite"
              >
                {prompt?.say ??
                  (telephonyLive
                    ? 'Place a test call to the registered handset. The prompts below are what the caller will hear.'
                    : 'Start a call to drive the server-side state machine from here.')}
              </motion.p>
            </AnimatePresence>
          </div>

          {session && stateIndex >= 0 ? (
            <div className="relative mt-6">
              <div className="flex items-center gap-1.5">
                {IVRS_FLOW.map((node, index) => (
                  <span
                    key={node}
                    aria-hidden
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-500',
                      index < stateIndex
                        ? 'bg-teal-400'
                        : index === stateIndex
                          ? 'bg-teal-400/45'
                          : 'bg-white/12',
                    )}
                  />
                ))}
              </div>
              <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/35">
                {prompt?.state} &middot; {session.responses.length} of 3 answers collected
                {session.interactionId ? ' · interaction created' : ''}
              </p>
            </div>
          ) : null}

          <div className="relative mt-6 flex flex-wrap gap-2">
            {telephonyLive ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void startRealCall()}
                disabled={busy}
              >
                <Phone aria-hidden className="h-3.5 w-3.5" />
                Place a real test call
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void startConsole()}
                disabled={busy || !capabilities.server}
              >
                <Phone aria-hidden className="h-3.5 w-3.5" />
                {session ? 'Start another call' : 'Start console call'}
              </button>
            )}
          </div>

          {placed ? (
            <p className="relative mt-3 text-[12px] text-teal-400">
              The provider accepted the call and returned id {placed}. The prompts above are being
              spoken to the handset now.
            </p>
          ) : null}
        </div>

        {/* Keypad. */}
        <div className="rounded-3xl border border-line bg-paper px-5 py-6">
          <p className="eyebrow">Keypad</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
            {telephonyLive
              ? 'A real caller presses these on their handset. The server records each press against the call.'
              : 'Each press is posted to the same webhook a carrier posts to.'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['1', '2', '3', '4', '5'] as const).map((key) => {
              const disabled =
                busy || telephonyLive || !session || !prompt?.expectsInput || !prompt.accepts.includes(key);
              return (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => void press(key)}
                  disabled={disabled}
                  whileTap={disabled ? undefined : { scale: 0.96 }}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border px-4 py-3.5 text-left transition-colors',
                    disabled
                      ? 'border-line bg-ivory-100/50 opacity-45'
                      : 'border-line bg-paper hover:border-forest-700/40 hover:bg-sage-100/50',
                  )}
                >
                  <span className="font-mono text-xl text-ink-900">{key}</span>
                  <span className="text-[11.5px] leading-snug text-ink-500">{KEY_LABELS[key]}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-4 min-h-[92px] rounded-2xl bg-ivory-100 px-4 py-3">
            <p className="eyebrow mb-2">Key presses recorded by the server</p>
            {!session || session.presses.length === 0 ? (
              <p className="text-[12px] text-ink-300">None yet.</p>
            ) : (
              <ul className="space-y-1">
                <AnimatePresence initial={false}>
                  {session.presses.map((entry, index) => (
                    <motion.li
                      key={`${entry.digit}-${index}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                      className="font-mono text-[11.5px] text-ink-500"
                    >
                      {entry.digit} &middot; at {entry.state}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>

      {problem ? <InlineWarning>{problem}</InlineWarning> : null}

      {session?.counsellorRequested ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-sage-200 bg-sage-100/50 px-4 py-3.5"
        >
          <p className="text-[13.5px] text-ink-900">Your request has been recorded.</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
            Counsellor contact will be handled through the support workflow. No call has been placed
            to a counsellor by this prototype.
          </p>
        </motion.div>
      ) : null}

      {session?.interactionId ? (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/[0.06] px-4 py-3.5">
          <p className="text-[13px] text-ink-900">
            The call produced interaction{' '}
            <span className="font-mono">{session.interactionId}</span> through the same pipeline as
            every other channel.
          </p>
          <p className="mt-1 text-[12px] text-ink-500">
            {t('checkin.normalizedNote')} It is already visible in the counsellor queue.
          </p>
        </div>
      ) : null}
    </div>
  );
};
