import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, ShieldAlert } from 'lucide-react';
import type { Assessment, ConfidenceBand, RiskBand, TrendState } from '@/types';
import { BAND_CLASSES, BAND_LABELS, signed } from '@/lib/format';
import { TREND_LABELS } from '@/engines/trend';
import { CONFIDENCE_LABELS } from '@/engines/confidence';
import { cn } from '@/lib/cn';
import { Meter } from '@/components/common/Primitives';

/**
 * Risk is always presented with three things together: a word, a number and
 * an icon. Colour alone never carries the meaning, and the wording avoids any
 * clinical register.
 */

export const RiskBadge = ({
  band,
  score,
  size = 'md',
}: {
  band: RiskBand;
  score?: number;
  size?: 'sm' | 'md';
}) => {
  const c = BAND_CLASSES[band];
  return (
    <span
      className={cn(
        'chip',
        c.bg,
        c.border,
        c.text,
        size === 'sm' ? 'text-[10.5px]' : 'text-[11.5px]',
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {BAND_LABELS[band]}
      {typeof score === 'number' ? (
        <span className="font-mono tabular-nums opacity-80">{score}</span>
      ) : null}
    </span>
  );
};

const TREND_ICON: Record<TrendState, typeof ArrowRight> = {
  stable: Minus,
  improving: ArrowDownRight,
  watch: ArrowRight,
  deteriorating: ArrowUpRight,
  rapid_deterioration: ArrowUpRight,
  persistent_high: ArrowRight,
};

export const TrendBadge = ({ trend }: { trend: TrendState }) => {
  const Icon = TREND_ICON[trend];
  const tone =
    trend === 'improving'
      ? 'text-band-stable'
      : trend === 'stable'
        ? 'text-ink-400'
        : trend === 'watch'
          ? 'text-band-watch'
          : 'text-band-high';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-medium', tone)}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {TREND_LABELS[trend]}
    </span>
  );
};

export const ConfidenceChip = ({ band, value }: { band: ConfidenceBand; value: number }) => {
  const tone =
    band === 'high'
      ? 'border-teal-500/30 bg-teal-500/10 text-teal-600'
      : band === 'moderate'
        ? 'border-lav-200 bg-lav-200/30 text-lav-500'
        : 'border-band-watch/30 bg-band-watch/10 text-band-watch';
  return (
    <span className={cn('chip', tone)}>
      {CONFIDENCE_LABELS[band]}
      <span className="font-mono tabular-nums opacity-80">{value}%</span>
    </span>
  );
};

export const SafetyChip = () => (
  <span className="chip border-band-high/40 bg-band-high/10 uppercase tracking-[0.14em] text-band-high">
    <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
    Safety review
  </span>
);

export const DeviationValue = ({ deviation }: { deviation: number | null }) => {
  if (deviation === null) {
    return <span className="text-[13px] text-ink-300">baseline establishing</span>;
  }
  const tone =
    deviation >= 25
      ? 'text-band-high'
      : deviation >= 10
        ? 'text-band-elevated'
        : deviation <= -10
          ? 'text-band-stable'
          : 'text-ink-500';
  return <span className={cn('font-mono text-[13px] tabular-nums', tone)}>{signed(deviation)}</span>;
};

export const ConfidencePanel = ({ assessment }: { assessment: Assessment }) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="eyebrow">Confidence</p>
        <p className="mt-1 font-display text-3xl tabular-nums text-ink-900">
          {assessment.confidence.overall}%
        </p>
      </div>
      <ConfidenceChip band={assessment.confidence.band} value={assessment.confidence.overall} />
    </div>
    <div className="space-y-3.5">
      <Meter
        label="History length"
        value={assessment.confidence.historyPct}
        caption="How much of this person's own record the comparison rests on"
      />
      <Meter
        label="Signal completeness"
        value={assessment.confidence.completenessPct}
        caption="Share of the weighted streams actually available"
        tone="sage"
      />
      <Meter
        label="Cross-signal agreement"
        value={assessment.confidence.agreementPct}
        caption="How closely the available streams agree with each other"
        tone="lav"
      />
    </div>
    <p className="rounded-xl bg-ivory-100 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
      High concern with low confidence is routed to human review rather than fired as an alert. That
      is the difference between a triage aid and a threshold alarm.
    </p>
  </div>
);

export const SignalBreakdown = ({
  assessment,
  labels,
  streams,
}: {
  assessment: Assessment;
  labels: Record<string, string>;
  streams: Record<string, string>;
}) => (
  <div className="space-y-3">
    {assessment.contributions.map((contribution, index) => (
      <div key={contribution.key}>
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="flex items-baseline gap-2">
            <span className={contribution.available ? 'text-ink-700' : 'text-ink-300'}>
              {labels[contribution.key]}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-300">
              {streams[contribution.key]}
            </span>
          </span>
          <span className="font-mono tabular-nums text-ink-500">
            {contribution.available ? (
              <>
                {contribution.value}
                <span className="text-ink-300"> / {contribution.weightPct}%</span>
                <span className="ml-2 text-ink-900">{contribution.weightedPoints.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-ink-300">not available</span>
            )}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ivory-200">
          <motion.div
            className={cn(
              'h-full rounded-full',
              contribution.available ? 'bg-forest-700/70' : 'bg-ivory-200',
            )}
            initial={{ width: 0 }}
            animate={{ width: `${contribution.available ? contribution.value : 0}%` }}
            transition={{ duration: 0.7, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    ))}
    <div className="flex items-baseline justify-between border-t border-line pt-3 text-[13px]">
      <span className="text-ink-500">Weighted total</span>
      <span className="font-mono tabular-nums text-ink-900">{assessment.distressScore}</span>
    </div>
    <p className="text-[11.5px] leading-relaxed text-ink-400">
      Prototype heuristic weights, redistributed across whichever streams are present so the
      breakdown always accounts for the whole score. Not clinically validated and not calibrated
      against outcome data.
    </p>
  </div>
);

/**
 * The ranked reasons, entering one at a time as the section is read.
 *
 * Ordered by how much each factor actually contributed, and every number in
 * the text is one the engine computed rather than a phrase chosen to sound
 * convincing.
 */
export const WhyFlaggedCard = ({ assessment }: { assessment: Assessment }) => (
  <ol className="space-y-2.5">
    {assessment.factors.map((factor, index) => (
      <motion.li
        key={factor.rank}
        initial={{ opacity: 0, x: -10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, delay: index * 0.11, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'rounded-xl border-l-2 bg-ivory-100/70 px-4 py-3.5',
          factor.severity === 'strong'
            ? 'border-l-band-high'
            : factor.severity === 'notable'
              ? 'border-l-band-elevated'
              : 'border-l-sage-400',
        )}
      >
        <p className="flex items-baseline gap-3 text-[14px] font-medium leading-snug text-ink-900">
          <span className="font-mono text-[11px] tabular-nums text-ink-300">
            {String(factor.rank).padStart(2, '0')}
          </span>
          {factor.title}
        </p>
        <p className="mt-1.5 pl-[26px] text-[12.5px] leading-relaxed text-ink-500">
          {factor.detail}
        </p>
      </motion.li>
    ))}
  </ol>
);
