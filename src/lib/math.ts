/** Small deterministic numeric helpers shared by the prototype engines. */

export const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const round = (value: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
};

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/** Median absolute deviation - robust spread measure used for within-person scaling. */
export const mad = (values: number[]): number => {
  if (values.length === 0) return 0;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
};

export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

/** Least-squares slope of y over its own index. Units: points per step. */
export const leastSquaresSlope = (values: number[]): number => {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xBar = mean(xs);
  const yBar = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - xBar) * (values[i] - yBar);
    den += (xs[i] - xBar) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

export const daysBetween = (fromIso: string, toIso: string): number =>
  (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000;

export const addDays = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
