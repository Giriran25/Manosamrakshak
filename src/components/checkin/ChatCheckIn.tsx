import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { InteractionEvent, InteractionResponse } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n/en';
import { CheckInOutcome, TypingDots } from './CheckInShared';
import { ChannelStatus } from '@/components/common/ChannelStatus';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

interface Question {
  id: string;
  prompt: TranslationKey;
  options: TranslationKey[];
  /** Only severity-style prompts contribute a structured value. */
  scored: boolean;
  freeTextInvite: TranslationKey;
}

const QUESTIONS: Question[] = [
  {
    id: 'q1-feeling',
    prompt: 'checkin.q1',
    options: ['checkin.q1o1', 'checkin.q1o2', 'checkin.q1o3', 'checkin.q1o4', 'checkin.q1o5'],
    scored: true,
    freeTextInvite: 'checkin.optionalText',
  },
  {
    id: 'q2-difficulty',
    prompt: 'checkin.q2',
    options: [
      'checkin.q2o1',
      'checkin.q2o2',
      'checkin.q2o3',
      'checkin.q2o4',
      'checkin.q2o5',
      'checkin.q2o6',
    ],
    scored: false,
    freeTextInvite: 'checkin.optionalText',
  },
  {
    id: 'q3-support',
    prompt: 'checkin.q3',
    options: ['checkin.q3o1', 'checkin.q3o2', 'checkin.q3o3', 'checkin.q3o4', 'checkin.q3o5'],
    scored: true,
    freeTextInvite: 'checkin.optionalText',
  },
];

interface Turn {
  id: string;
  from: 'system' | 'person';
  text: string;
}

/**
 * Chat check-in.
 *
 * A short, deliberately finite conversation - not an open-ended assistant.
 * The thread above shows what has been said so far; the composer below asks
 * one question at a time. Response latency, response length and completion are
 * captured as the person works through it, because going quiet or answering
 * more briefly than usual is itself a signal.
 */
export const ChatCheckIn = ({ caseId }: { caseId: string }) => {
  const { t } = useTranslation();
  const submit = useAppStore((s) => s.submitInteraction);
  const lastIngest = useAppStore((s) => s.lastIngest);

  const [step, setStep] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answers, setAnswers] = useState<InteractionResponse[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<InteractionEvent | null>(null);
  const shownAt = useRef(Date.now());
  const threadEnd = useRef<HTMLDivElement>(null);

  const question = QUESTIONS[step];

  // Each question arrives as a message, after a short typing beat.
  useEffect(() => {
    if (result) return;
    setAsking(true);
    const timer = window.setTimeout(() => {
      setTurns((existing) => {
        if (existing.some((turn) => turn.id === `q-${step}`)) return existing;
        return [...existing, { id: `q-${step}`, from: 'system', text: t(QUESTIONS[step].prompt) }];
      });
      setAsking(false);
      shownAt.current = Date.now();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [step, t, result]);

  useEffect(() => {
    // Guarded: not every environment implements scroll anchoring.
    threadEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [turns, asking]);

  const commit = useCallback(
    (skipped: boolean) => {
      const latencyMs = Math.max(400, Date.now() - shownAt.current);
      const chosen = selected === null ? null : t(question.options[selected]);
      const freeText = skipped ? undefined : text.trim() || undefined;

      const response: InteractionResponse = {
        questionId: question.id,
        value: skipped || selected === null ? null : question.scored ? selected + 1 : null,
        freeText,
        latencyMs,
      };

      const spoken = skipped
        ? t('common.skip')
        : [chosen, freeText].filter(Boolean).join(' — ') || t('common.skip');

      setTurns((existing) => [
        ...existing,
        { id: `a-${step}`, from: 'person', text: spoken },
      ]);

      const next = [...answers, response];
      setAnswers(next);
      setSelected(null);
      setText('');

      if (step === QUESTIONS.length - 1) {
        setSending(true);
        void submit({
          caseId,
          channel: 'chat',
          responses: next,
          skipped: next.filter((r) => r.value === null && !r.freeText).length,
        }).then((outcome) => {
          setSending(false);
          if (outcome.event) setResult(outcome.event);
        });
        return;
      }
      setStep((s) => s + 1);
    },
    [answers, caseId, question, submit, selected, step, t, text],
  );

  const restart = () => {
    setSending(false);
    setStep(0);
    setTurns([]);
    setAnswers([]);
    setSelected(null);
    setText('');
    setResult(null);
    shownAt.current = Date.now();
  };

  return (
    <div className="space-y-5">
      <ChannelStatus channel="chat" processing={sending} />

      {/* Progress: three beads, not a percentage. */}
      <div className="flex items-center gap-2">
        {QUESTIONS.map((q, index) => (
          <span
            key={q.id}
            aria-hidden
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-500',
              index < step || result
                ? 'bg-forest-700'
                : index === step
                  ? 'bg-forest-700/40'
                  : 'bg-ivory-200',
            )}
          />
        ))}
        <span className="ml-1 font-mono text-[11px] tabular-nums text-ink-300">
          {result ? QUESTIONS.length : step + 1}/{QUESTIONS.length}
        </span>
      </div>

      {/* Thread */}
      <div className="min-h-[180px] space-y-2.5">
        <AnimatePresence initial={false}>
          {turns.map((turn) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className={cn(
                'max-w-[88%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed sm:max-w-[76%]',
                turn.from === 'system'
                  ? 'rounded-bl-md border border-line bg-paper text-ink-900'
                  : 'ml-auto rounded-br-md bg-forest-700 text-ivory-50',
              )}
            >
              {turn.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {asking && !result ? (
          <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-paper px-4 py-3">
            <TypingDots />
          </div>
        ) : null}
        <div ref={threadEnd} />
      </div>

      {result ? (
        <div className="space-y-4">
          <CheckInOutcome event={result} onRestart={restart} restartLabel={t('checkin.another')} />
          {lastIngest ? (
            <p className="text-[12px] leading-relaxed text-ink-400">{lastIngest.note}</p>
          ) : null}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!asking ? (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="rounded-2xl border border-line bg-ivory-100/60 px-4 py-4 sm:px-5"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected === index}
                    onClick={() => setSelected(index)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left text-[14px] transition-all duration-200',
                      selected === index
                        ? 'border-forest-700 bg-forest-700 text-ivory-50'
                        : 'border-line bg-paper text-ink-700 hover:border-ink-900/25',
                    )}
                  >
                    {t(option)}
                  </button>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-[12.5px] text-ink-400">{t(question.freeTextInvite)}</span>
                <textarea
                  className="input mt-1.5 min-h-[80px] resize-y bg-paper"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => commit(false)}
                  disabled={selected === null && text.trim().length === 0}
                >
                  {step === QUESTIONS.length - 1 ? t('common.submit') : t('common.continue')}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="btn-ghost" onClick={() => commit(true)}>
                  {t('common.skip')}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </div>
  );
};
