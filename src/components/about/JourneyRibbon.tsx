import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface Moment {
  kind: 'Case event' | 'Check-in' | 'Signal' | 'Trend' | 'Human action';
  label: string;
  detail: string;
  tone: 'clay' | 'teal' | 'sage' | 'lav' | 'forest';
}

const MOMENTS: Moment[] = [
  {
    kind: 'Case event',
    label: 'Relief overdue',
    detail:
      'The first instalment of immediate relief was due weeks ago and has not arrived. This is a standing condition, not a moment that fades, so it keeps contributing.',
    tone: 'clay',
  },
  {
    kind: 'Check-in',
    label: 'Phone keypad, 40 seconds',
    detail:
      'No literacy needed and no smartphone. Three keypad answers, a latency measurement and a completion state produce the same record a chat check-in would.',
    tone: 'teal',
  },
  {
    kind: 'Signal',
    label: 'Shorter answers, slower replies',
    detail:
      'Response length is down against this person’s own baseline and two scheduled check-ins were missed. Going quiet is treated as information, not as an empty row.',
    tone: 'sage',
  },
  {
    kind: 'Case event',
    label: 'Accused released on bail',
    detail:
      'A sharp, persistent rise. The accused is at liberty and resident in the same ward, so the risk does not decay the way a single hearing date would.',
    tone: 'clay',
  },
  {
    kind: 'Trend',
    label: 'Four consecutive rises',
    detail:
      'Direction, repetition and a sustained shift away from the personal baseline, rather than one difficult day. A change point marks where the drift began.',
    tone: 'lav',
  },
  {
    kind: 'Human action',
    label: 'Counsellor confirms and escalates',
    detail:
      'A named person reviews the reason, confirms the concern, requests protection under the relevant provision and raises the relief delay with the district officer. Follow-up tightens to 48 hours.',
    tone: 'forest',
  },
];

const TONES: Record<Moment['tone'], { dot: string; ring: string; text: string }> = {
  clay: { dot: 'bg-band-elevated', ring: 'ring-band-elevated/25', text: 'text-band-elevated' },
  teal: { dot: 'bg-teal-500', ring: 'ring-teal-500/25', text: 'text-teal-600' },
  sage: { dot: 'bg-sage-500', ring: 'ring-sage-500/25', text: 'text-sage-500' },
  lav: { dot: 'bg-lav-400', ring: 'ring-lav-400/25', text: 'text-lav-500' },
  forest: { dot: 'bg-forest-700', ring: 'ring-forest-700/25', text: 'text-forest-700' },
};

/**
 * The case journey, as a line with moments that open.
 *
 * Deliberately abstract: no stock photography and nothing that could be read
 * as depicting a real person. The information is paced, so a reader takes one
 * moment at a time rather than a wall of detail.
 */
export const JourneyRibbon = () => {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative">
        <div aria-hidden className="absolute left-0 right-0 top-[13px] h-px bg-line" />
        <ol className="relative grid grid-cols-3 gap-y-6 sm:grid-cols-6">
          {MOMENTS.map((moment, index) => {
            const tone = TONES[moment.tone];
            const isActive = index === active;
            return (
              <li key={moment.label} className="flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-pressed={isActive}
                  className="group flex flex-col items-center gap-3 px-1"
                >
                  <span
                    className={cn(
                      'flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ivory-50 transition-all',
                      isActive ? `ring-4 ${tone.ring}` : 'ring-0',
                    )}
                  >
                    <motion.span
                      className={cn('h-2.5 w-2.5 rounded-full', tone.dot)}
                      animate={{ scale: isActive ? 1.35 : 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-[0.14em] transition-colors',
                      isActive ? tone.text : 'text-ink-300 group-hover:text-ink-500',
                    )}
                  >
                    {moment.kind}
                  </span>
                  <span
                    className={cn(
                      'max-w-[13ch] text-[12.5px] leading-snug transition-colors',
                      isActive ? 'text-ink-900' : 'text-ink-400',
                    )}
                  >
                    {moment.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <motion.div
        key={active}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 rounded-2xl border border-line bg-paper px-5 py-5 sm:px-7 sm:py-6"
      >
        <p className={cn('eyebrow', TONES[MOMENTS[active].tone].text)}>{MOMENTS[active].kind}</p>
        <h3 className="mt-2 font-display text-[22px] text-ink-900 sm:text-[26px]">
          {MOMENTS[active].label}
        </h3>
        <p className="mt-3 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-500">
          {MOMENTS[active].detail}
        </p>
      </motion.div>
    </div>
  );
};
