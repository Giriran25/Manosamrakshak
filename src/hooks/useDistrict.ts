import { useMemo } from 'react';
import type { RiskBand } from '@/types';
import { selectQueue, useAppStore, DEMO_CLOCK, type QueueRow } from '@/store/useAppStore';

export interface DistrictView {
  queue: QueueRow[];
  counts: Record<RiskBand, number>;
  followUpsDue: number;
  safetyCount: number;
  casePressure: number;
  trajectories: Record<string, number[]>;
  dueRows: QueueRow[];
}

/**
 * One derivation of the district picture, shared by every counsellor screen so
 * the overview, the queue and the follow-up list can never disagree.
 */
export const useDistrict = (): DistrictView => {
  const queue = useAppStore(selectQueue);
  const followUps = useAppStore((s) => s.followUps);
  const trajectories = useAppStore((s) => s.trajectories);

  return useMemo(() => {
    const counts: Record<RiskBand, number> = { stable: 0, watch: 0, elevated: 0, high: 0 };
    for (const row of queue) counts[row.assessment.band] += 1;

    return {
      queue,
      counts,
      trajectories,
      followUpsDue: Object.values(followUps).filter((f) => f.dueAt <= DEMO_CLOCK).length,
      safetyCount: queue.filter((row) => row.assessment.safetyOverride).length,
      // Cases where a statutory obligation or a repeated adjournment is
      // currently among the top contributing factors - the part of the risk a
      // district officer can actually remove.
      casePressure: queue.filter((row) =>
        row.assessment.factors.some((f) => /relief|adjourn|chargesheet|bail/i.test(f.title)),
      ).length,
      dueRows: [...queue]
        .filter((row) => row.followUp)
        .sort((a, b) => (a.followUp?.dueAt ?? '').localeCompare(b.followUp?.dueAt ?? '')),
    };
  }, [queue, followUps, trajectories]);
};
