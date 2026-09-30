import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Shared low-level UI pieces. Kept together so the visual language stays consistent. */

export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('eyebrow', className)}>{children}</p>
);

export const Card = ({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) => <As className={cn('card p-5 sm:p-6', className)}>{children}</As>;

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div className="max-w-2xl">
      {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
      <h2 className="text-display-sm text-ink-900">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p> : null}
    </div>
    {action}
  </div>
);

export const Reveal = ({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

export const SimulatedBadge = ({ label }: { label: string }) => (
  <span className="chip border-lav-200 bg-lav-200/30 uppercase tracking-[0.14em] text-lav-500">
    {label}
  </span>
);

export const PrototypeNote = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-400">
    <ShieldCheck aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>{children}</span>
  </p>
);

export const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
    <Inbox aria-hidden className="h-6 w-6 text-ink-300" />
    <p className="text-sm font-medium text-ink-700">{title}</p>
    <p className="max-w-sm text-[13px] leading-relaxed text-ink-400">{body}</p>
  </div>
);

export const LoadingState = ({ label }: { label: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-5 py-6 text-sm text-ink-500"
  >
    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

export const InlineWarning = ({ children }: { children: ReactNode }) => (
  <div className="flex items-start gap-2.5 rounded-xl border border-band-watch/30 bg-band-watch/10 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
    <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-band-watch" />
    <span>{children}</span>
  </div>
);

export const Meter = ({
  label,
  value,
  caption,
  tone = 'teal',
}: {
  label: string;
  value: number;
  caption?: string;
  tone?: 'teal' | 'sage' | 'lav';
}) => {
  const bar = { teal: 'bg-teal-500', sage: 'bg-sage-500', lav: 'bg-lav-400' }[tone];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-500">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink-900">{Math.round(value)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory-200">
        <motion.div
          className={cn('h-full rounded-full', bar)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {caption ? <p className="mt-1.5 text-[11px] text-ink-400">{caption}</p> : null}
    </div>
  );
};

export const StatTile = ({
  label,
  value,
  caption,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  emphasis?: boolean;
}) => (
  <div
    className={cn(
      'rounded-2xl border px-4 py-4 transition-colors',
      emphasis ? 'border-forest-700/20 bg-forest-700/[0.04]' : 'border-line bg-paper',
    )}
  >
    <p className="eyebrow">{label}</p>
    <p className="mt-2 font-display text-3xl leading-none tabular-nums text-ink-900">{value}</p>
    {caption ? <p className="mt-2 text-[11.5px] leading-snug text-ink-400">{caption}</p> : null}
  </div>
);
