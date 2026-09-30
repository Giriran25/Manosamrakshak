import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import type { Channel, InteractionEvent } from '@/types';
import { empathyResponse, EMOTION_LABELS } from '@/engines/empathy';
import { CHANNEL_LABELS } from '@/engines/normalize';
import { useTranslation } from '@/hooks/useTranslation';
import { useProcessingStages } from '@/hooks/useProcessingStages';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Three pulsing dots. Used for both "listening" and a channel's own typing state. */
export const TypingDots = ({ tone = 'sage' }: { tone?: 'sage' | 'light' }) => (
  <span className="flex gap-1" aria-hidden>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className={cn('h-1.5 w-1.5 rounded-full', tone === 'sage' ? 'bg-sage-500' : 'bg-white/60')}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
      />
    ))}
  </span>
);

export const TypingIndicator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-[13px] text-ink-400" role="status" aria-live="polite">
    <TypingDots />
    {label}
  </div>
);

/**
 * The supportive reply, preceded by the two processing stages.
 *
 * Deterministic templates, chosen by a hash of the interaction id. Nothing
 * here diagnoses, promises safety, or claims to understand what the person is
 * going through, and no text leaves the browser.
 */
export const EmpathyResponse = ({ event }: { event: InteractionEvent }) => {
  const { t } = useTranslation();
  const stage = useProcessingStages(event.id);

  return (
    <div className="min-h-[128px] rounded-2xl border border-sage-200 bg-sage-100/50 px-5 py-5 sm:px-6">
      <AnimatePresence mode="wait">
        {stage !== 'done' ? (
          <motion.div
            key={stage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex h-full min-h-[80px] items-center"
          >
            <TypingIndicator
              label={
                stage === 'listening'
                  ? `${t('checkin.listening')}...`
                  : `${t('checkin.analysing')}...`
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="reply"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
            aria-live="polite"
          >
            <p className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-sage-500">
              <Check aria-hidden className="h-3 w-3" />
              {t('checkin.thanks')}
            </p>
            <p className="mt-3 max-w-[52ch] font-display text-[19px] leading-[1.4] text-ink-900">
              {empathyResponse(event.extractedSignals.emotion, event.id)}
            </p>
            <p className="mt-3 text-[12.5px] text-ink-500">{t('checkin.recorded')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * The architecture, in four steps, shown at the end of every channel.
 *
 * This is the point of the whole check-in surface: four very different
 * surfaces, one record, one downstream path. Showing it makes the claim
 * checkable rather than asserted.
 */
export const PipelineTrace = ({ channel }: { channel: Channel }) => {
  const steps = [
    { label: CHANNEL_LABELS[channel], note: 'the channel used' },
    { label: 'Normalized interaction', note: 'one shape for all four' },
    { label: 'Signals', note: 'language, voice, engagement' },
    { label: 'Support priority', note: 'reviewed by a person' },
  ];

  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {steps.map((step, index) => (
        <motion.li
          key={step.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 + index * 0.12, ease: EASE }}
          className="flex flex-1 items-center gap-2"
        >
          <div className="min-w-0 flex-1 rounded-xl border border-line bg-ivory-100/70 px-3 py-2.5">
            <p className="truncate text-[12px] font-medium text-ink-900">{step.label}</p>
            <p className="truncate text-[10.5px] text-ink-400">{step.note}</p>
          </div>
          {index < steps.length - 1 ? (
            <span aria-hidden className="text-ink-300">
              &rarr;
            </span>
          ) : null}
        </motion.li>
      ))}
    </ol>
  );
};

/** The raw record, collapsed by default. Deliberate, not debug output. */
export const NormalizedEventPanel = ({ event }: { event: InteractionEvent }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const s = event.extractedSignals;

  const record = {
    id: event.id,
    caseId: event.caseId,
    channel: event.channel,
    timestamp: event.startedAt,
    completion: event.completion,
    latencyMs: event.latencyMs,
    textLength: event.textLength,
    voice: event.voice ? 'summary measures only' : null,
    extractedSignals: {
      textDistress: s.textDistress,
      behaviourDistress: s.behaviourDistress,
      voiceSignal: s.voiceSignal,
      compositeRaw: s.compositeRaw,
      emotion: s.emotion,
      crisisFlag: s.crisisFlag,
    },
    confidence: event.confidence,
  };

  return (
    <div className="rounded-2xl border border-line bg-paper">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink-900">
            {t('checkin.viewNormalized')}
          </span>
          <span className="block truncate text-[11.5px] text-ink-400">
            {t('checkin.normalizedNote')}
          </span>
        </span>
        <span className="chip border-line text-ink-400">
          {EMOTION_LABELS[s.emotion]}
        </span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-5 py-4">
              <pre className="overflow-x-auto rounded-xl bg-forest-900 px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-sage-100">
                {JSON.stringify(record, null, 2)}
              </pre>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-400">
                Interaction confidence {event.confidence}%. Where a recording was made, only the
                summary measures above were kept - the audio was analysed in the browser and
                discarded.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/** Common closing block for every channel, so all four end the same way. */
export const CheckInOutcome = ({
  event,
  onRestart,
  restartLabel,
}: {
  event: InteractionEvent;
  onRestart: () => void;
  restartLabel: string;
}) => (
  <div className="space-y-4">
    <EmpathyResponse event={event} />
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.1, duration: 0.5 }}
      className="space-y-4"
    >
      <PipelineTrace channel={event.channel} />
      <NormalizedEventPanel event={event} />
      <button type="button" className="btn-secondary" onClick={onRestart}>
        {restartLabel}
      </button>
    </motion.div>
  </div>
);
