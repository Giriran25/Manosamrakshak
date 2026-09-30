import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { CaseEvent, CaseStage } from '@/types';
import { CASE_EVENT_LABELS, CASE_STAGE_LABELS, CASE_STAGE_ORDER } from '@/engines/constants';
import { relativeDays } from '@/lib/format';
import { DEMO_CLOCK } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The case journey as the person sees it.
 *
 * A single track with the stages laid along it and the events that have
 * actually happened attached underneath. No scores, no weights, no
 * contribution figures - those belong on the counsellor's side. The language
 * is factual and makes no claim about how the case will end.
 */
export const JourneyTrack = ({
  stage,
  events,
}: {
  stage: CaseStage;
  events: CaseEvent[];
}) => {
  const currentIndex = CASE_STAGE_ORDER.indexOf(stage);
  const past = events
    .filter((e) => e.occurredAt <= DEMO_CLOCK)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 3);
  const next = events
    .filter((e) => e.occurredAt > DEMO_CLOCK)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];

  return (
    <div className="rounded-3xl border border-line bg-paper px-5 py-6 sm:px-7">
      <div className="relative">
        <div aria-hidden className="absolute left-0 right-0 top-[11px] h-px bg-line" />
        <motion.div
          aria-hidden
          className="absolute left-0 top-[11px] h-px bg-sage-500"
          initial={{ width: 0 }}
          whileInView={{
            width: `${(currentIndex / (CASE_STAGE_ORDER.length - 1)) * 100}%`,
          }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: EASE }}
        />
        <ol className="relative grid grid-cols-3 gap-y-5 sm:grid-cols-6">
          {CASE_STAGE_ORDER.map((step, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            return (
              <motion.li
                key={step}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.07, ease: EASE }}
                className="flex flex-col items-center text-center"
              >
                <span
                  className={cn(
                    'flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-paper',
                    done
                      ? 'bg-sage-500 text-white'
                      : current
                        ? 'bg-forest-700 text-white'
                        : 'bg-ivory-200 text-ink-300',
                  )}
                >
                  {done ? (
                    <Check aria-hidden className="h-3 w-3" />
                  ) : (
                    <span className="text-[10px]">{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'mt-2.5 max-w-[11ch] text-[12px] leading-snug',
                    current ? 'text-ink-900' : done ? 'text-ink-500' : 'text-ink-300',
                  )}
                >
                  {CASE_STAGE_LABELS[step]}
                </span>
                {current ? (
                  <span className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-forest-700">
                    now
                  </span>
                ) : null}
              </motion.li>
            );
          })}
        </ol>
      </div>

      {(past.length > 0 || next) ? (
        <div className="mt-7 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          {past.length > 0 ? (
            <div>
              <p className="eyebrow">Recently on your case</p>
              <ul className="mt-2.5 space-y-1.5">
                {past.map((event) => (
                  <li key={event.id} className="text-[13px] text-ink-600">
                    {CASE_EVENT_LABELS[event.type]}
                    <span className="ml-2 text-[11.5px] text-ink-400">
                      {relativeDays(event.occurredAt, DEMO_CLOCK)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {next ? (
            <div>
              <p className="eyebrow">Coming up</p>
              <p className="mt-2.5 text-[14px] text-ink-900">{CASE_EVENT_LABELS[next.type]}</p>
              <p className="mt-0.5 text-[12px] text-ink-400">
                {relativeDays(next.occurredAt, DEMO_CLOCK)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
