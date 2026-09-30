import { motion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import type { CaseEvent, CaseStage } from '@/types';
import { computeCaseContext } from '@/engines/caseContext';
import { CASE_EVENT_DECAY_OVERRIDES, CASE_EVENT_LABELS } from '@/engines/constants';
import { formatDate, relativeDays } from '@/lib/format';
import { DEMO_CLOCK } from '@/store/useAppStore';
import { cn } from '@/lib/cn';

/**
 * The case timeline, with each event's actual contribution to the
 * case-context stream shown beside it.
 *
 * Upcoming listings are marked as anticipated stressors, because raising risk
 * before the date is the whole point of Stream A. Standing conditions - relief
 * still unpaid, an accused still at liberty - are marked as such rather than
 * being quietly decayed away.
 */
export const CaseTimeline = ({ events, stage }: { events: CaseEvent[]; stage: CaseStage }) => {
  const context = computeCaseContext(events, stage, DEMO_CLOCK);
  const byId = new Map(context.contributions.map((c) => [c.event.id, c]));

  const ordered = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <ol className="relative space-y-4 pl-6">
      <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
      {ordered.map((event, index) => {
        const contribution = byId.get(event.id);
        const points = contribution?.points ?? 0;
        const upcoming = contribution?.kind === 'upcoming';
        const persistent = Boolean(CASE_EVENT_DECAY_OVERRIDES[event.type]) && !upcoming;

        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
            className="relative"
          >
            <span
              aria-hidden
              className={cn(
                'absolute -left-6 top-1.5 h-[9px] w-[9px] rounded-full ring-4 ring-ivory-50',
                upcoming
                  ? 'bg-lav-400'
                  : points >= 12
                    ? 'bg-band-high'
                    : points > 0
                      ? 'bg-band-elevated'
                      : 'bg-sage-400',
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[14px] font-medium text-ink-900">
                {CASE_EVENT_LABELS[event.type]}
              </p>
              {upcoming ? (
                <span className="chip border-lav-200 bg-lav-200/30 text-lav-500">
                  <CalendarClock aria-hidden className="h-3 w-3" />
                  anticipated stressor
                </span>
              ) : null}
              {points !== 0 ? (
                <span
                  className={cn(
                    'font-mono text-[11.5px] tabular-nums',
                    points > 0 ? 'text-band-elevated' : 'text-band-stable',
                  )}
                >
                  {points > 0 ? '+' : ''}
                  {points.toFixed(1)} points
                  {persistent ? ' standing' : ''}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[12px] text-ink-400">
              {formatDate(event.occurredAt)} &middot; {relativeDays(event.occurredAt, DEMO_CLOCK)}
              {event.statutoryNote ? ` · ${event.statutoryNote}` : ''}
            </p>
            {event.detail ? (
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{event.detail}</p>
            ) : null}
          </motion.li>
        );
      })}
      <li className="relative pt-1 text-[11.5px] leading-relaxed text-ink-400">
        Case-context stream currently reads {context.signal} / 100. Past events decay with time;
        relief still unpaid and an accused still at liberty are treated as standing conditions and
        do not decay.
      </li>
    </ol>
  );
};
