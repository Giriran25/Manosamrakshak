import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, LifeBuoy, PhoneCall } from 'lucide-react';
import { useAppStore, DEMO_CLOCK } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { GentleTrend } from '@/components/charts/MiniCharts';
import { EmptyState, Eyebrow } from '@/components/common/Primitives';
import { Rise, StaggeredStatement } from '@/components/common/Editorial';
import { JourneyTrack } from '@/components/case/JourneyTrack';
import { CADENCE_LABELS } from '@/engines/followup';
import { CHANNEL_LABELS } from '@/engines/normalize';
import { BASELINE_MIN_INTERACTIONS } from '@/engines/constants';
import { formatDate, relativeDays } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The victim home, as a short narrative.
 *
 * It answers four questions in order: how have things been, when is the next
 * check-in, where am I in my case, and what support is there. Everything a
 * counsellor sees - the score, the band, the queue position, the words "risk"
 * and "priority" - is absent by design. A person in support is not shown their
 * own triage number.
 */
export const VictimHome = () => {
  const { t } = useTranslation();
  const session = useAppStore((s) => s.session);
  const caseId = session?.caseId;
  const caseRecord = useAppStore((s) => s.cases.find((c) => c.caseId === caseId));
  const trajectory = useAppStore((s) => (caseId ? s.trajectories[caseId] : undefined));
  const baseline = useAppStore((s) => (caseId ? s.baselines[caseId] : undefined));
  const followUp = useAppStore((s) => (caseId ? s.followUps[caseId] : undefined));
  const events = useAppStore((s) => s.events.filter((e) => e.caseId === caseId));
  const interactions = useAppStore((s) => s.interactions.filter((e) => e.caseId === caseId));

  if (!caseRecord || !trajectory) {
    return (
      <EmptyState
        title="No case is linked to this account"
        body="A case is opened by the district office. Once it exists, your check-ins and support appear here."
      />
    );
  }

  const recent = trajectory.slice(-4);
  const movement =
    recent.length < 2 ? 0 : recent[recent.length - 1] - recent[0];
  const direction = movement <= -5 ? 'steadier' : movement >= 5 ? 'harder' : 'similar';

  const established = baseline?.status === 'established';
  const lastFew = [...interactions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 3);

  return (
    <div className="space-y-12 pb-4">
      {/* Welcome, and the honest opening question. */}
      <header>
        <Rise>
          <Eyebrow>{caseRecord.caseId}</Eyebrow>
        </Rise>
        <StaggeredStatement
          text="How have things been lately?"
          className="mt-4 max-w-[20ch] text-display-md text-ink-900"
          delay={0.1}
        />
        <Rise delay={0.35}>
          <p className="mt-4 max-w-[50ch] text-[15.5px] leading-relaxed text-ink-500">
            {t('victim.greetingSub')}
          </p>
        </Rise>
      </header>

      {/* The one action that matters on this screen. */}
      <Rise delay={0.1}>
        <div className="overflow-hidden rounded-3xl border border-forest-700/20 bg-forest-700/[0.05]">
          <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:px-7">
            <div className="min-w-0 flex-1">
              <Eyebrow>{t('victim.nextCheckIn')}</Eyebrow>
              <p className="mt-2 font-display text-[30px] leading-none text-ink-900">
                {followUp ? formatDate(followUp.dueAt) : formatDate(DEMO_CLOCK)}
              </p>
              <p className="mt-2 text-[13px] text-ink-500">
                {followUp ? CADENCE_LABELS[followUp.cadence] : ''} &middot;{' '}
                {t('victim.checkInTakes')}
              </p>
            </div>
            <Link
              to="/victim/check-in"
              className="btn-primary shrink-0 px-7 py-3.5 text-[15px]"
            >
              {t('victim.startCheckIn')}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
          <p className="border-t border-forest-700/10 px-5 py-3 text-[12px] text-ink-400 sm:px-7">
            You can check in whenever you want to, not only on the date above.
          </p>
        </div>
      </Rise>

      {/* How things have been, in words first and shape second. */}
      <section>
        <Rise>
          <Eyebrow>{t('victim.wellbeing')}</Eyebrow>
        </Rise>
        <Rise delay={0.06}>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-line bg-paper px-5 py-6 sm:px-7">
              <p className="max-w-[26ch] font-display text-[26px] leading-tight text-ink-900">
                {direction === 'steadier'
                  ? t('victim.trendSteadier')
                  : direction === 'harder'
                    ? t('victim.trendHarder')
                    : t('victim.trendSimilar')}
              </p>
              <div className="mt-5">
                <GentleTrend values={recent} />
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-400">
                {established
                  ? t('victim.baselineReady')
                  : `${t('victim.baselineLearning')} · ${t('victim.baselineLearningDetail', {
                      done: baseline?.interactionsUsed ?? 0,
                      total: BASELINE_MIN_INTERACTIONS,
                    })}`}
              </p>
              <Link
                to="/victim/trend"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-forest-700 underline decoration-line underline-offset-4"
              >
                {t('nav.trend')}
                <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="rounded-3xl border border-line bg-ivory-100/70 px-5 py-6">
              <Eyebrow>{t('victim.recentActivity')}</Eyebrow>
              {lastFew.length === 0 ? (
                <p className="mt-3 text-[13px] text-ink-400">No check-ins yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {lastFew.map((event, index) => (
                    <motion.li
                      key={event.id}
                      initial={{ opacity: 0, x: -6 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.07, ease: EASE }}
                      className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2.5 last:border-0"
                    >
                      <span className="text-[13.5px] text-ink-700">
                        {CHANNEL_LABELS[event.channel]}
                      </span>
                      <span className="text-[12px] text-ink-400">
                        {relativeDays(event.startedAt, DEMO_CLOCK)}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
                {t('victim.privacyLine')}
              </p>
            </div>
          </div>
        </Rise>
      </section>

      {/* Your journey. */}
      <section>
        <Rise>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>{t('victim.caseJourney')}</Eyebrow>
              <h2 className="mt-2 max-w-[24ch] text-display-sm text-ink-900">
                Where your case has reached
              </h2>
            </div>
            <Link
              to="/victim/case"
              className="text-[13px] text-forest-700 underline decoration-line underline-offset-4"
            >
              {t('nav.caseStatus')}
            </Link>
          </div>
        </Rise>
        <Rise delay={0.08} className="mt-5">
          <JourneyTrack stage={caseRecord.stage} events={events} />
        </Rise>
      </section>

      {/* Support. */}
      <section>
        <Rise>
          <Eyebrow>{t('nav.support')}</Eyebrow>
        </Rise>
        <Rise delay={0.06}>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              to="/victim/support"
              className="group rounded-3xl border border-line bg-paper px-5 py-6 transition-all duration-300 ease-editorial hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-100">
                <PhoneCall aria-hidden className="h-[18px] w-[18px] text-forest-700" />
              </span>
              <p className="mt-4 font-display text-[22px] leading-tight text-ink-900">
                {t('support.requestCounsellor')}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
                You do not need to give a reason.
              </p>
            </Link>

            <div className="rounded-3xl border border-line bg-paper px-5 py-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-100">
                <LifeBuoy aria-hidden className="h-[18px] w-[18px] text-forest-700" />
              </span>
              <p className="mt-4 font-display text-[22px] leading-tight text-ink-900">
                {t('support.helpline')}
              </p>
              <p className="mt-1.5 font-display text-[30px] leading-none text-ink-900">14566</p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
                The national helpline. This prototype does not place calls.
              </p>
            </div>
          </div>
        </Rise>
      </section>
    </div>
  );
};
