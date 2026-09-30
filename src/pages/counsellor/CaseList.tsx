import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { CaseStage, RiskBand, TrendState } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useDistrict } from '@/hooks/useDistrict';
import { CASE_STAGE_LABELS, CASE_STAGE_ORDER } from '@/engines/constants';
import { QueueTable } from '@/components/counsellor/QueueTable';
import { EmptyState, Eyebrow } from '@/components/common/Primitives';
import { TREND_LABELS } from '@/engines/trend';
import { BAND_LABELS } from '@/lib/format';

/**
 * Every case in the district, filterable.
 *
 * Separate from the queue on purpose: the queue is a claim about what needs
 * attention today, and this is the record. A counsellor who disagrees with the
 * ranking works from here.
 */
export const CaseList = () => {
  const { queue } = useDistrict();
  const trajectories = useAppStore((s) => s.trajectories);

  const [search, setSearch] = useState('');
  const [band, setBand] = useState<RiskBand | 'all'>('all');
  const [trend, setTrend] = useState<TrendState | 'all'>('all');
  const [stage, setStage] = useState<CaseStage | 'all'>('all');

  const filtered = useMemo(
    () =>
      queue.filter((row) => {
        if (band !== 'all' && row.assessment.band !== band) return false;
        if (trend !== 'all' && row.assessment.trend !== trend) return false;
        if (stage !== 'all' && row.caseRecord.stage !== stage) return false;
        if (search && !row.caseRecord.caseId.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        return true;
      }),
    [queue, band, trend, stage, search],
  );

  const clear = () => {
    setSearch('');
    setBand('all');
    setTrend('all');
    setStage('all');
  };

  const filtersActive = search !== '' || band !== 'all' || trend !== 'all' || stage !== 'all';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>District record</Eyebrow>
          <h1 className="mt-2 text-display-md text-ink-900">Cases</h1>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ink-500">
            Every case scoped to your district, whether or not it is in today&rsquo;s queue.
          </p>
        </div>
        <p className="font-mono text-[13px] tabular-nums text-ink-400">
          {filtered.length} of {queue.length}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search by case reference</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-300"
          />
          <input
            className="input w-[190px] py-2 pl-9 text-[13px]"
            placeholder="Case reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <select
          className="input w-auto py-2 text-[13px]"
          value={band}
          onChange={(e) => setBand(e.target.value as RiskBand | 'all')}
          aria-label="Filter by support priority band"
        >
          <option value="all">All bands</option>
          {(['high', 'elevated', 'watch', 'stable'] as RiskBand[]).map((option) => (
            <option key={option} value={option}>
              {BAND_LABELS[option]}
            </option>
          ))}
        </select>

        <select
          className="input w-auto py-2 text-[13px]"
          value={trend}
          onChange={(e) => setTrend(e.target.value as TrendState | 'all')}
          aria-label="Filter by trend"
        >
          <option value="all">All trends</option>
          {(
            [
              'rapid_deterioration',
              'deteriorating',
              'persistent_high',
              'watch',
              'stable',
              'improving',
            ] as TrendState[]
          ).map((option) => (
            <option key={option} value={option}>
              {TREND_LABELS[option]}
            </option>
          ))}
        </select>

        <select
          className="input w-auto py-2 text-[13px]"
          value={stage}
          onChange={(e) => setStage(e.target.value as CaseStage | 'all')}
          aria-label="Filter by case stage"
        >
          <option value="all">All stages</option>
          {CASE_STAGE_ORDER.map((option) => (
            <option key={option} value={option}>
              {CASE_STAGE_LABELS[option]}
            </option>
          ))}
        </select>

        {filtersActive ? (
          <button type="button" className="btn-ghost text-[13px]" onClick={clear}>
            Clear filters
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No cases match these filters"
          body="Clear a filter to see the rest of the district's record."
        />
      ) : (
        <QueueTable rows={filtered} trajectories={trajectories} showRank={false} />
      )}
    </div>
  );
};
