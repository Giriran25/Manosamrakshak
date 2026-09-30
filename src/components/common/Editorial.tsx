import { useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/cn';

/**
 * Editorial composition pieces.
 *
 * The narrative surfaces - landing, how-it-works, the privacy story - are
 * built from these rather than from cards, so that pacing and whitespace are
 * consistent and a reader takes one idea at a time. Every one of them checks
 * the reduced-motion preference and falls back to a static render.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Word-by-word reveal for a single large statement. */
export const StaggeredStatement = ({
  text,
  className,
  delay = 0,
  as: As = 'h1',
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'p';
}) => {
  const reduced = useReducedMotion();
  const words = text.split(' ');

  if (reduced) return <As className={className}>{text}</As>;

  return (
    <As className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: '105%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.75, delay: delay + index * 0.055, ease: EASE }}
          >
            {word}
            {index < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </As>
  );
};

/** The same reveal, triggered when the statement scrolls into view. */
export const ScrollStatement = ({
  lines,
  className,
  lineClassName,
}: {
  lines: string[];
  className?: string;
  lineClassName?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-18% 0px -18% 0px' });

  return (
    <div ref={ref} className={className}>
      {lines.map((line, index) => (
        <div key={line} className="overflow-hidden">
          <motion.p
            className={cn('font-display', lineClassName)}
            initial={{ y: '100%', opacity: 0 }}
            animate={inView ? { y: 0, opacity: 1 } : undefined}
            transition={{ duration: 0.8, delay: index * 0.12, ease: EASE }}
          >
            {line}
          </motion.p>
        </div>
      ))}
    </div>
  );
};

/** Fade and lift on entry. The workhorse for sections and cards. */
export const Rise = ({
  children,
  delay = 0,
  className,
  distance = 16,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  distance?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: distance }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.65, delay, ease: EASE }}
    className={className}
  >
    {children}
  </motion.div>
);

/** Children rise in sequence rather than all at once. */
export const RiseGroup = ({
  children,
  className,
  stagger = 0.07,
}: {
  children: ReactNode[];
  className?: string;
  stagger?: number;
}) => (
  <div className={className}>
    {children.map((child, index) => (
      <Rise key={index} delay={index * stagger}>
        {child}
      </Rise>
    ))}
  </div>
);

/**
 * Restrained parallax. The element drifts a fraction of the scroll distance,
 * which reads as depth without ever moving content away from where a reader
 * expects to find it.
 */
export const Parallax = ({
  children,
  distance = 60,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
    layoutEffect: false,
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
    </div>
  );
};

/** A thin numbered rule used to open a section on the narrative pages. */
export const SectionMarker = ({ index, label }: { index: string; label: string }) => (
  <Rise>
    <div className="flex items-center gap-3 border-t border-line pt-4">
      <span className="font-mono text-[11px] tabular-nums text-ink-300">{index}</span>
      <span className="eyebrow">{label}</span>
    </div>
  </Rise>
);

/**
 * Progressive disclosure for a dense screen: the section renders its heading
 * immediately and its body once it has been scrolled to, so a long analytical
 * page arrives a piece at a time instead of as a wall.
 */
export const DisclosureSection = ({
  index,
  label,
  title,
  description,
  children,
  className,
}: {
  index: string;
  label: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn('scroll-mt-20', className)}>
    <SectionMarker index={index} label={label} />
    {title ? (
      <Rise delay={0.05}>
        <h2 className="mt-4 max-w-[30ch] text-display-sm text-ink-900">{title}</h2>
      </Rise>
    ) : null}
    {description ? (
      <Rise delay={0.1}>
        <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-ink-500">
          {description}
        </p>
      </Rise>
    ) : null}
    <Rise delay={0.14} className="mt-6">
      {children}
    </Rise>
  </section>
);
