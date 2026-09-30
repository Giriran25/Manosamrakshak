import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { CaseStage } from '@/types';
import { CASE_STAGE_LABELS, CASE_STAGE_ORDER } from '@/engines/constants';
import { cn } from '@/lib/cn';

/** The case journey stepper. Neutral language, no legal claim about outcome. */
export const CaseJourney = ({ stage }: { stage: CaseStage }) => {
  const currentIndex = CASE_STAGE_ORDER.indexOf(stage);

  return (
    <ol className="grid gap-3 sm:grid-cols-6">
      {CASE_STAGE_ORDER.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'rounded-xl border px-3.5 py-3',
                current
                  ? 'border-forest-700/30 bg-forest-700/[0.06]'
                  : done
                    ? 'border-sage-200 bg-sage-100/50'
                    : 'border-line bg-paper',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
                    done
                      ? 'bg-sage-500 text-white'
                      : current
                        ? 'bg-forest-700 text-white'
                        : 'bg-ivory-200 text-ink-300',
                  )}
                >
                  {done ? <Check aria-hidden className="h-2.5 w-2.5" /> : index + 1}
                </span>
                {current ? (
                  <span className="text-[9.5px] uppercase tracking-[0.14em] text-forest-700">
                    now
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  'mt-2 text-[12.5px] leading-snug',
                  current ? 'text-ink-900' : done ? 'text-ink-600' : 'text-ink-400',
                )}
              >
                {CASE_STAGE_LABELS[step]}
              </p>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
};
