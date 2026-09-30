import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type { QueueRow } from '@/store/useAppStore';
import { DEMO_CLOCK } from '@/store/useAppStore';
import { CASE_STAGE_LABELS } from '@/engines/constants';
import { CADENCE_LABELS } from '@/engines/followup';
import { SparkTrend } from '@/components/charts/MiniCharts';
import {
  ConfidenceChip,
  DeviationValue,
  RiskBadge,
  SafetyChip,
  TrendBadge,
} from '@/components/risk/RiskPrimitives';
import { relativeDays } from '@/lib/format';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

type SortKey = 'priority' | 'score' | 'deviation' | 'confidence' | 'lastCheckIn';

const COLUMNS: Array<{ key: SortKey | null; label: string; align?: 'right' }> = [
  { key: 'priority', label: 'Priority' },
  { key: null, label: 'Case ID' },
  { key: 'score', label: 'Signal' },
  { key: null, label: 'Trend' },
  { key: null, label: 'Baseline' },
  { key: 'deviation', label: 'Deviation' },
  { key: null, label: 'Case stage' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'lastCheckIn', label: 'Last check-in' },
  { key: null, label: 'Next action' },
];

const NEXT_ACTION: Record<string, string> = {
  immediate_human_contact: 'Contact now',
  counsellor_contact_24h: 'Contact within 24h',
  human_review_required: 'Review manually',
  counsellor_review: 'Review within 48h',
  scheduled_checkin: 'Keep to schedule',
  continue_monitoring: 'Monitor',
};

/**
 * The operational table.
 *
 * The rank number is the first thing in the row, because the product's claim
 * is about ordering attention under a fixed capacity. Every other column is
 * there to let a counsellor disagree with that ordering: the reading, the
 * direction, this person's own baseline, how far they have moved from it, and
 * how much evidence there is.
 */
export const QueueTable = ({
  rows,
  trajectories,
  showRank = true,
}: {
  rows: QueueRow[];
  trajectories: Record<string, number[]>;
  showRank?: boolean;
}) => {
  const [sort, setSort] = useState<SortKey>('priority');
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const ranked = rows.map((row, index) => ({ row, rank: index + 1 }));
    const value = (entry: { row: QueueRow; rank: number }): number => {
      switch (sort) {
        case 'score':
          return entry.row.assessment.distressScore;
        case 'deviation':
          return entry.row.assessment.deviation ?? -999;
        case 'confidence':
          return entry.row.assessment.confidence.overall;
        case 'lastCheckIn':
          return entry.row.caseRecord.lastInteractionAt
            ? new Date(entry.row.caseRecord.lastInteractionAt).getTime()
            : 0;
        default:
          return -entry.rank;
      }
    };
    return [...ranked].sort((a, b) => (descending ? value(b) - value(a) : value(a) - value(b)));
  }, [rows, sort, descending]);

  const toggle = (key: SortKey) => {
    if (key === sort) setDescending((v) => !v);
    else {
      setSort(key);
      setDescending(true);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-paper">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left">
          <caption className="sr-only">
            District case queue, ranked by support priority and confidence
          </caption>
          <thead>
            <tr className="border-b border-line">
              {COLUMNS.filter((column) => showRank || column.label !== 'Priority').map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className="px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400"
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key as SortKey)}
                      className="inline-flex items-center gap-1 transition-colors hover:text-ink-900"
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'h-3 w-3 transition-all',
                          sort === column.key ? 'opacity-100' : 'opacity-25',
                          sort === column.key && !descending && 'rotate-180',
                        )}
                      />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ row, rank }, index) => {
              const assessment = row.assessment;
              return (
                <motion.tr
                  key={row.caseRecord.caseId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.24), ease: EASE }}
                  className="group border-b border-line/60 transition-colors last:border-0 hover:bg-ivory-100/80"
                >
                  {showRank ? (
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] tabular-nums',
                          rank <= 3
                            ? 'bg-forest-700 text-ivory-50'
                            : 'bg-ivory-200 text-ink-500',
                        )}
                      >
                        {rank}
                      </span>
                    </td>
                  ) : null}

                  <td className="px-4 py-3.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/counsellor/case/${row.caseRecord.caseId}`}
                        className="font-mono text-[13px] text-ink-900 decoration-line underline-offset-4 group-hover:underline"
                      >
                        {row.caseRecord.caseId}
                      </Link>
                      {assessment.safetyOverride ? <SafetyChip /> : null}
                    </span>
                    {row.suppressed ? (
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-ink-300">
                        dismissed, suppressed
                      </span>
                    ) : null}
                  </td>

                  <td className="px-4 py-3.5">
                    <RiskBadge band={assessment.band} score={assessment.distressScore} />
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-2.5">
                      <TrendBadge trend={assessment.trend} />
                      <SparkTrend
                        values={trajectories[row.caseRecord.caseId] ?? []}
                        tone={assessment.band}
                      />
                    </span>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-[13px] tabular-nums text-ink-500">
                    {assessment.baseline ?? '—'}
                  </td>

                  <td className="px-4 py-3.5">
                    <DeviationValue deviation={assessment.deviation} />
                  </td>

                  <td className="px-4 py-3.5 text-[13px] text-ink-600">
                    {CASE_STAGE_LABELS[row.caseRecord.stage]}
                  </td>

                  <td className="px-4 py-3.5">
                    <ConfidenceChip
                      band={assessment.confidence.band}
                      value={assessment.confidence.overall}
                    />
                  </td>

                  <td className="px-4 py-3.5 text-[12.5px] text-ink-400">
                    {row.caseRecord.lastInteractionAt
                      ? relativeDays(row.caseRecord.lastInteractionAt, DEMO_CLOCK)
                      : 'none yet'}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="flex flex-col items-start gap-1">
                      <span
                        className={cn(
                          'text-[12.5px]',
                          assessment.recommendation.kind === 'human_review_required'
                            ? 'text-band-watch'
                            : assessment.band === 'high'
                              ? 'text-band-high'
                              : 'text-ink-600',
                        )}
                      >
                        {NEXT_ACTION[assessment.recommendation.kind]}
                      </span>
                      <span className="text-[11px] text-ink-300">
                        {row.followUp ? CADENCE_LABELS[row.followUp.cadence] : ''}
                      </span>
                      <Link
                        to={`/counsellor/case/${row.caseRecord.caseId}`}
                        className="inline-flex items-center gap-1 text-[12px] text-forest-700 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        Open
                        <ArrowUpRight aria-hidden className="h-3 w-3" />
                      </Link>
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
