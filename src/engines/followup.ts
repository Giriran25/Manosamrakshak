import type { FollowUpCadence, RiskBand } from '@/types';
import { addDays } from '@/lib/math';

/**
 * Follow-up cadence rules. Support intensity adapts to what the signals and
 * the counsellor's decision say, rather than being fixed at registration.
 */

export const CADENCE_LABELS: Record<FollowUpCadence, string> = {
  monthly: 'Monthly',
  fortnightly: 'Fortnightly',
  weekly: 'Weekly',
  within_72h: 'Within 72 hours',
  within_48h: 'Within 48 hours',
  within_24h: 'Within 24 hours',
};

export const CADENCE_DAYS: Record<FollowUpCadence, number> = {
  monthly: 30,
  fortnightly: 14,
  weekly: 7,
  within_72h: 3,
  within_48h: 2,
  within_24h: 1,
};

export const cadenceForBand = (band: RiskBand): FollowUpCadence => {
  switch (band) {
    case 'high':
      return 'within_72h';
    case 'elevated':
      return 'weekly';
    case 'watch':
      return 'fortnightly';
    default:
      return 'monthly';
  }
};

export const dueAtFor = (cadence: FollowUpCadence, fromIso: string): string =>
  addDays(fromIso, CADENCE_DAYS[cadence]);

/** Ranking order, so a change can be described as an increase or a relaxation. */
const INTENSITY: FollowUpCadence[] = [
  'monthly',
  'fortnightly',
  'weekly',
  'within_72h',
  'within_48h',
  'within_24h',
];

export const isIntensification = (from: FollowUpCadence, to: FollowUpCadence): boolean =>
  INTENSITY.indexOf(to) > INTENSITY.indexOf(from);
