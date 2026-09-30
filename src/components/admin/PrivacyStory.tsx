import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ear, Eye, FileKey, Lock, Trash2, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The privacy model, as four things that happen to data rather than four
 * claims about it.
 *
 * Each step names what is kept, what is dropped, and who can see the result.
 * Selecting a step shows the transformation, because "pseudonymous" and
 * "minimum necessary" are easy to assert and hard to picture.
 */

interface Step {
  id: string;
  title: string;
  icon: typeof Lock;
  before: string;
  after: string;
  kept: string;
  dropped: string;
  note: string;
}

const STEPS: Step[] = [
  {
    id: 'identity',
    title: 'Identity',
    icon: UserRound,
    before: 'Name, address, phone number',
    after: 'Held in a separate vault',
    kept: 'A case reference: VC-2291',
    dropped: 'Every identifying field, from everything that is analysed',
    note: 'No case record carries a name. The queue, the trajectories and the scores are all computed from the reference alone.',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: FileKey,
    before: 'Check-ins, case events, readings',
    after: 'Keyed only to the case reference',
    kept: 'Structured answers, summary measures, timestamps',
    dropped: 'Any join back to the identity vault',
    note: 'A counsellor can do their entire job - rank, read, explain, decide - without ever seeing who the person is.',
  },
  {
    id: 'voice',
    title: 'Voice',
    icon: Ear,
    before: 'A spoken answer',
    after: 'Five summary measures',
    kept: 'Duration, energy, energy variation, pause ratio, speaking ratio',
    dropped: 'The recording itself, at the point of extraction',
    note: 'Analysed in the browser and discarded there. Playback is unavailable because there is nothing left to replay.',
  },
  {
    id: 'counsellor',
    title: 'Disclosure',
    icon: Eye,
    before: 'A request to contact someone',
    after: 'The minimum necessary fields, for five minutes',
    kept: 'Only the fields the stated purpose needs, partially masked',
    dropped: 'Everything else, and the access itself once it expires',
    note: 'Each release needs a purpose and a written justification, and is recorded. The justification stays on the request; the log holds the purpose code only.',
  },
];

export const PrivacyStory = () => {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <div>
      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((entry, index) => {
          const selected = index === active;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={selected}
                className={cn(
                  'flex h-full w-full flex-col items-start gap-2.5 rounded-2xl border px-4 py-4 text-left transition-all duration-300 ease-editorial',
                  selected
                    ? 'border-forest-700/30 bg-forest-700/[0.06]'
                    : 'border-line bg-paper hover:border-ink-900/20',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                    selected ? 'bg-forest-700 text-ivory-50' : 'bg-ivory-200 text-ink-500',
                  )}
                >
                  <entry.icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="font-mono text-[10.5px] text-ink-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    'font-display text-[19px] leading-tight',
                    selected ? 'text-ink-900' : 'text-ink-600',
                  )}
                >
                  {entry.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-4 rounded-3xl border border-line bg-paper px-5 py-6 sm:px-7"
        >
          {/* The transformation itself. */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-2xl bg-ivory-100 px-4 py-3.5">
              <p className="eyebrow">Goes in</p>
              <p className="mt-1.5 text-[14px] text-ink-900">{step.before}</p>
            </div>
            <motion.span
              aria-hidden
              className="self-center text-ink-300"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
            >
              &rarr;
            </motion.span>
            <div className="flex-1 rounded-2xl bg-sage-100/60 px-4 py-3.5">
              <p className="eyebrow">Comes out</p>
              <p className="mt-1.5 text-[14px] text-ink-900">{step.after}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
              className="rounded-2xl border border-sage-200 bg-sage-100/40 px-4 py-3.5"
            >
              <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-sage-500">
                <Lock aria-hidden className="h-3 w-3" />
                Kept
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{step.kept}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
              className="rounded-2xl border border-line bg-ivory-100/70 px-4 py-3.5"
            >
              <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
                <Trash2 aria-hidden className="h-3 w-3" />
                Dropped
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{step.dropped}</p>
            </motion.div>
          </div>

          <p className="mt-4 max-w-[78ch] border-t border-line pt-4 text-[13px] leading-relaxed text-ink-500">
            {step.note}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
