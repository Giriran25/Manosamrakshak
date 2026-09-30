import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Clock } from 'lucide-react';
import { DEMO_CLOCK } from '@/store/useAppStore';
import { useDistrict } from '@/hooks/useDistrict';
import { CADENCE_LABELS } from '@/engines/followup';
import { RiskBadge, TrendBadge } from '@/components/risk/RiskPrimitives';
import { EmptyState, Eyebrow } from '@/components/common/Primitives';
import { formatDate, relativeDays } from '@/lib/format';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Follow-ups, by when they are due.
 *
 * Cadence is not fixed at registration: it is derived from the current band and
 * then overridden by whatever a counsellor decided. Each row says which of
 * those it is, so a tightened follow-up is visibly the result of a human
 * decision rather than of the model.
 */
export const FollowUpQueue = () => {
  const { dueRows } = useDistrict();

  if (dueRows.length === 0) {
    return (
      <EmptyState
        title="No follow-ups scheduled"
        body="A follow-up is created with the case and adapts as the support priority changes or a counsellor acts."
      />
    );
  }

  const overdue = dueRows.filter((row) => (row.followUp?.dueAt ?? '') <= DEMO_CLOCK);
  const upcoming = dueRows.filter((row) => (row.followUp?.dueAt ?? '') > DEMO_CLOCK);

  const Group = ({
    title,
    rows,
    tone,
  }: {
    title: string;
    rows: typeof dueRows;
    tone: 'overdue' | 'upcoming';
  }) => (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>{title}</Eyebrow>
        <span className="font-mono text-[12px] tabular-nums text-ink-400">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-400">Nothing in this group.</p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-3xl border border-line bg-paper">
          {rows.map((row, index) => (
            <motion.li
              key={row.caseRecord.caseId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: EASE }}
              className="group flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-4 transition-colors last:border-0 hover:bg-ivory-100/70"
            >
              <span
                aria-hidden
                className={cn(
                  'h-8 w-[3px] rounded-full',
                  tone === 'overdue' ? 'bg-band-high' : 'bg-sage-400',
                )}
              />
              <Link
                to={`/counsellor/case/${row.caseRecord.caseId}`}
                className="font-mono text-[13px] text-ink-900 decoration-line underline-offset-4 group-hover:underline"
              >
                {row.caseRecord.caseId}
              </Link>
              <RiskBadge
                band={row.assessment.band}
                score={row.assessment.distressScore}
                size="sm"
              />
              <TrendBadge trend={row.assessment.trend} />

              <span className="flex items-center gap-1.5 text-[13px] text-ink-600">
                <Clock aria-hidden className="h-3.5 w-3.5 text-ink-300" />
                {row.followUp ? CADENCE_LABELS[row.followUp.cadence] : ''}
              </span>

              <span className="ml-auto text-right">
                <span
                  className={cn(
                    'block text-[12.5px]',
                    tone === 'overdue' ? 'text-band-high' : 'text-ink-500',
                  )}
                >
                  {tone === 'overdue' ? 'due' : 'scheduled'}{' '}
                  {row.followUp ? relativeDays(row.followUp.dueAt, DEMO_CLOCK) : ''}
                </span>
                <span className="block text-[11px] text-ink-300">
                  {row.followUp ? formatDate(row.followUp.dueAt) : ''}
                </span>
              </span>

              <Link
                to={`/counsellor/case/${row.caseRecord.caseId}`}
                className="inline-flex items-center gap-1 text-[12.5px] text-forest-700 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                Open
                <ArrowUpRight aria-hidden className="h-3 w-3" />
              </Link>

              <p className="w-full text-[11.5px] leading-relaxed text-ink-400">
                {row.followUp?.reason}
                {row.followUp?.changedBy && row.followUp.changedBy !== 'system'
                  ? ` · set by ${row.followUp.changedBy}`
                  : ' · derived from the current band'}
              </p>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <header>
        <Eyebrow>Adaptive support</Eyebrow>
        <h1 className="mt-2 text-display-md text-ink-900">Follow-ups</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-500">
          Monthly, fortnightly or weekly while things are steady; within 72, 48 or 24 hours once
          the signals or a counsellor say otherwise.
        </p>
      </header>

      <Group title="Due now" rows={overdue} tone="overdue" />
      <Group title="Scheduled" rows={upcoming} tone="upcoming" />
    </div>
  );
};
