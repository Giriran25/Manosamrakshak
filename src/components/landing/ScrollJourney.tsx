import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

/**
 * The case journey, driven by scroll.
 *
 * On a wide screen it is a tall track with a sticky stage: as the reader
 * scrolls, a line draws across five stations and each resolves in turn. It is
 * the argument of the product in one gesture - a case is not an event, it is a
 * sequence, and the last station is always a person.
 *
 * On a phone a full-height sticky stage would not fit, so the same five
 * stations are laid out as an ordinary list with everything legible at once.
 */

interface JourneyStation {
  kind: string;
  label: string;
  body: string;
  colour: string;
}

const STATIONS: JourneyStation[] = [
  {
    kind: 'Case',
    label: 'A case is opened',
    body: 'An FIR is registered and a statutory clock starts: relief within days, a chargesheet within weeks, notice of any bail proceeding.',
    colour: '#9E4234',
  },
  {
    kind: 'Check-in',
    label: 'A short check-in',
    body: 'Sixty to ninety seconds, on a channel the person already uses. Chat, a spoken answer, a phone keypad, or a single digit by text.',
    colour: '#246F60',
  },
  {
    kind: 'Signal',
    label: 'Four readings',
    body: 'What the case did. What was said. How it was said. How much was said, and how quickly - or whether the person went quiet.',
    colour: '#6E76A8',
  },
  {
    kind: 'Trend',
    label: 'Movement, not a snapshot',
    body: 'Compared against this person’s own baseline, across consecutive check-ins, with the point where the drift began marked.',
    colour: '#7FA79A',
  },
  {
    kind: 'Human action',
    label: 'A person decides',
    body: 'The case arrives in a ranked queue with its reasons attached. A named counsellor confirms, dismisses or escalates, and support tightens.',
    colour: '#12372F',
  },
];

const StationBody = ({ station }: { station: JourneyStation }) => (
  <>
    <p className="mt-3 font-display text-[19px] leading-tight text-ink-900 sm:text-[22px]">
      {station.label}
    </p>
    <p className="mt-2 max-w-[34ch] text-[12.5px] leading-relaxed text-ink-500">{station.body}</p>
  </>
);

/** Wide-screen station: dims until the scroll position reaches it. */
const ScrollStation = ({
  station,
  index,
  progress,
}: {
  station: JourneyStation;
  index: number;
  progress: MotionValue<number>;
}) => {
  const start = index / STATIONS.length;
  const active = useTransform(progress, [start - 0.06, start + 0.04], [0, 1]);
  const opacity = useTransform(active, [0, 1], [0.32, 1]);
  const y = useTransform(active, [0, 1], [14, 0]);
  const dot = useTransform(active, [0, 1], [1, 1.6]);

  return (
    <motion.li style={{ opacity, y }} className="flex-1">
      <div className="flex items-center gap-2">
        <motion.span
          aria-hidden
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: station.colour, scale: dot }}
        />
        <span
          className="text-[9.5px] uppercase tracking-[0.16em]"
          style={{ color: station.colour }}
        >
          {station.kind}
        </span>
      </div>
      <StationBody station={station} />
    </motion.li>
  );
};

const Heading = () => (
  <>
    <p className="eyebrow">One case, as it moves</p>
    <h2 className="mt-4 max-w-[22ch] text-display-md text-ink-900">
      A case is not an event. It is a sequence a person has to live through.
    </h2>
  </>
);

export const ScrollJourney = ({ className }: { className?: string }) => {
  const track = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 640px)');
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ['start start', 'end end'],
    layoutEffect: false,
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const lineWidth = useTransform(progress, [0, 0.92], ['0%', '100%']);

  if (!wide) {
    return (
      <div className={cn('py-16', className)}>
        <Heading />
        <ol className="relative mt-10 space-y-7 pl-6">
          <span aria-hidden className="absolute bottom-2 left-[4px] top-2 w-px bg-line" />
          {STATIONS.map((station, index) => (
            <motion.li
              key={station.kind}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <span
                aria-hidden
                className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full ring-4 ring-ivory-50"
                style={{ background: station.colour }}
              />
              <span
                className="text-[9.5px] uppercase tracking-[0.16em]"
                style={{ color: station.colour }}
              >
                {station.kind}
              </span>
              <StationBody station={station} />
            </motion.li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div ref={track} className={cn('relative h-[240vh]', className)}>
      <div className="sticky top-0 flex h-screen flex-col justify-center">
        <Heading />

        <div className="relative mt-12">
          <div aria-hidden className="absolute left-0 right-0 top-[5px] h-px bg-line" />
          <motion.div
            aria-hidden
            className="absolute left-0 top-[5px] h-px bg-forest-700"
            style={{ width: lineWidth }}
          />
          <ol className="relative flex gap-6">
            {STATIONS.map((station, index) => (
              <ScrollStation
                key={station.kind}
                station={station}
                index={index}
                progress={progress}
              />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};
