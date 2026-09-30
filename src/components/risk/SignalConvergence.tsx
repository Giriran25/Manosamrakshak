import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import type { Assessment, SignalContribution } from '@/types';
import { CONTRIBUTION_LABELS } from '@/engines/fusion';
import { cn } from '@/lib/cn';

/**
 * The four streams converging on one number.
 *
 * Drawn rather than tabulated, because the claim being made is about
 * convergence: four independent readings, weighted, arriving at a single
 * support priority that a human then acts on. Stroke weight is the stream's
 * effective weight and stroke length is its value, so the picture cannot drift
 * from the arithmetic beside it.
 */

type StreamKey = 'caseContext' | 'text' | 'voice' | 'behaviour';

const STREAMS: Array<{ key: StreamKey; stream: string; colour: string; note: string }> = [
  {
    key: 'caseContext',
    stream: 'Stream A',
    colour: '#9E4234',
    note: 'relief, bail, hearings',
  },
  { key: 'text', stream: 'Stream B', colour: '#246F60', note: 'what was said' },
  { key: 'voice', stream: 'Stream C', colour: '#6E76A8', note: 'within-person only' },
  { key: 'behaviour', stream: 'Stream D', colour: '#7FA79A', note: 'latency, length, silence' },
];

const Y = [58, 128, 198, 268];
const START_X = 190;
const JOIN_X = 470;

export const SignalConvergence = ({
  assessment,
  className,
}: {
  assessment?: Assessment;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const reduced = useReducedMotion();

  const byKey = new Map<string, SignalContribution>(
    (assessment?.contributions ?? []).map((c) => [c.key, c]),
  );

  return (
    <div ref={ref} className={cn('overflow-x-auto', className)}>
      <svg
        viewBox="0 0 700 330"
        role="img"
        aria-labelledby="convergence-title convergence-desc"
        className="h-auto w-full min-w-[560px]"
      >
        <title id="convergence-title">Four signal streams converging on one support priority</title>
        <desc id="convergence-desc">
          Case context, language, voice and engagement are weighted and combined into a single
          support priority, which is then passed to a counsellor for a decision.
          {assessment
            ? ` Case context ${byKey.get('caseContext')?.value ?? 0}, language ${
                byKey.get('text')?.value ?? 0
              }, voice ${byKey.get('voice')?.value ?? 0}, engagement ${
                byKey.get('behaviour')?.value ?? 0
              }, support priority ${assessment.distressScore}.`
            : ''}
        </desc>

        <g fontFamily="Inter, system-ui, sans-serif">
          {STREAMS.map((stream, index) => {
            const contribution = byKey.get(stream.key);
            const value = contribution?.value ?? [72, 60, 44, 52][index];
            const weight = contribution?.weightPct ?? [25, 15, 5, 10][index];
            const available = contribution?.available ?? true;
            const y = Y[index];
            const width = Math.max(1.5, (weight / 100) * 12);

            return (
              <g key={stream.key}>
                <text x="0" y={y - 12} fontSize="10" letterSpacing="1.6" fill="#8FA29B">
                  {stream.stream.toUpperCase()}
                </text>
                <text x="0" y={y + 6} fontSize="14" fill="#17332B">
                  {CONTRIBUTION_LABELS[stream.key]}
                </text>
                <text x="0" y={y + 22} fontSize="10.5" fill="#647A72">
                  {stream.note}
                </text>

                {/* The reading, as a bar whose length is the value itself. */}
                <rect x={START_X} y={y - 4} width="120" height="8" rx="4" fill="#E4EAE7" />
                <motion.rect
                  x={START_X}
                  y={y - 4}
                  height="8"
                  rx="4"
                  fill={available ? stream.colour : '#C7D3CD'}
                  initial={{ width: 0 }}
                  animate={inView ? { width: (value / 100) * 120 } : undefined}
                  transition={{ duration: 0.9, delay: 0.15 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                />
                <text
                  x={START_X + 130}
                  y={y + 4}
                  fontSize="12"
                  fontFamily="ui-monospace, monospace"
                  fill={available ? '#17332B' : '#8FA29B'}
                >
                  {available ? value : '--'}
                </text>
                <text x={START_X + 130} y={y + 19} fontSize="9.5" fill="#8FA29B">
                  {available ? `${weight}% weight` : 'unavailable'}
                </text>

                {/* Converging path. Thickness is the stream's weight. */}
                <motion.path
                  d={`M ${START_X + 168} ${y} C ${START_X + 230} ${y}, ${JOIN_X - 70} 163, ${JOIN_X} 163`}
                  fill="none"
                  stroke={available ? stream.colour : '#C7D3CD'}
                  strokeWidth={width}
                  strokeOpacity={available ? 0.5 : 0.28}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : undefined}
                  transition={{ duration: 1.1, delay: 0.3 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                />
                {/* A travelling dash, to read as data moving rather than a static join. */}
                {!reduced && available ? (
                  <path
                    d={`M ${START_X + 168} ${y} C ${START_X + 230} ${y}, ${JOIN_X - 70} 163, ${JOIN_X} 163`}
                    fill="none"
                    stroke={stream.colour}
                    strokeWidth={Math.max(1, width * 0.5)}
                    strokeDasharray="3 25"
                    className="animate-flow"
                    style={{ animationDelay: `${index * 0.24}s` }}
                  />
                ) : null}
              </g>
            );
          })}

          {/* The single output. */}
          <motion.g
            initial={{ opacity: 0, scale: 0.94 }}
            animate={inView ? { opacity: 1, scale: 1 } : undefined}
            transition={{ duration: 0.6, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: '585px 163px' }}
          >
            <rect x={JOIN_X} y="113" width="230" height="100" rx="16" fill="#0C1A16" />
            <text x={JOIN_X + 20} y="140" fontSize="9.5" letterSpacing="1.8" fill="#9BBCB0">
              SUPPORT PRIORITY
            </text>
            <text
              x={JOIN_X + 20}
              y="180"
              fontSize="38"
              fontFamily="Fraunces, Georgia, serif"
              fill="#FFFFFF"
            >
              {assessment ? assessment.distressScore : '—'}
            </text>
            <text x={JOIN_X + 20} y="199" fontSize="10" fill="#9BBCB0">
              prototype signal, reviewed by a person
            </text>
          </motion.g>
        </g>
      </svg>
    </div>
  );
};
