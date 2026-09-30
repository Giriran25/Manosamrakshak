import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import type { Assessment, CaseEvent } from '@/types';
import { CASE_EVENT_LABELS } from '@/engines/constants';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  trajectory: number[];
  assessment: Assessment;
  events: CaseEvent[];
  interactionDates: string[];
}

interface Point {
  index: number;
  label: string;
  iso: string | undefined;
  score: number;
  lower?: number;
  upper?: number;
}

/**
 * The distress trajectory, as a story rather than a line chart.
 *
 * It carries the whole argument in one picture: the person's own baseline as a
 * band, the drift away from it, the point where the drift became sustained, a
 * confidence ribbon on the most recent readings, and - underneath - the case
 * events that were happening while the line moved. Selecting an event draws
 * the connection between what the case did and what the person reported.
 *
 * The same data is available as a table, so the chart is not the only way in.
 */
export const TrajectoryChart = ({ trajectory, assessment, events, interactionDates }: Props) => {
  const [showTable, setShowTable] = useState(false);
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const baseline = assessment.baseline;

  const data: Point[] = useMemo(
    () =>
      trajectory.map((score, index) => {
        const iso = interactionDates[index];
        const recent = index >= trajectory.length - 2;
        const spread = recent ? Math.round((100 - assessment.confidence.overall) / 3) + 3 : 0;
        return {
          index,
          iso,
          label: iso ? formatShortDate(iso) : `#${index + 1}`,
          score,
          lower: recent ? Math.max(0, score - spread) : undefined,
          upper: recent ? Math.min(100, score + spread) : undefined,
        };
      }),
    [trajectory, interactionDates, assessment.confidence.overall],
  );

  /**
   * Each event is attached to the check-in nearest in time, which is how a
   * counsellor reads the chart anyway: what had just happened when this
   * reading was taken.
   */
  const anchored = useMemo(() => {
    if (data.length === 0) return [];
    return events
      .map((event) => {
        const eventTime = new Date(event.occurredAt).getTime();
        let nearest = 0;
        let best = Number.POSITIVE_INFINITY;
        data.forEach((point) => {
          if (!point.iso) return;
          const distance = Math.abs(new Date(point.iso).getTime() - eventTime);
          if (distance < best) {
            best = distance;
            nearest = point.index;
          }
        });
        return { event, pointIndex: nearest, point: data[nearest] };
      })
      .sort((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt));
  }, [events, data]);

  const active = anchored.find((entry) => entry.event.id === activeEvent);

  return (
    <div>
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <ComposedChart data={data} margin={{ top: 18, right: 16, bottom: 4, left: -16 }}>
            <defs>
              <linearGradient id="trajectoryFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#12372F" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#12372F" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#DCE4E0" strokeDasharray="2 6" vertical={false} />

            {/* The person's own baseline, as a band rather than a single line. */}
            {baseline !== null ? (
              <ReferenceArea
                y1={Math.max(0, baseline - 6)}
                y2={Math.min(100, baseline + 6)}
                fill="#8CA79A"
                fillOpacity={0.16}
                stroke="none"
              />
            ) : null}

            {[30, 50, 70].map((threshold) => (
              <ReferenceLine
                key={threshold}
                y={threshold}
                stroke="#DCE4E0"
                strokeWidth={1}
                label={{ value: String(threshold), position: 'right', fill: '#8FA29B', fontSize: 10 }}
              />
            ))}

            {baseline !== null ? (
              <ReferenceLine
                y={baseline}
                stroke="#7FA79A"
                strokeDasharray="5 4"
                label={{
                  value: `baseline ${baseline}`,
                  position: 'insideTopLeft',
                  fill: '#3D564D',
                  fontSize: 11,
                }}
              />
            ) : null}

            {/* Where the drift became sustained. */}
            {assessment.changePointIndex !== null && data[assessment.changePointIndex] ? (
              <ReferenceLine
                x={data[assessment.changePointIndex].label}
                stroke="#B4653F"
                strokeDasharray="3 3"
                label={{ value: 'change point', position: 'top', fill: '#B4653F', fontSize: 10 }}
              />
            ) : null}

            {/* The selected case event, drawn against the reading it sits beside. */}
            {active ? (
              <ReferenceLine
                x={active.point.label}
                stroke="#9E4234"
                strokeWidth={1.5}
                label={{
                  value: CASE_EVENT_LABELS[active.event.type],
                  position: 'insideTopRight',
                  fill: '#9E4234',
                  fontSize: 10,
                }}
              />
            ) : null}
            {active ? (
              <ReferenceDot
                x={active.point.label}
                y={active.point.score}
                r={6}
                fill="#9E4234"
                stroke="#F7F9F8"
                strokeWidth={2}
              />
            ) : null}

            <XAxis
              dataKey="label"
              tick={{ fill: '#647A72', fontSize: 11 }}
              axisLine={{ stroke: '#DCE4E0' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: '#647A72', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #DCE4E0',
                fontSize: 12,
                boxShadow: '0 12px 32px -24px rgba(12,26,22,0.4)',
              }}
              formatter={(value: number | string, name: string) =>
                name === 'score' ? [value, 'Distress signal'] : [value, name]
              }
            />

            {/* Confidence ribbon on the most recent readings. */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#2E8474"
              fillOpacity={0.14}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#F7F9F8"
              fillOpacity={1}
              connectNulls
              isAnimationActive={false}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke="none"
              fill="url(#trajectoryFill)"
              animationDuration={1100}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#12372F"
              strokeWidth={2.4}
              dot={{ r: 3, fill: '#12372F', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              animationDuration={1100}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Case events as a selectable strip under the chart. */}
      {anchored.length > 0 ? (
        <div className="mt-4">
          <p className="eyebrow mb-2">What the case was doing</p>
          <ul className="flex flex-wrap gap-1.5">
            {anchored.map((entry, index) => {
              const selected = entry.event.id === activeEvent;
              return (
                <motion.li
                  key={entry.event.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.35) }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveEvent(selected ? null : entry.event.id)}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                      selected
                        ? 'border-stream-case bg-stream-case/10 text-stream-case'
                        : 'border-line bg-paper text-ink-500 hover:border-ink-900/25 hover:text-ink-900',
                    )}
                  >
                    {CASE_EVENT_LABELS[entry.event.type]}
                  </button>
                </motion.li>
              );
            })}
          </ul>
          <p className="mt-2 min-h-[18px] text-[11.5px] leading-relaxed text-ink-400">
            {active
              ? `Marked against the check-in of ${active.point.label}, where the reading was ${active.point.score}.`
              : 'Select an event to see it against the reading beside it.'}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-[11.5px] text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-sm bg-sage-400/40" /> personal baseline band
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-sm bg-teal-500/20" /> confidence ribbon
        </span>
        <button
          type="button"
          className="ml-auto underline decoration-line underline-offset-4 hover:text-ink-700"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          {showTable ? 'Hide data' : 'View data'}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <caption className="sr-only">Distress signal by check-in</caption>
            <thead className="table-head">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Check-in
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Date
                </th>
                <th scope="col" className="py-2 font-medium">
                  Distress signal
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.index} className="border-b border-line/60">
                  <td className="py-1.5 pr-4 text-ink-400">{point.index + 1}</td>
                  <td className="py-1.5 pr-4 text-ink-500">{point.label}</td>
                  <td className="py-1.5 font-mono tabular-nums text-ink-900">{point.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
