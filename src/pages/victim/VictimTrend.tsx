import { useAppStore, DEMO_CLOCK } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { GentleTrend } from '@/components/charts/MiniCharts';
import { Card, EmptyState, Eyebrow, Meter } from '@/components/common/Primitives';
import { CHANNEL_LABELS } from '@/engines/normalize';
import { relativeDays } from '@/lib/format';
import { BASELINE_MIN_INTERACTIONS } from '@/engines/constants';

/**
 * The person's own view of their trend.
 *
 * Direction and participation, in words. No score, no band, no threshold, and
 * no comparison with anybody else.
 */
export const VictimTrend = () => {
  const { t } = useTranslation();
  const session = useAppStore((s) => s.session);
  const caseId = session?.caseId;
  const trajectory = useAppStore((s) => (caseId ? s.trajectories[caseId] : undefined));
  const baseline = useAppStore((s) => (caseId ? s.baselines[caseId] : undefined));
  const interactions = useAppStore((s) => s.interactions.filter((e) => e.caseId === caseId));

  if (!trajectory || trajectory.length === 0) {
    return (
      <EmptyState
        title="Nothing to show yet"
        body="After your first check-in, this screen shows how things have been going over time."
      />
    );
  }

  const recent = trajectory.slice(-6);
  const change = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
  const established = baseline?.status === 'established';
  const completed = interactions.filter((e) => e.completion !== 'abandoned').length;

  return (
    <div className="space-y-7">
      <header>
        <Eyebrow>{t('nav.trend')}</Eyebrow>
        <h1 className="mt-3 max-w-[24ch] text-display-md text-ink-900">
          {change <= -5
            ? t('victim.trendSteadier')
            : change >= 5
              ? t('victim.trendHarder')
              : t('victim.trendSimilar')}
        </h1>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-500">
          This is your own pattern over time. It is not compared with anyone else, and there is no
          score here for you to worry about.
        </p>
      </header>

      <Card>
        <GentleTrend values={recent} />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <Eyebrow>{t('victim.baselineReady')}</Eyebrow>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
              {established
                ? 'Your usual pattern has been recorded from your first few check-ins. Changes are measured against that, not against other people.'
                : t('victim.baselineLearningDetail', {
                    done: baseline?.interactionsUsed ?? 0,
                    total: BASELINE_MIN_INTERACTIONS,
                  })}
            </p>
          </div>
          <Meter
            label="Check-ins completed"
            value={Math.min(100, (completed / 6) * 100)}
            caption={`${completed} recorded`}
            tone="sage"
          />
        </div>
      </Card>

      <Card>
        <Eyebrow>{t('victim.recentActivity')}</Eyebrow>
        <ul className="mt-3 divide-y divide-line">
          {[...interactions]
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .slice(0, 6)
            .map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 py-2.5 text-[13px]">
                <span className="text-ink-700">{CHANNEL_LABELS[event.channel]} check-in</span>
                <span className="text-ink-400">{relativeDays(event.startedAt, DEMO_CLOCK)}</span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
};
