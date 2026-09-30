import { motion } from 'framer-motion';
import type { RiskBand } from '@/types';
import { BAND_CLASSES, BAND_LABELS } from '@/lib/format';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;

/** A counted figure with a band-coloured rule under it. */
const Figure = ({
  label,
  value,
  tone,
  emphasis,
  index,
}: {
  label: string;
  value: number;
  tone?: RiskBand;
  emphasis?: boolean;
  index: number;
}) => {
  const counted = useCountUp(value, 750);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: EASE }}
      className={cn(
        'relative overflow-hidden rounded-2xl border px-4 py-4',
        emphasis ? 'border-forest-700/25 bg-forest-700/[0.05]' : 'border-line bg-paper',
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-[34px] leading-none tabular-nums text-ink-900">
        {counted}
      </p>
      <motion.span
        aria-hidden
        className={cn(
          'absolute bottom-0 left-0 h-[3px]',
          tone ? BAND_CLASSES[tone].dot : 'bg-forest-700/40',
        )}
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ duration: 0.8, delay: 0.2 + index * 0.06, ease: EASE }}
      />
    </motion.div>
  );
};

/**
 * The district in six numbers. Band figures carry their band colour as a rule,
 * so the row reads as a distribution rather than as six unrelated tiles.
 */
export const SummaryStats = ({
  total,
  counts,
  followUpsDue,
}: {
  total: number;
  counts: Record<RiskBand, number>;
  followUpsDue: number;
}) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    <Figure label="Active cases" value={total} index={0} />
    <Figure label={BAND_LABELS.stable} value={counts.stable} tone="stable" index={1} />
    <Figure label={BAND_LABELS.watch} value={counts.watch} tone="watch" index={2} />
    <Figure label={BAND_LABELS.elevated} value={counts.elevated} tone="elevated" index={3} />
    <Figure label="High priority" value={counts.high} tone="high" emphasis index={4} />
    <Figure label="Follow-ups due" value={followUpsDue} index={5} />
  </div>
);
