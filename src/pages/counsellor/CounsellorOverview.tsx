import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppStore, DEMO_CLOCK } from '@/store/useAppStore';
import { useDistrict } from '@/hooks/useDistrict';
import { ALERT_BUDGET, CASE_STAGE_LABELS } from '@/engines/constants';
import { SummaryStats } from '@/components/counsellor/SummaryStats';
import { LiveActivity } from '@/components/counsellor/LiveActivity';
import { BandDistributionChart, SparkTrend } from '@/components/charts/MiniCharts';
import { RiskBadge, SafetyChip, TrendBadge } from '@/components/risk/RiskPrimitives';
import { EmptyState, Eyebrow } from '@/components/common/Primitives';
import { Rise } from '@/components/common/Editorial';
import { relativeDays, signed } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The district at a glance.
 *
 * Three questions in order: how much work is there, who is at the top of it,
 * and how much of the risk is procedural rather than personal. The last one
 * matters because it is the part an officer can remove by paying relief or
 * unblocking a hearing.
 */
export const CounsellorOverview = () => {
  const session = useAppStore((s) => s.session);
  const { queue, counts, followUpsDue, safetyCount, casePressure } = useDistrict();
  const trajectories = useAppStore((s) => s.trajectories);

  if (queue.length === 0) {
    return (
      <EmptyState
        title="No cases in this district"
        body="Cases are scoped to the district on your account, and nothing outside it is loaded at all."
      />
    );
  }

  const top = queue.slice(0, 3);
  const stages = Object.entries(
    queue.reduce<Record<string, number>>((acc, row) => {
      const label = CASE_STAGE_LABELS[row.caseRecord.stage];
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{session?.displayLabel}</Eyebrow>
          <h1 className="mt-2 text-display-md text-ink-900">Overview</h1>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ink-500">
            Pseudonymous case references only. Identity is released through the audited request
            flow, and nothing on this screen needs it.
          </p>
        </div>
        <Link to="/counsellor/queue" className="btn-primary">
          Open the priority queue
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </header>

      <SummaryStats total={queue.length} counts={counts} followUpsDue={followUpsDue} />

      {safetyCount > 0 ? (
        <Rise>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-band-high/30 bg-band-high/[0.07] px-4 py-3.5">
            <SafetyChip />
            <p className="text-[13px] text-ink-700">
              {safetyCount} case{safetyCount === 1 ? '' : 's'} pinned by the deterministic safety
              override. These bypass scoring entirely and are already at the top of the queue.
            </p>
            <Link
              to="/counsellor/queue"
              className="ml-auto text-[13px] text-band-high underline decoration-band-high/30 underline-offset-4"
            >
              Review
            </Link>
          </div>
        </Rise>
      ) : null}

      {/* Who is at the top, and why. */}
      <section>
        <Rise>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Needs attention first</Eyebrow>
              <h2 className="mt-2 text-display-sm text-ink-900">
                Today&rsquo;s three, out of {ALERT_BUDGET} you can review
              </h2>
            </div>
          </div>
        </Rise>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {top.map((row, index) => (
            <motion.article
              key={row.caseRecord.caseId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
              className="flex flex-col rounded-3xl border border-line bg-paper px-5 py-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[11px] text-ink-300">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-1 font-mono text-[17px] text-ink-900">
                    {row.caseRecord.caseId}
                  </p>
                </div>
                <RiskBadge band={row.assessment.band} score={row.assessment.distressScore} />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <TrendBadge trend={row.assessment.trend} />
                <SparkTrend
                  values={trajectories[row.caseRecord.caseId] ?? []}
                  tone={row.assessment.band}
                />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-line py-3 text-center">
                {[
                  ['Baseline', row.assessment.baseline ?? '—'],
                  [
                    'Deviation',
                    row.assessment.deviation === null ? '—' : signed(row.assessment.deviation),
                  ],
                  ['Confidence', `${row.assessment.confidence.overall}%`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-400">{label}</dt>
                    <dd className="mt-1 font-mono text-[14px] tabular-nums text-ink-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-ink-500">
                {row.assessment.factors[0]?.title ?? 'No contributing factors recorded.'}
              </p>

              <Link
                to={`/counsellor/case/${row.caseRecord.caseId}`}
                className="btn-secondary mt-4 self-start text-[13px]"
              >
                Open case
                <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      <section>
        <LiveActivity />
      </section>

      {/* Distribution and procedural pressure. */}
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Rise>
          <div className="h-full rounded-3xl border border-line bg-paper px-5 py-5 sm:px-6">
            <Eyebrow>Support priority across the district</Eyebrow>
            <div className="mt-4">
              <BandDistributionChart counts={counts} />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
              Bands: 0&ndash;29 stable, 30&ndash;49 watch, 50&ndash;69 elevated, 70&ndash;100 high.
              Prototype heuristic thresholds, not clinical categories.
            </p>
          </div>
        </Rise>

        <Rise delay={0.08}>
          <div className="flex h-full flex-col gap-4">
            <div className="rounded-3xl border border-line bg-paper px-5 py-5">
              <Eyebrow>Procedural pressure</Eyebrow>
              <p className="mt-2 font-display text-[40px] leading-none tabular-nums text-ink-900">
                {casePressure}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
                cases where relief, bail, a chargesheet or a repeated adjournment is currently among
                the top contributing factors. This is the part of the risk a district officer can
                remove directly.
              </p>
            </div>

            <div className="rounded-3xl border border-line bg-ivory-100/70 px-5 py-5">
              <Eyebrow>Stage distribution</Eyebrow>
              <ul className="mt-3 space-y-2">
                {stages.map(([stage, count]) => (
                  <li key={stage} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-ink-600">{stage}</span>
                    <span className="font-mono tabular-nums text-ink-900">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Rise>
      </section>

      <Rise>
        <div className="rounded-3xl border border-line bg-ivory-100/60 px-5 py-4">
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Demo clock {relativeDays(DEMO_CLOCK, DEMO_CLOCK)}: every figure on this screen is
            computed from the synthetic cohort at a fixed point in time, so the demo is identical on
            every run.
          </p>
        </div>
      </Rise>
    </div>
  );
};
