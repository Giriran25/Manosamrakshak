import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { RiskBand } from '@/types';
import { BAND_LABELS } from '@/lib/format';

const BAND_HEX: Record<RiskBand, string> = {
  stable: '#2E8474',
  watch: '#B08427',
  elevated: '#B4653F',
  high: '#9E4234',
};

/** Row-level sparkline. Deliberately unlabelled: it shows shape, not values. */
export const SparkTrend = ({ values, tone }: { values: number[]; tone: RiskBand }) => {
  if (values.length < 2) {
    return <span className="text-[11px] text-ink-300">one measurement</span>;
  }
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className="h-7 w-20" aria-hidden>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke={BAND_HEX[tone]}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BandDistributionChart = ({
  counts,
}: {
  counts: Record<RiskBand, number>;
}) => {
  const data = (Object.keys(counts) as RiskBand[]).map((band) => ({
    band: BAND_LABELS[band],
    key: band,
    count: counts[band],
  }));

  return (
    <div className="h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <XAxis
            dataKey="band"
            tick={{ fill: '#647A72', fontSize: 11 }}
            axisLine={{ stroke: '#DCE4E0' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#647A72', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={700}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={BAND_HEX[entry.key]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Victim-facing well-being shape. No numbers, no bands, no thresholds. */
export const GentleTrend = ({ values }: { values: number[] }) => {
  const data = values.map((value, index) => ({ index, value: 100 - value }));
  return (
    <div className="h-16 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <LineChart data={data} margin={{ top: 6, right: 4, bottom: 6, left: 4 }}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7FA79A"
            strokeWidth={2.2}
            dot={{ r: 2.5, fill: '#7FA79A', strokeWidth: 0 }}
            isAnimationActive
            animationDuration={900}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
