import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCheck } from 'lucide-react';
import type { InteractionEvent } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CheckInOutcome, TypingDots } from './CheckInShared';
import { ChannelStatus } from '@/components/common/ChannelStatus';
import { InlineWarning } from '@/components/common/Primitives';
import { sendTestSms } from '@/services/apiClient';
import { SMS_PROMPT } from '@/integrations/sms/types';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

interface Message {
  id: string;
  from: 'system' | 'person';
  text: string;
  state?: 'sending' | 'sent' | 'delivered';
}

/**
 * Browser simulation of a text-message check-in.
 *
 * The lowest-bandwidth channel in the product: one digit completes it. Given a
 * realistic thread with send states and message timing, because the point is
 * that a person on a feature phone with almost no connectivity produces the
 * same normalized record as everybody else.
 *
 * No messages are sent by this prototype.
 */
export const SmsSimulator = ({ caseId }: { caseId: string }) => {
  const { t } = useTranslation();
  const submit = useAppStore((s) => s.submitInteraction);
  const action = useAppStore((s) => s.applyCounsellorAction);
  const capabilities = useAppStore((s) => s.capabilities);
  const lastIngest = useAppStore((s) => s.lastIngest);
  const smsLive = capabilities.sms.configured;
  const [sendState, setSendState] = useState<{ ok: boolean; note: string } | null>(null);
  const [sendingPrompt, setSendingPrompt] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<'incoming' | 'awaiting' | 'sending' | 'processing' | 'done'>(
    'incoming',
  );
  const [result, setResult] = useState<InteractionEvent | null>(null);
  const shownAt = useRef(Date.now());
  const threadEnd = useRef<HTMLDivElement>(null);

  // The prompt arrives, rather than simply being present.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMessages([{ id: 'm0', from: 'system', text: t('sms.prompt'), state: 'delivered' }]);
      setPhase('awaiting');
      shownAt.current = Date.now();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [t]);

  useEffect(() => {
    // Guarded: not every environment implements scroll anchoring.
    threadEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, phase]);

  const replies = [
    { digit: '1', label: t('sms.reply1'), value: 1 },
    { digit: '2', label: t('sms.reply2'), value: 4 },
    { digit: '3', label: t('sms.reply3'), value: 5 },
  ];

  const send = (digit: string, label: string, value: number) => {
    const latencyMs = Math.max(700, Date.now() - shownAt.current);
    const id = `p-${digit}`;
    setMessages((m) => [...m, { id, from: 'person', text: digit, state: 'sending' }]);
    setPhase('sending');

    // Sent, then delivered, then the reply - the ordinary rhythm of a text.
    window.setTimeout(() => {
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, state: 'sent' } : msg)));
    }, 420);

    window.setTimeout(() => {
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, state: 'delivered' } : msg)));
      setPhase('processing');
    }, 900);

    window.setTimeout(() => {
      void submit({
        caseId,
        channel: 'sms',
        responses: [{ questionId: 'q1-feeling', value, latencyMs }],
        skipped: 0,
      }).then((outcome) => {
        setPhase('done');
        if (outcome.event) setResult(outcome.event);
      });
      if (digit === '3') action({ caseId, kind: 'counsellor_requested', actorRole: 'victim' });

      setMessages((m) => [
        ...m,
        {
          id: 's-reply',
          from: 'system',
          text:
            digit === '3'
              ? `Thank you. A counsellor has been asked to contact you. Your reply: ${label}.`
              : `Thank you for checking in. Your reply: ${label}.`,
          state: 'delivered',
        },
      ]);
    }, 1800);
  };

  const reset = () => {
    setMessages([]);
    setPhase('incoming');
    setResult(null);
    window.setTimeout(() => {
      setMessages([{ id: 'm0', from: 'system', text: t('sms.prompt'), state: 'delivered' }]);
      setPhase('awaiting');
      shownAt.current = Date.now();
    }, 500);
  };

  const sendPrompt = async () => {
    setSendingPrompt(true);
    const result = await sendTestSms();
    setSendingPrompt(false);
    setSendState({
      ok: result.ok,
      note: result.ok
        ? `The prompt was sent through ${result.provider}. Reply from the handset and it will arrive through the webhook.`
        : (result.reason ?? 'The message could not be sent.'),
    });
  };

  return (
    <div className="space-y-5">
      <ChannelStatus channel="sms" processing={phase === 'processing' || sendingPrompt} />

      {smsLive ? (
        <div className="rounded-3xl border border-teal-500/30 bg-teal-500/[0.05] px-5 py-5">
          <p className="eyebrow">Live provider</p>
          <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-700">
            Send the check-in prompt to the registered handset, then reply from the phone itself.
            The reply arrives as a signed webhook, is matched to this case, and enters the same
            pipeline as every other channel.
          </p>
          <p className="mt-2 font-mono text-[12px] text-ink-500">
            {capabilities.inboundNumber ? `from ${capabilities.inboundNumber}` : ''}
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => void sendPrompt()}
            disabled={sendingPrompt}
          >
            Send the check-in prompt
          </button>
          {sendState ? (
            <p
              className={cn(
                'mt-3 text-[12.5px] leading-relaxed',
                sendState.ok ? 'text-teal-600' : 'text-band-high',
              )}
            >
              {sendState.note}
            </p>
          ) : null}
          <p className="mt-4 border-t border-teal-500/15 pt-3 text-[11.5px] leading-relaxed text-ink-400">
            Message sent: &ldquo;{SMS_PROMPT}&rdquo;
          </p>
        </div>
      ) : null}

      {smsLive ? (
        <InlineWarning>
          The thread below remains available as a fallback and is recorded as a demo interaction, not
          as real traffic.
        </InlineWarning>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        {/* Thread */}
        <div className="rounded-3xl border border-line bg-ivory-100/70 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <p className="text-[12.5px] font-medium text-ink-900">Support check-in</p>
            <p className="font-mono text-[11px] text-ink-300">14566</p>
          </div>

          <ul className="mt-4 min-h-[180px] space-y-2.5">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.li
                  key={message.id}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={cn(
                    'max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                    message.from === 'system'
                      ? 'rounded-bl-md bg-paper text-ink-700'
                      : 'ml-auto rounded-br-md bg-forest-700 text-ivory-50',
                  )}
                >
                  <span className="flex items-end gap-2">
                    <span className="min-w-0">{message.text}</span>
                    {message.from === 'person' ? (
                      <span aria-hidden className="shrink-0 opacity-70">
                        {message.state === 'delivered' ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : message.state === 'sent' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" />
                        )}
                      </span>
                    ) : null}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>

            {phase === 'incoming' || phase === 'processing' ? (
              <li className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-paper px-3.5 py-2.5">
                <TypingDots />
              </li>
            ) : null}
            <div ref={threadEnd} />
          </ul>

          {phase === 'processing' ? (
            <p className="mt-3 text-[11.5px] uppercase tracking-[0.14em] text-ink-400">
              Processing the reply
            </p>
          ) : null}
        </div>

        {/* Composer */}
        <div className="rounded-3xl border border-line bg-paper px-5 py-5">
          <p className="eyebrow">Reply</p>
          <div className="mt-3 space-y-2">
            {replies.map((entry) => {
              const disabled = phase !== 'awaiting';
              return (
                <motion.button
                  key={entry.digit}
                  type="button"
                  onClick={() => send(entry.digit, entry.label, entry.value)}
                  disabled={disabled}
                  whileTap={disabled ? undefined : { scale: 0.98 }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors',
                    disabled
                      ? 'border-line bg-ivory-100/50 opacity-45'
                      : 'border-line bg-paper hover:border-forest-700/40 hover:bg-sage-100/50',
                  )}
                >
                  <span className="font-mono text-lg text-ink-900">{entry.digit}</span>
                  <span className="text-[13.5px] text-ink-700">{entry.label}</span>
                </motion.button>
              );
            })}
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-400">
            One digit is enough. It becomes a structured answer, a latency measurement and a
            completion state, exactly as a chat check-in would.
          </p>
        </div>
      </div>

      {result ? (
        <div className="space-y-4">
          <CheckInOutcome event={result} onRestart={reset} restartLabel="Send another reply" />
          {lastIngest ? (
            <p className="text-[12px] leading-relaxed text-ink-400">{lastIngest.note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
