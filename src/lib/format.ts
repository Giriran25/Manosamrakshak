import type { RiskBand } from '@/types';
import { daysBetween } from './math';

export const BAND_LABELS: Record<RiskBand, string> = {
  stable: 'Stable',
  watch: 'Watch',
  elevated: 'Elevated',
  high: 'High',
};

/** Every band is also given a word and a shape in the UI, never colour alone. */
export const BAND_CLASSES: Record<RiskBand, { text: string; bg: string; border: string; dot: string }> =
  {
    stable: {
      text: 'text-band-stable',
      bg: 'bg-band-stable/10',
      border: 'border-band-stable/30',
      dot: 'bg-band-stable',
    },
    watch: {
      text: 'text-band-watch',
      bg: 'bg-band-watch/10',
      border: 'border-band-watch/30',
      dot: 'bg-band-watch',
    },
    elevated: {
      text: 'text-band-elevated',
      bg: 'bg-band-elevated/10',
      border: 'border-band-elevated/30',
      dot: 'bg-band-elevated',
    },
    high: {
      text: 'text-band-high',
      bg: 'bg-band-high/10',
      border: 'border-band-high/30',
      dot: 'bg-band-high',
    },
  };

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export const relativeDays = (iso: string, nowIso: string): string => {
  const days = Math.round(daysBetween(iso, nowIso));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1) return `${days} days ago`;
  if (days === -1) return 'tomorrow';
  return `in ${Math.abs(days)} days`;
};

export const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

export const pct = (value: number): string => `${Math.round(value)}%`;
