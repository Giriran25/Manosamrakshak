import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { useDistrict } from '@/hooks/useDistrict';
import { ALERT_BUDGET } from '@/engines/constants';
import { QueueTable } from '@/components/counsellor/QueueTable';
import { SafetyChip } from '@/components/risk/RiskPrimitives';
import { EmptyState, Eyebrow } from '@/components/common/Primitives';
import { Rise } from '@/components/common/Editorial';

const EASE = [0.22, 1, 0.36, 1] as const;

const RANKING_INPUTS = [
  'Support priority band',
  'Confidence in the reading',
  'Direction of travel',
  'Distance from the person’s own baseline',
  'Current case pressure',
  'Whether follow-up is overdue',
];

/**
 * Today's queue.
 *
 * The cap is the design, not a limitation: a counsellor has a real daily
 * capacity, so the system ranks and then cuts rather than raising an unbounded
 * number of alerts. Everything below the line is still monitored and still
 * visible under Cases - it is simply not claimed to need attention today.
 */
export const PriorityQueue = () => {
  const { queue, safetyCount } = useDistrict();
  const trajectories = useAppStore((s) => s.trajectories);

  if (queue.length === 0) {
    return (
      <EmptyState
        title="No cases in this district"
        body="Cases are scoped to the district on your account, and nothing outside it is loaded."
      />
    );
  }

  const budgeted = queue.slice(0, ALERT_BUDGET);
  const below = queue.length - budgeted.length;
  const fill = Math.min(100, (budgeted.length / ALERT_BUDGET) * 100);

  return (
    <div className="space-y-7">
      <header>
        <Eyebrow>Alert budget</Eyebrow>
        <h1 className="mt-2 text-display-md text-ink-900">Today&rsquo;s priority queue</h1>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-ink-500">
          Ranked by how much a person&rsquo;s attention is likely to matter, then capped at review
          capacity. Nothing here has been acted on by the system.
        </p>
      </header>

      {/* The cap, made visible. */}
      <Rise>
        <div className="rounded-3xl border border-forest-700/20 bg-forest-700/[0.04] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Review capacity</Eyebrow>
              <p className="mt-1.5 font-display text-[38px] leading-none tabular-nums text-ink-900">
                {budgeted.length}
                <span className="text-ink-300"> / {ALERT_BUDGET}</span>
              </p>
            </div>
            <p className="max-w-[44ch] text-[12.5px] leading-relaxed text-ink-500">
              {below > 0
                ? `${below} further case${below === 1 ? '' : 's'} in this district remain monitored below the line, and appear under Cases.`
                : 'Every case in this district fits within today’s review capacity.'}
            </p>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ivory-200">
            <motion.div
              className="h-full rounded-full bg-forest-700"
              initial={{ width: 0 }}
              animate={{ width: `${fill}%` }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          </div>

          <div className="mt-5 border-t border-forest-700/10 pt-4">
            <p className="eyebrow">What the ranking uses</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {RANKING_INPUTS.map((input, index) => (
                <motion.li
                  key={input}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05, ease: EASE }}
                  className="chip border-line bg-paper text-ink-600"
                >
                  {input}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </Rise>

      {safetyCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-band-high/30 bg-band-high/[0.07] px-4 py-3">
          <SafetyChip />
          <p className="text-[13px] text-ink-700">
            Pinned to the top, ahead of the ranking, by the deterministic safety override.
          </p>
        </div>
      ) : null}

      <Rise delay={0.06}>
        <QueueTable rows={budgeted} trajectories={trajectories} />
      </Rise>

      <p className="text-[11.5px] leading-relaxed text-ink-400">
        Prototype support-priority signal. A triage number for ordering a queue, not a diagnosis,
        and not an input to relief, compensation or eligibility decisions.
      </p>
    </div>
  );
};
